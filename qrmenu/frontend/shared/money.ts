// Amounts travel as integers in the currency's minor units (e.g. kopecks; VND has none).

export function fractionDigits(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
}

export function formatMoney(amount: number, currency: string, lang: string): string {
  const digits = fractionDigits(currency)
  return new Intl.NumberFormat(lang, { style: 'currency', currency, minimumFractionDigits: digits }).format(
    amount / 10 ** digits,
  )
}

/** "75 000" / "12,50" typed by a human -> minor units, or null if not a valid amount. */
export function parseMoney(input: string, currency: string): number | null {
  const digits = fractionDigits(currency)
  const normalized = input.replace(/[\s ]/g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  const [whole, frac = ''] = normalized.split('.')
  if (frac.length > digits) return null
  return Number(whole) * 10 ** digits + Number(frac.padEnd(digits, '0') || 0)
}

export function moneyToInput(amount: number, currency: string): string {
  const digits = fractionDigits(currency)
  return digits === 0 ? String(amount) : (amount / 10 ** digits).toFixed(digits)
}
