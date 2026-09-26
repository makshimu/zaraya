import {
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  LayoutGrid,
  LogOut,
  QrCode,
  Receipt,
  Settings,
  UserCog,
  X,
} from 'lucide-react'
import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useOpenCalls } from '../api/hall'
import { useOrders } from '../api/orders'
import { useAuth } from '../auth/AuthContext'
import { useRealtime } from '../realtime'
import LanguageSwitcher from './LanguageSwitcher'

const NAV = [
  { to: '/hall', label: 'nav.hall', icon: LayoutGrid, badge: 'calls' },
  { to: '/orders', label: 'nav.orders', icon: Receipt, badge: 'pending' },
  { to: '/menu', label: 'nav.menu', icon: BookOpen },
  { to: '/tables', label: 'nav.tables', icon: QrCode },
  { to: '/analytics', label: 'nav.analytics', icon: BarChart3, adminOnly: true },
  { to: '/users', label: 'nav.users', icon: UserCog, adminOnly: true },
  { to: '/settings', label: 'nav.settings', icon: Settings, adminOnly: true },
]

export default function Layout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const realtime = useRealtime()
  const pending = useOrders({ statuses: ['pending'], tableId: null, date: null }).data?.length ?? 0
  const calls = useOpenCalls().data?.length ?? 0
  const badges: Record<string, number> = { pending, calls }

  return (
    <div className="flex min-h-screen text-slate-900">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-3">
        <div className="mb-4 rounded-xl bg-violet-500 px-4 py-3 font-semibold text-white">{t('app.title')}</div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.filter((n) => !n.adminOnly || user?.role === 'admin').map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                  isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-50'
                }`
              }
            >
              <Icon className="size-5" aria-hidden />
              <span className="flex-1">{t(label)}</span>
              {badge && badges[badge] > 0 && (
                <span
                  data-testid={`${badge}-badge`}
                  className="flex size-6 items-center justify-center rounded-full bg-blue-500 text-xs font-semibold text-white"
                >
                  {badges[badge]}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 pt-3 text-sm">
          <div className="truncate px-3 font-medium">{user?.name || user?.email}</div>
          <div className="px-3 text-slate-500">{user && t(`roles.${user.role}`)}</div>
          <button
            onClick={logout}
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50"
          >
            <LogOut className="size-4" aria-hidden />
            {t('nav.logout')}
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <span
            className="flex items-center gap-2 text-sm text-slate-500"
            title={t(realtime.connected ? 'realtime.online' : 'realtime.offline')}
          >
            <span className={`size-2 rounded-full ${realtime.connected ? 'bg-green-500' : 'bg-red-400'}`} />
            {t(realtime.connected ? 'realtime.online' : 'realtime.offline')}
          </span>
          {(!realtime.soundOn || !realtime.notificationsOn) && (
            <button
              onClick={realtime.enableNotifications}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <Bell className="size-4" /> {t('realtime.enableNotifications')}
            </button>
          )}
          <LanguageSwitcher />
        </header>
        <main className="flex-1 p-6">
          {/* pages load lazily: keep the sidebar while one arrives */}
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <LiveAlerts />
    </div>
  )
}

/** New orders and calls pop up in the corner of whatever page is open, together with the chime. */
function LiveAlerts() {
  const { alerts, dismissAlert } = useRealtime()
  const navigate = useNavigate()
  const { t } = useTranslation()
  if (!alerts.length) return null
  return (
    <div className="fixed top-16 right-4 z-50 flex w-80 flex-col gap-2" aria-live="assertive">
      {alerts.map((a) => (
        <div
          key={a.id}
          role="alert"
          data-testid="live-alert"
          className={`flex animate-[pop_0.25s_ease-out] cursor-pointer items-start gap-3 rounded-xl border bg-white p-3 shadow-lg ${
            a.kind === 'order' ? 'border-blue-200' : 'border-amber-300'
          }`}
          onClick={() => {
            dismissAlert(a.id)
            navigate('/hall')
          }}
        >
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
              a.kind === 'order' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            {a.kind === 'order' ? <Receipt className="size-5" /> : <BellRing className="size-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{a.title}</span>
            {a.body && <span className="block text-sm text-slate-500">{a.body}</span>}
          </span>
          <button
            aria-label={t('common.close')}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
            onClick={(e) => {
              e.stopPropagation()
              dismissAlert(a.id)
            }}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
