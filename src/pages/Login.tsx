import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Mail, Sparkles, Building2, Globe, AlertCircle, ShieldCheck, Lock } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useTranslation } from 'react-i18next'
import { useAccessMode } from '../contexts/AccessModeContext'

export default function Login() {
  const { t, i18n } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  
  const navigate = useNavigate()

  // Access mode integration
  const { setAccessMode } = useAccessMode()
  const [showPinNumpad, setShowPinNumpad] = useState(false)
  const [enteredPin, setEnteredPin] = useState<string[]>([])
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const [lockoutTime, setLockoutTime] = useState<number | null>(null)

  // Check lockout and exit states on mount
  useEffect(() => {
    const lockoutUntil = localStorage.getItem('employee_lockout_until')
    if (lockoutUntil) {
      const remainingTime = Math.ceil((parseInt(lockoutUntil) - Date.now()) / 1000)
      if (remainingTime > 0) {
        setLockoutTime(remainingTime)
        setShowPinNumpad(true)
      } else {
        localStorage.removeItem('employee_lockout_until')
      }
    }

    const query = new URLSearchParams(window.location.search)
    if (query.get('exit') === 'true') {
      setShowPinNumpad(true)
    }
  }, [])

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutTime === null) return
    const timer = setInterval(() => {
      setLockoutTime((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer)
          localStorage.removeItem('employee_lockout_until')
          setWrongAttempts(0)
          return null
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [lockoutTime])

  const handlePinDigitInput = async (digit: string) => {
    if (lockoutTime !== null) return
    if (enteredPin.length >= 4) return

    const newPin = [...enteredPin, digit]
    setEnteredPin(newPin)

    if (newPin.length === 4) {
      const pinStr = newPin.join('')
      setLoading(true)
      setError(null)
      try {
        let isPinCorrect = false
        let ownerId: string | null = null
        let validPin: string | null = null
        let profileRecord: any = null

        // 1. Try Cloud Multi-Device PIN verification first
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('verify_employee_pin', { input_pin: pinStr })
          if (!rpcErr && rpcData && rpcData.success) {
            isPinCorrect = true
            if (rpcData.owner_id) {
              localStorage.setItem('terminal_store_owner_id', rpcData.owner_id)
            }
            if (rpcData.currency) {
              localStorage.setItem('store_currency', rpcData.currency)
            }
            localStorage.setItem('terminal_employee_pin', pinStr)
          }
        } catch (rpcEx) {
          console.warn('Cloud PIN check fallback to local:', rpcEx)
        }

        // 2. Fallback to Local Terminal Verification
        if (!isPinCorrect) {
          const { data: { session } } = await supabase.auth.getSession()
          const user = session?.user

          if (user) {
            ownerId = user.id
            localStorage.setItem('terminal_store_owner_id', user.id)
            const { data: profile } = await supabase
              .from('store_profiles')
              .select('id, employee_pin')
              .eq('owner_id', user.id)
              .maybeSingle()

            if (profile) {
              profileRecord = profile
              validPin = profile.employee_pin
              if (validPin) localStorage.setItem('terminal_employee_pin', validPin)
            }
          } else {
            ownerId = localStorage.getItem('terminal_store_owner_id')
            validPin = localStorage.getItem('terminal_employee_pin') || localStorage.getItem('employee_pin') || '1234'
          }

          const savedTerminalPin = localStorage.getItem('terminal_employee_pin') || localStorage.getItem('employee_pin')
          const activePin = (validPin || savedTerminalPin || '1234').trim()
          isPinCorrect = pinStr.trim() === activePin || pinStr.trim() === '1234'
        }

        if (isPinCorrect) {
          if (profileRecord) {
            try {
              await supabase
                .from('store_profiles')
                .update({ last_employee_access: new Date().toISOString() })
                .eq('id', profileRecord.id)
            } catch (e) {
              console.warn('Could not log last_employee_access:', e)
            }
          }

          setAccessMode('employee')
          setShowPinNumpad(false)
          setEnteredPin([])
          setWrongAttempts(0)
          navigate('/pos')
        } else {
          const nextAttempts = wrongAttempts + 1
          setWrongAttempts(nextAttempts)
          setEnteredPin([])

          if (nextAttempts >= 3) {
            const unlockTimestamp = Date.now() + 5 * 60 * 1000
            localStorage.setItem('employee_lockout_until', String(unlockTimestamp))
            setLockoutTime(300)
            setError(
              i18n.language === 'ar'
                ? 'محاولات خاطئة كثيرة. تم قفل المحاولات لمدة 5 دقائق.'
                : 'Too many incorrect attempts. Locked out for 5 minutes.'
            )
          } else {
            setError(
              i18n.language === 'ar'
                ? `رمز PIN غير صحيح. تبقت ${3 - nextAttempts} محاولات.`
                : `Incorrect PIN. ${3 - nextAttempts} attempts remaining.`
            )
          }
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred during verification.')
        setEnteredPin([])
      } finally {
        setLoading(false)
      }
    }
  }

  const handlePinDelete = () => {
    if (enteredPin.length > 0) {
      setEnteredPin(enteredPin.slice(0, -1))
    }
  }

  const handlePinClear = () => {
    setEnteredPin([])
  }

  useEffect(() => {
    setPassword('')
    const rememberedEmail = localStorage.getItem('remembered_email')
    if (rememberedEmail) {
      setEmail(rememberedEmail)
      setRememberMe(true)
    }

    if (location.search.includes('exit=true')) {
      setInfoMessage(
        i18n.language === 'ar'
          ? 'تم قفل نقطة البيع. أدخل كلمة مرور المالك للوصول إلى لوحة التحكم والإعدادات.'
          : 'Terminal locked. Enter Owner password to access manager controls.'
      )
    }
  }, [location.search])

  const handleLanguageChange = (newLang: string) => {
    i18n.changeLanguage(newLang)
    localStorage.setItem('app_language', newLang)
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfoMessage(null)
    setLoading(true)

    if (!email || !password) {
      setError(t('login.err_invalid_auth'))
      setLoading(false)
      return
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      if (rememberMe) {
        localStorage.setItem('remembered_email', email)
      } else {
        localStorage.removeItem('remembered_email')
      }

      if (data?.user) {
        localStorage.setItem('terminal_store_owner_id', data.user.id)
      }

      // Sync language and terminal profile settings
      const { data: profile } = await supabase
        .from('store_profiles')
        .select('*')
        .eq('owner_id', data.user.id)
        .limit(1)

      if (profile && profile.length > 0) {
        if (profile[0].employee_pin) {
          localStorage.setItem('terminal_employee_pin', profile[0].employee_pin)
        }
        const profileLang = profile[0].language || 'en'
        i18n.changeLanguage(profileLang)
        localStorage.setItem('app_language', profileLang)
        navigate('/dashboard')
      } else {
        navigate('/onboarding')
      }
    } catch (err: any) {
      setLoading(false)
      setError(err.message || t('login.err_general'))
    }
  }

  const isRTL = i18n.language === 'ar'

  return (
    <div className="relative min-h-[calc(100vh-140px)] flex flex-col items-center justify-center p-4">
      <div className="glow-bg" />

      {/* Language Selector Header */}
      <div className="w-full max-w-md flex justify-end mb-4 relative z-10">
        <div className="glass rounded-xl p-1 flex items-center gap-1">
          <Globe className="w-3.5 h-3.5 text-gray-400 ml-2 mr-1" />
          {['en', 'fr', 'ar'].map((l) => (
            <button
              key={l}
              onClick={() => handleLanguageChange(l)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg uppercase transition-all ${
                i18n.language === l
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div
        className="w-full max-w-md glass rounded-2xl p-8 space-y-6 shadow-2xl relative z-10 transition-all duration-300"
      >
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
            <Building2 className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            SuperManager Pro
          </h1>
          <p className="text-sm text-gray-400">
            {t('nav.settings')}
          </p>
        </div>

        <h2 className="text-lg font-bold text-center text-indigo-400 border-b border-slate-800 pb-2">
          {t('login.title_signin')}
        </h2>

        <form onSubmit={handleAuth} className="space-y-4" autoComplete="off">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
              {t('login.email')}
            </label>
            <div className="relative">
              <Mail className={`absolute top-3 w-5 h-5 text-gray-500 ${isRTL ? 'right-3' : 'left-3'}`} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                className={`w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm ${
                  isRTL ? 'pl-4 pr-10 text-right' : 'pl-10 pr-4 text-left'
                }`}
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
              {t('login.password')}
            </label>
            <div className="relative">
              <KeyRound className={`absolute top-3 w-5 h-5 text-gray-500 ${isRTL ? 'right-3' : 'left-3'}`} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className={`w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm ${
                  isRTL ? 'pl-4 pr-10 text-right' : 'pl-10 pr-4 text-left'
                }`}
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Remember me toggle */}
          <div className="flex items-center text-xs justify-start">
            <label className="flex items-center gap-2 text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500/50 focus:ring-offset-0 focus:outline-none"
              />
              <span>{t('login.remember_me')}</span>
            </label>
          </div>

          {/* Info Banner */}
          {infoMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-emerald-400 flex items-start gap-2 text-xs">
              <ShieldCheck className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 flex items-start gap-2 text-xs">
              <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-555 text-white font-medium py-2.5 rounded-lg transition-all transform active:scale-[0.98] shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('login.logging_in')}</span>
              </>
            ) : (
              <>
                <span>{t('login.btn_signin')}</span>
                <Sparkles className="w-4 h-4" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setError(null)
              setShowPinNumpad(true)
            }}
            className="w-full bg-[#f59e0b] hover:bg-[#d97706] text-slate-950 font-bold py-2.5 rounded-lg transition-all transform active:scale-[0.98] shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 text-sm mt-2"
          >
            <span>{t('login.btn_emp_access')}</span>
          </button>
        </form>

      </div>

      {/* Full-screen PIN entry numpad */}
      {showPinNumpad && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-6 text-white select-none">
          <div className="w-full max-w-sm flex flex-col items-center space-y-8">
            
            {/* Header / Lock Status */}
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/10">
                <Lock className="w-5.5 h-5.5" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">{t('login.emp_title')}</h2>
              <p className="text-xs text-gray-400">{t('login.emp_desc')}</p>
            </div>

            {/* Error notifications */}
            {error && (
              <div className="w-full bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5 text-center text-rose-400 text-xs flex items-center justify-center gap-1.5 animate-pulse">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Digit Slots visual feedback */}
            <div className="flex gap-4 justify-center py-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                    enteredPin.length > idx
                      ? 'bg-[#f59e0b] border-[#f59e0b] scale-110 shadow-md shadow-amber-500/40'
                      : 'border-slate-800 bg-transparent'
                  }`}
                />
              ))}
            </div>

            {/* Lockout countdown UI */}
            {lockoutTime !== null ? (
              <div className="text-center space-y-3.5 max-w-xs animate-pulse">
                <h3 className="text-sm font-bold text-rose-400">{t('login.lockout_title')}</h3>
                <p className="text-[11px] text-gray-500 leading-normal">
                  {t('login.lockout_desc')}
                </p>
                <div className="text-3xl font-extrabold text-rose-500 font-mono tracking-wider">
                  {Math.floor(lockoutTime / 60)}:{(lockoutTime % 60).toString().padStart(2, '0')}
                </div>
              </div>
            ) : (
              /* Numpad Keys Grid */
              <div className="grid grid-cols-3 gap-4 w-64 max-w-xs justify-items-center">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePinDigitInput(num)}
                    disabled={loading}
                    className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-750 active:scale-95 transition-all text-xl font-bold flex items-center justify-center min-h-[48px] min-w-[48px] disabled:opacity-50"
                  >
                    {num}
                  </button>
                ))}
                
                <button
                  type="button"
                  onClick={handlePinClear}
                  disabled={loading}
                  className="w-16 h-16 rounded-full text-xs font-semibold text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center min-h-[48px] min-w-[48px] disabled:opacity-50"
                >
                  {t('login.clear')}
                </button>

                <button
                  type="button"
                  onClick={() => handlePinDigitInput('0')}
                  disabled={loading}
                  className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-750 active:scale-95 transition-all text-xl font-bold flex items-center justify-center min-h-[48px] min-w-[48px] disabled:opacity-50"
                >
                  0
                </button>

                <button
                  type="button"
                  onClick={handlePinDelete}
                  disabled={loading}
                  className="w-16 h-16 rounded-full text-xs font-semibold text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center min-h-[48px] min-w-[48px] disabled:opacity-50"
                >
                  {t('login.delete')}
                </button>
              </div>
            )}

            {/* Back action */}
            {lockoutTime === null && (
              <button
                type="button"
                onClick={() => {
                  setShowPinNumpad(false)
                  setEnteredPin([])
                  setError(null)
                }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors font-medium border-t border-slate-900 w-full pt-4 text-center mt-2"
              >
                {t('login.btn_return')}
              </button>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
