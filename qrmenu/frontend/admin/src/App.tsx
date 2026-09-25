import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import HallPage from './pages/HallPage'
import LoginPage from './pages/LoginPage'
import OrdersPage from './pages/OrdersPage'
import { RealtimeProvider } from './realtime'

// The live screens load with the app; the rest on first visit
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const MenuPage = lazy(() => import('./pages/menu/MenuPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const TablesPage = lazy(() => import('./pages/TablesPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <LoginPage />

  return (
    <RealtimeProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/hall" element={<HallPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/tables" element={<TablesPage />} />
          {user.role === 'admin' && <Route path="/analytics" element={<AnalyticsPage />} />}
          {user.role === 'admin' && <Route path="/users" element={<UsersPage />} />}
          {user.role === 'admin' && <Route path="/settings" element={<SettingsPage />} />}
          <Route path="*" element={<Navigate to="/hall" replace />} />
        </Route>
      </Routes>
    </RealtimeProvider>
  )
}
