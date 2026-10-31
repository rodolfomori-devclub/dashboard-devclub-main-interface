import test from 'node:test'
import assert from 'node:assert/strict'
import { activeTvPanels, applyTvPreset, DAILY_TV_PANELS, defaultTvSettings, isDailyTvProgram, isWeeklyTvProgram, TV_PANELS, tvWeekLabel, WEEKLY_TV_PANELS, withAvailableTvPanels } from '../src/components/tv/tvConfig.js'

test('daily preset replaces a historical fixed program with four current-day rotating scenes', () => {
  const original = { ...defaultTvSettings(), mode: 'fixed', monthMode: 'fixed', month: '2026-09', metric: 'cash', theme: 'dark', paceScope: 'team', paceScopeId: 'sales' }
  original.panels[0].durationSeconds = 120
  const settings = applyTvPreset(original, 'Modo diário')
  assert.deepEqual(activeTvPanels(settings).map(panel => panel.id), DAILY_TV_PANELS)
  assert.ok(activeTvPanels(settings).every(panel => panel.durationSeconds === 20))
  assert.equal(settings.mode, 'rotate')
  assert.equal(settings.monthMode, 'current')
  assert.equal(settings.month, '')
  assert.equal(settings.metric, 'gross')
  assert.equal(settings.paceScope, 'overall')
  assert.equal(settings.paceScopeId, '')
  assert.equal(settings.theme, 'dark')
  assert.equal(isDailyTvProgram(settings), true)
  assert.equal(original.mode, 'fixed')
  assert.equal(original.panels[0].durationSeconds, 120)
})

test('opening an existing eight-panel program adds daily and weekly options without changing its active program', () => {
  const original = defaultTvSettings()
  original.panels = original.panels.slice(0, 8).reverse()
  original.panels[0].enabled = true
  original.panels[0].durationSeconds = 45
  const expanded = withAvailableTvPanels(original)
  assert.equal(expanded.panels.length, TV_PANELS.length)
  assert.deepEqual(activeTvPanels(expanded), activeTvPanels(original))
  assert.ok(expanded.panels.slice(8).every(panel => panel.enabled === false && panel.durationSeconds === 20))
  assert.deepEqual(withAvailableTvPanels(expanded), expanded)
  assert.equal(original.panels.length, 8)
})


test('weekly preset resets the period and rotates only four weekly scenes while preserving the theme', () => {
  const original = { ...defaultTvSettings(), mode: 'fixed', monthMode: 'fixed', month: '2026-09', metric: 'count', theme: 'light', paceScope: 'individual', paceScopeId: 'ana' }
  const settings = applyTvPreset(original, 'Modo semanal')
  assert.deepEqual(activeTvPanels(settings).map(panel => panel.id), WEEKLY_TV_PANELS)
  assert.ok(activeTvPanels(settings).every(panel => panel.durationSeconds === 20))
  assert.equal(settings.fixedPanel, 'weekly')
  assert.equal(settings.mode, 'rotate')
  assert.equal(settings.monthMode, 'current')
  assert.equal(settings.month, '')
  assert.equal(settings.metric, 'gross')
  assert.equal(settings.paceScope, 'overall')
  assert.equal(settings.paceScopeId, '')
  assert.equal(settings.theme, 'light')
  assert.equal(isWeeklyTvProgram(settings), true)
  assert.equal(isDailyTvProgram(settings), false)
  assert.equal(original.month, '2026-09')
  const mixed = { ...settings, panels: settings.panels.map(panel => panel.id === 'daily' ? { ...panel, enabled: true } : panel) }
  assert.equal(isWeeklyTvProgram(mixed), false)
  assert.equal(isWeeklyTvProgram({ ...mixed, mode: 'fixed', fixedPanel: 'weekly-cash' }), true)
})

test('existing eleven-panel daily programs retain their order and durations when weekly options arrive', () => {
  const original = applyTvPreset(defaultTvSettings(), 'Modo diário')
  original.panels = original.panels.filter(panel => !WEEKLY_TV_PANELS.includes(panel.id))
  original.panels[0].durationSeconds = 60
  const expanded = withAvailableTvPanels(original)
  assert.deepEqual(activeTvPanels(expanded), activeTvPanels(original))
  assert.deepEqual(expanded.panels.slice(0, 11), original.panels)
  assert.deepEqual(expanded.panels.slice(11).map(panel => panel.id), WEEKLY_TV_PANELS)
  assert.ok(expanded.panels.slice(11).every(panel => !panel.enabled))
})

test('weekly labels show the actual interval including both years at a year boundary', () => {
  assert.equal(tvWeekLabel('2026-10-26', '2026-10-27'), 'Semana, 26/10 a 27/10 · Brasília')
  assert.equal(tvWeekLabel('2025-12-29', '2026-01-01'), 'Semana, 29/12/2025 a 01/01/2026 · Brasília')
  assert.equal(tvWeekLabel(), 'Semana atual · segunda até hoje · Brasília')
  assert.equal(tvWeekLabel('2026-99-99', '2026-01-01'), 'Semana atual · segunda até hoje · Brasília')
})
