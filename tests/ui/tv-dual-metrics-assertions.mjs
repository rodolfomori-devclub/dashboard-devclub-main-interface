import assert from 'node:assert/strict'
import { expect } from '@playwright/test'

export const tvMoney = amount => amount == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)

export async function expectTvDual(container, gross, cash) {
  const grossValue = container.getByTestId('tv-gross-value').first()
  const cashValue = container.getByTestId('tv-cash-value').first()
  await expect(grossValue).toHaveText(tvMoney(gross))
  await expect(cashValue).toHaveText(tvMoney(cash))
  await expect(container).toContainText('Valor das vendas')
  await expect(container).toContainText('Cash collected')
  const grossSize = await grossValue.evaluate(node => Number.parseFloat(getComputedStyle(node).fontSize))
  const cashSize = await cashValue.evaluate(node => Number.parseFloat(getComputedStyle(node).fontSize))
  assert.ok(grossSize > cashSize, `Gross must remain visually primary: gross ${grossSize}px, cash ${cashSize}px`)
}

export async function expectTvScene(container, id) {
  const metric = await container.getAttribute('data-metric')
  const pairAt = (id, gross, cash) => expectTvDual(container.locator(`[data-tv-row-id="${id}"]`).first(), gross, cash)
  if (id === 'monthly-goal') await expectTvDual(container, 1833.64, 1233.64)
  if (id === 'pace') { await expectTvDual(container, 1555.76, 955.76); await expect(container).toContainText('Comercial') }
  if (id === 'daily') await expectTvDual(container, 277.88, 277.88)
  if (id === 'team-goals') { await pairAt('commercial', 1555.76, 955.76); await pairAt('marketing', 277.88, 277.88) }
  if (id === 'product-goals' || id === 'products') {
    await pairAt('DevClub', 555.76, 555.76)
    await pairAt('MBA', 277.88, 277.88)
    await pairAt('IAClub', 1000, 400)
  }
  if (id === 'sellers') { await pairAt('ana', 1555.76, 955.76); await pairAt('bruno', 277.88, 277.88) }
  if (id === 'payment-mix') { await pairAt('card', 555.76, 555.76); await pairAt('boleto', 1000, 400); await pairAt('pix', 277.88, 277.88) }
  if (id === 'products') await expect(container.locator('[data-tv-row-id]').first()).toHaveAttribute('data-tv-row-id', metric === 'gross' ? 'IAClub' : 'DevClub')
  if (id === 'team-goals') await expect(container.locator('[data-tv-row-id="commercial"]')).toContainText(metric === 'count' ? '30%' : metric === 'cash' ? '47,79%' : '77,79%')
  if (id === 'payment-mix') await expect(container.locator('[data-tv-row-id="card"]')).toContainText(metric === 'count' ? '50%' : metric === 'cash' ? '45,05%' : '30,31%')
  if (['monthly-goal', 'pace', 'daily'].includes(id)) await expect(container.getByTestId('tv-main-value')).toHaveText(tvMoney(id === 'monthly-goal' ? 1833.64 : id === 'pace' ? 1555.76 : 277.88))
}
