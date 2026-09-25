// Inline icons instead of an icon library: keeps the guest bundle small for slow phones.
type P = { className?: string }
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export const SearchIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)
export const XIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)
export const MinusIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M5 12h14" />
  </svg>
)
export const PlusIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const AlertIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
)
export const BellIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
)
export const ReceiptIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
)
