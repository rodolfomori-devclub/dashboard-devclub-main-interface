import assert from 'node:assert/strict'

const tiers = [['target', 'Meta base'], ['superTarget', 'Supermeta'], ['ultraTarget', 'Ultrameta']]
const areas = [['marketing', 'Marketing'], ['sales', 'Vendas']]
const splitTargets = target => {
  const marketing = Math.round(target * .4)
  return [
    { key: 'marketing', target: marketing, superTarget: marketing + 400, ultraTarget: marketing + 800 },
    { key: 'sales', target: target - marketing, superTarget: target - marketing + 600, ultraTarget: target - marketing + 1200 },
  ]
}
const latestPlan = writes => writes.filter(write => write.path === '/api/goal-plans/2026/9' && write.method === 'PUT').at(-1)
const areaInput = (form, area, tier) => form.getByLabel(`${area} · ${tier}`, { exact: true })
async function fillBreakdown(form, parts) {
  for (const [key, area] of areas) for (const [field, label] of tiers) await areaInput(form, area, label).fill(String(parts.find(part => part.key === key)[field]))
}
async function assertTotals(form, values) {
  for (const [field] of tiers) {
    const total = form.locator(`.goal-breakdown-total[data-field="${field}"]`)
    assert.equal(await total.count(), 1, `One calculated ${field} total`)
    assert.ok((await total.innerText()).includes(values[field].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })), `${field} total equals Marketing + Vendas`)
    assert.equal(await total.locator('input').count(), 0, 'Calculated totals cannot be edited independently')
  }
}

export async function checkGoalConfiguration({ page, writes, checked, shot, teamId, individualId }) {
  const scopes = [['overall', 'Geral', '', null], ['product', 'Produto', 'DevClub', 'Família de produtos'], ['team', 'Time', teamId, 'Time'], ['individual', 'Indivíduo', individualId, 'Indivíduo'], ['product', 'Produto', 'Operação 50K', 'Família de produtos']]
  const nav = page.getByRole('navigation', { name: 'Escopo da meta' })
  for (const [index, [scope, label, scopeId, selector]] of scopes.entries()) {
    await nav.getByRole('button', { name: label, exact: true }).click()
    if (selector) await page.getByRole('combobox', { name: selector, exact: true }).selectOption(scopeId)
    for (const [metricIndex, [metric, name]] of [['gross', 'Valor das vendas'], ['cash', 'Cash collected']].entries()) {
      const form = page.getByRole('form', { name: `Meta de ${name}`, exact: true })
      const target = 10000 + index * 1000 + metricIndex * 100
      const values = { target, superTarget: target + 1000, ultraTarget: target + 2000 }
      const breakdown = scope === 'overall' ? splitTargets(target) : undefined
      if (scope === 'overall') {
        for (const [, area] of areas) for (const [, tier] of tiers) assert.equal(await areaInput(form, area, tier).inputValue(), '', 'New general goals do not silently initialize an area as zero')
        if (metric === 'gross') {
          const before = writes.length
          await areaInput(form, 'Marketing', 'Meta base').fill('1000')
          await form.getByRole('button', { name: 'Salvar valor das vendas', exact: true }).click()
          await form.getByRole('alert').waitFor()
          assert.equal(writes.length, before, 'Incomplete area targets must not send a request')
        }
        await fillBreakdown(form, breakdown)
        await assertTotals(form, values)
      } else {
        for (const [field, tier] of tiers) await form.getByLabel(new RegExp(tier)).fill(String(values[field]))
      }
      await form.getByLabel(/Distribuição do ritmo/).selectOption(metric === 'cash' ? 'business' : 'calendar')
      await form.getByLabel('Observações', { exact: true }).fill(`QA ${scope} ${metric}`)
      await form.getByRole('button', { name: `Salvar ${name.toLocaleLowerCase('pt-BR')}`, exact: true }).click()
      await form.locator('.goal-editor-success').waitFor()
      assert.deepEqual(latestPlan(writes).body, { scope, scopeId, product: scope === 'product' ? scopeId : 'all', metric, ...values, ...(breakdown ? { breakdown } : {}), paceBasis: metric === 'cash' ? 'business' : 'calendar', notes: `QA ${scope} ${metric}` })
    }
    if (scope === 'team' || scope === 'individual') { const inactive = page.getByRole('combobox', { name: selector, exact: true }).locator('option').filter({ hasText: /Inativo/ }).first(); assert.equal(await inactive.evaluate(option => option.disabled), true, await inactive.evaluate(option => option.outerHTML)) }
    checked(`Goals ${scope}${scope === 'product' ? ` ${scopeId}` : ''}: separate gross/cash targets and exact PUT bodies`)
  }
  await nav.getByRole('button', { name: 'Produto', exact: true }).click()
  const product = page.getByRole('combobox', { name: 'Família de produtos', exact: true })
  await product.selectOption('DevClub')
  assert.equal(await page.getByRole('form', { name: 'Meta de Valor das vendas', exact: true }).getByLabel(/Meta base/).inputValue(), '11000')
  await product.selectOption('Operação 50K')
  assert.equal(await page.getByRole('form', { name: 'Meta de Valor das vendas', exact: true }).getByLabel(/Meta base/).inputValue(), '14000')
  assert.equal(await page.getByRole('form', { name: 'Meta de Cash collected', exact: true }).getByLabel(/Meta base/).inputValue(), '14100')
  checked('Goals Operação 50K retains independent gross/cash plans without changing DevClub')
  await nav.getByRole('button', { name: 'Geral', exact: true }).click()
  const gross = page.getByRole('form', { name: 'Meta de Valor das vendas', exact: true })
  const cash = page.getByRole('form', { name: 'Meta de Cash collected', exact: true })
  await assertTotals(gross, { target: 10000, superTarget: 11000, ultraTarget: 12000 })
  await assertTotals(cash, { target: 10100, superTarget: 11100, ultraTarget: 12100 })
  assert.equal(await areaInput(gross, 'Marketing', 'Meta base').inputValue(), '4000')
  assert.equal(await areaInput(cash, 'Marketing', 'Meta base').inputValue(), '4040')
  const beforeInvalid = writes.length
  await areaInput(gross, 'Marketing', 'Supermeta').fill('1')
  await gross.getByRole('button', { name: 'Salvar valor das vendas', exact: true }).click()
  await gross.getByRole('alert').waitFor()
  assert.equal(writes.length, beforeInvalid, 'Invalid tier ordering within an area must not send a request')
  await areaInput(gross, 'Marketing', 'Supermeta').fill('4400')
  await areaInput(gross, 'Vendas', 'Meta base').fill('')
  await gross.getByRole('button', { name: 'Salvar valor das vendas', exact: true }).click()
  await gross.getByRole('alert').waitFor()
  assert.equal(writes.length, beforeInvalid, 'A blank target does not become an explicit zero')
  await areaInput(gross, 'Vendas', 'Meta base').fill('6000')
  checked('General goals keep financial metrics independent and reject incomplete or invalid area tiers')
  const zeroMarketing = [{ key: 'marketing', target: 0, superTarget: 0, ultraTarget: 0 }, { key: 'sales', target: 10100, superTarget: 11100, ultraTarget: 12100 }]
  await fillBreakdown(cash, zeroMarketing)
  await cash.getByRole('button', { name: 'Salvar cash collected', exact: true }).click()
  await cash.locator('.goal-editor-success').waitFor()
  assert.deepEqual(latestPlan(writes).body.breakdown, zeroMarketing, 'An explicitly entered zero is allowed')
  assert.equal(latestPlan(writes).body.target, 10100)
  await fillBreakdown(cash, splitTargets(10100))
  await cash.getByRole('button', { name: 'Salvar cash collected', exact: true }).click()
  await cash.locator('.goal-editor-success').waitFor()
  checked('General goals allow an explicitly zero area without replacing the other area')
  await page.locator('summary').filter({ hasText: 'Outros indicadores' }).click()
  const operational = page.getByRole('form', { name: 'Meta de Valor operacional', exact: true })
  assert.equal(await operational.getByLabel(/Meta base/).inputValue(), '30000')
  await operational.getByLabel('Observações', { exact: true }).fill('Indicador anterior preservado')
  await operational.getByRole('button', { name: 'Salvar valor operacional', exact: true }).click()
  await operational.locator('.goal-editor-success').waitFor()
  const legacy = { scope: 'overall', scopeId: '', product: 'all', metric: 'operational', target: 30000, superTarget: 35000, ultraTarget: 40000, paceBasis: 'calendar', notes: 'Indicador anterior preservado' }
  assert.deepEqual(latestPlan(writes).body, legacy)
  checked('Legacy general goals retain their values until an area division is explicitly configured')
  const beforeSplit = writes.length
  await operational.getByRole('button', { name: 'Configurar Marketing e Vendas', exact: true }).click()
  for (const [, area] of areas) for (const [, tier] of tiers) assert.equal(await areaInput(operational, area, tier).inputValue(), '', 'Legacy values are not automatically allocated to an area')
  assert.equal(writes.length, beforeSplit, 'Starting an area division does not save it')
  await operational.getByRole('button', { name: 'Manter meta sem divisão', exact: true }).click()
  assert.equal(await operational.getByLabel(/Meta base/).inputValue(), '30000')
  assert.equal(writes.length, beforeSplit, 'Cancelling division preserves the legacy plan without a request')
  await operational.getByRole('button', { name: 'Configurar Marketing e Vendas', exact: true }).click()
  await operational.getByRole('button', { name: 'Salvar valor operacional', exact: true }).click()
  await operational.getByRole('alert').waitFor()
  assert.equal(writes.length, beforeSplit, 'Empty legacy division cannot replace the original target')
  const legacyBreakdown = [{ key: 'marketing', target: 10000, superTarget: 12000, ultraTarget: 14000 }, { key: 'sales', target: 20000, superTarget: 23000, ultraTarget: 26000 }]
  await fillBreakdown(operational, legacyBreakdown)
  await assertTotals(operational, legacy)
  await operational.getByRole('button', { name: 'Salvar valor operacional', exact: true }).click()
  await operational.locator('.goal-editor-success').waitFor()
  assert.deepEqual(latestPlan(writes).body, { ...legacy, breakdown: legacyBreakdown })
  assert.equal(await operational.getByRole('button', { name: 'Manter meta sem divisão', exact: true }).count(), 0, 'Saved breakdowns cannot be silently removed')
  await page.locator('summary').filter({ hasText: 'Outros indicadores' }).click()
  checked('Legacy goals accept a reviewed Marketing + Vendas split with exact tier totals')
  await shot('goals-desktop')
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await shot('goals-desktop-dark')
  await page.setViewportSize({ width: 360, height: 1000 })
  await shot('goals-360-dark')
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  await shot('goals-360-light')
  await page.setViewportSize({ width: 1440, height: 1000 })
  checked('Goals financial editors fit desktop and 360px in both themes')
}

export async function checkGoalConfigurationReader({ page, checked }) {
  for (const name of ['Valor das vendas', 'Cash collected']) {
    const form = page.getByRole('form', { name: `Meta de ${name}`, exact: true })
    for (const [, area] of areas) for (const [, tier] of tiers) assert.equal(await areaInput(form, area, tier).isDisabled(), true, 'Reader cannot change area targets')
    assert.equal(await form.locator('.goal-breakdown-total').count(), 3)
    assert.equal(await form.getByRole('button', { name: /Salvar|Configurar|Manter meta/ }).count(), 0)
  }
  assert.equal(await page.getByRole('button', { name: /^Salvar/ }).count(), 0)
  checked('Goals reader sees calculated totals with all Marketing/Vendas fields disabled and no write controls')
}
