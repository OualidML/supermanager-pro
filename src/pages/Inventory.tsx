import { useState, useEffect } from 'react'
import {
  Package,
  Search,
  Filter,
  AlertTriangle,
  Plus,
  RotateCcw,
  CheckCircle2,
  X,
  Scan,
  TrendingUp,
  DollarSign,
  Barcode,
  Layers,
  Sparkles,
  ArrowUpRight,
  Volume2,
  Upload,
  Eye
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { useTranslation } from 'react-i18next'

interface ProductItem {
  id: string
  name: string
  sku: string
  stock: number
  min_stock: number
  price: number
  wholesale_price: number | null
  special_price: number | null
  expiration_date: string | null
  warehouse_location: string | null
  category: string
  costPrice: number
  profitMargin: number
  show_to_employee: boolean
}

export default function Inventory() {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('$')
  const [successMsg, setSuccessMsg] = useState('')
  const [dbError, setDbError] = useState<string | null>(null)

  // Products state
  const [products, setProducts] = useState<ProductItem[]>([])
  const [categories, setCategories] = useState<string[]>([])

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRestockModal, setShowRestockModal] = useState(false)
  const [targetProduct, setTargetProduct] = useState<ProductItem | null>(null)

  // Add/Edit Product Form inputs
  const [newName, setNewName] = useState('')
  const [newSku, setNewSku] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newCost, setNewCost] = useState('')
  const [newStock, setNewStock] = useState('')
  const [newMinStock, setNewMinStock] = useState('')
  const [newCategory, setNewCategory] = useState('General')
  const [newWholesalePrice, setNewWholesalePrice] = useState('')
  const [newSpecialPrice, setNewSpecialPrice] = useState('')
  const [newExpirationDate, setNewExpirationDate] = useState('')
  const [newWarehouseLocation, setNewWarehouseLocation] = useState('')

  // Restock Form inputs
  const [restockQty, setRestockQty] = useState('')
  const [restockCost, setRestockCost] = useState('')

  // Scanner state inside Add Modal
  const [isScanning, setIsScanning] = useState(false)
  const [scanDeviceId, setScanDeviceId] = useState<string | null>(null)
  const [scanDevices, setScanDevices] = useState<MediaDeviceInfo[]>([])
  const [soundEnabled] = useState(true)

  useEffect(() => {
    fetchInventory()
    setupScannerDevices()
  }, [])

  const fetchInventory = async () => {
    try {
      setLoading(true)
      setDbError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Load currency details
      const { data: profile } = await supabase
        .from('store_profiles')
        .select('currency')
        .eq('owner_id', user.id)
        .limit(1)

      if (profile && profile.length > 0) {
        setCurrency(profile[0].currency || '$')
      }

      // Load products list
      const { data: prods, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('owner_id', user.id)
        .order('name', { ascending: true })

      if (prodErr) throw prodErr

      // Load cost histories from stock_inputs
      const { data: costLogs, error: costErr } = await supabase
        .from('stock_inputs')
        .select('*')
        .eq('owner_id', user.id)

      if (costErr) throw costErr

      // Map product latest cost price
      const sortedCosts = [...(costLogs || [])].sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      )

      const productCostMap: Record<string, number> = {}
      sortedCosts.forEach(c => {
        productCostMap[c.product_id] = parseFloat(c.cost_price)
      })

      // Map dynamic metrics
      const mappedProducts: ProductItem[] = (prods || []).map(p => {
        const cost = productCostMap[p.id] || 0
        const sellPrice = parseFloat(p.price)
        const profitMargin = sellPrice > 0 ? ((sellPrice - cost) / sellPrice) * 100 : 0
        
        return {
          id: p.id,
          name: p.name,
          sku: p.sku || '',
          stock: p.stock,
          min_stock: p.min_stock,
          price: sellPrice,
          wholesale_price: p.wholesale_price ? parseFloat(p.wholesale_price) : null,
          special_price: p.special_price ? parseFloat(p.special_price) : null,
          expiration_date: p.expiration_date || null,
          warehouse_location: p.warehouse_location || null,
          category: p.category || 'General',
          costPrice: cost,
          profitMargin: parseFloat(profitMargin.toFixed(1)),
          show_to_employee: p.show_to_employee ?? true
        }
      })

      setProducts(mappedProducts)

      // Compile unique categories list
      const uniqueCats = Array.from(new Set(mappedProducts.map(p => p.category)))
      setCategories(['All', ...uniqueCats])

      setLoading(false)
    } catch (err: any) {
      console.error(err)
      setDbError(err.message || 'Error occurred compiling inventory database.')
      setLoading(false)
    }
  }

  // Barcode Beep synthesize oscillator
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

  // Setup media devices for modal scanner
  const setupScannerDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(track => track.stop())

      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      setScanDevices(videoDevices)

      if (videoDevices.length > 0) {
        const backCamera = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'))
        setScanDeviceId(backCamera ? backCamera.deviceId : videoDevices[0].deviceId)
      }
    } catch (e) {
      console.warn('Camera setup failed for inventory scanner:', e)
    }
  }

  // ZXing hook inside modal
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

    const videoElement = document.getElementById('inventory-scanner-viewport') as HTMLVideoElement
    if (!videoElement) return

    const decodeCallback = (result: any) => {
      if (!active) return
      if (result) {
        const barcodeText = result.getText()
        if (barcodeText) {
          playScanBeep()
          setNewSku(barcodeText)
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

  // Save new product record
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setDbError(null)

    if (!newName || !newPrice || !newCost || !newStock || !newMinStock) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user session found.')

      const parsedPrice = parseFloat(newPrice)
      const parsedCost = parseFloat(newCost)
      const parsedStock = parseInt(newStock)
      const parsedMinStock = parseInt(newMinStock)

      // 1. Insert product record
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .insert([{
          owner_id: user.id,
          name: newName,
          sku: newSku || null,
          price: parsedPrice,
          stock: parsedStock,
          min_stock: parsedMinStock,
          category: newCategory,
          wholesale_price: parseFloat(newWholesalePrice) || null,
          special_price: parseFloat(newSpecialPrice) || null,
          expiration_date: newExpirationDate || null,
          warehouse_location: newWarehouseLocation || null
        }])
        .select()

      if (prodErr) throw prodErr

      // 2. Insert cost history in stock_inputs
      if (prodData && prodData.length > 0) {
        const { error: costErr } = await supabase
          .from('stock_inputs')
          .insert([{
            owner_id: user.id,
            product_id: prodData[0].id,
            quantity: parsedStock,
            cost_price: parsedCost
          }])

        if (costErr) throw costErr
      }

      setSuccessMsg('Product added successfully to inventory.')
      setShowAddModal(false)

      // Dispatch Success Toast
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Product added successfully!', type: 'success' }
      }))

      // Reset form fields
      setNewName('')
      setNewSku('')
      setNewPrice('')
      setNewCost('')
      setNewStock('')
      setNewMinStock('')
      setNewCategory('General')
      setNewWholesalePrice('')
      setNewSpecialPrice('')
      setNewExpirationDate('')
      setNewWarehouseLocation('')

      fetchInventory()
      setTimeout(() => setSuccessMsg(''), 2500)
    } catch (err: any) {
      setDbError(err.message || 'Failed to save product.')
    }
  }

  const handleToggleEmployeeVisibility = async (productId: string, currentVal: boolean) => {
    const newVal = !currentVal
    
    // Optimistic UI update
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, show_to_employee: newVal } : p))

    try {
      const { error } = await supabase
        .from('products')
        .update({ show_to_employee: newVal })
        .eq('id', productId)

      if (error) throw error

      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: `Product visibility updated!`, type: 'success' }
      }))
    } catch (e: any) {
      // Revert UI on failure
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, show_to_employee: currentVal } : p))
      console.error('Failed to update employee visibility:', e)
    }
  }

  // Restock batch
  const handleRestockProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setDbError(null)

    if (!targetProduct || !restockQty || !restockCost) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user session found.')

      const parsedQty = parseInt(restockQty)
      const parsedCost = parseFloat(restockCost)

      // 1. Log restock details in stock_inputs
      const { error: logErr } = await supabase
        .from('stock_inputs')
        .insert([{
          owner_id: user.id,
          product_id: targetProduct.id,
          quantity: parsedQty,
          cost_price: parsedCost
        }])

      if (logErr) throw logErr

      // 2. Increment stock count in products
      const nextStock = targetProduct.stock + parsedQty
      const { error: prodErr } = await supabase
        .from('products')
        .update({ stock: nextStock })
        .eq('id', targetProduct.id)

      if (prodErr) throw prodErr

      setSuccessMsg(`Restocked ${targetProduct.name} with ${parsedQty} units.`)
      setShowRestockModal(false)

      // Dispatch Success Toast
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: `Restocked ${targetProduct.name} successfully!`, type: 'success' }
      }))
      setRestockQty('')
      setRestockCost('')
      setTargetProduct(null)

      fetchInventory()
      setTimeout(() => setSuccessMsg(''), 2500)
    } catch (err: any) {
      setDbError(err.message || 'Failed to log restock details.')
    }
  }

  // Handle CSV Bulk Import
  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setDbError(null)
    setSuccessMsg('Parsing and importing CSV...')

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string
          if (!text) throw new Error('File is empty.')

          const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
          if (lines.length < 2) {
            throw new Error('CSV must contain a header row and at least one data row.')
          }

          // Simple CSV line parser that respects quoted commas
          const parseCSVLine = (line: string) => {
            const result = []
            let current = ''
            let inQuotes = false
            for (let i = 0; i < line.length; i++) {
              const char = line[i]
              if (char === '"') {
                inQuotes = !inQuotes
              } else if (char === ',' && !inQuotes) {
                result.push(current.trim())
                current = ''
              } else {
                current += char
              }
            }
            result.push(current.trim())
            return result
          }

          const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/["']/g, ''))
          
          // Map headers to column indexes
          const nameIdx = headers.indexOf('name')
          const skuIdx = headers.indexOf('sku') !== -1 ? headers.indexOf('sku') : headers.indexOf('barcode')
          const priceIdx = headers.indexOf('price') !== -1 ? headers.indexOf('price') : headers.indexOf('selling_price')
          const costIdx = headers.indexOf('cost') !== -1 ? headers.indexOf('cost') : headers.indexOf('cost_price')
          const stockIdx = headers.indexOf('stock') !== -1 ? headers.indexOf('stock') : headers.indexOf('quantity')
          const minStockIdx = headers.indexOf('min_stock') !== -1 ? headers.indexOf('min_stock') : headers.indexOf('min')
          const categoryIdx = headers.indexOf('category')

          if (nameIdx === -1 || priceIdx === -1 || costIdx === -1) {
            throw new Error('CSV must contain at least "name", "price" (or "selling_price"), and "cost" (or "cost_price") columns.')
          }

          const { data: { user } } = await supabase.auth.getUser()
          if (!user) throw new Error('No user session found.')

          const productsToInsert = []
          const rawInputs: { cost: number; stock: number }[] = []

          for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i])
            if (values.length < headers.length) continue

            const name = values[nameIdx]?.replace(/["']/g, '')
            if (!name) continue

            const sku = skuIdx !== -1 ? values[skuIdx]?.replace(/["']/g, '') || null : null
            const price = parseFloat(values[priceIdx]) || 0
            const cost = parseFloat(values[costIdx]) || 0
            const stock = stockIdx !== -1 ? parseInt(values[stockIdx]) || 0 : 0
            const minStock = minStockIdx !== -1 ? parseInt(values[minStockIdx]) || 0 : 0
            const category = categoryIdx !== -1 ? values[categoryIdx]?.replace(/["']/g, '') || 'General' : 'General'

            productsToInsert.push({
              owner_id: user.id,
              name,
              sku,
              price,
              stock,
              min_stock: minStock,
              category
            })

            // Keep track of cost metadata to insert into stock_inputs later
            rawInputs.push({ cost, stock })
          }

          if (productsToInsert.length === 0) {
            throw new Error('No valid product rows identified in the CSV file.')
          }

          // 1. Bulk insert products
          const { data: insertedProds, error: prodErr } = await supabase
            .from('products')
            .insert(productsToInsert)
            .select()

          if (prodErr) throw prodErr

          // 2. Bulk insert stock inputs (costs history)
          if (insertedProds && insertedProds.length > 0) {
            const costEntries = insertedProds.map((prod, index) => ({
              owner_id: user.id,
              product_id: prod.id,
              quantity: rawInputs[index]?.stock || 0,
              cost_price: rawInputs[index]?.cost || 0
            }))

            const { error: costErr } = await supabase
              .from('stock_inputs')
              .insert(costEntries)

            if (costErr) throw costErr
          }

          setSuccessMsg(`Successfully imported ${productsToInsert.length} products!`)
          fetchInventory()
          setTimeout(() => setSuccessMsg(''), 3000)
        } catch (err: any) {
          setDbError(err.message || 'Failed to process CSV file contents.')
          setSuccessMsg('')
        }
      }
      reader.readAsText(file)
    } catch (err: any) {
      setDbError(err.message || 'Failed to read file.')
      setSuccessMsg('')
    }
  }

  // client-side filter
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.includes(searchQuery)
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory
    return matchesSearch && matchesCat
  })

  const isRTL = i18n.language === 'ar'

  return (
    <div className="space-y-6 pb-20 relative">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-400" /> {t('inventory.title')}
          </h2>
          <p className="text-xs text-gray-400 font-medium">Add catalog items, monitor low-stock limits, and trace cost margins.</p>
        </div>

        <div className="flex gap-2">
          <label className="bg-slate-800 hover:bg-slate-750 text-gray-300 font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg border border-slate-700 flex items-center justify-center gap-2 text-xs cursor-pointer min-h-[48px]">
            <Upload className="w-4 h-4 text-indigo-400" /> Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVImport}
              className="hidden"
            />
          </label>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-505 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2 text-xs min-h-[48px]"
          >
            <Plus className="w-4 h-4" /> {t('inventory.btn_add')}
          </button>
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

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 text-xs bg-slate-900/40 border border-slate-850 p-2.5 rounded-xl">
        <div className="flex-1 relative">
          <Search className={`absolute top-3 w-4 h-4 text-gray-500 ${isRTL ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('inventory.search_placeholder')}
            className={`w-full bg-slate-950 border border-slate-850 rounded-lg py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 text-xs ${
              isRTL ? 'pl-3 pr-9 text-right' : 'pl-9 pr-3 text-left'
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-400 font-semibold">{t('inventory.category')}</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-850 rounded-lg py-2 px-3 text-white focus:outline-none"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Inventory Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-44 bg-slate-950/20 border border-slate-850 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-850 rounded-2xl text-gray-500 text-xs">
          {t('inventory.empty')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredProducts.map(prod => {
            const isLowStock = prod.stock <= prod.min_stock
            const stockRatio = prod.stock > 0 ? (prod.stock / (prod.stock + 20)) * 100 : 0
            
            // animated progress colors
            let progressColor = 'bg-emerald-500'
            if (stockRatio < 20) progressColor = 'bg-rose-500'
            else if (stockRatio >= 20 && stockRatio <= 50) progressColor = 'bg-amber-500'

            // expiration calculation
            let expBadge = null
            if (prod.expiration_date) {
              const today = new Date()
              const expDate = new Date(prod.expiration_date)
              const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
              
              if (diffDays <= 0) {
                expBadge = (
                  <span className="bg-red-500/10 border border-red-500/25 text-red-400 font-bold px-2 py-0.5 rounded-full text-[8px] animate-pulse uppercase tracking-wider">
                    Expired
                  </span>
                )
              } else if (diffDays <= 30) {
                expBadge = (
                  <span className="bg-amber-500/10 border border-amber-500/25 text-amber-400 font-bold px-2 py-0.5 rounded-full text-[8px]">
                    Exp: {diffDays}d
                  </span>
                )
              } else {
                expBadge = (
                  <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-medium px-2 py-0.5 rounded-full text-[8px]">
                    Exp: {prod.expiration_date}
                  </span>
                )
              }
            }

            return (
              <div
                key={prod.id}
                className={`glass rounded-2xl p-5 border shadow-xl flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                  isLowStock ? 'border-rose-500/30 bg-rose-500/5 shadow-rose-950/5' : 'border-slate-900/60 hover:border-slate-800'
                }`}
              >
                
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-extrabold text-white text-sm line-clamp-1 block">{prod.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-gray-400">
                        {prod.category}
                      </span>
                      {prod.sku && (
                        <span className="text-[9px] text-gray-500 font-semibold font-mono flex items-center gap-0.5">
                          <Barcode className="w-3 h-3 text-indigo-400" /> {prod.sku}
                        </span>
                      )}
                      {prod.warehouse_location && (
                        <span className="text-[9px] text-gray-500 font-semibold font-sans">
                          • Location: <strong className="text-white font-medium">{prod.warehouse_location}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 items-end">
                    {isLowStock && (
                      <div className="p-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Low Stock
                      </div>
                    )}
                    {expBadge}
                  </div>
                </div>

                {/* Performance values */}
                <div className="grid grid-cols-3 gap-2 border-t border-b border-slate-900 py-3.5 my-3.5 text-xs">
                  <div>
                    <span className="text-[9px] text-gray-500 font-bold block uppercase tracking-wider">Sell Price</span>
                    <span className="font-black text-white text-xs mt-0.5 block">{currency}{prod.price.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 font-bold block uppercase tracking-wider">Unit Cost</span>
                    <span className="font-semibold text-gray-400 text-xs mt-0.5 block">
                      {prod.costPrice > 0 ? `${currency}${prod.costPrice.toFixed(2)}` : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 font-bold block uppercase tracking-wider">{t('inventory.margin')}</span>
                    <span className={`font-black text-xs mt-0.5 block ${prod.profitMargin >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {prod.profitMargin}%
                    </span>
                  </div>
                </div>

                {/* Pricing tiers details if present */}
                {(prod.wholesale_price || prod.special_price) && (
                  <div className="flex justify-between items-center bg-slate-950/20 border border-slate-900 rounded-lg p-2.5 mb-3.5 text-[10px] text-gray-400 font-mono">
                    {prod.wholesale_price ? (
                      <span>Prix Gros: <strong className="text-white">{currency}{prod.wholesale_price.toFixed(2)}</strong></span>
                    ) : <span />}
                    {prod.special_price ? (
                      <span>Prix Spécial: <strong className="text-white">{currency}{prod.special_price.toFixed(2)}</strong></span>
                    ) : <span />}
                  </div>
                )}

                {/* Stock progress & controls */}
                <div className="flex justify-between items-center text-xs">
                  <div className="flex-1 mr-4">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span>{t('inventory.stock')}</span>
                      <span className={`font-bold ${isLowStock ? 'text-rose-400' : 'text-white'}`}>{prod.stock} units</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950 border border-slate-900 rounded-full overflow-hidden p-0.5">
                      <div
                        style={{ width: `${Math.min(100, stockRatio)}%` }}
                        className={`h-full rounded-full transition-all duration-1000 ${progressColor}`}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setTargetProduct(prod)
                      setShowRestockModal(true)
                    }}
                    className="bg-slate-900 border border-slate-800 hover:bg-slate-850 text-white font-bold py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1.5 text-[10px] min-h-[36px]"
                  >
                    <RotateCcw className="w-3 h-3 text-indigo-400" /> Restock
                  </button>
                </div>

                {/* Employee POS visibility toggle */}
                <div className="flex items-center justify-between border-t border-slate-900/60 pt-3 mt-3.5 text-[10px]">
                  <span className="text-gray-400 font-semibold flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-amber-500" /> Visible in Employee POS
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer scale-75 origin-right">
                    <input
                      type="checkbox"
                      checked={prod.show_to_employee}
                      onChange={() => handleToggleEmployeeVisibility(prod.id, prod.show_to_employee)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#f59e0b]"></div>
                  </label>
                </div>

              </div>
            )
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-2xl p-5 shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Plus className="w-4.5 h-4.5 text-indigo-400" /> {t('inventory.add_title')}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-semibold">{t('inventory.product_name')}</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. fresh bread loaf"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-white min-h-[48px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-semibold flex justify-between">
                  <span>{t('inventory.sku')}</span>
                  <button type="button" onClick={() => setIsScanning(true)} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5">
                    <Scan className="w-3 h-3" /> Scan Barcode
                  </button>
                </label>
                <input
                  type="text"
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  placeholder="e.g. 13-digit EAN code"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-white min-h-[48px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold">{t('inventory.selling_price')}</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-white min-h-[48px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold">{t('inventory.cost_price')}</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-white min-h-[48px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold">Stock</label>
                  <input
                    type="number"
                    required
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    placeholder="50"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-2 text-white min-h-[48px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold">{t('inventory.min_stock')}</label>
                  <input
                    type="number"
                    required
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(e.target.value)}
                    placeholder="10"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-2 text-white min-h-[48px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold">{t('inventory.category')}</label>
                  <input
                    type="text"
                    required
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="General"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-2 text-white min-h-[48px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold">Wholesale Price (Prix Gros)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newWholesalePrice}
                    onChange={(e) => setNewWholesalePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-white min-h-[48px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold">Special Price (Prix Spécial)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newSpecialPrice}
                    onChange={(e) => setNewSpecialPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-white min-h-[48px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold">Expiration Date</label>
                  <input
                    type="date"
                    value={newExpirationDate}
                    onChange={(e) => setNewExpirationDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-white min-h-[48px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold">Warehouse Location</label>
                  <input
                    type="text"
                    value={newWarehouseLocation}
                    onChange={(e) => setNewWarehouseLocation(e.target.value)}
                    placeholder="e.g. Shelving A-12"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-white min-h-[48px]"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-900 hover:bg-slate-850 text-gray-300 py-2 rounded-lg font-bold min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-505 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 min-h-[48px]"
                >
                  Save Product <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {showRestockModal && targetProduct && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-850 rounded-2xl p-5 shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowRestockModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-white text-sm">
              {t('inventory.restock_title')} : {targetProduct.name}
            </h3>

            <form onSubmit={handleRestockProduct} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-semibold">{t('inventory.restock_qty')}</label>
                <input
                  type="number"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  placeholder="25"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-white min-h-[48px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-semibold">{t('inventory.restock_cost')}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={restockCost}
                  onChange={(e) => setRestockCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-white min-h-[48px]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRestockModal(false)}
                  className="flex-1 bg-slate-900 hover:bg-slate-850 text-gray-300 py-2 rounded-lg font-bold min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-505 text-white py-2 rounded-lg font-bold min-h-[48px]"
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scanner Modal inside Add Modal */}
      {isScanning && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-2xl p-5 shadow-2xl space-y-4 relative">
            <button onClick={() => setIsScanning(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Scan className="w-4.5 h-4.5 text-indigo-400" /> Barcode Camera Viewport
              </h3>
              <p className="text-[10px] text-gray-500">Position the EAN-13 barcode inside the align brackets.</p>
            </div>

            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800 shadow-inner flex items-center justify-center">
              <video id="inventory-scanner-viewport" className="w-full h-full object-cover" playsInline />
              <div className="absolute inset-8 border border-indigo-500/20 rounded-lg pointer-events-none">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-indigo-400" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-indigo-400" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-indigo-400" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-indigo-400" />
                <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-rose-500 shadow-md shadow-rose-500/40 animate-pulse" />
              </div>
            </div>

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

    </div>
  )
}
