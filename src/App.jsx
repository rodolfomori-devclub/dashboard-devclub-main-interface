import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom'
import Header from './components/Header'
import DailyDashboard from './pages/DailyDashboard'
import MonthlyDashboard from './pages/MonthlyDashboard'
import YearlyDashboard from './pages/YearlyDashboard'
import DREDashboard from './pages/DREDashboard'
import DataSourcesPage from './pages/DataSourcesPage'
import AdminUserPage from './pages/AdminUserPage'
import LoginPage from './pages/LoginPage'
import AccessDeniedPage from './pages/AccessDeniedPage'
import Today from './pages/Today'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ComparativoPage from './pages/ComparativoPage'
import LaunchPro from './pages/LaunchPro'
import LeadScoringPage from './pages/LeadScoringPage'

// Update the imports in App.jsx by adding these lines:
import CommercialDashboardPage from './pages/CommercialDashboardPage'
import CommercialSellersPage from './pages/CommercialSellersPage'
import CommercialSalesListPage from './pages/CommercialSalesListPage'
import TSDashboard from './pages/TSDashboard'

// Protected route component
const ProtectedRoute = ({ children, requiredPermission }) => {
  const { currentUser, hasPermission } = useAuth()

  // If no user is logged in, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" />
  }

  // If a specific permission is required, check it
  if (requiredPermission && !hasPermission(requiredPermission)) {
    // Redirect to access denied page instead of root
    return <Navigate to="/access-denied" state={{ requiredPermission }} />
  }

  return children
}

// Admin route component
const AdminRoute = ({ children }) => {
  const { userRoles } = useAuth()

  if (!userRoles?.isAdmin) {
    return (
      <Navigate to="/access-denied" state={{ requiredPermission: 'admin' }} />
    )
  }

  return children
}

// Layout component for authenticated pages
const AuthenticatedLayout = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
      <Header />
      <main className="flex-grow pt-4 px-4 md:px-6">{children}</main>
      <footer className="mt-auto py-3 px-6 text-center text-sm text-gray-500 dark:text-gray-400">
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

// App router with authentication wrapper
function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/access-denied" element={<AccessDeniedPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute requiredPermission="today">
            <AuthenticatedLayout>
              <Today />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/daily"
        element={
          <ProtectedRoute requiredPermission="daily">
            <AuthenticatedLayout>
              <DailyDashboard />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/monthly"
        element={
          <ProtectedRoute requiredPermission="monthly">
            <AuthenticatedLayout>
              <MonthlyDashboard />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/yearly"
        element={
          <ProtectedRoute requiredPermission="yearly">
            <AuthenticatedLayout>
              <YearlyDashboard />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/commercial"
        element={
          <ProtectedRoute requiredPermission="commercial">
            <AuthenticatedLayout>
              <CommercialDashboardPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/commercial/sellers"
        element={
          <ProtectedRoute requiredPermission="commercial">
            <AuthenticatedLayout>
              <CommercialSellersPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      {/* Nova rota para listar todas as vendas */}
      <Route
        path="/commercial/sales"
        element={
          <ProtectedRoute requiredPermission="commercial">
            <AuthenticatedLayout>
              <CommercialSalesListPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/comparativo"
        element={
          <ProtectedRoute requiredPermission="commercial">
            <AuthenticatedLayout>
              <ComparativoPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dre"
        element={
          <ProtectedRoute requiredPermission="dre">
            <AuthenticatedLayout>
              <DREDashboard />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

<Route
        path="/launch"
        element={
          <ProtectedRoute requiredPermission="dre">
            <AuthenticatedLayout>
              <LaunchPro />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/lead-scoring"
        element={
          <ProtectedRoute requiredPermission="lead-scoring">
            <AuthenticatedLayout>
              <LeadScoringPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/ts"
        element={
          <ProtectedRoute requiredPermission="ts">
            <AuthenticatedLayout>
              <TSDashboard />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <AuthenticatedLayout>
              <AdminUserPage />
            </AuthenticatedLayout>
          </AdminRoute>
        }
      />

      <Route
        path="/data-sources"
        element={
          <ProtectedRoute requiredPermission="data-sources">
            <AuthenticatedLayout>
              <DataSourcesPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      {/* Catch all - redirect to login */}
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </Router>
  )
}

export default App
