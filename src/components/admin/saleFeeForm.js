import { brazilDate } from '../../utils/goalPace.js'

// Pure conversions for the sale fee table editor. Inputs are pt-BR text
// ("12,22" percent, "0,44" reais); the API stores fractions and reais.
const decimal = (text, places) => {
  const value = String(text ?? '').trim().replace(/\s/g, '').replace(',', '.')
  if (!new RegExp(`^\\d+(\\.\\d{1,${places}})?$`).test(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
const format = (value, places) => Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: places, useGrouping: false })

export const percentInput = rate => format(Math.round(rate * 1e6) / 1e4, 4)
export const moneyInput = value => format(value, 2)

export function percentValue(text) {
  const percent = decimal(text, 4)
  return percent === null || percent >= 100 ? null : Math.round(percent * 1e4) / 1e6
}
export function moneyValue(text) {
  const value = decimal(text, 2)
  return value === null || value > 1000 ? null : value
}

export function draftFromSchedule(schedule) {
  return {
    effectiveFrom: schedule.effectiveFrom, activeScenario: schedule.activeScenario, tmbCashRate: percentInput(schedule.tmb.cashRate),
    scenarios: schedule.scenarios.map(scenario => ({
      id: scenario.id, label: scenario.label, card: scenario.pagarme.card.map(percentInput),
      pixRate: percentInput(scenario.pagarme.pix.rate), pixFixed: moneyInput(scenario.pagarme.pix.fixed),
      boletoRate: percentInput(scenario.pagarme.boleto.rate), boletoFixed: moneyInput(scenario.pagarme.boleto.fixed),
    })),
  }
}

// Returns { schedule } or { error } with the first field to fix; never guesses.
export function scheduleFromDraft(draft) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.effectiveFrom || '')) return { error: 'Informe a data de início da vigência.' }
  const tmb = percentValue(draft.tmbCashRate)
  if (!tmb) return { error: 'Informe o percentual da TMB entre 0% e 100%, com até 4 casas.' }
  const scenarios = []
  for (const scenario of draft.scenarios) {
    const card = scenario.card.map(percentValue)
    const missing = card.findIndex(rate => rate === null)
    if (missing >= 0) return { error: `Revise a taxa do cartão em ${missing + 1}x no cenário ${scenario.label}.` }
    const pix = { rate: percentValue(scenario.pixRate), fixed: moneyValue(scenario.pixFixed) }
    const boleto = { rate: percentValue(scenario.boletoRate), fixed: moneyValue(scenario.boletoFixed) }
    if ([pix.rate, pix.fixed, boleto.rate, boleto.fixed].some(value => value === null)) return { error: `Revise as taxas de Pix e boleto no cenário ${scenario.label}.` }
    scenarios.push({ id: scenario.id, label: scenario.label, pagarme: { card, pix, boleto } })
  }
  return { schedule: { effectiveFrom: draft.effectiveFrom, activeScenario: draft.activeScenario, scenarios, tmb: { cashRate: tmb } } }
}

// Calendar days read as written; saved instants as the Brasília day.
export function dayLabel(value) {
  if (!value) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('/')
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : brazilDate(date).split('-').reverse().join('/')
}

// The table keeps one schedule per start date, in date order. Editing a
// schedule moves it; a start date taken by another schedule is refused.
export function placeSchedule(schedules, schedule, replacing = null) {
  const others = schedules.filter(item => item.effectiveFrom !== replacing)
  if (others.some(item => item.effectiveFrom === schedule.effectiveFrom)) {
    return { error: `Já existe uma vigência a partir de ${dayLabel(schedule.effectiveFrom)}. Edite essa vigência ou escolha outra data.` }
  }
  return { schedules: [...others, schedule].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)) }
}

const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
const termsOn = (schedules, day) => {
  const schedule = schedules.filter(item => item.effectiveFrom <= day).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).at(-1)
  return schedule ? JSON.stringify(canonical({ ...schedule, effectiveFrom: null })) : null
}
// Whether the next table prices some day before today differently from the
// saved one. The schedule in force changes only on a start date, so checking
// every past start date of both tables covers every past day.
export function changesPast(saved, next, today) {
  return [...new Set([...saved, ...next].map(item => item.effectiveFrom))]
    .some(day => day < today && termsOn(saved, day) !== termsOn(next, day))
}

// Up to 12 calendar months ending today: the API previews at most 366 days.
export function defaultPreviewRange(today) {
  const month = Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 12
  return { startDate: `${Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, '0')}-01`, endDate: today }
}

const RULES = {
  'pagarme.pix': 'Pagar.me · Pix', 'pagarme.boleto': 'Pagar.me · boleto', 'mercadopago.reported': 'Mercado Pago · líquido informado pela Guru',
  'legacy:installments': 'Regra anterior · parcelas sem taxa na tabela', 'legacy:gateway': 'Regra anterior · provedor fora da tabela',
  'legacy:no_schedule': 'Regra anterior · venda antes da vigência', 'legacy:currency': 'Regra anterior · moeda estrangeira',
  'legacy:affiliate': 'Regra anterior · venda com afiliado', 'legacy:charged_amount': 'Regra anterior · sem valor cobrado',
  'legacy:method': 'Regra anterior · meio de pagamento fora da tabela', 'legacy:gateway_net': 'Regra anterior · Mercado Pago sem líquido informado',
}
export const ruleLabel = rule => /^pagarme\.card\.\d+$/.test(rule) ? `Pagar.me · cartão ${rule.split('.').pop()}x` : RULES[rule] || rule
