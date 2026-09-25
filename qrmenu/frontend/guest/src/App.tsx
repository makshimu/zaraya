import { useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { tr } from '../../shared/localized'
import { useMenu, useOrders, useSession } from './api'
import { CartProvider, resolveLines, useCart } from './cart'
import CartSheet from './components/CartSheet'
import CategoryStrip, { useActiveCategory } from './components/CategoryStrip'
import Header from './components/Header'
import ItemCard from './components/ItemCard'
import ItemSheet from './components/ItemSheet'
import OrdersSheet from './components/OrdersSheet'
import SessionBanner from './components/SessionBanner'
import { formatMoney } from '../../shared/money'
import { LangContext, pickLanguage, saveLanguage, translate, useT } from './i18n'
import { useGuestRealtime } from './realtime'
import type { GuestItem, GuestMenu, GuestSession } from './types'

// ?error=... comes from the /t/{token} redirect when a QR is invalid
const qrError = new URLSearchParams(location.search).get('error')
if (qrError) history.replaceState(null, '', '/')

export default function App() {
  const menu = useMenu()
  const [lang, setLangState] = useState<string | null>(null)

  useEffect(() => {
    if (menu.data && !lang) {
      const r = menu.data.restaurant
      const picked = pickLanguage(r.languages, r.default_language)
      setLangState(picked)
      document.documentElement.lang = picked
    }
  }, [menu.data, lang])

  const setLang = useCallback((l: string) => {
    saveLanguage(l)
    setLangState(l)
  }, [])

  if (menu.isError && !menu.data) {
    const l = navigator.language.slice(0, 2)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-slate-600">{translate(l, 'loadError')}</p>
        <button className="rounded-full bg-slate-900 px-6 py-2.5 text-white" onClick={() => menu.refetch()}>
          {translate(l, 'retry')}
        </button>
      </div>
    )
  }
  if (!menu.data || !lang) return <Skeleton />

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <CartProvider>
        <MenuScreen menu={menu.data} />
      </CartProvider>
    </LangContext.Provider>
  )
}

function useSessionState(session: GuestSession | undefined) {
  // Flip to "expired" on time even between polls
  const [, tick] = useState(0)
  useEffect(() => {
    if (session?.status !== 'active' || !session.expires_at) return
    const ms = new Date(session.expires_at).getTime() - Date.now()
    const timer = setTimeout(() => tick((n) => n + 1), Math.max(0, Math.min(ms + 500, 2 ** 31 - 1)))
    return () => clearTimeout(timer)
  }, [session])

  if (qrError === 'invalid_qr' || qrError === 'table_inactive') {
    if (!session?.status || session.status !== 'active') return qrError
  }
  if (!session || session.status === null) return 'none'
  if (session.status === 'active' && session.expires_at && new Date(session.expires_at) <= new Date()) return 'expired'
  return session.status
}

function MenuScreen({ menu }: { menu: GuestMenu }) {
  const t = useT()
  const { lang } = useContext(LangContext)
  const session = useSession()
  const reason = useSessionState(session.data)
  const orders = useOrders()
  useGuestRealtime(session.isSuccess ? (session.data.expires_at ?? null) : undefined)
  const [query, setQuery] = useState('')
  const [openItemId, setOpenItemId] = useState<number | null>(null)
  const [panel, setPanel] = useState<'cart' | 'orders' | null>(null)
  const closePanel = useCallback(() => setPanel(null), [])
  const { restaurant } = menu
  const fallback = restaurant.default_language

  const q = query.trim().toLowerCase()
  const categories = useMemo(() => {
    if (!q) return menu.categories
    const hit = (i: GuestItem) =>
      [...Object.values(i.name), ...Object.values(i.description)].some((s) => s.toLowerCase().includes(q))
    return menu.categories.map((c) => ({ ...c, items: c.items.filter(hit) })).filter((c) => c.items.length)
  }, [menu.categories, q])

  const active = useActiveCategory(categories.map((c) => c.id))
  const groupsById = useMemo(() => new Map(menu.modifier_groups.map((g) => [g.id, g])), [menu.modifier_groups])

  // The open dish may disappear (switched off in the admin): close the sheet then
  const openItem = openItemId === null ? null : menu.categories.flatMap((c) => c.items).find((i) => i.id === openItemId)
  const closeSheet = useCallback(() => setOpenItemId(null), [])

  useEffect(() => {
    document.title = tr(restaurant.name, lang, fallback) || 'Menu'
  }, [restaurant.name, lang, fallback])

  return (
    <div className="mx-auto min-h-screen max-w-lg pb-28">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur">
        <Header
          restaurant={restaurant}
          tableNumber={session.data?.table?.number ?? null}
          query={query}
          onQuery={setQuery}
        />
        <CategoryStrip categories={categories} active={active} fallbackLang={fallback} />
      </header>

      <SessionBanner reason={reason} />

      {menu.categories.length === 0 && <p className="p-10 text-center text-slate-500">{t('emptyMenu')}</p>}
      {q && categories.length === 0 && <p className="p-10 text-center text-slate-500">{t('nothingFound')}</p>}

      {categories.map((c) => (
        <section key={c.id} id={`cat-${c.id}`} data-section={c.id} className="px-4 pt-6">
          <h2 className="text-2xl font-bold">{tr(c.name, lang, fallback)}</h2>
          <div>
            {c.items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                currency={restaurant.currency}
                fallbackLang={fallback}
                onOpen={() => setOpenItemId(item.id)}
              />
            ))}
          </div>
        </section>
      ))}

      <BottomBar
        menu={menu}
        ordersCount={orders.data?.length ?? 0}
        onCart={() => setPanel('cart')}
        onOrders={() => setPanel('orders')}
      />

      {panel === 'cart' && (
        <CartSheet
          menu={menu}
          canOrder={reason === 'active'}
          onClose={closePanel}
          onOrdered={() => setPanel('orders')}
        />
      )}
      {panel === 'orders' && (
        <OrdersSheet
          orders={orders.data ?? []}
          currency={restaurant.currency}
          fallbackLang={fallback}
          onClose={closePanel}
        />
      )}

      {openItem && (
        <ItemSheet
          item={openItem}
          groups={openItem.modifier_group_ids.map((id) => groupsById.get(id)!).filter(Boolean)}
          currency={restaurant.currency}
          fallbackLang={fallback}
          onClose={closeSheet}
        />
      )}
    </div>
  )
}

function BottomBar({
  menu,
  ordersCount,
  onCart,
  onOrders,
}: {
  menu: GuestMenu
  ordersCount: number
  onCart: () => void
  onOrders: () => void
}) {
  const t = useT()
  const { lang } = useContext(LangContext)
  const cart = useCart()
  const lines = resolveLines(cart.lines, menu)
  const count = cart.lines.reduce((n, l) => n + l.quantity, 0)
  const total = lines.reduce((sum, r) => sum + (r.available ? r.unit * r.line.quantity : 0), 0)
  if (!count && !ordersCount) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {ordersCount > 0 && (
        <button
          onClick={onOrders}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-semibold shadow-lg"
        >
          {t('myOrders')}
        </button>
      )}
      {count > 0 && (
        <button
          onClick={onCart}
          data-testid="cart-bar"
          className="flex flex-1 items-center justify-between rounded-2xl bg-blue-600 px-5 py-3.5 font-semibold text-white shadow-lg"
        >
          <span>
            {t('cart')} · {count}
          </span>
          <span>{formatMoney(total, menu.restaurant.currency, lang)}</span>
        </button>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-lg animate-pulse p-4" aria-busy="true">
      <div className="mb-4 h-8 w-1/2 rounded bg-slate-100" />
      <div className="mb-6 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-slate-100" />
        ))}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="mb-4 flex gap-4">
          <div className="size-28 rounded-2xl bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-slate-100" />
            <div className="h-3 w-full rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}
