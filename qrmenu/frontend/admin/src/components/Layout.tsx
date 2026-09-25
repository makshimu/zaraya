import { Bell, BookOpen, LogOut, QrCode, Receipt, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'

import { useOrders } from '../api/orders'
import { useAuth } from '../auth/AuthContext'
import { useRealtime } from '../realtime'
import LanguageSwitcher from './LanguageSwitcher'

const NAV = [
  { to: '/orders', label: 'nav.orders', icon: Receipt, badge: true },
  { to: '/menu', label: 'nav.menu', icon: BookOpen },
  { to: '/tables', label: 'nav.tables', icon: QrCode },
  { to: '/settings', label: 'nav.settings', icon: Settings, adminOnly: true },
]

export default function Layout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const realtime = useRealtime()
  const pending = useOrders({ statuses: ['pending'], tableId: null, date: null }).data?.length ?? 0

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
              {badge && pending > 0 && (
                <span
                  data-testid="pending-badge"
                  className="flex size-6 items-center justify-center rounded-full bg-blue-500 text-xs font-semibold text-white"
                >
                  {pending}
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
          {!realtime.notificationsOn && (
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
          <Outlet />
        </main>
      </div>
    </div>
  )
}
