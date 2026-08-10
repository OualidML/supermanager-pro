import { supabase } from './supabaseClient'
import defaultCatalog from '../data/defaultCatalog.json'

// Storage keys
const OFFLINE_PRODUCTS_KEY = 'offline_products_cache'
const OFFLINE_SALES_KEY = 'offline_pending_sales'
const OFFLINE_BL_KEY = 'offline_delivery_notes'
const OFFLINE_INVOICES_KEY = 'offline_invoices'
const OFFLINE_DEBTS_KEY = 'offline_customer_debts'
const OFFLINE_EXPENSES_KEY = 'offline_expenses'

// 1. PRODUCTS CACHE
export function getOfflineProducts(): any[] {
  try {
    const raw = localStorage.getItem(OFFLINE_PRODUCTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return defaultCatalog as any[]
}

export function saveOfflineProducts(products: any[]) {
  try {
    localStorage.setItem(OFFLINE_PRODUCTS_KEY, JSON.stringify(products))
  } catch (e) {
    console.error('Failed to save offline products cache:', e)
  }
}

// 2. OFFLINE SALES RECORDING
export function recordOfflineSale(sale: any, items: any[]) {
  try {
    const existing = JSON.parse(localStorage.getItem(OFFLINE_SALES_KEY) || '[]')
    const saleRecord = {
      ...sale,
      id: sale.id || `LOCAL-SALE-${Date.now()}`,
      created_at: new Date().toISOString(),
      items
    }
    existing.unshift(saleRecord)
    localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(existing))

    // Deduct stock in offline products cache
    const prods = getOfflineProducts()
    items.forEach((item: any) => {
      const p = prods.find((x: any) => x.id === item.product_id || x.name === item.name)
      if (p) {
        p.stock = Math.max(0, (p.stock || 0) - item.quantity)
      }
    })
    saveOfflineProducts(prods)
    return saleRecord
  } catch (e) {
    console.error('Failed to save offline sale:', e)
    return null
  }
}

export function getOfflineSales(): any[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_SALES_KEY) || '[]')
  } catch (e) {
    return []
  }
}

// 3. OFFLINE DELIVERY NOTES (BL) & INVOICES
export function recordOfflineBL(bl: any) {
  try {
    const existing = JSON.parse(localStorage.getItem(OFFLINE_BL_KEY) || '[]')
    const record = {
      ...bl,
      id: bl.id || `LOCAL-BL-${Date.now()}`,
      created_at: new Date().toISOString()
    }
    existing.unshift(record)
    localStorage.setItem(OFFLINE_BL_KEY, JSON.stringify(existing))
    return record
  } catch (e) {
    console.error('Failed to save offline BL:', e)
    return bl
  }
}

export function getOfflineBLs(): any[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_BL_KEY) || '[]')
  } catch (e) {
    return []
  }
}

export function recordOfflineInvoice(inv: any) {
  try {
    const existing = JSON.parse(localStorage.getItem(OFFLINE_INVOICES_KEY) || '[]')
    const record = {
      ...inv,
      id: inv.id || `LOCAL-FAC-${Date.now()}`,
      created_at: new Date().toISOString()
    }
    existing.unshift(record)
    localStorage.setItem(OFFLINE_INVOICES_KEY, JSON.stringify(existing))
    return record
  } catch (e) {
    console.error('Failed to save offline invoice:', e)
    return inv
  }
}

export function getOfflineInvoices(): any[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_INVOICES_KEY) || '[]')
  } catch (e) {
    return []
  }
}

// 4. OFFLINE DEBTS & CREDITS
export function recordOfflineDebt(debt: any) {
  try {
    const existing = JSON.parse(localStorage.getItem(OFFLINE_DEBTS_KEY) || '[]')
    const record = {
      ...debt,
      id: debt.id || `LOCAL-DEBT-${Date.now()}`,
      created_at: new Date().toISOString()
    }
    existing.unshift(record)
    localStorage.setItem(OFFLINE_DEBTS_KEY, JSON.stringify(existing))
    return record
  } catch (e) {
    return debt
  }
}

export function getOfflineDebts(): any[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_DEBTS_KEY) || '[]')
  } catch (e) {
    return []
  }
}

// 5. OFFLINE EXPENSES
export function recordOfflineExpense(expense: any) {
  try {
    const existing = JSON.parse(localStorage.getItem(OFFLINE_EXPENSES_KEY) || '[]')
    const record = {
      ...expense,
      id: expense.id || `LOCAL-EXP-${Date.now()}`,
      created_at: new Date().toISOString()
    }
    existing.unshift(record)
    localStorage.setItem(OFFLINE_EXPENSES_KEY, JSON.stringify(existing))
    return record
  } catch (e) {
    console.error('Failed to save offline expense:', e)
    return expense
  }
}

export function getOfflineExpenses(): any[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_EXPENSES_KEY) || '[]')
  } catch (e) {
    return []
  }
}

export function deleteOfflineExpense(id: string) {
  try {
    const existing = getOfflineExpenses()
    const updated = existing.filter((e: any) => e.id !== id)
    localStorage.setItem(OFFLINE_EXPENSES_KEY, JSON.stringify(updated))
    return true
  } catch (e) {
    return false
  }
}

// 6. AUTO-SYNC ENGINE (When internet returns)
export async function syncPendingOfflineData(): Promise<{ success: boolean; syncedCount: number }> {
  if (!navigator.onLine) return { success: false, syncedCount: 0 }

  let syncedCount = 0
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, syncedCount: 0 }

    // A. Sync Offline Sales
    const offlineSales = getOfflineSales()
    if (offlineSales.length > 0) {
      for (const s of offlineSales) {
        try {
          const { data: insertedSale, error: saleErr } = await supabase
            .from('sales')
            .insert([{
              owner_id: user.id,
              total_amount: s.total_amount,
              payment_method: s.payment_method || 'cash',
              amount_paid: s.amount_paid,
              employee_id: s.employee_id || null,
              client_id: s.client_id || null
            }])
            .select()

          if (!saleErr && insertedSale && insertedSale.length > 0) {
            const saleId = insertedSale[0].id
            if (s.items && s.items.length > 0) {
              const saleItems = s.items.map((it: any) => ({
                sale_id: saleId,
                product_id: it.product_id?.startsWith('LOCAL-') || it.product_id?.startsWith('PROD-') ? null : it.product_id,
                quantity: it.quantity,
                unit_price: it.price || it.unit_price,
                total_price: (it.quantity || 1) * (it.price || it.unit_price)
              }))
              await supabase.from('sale_items').insert(saleItems)
            }
            syncedCount++
          }
        } catch (itemErr) {
          console.warn('Sync item failed:', itemErr)
        }
      }
      localStorage.removeItem(OFFLINE_SALES_KEY)
    }

    // B. Sync Offline BLs
    const offlineBLs = getOfflineBLs()
    if (offlineBLs.length > 0) {
      for (const bl of offlineBLs) {
        try {
          await supabase.from('delivery_notes').insert([{
            owner_id: user.id,
            client_id: bl.client_id || null,
            client_name: bl.client_name,
            client_phone: bl.client_phone || null,
            items_json: bl.items_json,
            total_amount: bl.total_amount,
            amount_paid: bl.amount_paid || 0,
            driver_name: bl.driver_name || null,
            vehicle_plate: bl.vehicle_plate || null,
            destination: bl.destination || null
          }])
        } catch (blErr) {
          console.warn('Sync BL failed:', blErr)
        }
      }
      localStorage.removeItem(OFFLINE_BL_KEY)
    }

    if (syncedCount > 0) {
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: `Synchronisé avec succès: ${syncedCount} vente(s) hors-ligne transférée(s) au Cloud!`, type: 'success' }
      }))
    }

    return { success: true, syncedCount }
  } catch (err) {
    console.error('Auto-sync offline data failed:', err)
    return { success: false, syncedCount: 0 }
  }
}

// Automatically listen to network online event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Network connected! Triggering background sync...')
    syncPendingOfflineData()
  })
}
