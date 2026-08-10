import { useState, useEffect } from 'react'
import {
  BarChart3,
  TrendingUp,
  Calendar,
  DollarSign,
  AlertTriangle,
  Download,
  ShoppingBag,
  PieChart as PieIcon
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { getOfflineProducts, getOfflineSales, getOfflineExpenses } from '../lib/offlineStorage'

// CountUp animation helper
function CountUp({ value, prefix = '', suffix = '', decimals = 2 }: { value: number | string; prefix?: string; suffix?: string; decimals?: number }) {
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
    const duration = 1000
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

export default function Reports() {
  const { t, i18n } = useTranslation()
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('$')
  const [dbError, setDbError] = useState<string | null>(null)

  // Date Range Defaults (Last 30 Days)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Metrics P&L States
  const [grossRevenue, setGrossRevenue] = useState(0)
  const [cogs, setCogs] = useState(0)
  const [grossProfit, setGrossProfit] = useState(0)
  const [expensesTotal, setExpensesTotal] = useState(0)
  const [netProfit, setNetProfit] = useState(0)

  // Chart & Table datasets
  const [flowChartData, setFlowChartData] = useState<any[]>([])
  const [pieChartData, setPieChartData] = useState<any[]>([])
  const [bestSellers, setBestSellers] = useState<any[]>([])
  const [slowestMovers, setSlowestMovers] = useState<any[]>([])

  // Employee Sales States
  const [activeTab, setActiveTab] = useState('overview')
  const [employeeSalesCount, setEmployeeSalesCount] = useState(0)
  const [employeeSalesRevenue, setEmployeeSalesRevenue] = useState(0)
  const [employeeSalesList, setEmployeeSalesList] = useState<any[]>([])

  useEffect(() => {
    fetchReportData()
  }, [startDate, endDate])

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const tab = query.get('tab')
    if (tab === 'employee') {
      setActiveTab('employee')
    }
  }, [])

  const fetchReportData = async () => {
    try {
      setLoading(true)
      const savedCurrency = localStorage.getItem('store_currency') || 'DA'
      setCurrency(savedCurrency)

      // Adjust date strings to ISO bounds
      const isoStart = new Date(startDate)
      isoStart.setHours(0, 0, 0, 0)
      const isoEnd = new Date(endDate)
      isoEnd.setHours(23, 59, 59, 999)

      let sales: any[] | null = null
      let expenses: any[] | null = null
      let products: any[] | null = null
      let costLogs: any[] | null = null

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('store_profiles')
            .select('currency')
            .eq('owner_id', user.id)
            .limit(1)

          if (profile && profile.length > 0) {
            setCurrency(profile[0].currency || 'DA')
          }

          // 1. Fetch Sales in range
          const { data: sData } = await supabase
            .from('sales')
            .select('*')
            .eq('owner_id', user.id)
            .gte('created_at', isoStart.toISOString())
            .lte('created_at', isoEnd.toISOString())

          sales = sData

          // 2. Fetch Expenses in range
          const { data: eData } = await supabase
            .from('expenses')
            .select('*')
            .eq('owner_id', user.id)
            .gte('date', startDate)
            .lte('date', endDate)

          expenses = eData

          // 3. Fetch Products and Cost Inputs to calculate COGS
          const { data: pData } = await supabase
            .from('products')
            .select('*')
            .eq('owner_id', user.id)

          products = pData

          const { data: cData } = await supabase
            .from('stock_inputs')
            .select('*')
            .eq('owner_id', user.id)

          costLogs = cData
        }
      } catch (cloudErr) {
        console.warn('Reports offline fallback:', cloudErr)
      }

      if (!sales) sales = getOfflineSales()
      if (!expenses) expenses = getOfflineExpenses()
      if (!products || products.length === 0) products = getOfflineProducts()

      setAllProducts(products || [])

      const productMap: Record<string, any> = {}
      if (products) {
        products.forEach(p => {
          productMap[p.id] = { ...p, costPrice: 0 }
        })
      }

      // Resolve latest unit cost per product
      if (costLogs) {
        const sortedCosts = [...costLogs].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
        sortedCosts.forEach(c => {
          if (productMap[c.product_id]) {
            productMap[c.product_id].costPrice = parseFloat(c.cost_price)
          }
        })
      }

      // Calculate P&L values
      let grossRev = 0
      let totalCogs = 0
      const salesQtyMap: Record<string, number> = {}
      
      let empCount = 0
      let empRev = 0
      const empSales: any[] = []

      const salesRecords = sales || []
      salesRecords.forEach(s => {
        const rev = parseFloat(s.total_price)
        grossRev += rev

        // Resolve cost
        const prod = s.product_id ? productMap[s.product_id] : null
        const unitCost = prod ? prod.costPrice : 0
        totalCogs += s.quantity * unitCost

        if (s.product_id) {
          salesQtyMap[s.product_id] = (salesQtyMap[s.product_id] || 0) + s.quantity
        }

        // Separate employee transactions
        if (s.recorded_by === 'employee') {
          empCount += s.quantity
          empRev += rev
          empSales.push({
            id: s.id,
            product_name: prod ? prod.name : 'Unknown Product',
            sku: prod ? prod.sku : '',
            quantity: s.quantity,
            total_price: rev,
            created_at: s.created_at
          })
        }
      })

      setEmployeeSalesCount(empCount)
      setEmployeeSalesRevenue(empRev)
      setEmployeeSalesList(empSales)

      let totalExp = 0
      const expenseRecords = expenses || []
      expenseRecords.forEach(e => {
        totalExp += parseFloat(e.amount)
      })

      const grossProf = grossRev - totalCogs
      const netProf = grossProf - totalExp

      setGrossRevenue(grossRev)
      setCogs(totalCogs)
      setGrossProfit(grossProf)
      setExpensesTotal(totalExp)
      setNetProfit(netProf)

      // 4. Daily flow grouping for Grouped Bar Chart (Revenue vs Expenses)
      const dayMap: Record<string, { label: string; revenue: number; expenses: number }> = {}
      
      // Seed range dates (up to max 31 slots to avoid chart clutter)
      const startMs = new Date(startDate).getTime()
      const endMs = new Date(endDate).getTime()
      const diffDays = Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24))
      
      const formatOption: Intl.DateTimeFormatOptions = diffDays > 10 ? { month: 'short', day: 'numeric' } : { weekday: 'short', day: 'numeric' }

      if (diffDays <= 31) {
        for (let i = 0; i <= diffDays; i++) {
          const tempDate = new Date(startMs + i * 24 * 60 * 60 * 1000)
          const ymd = tempDate.toISOString().split('T')[0]
          dayMap[ymd] = {
            label: tempDate.toLocaleDateString(undefined, formatOption),
            revenue: 0,
            expenses: 0
          }
        }
      }

      salesRecords.forEach(s => {
        const ymd = s.created_at.split('T')[0]
        if (dayMap[ymd]) {
          dayMap[ymd].revenue += parseFloat(s.total_price)
        } else if (diffDays > 31) {
          // If range is large, initialize dynamic dates as they occur
          const dObj = new Date(ymd)
          const labelStr = dObj.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
          if (!dayMap[labelStr]) {
            dayMap[labelStr] = { label: labelStr, revenue: 0, expenses: 0 }
          }
          dayMap[labelStr].revenue += parseFloat(s.total_price)
        }
      })

      expenseRecords.forEach(e => {
        const ymd = e.date
        if (dayMap[ymd]) {
          dayMap[ymd].expenses += parseFloat(e.amount)
        } else if (diffDays > 31) {
          const dObj = new Date(ymd)
          const labelStr = dObj.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
          if (!dayMap[labelStr]) {
            dayMap[labelStr] = { label: labelStr, revenue: 0, expenses: 0 }
          }
          dayMap[labelStr].expenses += parseFloat(e.amount)
        }
      })

      const formattedFlow = Object.keys(dayMap).sort().map(k => ({
        date: dayMap[k].label,
        revenue: parseFloat(dayMap[k].revenue.toFixed(2)),
        expenses: parseFloat(dayMap[k].expenses.toFixed(2))
      }))
      setFlowChartData(formattedFlow)

      // 5. Pie Donut Chart grouping: sales by product category
      const categorySalesMap: Record<string, number> = {}
      salesRecords.forEach(s => {
        const prod = s.product_id ? productMap[s.product_id] : null
        const cat = prod ? (prod.category || 'General') : 'General'
        categorySalesMap[cat] = (categorySalesMap[cat] || 0) + parseFloat(s.total_price)
      })

      const formattedPie = Object.keys(categorySalesMap).map(catName => ({
        name: catName,
        value: parseFloat(categorySalesMap[catName].toFixed(2))
      }))
      setPieChartData(formattedPie)

      // 6. Best-Sellers & Slowest-Movers
      const productSalesSummary = Object.keys(productMap).map(pid => {
        const prod = productMap[pid]
        const qty = salesQtyMap[pid] || 0
        return {
          id: pid,
          name: prod.name,
          sku: prod.sku || '',
          price: parseFloat(prod.price),
          cost: prod.costPrice,
          category: prod.category || 'General',
          qtySold: qty,
          revenue: qty * parseFloat(prod.price)
        }
      })

      const sortedBest = [...productSalesSummary].sort((a, b) => b.qtySold - a.qtySold).slice(0, 5)
      const sortedSlow = [...productSalesSummary].sort((a, b) => a.qtySold - b.qtySold).slice(0, 5)

      setBestSellers(sortedBest)
      setSlowestMovers(sortedSlow)

      setLoading(false)
    } catch (err: any) {
      console.error(err)
      setDbError(err.message || 'Error occurred compiling report data.')
      setLoading(false)
    }
  }

  // Trigger CSV Export Download
  const handleExportCSV = () => {
    if (loading) return

    let csvContent = 'data:text/csv;charset=utf-8,'
    csvContent += 'SuperManager Pro - Profit & Loss Report\n'
    csvContent += `Reporting Range,${startDate} to ${endDate}\n\n`
    
    csvContent += 'Metric,Value\n'
    csvContent += `Gross Revenue,${grossRevenue.toFixed(2)}\n`
    csvContent += `Cost of Goods Sold (COGS),${cogs.toFixed(2)}\n`
    csvContent += `Gross Profit,${grossProfit.toFixed(2)}\n`
    csvContent += `Operating Expenses,${expensesTotal.toFixed(2)}\n`
    csvContent += `Net Profit,${netProfit.toFixed(2)}\n`
    csvContent += `Profit Margin,${grossRevenue > 0 ? ((netProfit / grossRevenue) * 100).toFixed(1) : '0.0'}%\n\n`

    csvContent += 'Best Selling Products (Top 5)\n'
    csvContent += 'Name,SKU,Category,Price,Quantity Sold,Revenue Generated\n'
    bestSellers.forEach(item => {
      csvContent += `"${item.name}","${item.sku}","${item.category}",${item.price},${item.qtySold},${item.revenue.toFixed(2)}\n`
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `P&L_Report_${startDate}_to_${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const pieColors = ['#6366f1', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#3b82f6']
  const isRTL = i18n.language === 'ar'

  return (
    <div className="space-y-6 pb-20 relative">
      
      {/* Top Header & Range Pickers */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" /> {t('reports.title')}
          </h2>
          <p className="text-xs text-gray-400 font-medium">{t('reports.subtitle')}</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-900/40 border border-slate-850 p-2.5 rounded-xl h-fit">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-semibold">{t('reports.from')}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-semibold">{t('reports.to')}</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white focus:outline-none"
            />
          </div>
          <button
            onClick={handleExportCSV}
            disabled={loading || grossRevenue === 0}
            className="bg-indigo-600 hover:bg-indigo-505 disabled:opacity-50 text-white font-bold py-1.5 px-3 rounded-lg transition-all flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> {t('reports.btn_export')}
          </button>
        </div>
      </div>

      {dbError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 flex items-start gap-2 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{dbError}</span>
        </div>
      )}

      {/* Tabs Selector Bar */}
      <div className="flex border-b border-slate-900 gap-6 text-xs mb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 font-bold transition-all relative ${
            activeTab === 'overview'
              ? 'text-indigo-400 border-b-2 border-indigo-500 scale-105'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {t('reports.tab_overview')}
        </button>
        <button
          onClick={() => setActiveTab('employee')}
          className={`pb-3 font-bold transition-all relative ${
            activeTab === 'employee'
              ? 'text-[#f59e0b] border-b-2 border-[#f59e0b] scale-105'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {t('reports.tab_employee')}
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* P&L Summaries Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: t('reports.gross_revenue'), val: grossRevenue, color: 'text-white', desc: t('reports.desc_revenue'), sign: '+' },
          { label: t('reports.cogs'), val: cogs, color: 'text-rose-400', desc: t('reports.desc_cogs'), sign: '-' },
          { label: t('reports.gross_profit'), val: grossProfit, color: 'text-emerald-400', desc: t('reports.desc_gprofit'), sign: '+' },
          { label: t('expenses.title'), val: expensesTotal, color: 'text-rose-400', desc: t('reports.desc_expenses'), sign: '-' },
          { label: t('reports.net_profit'), val: netProfit, color: netProfit >= 0 ? 'text-indigo-400' : 'text-rose-500', desc: t('reports.desc_nprofit'), sign: netProfit >= 0 ? '+' : '-' }
        ].map((item, idx) => (
          <div key={idx} className="glass rounded-xl p-4 shadow-lg border border-slate-900/60 flex flex-col justify-between h-24">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">{item.label}</span>
            <div className={`text-base font-extrabold tracking-tight mt-1 ${item.color}`}>
              {loading ? (
                <span className="h-4 w-16 bg-slate-800 animate-pulse rounded inline-block" />
              ) : (
                <CountUp value={item.val} prefix={`${item.sign}${currency}`} decimals={2} />
              )}
            </div>
            <span className="text-[8px] text-gray-500 mt-1 leading-normal">{item.desc}</span>
          </div>
        ))}
      </div>

      {/* Chart Panels Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue vs Expenses Grouped Bar Chart */}
        <div className="lg:col-span-2 glass rounded-xl p-5 shadow-xl space-y-4 border border-slate-900/60">
          <div>
            <h3 className="font-bold text-white text-sm">{t('reports.timeline_title')}</h3>
            <p className="text-[10px] text-gray-400">{t('reports.rev_vs_exp')}</p>
          </div>

          <div className="h-64 pt-2">
            {loading ? (
              <div className="h-full w-full bg-slate-950/20 animate-pulse rounded-lg flex items-center justify-center text-xs text-gray-500">
                Loading...
              </div>
            ) : flowChartData.length === 0 ? (
              <div className="h-full w-full border border-dashed border-slate-850 rounded-lg flex items-center justify-center text-xs text-gray-500">
                {t('expenses.empty')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flowChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '9.5px' }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} name={t('reports.gross_revenue')} />
                  <Bar dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} name={t('expenses.title')} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category sales pie donut chart */}
        <div className="glass rounded-xl p-5 shadow-xl space-y-4 border border-slate-900/60 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-1">
              <PieIcon className="w-4.5 h-4.5 text-indigo-400" /> {t('reports.donut_title')}
            </h3>
            <p className="text-[10px] text-gray-400">{t('reports.sales_by_cat')}</p>
          </div>

          <div className="h-48 pt-1 flex items-center justify-center">
            {loading ? (
              <div className="h-full w-full bg-slate-950/20 animate-pulse rounded-lg flex items-center justify-center text-xs text-gray-500">
                Loading...
              </div>
            ) : pieChartData.length === 0 ? (
              <div className="h-full w-full border border-dashed border-slate-850 rounded-lg flex items-center justify-center text-xs text-gray-500">
                {t('sales.cart_empty')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '9px' }} />
                  <Legend layout="horizontal" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: '9px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Item Tables Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        
        {/* Best-Sellers Table */}
        <div className="glass rounded-xl p-5 shadow-xl space-y-4 border border-slate-900/60">
          <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-emerald-400" /> {t('reports.best_sellers')}
          </h3>

          <div className="border border-slate-850 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-850 text-gray-500 font-semibold text-[10px] uppercase">
                  <th className="p-3">{t('reports.item_name')}</th>
                  <th className="p-3">{t('inventory.category')}</th>
                  <th className="p-3 text-center">{t('reports.qty_sold')}</th>
                  <th className="p-3 text-right">{t('reports.line_total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 text-gray-300">
                {loading ? (
                  [1, 2, 3].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={4} className="p-4 bg-slate-950/10 h-10" />
                    </tr>
                  ))
                ) : bestSellers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500">{t('inventory.empty')}</td>
                  </tr>
                ) : (
                  bestSellers.map(item => (
                    <tr key={item.id} className="hover:bg-slate-900/15">
                      <td className="p-3 font-semibold text-white">{item.name}</td>
                      <td className="p-3 text-gray-400">{item.category}</td>
                      <td className="p-3 text-center font-bold text-white">{item.qtySold}</td>
                      <td className="p-3 text-right font-extrabold text-emerald-400">{currency}{item.revenue.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Slowest-Moving Products Table */}
        <div className="glass rounded-xl p-5 shadow-xl space-y-4 border border-slate-900/60">
          <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> {t('reports.slow_movers')}
          </h3>

          <div className="border border-slate-850 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-850 text-gray-500 font-semibold text-[10px] uppercase">
                  <th className="p-3">{t('reports.item_name')}</th>
                  <th className="p-3">{t('inventory.category')}</th>
                  <th className="p-3 text-center">{t('reports.qty_sold')}</th>
                  <th className="p-3 text-right">{t('inventory.stock')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 text-gray-300">
                {loading ? (
                  [1, 2, 3].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={4} className="p-4 bg-slate-950/10 h-10" />
                    </tr>
                  ))
                ) : slowestMovers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500">{t('inventory.empty')}</td>
                  </tr>
                ) : (
                  slowestMovers.map(item => {
                    const matchedProd = allProductsCache(item.id, bestSellers) || item
                    return (
                      <tr key={item.id} className="hover:bg-slate-900/15">
                        <td className="p-3 font-semibold text-white">{item.name}</td>
                        <td className="p-3 text-gray-400">{item.category}</td>
                        <td className="p-3 text-center font-bold text-amber-400">{item.qtySold}</td>
                        <td className="p-3 text-right font-mono text-gray-400">
                          {productsListLookup(item.id, allProducts) || '0'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
    )}

      {activeTab === 'employee' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* KPI summaries with amber theme */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass rounded-xl p-5 shadow-lg border border-slate-900 flex flex-col space-y-2">
              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">{t('reports.emp_rev')}</span>
              <div className="text-3xl font-extrabold text-[#f59e0b] font-mono">
                <CountUp value={employeeSalesRevenue} prefix={currency} />
              </div>
              <span className="text-[9px] text-gray-400">{t('reports.emp_rev_desc')}</span>
            </div>

            <div className="glass rounded-xl p-5 shadow-lg border border-slate-900 flex flex-col space-y-2">
              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">{t('reports.emp_count')}</span>
              <div className="text-3xl font-extrabold text-white font-mono">
                <CountUp value={employeeSalesList.length} decimals={0} />
              </div>
              <span className="text-[9px] text-gray-400">{t('reports.emp_count_desc')}</span>
            </div>
          </div>

          {/* Detailed table of employee sales */}
          <div className="glass rounded-xl p-5 shadow-xl border border-slate-900/60 space-y-4">
            <h3 className="font-bold text-white text-sm">{t('reports.emp_ledger')}</h3>
            
            <div className="border border-slate-850 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-850 text-gray-500 font-semibold text-[10px] uppercase">
                    <th className="p-3">{t('reports.item_name')}</th>
                    <th className="p-3">{t('reports.sku')}</th>
                    <th className="p-3 text-center">{t('reports.qty_sold')}</th>
                    <th className="p-3 text-right">{t('reports.line_total')}</th>
                    <th className="p-3 text-right">{t('reports.date_time')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-gray-300">
                  {loading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={5} className="p-4 bg-slate-950/10 h-10" />
                      </tr>
                    ))
                  ) : employeeSalesList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-gray-500 font-medium">{t('reports.emp_empty')}</td>
                    </tr>
                  ) : (
                    employeeSalesList.map(sale => (
                      <tr key={sale.id} className="hover:bg-slate-900/15">
                        <td className="p-3 font-semibold text-white">{sale.product_name}</td>
                        <td className="p-3 text-gray-400 font-mono">{sale.sku || '-'}</td>
                        <td className="p-3 text-center font-semibold text-white">{sale.quantity}</td>
                        <td className="p-3 text-right text-[#f59e0b] font-bold font-mono">{currency}{sale.total_price.toFixed(2)}</td>
                        <td className="p-3 text-right text-gray-400 font-mono">
                          {new Date(sale.created_at).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// Inline helper functions to avoid scope reference issues
function allProductsCache(pid: string, list: any[]) {
  return list.find(x => x.id === pid)
}

function productsListLookup(pid: string, list: any[]) {
  const item = list.find(x => x.id === pid)
  return item ? item.stock : 0
}
