import { useEffect, useRef } from 'react'
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Header from './components/Header'
import DailyDashboard from './pages/DailyDashboard'
import MonthlyDashboard from './pages/MonthlyDashboard'
import YearlyDashboard from './pages/YearlyDashboard'
import DataSourcesPage from './pages/DataSourcesPage'
import Today from './pages/Today'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ComparativoPage from './pages/ComparativoPage'
import GoalsPage from './pages/GoalsPage'
import TSDashboard from './pages/TSDashboard'
import TrafficDashboard from './pages/TrafficDashboard'
import TrafficMonitor from './pages/TrafficMonitor'
import LeadsPage from './pages/LeadsPage'
import VidometroPage from './pages/VidometroPage'
import RefundsPage from './pages/RefundsPage'

// Protected route — redirects to Vault login if not authenticated
const ProtectedRoute = ({ children, requiredPermission }) => {
  const { currentUser, userRoles, hasPermission, login } = useAuth()
  const loginTriggered = useRef(false)

  useEffect(() => {
    if (!currentUser && !loginTriggered.current) {
      loginTriggered.current = true
      login()
    }
  }, [currentUser, login])

  if (!currentUser || !userRoles) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Acesso negado</p>
          <p className="text-sm text-zinc-500 mt-1">Voce nao tem permissao para acessar esta pagina.</p>
        </div>
      </div>
    )
  }

  return children
}

// Admin route
const AdminRoute = ({ children }) => {
  const { userRoles, currentUser, login } = useAuth()
  const loginTriggered = useRef(false)

  useEffect(() => {
    if (!currentUser && !loginTriggered.current) {
      loginTriggered.current = true
      login()
    }
  }, [currentUser, login])

  if (!currentUser) return null

  if (!userRoles?.isAdmin) {
    return <Navigate to="/diario" replace />
  }

  return children
}

// Layout component for authenticated pages
const AuthenticatedLayout = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      <Header />
      <main className="flex-grow pt-4 px-4 md:px-6">{children}</main>
      <footer className="mt-auto py-3 px-6 text-center text-sm text-zinc-400 dark:text-zinc-600">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
          <div>
            &copy; {new Date().getFullYear()} DevClub Dashboard. Todos os
            direitos reservados.
          </div>
          <div className="mt-2 md:mt-0">
            <img
              src="/devclub-logo.png"
              alt="DevClub Logo"
              className="inline w-6 h-6 opacity-50 dark:hidden"
            />
            <img
              src="/devclub-logo-w.png"
              alt="DevClub Logo"
              className="inline w-6 h-6 opacity-50 hidden dark:inline"
            />
          </div>
        </div>
      </footer>
    </div>
  )
}

// OAuth callback handler
const CallbackPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-zinc-500">Autenticando...</p>
      </div>
    </div>
  )
}

function AppRouter() {
  return (
    <Routes>
      {/* OAuth callback */}
      <Route path="/callback" element={<CallbackPage />} />

      <Route path="/" element={<Navigate to="/diario" />} />

      <Route path="/diario" element={
        <ProtectedRoute requiredPermission="today">
          <AuthenticatedLayout><Today /></AuthenticatedLayout>
        </ProtectedRoute>
      } />

      <Route path="/global" element={
        <ProtectedRoute requiredPermission="daily">
          <AuthenticatedLayout><DailyDashboard /></AuthenticatedLayout>
        </ProtectedRoute>
      } />

      <Route path="/mensal" element={
        <ProtectedRoute requiredPermission="monthly">
          <AuthenticatedLayout><MonthlyDashboard /></AuthenticatedLayout>
        </ProtectedRoute>
      } />

      <Route path="/anual" element={
        <ProtectedRoute requiredPermission="yearly">
          <AuthenticatedLayout><YearlyDashboard /></AuthenticatedLayout>
        </ProtectedRoute>
      } />

      <Route path="/comparativo" element={
        <ProtectedRoute requiredPermission="comparativo">
          <AuthenticatedLayout><ComparativoPage /></AuthenticatedLayout>
        </ProtectedRoute>
      } />

      <Route path="/ts" element={
        <ProtectedRoute requiredPermission="ts">
          <AuthenticatedLayout><TSDashboard /></AuthenticatedLayout>
        </ProtectedRoute>
      } />

      <Route path="/trafego" element={
        <ProtectedRoute requiredPermission="traffic">
          <AuthenticatedLayout><TrafficDashboard /></AuthenticatedLayout>
        </ProtectedRoute>
      } />

      <Route path="/monitor" element={
        <ProtectedRoute>
          <AuthenticatedLayout><TrafficMonitor /></AuthenticatedLayout>
        </ProtectedRoute>
      } />

      <Route path="/metas" element={
        <ProtectedRoute requiredPermission="goals">
          <AuthenticatedLayout><GoalsPage /></AuthenticatedLayout>
        </ProtectedRoute>
      } />

      <Route path="/data-sources" element={
        <ProtectedRoute requiredPermission="data-sources">
          <AuthenticatedLayout><DataSourcesPage /></AuthenticatedLayout>
        </ProtectedRoute>
      } />

      <Route path="/leads" element={
        <ProtectedRoute requiredPermission="leads">
          <AuthenticatedLayout><LeadsPage /></AuthenticatedLayout>
        </ProtectedRoute>
      } />

      <Route path="/vidometro" element={<VidometroPage />} />

      <Route path="/reembolsos" element={
        <ProtectedRoute requiredPermission="refunds">
          <AuthenticatedLayout><RefundsPage /></AuthenticatedLayout>
        </ProtectedRoute>
      } />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/diario" />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-center" />
        <AppRouter />
      </AuthProvider>
    </Router>
  )
}

export default App
