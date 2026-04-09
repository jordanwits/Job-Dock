/**
 * Matches the initial blank row from QuoteForm / InvoiceForm when creating a
 * new document. Default values use { description: '', quantity: 1, unitPrice: '' },
 * but `valueAsNumber` on unit price can normalize an untouched field to `0` or
 * `NaN`, so both are treated as "no price yet" for this row.
 */
export function isDefaultPlaceholderLineItem(item: {
  description?: string
  quantity?: unknown
  unitPrice?: unknown
}): boolean {
  if (String(item.description ?? '').trim() !== '') {
    return false
  }
  const q = item.quantity
  if (q === '' || q === null || q === undefined) {
    return false
  }
  const qtyNum = Number(q)
  if (!Number.isFinite(qtyNum) || qtyNum !== 1) {
    return false
  }
  const p = item.unitPrice
  if (p === '' || p === null || p === undefined) {
    return true
  }
  const priceNum = Number(p)
  return Number.isNaN(priceNum) || priceNum === 0
}
