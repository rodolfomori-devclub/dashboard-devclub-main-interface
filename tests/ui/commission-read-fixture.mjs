export const emptyCommissionFixture = (month = '2026-10') => ({ success: true, data: {
  period: { month, startDate: `${month}-01`, endDate: `${month}-28` }, scope: 'all', sellerId: null,
  sellers: [], sales: [], summary: { salesCount: 0, gross: 0, cashCollected: 0, commission: 0, pendingCommissionCount: 0, refundedSalesCount: 0 },
  status: { partial: false, loading: false, attributionAvailable: true, sources: [], generatedAt: `${month}-01T15:00:00Z` },
  rules: { status: 'not_configured', message: 'A gestão ainda precisa configurar a regra de comissão.' },
} })

export const emptyUtmMappingFixture = { success: true, data: { available: true, mappings: [], suggestions: [] } }
