import { useState } from 'react'

import { moneyToInput, parseMoney } from '../../../shared/money'
import { input } from './ui'

/** Text input for a price; reports integer minor units (or null while the text is invalid). */
export default function MoneyInput({
  id,
  value,
  currency,
  onChange,
  className = '',
}: {
  id?: string
  value: number | null
  currency: string
  onChange: (minor: number | null) => void
  className?: string
}) {
  const [text, setText] = useState(value === null ? '' : moneyToInput(value, currency))
  const invalid = text !== '' && parseMoney(text, currency) === null
  return (
    <div className={`relative ${className}`}>
      <input
        id={id}
        inputMode="decimal"
        required
        className={`${input} pr-12 text-right ${invalid ? 'border-red-400' : ''}`}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onChange(parseMoney(e.target.value, currency))
        }}
      />
      <span className="pointer-events-none absolute top-2 right-3 text-sm text-slate-400">{currency}</span>
    </div>
  )
}
