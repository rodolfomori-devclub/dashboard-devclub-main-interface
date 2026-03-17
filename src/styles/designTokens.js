// DevClub Design System Tokens
// Reference: https://design-system-production-5869.up.railway.app/styleguide

// Chart color palette (consistent across all dashboards)
export const CHART_COLORS = ['#22c55e', '#7c3aed', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#14b8a6', '#f97316']

// Semantic status colors
export const STATUS_COLORS = {
  success: '#22c55e',
  info: '#3b82f6',
  warning: '#f59e0b',
  danger: '#ef4444',
  accent: '#7c3aed',
}

// Recharts tooltip style
export const TOOLTIP_STYLE = {
  backgroundColor: '#141419',
  border: '1px solid #27272a',
  borderRadius: '12px',
  color: '#fafafa',
  fontSize: '12px',
}

// Reusable class strings for DS components
export const DS = {
  // Cards
  card: 'bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] shadow-sm',
  cardPadding: 'p-4 sm:p-6',
  cardHighlight: 'bg-white dark:bg-[#141419] rounded-xl border-2 border-primary shadow-sm',

  // Buttons
  btnPrimary: 'px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors',
  btnSecondary: 'px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors',
  btnGhost: 'px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors',
  btnDanger: 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors',
  btnSm: 'px-3 py-1.5 text-sm',
  btnIcon: 'flex items-center gap-2',

  // Form controls
  input: 'w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:border-primary transition-colors',
  select: 'w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:border-primary transition-colors',
  label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1',

  // Table
  table: 'min-w-full',
  thead: 'bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-200/50 dark:border-gray-700/50',
  th: 'px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider',
  thCenter: 'px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider',
  tbody: 'divide-y divide-gray-100 dark:divide-gray-800/50',
  tr: 'hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors',
  td: 'px-4 py-3 text-sm text-gray-700 dark:text-gray-300',
  tdCenter: 'px-4 py-3 text-sm text-gray-700 dark:text-gray-300 text-center',

  // Badges
  badge: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
  badgeSuccess: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  badgeWarning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  badgeDanger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  badgeInfo: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  badgeAccent: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  badgeDefault: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',

  // Typography
  h1: 'text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white',
  h2: 'text-xl sm:text-2xl font-bold text-gray-900 dark:text-white',
  h3: 'text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-200',
  h4: 'text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200',
  textMuted: 'text-sm text-gray-500 dark:text-gray-400',
  textXs: 'text-xs text-gray-500 dark:text-gray-400',

  // Layout
  page: 'space-y-6 pb-8',
  section: 'space-y-4',
  gridKpi: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4',
  gridCharts: 'grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6',

  // Modal
  modalOverlay: 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4',
  modalContent: 'bg-white dark:bg-[#141419] rounded-xl border border-gray-200 dark:border-[#27272a] shadow-xl w-full max-h-[90vh] overflow-y-auto',

  // Grid stroke for charts
  gridStroke: '#27272a',
}
