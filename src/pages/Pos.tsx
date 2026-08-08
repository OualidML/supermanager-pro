import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scan,
  Minus,
  Plus,
  Trash2,
  LogOut,
  ShoppingBag,
  Check,
  AlertCircle,
  Volume2,
  X,
  Sparkles,
  Receipt
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { useTranslation } from 'react-i18next'
import { useAccessMode } from '../contexts/AccessModeContext'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  stock: number
  sku: string
}

export default function Pos() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { accessMode, setAccessMode } = useAccessMode()
  
  // Guard route on mount
  useEffect(() => {
    if (accessMode !== 'employee') {
      navigate('/login', { replace: true })
    }
  }, [accessMode, navigate])

  const [loading, setLoading] = useState(false)
  const [currency, setCurrency] = useState('$')
  const [productsCache, setProductsCache] = useState<any[]>([])
  
  // Cart states
  const [cart, setCart] = useState<CartItem[]>([])
  const [success, setSuccess] = useState(false)
  const [cartError, setCartError] = useState<string | null>(null)

  // Credit Checkout states
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [creditCustomerName, setCreditCustomerName] = useState('')
  const [creditCustomerPhone, setCreditCustomerPhone] = useState('')
  const [creditDeposit, setCreditDeposit] = useState('')
  const [creditLoading, setCreditLoading] = useState(false)

  // Scanner states
  const [isScanning, setIsScanning] = useState(false)
  const [scanDeviceId, setScanDeviceId] = useState<string | null>(null)
  const [scanDevices, setScanDevices] = useState<MediaDeviceInfo[]>([])

  // Audio beep
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [audioError, setAudioError] = useState<string | null>(null)

  useEffect(() => {
    fetchInitialData()
    setupScannerDevices()
  }, [])

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load currency details
      const { data: profile } = await supabase
        .from('store_profiles')
        .select('currency')
        .eq('owner_id', user.id)
        .limit(1)

      if (profile && profile.length > 0) {
        setCurrency(profile[0].currency || '$')
      }

      // Load products cache for suggestions & search - ONLY show_to_employee = true
      const { data: products } = await supabase
        .from('products')
        .select('id, name, selling_price, stock, sku')
        .eq('owner_id', user.id)
        .eq('show_to_employee', true)

      setProductsCache(products || [])
    } catch (e) {
      console.error('Error fetching POS data:', e)
    }
  }

  // Setup scanner cameras
  const setupScannerDevices = async () => {
    try {
      const videoDevices = await BrowserMultiFormatReader.listVideoInputDevices()
      setScanDevices(videoDevices)

      if (videoDevices.length > 0) {
        const backCamera = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'))
        setScanDeviceId(backCamera ? backCamera.deviceId : videoDevices[0].deviceId)
      }
    } catch (e) {
      console.warn('No video input devices identified.', e)
    }
  }

  // Synthesis beep sound
  const playScanBeep = () => {
    if (!soundEnabled) return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      if (ctx.state === 'suspended') {
        ctx.resume()
      }
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'triangle'
      osc.frequency.value = 1000
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.25)
    } catch (e) {
      console.warn('Beep failed:', e)
    }
  }

  // Scanner hook
  useEffect(() => {
    if (!isScanning) return
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E
    ])
    hints.set(DecodeHintType.TRY_HARDER, true)

    const codeReader = new BrowserMultiFormatReader(hints)
    let active = true

    const videoElement = document.getElementById('pos-scanner-viewport') as HTMLVideoElement
    if (!videoElement) return

    const decodeCallback = (result: any) => {
      if (!active) return
      if (result) {
        const barcodeText = result.getText()
        if (barcodeText) {
          playScanBeep()
          handleBarcodeScanned(barcodeText)
          setIsScanning(false)
          active = false
        }
      }
    }

    let controlsPromise: Promise<any> | null = null

    const constraints = {
      video: {
        deviceId: scanDeviceId ? { exact: scanDeviceId } : undefined,
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    }

    controlsPromise = codeReader.decodeFromConstraints(constraints, videoElement, decodeCallback)

    return () => {
      active = false
      if (controlsPromise) {
        controlsPromise.then(c => c.stop()).catch(e => console.warn(e))
      }
    }
  }, [isScanning, scanDeviceId])

  const handleBarcodeScanned = (barcode: string) => {
    setCartError(null)
    const product = productsCache.find(p => p.sku === barcode)

    if (!product) {
      setCartError(getTranslation('err_not_found') + `: ${barcode}`)
      return
    }

    addToCart(product)
  }

  const handleBarcodeScannedRef = useRef(handleBarcodeScanned)
  useEffect(() => {
    handleBarcodeScannedRef.current = handleBarcodeScanned
  }, [handleBarcodeScanned])

  // Global keypress listener interceptor for hardware barcode scanners
  useEffect(() => {
    let buffer = ''
    let lastKeyTime = Date.now()

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      if (activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.tagName === 'SELECT' ||
        activeEl.getAttribute('contenteditable') === 'true'
      )) {
        return
      }

      const currentTime = Date.now()
      if (currentTime - lastKeyTime > 50) {
        buffer = ''
      }
      lastKeyTime = currentTime

      if (e.key.length === 1) {
        buffer += e.key
      } else if (e.key === 'Enter') {
        if (buffer.trim().length >= 3) {
          e.preventDefault()
          handleBarcodeScannedRef.current(buffer.trim())
        }
        buffer = ''
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [])

  const addToCart = (prod: any) => {
    setCartError(null)
    if (prod.stock <= 0) {
      setCartError(getTranslation('err_out_of_stock'))
      return
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === prod.id)
      if (existing) {
        if (existing.quantity >= prod.stock) {
          setCartError(getTranslation('err_stock_limit') + `: ${prod.stock}`)
          return prev
        }
        return prev.map(item =>
          item.id === prod.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      } else {
        return [...prev, {
          id: prod.id,
          name: prod.name,
          price: parseFloat(prod.selling_price) || 0,
          quantity: 1,
          stock: prod.stock,
          sku: prod.sku
        }]
      }
    })
  }

  const updateQuantity = (id: string, delta: number) => {
    setCartError(null)
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const nextQty = item.quantity + delta
          if (nextQty <= 0) return item
          if (nextQty > item.stock) {
            setCartError(getTranslation('err_stock_limit') + `: ${item.stock}`)
            return item
          }
          return { ...item, quantity: nextQty }
        }
        return item
      })
    })
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const clearCart = () => {
    setCart([])
  }

  const handleCompleteSale = async () => {
    if (cart.length === 0) return
    setLoading(true)
    setCartError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthenticated session.')

      // Insert employee sales records
      const salesEntries = cart.map(item => ({
        owner_id: user.id,
        product_id: item.id,
        quantity: item.quantity,
        price_at_sale: item.price,
        total_price: item.price * item.quantity,
        recorded_by: 'employee'
      }))

      const { error: salesErr } = await supabase
        .from('sales')
        .insert(salesEntries)

      if (salesErr) throw salesErr

      // Decrement stock levels
      await Promise.all(cart.map(item => {
        const nextStock = Math.max(0, item.stock - item.quantity)
        return supabase
          .from('products')
          .update({ stock: nextStock })
          .eq('id', item.id)
      }))

      setSuccess(true)
      clearCart()

      // Toast dispatch
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Sale completed successfully by employee!', type: 'success' }
      }))

      fetchInitialData()

      setTimeout(() => {
        setSuccess(false)
      }, 2000)

    } catch (e: any) {
      setCartError(e.message || 'Complete sale operation failed.')
    } finally {
      setLoading(false)
    }
  }

  // Credit sales checkout for employees
  const handleCreditCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!creditCustomerName.trim()) return
    setCartError(null)
    setCreditLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user session found.')

      const totalVal = subtotal
      const depositVal = parseFloat(creditDeposit) || 0

      // 1. Create serialized items & initial payments summary JSON
      const summary = JSON.stringify({
        products: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        payments: [
          {
            amount: depositVal,
            date: new Date().toISOString()
          }
        ]
      })

      // 2. Insert into customer_debts table
      const { error: debtErr } = await supabase
        .from('customer_debts')
        .insert([{
          owner_id: user.id,
          customer_name: creditCustomerName,
          customer_phone: creditCustomerPhone || null,
          items_summary: summary,
          total_amount: totalVal,
          amount_paid: depositVal,
          status: depositVal >= totalVal ? 'paid' : depositVal > 0 ? 'partially_paid' : 'unpaid'
        }])

      if (debtErr) throw debtErr

      // 3. Decrement stock inventory quantities
      await Promise.all(cart.map(item => {
        const nextStock = Math.max(0, item.stock - item.quantity)
        return supabase
          .from('products')
          .update({ stock: nextStock })
          .eq('id', item.id)
      }))

      // 4. Success cleanup
      setCreditLoading(false)
      setShowCreditModal(false)
      setCreditCustomerName('')
      setCreditCustomerPhone('')
      setCreditDeposit('')
      setSuccess(true)
      clearCart()

      // Dispatch Success Toast
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Credit sale registered successfully by employee!', type: 'success' }
      }))

      // Reload products list cache
      fetchInitialData()

      setTimeout(() => {
        setSuccess(false)
      }, 2500)

    } catch (err: any) {
      setCreditLoading(false)
      setCartError(err.message || 'Credit checkout failed.')
    }
  }

  const handleExitEmployeeMode = () => {
    setAccessMode('owner')
    navigate('/login?exit=true')
  }

  // Simple translations mapping helper
  const getTranslation = (key: string) => {
    const lang = i18n.language || 'en'
    const bundle: Record<string, Record<string, string>> = {
      en: {
        badge: 'Employee Mode',
        scan_btn: 'SCAN PRODUCT BARCODE',
        complete_btn: 'COMPLETE SALE',
        exit_btn: 'EXIT',
        empty: 'Scan product barcode with the button above to register a sale.',
        total: 'Total Amount',
        err_not_found: 'Product not found matching barcode',
        err_out_of_stock: 'Item is out of stock in inventory.',
        err_stock_limit: 'Cannot exceed available stock count',
        success_title: 'Checkout Completed!',
        success_desc: 'Sale registered and stock levels updated.'
      },
      fr: {
        badge: 'Mode Employé',
        scan_btn: 'SCANNER CODE-BARRES',
        complete_btn: 'TERMINER LA VENTE',
        exit_btn: 'QUITTER',
        empty: 'Scannez le code-barres d\'un produit pour commencer la vente.',
        total: 'Total',
        err_not_found: 'Produit non identifié avec le code-barres',
        err_out_of_stock: 'L\'article est en rupture de stock.',
        err_stock_limit: 'Impossible de dépasser le stock disponible',
        success_title: 'Vente Terminée!',
        success_desc: 'Vente enregistrée et niveaux de stock mis à jour.'
      },
      ar: {
        badge: 'وضع الموظف',
        scan_btn: 'مسح الرمز الشريطي',
        complete_btn: 'إتمام البيع',
        exit_btn: 'خروج',
        empty: 'امسح الرمز الشريطي للمنتج لبدء عملية البيع.',
        total: 'الإجمالي',
        err_not_found: 'المنتج غير موجود بترميز',
        err_out_of_stock: 'المنتج غير متوفر في المخزون الحالي.',
        err_stock_limit: 'لا يمكن تجاوز الكمية المتوفرة في المخزون',
        success_title: 'تم إتمام البيع بنجاح!',
        success_desc: 'تم تسجيل المبيعات وتحديث مستويات المخزون.'
      }
    }
    return bundle[lang]?.[key] || bundle['en'][key]
  }

  const isRTL = i18n.language === 'ar'
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  if (accessMode !== 'employee') {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-4 sm:p-6 space-y-6 relative select-none">
      
      {/* Top Header Row */}
      <div className={`flex justify-between items-center ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="flex items-center gap-3">
          <span className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse" />
            {getTranslation('badge')}
          </span>
        </div>

        {/* Small Exit Button (Top Right) */}
        <button
          type="button"
          onClick={handleExitEmployeeMode}
          className="h-12 w-28 bg-slate-900 hover:bg-slate-800 text-amber-500 border border-slate-800 hover:border-amber-500/30 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs active:scale-95 shadow-md shadow-black/40 min-h-[48px]"
        >
          <LogOut className="w-4 h-4" /> {getTranslation('exit_btn')}
        </button>
      </div>

      {cartError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 flex items-start gap-2.5 text-xs animate-bounce">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{cartError}</span>
        </div>
      )}

      {/* Large 120px tall Scan Button */}
      <button
        type="button"
        onClick={() => setIsScanning(true)}
        className="w-full h-[120px] bg-gradient-to-tr from-amber-500 to-[#d97706] hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-2xl shadow-amber-500/10"
      >
        <Scan className="w-10 h-10 stroke-[2.5]" />
        <span className="text-sm font-extrabold tracking-wider">{getTranslation('scan_btn')}</span>
      </button>

      {/* Running Transaction list / Cart */}
      <div className="flex-1 glass border border-slate-900/60 rounded-2xl p-5 shadow-xl flex flex-col min-h-[250px] overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-850 pb-3 mb-4">
          <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
            <ShoppingBag className="w-4.5 h-4.5 text-amber-500" /> Current Cart
          </h3>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-[10px] text-gray-500 hover:text-rose-400 font-semibold p-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {success ? (
            <div className="py-14 text-center space-y-3 animate-pulse">
              <div className="mx-auto w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                <Check className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-white text-sm">{getTranslation('success_title')}</h4>
              <p className="text-[10px] text-gray-500">{getTranslation('success_desc')}</p>
            </div>
          ) : cart.length === 0 ? (
            <div className="py-20 text-center text-xs text-gray-500 leading-normal max-w-xs mx-auto">
              {getTranslation('empty')}
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-950/40 border border-slate-850 text-xs">
                
                {/* Selling info only (masking cost price) */}
                <div className="space-y-0.5">
                  <span className="font-extrabold text-white text-sm block">{item.name}</span>
                  <span className="text-[10px] text-gray-500 block font-mono">
                    {currency}{item.price.toFixed(2)} × {item.quantity} = <strong className="text-white">{currency}{(item.price * item.quantity).toFixed(2)}</strong>
                  </span>
                </div>

                {/* Extra Large 80px Glove-friendly Controls */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden p-1 gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-20 h-20 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white rounded-xl flex items-center justify-center text-gray-400 font-bold active:scale-90 transition-all min-h-[48px] min-w-[48px]"
                    >
                      <Minus className="w-6 h-6" />
                    </button>
                    
                    <span className="px-3 font-mono text-white text-lg font-bold w-8 text-center">{item.quantity}</span>
                    
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-20 h-20 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white rounded-xl flex items-center justify-center text-gray-400 font-bold active:scale-90 transition-all min-h-[48px] min-w-[48px]"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center active:scale-90 transition-all min-h-[48px] min-w-[48px]"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                </div>

              </div>
            ))
          )}
        </div>

        {/* Total Summary */}
        <div className="border-t border-slate-850 pt-4 mt-4 space-y-4">
          <div className="flex justify-between items-center text-gray-400 text-xs">
            <span>{getTranslation('total')}</span>
            <span className="font-extrabold text-2xl text-amber-500 font-mono">{currency}{subtotal.toFixed(2)}</span>
          </div>

          {/* Checkout Action Buttons Grid (Cash vs Credit) */}
          <div className="grid grid-cols-2 gap-4">
            {/* On Credit Button */}
            <button
              type="button"
              onClick={() => setShowCreditModal(true)}
              disabled={loading || cart.length === 0}
              className="h-20 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-extrabold rounded-2xl transition-all shadow-xl shadow-amber-600/10 flex items-center justify-center gap-2 text-sm select-none active:scale-[0.98] min-h-[48px]"
            >
              <Receipt className="w-6 h-6 stroke-[2.5]" />
              <span className="tracking-wider">{t('debts.btn_on_credit')}</span>
            </button>

            {/* Large COMPLETE SALE Button */}
            <button
              type="button"
              onClick={handleCompleteSale}
              disabled={loading || cart.length === 0}
              className="h-20 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold rounded-2xl transition-all shadow-xl shadow-emerald-600/10 flex items-center justify-center gap-2 text-sm select-none active:scale-[0.98] min-h-[48px]"
            >
              {loading ? (
                <span className="h-6 w-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-6 h-6 stroke-[3]" />
                  <span className="tracking-wider">{getTranslation('complete_btn')}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Barcode scan camera modal overlay */}
      {isScanning && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-2xl p-5 shadow-2xl space-y-4 relative">
            
            <button
              onClick={() => setIsScanning(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Scan className="w-4.5 h-4.5 text-amber-500" /> Barcode Camera Viewport
              </h3>
              <p className="text-[10px] text-gray-500">Position the product barcode inside the align brackets.</p>
            </div>

            {/* Viewfinder window */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800 shadow-inner flex items-center justify-center">
              <video
                id="pos-scanner-viewport"
                className="w-full h-full object-cover"
                playsInline
              />

              {/* Align brackets overlay */}
              <div className="absolute inset-8 border border-amber-500/20 rounded-lg pointer-events-none">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-amber-500" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-amber-500" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-amber-500" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-amber-500" />
                
                {/* Laser scan line */}
                <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-rose-500 shadow-md shadow-rose-500/40 animate-pulse" />
              </div>
            </div>

            {/* Device select dropdown */}
            {scanDevices.length > 1 && (
              <div className="space-y-1 text-xs">
                <label className="text-gray-400 font-semibold">Active Camera Source</label>
                <select
                  value={scanDeviceId || ''}
                  onChange={(e) => setScanDeviceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none"
                >
                  {scanDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</option>
                  ))}
                </select>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Credit Sale Modal Dialog */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-2xl space-y-4 relative">
            
            <button
              onClick={() => setShowCreditModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-500" /> {t('debts.credit_sale_title')}
              </h3>
              <p className="text-[10px] text-gray-500">Record customer credentials to save this sale transaction on credit.</p>
            </div>

            <form onSubmit={handleCreditCheckout} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-semibold">{t('debts.customer_name')}</label>
                <input
                  type="text"
                  required
                  value={creditCustomerName}
                  onChange={(e) => setCreditCustomerName(e.target.value)}
                  placeholder={t('debts.name_placeholder')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500 min-h-[48px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-semibold">{t('debts.customer_phone')}</label>
                <input
                  type="tel"
                  value={creditCustomerPhone}
                  onChange={(e) => setCreditCustomerPhone(e.target.value)}
                  placeholder={t('debts.phone_placeholder')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500 min-h-[48px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-semibold">{t('debts.upfront_payment')} ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  value={creditDeposit}
                  onChange={(e) => setCreditDeposit(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500 min-h-[48px]"
                />
              </div>

              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs font-mono">
                <span className="text-gray-400">{t('debts.total_label')}</span>
                <span className="text-white font-extrabold text-sm">{currency}{subtotal.toFixed(2)}</span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreditModal(false)}
                  className="flex-1 bg-slate-950 border border-slate-800 text-gray-300 py-3 rounded-xl font-bold min-h-[48px]"
                >
                  {t('inventory.btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creditLoading}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-slate-950 py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 min-h-[48px] disabled:opacity-50"
                >
                  {creditLoading ? (
                    <span className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      {t('debts.btn_confirm_credit')}
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
