import { useContext, useEffect, useRef, useState } from 'react'

import { tr } from '../../../shared/localized'
import { LangContext } from '../i18n'
import type { GuestCategory } from '../types'

/** Horizontal category chips; tapping scrolls to the section, scrolling highlights the chip. */
export default function CategoryStrip({
  categories,
  active,
  fallbackLang,
}: {
  categories: GuestCategory[]
  active: number | null
  fallbackLang: string
}) {
  const { lang } = useContext(LangContext)
  const stripRef = useRef<HTMLDivElement>(null)

  // Keep the active chip centred in the strip. Scroll the strip itself: scrollIntoView
  // would also interrupt the page's own smooth scroll to the section.
  useEffect(() => {
    const strip = stripRef.current
    const chip = strip?.querySelector<HTMLElement>(`[data-cat="${active}"]`)
    if (strip && chip) {
      strip.scrollTo({ left: chip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' })
    }
  }, [active])

  function jump(e: React.MouseEvent, id: number) {
    e.preventDefault()
    const section = document.getElementById(`cat-${id}`)
    const header = document.querySelector('header')
    if (!section) return
    const top = section.getBoundingClientRect().top + window.scrollY - (header?.offsetHeight ?? 0)
    window.scrollTo({ top, behavior: 'smooth' })
  }

  return (
    <nav ref={stripRef} className="no-scrollbar relative flex gap-2 overflow-x-auto px-4 pb-3">
      {categories.map((c) => (
        <a
          key={c.id}
          href={`#cat-${c.id}`}
          data-cat={c.id}
          onClick={(e) => jump(e, c.id)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
            active === c.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
          }`}
        >
          {tr(c.name, lang, fallbackLang)}
        </a>
      ))}
    </nav>
  )
}

/** Which category section is under the sticky header; at the very bottom the last one wins,
 * since a short last section can never scroll up to the header. */
export function useActiveCategory(ids: number[]): number | null {
  const [active, setActive] = useState<number | null>(ids[0] ?? null)
  const key = ids.join(',')
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      let current = ids[0] ?? null
      for (const id of ids) {
        const top = document.getElementById(`cat-${id}`)?.getBoundingClientRect().top
        if (top !== undefined && top <= headerBottom + 8) current = id
      }
      setActive(atBottom && ids.length ? ids[ids.length - 1] : current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return active
}
