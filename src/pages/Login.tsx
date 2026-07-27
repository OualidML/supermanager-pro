import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Mail, Sparkles, Building2, Globe, AlertCircle, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useTranslation } from 'react-i18next'

export default function Login() {
  const { t, i18n } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  
  const navigate = useNavigate()

  useEffect(() => {
    const rememberedEmail = localStorage.getItem('remembered_email')
    if (rememberedEmail) {
      setEmail(rememberedEmail)
      setRememberMe(true)
    }
  }, [])

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
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) throw signUpError

        if (rememberMe) {
          localStorage.setItem('remembered_email', email)
        } else {
          localStorage.removeItem('remembered_email')
        }

        setLoading(false)

        if (data.session) {
          navigate('/onboarding')
        } else {
          setInfoMessage(t('login.confirm_email_msg'))
          setIsSignUp(false)
          setPassword('')
        }
      } else {
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

        // Sync language settings
        const { data: profile } = await supabase
          .from('store_profiles')
          .select('*')
          .eq('owner_id', data.user.id)
          .limit(1)

        setLoading(false)

        if (profile && profile.length > 0) {
          const profileLang = profile[0].language || 'en'
          i18n.changeLanguage(profileLang)
          localStorage.setItem('app_language', profileLang)
          navigate('/dashboard')
        } else {
          navigate('/onboarding')
        }
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
          {isSignUp ? t('login.title_signup') : t('login.title_signin')}
        </h2>

        <form onSubmit={handleAuth} className="space-y-4">
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
            className="w-full bg-indigo-600 hover:bg-indigo-505 text-white font-medium py-2.5 rounded-lg transition-all transform active:scale-[0.98] shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('login.logging_in')}</span>
              </>
            ) : (
              <>
                <span>{isSignUp ? t('login.btn_signup') : t('login.btn_signin')}</span>
                <Sparkles className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Mode Toggle Link */}
        <div className="text-center pt-2">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-all"
          >
            {isSignUp ? t('login.has_account') : t('login.no_account')}
          </button>
        </div>
      </div>
    </div>
  )
}
