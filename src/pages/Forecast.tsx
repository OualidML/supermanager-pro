import { useState, useEffect } from 'react'
import {
  BrainCircuit,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  DollarSign
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useTranslation } from 'react-i18next'

interface ForecastDay {
  day: string
  predicted: number
}

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

export default function Forecast() {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('$')
  const [dbError, setDbError] = useState<string | null>(null)
  
  // Forecast Metrics
  const [predRevenue, setPredRevenue] = useState(0)
  const [predRevenueLow, setPredRevenueLow] = useState(0)
  const [predRevenueHigh, setPredRevenueHigh] = useState(0)
  const [predNetProfit, setPredNetProfit] = useState(0)
  const [confidence, setConfidence] = useState(30)

  const [forecastList, setForecastList] = useState<ForecastDay[]>([])

  useEffect(() => {
    runForecastCalculation()
  }, [])

  const runForecastCalculation = async () => {
    try {
      setLoading(true)
      setDbError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Load currency preference
      const { data: profile } = await supabase
        .from('store_profiles')
        .select('currency')
        .eq('owner_id', user.id)
        .limit(1)

      if (profile && profile.length > 0) {
        setCurrency(profile[0].currency || '$')
      }

      // Compute last 28 days boundaries
      const start28DaysAgo = new Date()
      start28DaysAgo.setDate(start28DaysAgo.getDate() - 28)
      start28DaysAgo.setHours(0, 0, 0, 0)

      const start28DaysAgoYMD = start28DaysAgo.toISOString().split('T')[0]

      // 1. Fetch Sales in last 28 days
      const { data: sales, error: salesErr } = await supabase
        .from('sales')
        .select('*')
        .eq('owner_id', user.id)
        .gte('created_at', start28DaysAgo.toISOString())

      if (salesErr) throw salesErr

      // 2. Fetch Expenses in last 28 days
      const { data: expenses, error: expErr } = await supabase
        .from('expenses')
        .select('*')
        .eq('owner_id', user.id)
        .gte('date', start28DaysAgoYMD)

      if (expErr) throw expErr

      // 3. Fetch Products and Cost Inputs to resolve margin ratios
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('owner_id', user.id)

      const { data: costLogs } = await supabase
        .from('stock_inputs')
        .select('*')
        .eq('owner_id', user.id)

      const productMap: Record<string, any> = {}
      if (products) {
        products.forEach(p => {
          productMap[p.id] = { ...p, costPrice: 0 }
        })
      }
      if (costLogs) {
        costLogs.forEach(c => {
          if (productMap[c.product_id]) {
            productMap[c.product_id].costPrice = parseFloat(c.cost_price)
          }
        })
      }

      // Calculate confidence score based on unique days with sales
      const uniqueSalesDays = new Set<string>()
      const salesRecords = sales || []
      salesRecords.forEach(s => {
        uniqueSalesDays.add(s.created_at.split('T')[0])
      })
      const resolvedConfidence = Math.min(95, 30 + (uniqueSalesDays.size * 2.5))
      setConfidence(resolvedConfidence)

      // Calculate historical gross margins
      let totalSalesVal = 0
      let totalCogsVal = 0
      salesRecords.forEach(s => {
        const val = parseFloat(s.total_price)
        totalSalesVal += val
        const prod = s.product_id ? productMap[s.product_id] : null
        const cost = prod ? prod.costPrice : 0
        totalCogsVal += s.quantity * cost
      })
      const grossMarginPercent = totalSalesVal > 0 ? (totalSalesVal - totalCogsVal) / totalSalesVal : 0.40 // Default to 40% margin if no sales

      // Average weekly operational expenses
      let totalExpVal = 0
      const expenseRecords = expenses || []
      expenseRecords.forEach(e => {
        totalExpVal += parseFloat(e.amount)
      })
      const avgWeeklyExpenses = totalExpVal / 4

      // Group historical sales GTE 28 days ago by Day of Week (0 = Sun, 1 = Mon, ..., 6 = Sat)
      const weekdaySum: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
      salesRecords.forEach(s => {
        const dateObj = new Date(s.created_at)
        const dayOfWeek = dateObj.getDay()
        weekdaySum[dayOfWeek] += parseFloat(s.total_price)
      })

      // Generate day-by-day forecast for the next 7 days starting tomorrow
      const next7DaysForecast: ForecastDay[] = []
      let predictedWeeklyRev = 0

      for (let i = 1; i <= 7; i++) {
        const targetDate = new Date()
        targetDate.setDate(targetDate.getDate() + i)
        const dayOfWeek = targetDate.getDay()

        // Calculate average for this day of week over the last 4 weeks
        // If they have no sales, baseline to a nominal amount or $0
        const dayOfWeekAverage = weekdaySum[dayOfWeek] / 4
        const adjustedPrediction = dayOfWeekAverage > 0 ? dayOfWeekAverage : (totalSalesVal > 0 ? (totalSalesVal / 28) : 50) // Fallback to daily avg or $50 baseline
        
        predictedWeeklyRev += adjustedPrediction

        next7DaysForecast.push({
          day: targetDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
          predicted: parseFloat(adjustedPrediction.toFixed(2))
        })
      }

      setForecastList(next7DaysForecast)

      // Set predicted ranges (90% to 110%)
      setPredRevenue(predictedWeeklyRev)
      setPredRevenueLow(predictedWeeklyRev * 0.9)
      setPredRevenueHigh(predictedWeeklyRev * 1.1)

      // Predicted Net Profit = Predicted Revenue * margin% - avgWeeklyExpenses
      const projectedProfit = (predictedWeeklyRev * grossMarginPercent) - avgWeeklyExpenses
      setPredNetProfit(projectedProfit)

      setLoading(false)
    } catch (err: any) {
      console.error(err)
      setDbError(err.message || 'Error occurred compiling forecast projections.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-20 relative">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-indigo-400" /> {t('forecast.title')}
          </h2>
          <p className="text-xs text-gray-400 font-medium">Predict next week's catalog revenue margins and product velocity using historical averages.</p>
        </div>

        <button
          onClick={runForecastCalculation}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-505 text-white font-bold py-2 px-4 rounded-xl transition-all shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Run Forecast
        </button>
      </div>

      {dbError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 flex items-start gap-2 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{dbError}</span>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 1. Predicted Revenue Range */}
        <div className="glass rounded-xl p-5 border border-slate-900/60 shadow-xl flex flex-col justify-between min-h-[130px] group hover:border-indigo-500/20 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">{t('forecast.pred_revenue')}</span>
              <span className="text-lg font-black text-white mt-1 block">
                {loading ? (
                  <span className="h-5 w-24 bg-slate-800 animate-pulse rounded inline-block" />
                ) : (
                  <span>
                    {currency}{predRevenueLow.toFixed(0)} - {currency}{predRevenueHigh.toFixed(0)}
                  </span>
                )}
              </span>
            </div>
            <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[9px] text-gray-500 leading-normal">
            Projected range margin mapping ±10% around next week's forecast.
          </span>
        </div>

        {/* 2. Predicted Net Profit */}
        <div className="glass rounded-xl p-5 border border-slate-900/60 shadow-xl flex flex-col justify-between min-h-[130px] group hover:border-indigo-500/20 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">{t('forecast.pred_profit')}</span>
              <span className="text-lg font-black text-emerald-400 mt-1 block">
                {loading ? (
                  <span className="h-5 w-24 bg-slate-800 animate-pulse rounded inline-block" />
                ) : (
                  <CountUp value={predNetProfit} prefix={currency} decimals={2} />
                )}
              </span>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[9px] text-gray-500 leading-normal">
            Revenue margins minus average weekly operating bills.
          </span>
        </div>

        {/* 3. Confidence score progress bar */}
        <div className="glass rounded-xl p-5 border border-slate-900/60 shadow-xl flex flex-col justify-between min-h-[130px] group hover:border-indigo-500/20 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">{t('forecast.confidence')}</span>
              <span className="text-lg font-black text-indigo-400 mt-1 block">
                {loading ? (
                  <span className="h-5 w-16 bg-slate-800 animate-pulse rounded inline-block" />
                ) : (
                  <span>{confidence}%</span>
                )}
              </span>
            </div>
            <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-900">
              <div 
                style={{ width: `${confidence}%` }} 
                className="h-full bg-indigo-500 rounded-full transition-all duration-1000" 
              />
            </div>
            <span className="text-[8px] text-gray-500 block leading-normal">
              Score scales up as more daily sales data is written to Supabase.
            </span>
          </div>
        </div>

      </div>

      {/* Day by Day Forecast Bar Chart */}
      <div className="glass rounded-xl p-5 shadow-xl space-y-4 border border-slate-900/60">
        <div>
          <h3 className="font-bold text-white text-sm">{t('forecast.chart_title')}</h3>
          <p className="text-[10px] text-gray-400">Day-by-day predicted revenue flow mapping next week's sales averages</p>
        </div>

        <div className="h-64 pt-2">
          {loading ? (
            <div className="h-full w-full bg-slate-950/20 animate-pulse rounded-lg flex items-center justify-center text-xs text-gray-500">
              Generating day projections...
            </div>
          ) : forecastList.length === 0 ? (
            <div className="h-full w-full border border-dashed border-slate-850 rounded-lg flex items-center justify-center text-xs text-gray-500">
              No historical data available to compile projections.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastList} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="day" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '9.5px' }} />
                <Bar dataKey="predicted" fill="#6366f1" radius={[4, 4, 0, 0]} name="Predicted Revenue" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

    </div>
  )
}
