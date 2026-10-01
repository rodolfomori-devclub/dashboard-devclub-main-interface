import assert from 'node:assert/strict'

export async function checkGoalConfiguration({ page, writes, checked, shot, teamId, individualId }) {
  const scopes = [['overall', 'Geral', '', null], ['product', 'Produto', 'DevClub', 'Família de produtos'], ['team', 'Time', teamId, 'Time'], ['individual', 'Indivíduo', individualId, 'Indivíduo']]
  const nav = page.getByRole('navigation', { name: 'Escopo da meta' })
  for (const [index, [scope, label, scopeId, selector]] of scopes.entries()) {
    await nav.getByRole('button', { name: label, exact: true }).click()
    if (selector) await page.getByRole('combobox', { name: selector, exact: true }).selectOption(scopeId)
    for (const [metricIndex, [metric, name]] of [['gross', 'Bruto'], ['cash', 'Cash collected']].entries()) {
      const form = page.getByRole('form', { name: `Meta de ${name}`, exact: true })
      const target = 10000 + index * 1000 + metricIndex * 100
      await form.getByLabel(/Meta base/).fill(String(target))
      await form.getByLabel(/Supermeta/).fill(String(target + 1000))
      await form.getByLabel(/Ultrameta/).fill(String(target + 2000))
      await form.getByLabel(/Distribuição do ritmo/).selectOption(metric === 'cash' ? 'business' : 'calendar')
      await form.getByLabel('Observações', { exact: true }).fill(`QA ${scope} ${metric}`)
      await form.getByRole('button', { name: `Salvar ${name.toLocaleLowerCase('pt-BR')}`, exact: true }).click()
      await form.getByRole('status').waitFor()
      const request = writes.filter(write => write.path === '/api/goal-plans/2026/9' && write.method === 'PUT').at(-1)
      assert.deepEqual(request.body, { scope, scopeId, product: scope === 'product' ? scopeId : 'all', metric, target, superTarget: target + 1000, ultraTarget: target + 2000, paceBasis: metric === 'cash' ? 'business' : 'calendar', notes: `QA ${scope} ${metric}` })
    }
    if (scope === 'team' || scope === 'individual') { const inactive = page.getByRole('combobox', { name: selector, exact: true }).locator('option').filter({ hasText: /Inativo/ }).first(); assert.equal(await inactive.evaluate(option => option.disabled), true, await inactive.evaluate(option => option.outerHTML)) }
    checked(`Goals ${scope}: separate gross/cash targets and exact PUT bodies`)
  }
  await nav.getByRole('button', { name: 'Geral', exact: true }).click()
  const gross = page.getByRole('form', { name: 'Meta de Bruto', exact: true })
  const cash = page.getByRole('form', { name: 'Meta de Cash collected', exact: true })
  assert.equal(await gross.getByLabel(/Meta base/).inputValue(), '10000')
  assert.equal(await cash.getByLabel(/Meta base/).inputValue(), '10100')
  const beforeInvalid = writes.length
  await gross.getByLabel(/Supermeta/).fill('1')
  await gross.getByRole('button', { name: 'Salvar bruto', exact: true }).click()
  await gross.getByRole('alert').waitFor()
  assert.equal(writes.length, beforeInvalid, 'invalid tier ordering must not send a request')
  await gross.getByLabel(/Supermeta/).fill('11000')
  checked('Goals keep saved financial metrics independent and reject invalid ordering')
  await page.locator('summary').filter({ hasText: 'Outros indicadores' }).click()
  const operational = page.getByRole('form', { name: 'Meta de Valor operacional', exact: true })
  assert.equal(await operational.getByLabel(/Meta base/).inputValue(), '30000')
  await operational.getByLabel('Observações', { exact: true }).fill('Indicador anterior preservado')
  await operational.getByRole('button', { name: 'Salvar valor operacional', exact: true }).click()
  await operational.getByRole('status').waitFor()
  assert.deepEqual(writes.filter(write => write.path === '/api/goal-plans/2026/9' && write.method === 'PUT').at(-1).body, { scope: 'overall', scopeId: '', product: 'all', metric: 'operational', target: 30000, superTarget: 35000, ultraTarget: 40000, paceBasis: 'calendar', notes: 'Indicador anterior preservado' })
  await page.locator('summary').filter({ hasText: 'Outros indicadores' }).click()
  checked('Goals preserve the original operational plan in additional indicators')
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
