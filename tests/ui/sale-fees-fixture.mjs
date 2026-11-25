// GET /api/sale-fees for admin smokes: no saved table yet, with the owner's defaults.
const pagarme = card => ({ card, pix: { rate: 0.005, fixed: 0.44 }, boleto: { rate: 0, fixed: 2.99 } })
export const saleFeesDefaults = effectiveFrom => ({ effectiveFrom, activeScenario: 'atual', tmb: { cashRate: 0.4 }, scenarios: [
  { id: 'atual', label: 'ATUAL', pagarme: pagarme([0.0322, 0.0451, 0.0527, 0.0602, 0.0678, 0.0754, 0.0844, 0.0919, 0.0995, 0.1071, 0.1146, 0.1222]) },
  { id: 'reneg', label: 'RENEG', pagarme: pagarme([0.0307, 0.0435, 0.0511, 0.0587, 0.0663, 0.0739, 0.0819, 0.0895, 0.0971, 0.1047, 0.1123, 0.1198]) },
] })
export const emptySaleFeesFixture = { settings: { version: 1, schedules: [] }, revision: 0, updatedAt: null, defaults: saleFeesDefaults('2026-11-25') }
