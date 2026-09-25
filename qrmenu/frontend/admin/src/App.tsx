import { Navigate, Route, Routes } from 'react-router-dom'

import { useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import TablesPage from './pages/TablesPage'

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <LoginPage />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/tables" element={<TablesPage />} />
        <Route path="*" element={<Navigate to="/tables" replace />} />
      </Route>
    </Routes>
  )
}
