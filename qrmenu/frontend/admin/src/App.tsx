import { Navigate, Route, Routes } from 'react-router-dom'

import { useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import { RealtimeProvider } from './realtime'
import HallPage from './pages/HallPage'
import MenuPage from './pages/menu/MenuPage'
import OrdersPage from './pages/OrdersPage'
import SettingsPage from './pages/SettingsPage'
import TablesPage from './pages/TablesPage'
import UsersPage from './pages/UsersPage'

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
          {user.role === 'admin' && <Route path="/users" element={<UsersPage />} />}
          {user.role === 'admin' && <Route path="/settings" element={<SettingsPage />} />}
          <Route path="*" element={<Navigate to="/hall" replace />} />
        </Route>
      </Routes>
    </RealtimeProvider>
  )
}
