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
export const GlobeIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
)
export const ChevronDownIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
export const ChevronLeftIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="m15 18-6-6 6-6" />
  </svg>
)
export const ChevronRightIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="m9 18 6-6-6-6" />
  </svg>
)
export const ArrowRightIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
export const WifiIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01" />
  </svg>
)
export const LockIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)
export const ClockIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)
export const FlameIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M12 2c1 3.5-1.6 5.2-2.9 7.3C7.9 11.2 7 12.8 7 15a5 5 0 0 0 10 0c0-2.4-1.1-4-2-5.2-.3 1.3-1 2.2-2 2.7.4-3.6-.1-7.5-1-10.5Z" />
  </svg>
)
export const MenuBookIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
    <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M9 8h7M9 12h5" />
  </svg>
)
export const CopyIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
)
