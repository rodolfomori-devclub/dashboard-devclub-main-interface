/* eslint-disable react/prop-types -- Internal React 19 components with explicit props. */
import { Component, lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { Toaster as CommercialToaster } from './hub/components/ui/toaster'
import { Toaster as Sonner } from './hub/components/ui/sonner'
import { TooltipProvider } from './hub/components/ui/tooltip'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import WorkspaceLayout, { PageSkeleton } from './components/WorkspaceLayout'
import { SCREENS } from './lib/navigation'
import { queryClient } from './lib/queryClient'

const Today = lazy(() => import('./pages/Today'))
const Global = lazy(() => import('./pages/DailyDashboard'))
const Monthly = lazy(() => import('./pages/MonthlyDashboard'))
const Yearly = lazy(() => import('./pages/YearlyDashboard'))
const Comparativo = lazy(() => import('./pages/ComparativoPage'))
const Refunds = lazy(() => import('./pages/RefundsPage'))
const Goals = lazy(() => import('./pages/GoalsPage'))
const Pace = lazy(() => import('./pages/GoalPacePage'))
const Attribution = lazy(() => import('./pages/AttributionPage'))
const Sources = lazy(() => import('./pages/DataSourcesPage'))
const HubHome = lazy(() => import('./pages/HubHome'))
const Admin = lazy(() => import('./pages/AdminPage'))
const HubProvider = lazy(() => import('./hub/contexts/AuthContext').then(module => ({ default: module.HubProvider })))
const Settings = lazy(() => import('./pages/HubSettings'))
const Materials = lazy(() => import('./pages/MaterialsPage'))
const DailyKpis = lazy(() => import('./hub/pages/DailyKpis'))
const KpiReport = lazy(() => import('./hub/pages/KpiReport'))
const KpiDetail = lazy(() => import('./hub/pages/KpiReportSellerDetail'))
const DailyChecklist = lazy(() => import('./hub/pages/DailyChecklist'))
const Results = lazy(() => import('./hub/pages/Results'))
const Ranking = lazy(() => import('./hub/pages/Ranking'))
const SalesLinks = lazy(() => import('./hub/pages/SalesLinks'))
const ManagerNotes = lazy(() => import('./hub/pages/ManagerNotes'))
const Commissions = lazy(() => import('./hub/pages/Commissions'))
const Financial = lazy(() => import('./hub/pages/FinancialCommissions'))
const Dre = lazy(() => import('./hub/pages/DreGlobal'))
const Marketing = lazy(() => import('./hub/pages/Marketing'))
const Activities = lazy(() => import('./hub/pages/ActivityLog'))


class ScreenBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <section className="surface-panel empty-state" role="alert"><h1>Esta tela não pôde ser aberta</h1><p>Recarregue para tentar novamente.</p><button className="button mt-5" onClick={() => window.location.reload()}>Recarregar</button></section>
    return this.props.children
  }
}
function Screen({ permission, hub, children }) {
  const { hasPermission } = useAuth()
  const { pathname } = useLocation()
  if (!hasPermission(permission)) return <section className="surface-panel empty-state"><h1>Acesso não liberado</h1><p>O administrador pode liberar esta tela no Vault.</p></section>
  return <ScreenBoundary key={pathname}><Suspense fallback={<PageSkeleton />}>{hub ? <HubProvider>{children}</HubProvider> : children}</Suspense></ScreenBoundary>
}
function SessionLayout() {
  const { currentUser, userRoles, loading, error, errorCode, errorStatus, login, reload, vault } = useAuth()
  const accessKey = JSON.stringify(userRoles)
  if (loading) return <div className="session-screen"><PageSkeleton /></div>
  if (!currentUser) {
    const missingAccess = errorCode === 'DASHBOARD_ACCESS_REQUIRED'
    const unavailable = errorStatus === 503 || errorCode === 'VAULT_UNAVAILABLE'
    const title = missingAccess ? 'Acesso ao Dashboard não configurado' : errorStatus === 401 ? 'Sua sessão expirou' : unavailable ? 'Não foi possível verificar seu acesso' : 'Seu ponto de encontro com a operação.'
    const description = missingAccess
      ? 'Um administrador pode configurar o perfil e os menus desta conta no Vault, em Usuários → Acessos e Permissões → Dashboard. Depois, tente novamente aqui.'
      : unavailable ? 'A verificação está temporariamente indisponível. Tente novamente em instantes.' : 'Entre com sua conta do Vault para acessar suas ferramentas.'
    return <main className="session-screen"><section className="surface-panel session-card"><span className="eyebrow">DevClub Workspace</span><h1>{title}</h1><p>{description}</p>{error && <p className="notice notice-error" role="alert">{error}</p>}<div className="flex flex-wrap gap-3 mt-5">
      {missingAccess ? <a className="button button-primary" href={import.meta.env.VITE_VAULT_HUB_URL || vault.vaultUrl} target="_blank" rel="noopener noreferrer">Abrir Vault</a> : !unavailable && <button className="button button-primary" onClick={login}>Entrar pelo Vault</button>}
      <button className={`button${unavailable ? ' button-primary' : ''}`} onClick={reload}>Tentar novamente</button>
    </div></section></main>
  }
  return <WorkspaceLayout key={`${currentUser.uid}:${accessKey}`}><Outlet /></WorkspaceLayout>
}
function StartPage() {
  const { hasPermission } = useAuth()
  const first = SCREENS.find(screen => hasPermission(screen.permission))
  return first ? <Navigate to={first.path} replace /> : <section className="surface-panel empty-state"><h1>Seu acesso está pronto</h1><p>Peça ao administrador a liberação dos menus no Vault.</p></section>
}
function AppRouter() {
  const routes = [
    ['/diario', 'today', Today], ['/global', 'daily', Global], ['/mensal', 'monthly', Monthly], ['/anual', 'yearly', Yearly],
    ['/comparativo', 'comparativo', Comparativo], ['/reembolsos', 'refunds', Refunds], ['/metas', 'goals', Goals],
    ['/pace', 'goal-pace', Pace], ['/atribuicao', 'attribution', Attribution], ['/data-sources', 'data-sources', Sources],
    ['/hub', 'hub-home', HubHome], ['/admin', 'admin', Admin],
    ['/materials', 'materials', Materials, true], ['/settings', 'settings', Settings, true],
    ['/daily-kpis', 'daily-kpis', DailyKpis, true], ['/kpi-report', 'kpi-report', KpiReport, true],
    ['/kpi-report/:sellerId', 'kpi-report', KpiDetail, true], ['/daily-checklist', 'daily-checklist', DailyChecklist, true],
    ['/results', 'results', Results, true], ['/ranking', 'ranking', Ranking, true], ['/sales-links', 'sales-links', SalesLinks, true],
    ['/manager-notes', 'manager-notes', ManagerNotes, true], ['/commissions', 'commissions', Commissions, true],
    ['/financial', 'financial', Financial, true], ['/dre-global', 'dre-global', Dre, true], ['/marketing', 'marketing', Marketing, true],
    ['/activity-log', 'activity-log', Activities, true],
  ]
  return <Routes><Route element={<SessionLayout />}><Route index element={<StartPage />} />{routes.map(([path, permission, Page, hub]) => <Route key={path} path={path} element={<Screen permission={permission} hub={hub}><Page /></Screen>} />)}<Route path="*" element={<StartPage />} /></Route></Routes>
}
export default function PrivateWorkspace() {
  return <AuthProvider><QueryClientProvider client={queryClient}><TooltipProvider><Toaster position="top-center" /><CommercialToaster /><Sonner /><AppRouter /></TooltipProvider></QueryClientProvider></AuthProvider>
}
