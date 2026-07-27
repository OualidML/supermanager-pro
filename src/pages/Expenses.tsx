import { useState, useEffect, useRef } from 'react'
import {
  Landmark,
  Plus,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Droplet,
  Users,
  Package,
  Truck,
  Wrench,
  Receipt,
  Home,
  Trash2,
  Sparkles,
  TrendingDown,
  X
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import { useTranslation } from 'react-i18next'

// Dynamic icon resolver based on category name
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Rent':
      return <Home className="w-4 h-4 text-indigo-400" />
    case 'Electricity':
      return <Zap className="w-4 h-4 text-amber-400" />
    case 'Water':
      return <Droplet className="w-4 h-4 text-cyan-400" />
    case 'Salaries':
      return <Users className="w-4 h-4 text-indigo-400" />
    case 'Supplies':
      return <Package className="w-4 h-4 text-emerald-400" />
    case 'Transport':
      return <Truck className="w-4 h-4 text-blue-400" />
    case 'Maintenance':
      return <Wrench className="w-4 h-4 text-rose-400" />
    default:
      return <Receipt className="w-4 h-4 text-slate-400" />
  }
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

export default function Expenses() {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('$')
  const [success, setSuccess] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)

  // Expense List States
  const [expenses, setExpenses] = useState<any[]>([])
  const [monthlyTotal, setMonthlyTotal] = useState(0)

  // Log Form States
  const [category, setCategory] = useState('Rent')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [recurring, setRecurring] = useState(false)
  const [frequency, setFrequency] = useState('Monthly')

  // Recharts Treemap Data
  const [treemapData, setTreemapData] = useState<any[]>([])

  // Mobile UX: Swipe to Delete & Confirmation Modal States
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  
  // Swipe position states
  const [swipingId, setSwipingId] = useState<string | null>(null)
  const [swipeX, setSwipeX] = useState(0)
  const [startX, setStartX] = useState(0)

  // Ref to hold last deleted item for safe Event closure access
  const lastDeletedRef = useRef<any>(null)

  useEffect(() => {
    fetchExpenses()
  }, [])

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      setDbError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('store_profiles')
        .select('currency')
        .eq('owner_id', user.id)
        .limit(1)

      if (profile && profile.length > 0) {
        setCurrency(profile[0].currency || '$')
      }

      const { data: expList, error: expErr } = await supabase
        .from('expenses')
        .select('*')
        .eq('owner_id', user.id)
        .order('date', { ascending: false })

      if (expErr) throw expErr

      const mappedExpenses = expList || []
      setExpenses(mappedExpenses)

      // Calculate this month's total
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      
      const thisMonthTotal = mappedExpenses
        .filter(exp => new Date(exp.date).getTime() >= startOfMonth.getTime())
        .reduce((sum, exp) => sum + parseFloat(exp.amount), 0)

      setMonthlyTotal(thisMonthTotal)

      // Group by category for Treemap
      const groupMap: Record<string, number> = {}
      mappedExpenses.forEach(exp => {
        const val = parseFloat(exp.amount)
        groupMap[exp.category] = (groupMap[exp.category] || 0) + val
      })

      const formattedTreemap = Object.keys(groupMap).map(catName => ({
        name: catName,
        size: parseFloat(groupMap[catName].toFixed(2))
      }))
      setTreemapData(formattedTreemap)

      setLoading(false)
    } catch (err: any) {
      console.error(err)
      setDbError(err.message || 'Failed to fetch expenses ledger.')
      setLoading(false)
    }
  }

  // Handle Log Expense Submission
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    setDbError(null)

    if (!description || !amount || !date) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No active user session found.')

      const parsedAmount = parseFloat(amount)

      const { error: insertErr } = await supabase
        .from('expenses')
        .insert([{
          owner_id: user.id,
          title: description,
          amount: parsedAmount,
          category: category,
          date: date,
          recurring: recurring,
          frequency: recurring ? frequency : null
        }])

      if (insertErr) throw insertErr

      setSuccess(true)
      setDescription('')
      setAmount('')
      setRecurring(false)

      // Dispatch Global Success Toast
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Expense logged successfully!', type: 'success' }
      }))

      fetchExpenses()
      setTimeout(() => setSuccess(false), 2000)
    } catch (err: any) {
      setDbError(err.message || 'An error occurred while logging the expense.')
    }
  }

  // Handle Delete Expense
  const handleDeleteExpense = async (id: string) => {
    const expenseToDelete = expenses.find(e => e.id === id)
    if (!expenseToDelete) return

    try {
      // Save details to ref for Undo restore
      lastDeletedRef.current = expenseToDelete

      const { error: delErr } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

      if (delErr) throw delErr

      setConfirmDeleteId(null)
      fetchExpenses()

      // Dispatch Success Toast with Undo Action callback
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: {
          message: 'Expense deleted successfully.',
          type: 'success',
          action: {
            label: 'Undo',
            onClick: async () => {
              const item = lastDeletedRef.current
              if (!item) return

              const { error: restoreErr } = await supabase
                .from('expenses')
                .insert([{
                  owner_id: item.owner_id,
                  title: item.title,
                  amount: item.amount,
                  category: item.category,
                  date: item.date,
                  recurring: item.recurring,
                  frequency: item.frequency
                }])

              if (restoreErr) {
                console.error(restoreErr)
              } else {
                fetchExpenses()
                window.dispatchEvent(new CustomEvent('app-toast', {
                  detail: { message: 'Expense restored successfully.', type: 'success' }
                }))
              }
            }
          }
        }
      }))

    } catch (err: any) {
      setDbError(err.message || 'Unable to delete expense record.')
    }
  }

  // Swipe gesture touch detectors
  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    setStartX(e.touches[0].clientX)
    setSwipingId(id)
  }

  const handleTouchMove = (e: React.TouchEvent, id: string) => {
    if (swipingId !== id) return
    const currentX = e.touches[0].clientX
    const diff = currentX - startX
    // Allow dragging left (negative) for delete reveal
    if (diff < 0) {
      setSwipeX(Math.max(-120, diff))
    }
  }

  const handleTouchEnd = (id: string) => {
    if (swipingId === id) {
      // If drag distance exceeds 75px, trigger delete confirmation modal!
      if (swipeX < -75) {
        setConfirmDeleteId(id)
      }
    }
    setSwipingId(null)
    setSwipeX(0)
  }

  // Recharts treemap rectangle colors
  const treemapColors = ['#6366f1', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#3b82f6']
  
  const CustomTreemapContent = (props: any) => {
    const { x, y, width, height, index, name, size } = props
    if (width <= 0 || height <= 0) return null

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: treemapColors[index % treemapColors.length],
            fillOpacity: 0.15,
            stroke: treemapColors[index % treemapColors.length],
            strokeWidth: 1.5,
            rx: 6,
            ry: 6,
          }}
          className="transition-all duration-300 hover:fill-opacity-30"
        />
        {width > 50 && height > 30 && (
          <>
            <text x={x + 10} y={y + 20} fill="#ffffff" fontSize={10} fontWeight="bold" textAnchor="start">
              {name}
            </text>
            <text x={x + 10} y={y + 35} fill="#cbd5e1" fontSize={9} textAnchor="start">
              {currency}{size.toFixed(2)}
            </text>
          </>
        )}
      </g>
    )
  }

  const isRTL = i18n.language === 'ar'

  return (
    <div className="space-y-6 pb-20 relative">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Landmark className="w-5 h-5 text-indigo-400" /> {t('expenses.title')}
          </h2>
          <p className="text-xs text-gray-400 font-medium">Record operations overhead, utility payouts, and analyze category distributions.</p>
        </div>
      </div>

      {dbError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 flex items-start gap-2 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{dbError}</span>
        </div>
      )}

      {/* KPI & Treemap Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* KPI Monthly Card */}
        <div className="glass rounded-xl p-5 border border-slate-900/60 shadow-xl flex flex-col justify-between min-h-[140px] relative overflow-hidden group hover:border-indigo-500/20 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                {t('expenses.total_month')}
              </span>
              <span className="text-2xl font-black text-rose-400 mt-2 block tracking-tight">
                <CountUp value={monthlyTotal} prefix={`-${currency}`} decimals={2} />
              </span>
            </div>
            <div className="p-2.5 rounded-xl border bg-rose-500/10 text-rose-400 border-rose-500/20">
              <TrendingDown className="w-4.5 h-4.5" />
            </div>
          </div>
          <p className="text-[9px] text-gray-500 leading-normal">
            Calculated sum of all utility bills and operational overhead since the start of this month.
          </p>
        </div>

        {/* Treemap Category Distribution */}
        <div className="md:col-span-2 glass rounded-xl p-5 border border-slate-900/60 shadow-xl space-y-3.5">
          <div>
            <h3 className="font-bold text-white text-sm">{t('expenses.treemap_title')}</h3>
            <p className="text-[10px] text-gray-400 font-medium">Relative allocation sizes by operational categories</p>
          </div>

          <div className="h-28 w-full pt-1">
            {loading ? (
              <div className="h-full w-full bg-slate-950/20 animate-pulse rounded-lg flex items-center justify-center text-[10px] text-gray-500">
                Building treemap structure...
              </div>
            ) : treemapData.length === 0 ? (
              <div className="h-full w-full border border-dashed border-slate-850 rounded-lg flex items-center justify-center text-[10px] text-gray-500">
                No expense allocations recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <Treemap data={treemapData} dataKey="size" aspectRatio={6 / 2} stroke="#09090b" content={<CustomTreemapContent />}>
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '9px' }} />
                </Treemap>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Form and List Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Log Expense Form Card */}
        <div className="glass rounded-xl p-5 shadow-xl space-y-4 border border-slate-900/60 h-fit">
          <h3 className="font-bold text-white text-sm">{t('expenses.form_title')}</h3>
          
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 text-center text-xs text-emerald-400 flex items-center justify-center gap-1.5 animate-bounce">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> logged!
            </div>
          )}

          <form onSubmit={handleAddExpense} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-gray-400 font-semibold">{t('expenses.description')}</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Electricity Bill Jan"
                className="w-full bg-slate-950 border border-slate-855 rounded-lg py-3 px-3 text-white focus:outline-none min-h-[48px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-gray-400 font-semibold flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> {t('expenses.amount')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-855 rounded-lg py-3 px-3 text-white focus:outline-none min-h-[48px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-semibold">{t('expenses.category_label')}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-855 rounded-lg py-3 px-3 text-white focus:outline-none min-h-[48px]"
                >
                  <option value="Rent">Rent</option>
                  <option value="Electricity">Electricity</option>
                  <option value="Water">Water</option>
                  <option value="Salaries">Salaries</option>
                  <option value="Supplies">Supplies</option>
                  <option value="Transport">Transport</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-gray-400 font-semibold flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {t('expenses.date_label')}
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-855 rounded-lg py-3 px-3 text-white focus:outline-none min-h-[48px]"
                />
              </div>

              <div className="flex flex-col justify-end space-y-1 pb-1">
                <label className="text-gray-400 font-semibold flex items-center gap-2 cursor-pointer select-none min-h-[48px]">
                  <input
                    type="checkbox"
                    checked={recurring}
                    onChange={(e) => setRecurring(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border-slate-855 bg-slate-950 text-indigo-600 focus:ring-indigo-500/50"
                  />
                  <span>{t('expenses.recurring_label')}</span>
                </label>
              </div>
            </div>

            {recurring && (
              <div className="space-y-1 animate-pulse">
                <label className="text-gray-400 font-semibold">{t('expenses.frequency_label')}</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-855 rounded-lg py-3 px-3 text-white focus:outline-none min-h-[48px]"
                >
                  <option value="Weekly">Weekly Interval</option>
                  <option value="Monthly">Monthly Interval</option>
                  <option value="Yearly">Yearly Interval</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-505 text-white font-bold py-3.5 rounded-lg transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5 min-h-[48px]"
            >
              {t('expenses.btn_log')} <Sparkles className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Ledger History List (With swipe to delete) */}
        <div className="md:col-span-2 glass rounded-xl p-5 shadow-xl space-y-4 border border-slate-900/60 overflow-hidden">
          <div>
            <h3 className="font-bold text-white text-sm">{t('expenses.history_title')}</h3>
            <p className="text-[10px] text-gray-500 font-medium mt-0.5">Swipe left on list items for mobile swipe-to-delete actions.</p>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-slate-950/20 animate-pulse rounded-lg border border-slate-855" />
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-855 rounded-xl text-gray-500 text-xs">
              {t('expenses.empty')}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {expenses.map(exp => {
                const isSwipedItem = swipingId === exp.id
                const translateX = isSwipedItem ? swipeX : 0

                return (
                  <div
                    key={exp.id}
                    onTouchStart={(e) => handleTouchStart(e, exp.id)}
                    onTouchMove={(e) => handleTouchMove(e, exp.id)}
                    onTouchEnd={() => handleTouchEnd(exp.id)}
                    className="relative overflow-hidden rounded-xl bg-slate-950/20 border border-slate-855 hover:border-slate-800 transition-all text-xs select-none"
                  >
                    
                    {/* Behind-the-card Delete swipe highlight */}
                    <div className="absolute inset-y-0 right-0 w-24 bg-rose-600 flex items-center justify-center text-white font-extrabold text-[10px] gap-1 px-3 z-0">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </div>

                    {/* Front card overlay */}
                    <div
                      style={{
                        transform: `translateX(${translateX}px)`,
                        transition: isSwipedItem ? 'none' : 'transform 0.3s ease'
                      }}
                      className="relative bg-slate-950/90 border border-transparent p-3 rounded-xl flex justify-between items-center gap-3 z-10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-gray-400">
                          {getCategoryIcon(exp.category)}
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-2">
                            {exp.title}
                            {exp.recurring && (
                              <span className="text-[8px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                                {exp.frequency || 'Recurring'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                            <span className="font-medium text-gray-400">{exp.category}</span>
                            <span>•</span>
                            <span>{new Date(exp.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-rose-400 text-sm">
                          -{currency}{parseFloat(exp.amount).toFixed(2)}
                        </span>
                        <button
                          onClick={() => setConfirmDeleteId(exp.id)}
                          className="text-gray-500 hover:text-rose-400 transition-colors p-2.5 min-h-[44px] min-w-[44px] rounded-md hover:bg-slate-900 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Delete Confirmation Dialog Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-55 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-850 rounded-2xl p-5 shadow-2xl space-y-4 relative animate-in zoom-in duration-200">
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div className="space-y-2">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" /> Confirm Delete Action
              </h3>
              <p className="text-xs text-gray-400 leading-normal">
                Are you sure you want to permanently delete this expense record from the Supabase database ledger?
              </p>
            </div>

            <div className="flex gap-3 pt-2 text-xs">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 bg-slate-900 hover:bg-slate-850 text-gray-300 py-3 rounded-lg font-bold min-h-[48px]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteExpense(confirmDeleteId)}
                className="flex-1 bg-rose-600 hover:bg-rose-505 text-white py-3 rounded-lg font-bold min-h-[48px]"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
