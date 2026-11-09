import assert from 'node:assert/strict'
import { expect } from '@playwright/test'

export const tvMoney = amount => amount == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)

export async function expectTvDual(container, gross, cash, { cashPrimary = false } = {}) {
  const grossValue = container.getByTestId('tv-gross-value').first()
  const cashValue = container.getByTestId('tv-cash-value').first()
  await expect(grossValue).toHaveText(tvMoney(gross))
  await expect(cashValue).toHaveText(tvMoney(cash))
  await expect(container).toContainText('Valor das vendas')
  await expect(container).toContainText('Cash collected')
  const grossSize = await grossValue.evaluate(node => Number.parseFloat(getComputedStyle(node).fontSize))
  const cashSize = await cashValue.evaluate(node => Number.parseFloat(getComputedStyle(node).fontSize))
  assert.ok(cashPrimary ? cashSize > grossSize : grossSize > cashSize, `${cashPrimary ? 'Cash' : 'Gross'} must remain visually primary: gross ${grossSize}px, cash ${cashSize}px`)
}

export async function expectTvScene(container, id) {
  const metric = await container.getAttribute('data-metric')
  const pairAt = (id, gross, cash) => expectTvDual(container.locator(`[data-tv-row-id="${id}"]`).first(), gross, cash)
  if (id === 'monthly-goal') await expectTvDual(container, 1833.64, 1233.64)
  if (id === 'pace') { await expectTvDual(container, 1555.76, 955.76); await expect(container).toContainText('Comercial') }
  if (id === 'daily') await expectTvDual(container, 277.88, 277.88)
  if (id === 'daily-cash') await expectTvDual(container, 277.88, 277.88, { cashPrimary: true })
  if (id === 'daily-sellers') { await pairAt('bruno', 277.88, 277.88); await expect(container).not.toContainText('Ana') }
  if (id === 'daily-payments') { await pairAt('card', 277.88, 277.88); await pairAt('boleto', 0, 0) }
  if (id === 'weekly') {
    await expectTvDual(container, 277.88, 277.88)
    await expect(container).toContainText('Vendas realizadas na semana')
    await expect(container).toContainText('Semana, 12/10 a 15/10 · Brasília')
    await expect(container.getByRole('group', { name: /^Explorar Vendas da semana por dia/ })).toBeVisible()
  }
  if (id === 'weekly-cash') {
    await expectTvDual(container, 277.88, 277.88, { cashPrimary: true })
    await expect(container.getByRole('group', { name: /^Explorar Cash collected da semana por dia/ })).toBeVisible()
  }
  if (id === 'weekly-sellers') {
    await expectTvDual(container.getByTestId('tv-weekly-total'), 277.88, 277.88)
    await expect(container.getByTestId('tv-weekly-commercial')).toContainText('Participação do Comercial')
    await expect(container.getByRole('heading', { name: 'Time MBA', exact: true })).toBeVisible()
    await expect(container.getByRole('heading', { name: 'Time DevClub', exact: true })).toBeVisible()
    await expect(container).not.toContainText('Ana')
  }
  if (id === 'weekly-payments') {
    await pairAt('card', 277.88, 277.88); await pairAt('boleto', 0, 0)
    await expect(container.locator('[data-tv-row-id="pix"]')).toHaveCount(0)
  }
  if (id === 'team-goals') { await pairAt('commercial', 1555.76, 955.76); await pairAt('marketing', 277.88, 277.88) }
  if (id === 'product-goals' || id === 'products') {
    await pairAt('DevClub', 555.76, 555.76)
    await pairAt('MBA', 277.88, 277.88)
    await pairAt('IAClub', 1000, 400)
  }
  if (id === 'sellers') { await pairAt('ana', 1555.76, 955.76); await pairAt('bruno', 277.88, 277.88) }
  if (id === 'payment-mix') { await pairAt('card', 833.64, 833.64); await pairAt('boleto', 1000, 400); await expect(container.locator('[data-tv-row-id="pix"]')).toHaveCount(0) }
  if (id === 'products') await expect(container.locator('[data-tv-row-id]').first()).toHaveAttribute('data-tv-row-id', metric === 'gross' ? 'IAClub' : 'DevClub')
  if (id === 'team-goals') await expect(container.locator('[data-tv-row-id="commercial"]')).toContainText(metric === 'count' ? '30%' : metric === 'cash' ? '47,79%' : '77,79%')
  if (['payment-mix', 'daily-payments', 'weekly-payments'].includes(id)) {
    const split = container.getByTestId('tv-payment-products')
    await expect(split).toBeVisible()
    const columns = await split.locator(':scope > section').evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { width: box.width, left: box.left, viewport: innerWidth } }))
    if (columns[0].viewport > 900) assert.ok(Math.abs(columns[0].width - columns[1].width) <= 1 && columns[1].left > columns[0].left, 'Payments and products use equal side-by-side columns')
    const products = container.getByRole('region', { name: 'Faturamento por produto', exact: true })
    await expect(products.getByRole('heading', { name: 'Faturamento por produto', exact: true })).toBeVisible()
    await expectTvDual(products.locator('[data-tv-row-id="MBA"]'), 277.88, 277.88)
    if (id !== 'payment-mix') await expect(products.locator('[data-tv-row-id="DevClub"]')).toHaveCount(0)
  }
  if (['monthly-goal', 'pace', 'daily', 'weekly', 'weekly-cash'].includes(id)) await expect(container.getByTestId('tv-main-value')).toHaveText(tvMoney(id === 'monthly-goal' ? 1833.64 : id === 'pace' ? 1555.76 : 277.88))
}
