import { useEffect } from 'react'

/** Short confirmation at the top of the screen, e.g. "The waiter is on the way". */
export default function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3500)
    return () => clearTimeout(timer)
  }, [text, onDone])

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-3 z-[60] mx-auto w-fit max-w-[90vw] rounded-2xl bg-ink px-5 py-3 text-center text-sm font-medium text-white shadow-lg"
    >
      {text}
    </div>
  )
}
