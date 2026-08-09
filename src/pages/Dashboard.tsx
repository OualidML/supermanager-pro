import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  Package,
  AlertTriangle,
  DollarSign,
  Plus,
  Landmark,
  Receipt,
  Sparkles,
  Activity
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useTranslation } from 'react-i18next'

// Custom CountUp animation component
function CountUp({ value, prefix = '', suffix = '', decimals = 0 }: { value: number | string; prefix?: string; suffix?: string; decimals?: number }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let start = 0
    const end = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(end)) {
      setCount(0)
      return
    }
    if (end === 0) {
      setCount(0)
      return
    }
    const duration = 1000 // 1 second animation duration
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeProgress = progress * (2 - progress) // Easing out quad
      const currentCount = easeProgress * (end - start) + start
      setCount(currentCount)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [value])

  const formatted = count.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return <span>{prefix}{formatted}{suffix}</span>
}

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [storeName, setStoreName] = useState('My Store')
  const [currency, setCurrency] = useState('$')
  
  // KPI states
  const [todayNetProfit, setTodayNetProfit] = useState(0)
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [todayExpenses, setTodayExpenses] = useState(0)
  const [todayTransactions, setTodayTransactions] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [expiredCount, setExpiredCount] = useState(0)
  const [expiringSoonCount, setExpiringSoonCount] = useState(0)
  const [monthNetProfit, setMonthNetProfit] = useState(0)

  // Chart and ranking states
  const [chartData, setChartData] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])

  // Pull-to-refresh states
  const [startY, setStartY] = useState(0)
  const [pullOffset, setPullOffset] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === 0) return
    const currentY = e.touches[0].clientY
    const diff = currentY - startY
    if (diff > 0) {
      setPullOffset(Math.min(70, diff * 0.4))
    }
  }

  const handleTouchEnd = async () => {
    if (pullOffset > 45) {
      setIsRefreshing(true)
      await fetchDashboardData()
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: {
          message: 'Dashboard metrics refreshed',
          type: 'success'
        }
      }))
      setIsRefreshing(false)
    }
    setStartY(0)
    setPullOffset(0)
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      if (!isRefreshing) setLoading(true)

      // 1. Fetch Auth User details
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // 2. Fetch Store Profile details
      const { data: profile } = await supabase
        .from('store_profiles')
        .select('*')
        .eq('owner_id', user.id)
        .limit(1)

      if (profile && profile.length > 0) {
        setStoreName(profile[0].name || 'My Store')
        setCurrency(profile[0].currency || '$')
      }

      // 3. Compile KPIs for Today
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const startOfTodayYMD = startOfToday.toISOString().split('T')[0]

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      // Fetch Sales GTE start of today
      const { data: salesToday } = await supabase
        .from('sales')
        .select('*')
        .eq('owner_id', user.id)
        .gte('created_at', startOfToday.toISOString())

      // Fetch Expenses GTE start of today
      const { data: expensesToday } = await supabase
        .from('expenses')
        .select('*')
        .eq('owner_id', user.id)
        .gte('date', startOfTodayYMD)

      // Fetch Products to resolve COGS margins
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('owner_id', user.id)

      // Fetch Cost Input logs
      const { data: costLogs } = await supabase
        .from('stock_inputs')
        .select('*')
        .eq('owner_id', user.id)

      // Map product unit costs
      const productMap: Record<string, any> = {}
      let lowStock = 0
      let expired = 0
      let expiringSoon = 0
      const today = new Date()
      if (products) {
        products.forEach(p => {
          productMap[p.id] = { ...p, costPrice: 0 }
          if (p.stock <= p.min_stock) {
            lowStock++
          }
          if (p.expiration_date) {
            const expDate = new Date(p.expiration_date)
            const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            if (diffDays <= 0) {
              expired++
            } else if (diffDays <= 30) {
              expiringSoon++
            }
          }
        })
      }
      setLowStockCount(lowStock)
      setExpiredCount(expired)
      setExpiringSoonCount(expiringSoon)

      if (costLogs) {
        costLogs.forEach(c => {
          if (productMap[c.product_id]) {
            productMap[c.product_id].costPrice = parseFloat(c.cost_price)
          }
        })
      }

      // Compute Today Sales Revenue & COGS
      let salesTodayRevenue = 0
      let salesTodayCogs = 0
      const todaySalesRecords = salesToday || []
      todaySalesRecords.forEach(s => {
        salesTodayRevenue += parseFloat(s.total_price)
        const prod = s.product_id ? productMap[s.product_id] : null
        const cost = prod ? prod.costPrice : 0
        salesTodayCogs += s.quantity * cost
      })

      // Compute Today Expenses
      let expTodayTotal = 0
      const todayExpRecords = expensesToday || []
      todayExpRecords.forEach(e => {
        expTodayTotal += parseFloat(e.amount)
      })

      setTodayRevenue(salesTodayRevenue)
      setTodayExpenses(expTodayTotal)
      setTodayTransactions(todaySalesRecords.length)
      setTodayNetProfit((salesTodayRevenue - salesTodayCogs) - expTodayTotal)

      // 4. Compute Month Net Profit
      const { data: salesMonth } = await supabase
        .from('sales')
        .select('*')
        .eq('owner_id', user.id)
        .gte('created_at', startOfMonth.toISOString())

      const { data: expensesMonth } = await supabase
        .from('expenses')
        .select('*')
        .eq('owner_id', user.id)
        .gte('date', startOfMonth.toISOString().split('T')[0])

      let salesMonthRev = 0
      let salesMonthCogs = 0
      const monthSalesRecords = salesMonth || []
      monthSalesRecords.forEach(s => {
        salesMonthRev += parseFloat(s.total_price)
        const prod = s.product_id ? productMap[s.product_id] : null
        const cost = prod ? prod.costPrice : 0
        salesMonthCogs += s.quantity * cost
      })

      let expMonthTotal = 0
      const monthExpRecords = expensesMonth || []
      monthExpRecords.forEach(e => {
        expMonthTotal += parseFloat(e.amount)
      })

      setMonthNetProfit((salesMonthRev - salesMonthCogs) - expMonthTotal)

      // 5. Gather last 7 days metrics for Area Chart
      const chartMap: Record<string, { label: string; profit: number }> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const ymd = d.toISOString().split('T')[0]
        chartMap[ymd] = {
          label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
          profit: 0
        }
      }

      // Fetch Sales & Expenses for last 7 days
      const start7DaysAgo = new Date()
      start7DaysAgo.setDate(start7DaysAgo.getDate() - 6)
      start7DaysAgo.setHours(0, 0, 0, 0)

      const { data: sales7 } = await supabase
        .from('sales')
        .select('*')
        .eq('owner_id', user.id)
        .gte('created_at', start7DaysAgo.toISOString())

      const { data: expenses7 } = await supabase
        .from('expenses')
        .select('*')
        .eq('owner_id', user.id)
        .gte('date', start7DaysAgo.toISOString().split('T')[0])

      const s7Records = sales7 || []
      s7Records.forEach(s => {
        const ymd = s.created_at.split('T')[0]
        if (chartMap[ymd]) {
          const rev = parseFloat(s.total_price)
          const prod = s.product_id ? productMap[s.product_id] : null
          const cost = prod ? prod.costPrice : 0
          const grossProfit = rev - (s.quantity * cost)
          chartMap[ymd].profit += grossProfit
        }
      })

      const e7Records = expenses7 || []
      e7Records.forEach(e => {
        const ymd = e.date
        if (chartMap[ymd]) {
          chartMap[ymd].profit -= parseFloat(e.amount)
        }
      })

      const formatted7Days = Object.keys(chartMap).sort().map(k => ({
        name: chartMap[k].label,
        NetProfit: parseFloat(chartMap[k].profit.toFixed(2))
      }))
      setChartData(formatted7Days)

      // 6. Compile Today's Best-Sellers Leaderboard (Top 3)
      const quantityMap: Record<string, number> = {}
      todaySalesRecords.forEach(s => {
        if (s.product_id) {
          quantityMap[s.product_id] = (quantityMap[s.product_id] || 0) + s.quantity
        }
      })

      const bestSellersList = Object.keys(quantityMap).map(pid => {
        const prod = productMap[pid]
        return {
          id: pid,
          name: prod ? prod.name : 'Unknown Product',
          qty: quantityMap[pid]
        }
      }).sort((a, b) => b.qty - a.qty).slice(0, 3)

      setTopProducts(bestSellersList)

      setLoading(false)
    } catch (e) {
      console.error('Error fetching dashboard details:', e)
      setLoading(false)
    }
  }

  // Skeleton Card Loader markup
  const renderSkeletons = () => {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="glass rounded-xl p-4 flex flex-col justify-between h-28 animate-pulse border border-slate-900/60">
            <div className="flex justify-between items-start">
              <div className="h-2.5 w-20 bg-slate-800 rounded" />
              <div className="h-6 w-6 bg-slate-800 rounded-lg" />
            </div>
            <div className="space-y-2">
              <div className="h-5 w-24 bg-slate-800 rounded" />
              <div className="h-2.5 w-12 bg-slate-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ transform: `translateY(${pullOffset}px)`, transition: pullOffset === 0 ? 'transform 0.3s ease' : 'none' }}
      className="space-y-6 pb-20 relative"
    >
      {/* Pull-to-refresh Indicator */}
      {(pullOffset > 0 || isRefreshing) && (
        <div className="absolute -top-10 left-0 right-0 flex justify-center items-center gap-2 text-xs text-indigo-400 font-semibold select-none">
          <span className={`h-4 w-4 border-2 border-indigo-400 border-t-transparent rounded-full ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Pull to refresh'}</span>
        </div>
      )}
      
      {/* Intro Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">{t('dashboard.title')}</h2>
          <p className="text-xs text-gray-400 font-medium">{t('dashboard.subtitle')} {storeName}.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
            {t('dashboard.live_feed')}
          </span>
        </div>
      </div>

      {/* Expiration Alerts Banner */}
      {(expiredCount > 0 || expiringSoonCount > 0) && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between shadow-xl gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div>
              <h4 className="font-extrabold text-white text-xs">Stock Alerts & Product Expirations</h4>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {expiredCount > 0 && `${expiredCount} products expired! `}
                {expiringSoonCount > 0 && `${expiringSoonCount} products expiring within 30 days. `}
                Please check your inventory sheet.
              </p>
            </div>
          </div>
          <Link
            to="/inventory"
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[10px] px-3.5 py-1.5 rounded-lg active:scale-95 transition-all shadow-md shadow-amber-500/10"
          >
            Check
          </Link>
        </div>
      )}

      {/* KPI Cards Grid */}
      {loading ? (
        renderSkeletons()
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          
          {/* 1. Today's Net Profit */}
          <div className="glass rounded-xl p-4 flex flex-col justify-between shadow-lg border border-slate-900/60 group hover:border-indigo-500/30 transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {t('dashboard.net_profit_today')}
              </span>
              <div className={`p-1.5 rounded-lg border ${
                todayNetProfit >= 0 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3 space-y-0.5">
              <span className={`text-base font-extrabold tracking-tight ${todayNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                <CountUp value={todayNetProfit} prefix={currency} decimals={2} />
              </span>
              <div className="text-[9px] text-gray-500">{t('dashboard.net_profit_today_desc')}</div>
            </div>
          </div>

          {/* 2. Today's Revenue */}
          <div className="glass rounded-xl p-4 flex flex-col justify-between shadow-lg border border-slate-900/60 group hover:border-indigo-500/30 transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {t('dashboard.revenue_today')}
              </span>
              <div className="p-1.5 rounded-lg border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3 space-y-0.5">
              <span className="text-base font-extrabold tracking-tight text-white">
                <CountUp value={todayRevenue} prefix={currency} decimals={2} />
              </span>
              <div className="text-[9px] text-gray-500">{t('dashboard.revenue_today_desc')}</div>
            </div>
          </div>

          {/* 3. Today's Expenses */}
          <div className="glass rounded-xl p-4 flex flex-col justify-between shadow-lg border border-slate-900/60 group hover:border-indigo-500/30 transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {t('dashboard.expenses_today')}
              </span>
              <div className="p-1.5 rounded-lg border bg-rose-500/10 text-rose-400 border-rose-500/20">
                <Landmark className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3 space-y-0.5">
              <span className="text-base font-extrabold tracking-tight text-white">
                <CountUp value={todayExpenses} prefix={currency} decimals={2} />
              </span>
              <div className="text-[9px] text-gray-500">{t('dashboard.expenses_today_desc')}</div>
            </div>
          </div>

          {/* 4. Total Transactions Today */}
          <div className="glass rounded-xl p-4 flex flex-col justify-between shadow-lg border border-slate-900/60 group hover:border-indigo-500/30 transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {t('dashboard.transactions_today')}
              </span>
              <div className="p-1.5 rounded-lg border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                <Receipt className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3 space-y-0.5">
              <span className="text-base font-extrabold tracking-tight text-white">
                <CountUp value={todayTransactions} decimals={0} />
              </span>
              <div className="text-[9px] text-gray-500">{t('dashboard.transactions_today_desc')}</div>
            </div>
          </div>

          {/* 5. Products Low on Stock */}
          <div className="glass rounded-xl p-4 flex flex-col justify-between shadow-lg border border-slate-900/60 group hover:border-indigo-500/30 transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {t('dashboard.low_stock')}
              </span>
              <div className={`p-1.5 rounded-lg border ${
                lowStockCount > 0 
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              }`}>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3 space-y-0.5">
              <span className={`text-base font-extrabold tracking-tight ${lowStockCount > 0 ? 'text-amber-400' : 'text-white'}`}>
                <CountUp value={lowStockCount} decimals={0} />
              </span>
              <div className="text-[9px] text-gray-500">{t('dashboard.low_stock_desc')}</div>
            </div>
          </div>

          {/* 6. This Month's Net Profit */}
          <div className="glass rounded-xl p-4 flex flex-col justify-between shadow-lg border border-slate-900/60 group hover:border-indigo-500/30 transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {t('dashboard.profit_month')}
              </span>
              <div className={`p-1.5 rounded-lg border ${
                monthNetProfit >= 0 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                <Activity className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3 space-y-0.5">
              <span className={`text-base font-extrabold tracking-tight ${monthNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                <CountUp value={monthNetProfit} prefix={currency} decimals={2} />
              </span>
              <div className="text-[9px] text-gray-500">{t('dashboard.profit_month_desc')}</div>
            </div>
          </div>

        </div>
      )}

      {/* Analytics Timeline & Leaderboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Net Profit Curve Chart */}
        <div className="md:col-span-2 glass rounded-xl p-5 shadow-xl space-y-4 border border-slate-900/60">
          <div>
            <h3 className="font-bold text-white text-sm">{t('dashboard.timeline_title')}</h3>
            <p className="text-[10px] text-gray-400 font-medium">{t('dashboard.timeline_desc')}</p>
          </div>

          <div className="h-56 pt-2">
            {loading ? (
              <div className="h-full w-full bg-slate-950/20 animate-pulse rounded-lg flex items-center justify-center text-xs text-gray-500">
                Compiling Net margins...
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-full w-full border border-dashed border-slate-850 rounded-lg flex items-center justify-center text-xs text-gray-500">
                No historical records log found.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '10px' }} />
                  <Area type="monotone" dataKey="NetProfit" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#profitGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Products Leaderboard */}
        <div className="glass rounded-xl p-5 shadow-xl space-y-4 border border-slate-900/60">
          <div>
            <h3 className="font-bold text-white text-sm">{t('dashboard.leaderboard')}</h3>
            <p className="text-[10px] text-gray-400 font-medium">{t('dashboard.leaderboard_desc')}</p>
          </div>

          <div className="space-y-3.5">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-slate-950/20 border border-slate-850 animate-pulse rounded-lg" />
              ))
            ) : topProducts.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xs border border-dashed border-slate-850 rounded-xl">
                No products sold today.
              </div>
            ) : (
              topProducts.map((prod, idx) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 border border-slate-850 text-xs hover:border-slate-800 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-indigo-400 bg-indigo-500/10 h-7 w-7 rounded-lg flex items-center justify-center border border-indigo-500/20 text-xs">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-white leading-normal">{prod.name}</div>
                      <div className="text-[9px] text-gray-500 mt-0.5">{prod.qty} {t('dashboard.units')} {t('dashboard.sales_count')}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  )
}
