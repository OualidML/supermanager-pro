import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Store,
  ArrowRight,
  ArrowLeft,
  Package,
  Landmark,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Sun,
  Moon,
  Laptop,
  Trash2,
  Plus,
  DollarSign,
  MapPin
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useTranslation } from 'react-i18next'

interface ProductInput {
  name: string
  costPrice: number
  sellingPrice: number
  stock: number
  reorderThreshold: number
}

interface ExpenseInput {
  category: string
  amount: number
}

export default function Onboarding() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  // Step state
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Step 1: Store Setup state
  const [storeName, setStoreName] = useState('')
  const [city, setCity] = useState('')
  const [currency, setCurrency] = useState('$')
  const [storeType, setStoreType] = useState('retail')

  // Step 2: Theme state
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark')

  // Step 3: Products state
  const [productsList, setProductsList] = useState<ProductInput[]>([])
  const [prodName, setProdName] = useState('')
  const [prodCost, setProdCost] = useState('')
  const [prodSell, setProdSell] = useState('')
  const [prodStock, setProdStock] = useState('')
  const [prodMinStock, setProdMinStock] = useState('')

  // Step 4: Expenses state
  const [expensesList, setExpensesList] = useState<ExpenseInput[]>([])
  const [expCategory, setExpCategory] = useState('Rent')
  const [expAmount, setExpAmount] = useState('')

  // Auth validation & Theme apply hooks
  useEffect(() => {
    const validateAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
      }
    }
    validateAuth()
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const applyTheme = (selectedTheme: 'light' | 'dark' | 'system') => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')

    if (selectedTheme === 'dark') {
      root.classList.add('dark')
    } else if (selectedTheme === 'light') {
      root.classList.add('light')
    } else {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      root.classList.add(systemTheme)
    }
    localStorage.setItem('app_theme', selectedTheme)
  }

  // Live SVG logo helpers
  const getInitials = (name: string) => {
    if (!name) return 'SP'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const getGradientIndex = (name: string) => {
    let sum = 0
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
    return sum % 4
  }

  const gradients = [
    'from-indigo-600 to-violet-500',
    'from-emerald-500 to-teal-600',
    'from-rose-500 to-orange-500',
    'from-cyan-500 to-blue-600'
  ]

  // Step 3 Product Handlers
  const handleAddProduct = () => {
    if (!prodName || !prodCost || !prodSell || !prodStock || !prodMinStock) return

    const newProd: ProductInput = {
      name: prodName,
      costPrice: parseFloat(prodCost),
      sellingPrice: parseFloat(prodSell),
      stock: parseInt(prodStock),
      reorderThreshold: parseInt(prodMinStock)
    }

    setProductsList([...productsList, newProd])
    setProdName('')
    setProdCost('')
    setProdSell('')
    setProdStock('')
    setProdMinStock('')
  }

  const handleRemoveProduct = (index: number) => {
    setProductsList(productsList.filter((_, idx) => idx !== index))
  }

  // Step 4 Expense Handlers
  const handleAddExpense = () => {
    if (!expAmount) return

    const newExp: ExpenseInput = {
      category: expCategory,
      amount: parseFloat(expAmount)
    }

    setExpensesList([...expensesList, newExp])
    setExpAmount('')
  }

  const handleRemoveExpense = (index: number) => {
    setExpensesList(expensesList.filter((_, idx) => idx !== index))
  }

  // Step 5 Save & Launch Dashboard
  const handleCompleteSetup = async () => {
    setLoading(true)
    setAuthError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user found.')

      // 1. Create store profile in Supabase
      const { error: profileErr } = await supabase
        .from('store_profiles')
        .insert([{
          owner_id: user.id,
          name: storeName,
          category: storeType,
          city: city,
          currency: currency,
          language: i18n.language || 'en'
        }])

      if (profileErr) throw profileErr

      // 2. Create products in Supabase
      if (productsList.length > 0) {
        for (const item of productsList) {
          const { data: prodData, error: prodErr } = await supabase
            .from('products')
            .insert([{
              owner_id: user.id,
              name: item.name,
              price: item.sellingPrice,
              stock: item.stock,
              min_stock: item.reorderThreshold,
              category: 'General'
            }])
            .select()

          if (prodErr) throw prodErr

          // Log initial cost in stock_inputs
          if (prodData && prodData.length > 0) {
            const { error: costErr } = await supabase
              .from('stock_inputs')
              .insert([{
                owner_id: user.id,
                product_id: prodData[0].id,
                quantity: item.stock,
                cost_price: item.costPrice
              }])

            if (costErr) throw costErr
          }
        }
      }

      // 3. Create expenses in Supabase
      if (expensesList.length > 0) {
        const expenseEntries = expensesList.map(item => ({
          owner_id: user.id,
          title: `Initial ${item.category} Invoice`,
          amount: item.amount,
          category: item.category,
          date: new Date().toISOString().split('T')[0]
        }))

        const { error: expErr } = await supabase
          .from('expenses')
          .insert(expenseEntries)

        if (expErr) throw expErr
      }

      // Save local preferences
      localStorage.setItem('onboarded_store_name', storeName)
      localStorage.setItem('onboarded_store_currency', currency)

      setLoading(false)
      navigate('/dashboard')
    } catch (err: any) {
      setLoading(false)
      setAuthError(err.message || 'Error occurred while saving configurations.')
    }
  }

  const isRTL = i18n.language === 'ar'

  return (
    <div className="relative min-h-[calc(100vh-140px)] flex flex-col items-center justify-center p-4">
      <div className="glow-bg" />

      <div className="w-full max-w-lg glass rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative z-10 transition-all duration-300">
        
        {/* Step Indicator Header */}
        <div className="flex justify-between items-center border-b border-slate-850 pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <span>SuperManager Pro</span>
          <span className="text-indigo-400">
            {step === 1 && t('onboarding.step_1')}
            {step === 2 && t('onboarding.step_2')}
            {step === 3 && t('onboarding.step_3')}
            {step === 4 && t('onboarding.step_4')}
            {step === 5 && t('onboarding.step_5')}
          </span>
        </div>

        {authError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs">
            {authError}
          </div>
        )}

        {/* STEP 1: Store Setup */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-indigo-400" /> {t('onboarding.title')}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">{t('onboarding.subtitle')}</p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-semibold">{t('onboarding.store_name')}</label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. Algiers Premium Grocer"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2.5 px-3.5 text-white placeholder-gray-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {t('onboarding.city')}
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Algiers"
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2.5 px-3 text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold">{t('onboarding.currency')}</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2.5 px-3 text-white focus:outline-none"
                  >
                    <option value="$">US Dollar ($)</option>
                    <option value="€">Euro (€)</option>
                    <option value="£">Pound (£)</option>
                    <option value="DZD">DZD (د.ج)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-semibold">{t('onboarding.store_cat')}</label>
                <select
                  value={storeType}
                  onChange={(e) => setStoreType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2.5 px-3 text-white focus:outline-none"
                >
                  <option value="retail">Supermarket & Retail Grocery</option>
                  <option value="clothing">Boutique & Clothing Store</option>
                  <option value="electronics">Electronics & Tech Shop</option>
                  <option value="pharmacy">Pharmacy & Cosmetics</option>
                  <option value="other">Other Operations</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => { if (storeName && city) setStep(2) }}
              disabled={!storeName || !city}
              className="w-full bg-indigo-600 hover:bg-indigo-505 disabled:opacity-50 text-white py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              {t('onboarding.next')} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Theme Setup */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="text-lg font-bold text-white">{t('onboarding.theme_label')}</h3>
              <p className="text-[11px] text-gray-400 mt-1">Configure layout appearance preferences.</p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              {[
                { name: 'dark', label: t('onboarding.theme_dark'), icon: Moon },
                { name: 'light', label: t('onboarding.theme_light'), icon: Sun },
                { name: 'system', label: 'System Mode', icon: Laptop }
              ].map(t => (
                <button
                  key={t.name}
                  onClick={() => setTheme(t.name as any)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all gap-2 ${
                    theme === t.name
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-slate-850 bg-slate-900/40 text-gray-400 hover:text-white'
                  }`}
                >
                  <t.icon className="w-5 h-5" />
                  <span className="text-[9px] font-bold text-center">{t.label}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-slate-900 hover:bg-slate-850 text-gray-300 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> {t('onboarding.back')}
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-505 text-white py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                {t('onboarding.next')} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Load Inventory */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-400" /> {t('onboarding.sample_products')}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">Preload or add inventory catalog products.</p>
            </div>

            {/* Product form */}
            <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Name</label>
                  <input
                    type="text"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    placeholder="e.g. Soda Can"
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Initial Cost</label>
                  <input
                    type="number"
                    value={prodCost}
                    onChange={(e) => setProdCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Sell Price</label>
                  <input
                    type="number"
                    value={prodSell}
                    onChange={(e) => setProdSell(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Stock</label>
                  <input
                    type="number"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    placeholder="100"
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Reorder Alert</label>
                  <input
                    type="number"
                    value={prodMinStock}
                    onChange={(e) => setProdMinStock(e.target.value)}
                    placeholder="15"
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white"
                  />
                </div>
              </div>

              <button
                onClick={handleAddProduct}
                className="w-full bg-slate-900 border border-slate-800 text-white font-bold py-1.5 rounded transition-all flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add Product Item
              </button>
            </div>

            {/* List */}
            {productsList.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-2 pr-1 text-xs">
                {productsList.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 rounded bg-slate-900 border border-slate-850">
                    <div>
                      <span className="font-bold text-white">{item.name}</span>
                      <span className="text-[10px] text-gray-500 block">Stock: {item.stock} | Sell: {currency}{item.sellingPrice}</span>
                    </div>
                    <button onClick={() => handleRemoveProduct(idx)} className="text-gray-500 hover:text-rose-400 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-slate-900 hover:bg-slate-850 text-gray-300 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> {t('onboarding.back')}
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-505 text-white py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                {t('onboarding.next')} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Preload Expenses */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-400" /> {t('onboarding.sample_expenses')}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">Preload overhead expenses.</p>
            </div>

            {/* Expense form */}
            <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Category</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1.5 text-white focus:outline-none"
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
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Amount</label>
                  <input
                    type="number"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white"
                  />
                </div>
              </div>

              <button
                onClick={handleAddExpense}
                className="w-full bg-slate-900 border border-slate-800 text-white font-bold py-1.5 rounded transition-all flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add Expense Invoice
              </button>
            </div>

            {/* List */}
            {expensesList.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-2 pr-1 text-xs">
                {expensesList.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 rounded bg-slate-900 border border-slate-850">
                    <div>
                      <span className="font-bold text-white">{item.category}</span>
                      <span className="text-[10px] text-gray-500 block">Amount: {currency}{item.amount}</span>
                    </div>
                    <button onClick={() => handleRemoveExpense(idx)} className="text-gray-500 hover:text-rose-400 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-slate-900 hover:bg-slate-850 text-gray-300 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> {t('onboarding.back')}
              </button>
              <button
                onClick={() => setStep(5)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-505 text-white py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                {t('onboarding.next')} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Verification & Launch */}
        {step === 5 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="text-center space-y-2.5">
              <div className={`mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr ${gradients[getGradientIndex(storeName)]} flex items-center justify-center shadow-xl text-white font-extrabold text-2xl`}>
                {getInitials(storeName)}
              </div>
              <h3 className="text-lg font-bold text-white">{storeName}</h3>
              <p className="text-[11px] text-gray-400 leading-normal">
                {t('onboarding.all_set')}
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-semibold text-gray-500">
                <div>
                  <span className="block text-gray-600">Location</span>
                  <span className="text-white text-xs">{city}</span>
                </div>
                <div>
                  <span className="block text-gray-600">Currency</span>
                  <span className="text-white text-xs">{currency}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-semibold text-gray-500 border-t border-slate-900 pt-3">
                <div>
                  <span className="block text-gray-600">Preloaded Products</span>
                  <span className="text-indigo-400 text-xs font-bold">{productsList.length} items</span>
                </div>
                <div>
                  <span className="block text-gray-600">Preloaded Bills</span>
                  <span className="text-indigo-400 text-xs font-bold">{expensesList.length} items</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(4)}
                disabled={loading}
                className="flex-1 bg-slate-900 hover:bg-slate-850 disabled:opacity-50 text-gray-300 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> {t('onboarding.back')}
              </button>
              <button
                onClick={handleCompleteSetup}
                disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-505 disabled:opacity-50 text-white py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10"
              >
                {loading ? (
                  <>
                    <span className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>{t('onboarding.btn_complete')}</span>
                    <Sparkles className="w-4.5 h-4.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
