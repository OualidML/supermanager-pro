import { useState, useEffect } from 'react'
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Receipt,
  Scan,
  Search,
  AlertCircle,
  Volume2,
  X,
  Sparkles,
  ShoppingBag,
  BookOpen
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { useTranslation } from 'react-i18next'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  stock: number
  sku: string
}

export default function Sales() {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [currency, setCurrency] = useState('$')
  
  // Search & Cache
  const [productsCache, setProductsCache] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  // Checkout states
  const [cart, setCart] = useState<CartItem[]>([])
  const [success, setSuccess] = useState(false)
  const [cartError, setCartError] = useState<string | null>(null)

  // Beep Audio synthesis configuration
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [audioError, setAudioError] = useState<string | null>(null)

  // Camera barcode scanner viewport configurations
  const [isScanning, setIsScanning] = useState(false)
  const [scanDeviceId, setScanDeviceId] = useState<string | null>(null)
  const [scanDevices, setScanDevices] = useState<MediaDeviceInfo[]>([])

  // Credit Tab States
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [creditCustomerName, setCreditCustomerName] = useState('')
  const [creditCustomerPhone, setCreditCustomerPhone] = useState('')
  const [creditDeposit, setCreditDeposit] = useState('')
  const [creditLoading, setCreditLoading] = useState(false)

  useEffect(() => {
    fetchInitialData()
    testAudioSynthesis()
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

      // Load products cache for suggestions & search
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('owner_id', user.id)

      setProductsCache(products || [])
    } catch (e) {
      console.error('Error fetching layout context:', e)
    }
  }

  // Synthesis test
  const testAudioSynthesis = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      if (ctx.state === 'suspended') {
        setAudioError(t('sales.beep_err'))
      }
    } catch (e) {
      setSoundEnabled(false)
    }
  }

  // Play confirmation beep synthesized on oscillator
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
      osc.frequency.value = 1000 // 1000Hz clear frequency tone
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.05) // louder max volume 0.8
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.25)
    } catch (e) {
      console.warn('Beep synthesis failed:', e)
    }
  }

  // Initialize camera scanner media devices
  const setupScannerDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(track => track.stop()) // close temp stream

      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      setScanDevices(videoDevices)

      if (videoDevices.length > 0) {
        // Default to back camera if found (helpful for phones)
        const backCamera = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'))
        setScanDeviceId(backCamera ? backCamera.deviceId : videoDevices[0].deviceId)
      }
    } catch (e) {
      console.warn('No video input devices identified on this terminal client.', e)
    }
  }

  // Launch barcode scanner engine
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
    // Enable TRY_HARDER to perform deep image scans to detect smaller barcodes
    hints.set(DecodeHintType.TRY_HARDER, true)
    
    const codeReader = new BrowserMultiFormatReader(hints)
    let active = true

    const videoElement = document.getElementById('barcode-scanner-viewport') as HTMLVideoElement
    if (!videoElement) return

    const decodeCallback = (result: any, err: any) => {
      if (!active) return
      if (result) {
        const barcodeText = result.getText()
        if (barcodeText) {
          playScanBeep()
          handleBarcodeScanned(barcodeText)
          
          // Auto close camera scan window
          setIsScanning(false)
          active = false
        }
      }
    }

    let controlsPromise: Promise<any> | null = null

    // Configure Full HD 1080p camera parameters to sharpen resolution for small targets
    const constraints: MediaStreamConstraints = {
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

  // Lookup scanned barcode in cache
  const handleBarcodeScanned = (barcode: string) => {
    setCartError(null)
    const product = productsCache.find(p => p.sku === barcode)

    if (!product) {
      setCartError(`Product not identified matching barcode: ${barcode}`)
      return
    }

    addToCart(product)
  }

  // Handle Manual query search autocomplete suggestions
  const handleSearchQueryChange = (val: string) => {
    setSearchQuery(val)
    if (!val) {
      setSearchResults([])
      return
    }

    const matches = productsCache.filter(p => 
      p.name.toLowerCase().includes(val.toLowerCase()) || 
      (p.sku && p.sku.includes(val))
    )
    setSearchResults(matches)
  }

  const addToCart = (prod: any) => {
    setCartError(null)
    if (prod.stock <= 0) {
      setCartError(`Selected item ${prod.name} has zero available stock in inventory.`)
      return
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === prod.id)
      if (existing) {
        if (existing.quantity >= prod.stock) {
          setCartError(`Cannot add more. Only ${prod.stock} units available in stock.`)
          return prev
        }
        return prev.map(item => item.id === prod.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, {
        id: prod.id,
        name: prod.name,
        price: parseFloat(prod.price),
        quantity: 1,
        stock: prod.stock,
        sku: prod.sku
      }]
    })
  }

  const updateQuantity = (id: string, delta: number) => {
    setCartError(null)
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const nextQty = item.quantity + delta
        if (nextQty > item.stock) {
          setCartError(`Cannot exceed stock limit of ${item.stock} units.`)
          return item
        }
        return nextQty > 0 ? { ...item, quantity: nextQty } : item
      }
      return item
    }).filter(item => item.quantity > 0))
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const clearCart = () => {
    setCart([])
    setCartError(null)
  }

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0)
  const tax = subtotal * 0.0825 // 8.25% mock VAT tax
  const total = subtotal + tax

  // Complete checkout sale
  const handleCheckout = async () => {
    if (cart.length === 0) return
    setLoading(true)
    setCartError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user session found.')

      // 1. Log transaction items to 'sales' table
      const salesEntries = cart.map(item => ({
        owner_id: user.id,
        product_id: item.id,
        quantity: item.quantity,
        price_at_sale: item.price,
        total_price: item.price * item.quantity
      }))

      const { error: salesErr } = await supabase
        .from('sales')
        .insert(salesEntries)

      if (salesErr) throw salesErr

      // 2. Decrement stock inventory quantities
      await Promise.all(cart.map(item => {
        const nextStock = Math.max(0, item.stock - item.quantity)
        return supabase
          .from('products')
          .update({ stock: nextStock })
          .eq('id', item.id)
      }))

      // 3. Clear checkout cart and show success animation
      setLoading(false)
      setSuccess(true)
      clearCart()

      // Dispatch Success Toast
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Sale registered successfully!', type: 'success' }
      }))

      // Reload products list cache
      fetchInitialData()

      setTimeout(() => {
        setSuccess(false)
      }, 2500)
    } catch (e: any) {
      setLoading(false)
      setCartError(e.message || 'An error occurred while saving your transaction.')
    }
  }

  // Credit sales checkout
  const handleCreditCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!creditCustomerName.trim()) return
    setCartError(null)
    setCreditLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user session found.')

      const totalVal = total
      const depositVal = parseFloat(creditDeposit) || 0

      // 1. Create text items summary
      const summary = cart.map(item => `${item.quantity}x ${item.name} (${currency}${item.price.toFixed(2)})`).join(', ')

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
        detail: { message: 'Credit transaction logged successfully!', type: 'success' }
      }))

      // Reload products list cache
      fetchInitialData()

      setTimeout(() => {
        setSuccess(false)
      }, 2500)

    } catch (err: any) {
      setCreditLoading(false)
      setCartError(err.message || 'An error occurred while saving your credit transaction.')
    }
  }

  const isRTL = i18n.language === 'ar'

  return (
    <div className="space-y-6 pb-20 relative">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-400" /> {t('sales.title')}
          </h2>
          <p className="text-xs text-gray-400 font-medium">Scan EAN-13 barcodes or use manual lookups to checkout items.</p>
        </div>

        <button
          onClick={() => setIsScanning(true)}
          className="bg-indigo-600 hover:bg-indigo-505 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2 text-xs"
        >
          <Scan className="w-4 h-4" /> Scan & Sell (Camera)
        </button>
      </div>

      {cartError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3.5 text-red-400 flex items-start gap-2 text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{cartError}</span>
        </div>
      )}

      {audioError && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-amber-400 flex items-center gap-2 text-[10px]">
          <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{audioError}</span>
        </div>
      )}

      {/* Main Layout panels: Form lookup left, Cart summary right */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Lookup left */}
        <div className="md:col-span-2 space-y-4">
          
          {/* Manual Search lookup card */}
          <div className="glass rounded-xl p-4 shadow-lg border border-slate-900/60 space-y-3">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Lookup Product</label>
            <div className="relative text-xs">
              <Search className={`absolute top-3 w-4 h-4 text-gray-500 ${isRTL ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchQueryChange(e.target.value)}
                placeholder={t('sales.search_placeholder')}
                className={`w-full bg-slate-950 border border-slate-850 rounded-lg py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 text-xs ${
                  isRTL ? 'pl-4 pr-9 text-right' : 'pl-9 pr-4 text-left'
                }`}
              />
            </div>

            {/* Suggestions list */}
            {searchResults.length > 0 && (
              <div className="border border-slate-850 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-850/60 bg-slate-950/60 text-xs">
                {searchResults.map(prod => (
                  <button
                    key={prod.id}
                    onClick={() => {
                      addToCart(prod)
                      setSearchQuery('')
                      setSearchResults([])
                    }}
                    className={`w-full p-2.5 hover:bg-slate-900 transition-all flex justify-between items-center ${
                      isRTL ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-white block">{prod.name}</span>
                      <span className="text-[10px] text-gray-500">SKU: {prod.sku || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 font-bold">{currency}{parseFloat(prod.price).toFixed(2)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        prod.stock <= prod.min_stock ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'
                      }`}>
                        {prod.stock} left
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick catalog items suggestions */}
          <div className="glass rounded-xl p-5 border border-slate-900/60 shadow-xl space-y-4">
            <h3 className="font-bold text-white text-sm">Product Quick Suggestions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {productsCache.slice(0, 6).map(prod => (
                <button
                  key={prod.id}
                  onClick={() => addToCart(prod)}
                  className="p-3 bg-slate-950/40 border border-slate-850 hover:border-slate-800 rounded-xl text-xs transition-all text-left flex flex-col justify-between h-20 hover:scale-[1.01] hover:bg-slate-900/20"
                >
                  <span className="font-bold text-white line-clamp-1 block">{prod.name}</span>
                  <div className="flex justify-between items-center w-full mt-2">
                    <span className="text-indigo-400 font-extrabold">{currency}{parseFloat(prod.price).toFixed(2)}</span>
                    <span className="text-[9px] text-gray-500 font-semibold">{prod.stock} left</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Cart summary right */}
        <div className="glass rounded-xl p-5 shadow-xl border border-slate-900/60 flex flex-col justify-between min-h-[380px] h-fit">
          
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-850 pb-2.5">
              <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-indigo-400" /> Checkout Cart
              </h3>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-[10px] text-gray-500 hover:text-rose-400 transition-colors font-semibold">
                  Clear
                </button>
              )}
            </div>

            {/* Cart list */}
            {success ? (
              <div className="py-20 text-center space-y-3 animate-pulse">
                <div className="mx-auto w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-white text-sm">Checkout Success!</h4>
                <p className="text-[10px] text-gray-500">Sales transactions registered and stock levels synced.</p>
              </div>
            ) : cart.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="mx-auto w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-gray-600 border border-slate-850">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <p className="text-xs text-gray-500 leading-normal max-w-[200px] mx-auto">
                  {t('sales.cart_empty')}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-2.5 rounded-lg bg-slate-950/40 border border-slate-850 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-bold text-white block">{item.name}</span>
                      <span className="text-[10px] text-gray-500 block">{currency}{item.price.toFixed(2)} / unit</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-slate-950 border border-slate-850 rounded-lg overflow-hidden p-0.5">
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-slate-900 text-gray-400 hover:text-white rounded">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 font-mono text-white text-xs">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-slate-900 text-gray-400 hover:text-white rounded">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-gray-500 hover:text-rose-400 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing calculations */}
          <div className="border-t border-slate-850 pt-4 mt-4 space-y-3 text-xs">
            <div className="flex justify-between items-center text-gray-400">
              <span>{t('sales.subtotal')}</span>
              <span className="font-mono text-white">{currency}{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-400">
              <span>{t('sales.tax')}</span>
              <span className="font-mono text-white">{currency}{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-850 pt-2 text-sm font-extrabold text-white">
              <span>{t('sales.total')}</span>
              <span className="font-mono text-indigo-400">{currency}{total.toFixed(2)}</span>
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setShowCreditModal(true)}
                disabled={loading || cart.length === 0}
                className="flex-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 disabled:opacity-50 text-gray-300 font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs min-h-[48px]"
              >
                <BookOpen className="w-4 h-4 text-indigo-400" /> On Credit
              </button>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={loading || cart.length === 0}
                className="flex-1 bg-indigo-600 hover:bg-indigo-505 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/15 flex items-center justify-center gap-1.5 min-h-[48px] text-xs"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </>
                ) : (
                  <>
                    <span>{t('sales.btn_checkout')}</span>
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Barcode scan camera modal overlay */}
      {isScanning && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-2xl p-5 shadow-2xl space-y-4 relative">
            
            <button
              onClick={() => setIsScanning(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Scan className="w-4.5 h-4.5 text-indigo-400" /> Barcode Camera Viewport
              </h3>
              <p className="text-[10px] text-gray-500">Position the EAN-13 barcode inside the align brackets.</p>
            </div>

            {/* Viewfinder window */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800 shadow-inner flex items-center justify-center">
              <video
                id="barcode-scanner-viewport"
                className="w-full h-full object-cover"
                playsInline
              />

              {/* Align brackets overlay */}
              <div className="absolute inset-8 border border-indigo-500/20 rounded-lg pointer-events-none">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-indigo-400" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-indigo-400" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-indigo-400" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-indigo-400" />
                
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
      {/* Credit Details Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-2xl p-5 shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowCreditModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-850 pb-2.5">
              <BookOpen className="w-4.5 h-4.5 text-indigo-400" /> Record Store Credit Sale
            </h3>

            <form onSubmit={handleCreditCheckout} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-semibold">Customer Name (Required)</label>
                <input
                  type="text"
                  required
                  value={creditCustomerName}
                  onChange={(e) => setCreditCustomerName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-white min-h-[48px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-semibold">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={creditCustomerPhone}
                  onChange={(e) => setCreditCustomerPhone(e.target.value)}
                  placeholder="e.g. +1 555-0199"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-white min-h-[48px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-semibold">Initial Cash Deposit (Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={creditDeposit}
                  onChange={(e) => setCreditDeposit(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-white min-h-[48px]"
                />
              </div>

              <div className="bg-slate-950/40 border border-slate-850 rounded-lg p-3 text-[11px] text-gray-400 space-y-1.5">
                <div className="flex justify-between">
                  <span>Cart Total:</span>
                  <span className="font-mono text-white">{currency}{total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Outstanding Debt:</span>
                  <span className="font-mono text-rose-400">
                    {currency}{(total - (parseFloat(creditDeposit) || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreditModal(false)}
                  className="flex-1 bg-slate-900 hover:bg-slate-850 text-gray-300 py-2 rounded-lg font-bold min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creditLoading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-505 disabled:opacity-50 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 min-h-[48px]"
                >
                  {creditLoading ? (
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Save to Ledger <CheckCircle2 className="w-4 h-4" />
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
