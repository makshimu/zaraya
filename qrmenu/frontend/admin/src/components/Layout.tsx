import { BookOpen, LogOut, QrCode } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import LanguageSwitcher from './LanguageSwitcher'

const NAV = [
  { to: '/menu', label: 'nav.menu', icon: BookOpen },
  { to: '/tables', label: 'nav.tables', icon: QrCode },
]

export default function Layout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen text-slate-900">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-3">
        <div className="mb-4 rounded-xl bg-violet-500 px-4 py-3 font-semibold text-white">{t('app.title')}</div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
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
              {t(label)}
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
        <header className="flex items-center justify-end border-b border-slate-200 bg-white px-6 py-3">
          <LanguageSwitcher />
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
