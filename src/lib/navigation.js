// Shared catalog for navigation and guards; assignment belongs to Vault.
export const NAVIGATION = [
  { group: 'Visão do negócio', items: [
    { path: '/diario', label: 'Diário', permission: 'today', icon: 'Sun' },
    { path: '/global', label: 'Visão global', permission: 'daily', icon: 'ChartNoAxesCombined' },
    { path: '/mensal', label: 'Mensal', permission: 'monthly', icon: 'CalendarDays' },
    { path: '/anual', label: 'Anual', permission: 'yearly', icon: 'CalendarRange' },
    { path: '/comparativo', label: 'Comparativos', permission: 'comparativo', icon: 'Columns3' },
    { path: '/reembolsos', label: 'Reembolsos', permission: 'refunds', icon: 'Undo2' },
    { path: '/pace', label: 'Ritmo das metas', permission: 'goal-pace', icon: 'Gauge' },
    { path: '/atribuicao', label: 'Atribuição e conciliação', permission: 'attribution', icon: 'GitCompareArrows' },
    { path: '/metas', label: 'Metas', permission: 'goals', icon: 'Target' },
  ] },
  { group: 'Operação', items: [
    { path: '/hub', label: 'Meu espaço', permission: 'hub-home', icon: 'House' },
    { path: '/daily-kpis', label: 'KPIs diários', permission: 'daily-kpis', icon: 'ListChecks' },
    { path: '/kpi-report', label: 'Relatórios de KPIs', permission: 'kpi-report', icon: 'ClipboardList' },
    { path: '/daily-checklist', label: 'Checklist', permission: 'daily-checklist', icon: 'CheckCheck' },
    { path: '/results', label: 'Resultados', permission: 'results', icon: 'ChartColumnIncreasing' },
    { path: '/ranking', label: 'Ranking e TV', permission: 'ranking', icon: 'Trophy' },
    { path: '/materials', label: 'Materiais', permission: 'materials', icon: 'Library' },
    { path: '/sales-links', label: 'Links de venda', permission: 'sales-links', icon: 'Link' },
    { path: '/apoio-vendas', label: 'Apoio Vendas', permission: 'sales-support', icon: 'Presentation' },
    { path: '/manager-notes', label: 'Anotações', permission: 'manager-notes', icon: 'NotebookPen' },
  ] },
  { group: 'Onboarding', items: [
    { path: '/onboarding/mba', label: 'Onboarding MBA', permission: 'onboarding-mba', icon: 'GraduationCap' },
    { path: '/onboarding/devclub', label: 'Onboarding DevClub', permission: 'onboarding-devclub', icon: 'BookOpen' },
  ] },
  { group: 'Gestão', items: [
    { path: '/commissions', label: 'Minhas comissões', permission: 'commissions', icon: 'Wallet' },
    { path: '/financial', label: 'Financeiro comercial', permission: 'financial', icon: 'Landmark' },
    { path: '/dre-global', label: 'DRE Global', permission: 'dre-global', icon: 'Table2' },
    { path: '/marketing', label: 'Marketing do Hub', permission: 'marketing', icon: 'Megaphone' },
    { path: '/settings', label: 'Configurações', permission: 'settings', icon: 'Settings2' },
    { path: '/activity-log', label: 'Atividades', permission: 'activity-log', icon: 'History' },
    { path: '/data-sources', label: 'Fontes de dados', permission: 'data-sources', icon: 'Database' },
    { path: '/admin', label: 'Administração', permission: 'admin', icon: 'ShieldCheck' },
  ] },
]
export const SCREENS = NAVIGATION.flatMap(group => group.items)
export function permissionsFromUser(user) {
  const raw = user?.roles?.dashboard || []
  const permissions = Array.isArray(raw) ? raw : Object.keys(raw).filter(key => raw[key] === true)
  return { permissions, isAdmin: permissions.includes('admin') }
}
export function canAccess(user, permission) {
  const access = permissionsFromUser(user)
  return access.isAdmin || access.permissions.includes(permission)
}
