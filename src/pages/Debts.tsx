import { useState, useEffect } from 'react'
import {
  BookOpen,
  Search,
  CheckCircle2,
  AlertTriangle,
  User,
  Phone,
  Calendar,
  Layers,
  Check,
  TrendingDown,
  Clock,
  RotateCcw,
  X
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useTranslation } from 'react-i18next'

interface DebtItem {
  id: string
  customer_name: string
  customer_phone: string | null
  items_summary: string
  total_amount: number
  amount_paid: number
  status: 'unpaid' | 'partially_paid' | 'paid'
  created_at: string
}

export default function Debts() {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('$')
  const [debts, setDebts] = useState<DebtItem[]>([])
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid')
  
  // Settle Dialog states
  const [targetDebt, setTargetDebt] = useState<DebtItem | null>(null)
  const [settleAmount, setSettleAmount] = useState('')
  const [settleLoading, setSettleLoading] = useState(false)

  // Status Alerts
  const [successMsg, setSuccessMsg] = useState('')
  const [dbError, setDbError] = useState<string | null>(null)

  useEffect(() => {
    fetchInitialConfig()
    fetchDebts()
  }, [])

  const fetchInitialConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('store_profiles')
          .select('currency')
          .eq('owner_id', user.id)
          .limit(1)
        if (profile && profile.length > 0 && profile[0].currency) {
          setCurrency(profile[0].currency)
        }
      }
    } catch (e) {
      console.warn('Failed to load currency configs:', e)
    }
  }

  const fetchDebts = async () => {
    setLoading(true)
    setDbError(null)
    try {
      const { data, error } = await supabase
        .from('customer_debts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedDebts = (data || []).map((d: any) => ({
        id: d.id,
        customer_name: d.customer_name,
        customer_phone: d.customer_phone,
        items_summary: d.items_summary,
        total_amount: parseFloat(d.total_amount) || 0,
        amount_paid: parseFloat(d.amount_paid) || 0,
        status: d.status,
        created_at: d.created_at
      }))

      setDebts(formattedDebts)
    } catch (err: any) {
      setDbError(err.message || 'Failed to fetch customer debts ledger.')
    } finally {
      setLoading(false)
    }
  }

  // Handle settling a debt
  const handleSettleDebt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetDebt || !settleAmount) return
    setDbError(null)
    setSettleLoading(true)

    try {
      const parsedAmount = parseFloat(settleAmount)
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Please enter a valid numeric payment amount.')
      }

      const newAmountPaid = targetDebt.amount_paid + parsedAmount
      const remaining = targetDebt.total_amount - newAmountPaid
      let newStatus: 'unpaid' | 'partially_paid' | 'paid' = 'unpaid'

      if (remaining <= 0) {
        newStatus = 'paid'
      } else if (newAmountPaid > 0) {
        newStatus = 'partially_paid'
      }

      const { error } = await supabase
        .from('customer_debts')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus
        })
        .eq('id', targetDebt.id)

      if (error) throw error

      setSuccessMsg(`Successfully logged payment of ${currency}${parsedAmount.toFixed(2)} from ${targetDebt.customer_name}!`)
      setTargetDebt(null)
      setSettleAmount('')

      // Dispatch Success Toast
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Debt payment registered successfully!', type: 'success' }
      }))

      fetchDebts()
      setTimeout(() => setSuccessMsg(''), 3000)

    } catch (err: any) {
      setDbError(err.message || 'Failed to update debt payment.')
    } finally {
      setSettleLoading(false)
    }
  }

  // Stats calculators
  const totalOutstanding = debts
    .filter(d => d.status !== 'paid')
    .reduce((acc, curr) => acc + (curr.total_amount - curr.amount_paid), 0)

  const activeDebtorsCount = new Set(
    debts.filter(d => d.status !== 'paid').map(d => d.customer_name.toLowerCase())
  ).size

  const totalSettled = debts
    .reduce((acc, curr) => acc + curr.amount_paid, 0)

  // Filters
  const filteredDebts = debts.filter(d => {
    const matchesSearch =
      d.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.customer_phone && d.customer_phone.includes(searchQuery))
    
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'unpaid' && d.status !== 'paid') ||
      (statusFilter === 'paid' && d.status === 'paid')

    return matchesSearch && matchesStatus
  })

  const isRTL = i18n.language === 'ar'

  return (
    <div className="space-y-6 pb-20 relative">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" /> Credit Ledger (Tabs)
          </h2>
          <p className="text-xs text-gray-400 font-medium">Record customer credits, verify outstanding debts, and settle payments.</p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-emerald-400 flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {dbError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 flex items-start gap-2 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{dbError}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass border border-slate-900 rounded-2xl p-5 shadow-xl space-y-2 relative overflow-hidden">
          <div className="absolute right-4 top-4 text-rose-500/25">
            <Clock className="w-8 h-8" />
          </div>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Outstanding Debt</span>
          <h3 className="text-2xl font-extrabold text-rose-500 font-mono">
            {currency}{totalOutstanding.toFixed(2)}
          </h3>
          <p className="text-[10px] text-gray-500">Unsettled credit tabs currently active.</p>
        </div>

        <div className="glass border border-slate-900 rounded-2xl p-5 shadow-xl space-y-2 relative overflow-hidden">
          <div className="absolute right-4 top-4 text-emerald-500/25">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Received</span>
          <h3 className="text-2xl font-extrabold text-emerald-500 font-mono">
            {currency}{totalSettled.toFixed(2)}
          </h3>
          <p className="text-[10px] text-gray-500">Payments collected from credit tabs.</p>
        </div>

        <div className="glass border border-slate-900 rounded-2xl p-5 shadow-xl space-y-2 relative overflow-hidden">
          <div className="absolute right-4 top-4 text-indigo-500/25">
            <User className="w-8 h-8" />
          </div>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Active Debtors</span>
          <h3 className="text-2xl font-extrabold text-indigo-400 font-mono">
            {activeDebtorsCount}
          </h3>
          <p className="text-[10px] text-gray-500">Customers with outstanding tabs.</p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 text-xs bg-slate-900/40 border border-slate-850 p-2.5 rounded-xl">
        <div className="flex-1 relative">
          <Search className={`absolute top-3 w-4 h-4 text-gray-500 ${isRTL ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name or phone..."
            className={`w-full bg-slate-950 border border-slate-850 rounded-lg py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 text-xs ${
              isRTL ? 'pl-3 pr-9 text-right' : 'pl-9 pr-3 text-left'
            }`}
          />
        </div>

        <div className="flex bg-slate-950 border border-slate-850 p-1 rounded-lg">
          <button
            onClick={() => setStatusFilter('unpaid')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              statusFilter === 'unpaid' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            Unpaid
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              statusFilter === 'paid' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            Settled (Paid)
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              statusFilter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Debt List */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-slate-950/20 border border-slate-850 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filteredDebts.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-850 rounded-2xl text-gray-500 text-xs">
          No credit transactions logged matching your search filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDebts.map(debt => {
            const outstanding = debt.total_amount - debt.amount_paid
            const formattedDate = new Date(debt.created_at).toLocaleDateString(i18n.language, {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })

            return (
              <div
                key={debt.id}
                className={`glass border rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all duration-300 ${
                  debt.status === 'paid' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-900/60'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 text-indigo-400 flex items-center justify-center font-bold">
                      {debt.customer_name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <h4 className="font-extrabold text-white text-sm">{debt.customer_name}</h4>
                      {debt.customer_phone && (
                        <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-indigo-400" /> {debt.customer_phone}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-400 leading-normal max-w-lg">
                    <span className="font-semibold block text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Items</span>
                    {debt.items_summary}
                  </div>
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-slate-850 pt-3 sm:pt-0 gap-4">
                  <div className="text-left sm:text-right space-y-1">
                    <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Balance Details</span>
                    <div className="flex gap-2.5 items-baseline text-xs">
                      <span className="text-gray-400">Total:</span>
                      <span className="font-mono text-white">{currency}{debt.total_amount.toFixed(2)}</span>
                    </div>
                    {debt.status !== 'paid' ? (
                      <div className="flex gap-2.5 items-baseline text-xs">
                        <span className="text-gray-400">Paid:</span>
                        <span className="font-mono text-emerald-400">{currency}{debt.amount_paid.toFixed(2)}</span>
                      </div>
                    ) : null}
                    <div className="flex gap-2.5 items-baseline text-xs font-bold mt-0.5">
                      <span className="text-gray-400">{debt.status === 'paid' ? 'Paid Off:' : 'Due:'}</span>
                      <span className={`font-mono ${debt.status === 'paid' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {currency}{debt.status === 'paid' ? debt.total_amount.toFixed(2) : outstanding.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {debt.status !== 'paid' ? (
                    <button
                      onClick={() => setTargetDebt(debt)}
                      className="bg-indigo-600 hover:bg-indigo-505 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/10 min-h-[48px]"
                    >
                      <Check className="w-4 h-4" /> Record Payment
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Fully Settled
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Settle Debt Modal Dialog */}
      {targetDebt && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-850 rounded-2xl p-5 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setTargetDebt(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-850 pb-2.5">
              <Check className="w-4.5 h-4.5 text-emerald-400" /> Settle Credit Tab
            </h3>

            <div className="text-xs text-gray-400 space-y-2">
              <p>Record a cash payment from <strong>{targetDebt.customer_name}</strong> to reduce or settle their credit debt.</p>
              <div className="bg-slate-950/40 p-2.5 rounded border border-slate-850 flex justify-between font-mono">
                <span>Remaining Debt:</span>
                <span className="text-rose-400 font-bold">
                  {currency}{(targetDebt.total_amount - targetDebt.amount_paid).toFixed(2)}
                </span>
              </div>
            </div>

            <form onSubmit={handleSettleDebt} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-semibold">Payment Amount</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder={(targetDebt.total_amount - targetDebt.amount_paid).toFixed(2)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-white min-h-[48px]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTargetDebt(null)}
                  className="flex-1 bg-slate-900 hover:bg-slate-850 text-gray-300 py-2 rounded-lg font-bold min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settleLoading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-505 disabled:opacity-50 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 min-h-[48px]"
                >
                  {settleLoading ? (
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Confirm Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
