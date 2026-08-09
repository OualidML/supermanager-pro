import { useState, useEffect, useRef } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  Package,
  BarChart3,
  Menu,
  Settings,
  Landmark,
  BrainCircuit,
  ShieldAlert,
  LogOut,
  ChevronUp,
  Globe,
  MessageSquare,
  X,
  Send,
  Sparkles,
  User,
  Bot,
  Sun,
  Moon,
  BookOpen,
  Truck
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAccessMode } from '../contexts/AccessModeContext'
import { supabase } from '../lib/supabaseClient'

interface ChatMessage {
  id: string
  sender: 'user' | 'bot'
  text: string
}

interface ToastItem {
  id: string
  message: string
  type?: 'success' | 'error' | 'info'
  action?: {
    label: string
    onClick: () => void
  }
}

export default function Layout() {
  const { t, i18n } = useTranslation()
  const [storeName, setStoreName] = useState('SuperManager Pro')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { accessMode } = useAccessMode()

  // Redirect employee to pos if trying to access owner-only routes
  useEffect(() => {
    const ownerOnlyPaths = [
      '/dashboard',
      '/inventory',
      '/expenses',
      '/reports',
      '/forecast',
      '/settings',
      '/debts',
      '/sales',
      '/billing'
    ]
    if (accessMode === 'employee' && ownerOnlyPaths.includes(location.pathname)) {
      navigate('/pos', { replace: true })
    }
  }, [accessMode, location.pathname, navigate])

  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light') return 'light'
    return 'dark'
  })

  // Toast State
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // AI Assistant Chat States
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'bot', text: 'Hello! I am your AI assistant for SuperManager Pro. How can I help you manage your store today?' }
  ])
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize Theme
  useEffect(() => {
    const root = window.document.documentElement
    if (theme === 'light') {
      root.classList.add('light')
      root.classList.remove('dark')
    } else {
      root.classList.add('dark')
      root.classList.remove('light')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  // Global Toast Listener
  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const details = (e as CustomEvent).detail
      const id = String(Date.now() + Math.random())
      setToasts(prev => [...prev, { id, ...details }])

      // Auto dismiss after 4 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 4000)
    }

    window.addEventListener('app-toast', handleToastEvent)
    return () => window.removeEventListener('app-toast', handleToastEvent)
  }, [])

  useEffect(() => {
    const savedName = localStorage.getItem('onboarded_store_name')
    if (savedName) setStoreName(savedName)

    loadLanguagePreference()
  }, [location])

  // Watch current language to toggle dir and font dynamically
  useEffect(() => {
    const root = window.document.documentElement
    const currentLang = i18n.language || 'en'
    if (currentLang === 'ar') {
      root.dir = 'rtl'
      root.classList.add('font-cairo')
      root.classList.remove('font-sans')
    } else {
      root.dir = 'ltr'
      root.classList.remove('font-cairo')
      root.classList.add('font-sans')
    }
  }, [i18n.language])

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isTyping])

  const loadLanguagePreference = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('store_profiles')
          .select('language')
          .eq('owner_id', user.id)
          .limit(1)

        if (profile && profile.length > 0 && profile[0].language) {
          const dbLang = profile[0].language
          if (dbLang !== i18n.language) {
            i18n.changeLanguage(dbLang)
            localStorage.setItem('app_language', dbLang)
          }
        }
      }
    } catch (e) {
      console.warn('Could not sync language from Supabase profile on load:', e)
    }
  }

  const handleLanguageChange = async (lang: string) => {
    try {
      i18n.changeLanguage(lang)
      localStorage.setItem('app_language', lang)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('store_profiles')
          .update({ language: lang })
          .eq('owner_id', user.id)
      }
    } catch (e) {
      console.error('Error updating language preference:', e)
    }
  }

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return

    const userMsgId = String(Date.now())
    const userMsg: ChatMessage = { id: userMsgId, sender: 'user', text: textToSend }
    setMessages(prev => [...prev, userMsg])
    setChatInput('')
    setIsTyping(true)

    const botMsgId = String(Date.now() + 1)
    let botText = ''

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const currentLang = i18n.language || 'en'

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          message: textToSend,
          language: currentLang
        })
      })

      if (!response.ok) {
        if (response.status === 400 || response.status === 500) {
          const errText = await response.text()
          if (errText.includes('Anthropic') || errText.includes('secret') || errText.includes('API')) {
            setIsTyping(false)
            setMessages(prev => [...prev, { id: botMsgId, sender: 'bot', text: errText }])
            return
          }
        }
        throw new Error('Supabase Edge Function not reachable.')
      }

      setMessages(prev => [...prev, { id: botMsgId, sender: 'bot', text: '' }])
      setIsTyping(false)

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('Readable stream not supported.')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        botText += chunk
        setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: botText } : m))
      }

    } catch (err) {
      console.warn('Edge Function stream failed. Initiating local client simulator:', err)
      
      setIsTyping(false)
      setMessages(prev => [...prev, { id: botMsgId, sender: 'bot', text: '' }])

      let simulatedReply = ''
      const lower = textToSend.toLowerCase()
      const currentLang = i18n.language || 'en'

      if (lower.includes('add a product') || lower.includes('إضافة منتج') || lower.includes('ajouter un produit')) {
        simulatedReply = currentLang === 'ar'
          ? 'لإضافة منتج جديد، اذهب إلى صفحة "المخزون" واضغط على زر "إضافة منتج جديد" في الأعلى. املأ الاسم، الرمز (SKU)، السعر، والتكلفة، وحد الطلب المنخفض، ثم احفظ.'
          : currentLang === 'fr'
          ? "Pour ajouter un produit, allez sur l'écran 'Inventaire' et cliquez sur 'Ajouter Nouveau Produit' en haut. Remplissez le nom, le code SKU/code-barres, les prix, les coûts de revient, puis enregistrez."
          : "To add a product, navigate to the 'Inventory' screen and click 'Add New Product' in the top-right. Fill in the product details, optional barcode SKU, prices, and thresholds, then click Save."
      } else if (lower.includes('record a sale') || lower.includes('تسجيل عملية بيع') || lower.includes('enregistrer une vente')) {
        simulatedReply = currentLang === 'ar'
          ? 'لتسجيل عملية بيع، توجه إلى صفحة "نقطة البيع". امسح باركود المنتج بواسطة الكاميرا أو ابحث عنه بالاسم، عدل الكمية في السلة، ثم اضغط على زر "إتمام عملية البيع".'
          : currentLang === 'fr'
          ? "Pour enregistrer une vente, allez sur l'écran 'Caisse Enregistreuse'. Scannez le code-barres avec la caméra ou recherchez manuellement. Ajustez les quantités puis cliquez sur 'Valider la Vente'."
          : "To record a sale, open the 'Sales Register' page. Scan EAN-13 barcodes using your camera scanner or search items manually. Adjust quantities, then click the checkout button."
      } else if (lower.includes('forecast') || lower.includes('توقعات') || lower.includes('prévision')) {
        simulatedReply = currentLang === 'ar'
          ? 'تقارير التوقعات الذكية موجودة في شاشة "التوقعات" (يمكنك الوصول إليها عبر قائمة "المزيد" أسفل اليمين). تقوم باحتساب مبيعات الأسبوع القادم اعتماداً على متوسط الأسابيع الـ 4 الماضية.'
          : currentLang === 'fr'
          ? "Les prévisions sont accessibles via l'écran 'Prévisions' (dans le menu 'Plus' en bas à droite). Elles estiment le chiffre d'affaires à 7 jours sur la base des moyennes de ventes des 4 dernières semaines."
          : "The demand forecast screen is located in the 'Forecast' dashboard (via the 'More' menu in the bottom nav). It computes weekly demand based on your last 4 weeks of sales averages."
      } else {
        simulatedReply = currentLang === 'ar'
          ? "أنا مساعدك الذكي. يمكنني الإجابة على استفساراتك حول كيفية استخدام التطبيق. (تنبيه: لتفعيل المساعد الذكي المباشر، يرجى تهيئة ونشر دالة Supabase Edge Function: assistant-chat)."
          : currentLang === 'fr'
          ? "Je suis votre assistant. Je peux vous guider dans l'utilisation de l'application. (Note : Pour activer l'IA en direct, veuillez déployer la fonction d'Edge Supabase : assistant-chat)."
          : "I am your app assistant. I can guide you through the features of SuperManager Pro. (Note: To connect me to live Claude AI, please deploy the 'assistant-chat' Supabase Edge Function)."
      }

      let charIdx = 0
      const interval = setInterval(() => {
        if (charIdx < simulatedReply.length) {
          botText += simulatedReply[charIdx]
          setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: botText } : m))
          charIdx++
        } else {
          clearInterval(interval)
        }
      }, 15)
    }
  }

  // Dynamic SVG avatar initial and gradient colors
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

  const logoGradients = [
    'from-indigo-600 to-violet-500',
    'from-emerald-500 to-teal-600',
    'from-rose-500 to-orange-500',
    'from-cyan-500 to-blue-600'
  ]

  const logoGradientClass = logoGradients[getGradientIndex(storeName)]
  const initials = getInitials(storeName)

  const mainTabs = [
    { name: t('nav.dashboard'), path: '/dashboard', icon: LayoutDashboard },
    { name: t('nav.sales'), path: '/sales', icon: Receipt },
    { name: t('nav.inventory'), path: '/inventory', icon: Package },
    { name: t('nav.reports'), path: '/reports', icon: BarChart3 }
  ]

  const moreItems = [
    { name: t('nav.debts') || 'Credit Ledger', path: '/debts', icon: BookOpen, desc: 'Manage customer tabs and debts' },
    { name: t('nav.billing') || 'Facturation & BL', path: '/billing', icon: Truck, desc: 'Bons de livraison, transporteurs et facturation' },
    { name: t('nav.expenses'), path: '/expenses', icon: Landmark, desc: 'Log bills & operating costs' },
    { name: t('nav.forecast'), path: '/forecast', icon: BrainCircuit, desc: 'Stock prediction model' },
    { name: t('nav.settings'), path: '/settings', icon: Settings, desc: 'Manage credentials & API' },
    { name: 'Login Screen', path: '/login', icon: LogOut, desc: 'Switch user credentials' },
    { name: 'Onboarding Wizard', path: '/onboarding', icon: ShieldAlert, desc: 'Run setup schemas' }
  ]

  const isActive = (path: string) => location.pathname === path
  const currentLang = i18n.language || 'en'
  const isRTL = currentLang === 'ar'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col transition-colors duration-300">
      
      {/* Top Header Bar */}
      <header className="fixed top-0 left-0 right-0 h-16 glass-header z-40 flex items-center justify-between px-4 sm:px-6 shadow-md">
        <div className="flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt="Houari Achaach Logo"
            className="w-10 h-10 rounded-full object-cover shadow-md border-2 border-amber-500/40 flex-shrink-0 hover:scale-105 transition-transform"
          />
          <div>
            <h1 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
              {storeName || 'HOUARI ACHAACH'}
            </h1>
            <span className="text-[9.5px] text-amber-400 font-bold uppercase tracking-wider block">
              PAINT SHOP &amp; PVC SOLUTIONS
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        {accessMode !== 'employee' && (
          <nav className="hidden lg:flex items-center gap-1 bg-slate-900/60 border border-slate-850 p-1 rounded-xl">
            {[
              { name: t('nav.dashboard'), path: '/dashboard', icon: LayoutDashboard },
              { name: t('nav.sales'), path: '/sales', icon: Receipt },
              { name: t('nav.inventory'), path: '/inventory', icon: Package },
              { name: t('nav.debts') || 'Credit / الديون', path: '/debts', icon: BookOpen },
              { name: t('nav.billing') || 'Facturation / الفواتير', path: '/billing', icon: Truck },
              { name: t('nav.expenses'), path: '/expenses', icon: Landmark },
              { name: t('nav.reports'), path: '/reports', icon: BarChart3 }
            ].map((navItem) => {
              const Icon = navItem.icon
              const active = isActive(navItem.path)
              return (
                <Link
                  key={navItem.path}
                  to={navItem.path}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-gray-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{navItem.name}</span>
                </Link>
              )
            })}
          </nav>
        )}

        {/* Header Controls: Theme + Language + Settings */}
        <div className="flex items-center gap-2.5">
          
          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="p-2.5 min-h-[48px] min-w-[48px] rounded-lg bg-slate-900/60 border border-slate-850 hover:bg-slate-900 transition-colors text-gray-400 hover:text-white flex items-center justify-center"
          >
            {theme === 'dark' ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-indigo-400" />}
          </button>

          {/* Language Selector */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-900/60 border border-slate-850 py-1.5 px-2.5 rounded-lg text-gray-400 hover:text-white transition-colors relative min-h-[40px]">
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={currentLang}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-transparent text-gray-300 font-bold border-none outline-none focus:ring-0 cursor-pointer text-[11px]"
            >
              <option value="en" className="bg-slate-950 text-white">English (EN)</option>
              <option value="fr" className="bg-slate-950 text-white">Français (FR)</option>
              <option value="ar" className="bg-slate-950 text-white">العربية (AR)</option>
            </select>
          </div>

          <Link
            to="/settings"
            className="p-2.5 min-h-[48px] min-w-[48px] rounded-lg bg-slate-900/60 border border-slate-850 hover:bg-slate-900 transition-colors text-gray-400 hover:text-white flex items-center justify-center"
          >
            <Settings className="w-4.5 h-4.5" />
          </Link>
        </div>
      </header>

      {/* Main Scrollable Outlet Area */}
      <main className="flex-1 pt-20 px-4 sm:px-6 max-w-6xl mx-auto w-full overflow-y-auto">
        <Outlet />
      </main>

      {/* Extended Menu Popover */}
      {showMoreMenu && (
        <div className="fixed inset-0 bg-slate-950/75 z-45 backdrop-blur-sm" onClick={() => setShowMoreMenu(false)}>
          <div
            className="fixed bottom-16 left-4 right-4 max-w-md mx-auto glass rounded-2xl p-5 shadow-2xl space-y-4 border border-indigo-500/20 z-50 animate-in slide-in-from-bottom duration-250"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-850 pb-2">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Extended Menu</h4>
              <span className="text-[10px] text-indigo-400 font-semibold">Store Manager Tools</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {moreItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    setShowMoreMenu(false)
                    navigate(item.path)
                  }}
                  className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all min-h-[48px] ${
                    isActive(item.path)
                      ? 'bg-indigo-500/10 border border-indigo-500/30 text-white'
                      : 'bg-slate-900/40 border border-slate-850 hover:bg-slate-900/80 text-gray-300'
                  } ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  <div className={`p-2 rounded-lg ${
                    isActive(item.path) ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-900 text-gray-400'
                  }`}>
                    <item.icon className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-white">{item.name}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{item.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Navigation Bar */}
      {accessMode !== 'employee' && (
        <nav className="fixed bottom-0 left-0 right-0 h-16 glass-nav z-40 flex items-center justify-around px-2 shadow-2xl">
          {mainTabs.map((tab) => {
            const Icon = tab.icon
            const active = isActive(tab.path)
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all min-h-[48px] ${
                  active ? 'text-indigo-400 scale-105' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-semibold tracking-wide">{tab.name}</span>
              </Link>
            )
          })}

          {/* More Tab */}
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all min-h-[48px] ${
              showMoreMenu || moreItems.some(i => isActive(i.path))
                ? 'text-indigo-400 scale-105'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Menu className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-semibold tracking-wide flex items-center gap-0.5">
              {t('nav.settings')} <ChevronUp className="w-3 h-3" />
            </span>
          </button>
        </nav>
      )}

      {/* Floating Chat Bubble Button: Fixed 80px above bottom nav */}
      {accessMode !== 'employee' && (
        <button
          onClick={() => setChatOpen(true)}
          style={{ bottom: '80px' }}
          className={`fixed p-3.5 bg-gradient-to-tr from-indigo-600 to-violet-500 hover:from-indigo-505 hover:to-violet-405 text-white rounded-full shadow-xl hover:scale-105 transition-all z-40 shadow-indigo-600/20 border border-indigo-400/25 min-h-[48px] min-w-[48px] flex items-center justify-center ${
            isRTL ? 'left-5' : 'right-5'
          }`}
        >
          <MessageSquare className="w-5.5 h-5.5" />
        </button>
      )}

      {/* AI Assistant Drawer Component */}
      {chatOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setChatOpen(false)}>
          <div
            className="w-full max-w-md bg-slate-900 border-t border-slate-800 rounded-t-2xl shadow-2xl flex flex-col max-h-[70vh] h-[550px] relative z-50 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-850">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
                  <Bot className="w-4.5 h-4.5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-xs">{t('forecast.title')}</h3>
                  <span className="text-[9px] text-emerald-400 flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-emerald-400 animate-ping" /> Online
                  </span>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-gray-500 hover:text-white hover:bg-slate-855 rounded-lg transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
              {messages.map((m) => {
                const isBot = m.sender === 'bot'
                return (
                  <div key={m.id} className={`flex items-start gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}>
                    {isBot && (
                      <div className="p-1.5 bg-slate-850 border border-slate-800 rounded-lg text-gray-400 mt-0.5">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    )}
                    
                    <div className="max-w-[75%] space-y-1">
                      <div className={`p-2.5 rounded-2xl leading-relaxed whitespace-pre-line border ${
                        isBot 
                          ? 'bg-slate-900 border-slate-850 text-gray-300 rounded-tl-none' 
                          : 'bg-indigo-600 border-indigo-500/40 text-white rounded-tr-none'
                      }`}>
                        {m.text}
                      </div>
                    </div>

                    {!isBot && (
                      <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 mt-0.5">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Typing dot animations */}
              {isTyping && (
                <div className="flex items-start gap-2.5 justify-start">
                  <div className="p-1.5 bg-slate-850 border border-slate-800 rounded-lg text-gray-400 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-slate-900 border border-slate-850 p-3 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              {/* Quick Reply Chips */}
              {messages.length === 1 && !isTyping && (
                <div className="pt-2.5 space-y-2">
                  <span className="text-[10px] text-gray-500 font-bold block uppercase tracking-wider">Suggested Questions</span>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { text: 'How do I add a product?', textAr: 'كيف يمكنني إضافة منتج؟', textFr: 'Comment ajouter un produit ?' },
                      { text: 'How do I record a sale?', textAr: 'كيف يمكنني تسجيل عملية بيع؟', textFr: 'Comment enregistrer une vente ?' },
                      { text: 'Where is the forecast?', textAr: 'أين يمكنني رؤية التوقعات؟', textFr: 'Où se trouvent les prévisions ?' }
                    ].map((chip, idx) => {
                      const label = currentLang === 'ar' ? chip.textAr : currentLang === 'fr' ? chip.textFr : chip.text
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(label)}
                          className={`w-fit py-2 px-3.5 bg-slate-950/60 border border-slate-850 hover:border-slate-800 text-gray-400 hover:text-white rounded-lg text-[10.5px] transition-colors min-h-[38px] ${
                            isRTL ? 'text-right' : 'text-left'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Message Footer */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendMessage(chatInput)
              }}
              className="p-3 border-t border-slate-850 bg-slate-950/40 flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about app features..."
                className={`flex-1 bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3 text-xs text-white placeholder-gray-500 focus:outline-none min-h-[44px] ${
                  isRTL ? 'text-right' : 'text-left'
                }`}
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-3 bg-indigo-600 hover:bg-indigo-505 disabled:opacity-50 text-white rounded-xl transition-all shadow-md shadow-indigo-600/10 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            </form>

          </div>
        </div>
      )}

      {/* Global Glass-style Toast Container */}
      {toasts.length > 0 && (
        <div className="fixed top-18 left-4 right-4 z-50 pointer-events-none flex flex-col items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-300">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto glass rounded-xl p-3.5 shadow-xl max-w-sm w-full border border-indigo-500/20 text-xs flex justify-between items-center gap-3 animate-in slide-in-from-top duration-300"
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-400" />
                <span className="font-semibold text-white">{toast.message}</span>
              </div>
              {toast.action && (
                <button
                  onClick={toast.action.onClick}
                  className="bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600/25 text-indigo-400 font-extrabold px-3 py-1.5 rounded-lg transition-colors min-h-[32px] flex items-center justify-center uppercase tracking-wide text-[10px]"
                >
                  {toast.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
