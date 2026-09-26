import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { tr } from '../../shared/localized'
import { GUEST_SOURCE, isPreviewCommand, type RestaurantDraft } from '../../shared/preview'
import { useMenu, useOrders, useSession } from './api'
import { CartProvider, resolveLines, useCart } from './cart'
import CartSheet from './components/CartSheet'
import CategoryStrip, { scrollToCategory, useActiveCategory } from './components/CategoryStrip'
import Header from './components/Header'
import HomeScreen from './components/HomeScreen'
import ItemCard from './components/ItemCard'
import ItemSheet from './components/ItemSheet'
import OrdersSheet from './components/OrdersSheet'
import ServiceButtons from './components/ServiceButtons'
import SessionBanner, { SESSION_MESSAGES } from './components/SessionBanner'
import Toast from './components/Toast'
import { formatMoney } from '../../shared/money'
import { LangContext, pickLanguage, saveLanguage, translate, useT } from './i18n'
import { isPreview, previewLang, previewView } from './preview'
import { useGuestRealtime } from './realtime'
import type { GuestItem, GuestMenu, GuestSession } from './types'

// ?error=... comes from the /t/{token} redirect when a QR is invalid
const params = new URLSearchParams(location.search)
const qrError = params.get('error')
if (qrError) history.replaceState(null, '', '/')

export default function App() {
  const menu = useMenu()
  const [lang, setLangState] = useState<string | null>(null)

  useEffect(() => {
    if (menu.data && !lang) {
      const r = menu.data.restaurant
      const picked =
        isPreview && previewLang && r.languages.includes(previewLang)
          ? previewLang
          : pickLanguage(r.languages, r.default_language)
      setLangState(picked)
      document.documentElement.lang = picked
    }
  }, [menu.data, lang])

  const setLang = useCallback((l: string) => {
    if (!isPreview) saveLanguage(l)
    setLangState(l)
  }, [])

  if (menu.isError && !menu.data) {
    const l = navigator.language.slice(0, 2)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted">{translate(l, 'loadError')}</p>
        <button className="rounded-full bg-wine px-6 py-2.5 text-white" onClick={() => menu.refetch()}>
          {translate(l, 'retry')}
        </button>
      </div>
    )
  }
  if (!menu.data || !lang) return <Skeleton />

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <CartProvider>
        <GuestScreen menu={menu.data} />
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
  // Still loading: no "scan the QR" flash and no blocked buttons; the server checks anyway
  if (!session) return 'loading'
  if (session.status === null) return 'none'
  if (session.status === 'active' && session.expires_at && new Date(session.expires_at) <= new Date()) return 'expired'
  return session.status
}

type View = 'home' | 'menu'

/** Home and menu are two screens of one page: the menu gets its own history entry, so the phone's
 * Back button returns to the home screen. */
function useView(): [View, (v: View) => void] {
  const viewOf = (state: { view?: string } | null): View =>
    state?.view === 'menu' || (isPreview && previewView === 'menu') ? 'menu' : 'home'
  const [view, setViewState] = useState<View>(() => viewOf(history.state))
  // "Back to home" pressed while a just-closed sheet still has its own history entry to unwind:
  // keep stepping back until the entry before the menu
  const goingHome = useRef(false)
  useEffect(() => {
    const onPop = () => {
      const next = viewOf(history.state)
      if (goingHome.current) {
        if (next === 'menu') {
          history.back()
          return
        }
        goingHome.current = false
      }
      setViewState(next)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const setView = useCallback((v: View) => {
    if (v === 'menu') {
      if (history.state?.view !== 'menu') history.pushState({ view: 'menu' }, '')
    } else if (history.state?.view === 'menu') {
      goingHome.current = true
      // a closing sheet steps back on its own; otherwise step back from the menu entry now
      if (!history.state?.sheet) history.back()
    }
    setViewState(v)
  }, [])
  return [view, setView]
}

function GuestScreen({ menu: loaded }: { menu: GuestMenu }) {
  const [view, setView] = useView()
  // In the admin's preview, unsaved welcome-screen settings are shown on top of the saved ones
  const [draft, setDraft] = useState<RestaurantDraft | null>(null)
  const menu = useMemo(
    () => (draft ? { ...loaded, restaurant: { ...loaded.restaurant, ...draft } } : loaded),
    [loaded, draft],
  )
  const t = useT()
  const { lang } = useContext(LangContext)
  const session = useSession()
  const reason = useSessionState(session.data)
  const orders = useOrders()
  // i18n key explaining why ordering and calls are unavailable right now
  // (the admin's preview has no session: it never blocks, actions just aren't sent)
  const blockedReason =
    isPreview || reason === 'active' || reason === 'loading' ? null : (SESSION_MESSAGES[reason] ?? 'rescan')
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  useGuestRealtime(session.isSuccess ? (session.data.expires_at ?? null) : undefined, (call) => {
    if (call.status === 'taken') setToast(t('waiterComingToast'))
  })
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

  // Each screen starts at its top
  useEffect(() => window.scrollTo(0, 0), [view])

  // In the admin's preview, the menu page can point at a dish or a category
  useEffect(() => {
    if (!isPreview) return
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || !isPreviewCommand(e.data)) return
      if (e.data.type === 'restaurant-draft') {
        setDraft(e.data.restaurant)
        return
      }
      setPanel(null)
      setQuery('')
      setView('menu')
      if (e.data.type === 'show-item') setOpenItemId(e.data.itemId)
      else {
        setOpenItemId(null)
        const id = e.data.categoryId
        setTimeout(() => scrollToCategory(id), 50) // after the menu screen has rendered
      }
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ source: GUEST_SOURCE, type: 'ready' }, location.origin)
    return () => window.removeEventListener('message', onMessage)
  }, [setView])

  useEffect(() => {
    document.title = tr(restaurant.name, lang, fallback) || 'Menu'
  }, [restaurant.name, lang, fallback])

  const tableNumber = session.data?.table?.number ?? null

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-cream">
      {view === 'home' ? (
        <HomeScreen
          menu={menu}
          tableNumber={tableNumber}
          blockedReason={blockedReason}
          banner={!isPreview && <SessionBanner reason={reason} />}
          notify={setToast}
          onMenu={() => setView('menu')}
          onItem={(id) => {
            setView('menu')
            setOpenItemId(id)
          }}
          orders={orders.data ?? []}
          onOrders={() => setPanel('orders')}
        />
      ) : (
        <div className="pb-44">
          <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur">
            <Header
              restaurant={restaurant}
              tableNumber={tableNumber}
              query={query}
              onQuery={setQuery}
              // the admin's menu page previews the menu alone
              onBack={isPreview && previewView === 'menu' ? undefined : () => setView('home')}
            />
            <CategoryStrip categories={categories} active={active} fallbackLang={fallback} />
          </header>

          {!isPreview && <SessionBanner reason={reason} />}

          {menu.categories.length === 0 && <p className="p-10 text-center text-muted">{t('emptyMenu')}</p>}
          {q && categories.length === 0 && <p className="p-10 text-center text-muted">{t('nothingFound')}</p>}

          {categories.map((c) => (
            <section key={c.id} id={`cat-${c.id}`} data-section={c.id} className="px-4 pt-6">
              <h2 className="font-serif text-2xl font-bold">{tr(c.name, lang, fallback)}</h2>
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
        </div>
      )}

      <BottomBar
        menu={menu}
        withService={view === 'menu'}
        ordersCount={orders.data?.length ?? 0}
        blockedReason={blockedReason}
        notify={setToast}
        onCart={() => setPanel('cart')}
        onOrders={() => setPanel('orders')}
      />
      {toast && <Toast text={toast} onDone={clearToast} />}

      {panel === 'cart' && (
        <CartSheet
          menu={menu}
          blockedReason={blockedReason}
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
  withService,
  ordersCount,
  blockedReason,
  notify,
  onCart,
  onOrders,
}: {
  menu: GuestMenu
  withService: boolean // the home screen has its own big buttons
  ordersCount: number
  blockedReason: string | null
  notify: (text: string) => void
  onCart: () => void
  onOrders: () => void
}) {
  const t = useT()
  const { lang } = useContext(LangContext)
  const cart = useCart()
  const lines = resolveLines(cart.lines, menu)
  const count = cart.lines.reduce((n, l) => n + l.quantity, 0)
  const total = lines.reduce((sum, r) => sum + (r.available ? r.unit * r.line.quantity : 0), 0)
  if (!withService && count === 0 && ordersCount === 0) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg flex-col gap-2 bg-gradient-to-t from-cream via-cream/95 to-cream/0 p-3 pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {withService && <ServiceButtons blockedReason={blockedReason} notify={notify} />}
      {(count > 0 || ordersCount > 0) && (
        <div className="flex gap-2">
          {ordersCount > 0 && (
            <button
              onClick={onOrders}
              className="rounded-2xl border border-line bg-paper px-4 py-3.5 font-semibold shadow-lg"
            >
              {t('myOrders')}
            </button>
          )}
          {count > 0 && (
            <button
              onClick={onCart}
              data-testid="cart-bar"
              className="flex flex-1 items-center justify-between rounded-2xl bg-wine px-5 py-3.5 font-semibold text-white shadow-lg"
            >
              <span>
                {t('cart')} · {count}
              </span>
              <span>{formatMoney(total, menu.restaurant.currency, lang)}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-lg animate-pulse p-4" aria-busy="true">
      <div className="mb-4 h-8 w-1/2 rounded bg-line" />
      <div className="mb-6 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-line" />
        ))}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="mb-4 flex gap-4">
          <div className="size-28 rounded-2xl bg-line" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-line" />
            <div className="h-3 w-full rounded bg-line" />
          </div>
        </div>
      ))}
    </div>
  )
}
