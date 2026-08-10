import { useState, useEffect } from 'react'
import {
  Truck,
  FileText,
  Plus,
  Search,
  Printer,
  CheckCircle2,
  Trash2,
  Phone,
  AlertCircle,
  X
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useTranslation } from 'react-i18next'
import { getOfflineProducts, getOfflineBLs, getOfflineInvoices, recordOfflineBL, recordOfflineInvoice } from '../lib/offlineStorage'

interface LineItem {
  id: string
  name: string
  quantity: number
  price: number
}

interface DeliveryNote {
  id: string
  client_id: string | null
  client_name: string
  client_phone: string | null
  items_json: LineItem[]
  total_amount: number
  amount_paid: number
  driver_name: string | null
  vehicle_plate: string | null
  destination: string | null
  converted_to_invoice: boolean
  invoice_id: string | null
  created_at: string
}

interface Invoice {
  id: string
  delivery_note_id: string | null
  client_id: string | null
  client_name: string
  items_json: LineItem[]
  total_amount: number
  created_at: string
}

export default function Billing() {
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState<'bl' | 'factures'>('bl')
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('DA')
  const [storeName, setStoreName] = useState('SuperManager Pro')

  // Lists
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [productsCache, setProductsCache] = useState<any[]>([])

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')

  // Create BL Modal states
  const [showCreateBLModal, setShowCreateBLModal] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [formClientName, setFormClientName] = useState('')
  const [formClientPhone, setFormClientPhone] = useState('')
  const [formDriverName, setFormDriverName] = useState('')
  const [formVehiclePlate, setFormVehiclePlate] = useState('')
  const [formDestination, setFormDestination] = useState('')
  const [formAmountPaid, setFormAmountPaid] = useState('')
  const [formItems, setFormItems] = useState<LineItem[]>([])
  const [savingBL, setSavingBL] = useState(false)

  // Current item builder states
  const [addItemProductId, setAddItemProductId] = useState('')
  const [addItemCustomName, setAddItemCustomName] = useState('')
  const [addItemQuantity, setAddItemQuantity] = useState('1')
  const [addItemPrice, setAddItemPrice] = useState('')

  // Status Alerts
  const [successMsg, setSuccessMsg] = useState('')
  const [dbError, setDbError] = useState<string | null>(null)

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load profile info
      const { data: profile } = await supabase
        .from('store_profiles')
        .select('name, currency')
        .eq('owner_id', user.id)
        .limit(1)

      if (profile && profile.length > 0) {
        if (profile[0].name) setStoreName(profile[0].name)
        if (profile[0].currency) setCurrency(profile[0].currency)
      }

      // Load products cache
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, price, stock, sku')
        .eq('owner_id', user.id)

      if (prods && prods.length > 0) {
        setProductsCache(prods)
      } else {
        setProductsCache(getOfflineProducts())
      }

      // Load clients
      const { data: cls } = await supabase
        .from('clients')
        .select('*')
        .eq('owner_id', user.id)
        .order('name', { ascending: true })

      setClients(cls || [])

      // Load BL delivery notes
      const { data: blData } = await supabase
        .from('delivery_notes')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (blData && blData.length > 0) {
        setDeliveryNotes(blData)
      } else {
        setDeliveryNotes(getOfflineBLs())
      }

      // Load Invoices
      const { data: invData } = await supabase
        .from('invoices')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (invData && invData.length > 0) {
        setInvoices(invData)
      } else {
        setInvoices(getOfflineInvoices())
      }

    } catch (e: any) {
      console.warn('Billing offline fallback activated:', e)
      setProductsCache(getOfflineProducts())
      setDeliveryNotes(getOfflineBLs())
      setInvoices(getOfflineInvoices())
    } finally {
      setLoading(false)
    }
  }

  // Handle Client select inside Create Modal
  const handleClientChange = (cId: string) => {
    setSelectedClientId(cId)
    if (cId) {
      const c = clients.find(cl => cl.id === cId)
      if (c) {
        setFormClientName(c.name)
        setFormClientPhone(c.phone || '')
      }
    } else {
      setFormClientName('')
      setFormClientPhone('')
    }
  }

  // Add Item to current BL form
  const handleAddItemToForm = () => {
    const qty = parseInt(addItemQuantity) || 1
    const price = parseFloat(addItemPrice) || 0
    let name = addItemCustomName.trim()

    if (addItemProductId) {
      const prod = productsCache.find(p => p.id === addItemProductId)
      if (prod) name = prod.name
    }

    if (!name || price <= 0 || qty <= 0) return

    setFormItems(prev => [
      ...prev,
      {
        id: addItemProductId || `ITEM-${Date.now()}`,
        name,
        quantity: qty,
        price
      }
    ])

    // Reset inputs
    setAddItemProductId('')
    setAddItemCustomName('')
    setAddItemQuantity('1')
    setAddItemPrice('')
  }

  // Remove Item from Form
  const handleRemoveFormItem = (idx: number) => {
    setFormItems(prev => prev.filter((_, i) => i !== idx))
  }

  // Save new Delivery Note (BL)
  const handleSaveDeliveryNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formItems.length === 0) {
      setDbError(t('billing.err_no_items'))
      return
    }
    setDbError(null)
    setSavingBL(true)

    try {
      const total = formItems.reduce((sum, item) => sum + item.quantity * item.price, 0)
      const paid = parseFloat(formAmountPaid) || 0
      const finalClientName = formClientName.trim() || t('billing.client_default', 'Client de passage')

      let savedBLRecord: any = null

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data, error } = await supabase
            .from('delivery_notes')
            .insert([{
              owner_id: user.id,
              client_id: selectedClientId || null,
              client_name: finalClientName,
              client_phone: formClientPhone.trim() || null,
              items_json: formItems,
              total_amount: total,
              amount_paid: paid,
              driver_name: formDriverName.trim() || null,
              vehicle_plate: formVehiclePlate.trim() || null,
              destination: formDestination.trim() || null,
              converted_to_invoice: false
            }])
            .select()

          if (!error && data && data.length > 0) {
            savedBLRecord = data[0]
          }
        }
      } catch (cloudErr) {
        console.warn('Saving BL in offline mode:', cloudErr)
      }

      if (!savedBLRecord) {
        savedBLRecord = recordOfflineBL({
          client_id: selectedClientId || null,
          client_name: finalClientName,
          client_phone: formClientPhone.trim() || null,
          items_json: formItems,
          total_amount: total,
          amount_paid: paid,
          driver_name: formDriverName.trim() || null,
          vehicle_plate: formVehiclePlate.trim() || null,
          destination: formDestination.trim() || null,
          converted_to_invoice: false
        })
      }

      setShowCreateBLModal(false)
      setSelectedClientId('')
      setFormClientName('')
      setFormClientPhone('')
      setFormDriverName('')
      setFormVehiclePlate('')
      setFormDestination('')
      setFormAmountPaid('')
      setFormItems([])

      if (savedBLRecord) {
        setDeliveryNotes(prev => [savedBLRecord, ...prev])
        handlePrintBL(savedBLRecord)
      }

      setSuccessMsg(t('billing.new_bl') + ' - OK (Mode Hors-Ligne)')
      setTimeout(() => setSuccessMsg(''), 3000)

    } catch (err: any) {
      console.error('Error saving BL:', err)
      setDbError(err.message || t('billing.err_save_bl'))
    } finally {
      setSavingBL(false)
    }
  }

  // Convert BL to Invoice
  const handleConvertToInvoice = async (bl: DeliveryNote) => {
    if (!window.confirm(t('billing.convert_confirm'))) return
    setDbError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthenticated.')

      // 1. Insert Invoice
      const { data: invData, error: invErr } = await supabase
        .from('invoices')
        .insert([{
          owner_id: user.id,
          delivery_note_id: bl.id,
          client_id: bl.client_id,
          client_name: bl.client_name,
          items_json: bl.items_json,
          total_amount: bl.total_amount
        }])
        .select()

      if (invErr) throw invErr

      // 2. Mark BL as converted
      await supabase
        .from('delivery_notes')
        .update({
          converted_to_invoice: true,
          invoice_id: invData[0].id
        })
        .eq('id', bl.id)

      setDeliveryNotes(prev => prev.map(item => item.id === bl.id ? { ...item, converted_to_invoice: true, invoice_id: invData[0].id } : item))
      if (invData && invData.length > 0) {
        setInvoices(prev => [invData[0], ...prev])
        setActiveTab('factures')
        handlePrintInvoice(invData[0])
      }

      setSuccessMsg(t('billing.convert_success'))
      setTimeout(() => setSuccessMsg(''), 3500)

    } catch (err: any) {
      console.error('Conversion to invoice error:', err)
      setDbError(err.message || t('billing.err_convert'))
    }
  }

  // Delete BL
  const handleDeleteBL = async (id: string) => {
    if (!window.confirm(t('billing.delete_confirm'))) return
    try {
      await supabase.from('delivery_notes').delete().eq('id', id)
      setDeliveryNotes(prev => prev.filter(b => b.id !== id))
    } catch (e: any) {
      setDbError(e.message || t('billing.err_delete'))
    }
  }

  // Delete Invoice
  const handleDeleteInvoice = async (id: string) => {
    if (!window.confirm(t('billing.delete_confirm'))) return
    try {
      await supabase.from('invoices').delete().eq('id', id)
      setInvoices(prev => prev.filter(i => i.id !== id))
    } catch (e: any) {
      setDbError(e.message || t('billing.err_delete'))
    }
  }

  // Print Clean A4 Delivery Note (BL)
  const handlePrintBL = (bl: DeliveryNote) => {
    const printWindow = window.open('', '_blank', 'width=850,height=900')
    if (!printWindow) return

    const itemsRows = (bl.items_json || []).map((item, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td><strong>${item.name}</strong></td>
        <td style="text-align: center;">${item.quantity}</td>
        <td style="text-align: right;">${item.price.toFixed(2)} ${currency}</td>
        <td style="text-align: right; font-weight: bold;">${(item.quantity * item.price).toFixed(2)} ${currency}</td>
      </tr>
    `).join('')

    const remaining = bl.total_amount - bl.amount_paid

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="${i18n.language === 'ar' ? 'rtl' : 'ltr'}">
      <head>
        <title>BON DE LIVRAISON - ${bl.client_name}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; color: #1e293b; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px; }
          .store-name { font-size: 22px; font-weight: 800; color: #1e3a8a; }
          .doc-type { font-size: 20px; font-weight: 800; color: #2563eb; text-align: right; text-transform: uppercase; }
          .meta-box { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-weight: 700; color: #334155; }
          td { border: 1px solid #e2e8f0; padding: 7px 8px; }
          .total-box { margin-left: auto; width: 280px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; font-size: 13px; }
          .total-row { display: flex; justify-content: space-between; padding: 3px 0; }
          .total-row.grand { font-size: 15px; font-weight: 800; border-top: 2px solid #3b82f6; color: #1e3a8a; padding-top: 6px; margin-top: 4px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; font-size: 12px; text-align: center; }
          .sig-box { width: 200px; border-top: 1px dashed #64748b; padding-top: 8px; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body onload="window.print();">
        <div class="header">
          <div style="display: flex; align-items: center; gap: 14px;">
            <img src="/logo.jpg" style="width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 2px solid #d97706;" alt="Houari Achaach" />
            <div>
              <div class="store-name">HOUARI ACHAACH</div>
              <div style="font-size: 11px; font-weight: bold; color: #d97706; text-transform: uppercase; letter-spacing: 0.5px;">PAINT SHOP &amp; PVC SOLUTIONS</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 1px;">Commerce, Distribution Peinture, Quincaillerie &amp; Sanitaire</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div class="doc-type">BON DE LIVRAISON</div>
            <div style="font-size: 11px; color: #64748b; font-weight: bold;">N°: BL-${bl.id.slice(0, 8).toUpperCase()}</div>
            <div style="font-size: 11px; color: #64748b;">Date: ${new Date(bl.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        <div class="meta-box">
          <div>
            <div><strong>Client / Destinataire:</strong> ${bl.client_name}</div>
            ${bl.client_phone ? `<div><strong>Téléphone:</strong> ${bl.client_phone}</div>` : ''}
            ${bl.destination ? `<div><strong>Destination / Adresse:</strong> ${bl.destination}</div>` : ''}
          </div>
          <div>
            ${bl.driver_name ? `<div><strong>Chauffeur / Transporteur:</strong> ${bl.driver_name}</div>` : ''}
            ${bl.vehicle_plate ? `<div><strong>Matricule Véhicule:</strong> ${bl.vehicle_plate}</div>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>Désignation de l'Article</th>
              <th style="width: 70px; text-align: center;">Qté</th>
              <th style="width: 100px; text-align: right;">Prix Unit.</th>
              <th style="width: 120px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="total-box">
          <div class="total-row">
            <span>Total Général:</span>
            <strong>${bl.total_amount.toFixed(2)} ${currency}</strong>
          </div>
          <div class="total-row" style="color: #16a34a;">
            <span>Versement Reçu:</span>
            <span>${bl.amount_paid.toFixed(2)} ${currency}</span>
          </div>
          <div class="total-row grand">
            <span>Reste à Payer:</span>
            <span>${remaining.toFixed(2)} ${currency}</span>
          </div>
        </div>

        <div class="signatures">
          <div class="sig-box">Signature & Cachet Magasin</div>
          <div class="sig-box">Visa Chauffeur / Livreur</div>
          <div class="sig-box">Accusé de Réception Client</div>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Print Official Invoice
  const handlePrintInvoice = (inv: Invoice) => {
    const printWindow = window.open('', '_blank', 'width=850,height=900')
    if (!printWindow) return

    const itemsRows = (inv.items_json || []).map((item, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td><strong>${item.name}</strong></td>
        <td style="text-align: center;">${item.quantity}</td>
        <td style="text-align: right;">${item.price.toFixed(2)} ${currency}</td>
        <td style="text-align: right; font-weight: bold;">${(item.quantity * item.price).toFixed(2)} ${currency}</td>
      </tr>
    `).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="${i18n.language === 'ar' ? 'rtl' : 'ltr'}">
      <head>
        <title>FACTURE - ${inv.client_name}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; color: #1e293b; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 20px; }
          .store-name { font-size: 22px; font-weight: 800; color: #065f46; }
          .doc-type { font-size: 20px; font-weight: 800; color: #059669; text-align: right; text-transform: uppercase; }
          .meta-box { background: #f0fdf4; padding: 12px 16px; border-radius: 8px; border: 1px solid #bbf7d0; margin-bottom: 20px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th { background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-weight: 700; color: #334155; }
          td { border: 1px solid #e2e8f0; padding: 7px 8px; }
          .total-box { margin-left: auto; width: 280px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; font-size: 13px; }
          .total-row.grand { font-size: 16px; font-weight: 800; color: #065f46; display: flex; justify-content: space-between; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body onload="window.print();">
        <div class="header">
          <div style="display: flex; align-items: center; gap: 14px;">
            <img src="/logo.jpg" style="width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 2px solid #059669;" alt="Houari Achaach" />
            <div>
              <div class="store-name" style="color: #065f46;">HOUARI ACHAACH</div>
              <div style="font-size: 11px; font-weight: bold; color: #d97706; text-transform: uppercase; letter-spacing: 0.5px;">PAINT SHOP &amp; PVC SOLUTIONS</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 1px;">Commerce, Distribution Peinture, Quincaillerie &amp; Sanitaire</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div class="doc-type">FACTURE OFFICIELLE</div>
            <div style="font-size: 11px; color: #64748b; font-weight: bold;">N°: FAC-${inv.id.slice(0, 8).toUpperCase()}</div>
            <div style="font-size: 11px; color: #64748b;">Date: ${new Date(inv.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        <div class="meta-box">
          <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Facturé à :</div>
          <div style="font-size: 16px; font-weight: bold; margin-top: 3px;">${inv.client_name}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>Désignation Produit</th>
              <th style="width: 70px; text-align: center;">Qté</th>
              <th style="width: 100px; text-align: right;">Prix Unit.</th>
              <th style="width: 120px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="total-box">
          <div class="total-row grand">
            <span>Total TTC:</span>
            <span>${inv.total_amount.toFixed(2)} ${currency}</span>
          </div>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  const formTotal = formItems.reduce((sum, item) => sum + item.quantity * item.price, 0)
  const isRTL = i18n.language === 'ar'

  return (
    <div className="space-y-6 pb-20 relative">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-400" /> {t('billing.title')}
          </h2>
          <p className="text-xs text-gray-400 font-medium">
            {t('billing.subtitle')}
          </p>
        </div>

        <button
          onClick={() => setShowCreateBLModal(true)}
          className="bg-indigo-600 hover:bg-indigo-505 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/10 min-h-[48px]"
        >
          <Plus className="w-4 h-4" /> {t('billing.new_bl')}
        </button>
      </div>

      {/* Warning/Error Message Banner (Red Alert) */}
      {dbError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 text-red-400 flex items-start gap-2.5 text-xs animate-shake">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="font-semibold">{dbError}</span>
        </div>
      )}

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 text-emerald-400 flex items-center gap-2.5 text-xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-850 pb-2.5">
        <button
          onClick={() => setActiveTab('bl')}
          className={`pb-2.5 px-1 font-bold text-xs transition-all relative flex items-center gap-2 ${
            activeTab === 'bl' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Truck className="w-4 h-4" /> {t('billing.tab_bl')} ({deliveryNotes.length})
        </button>
        <button
          onClick={() => setActiveTab('factures')}
          className={`pb-2.5 px-1 font-bold text-xs transition-all relative flex items-center gap-2 ${
            activeTab === 'factures' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" /> {t('billing.tab_invoices')} ({invoices.length})
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="relative">
        <Search className={`absolute top-3 w-4 h-4 text-gray-500 ${isRTL ? 'right-3' : 'left-3'}`} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('billing.search_placeholder')}
          className={`w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs ${
            isRTL ? 'pl-3 pr-9 text-right' : 'pl-9 pr-3 text-left'
          }`}
        />
      </div>

      {/* BL Delivery Notes List */}
      {activeTab === 'bl' ? (
        loading ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-slate-950/20 border border-slate-850 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : deliveryNotes.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-850 rounded-2xl text-gray-500 text-xs">
            {t('billing.empty_bl')}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {deliveryNotes
              .filter(bl =>
                bl.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (bl.driver_name && bl.driver_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (bl.vehicle_plate && bl.vehicle_plate.toLowerCase().includes(searchQuery.toLowerCase()))
              )
              .map(bl => {
                const remaining = bl.total_amount - bl.amount_paid
                return (
                  <div
                    key={bl.id}
                    className="glass border border-slate-900 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-white text-sm">{bl.client_name}</span>
                        {bl.client_phone && (
                          <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                            <Phone className="w-3 h-3 text-indigo-400" /> {bl.client_phone}
                          </span>
                        )}
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          bl.converted_to_invoice ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {bl.converted_to_invoice ? t('billing.status_converted') : t('billing.status_pending')}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-4 text-[11px] text-gray-400">
                        {bl.driver_name && <span>{t('billing.driver')}: <strong className="text-white">{bl.driver_name}</strong></span>}
                        {bl.vehicle_plate && <span>{t('billing.plate')}: <strong className="text-white">{bl.vehicle_plate}</strong></span>}
                        {bl.destination && <span>{t('billing.destination')}: <strong className="text-white">{bl.destination}</strong></span>}
                        <span>{t('billing.date')}: <strong className="text-white">{new Date(bl.created_at).toLocaleDateString()}</strong></span>
                      </div>

                      {/* Items list summary */}
                      <div className="text-[10px] text-gray-400 bg-slate-950/40 border border-slate-850 p-2 rounded-xl flex flex-wrap gap-2">
                        {(bl.items_json || []).map((item, idx) => (
                          <span key={idx} className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {item.quantity}x {item.name} ({currency}{item.price.toFixed(2)})
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between border-t md:border-t-0 border-slate-850 pt-3 md:pt-0 gap-3">
                      <div className="text-left md:text-right font-mono text-xs">
                        <div className="text-gray-400">{t('billing.total')}: <strong className="text-white">{currency}{bl.total_amount.toFixed(2)}</strong></div>
                        <div className="text-emerald-400 text-[11px]">{t('billing.paid')}: {currency}{bl.amount_paid.toFixed(2)}</div>
                        <div className="text-rose-400 text-[11px]">{t('billing.remaining')}: {currency}{remaining.toFixed(2)}</div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePrintBL(bl)}
                          className="bg-indigo-600 hover:bg-indigo-505 text-white font-bold px-3 py-2 rounded-xl text-[11px] flex items-center gap-1 min-h-[40px]"
                        >
                          <Printer className="w-3.5 h-3.5" /> {t('billing.btn_print_a4')}
                        </button>

                        {!bl.converted_to_invoice && (
                          <button
                            onClick={() => handleConvertToInvoice(bl)}
                            className="bg-emerald-600 hover:bg-emerald-505 text-white font-bold px-3 py-2 rounded-xl text-[11px] flex items-center gap-1 min-h-[40px]"
                          >
                            <FileText className="w-3.5 h-3.5" /> {t('billing.btn_invoice')}
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteBL(bl.id)}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold px-2.5 py-2 rounded-xl text-[11px] border border-red-500/20 min-h-[40px]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        )
      ) : (
        /* Invoices List */
        loading ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-slate-950/20 border border-slate-850 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-850 rounded-2xl text-gray-500 text-xs">
            {t('billing.empty_invoices')}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {invoices
              .filter(inv => inv.client_name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(inv => (
                <div
                  key={inv.id}
                  className="glass border border-slate-900 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-sm">{inv.client_name}</span>
                      <span className="text-[10px] text-gray-500">FAC-{inv.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {t('billing.date')}: <strong className="text-white">{new Date(inv.created_at).toLocaleDateString()}</strong>
                    </div>
                    <div className="text-[10px] text-gray-400 bg-slate-950/40 border border-slate-850 p-2 rounded-xl flex flex-wrap gap-2">
                      {(inv.items_json || []).map((item, idx) => (
                        <span key={idx} className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {item.quantity}x {item.name} ({currency}{item.price.toFixed(2)})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between border-t md:border-t-0 border-slate-850 pt-3 md:pt-0 gap-3">
                    <span className="font-extrabold text-white text-sm font-mono">
                      {currency}{inv.total_amount.toFixed(2)}
                    </span>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePrintInvoice(inv)}
                        className="bg-emerald-600 hover:bg-emerald-505 text-white font-bold px-3 py-2 rounded-xl text-[11px] flex items-center gap-1 min-h-[40px]"
                      >
                        <Printer className="w-3.5 h-3.5" /> {t('billing.btn_print_a4')}
                      </button>

                      <button
                        onClick={() => handleDeleteInvoice(inv.id)}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold px-2.5 py-2 rounded-xl text-[11px] border border-red-500/20 min-h-[40px]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )
      )}

      {/* Create BL Modal */}
      {showCreateBLModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowCreateBLModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-white text-base flex items-center gap-2 border-b border-slate-850 pb-3">
              <Truck className="w-5 h-5 text-indigo-400" /> {t('billing.modal_title')}
            </h3>

            <form onSubmit={handleSaveDeliveryNote} className="space-y-4 text-xs">
              
              {/* Client selection & info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold">{t('billing.select_client')}</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[44px]"
                  >
                    <option value="">{t('billing.client_default')}</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold">{t('billing.client_name')}</label>
                  <input
                    type="text"
                    value={formClientName}
                    onChange={(e) => setFormClientName(e.target.value)}
                    placeholder={t('billing.client_name_placeholder')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[44px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold">{t('billing.client_phone')}</label>
                  <input
                    type="text"
                    value={formClientPhone}
                    onChange={(e) => setFormClientPhone(e.target.value)}
                    placeholder="05 / 06 / 07 ..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[44px]"
                  />
                </div>
              </div>

              {/* Logistics & Driver info (All Optional) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-850 pt-3">
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold">{t('billing.driver_name')}</label>
                  <input
                    type="text"
                    value={formDriverName}
                    onChange={(e) => setFormDriverName(e.target.value)}
                    placeholder="Ex: Mohamed B."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[44px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold">{t('billing.vehicle_plate')}</label>
                  <input
                    type="text"
                    value={formVehiclePlate}
                    onChange={(e) => setFormVehiclePlate(e.target.value)}
                    placeholder="Ex: 00124-116-16"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[44px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold">{t('billing.destination_label')}</label>
                  <input
                    type="text"
                    value={formDestination}
                    onChange={(e) => setFormDestination(e.target.value)}
                    placeholder="Ex: Oran, Rue 12"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[44px]"
                  />
                </div>
              </div>

              {/* Items Builder */}
              <div className="space-y-2 border-t border-slate-850 pt-3">
                <label className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] block">
                  {t('billing.add_items_label')}
                </label>
                
                <div className="flex flex-col sm:flex-row gap-2 items-center bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                  <select
                    value={addItemProductId}
                    onChange={(e) => {
                      setAddItemProductId(e.target.value)
                      if (e.target.value) {
                        const prod = productsCache.find(p => p.id === e.target.value)
                        if (prod) {
                          setAddItemPrice(prod.price.toString())
                          setAddItemCustomName('')
                        }
                      }
                    }}
                    className="w-full sm:w-1/2 bg-slate-900 border border-slate-800 rounded-lg py-2 px-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs min-h-[40px]"
                  >
                    <option value="">{t('billing.select_product')}</option>
                    {productsCache.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.price} {currency})</option>
                    ))}
                  </select>

                  {!addItemProductId && (
                    <input
                      type="text"
                      value={addItemCustomName}
                      onChange={(e) => setAddItemCustomName(e.target.value)}
                      placeholder={t('billing.custom_name_placeholder')}
                      className="w-full sm:w-1/2 bg-slate-900 border border-slate-800 rounded-lg py-2 px-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs min-h-[40px]"
                    />
                  )}

                  <div className="flex gap-2 w-full sm:w-auto">
                    <input
                      type="number"
                      min="1"
                      value={addItemQuantity}
                      onChange={(e) => setAddItemQuantity(e.target.value)}
                      placeholder="Qté"
                      className="w-16 bg-slate-900 border border-slate-800 rounded-lg py-2 px-2 text-center text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs min-h-[40px]"
                    />

                    <input
                      type="number"
                      step="any"
                      value={addItemPrice}
                      onChange={(e) => setAddItemPrice(e.target.value)}
                      placeholder={`Prix (${currency})`}
                      className="w-24 bg-slate-900 border border-slate-800 rounded-lg py-2 px-2 text-center text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs min-h-[40px]"
                    />

                    <button
                      type="button"
                      onClick={handleAddItemToForm}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-2 rounded-lg text-xs flex items-center gap-1 min-h-[40px] whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" /> {t('billing.btn_add_item')}
                    </button>
                  </div>
                </div>

                {/* Items Table in Form */}
                {formItems.length > 0 && (
                  <div className="border border-slate-850 rounded-xl overflow-hidden mt-2 max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-gray-400 font-semibold border-b border-slate-850">
                        <tr>
                          <th className="py-2 px-3">Article</th>
                          <th className="py-2 px-3 text-center">Qté</th>
                          <th className="py-2 px-3 text-right">Prix</th>
                          <th className="py-2 px-3 text-right">Total</th>
                          <th className="py-2 px-2 text-center w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/50">
                        {formItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-850/30">
                            <td className="py-2 px-3 text-white font-medium">{item.name}</td>
                            <td className="py-2 px-3 text-center text-gray-300">{item.quantity}</td>
                            <td className="py-2 px-3 text-right text-gray-300">{currency}{item.price.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right text-white font-bold">{currency}{(item.quantity * item.price).toFixed(2)}</td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveFormItem(idx)}
                                className="text-red-400 hover:text-red-300 p-1"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Total & Paid Amount (Optional) */}
              <div className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-850 mt-4">
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold block">{t('billing.paid_amount_label')}</label>
                  <input
                    type="number"
                    step="any"
                    value={formAmountPaid}
                    onChange={(e) => setFormAmountPaid(e.target.value)}
                    placeholder="0.00"
                    className="w-32 bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-3 text-emerald-400 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs min-h-[36px]"
                  />
                </div>

                <div className="text-right">
                  <div className="text-gray-400 text-[11px]">{t('billing.total')}</div>
                  <div className="text-lg font-extrabold text-white font-mono">{currency}{formTotal.toFixed(2)}</div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowCreateBLModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-gray-300 font-bold px-4 py-2.5 rounded-xl text-xs min-h-[44px]"
                >
                  {t('onboarding.back')}
                </button>
                <button
                  type="submit"
                  disabled={savingBL || formItems.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-505 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 min-h-[44px]"
                >
                  <Printer className="w-4 h-4" /> {savingBL ? t('billing.saving') : t('billing.btn_create_bl')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
