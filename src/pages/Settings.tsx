import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings as SettingsIcon, Store, ShieldCheck, Database, Save, RotateCcw, Download, Upload, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useTranslation } from 'react-i18next'

export default function Settings() {
  const { t, i18n } = useTranslation()
  const [storeName, setStoreName] = useState('My SuperStore')
  const [storeType, setStoreType] = useState('retail')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const savedName = localStorage.getItem('onboarded_store_name')
    const savedType = localStorage.getItem('onboarded_store_type')
    if (savedName) setStoreName(savedName)
    if (savedType) setStoreType(savedType)
  }, [])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    localStorage.setItem('onboarded_store_name', storeName)
    localStorage.setItem('onboarded_store_type', storeType)
    setSaveSuccess(true)
    setTimeout(() => {
      setSaveSuccess(false)
      window.location.reload()
    }, 1000)
  }

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all local configurations? This will force onboarding setup.')) {
      localStorage.removeItem('onboarded_store_name')
      localStorage.removeItem('onboarded_store_type')
      navigate('/onboarding')
    }
  }

  // Backup / Restore states
  const [backupLoading, setBackupLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [backupError, setBackupError] = useState<string | null>(null)

  const handleBackup = async () => {
    setBackupLoading(true)
    setBackupError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthenticated session.')

      const [pRes, sRes, eRes, dRes] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('sales').select('*'),
        supabase.from('expenses').select('*'),
        supabase.from('customer_debts').select('*')
      ])

      if (pRes.error) throw pRes.error
      if (sRes.error) throw sRes.error
      if (eRes.error) throw eRes.error
      if (dRes.error) throw dRes.error

      const backupObj = {
        version: '1.0',
        backup_date: new Date().toISOString(),
        store_name: storeName,
        data: {
          products: pRes.data || [],
          sales: sRes.data || [],
          expenses: eRes.data || [],
          customer_debts: dRes.data || []
        }
      }

      const jsonString = JSON.stringify(backupObj, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute("href", url)
      downloadAnchor.setAttribute("download", `supermanager_backup_${new Date().toISOString().slice(0,10)}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      URL.revokeObjectURL(url)

      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Database backup downloaded successfully!', type: 'success' }
      }))
    } catch (err: any) {
      setBackupError(err.message || 'Backup failed')
    } finally {
      setBackupLoading(false)
    }
  }

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!confirm('WARNING: Restoring a backup will merge and update data into your active tables. Existing duplicates with matching IDs will be overwritten. Do you want to proceed?')) {
      event.target.value = ''
      return
    }

    setRestoreLoading(true)
    setBackupError(null)

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string)
        if (!json.version || !json.data) {
          throw new Error('Invalid backup file format.')
        }

        const { products, sales, expenses, customer_debts } = json.data

        if (products && products.length > 0) {
          const { error: pErr } = await supabase.from('products').upsert(products)
          if (pErr) throw pErr
        }

        if (sales && sales.length > 0) {
          const { error: sErr } = await supabase.from('sales').upsert(sales)
          if (sErr) throw sErr
        }

        if (expenses && expenses.length > 0) {
          const { error: eErr } = await supabase.from('expenses').upsert(expenses)
          if (eErr) throw eErr
        }

        if (customer_debts && customer_debts.length > 0) {
          const { error: dErr } = await supabase.from('customer_debts').upsert(customer_debts)
          if (dErr) throw dErr
        }

        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: { message: 'Database backup restored successfully!', type: 'success' }
        }))

        event.target.value = ''

        setTimeout(() => {
          window.location.reload()
        }, 1500)

      } catch (err: any) {
        setBackupError(err.message || 'Failed to restore database.')
        event.target.value = ''
      } finally {
        setRestoreLoading(false)
      }
    }
    reader.readAsText(file)
  }

  const isRTL = i18n.language === 'ar'

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-indigo-400" /> {t('nav.settings')}
        </h2>
        <p className="text-xs text-gray-400">Configure client schemas, update credentials, and reset manager flows.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Store settings */}
        <div className="md:col-span-2 glass rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Store className="w-4 h-4 text-indigo-400" /> Store Profile
          </h3>

          {saveSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 text-center text-xs text-emerald-400 flex items-center justify-center gap-1.5 animate-pulse">
              <ShieldCheck className="w-4 h-4" /> Store Settings Saved!
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-gray-400 font-semibold">{t('onboarding.store_name')}</label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Peak Supermarket"
                className={`w-full bg-slate-950 border border-slate-850 rounded-lg py-2.5 px-3.5 text-white focus:outline-none ${
                  isRTL ? 'text-right' : 'text-left'
                }`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-gray-400 font-semibold">{t('onboarding.store_cat')}</label>
              <select
                value={storeType}
                onChange={(e) => setStoreType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-855 rounded-lg py-2.5 px-3 text-white focus:outline-none"
              >
                <option value="retail">Retail Shop</option>
                <option value="grocery">Grocery / F&B</option>
                <option value="clothing">Boutique & Clothing Store</option>
                <option value="electronics">Electronics & Tech Shop</option>
                <option value="pharmacy">Pharmacy</option>
              </select>
            </div>

            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-505 text-white font-medium py-2 px-4 rounded-lg transition-all text-xs flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Save Profile Settings
            </button>
          </form>
        </div>

        {/* System parameters */}
        <div className="space-y-4 text-xs">
          {/* Backup & Recovery Card */}
          <div className="glass rounded-xl p-5 shadow-xl space-y-3.5 border border-slate-900/60">
            <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
              <Database className="w-4 h-4 text-indigo-400" /> Backup & Recovery
            </h3>
            <p className="text-[10px] text-gray-500 leading-normal">
              Download a complete offline copy of your database (products, sales, expenses, and credit debts) or restore from a previously saved JSON file.
            </p>

            {backupError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-red-400 text-[10px] flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{backupError}</span>
              </div>
            )}

            <button
              onClick={handleBackup}
              disabled={backupLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-505 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 min-h-[40px] text-xs shadow-md shadow-indigo-600/10"
            >
              {backupLoading ? (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Download className="w-4 h-4" /> Download Local Backup
                </>
              )}
            </button>

            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleRestore}
                disabled={restoreLoading}
                id="restore-file-input"
                className="hidden"
              />
              <label
                htmlFor="restore-file-input"
                className="w-full bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-750 text-gray-300 font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 min-h-[40px] text-xs cursor-pointer select-none"
              >
                {restoreLoading ? (
                  <span className="h-4 w-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-indigo-400" /> Upload & Restore Backup
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Reset settings */}
          <div className="glass rounded-xl p-5 shadow-xl space-y-3.5 border border-slate-900/60">
            <h3 className="font-bold text-white text-sm">System Actions</h3>
            <p className="text-[10px] text-gray-500 leading-normal">
              Reset all wizard cache parameters to initialize the onboarding config parameters from scratch.
            </p>
            <button
              onClick={handleReset}
              className="w-full bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-rose-400 text-gray-400 font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Local Configurations
            </button>

            <button
              onClick={async () => {
                await supabase.auth.signOut()
                navigate('/login')
              }}
              className="w-full bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              Sign Out Session
            </button>
          </div>
        </div>

      </div>

    </div>
  )
}
