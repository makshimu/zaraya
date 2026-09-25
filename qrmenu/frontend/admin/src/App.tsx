import { Navigate, Route, Routes } from 'react-router-dom'

import { useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import { RealtimeProvider } from './realtime'
import MenuPage from './pages/menu/MenuPage'
import OrdersPage from './pages/OrdersPage'
import SettingsPage from './pages/SettingsPage'
import TablesPage from './pages/TablesPage'

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <LoginPage />

  return (
    <RealtimeProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/tables" element={<TablesPage />} />
          {user.role === 'admin' && <Route path="/settings" element={<SettingsPage />} />}
          <Route path="*" element={<Navigate to="/orders" replace />} />
        </Route>
      </Routes>
    </RealtimeProvider>
  )
}
