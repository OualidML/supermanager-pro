import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings as SettingsIcon, Store, ShieldCheck, Database, Save, RotateCcw } from 'lucide-react'
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
