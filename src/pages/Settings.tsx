import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings as SettingsIcon, Store, ShieldCheck, Database, Save, RotateCcw, Download, Upload, AlertTriangle, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useTranslation } from 'react-i18next'

export default function Settings() {
  const { t, i18n } = useTranslation()
  const [storeName, setStoreName] = useState('My SuperStore')
  const [storeType, setStoreType] = useState('retail')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const navigate = useNavigate()

  const [profileId, setProfileId] = useState<string | null>(null)
  const [employeeModeEnabled, setEmployeeModeEnabled] = useState(false)
  const [lastEmployeeAccess, setLastEmployeeAccess] = useState<string | null>(null)
  const [employeePin, setEmployeePin] = useState('')
  
  // PIN change states
  const [showPinModal, setShowPinModal] = useState(false)
  const [ownerPassword, setOwnerPassword] = useState('')
  const [newPin, setNewPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

  // Account Password update states
  const [newAccountPassword, setNewAccountPassword] = useState('')
  const [confirmAccountPassword, setConfirmAccountPassword] = useState('')
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false)
  const [passwordChangeMsg, setPasswordChangeMsg] = useState<string | null>(null)
  const [passwordChangeErr, setPasswordChangeErr] = useState<string | null>(null)

  useEffect(() => {
    const savedName = localStorage.getItem('onboarded_store_name')
    const savedType = localStorage.getItem('onboarded_store_type')
    if (savedName) setStoreName(savedName)
    if (savedType) setStoreType(savedType)
    
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('store_profiles')
          .select('*')
          .eq('owner_id', user.id)
          .single()

        if (profile) {
          setProfileId(profile.id)
          setEmployeeModeEnabled(profile.employee_mode_enabled ?? false)
          setLastEmployeeAccess(profile.last_employee_access || null)
          setEmployeePin(profile.employee_pin || '')
        }
      }
    } catch (e) {
      console.warn('Failed to load profile settings:', e)
    }
  }

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

  const handleToggleEmployeeMode = async (enabled: boolean) => {
    setEmployeeModeEnabled(enabled)
    try {
      if (profileId) {
        const { error } = await supabase
          .from('store_profiles')
          .update({ employee_mode_enabled: enabled })
          .eq('id', profileId)
        if (error) throw error
        
        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: { message: `Employee Access ${enabled ? 'Enabled' : 'Disabled'}`, type: 'success' }
        }))
      }
    } catch (e: any) {
      console.error('Failed to toggle employee mode:', e)
    }
  }

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault()
    setPinError(null)

    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      setPinError('PIN must be exactly 4 digits (e.g. 1234).')
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user || (await supabase.auth.getUser()).data.user
      
      if (!user) {
        throw new Error('No active login session. Please sign in to your account.')
      }

      // Upsert PIN into store_profiles
      const { data: existingProfile } = await supabase
        .from('store_profiles')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (existingProfile) {
        const { error: updateErr } = await supabase
          .from('store_profiles')
          .update({ 
            employee_pin: newPin,
            employee_mode_enabled: true 
          })
          .eq('id', existingProfile.id)

        if (updateErr) throw updateErr
        setProfileId(existingProfile.id)
      } else {
        const { data: newProf, error: insErr } = await supabase
          .from('store_profiles')
          .insert([{
            owner_id: user.id,
            name: storeName || 'Magasin Peinture & Droguerie',
            category: 'peinture_droguerie',
            currency: 'DA',
            employee_pin: newPin,
            employee_mode_enabled: true
          }])
          .select()
          .single()

        if (insErr) throw insErr
        if (newProf) setProfileId(newProf.id)
      }

      // Immediately persist to local terminal storage
      localStorage.setItem('terminal_employee_pin', newPin.trim())
      localStorage.setItem('employee_pin', newPin.trim())
      if (user) {
        localStorage.setItem('terminal_store_owner_id', user.id)
      }

      setEmployeePin(newPin.trim())
      setEmployeeModeEnabled(true)
      setShowPinModal(false)
      setNewPin('')

      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: `Cashier PIN successfully set to: ${newPin}`, type: 'success' }
      }))
    } catch (err: any) {
      console.error('PIN update error:', err)
      setPinError(err.message || 'Failed to update PIN.')
    }
  }

  // Update Account Login Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordChangeMsg(null)
    setPasswordChangeErr(null)

    if (!newAccountPassword || newAccountPassword.length < 6) {
      setPasswordChangeErr('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (newAccountPassword !== confirmAccountPassword) {
      setPasswordChangeErr('Les mots de passe ne correspondent pas.')
      return
    }

    setPasswordChangeLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newAccountPassword
      })
      if (error) throw error

      setNewAccountPassword('')
      setConfirmAccountPassword('')
      setPasswordChangeMsg('Mot de passe mis à jour avec succès!')
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Mot de passe mis à jour avec succès!', type: 'success' }
      }))
    } catch (err: any) {
      setPasswordChangeErr(err.message || 'Échec de la mise à jour du mot de passe.')
    } finally {
      setPasswordChangeLoading(false)
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
        <div className="md:col-span-2 space-y-6">
          <div className="glass rounded-xl p-5 shadow-xl space-y-4">
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

          {/* Employee Access Settings Card */}
          <div className="glass rounded-xl p-5 shadow-xl space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#f59e0b]" /> Employee Access Settings
            </h3>
            
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                <div>
                  <span className="font-bold text-white block">Enable Employee POS Mode</span>
                  <span className="text-[10px] text-gray-500 block">Allow cashiers to use the PIN numpad to enter register.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={employeeModeEnabled}
                    onChange={(e) => handleToggleEmployeeMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f59e0b]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                <div>
                  <span className="font-bold text-white block">Cashier PIN Code (رمز الكاشير)</span>
                  <span className="text-[11px] text-amber-400 block font-mono font-bold">Active PIN: {employeePin || '1234'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPinError(null)
                    setShowPinModal(true)
                  }}
                  className="bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-gray-200 font-bold py-2 px-3 rounded-lg transition-all min-h-[38px] text-[11px]"
                >
                  Change 4-Digit PIN
                </button>
              </div>

              <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                <div>
                  <span className="font-bold text-white block">Last Employee Session</span>
                  <span className="text-[10px] text-gray-500 block font-mono">
                    {lastEmployeeAccess
                      ? new Date(lastEmployeeAccess).toLocaleString(i18n.language)
                      : 'Never Accessed'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/reports?tab=employee')}
                  className="w-full bg-[#f59e0b]/10 border border-[#f59e0b]/20 hover:bg-[#f59e0b]/20 text-[#f59e0b] font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  View Employee Sales Report ➔
                </button>
              </div>

            </div>
          </div>
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

          {/* Account Security / Change Password */}
          <div className="glass rounded-xl p-5 shadow-xl space-y-3.5 border border-slate-900/60">
            <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Sécurité du Compte (تغيير كلمة المرور)
            </h3>
            <p className="text-[10px] text-gray-500 leading-normal">
              Modifier le mot de passe de connexion du propriétaire du magasin.
            </p>

            {passwordChangeMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2.5 rounded-lg text-xs">
                {passwordChangeMsg}
              </div>
            )}

            {passwordChangeErr && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2.5 rounded-lg text-xs">
                {passwordChangeErr}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-2.5 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-semibold">Nouveau Mot de Passe (6+ caractères)</label>
                <input
                  type="password"
                  required
                  value={newAccountPassword}
                  onChange={(e) => setNewAccountPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white min-h-[38px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-semibold">Confirmer le Mot de Passe</label>
                <input
                  type="password"
                  required
                  value={confirmAccountPassword}
                  onChange={(e) => setConfirmAccountPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white min-h-[38px]"
                />
              </div>

              <button
                type="submit"
                disabled={passwordChangeLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-505 disabled:opacity-50 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 min-h-[38px]"
              >
                {passwordChangeLoading ? (
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Mettre à jour le mot de passe'
                )}
              </button>
            </form>
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

      {/* Change PIN Password Check Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-850 rounded-2xl p-5 shadow-2xl space-y-4 relative">
            <button
              onClick={() => {
                setShowPinModal(false)
                setOwnerPassword('')
                setNewPin('')
                setPinError(null)
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-850 pb-2.5">
              <ShieldCheck className="w-4.5 h-4.5 text-amber-500" /> Set Cashier PIN Code
            </h3>

            {pinError && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded p-2.5 text-rose-450 text-[10px] flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{pinError}</span>
              </div>
            )}

            <form onSubmit={handleChangePin} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-semibold">New 4-Digit PIN (رمز الدخول المكون من 4 أرقام)</label>
                <input
                  type="text"
                  maxLength={4}
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 1234"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-white min-h-[48px] text-center tracking-widest font-bold text-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false)
                    setNewPin('')
                    setPinError(null)
                  }}
                  className="flex-1 bg-slate-900 hover:bg-slate-850 text-gray-300 py-2 rounded-lg font-bold min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 py-2 rounded-lg font-bold min-h-[48px]"
                >
                  Save PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
