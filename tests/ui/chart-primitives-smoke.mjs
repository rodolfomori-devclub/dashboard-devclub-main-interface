// Local, deterministic component regressions. No auth, production data or API calls.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const base = new URL(process.env.DASHBOARD_SMOKE_URL || 'http://127.0.0.1:4317')
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Use a local Vite fixture server only')
const fixturePath = '/__chart-primitives-smoke'
const fixtureHtml = `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Chart fixtures</title></head><body><div id="root"></div>
<script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
<script type="module" src="/tests/ui/chart-fixtures.jsx"></script></body></html>`
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ headless: true, executablePath: existsSync(localChrome) ? localChrome : undefined })
const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' })
const errors = [], blockedRequests = [], checks = []
if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
await context.route('**/*', async route => {
  const url = new URL(route.request().url())
  if (url.origin !== base.origin || url.pathname.startsWith('/api/')) {
    blockedRequests.push({ origin: url.origin, path: url.pathname }); await route.abort(); return
  }
  if (url.pathname === fixturePath) {
    await route.fulfill({ status: 200, contentType: 'text/html', body: fixtureHtml }); return
  }
  await route.continue()
})
const page = await context.newPage()
page.on('pageerror', error => errors.push(error.message))
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
const barsGeometry = locator => locator.evaluate(root => {
  const svg = root.querySelector('.rr-chart-plot svg')
  const clip = svg.querySelector('clipPath rect')
  const bounds = Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, Number(clip.getAttribute(key))]))
  const bars = [...svg.querySelectorAll('g[clip-path] rect')].map(rect => Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, Number(rect.getAttribute(key))])))
  const ticks = [...svg.querySelectorAll('.rr-graph-date')].map(text => { const box = text.getBoundingClientRect(); return { left: box.left, right: box.right } }).sort((a, b) => a.left - b.left)
  return { bounds, bars, ticks }
})
const assertBars = (geometry, expected, label) => {
  assert.equal(geometry.bars.length, expected, `${label}: every finite observation must render`)
  for (const bar of geometry.bars) {
    assert.ok(Object.values(bar).every(Number.isFinite), `${label}: geometry must be finite`)
    assert.ok(bar.width > 0 && bar.height > 0, `${label}: nonzero observation must remain visible`)
    assert.ok(bar.x >= geometry.bounds.x - .01 && bar.x + bar.width <= geometry.bounds.x + geometry.bounds.width + .01, `${label}: horizontal clipping`)
    assert.ok(bar.y >= geometry.bounds.y - .01 && bar.y + bar.height <= geometry.bounds.y + geometry.bounds.height + .01, `${label}: vertical clipping`)
  }
  for (let index = 1; index < geometry.ticks.length; index++) assert.ok(geometry.ticks[index - 1].right + 2 <= geometry.ticks[index].left, `${label}: date ticks overlap`)
}
try {
  for (const width of [1160, 1200, 360]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(new URL(fixturePath, base).href, { waitUntil: 'networkidle' })
    await page.getByTestId('chart-fixtures-ready').waitFor()
    await page.evaluate(value => document.documentElement.classList.toggle('dark', value === 'dark'), theme)
    await settle()
    const label = `${theme}/${width}`

    const mix = page.getByTestId('mix')
    const tinyArc = Number((await mix.locator('svg g circle').first().getAttribute('stroke-dasharray')).split(/[ ,]+/)[0])
    assert.ok(tinyArc > 0 && tinyArc <= 1 / 1_000_000 * 100, `${label}: the 1-in-1M slice must not exaggerate its share`)
    assert.equal(await mix.locator('svg g circle').count(), 2, `${label}: null/negative values cannot make slices`)
    assert.equal(await mix.locator('.analytics-mix-legend button').count(), 2, `${label}: invalid counts cannot enter the denominator`)
    const legend = mix.getByRole('button', { name: /Pix raro/ })
    await legend.click()
    assert.equal(await legend.getAttribute('aria-pressed'), 'true', `${label}: initial focus must not cancel the first click`)
    await page.getByRole('heading', { name: 'Regressão dos gráficos' }).click()
    assert.equal(await legend.getAttribute('aria-pressed'), 'true', `${label}: selection must survive blur`)
    await legend.click()
    assert.equal(await legend.getAttribute('aria-pressed'), 'false', `${label}: repeat click must toggle off`)
    await legend.focus(); await page.keyboard.press('Space')
    assert.equal(await legend.getAttribute('aria-pressed'), 'true', `${label}: keyboard toggles the legend`)

    const layout = await mix.evaluate(root => {
      const element = root.querySelector('.analytics-mix'), panel = root.closest('.analytics-panel-body')
      return { mixWidth: element.clientWidth, mixScrollWidth: element.scrollWidth, panelWidth: panel.clientWidth, panelScrollWidth: panel.scrollWidth, pageWidth: document.documentElement.clientWidth, pageScrollWidth: document.documentElement.scrollWidth }
    })
    assert.ok(layout.mixScrollWidth <= layout.mixWidth + 1, `${label}: mix card contents overflow`)
    assert.ok(layout.panelScrollWidth <= layout.panelWidth + 1, `${label}: mix exceeds panel`)
    assert.ok(layout.pageScrollWidth <= layout.pageWidth + 1, `${label}: fixture page overflows`)

    const sparse = await barsGeometry(page.getByTestId('sparse-bars'))
    assertBars(sparse, 6, `${label}/sparse`)
    const dense = await barsGeometry(page.getByTestId('dense-bars'))
    assertBars(dense, 365 * 3, `${label}/dense`)

    const signed = page.getByTestId('signed-ranking')
    const unknown = signed.locator('.analytics-rank').filter({ hasText: 'Sem valor' })
    assert.equal(await unknown.locator('strong').innerText(), 'Não informado', `${label}: unknown money must not become zero`)
    assert.equal(await unknown.locator('.analytics-rank-track > i').evaluate(bar => bar.getBoundingClientRect().width), 0, `${label}: unknown value cannot have a bar`)
    const negative = signed.locator('.analytics-rank').filter({ hasText: 'Negativo' })
    const signedGeometry = await negative.locator('.analytics-rank-track').evaluate(track => {
      const bar = track.querySelector('i').getBoundingClientRect(), zero = track.querySelector('b').getBoundingClientRect(), box = track.getBoundingClientRect()
      return { barLeft: bar.left, barRight: bar.right, barWidth: bar.width, zero: zero.left, left: box.left }
    })
    assert.ok(signedGeometry.barWidth > 0 && signedGeometry.barLeft < signedGeometry.zero && Math.abs(signedGeometry.barRight - signedGeometry.zero) <= 1, `${label}: negative bar must terminate at zero from the left`)
    assert.ok((await negative.locator('strong').innerText()).includes('-'), `${label}: negative label must retain its sign`)
    await negative.focus(); await page.keyboard.press('Enter')
    assert.equal(await signed.getByLabel('Seleção do ranking').innerText(), 'negative', `${label}: ranking selection passes the selected item`)

    const percentage = await page.getByTestId('percent-ranking').locator('.analytics-rank').filter({ hasText: 'Um quarto' }).locator('.analytics-rank-track').evaluate(track => track.querySelector('i').getBoundingClientRect().width / track.getBoundingClientRect().width)
    assert.ok(Math.abs(percentage - .25) < .005, `${label}: 25% must fill one quarter of the 100% scale`)

    const area = page.getByTestId('area-gaps')
    assert.equal(await area.locator('g[clip-path] path[fill^="url("]').count(), 2, `${label}: gap splits observed area; dashed/fill:false series must not fill`)
    const plot = area.getByRole('group', { name: 'Explorar Áreas com lacunas' })
    await plot.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight')
    assert.equal(await area.locator('.rr-chart-tooltip b').allTextContents().then(values => values.every(value => value === 'Não informado')), true, `${label}: keyboard tooltip must preserve null across all series`)
    await page.keyboard.press('Escape')
    checks.push({ theme, width, donutProportion: true, legendClickAndKeyboard: true, mixOverflow: false, sparseBars: sparse.bars.length, denseBars: dense.bars.length, tickCollisions: false, nullAndNegativeRanking: true, percentScale: true, areaGaps: true })
  }
  assert.deepEqual(errors, [], 'No browser errors')
  assert.deepEqual(blockedRequests, [], 'Chart fixtures must never call APIs or external hosts')
  console.log(JSON.stringify({ passed: true, suite: 'chart-primitives', checks, pageErrors: errors.length, apiOrExternalRequests: blockedRequests.length }))
} finally { await browser.close() }
