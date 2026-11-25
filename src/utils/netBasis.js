import { usesPlatformNet } from './platformCash.js'

// Where a row's net comes from. Guru is estimated by the admin fee table;
// Hotmart and Hubla report the net themselves; other platforms carry the
// contracted value, which has no fee estimate to label.
const GURU_BASIS = {
  estimated: 'Estimado pela tabela de taxas',
  gateway_reported: 'Informado pela Guru (estimado)',
  legacy: 'Estimado pela regra anterior',
  real: 'Real, informado pelo gateway',
}

export function netBasisLabel(row) {
  if (!usesPlatformNet(row)) return null
  const source = String(row?.sourceId || row?.source || '').toLowerCase()
  if (source === 'guru' || source === 'gururefunds') return GURU_BASIS[row?.netBasis] || 'Estimado pela regra anterior'
  return row?.isManual ? 'Informado no lançamento manual' : 'Informado pela plataforma'
}
