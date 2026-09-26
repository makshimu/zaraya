/** The live phone preview on the admin menu page: fully clickable, but it never sends anything. */
import { expect, test } from '@playwright/test'

import { adminPage, closeContexts, openMenu, Seed } from './helpers'

let seed: Seed
let data: Awaited<ReturnType<Seed['menuAndTable']>>

test.beforeEach(async ({ playwright, baseURL }) => {
  const api = await playwright.request.newContext({ baseURL, ignoreHTTPSErrors: true })
  seed = await new Seed(api).login()
  data = await seed.menuAndTable()
})

test.afterEach(async () => {
  await closeContexts()
  await seed.cleanup()
})

test('the eye button opens the dish in the preview; ordering and calls stay local', async ({ browser, baseURL }) => {
  const staff = await adminPage(browser, baseURL, '/admin/menu')
  const preview = staff.frameLocator('[data-testid=phone-preview] iframe')
  const ordersBefore = (await seed.call('get', '/orders')).length
  const callsBefore = (await seed.call('get', '/calls')).length

  // point the phone at the dish from the admin list
  await staff
    .getByTestId('item')
    .filter({ hasText: `Шакшука ${seed.tag}` })
    .getByRole('button', { name: 'Показать в превью' })
    .click()
  const dialog = preview.getByRole('dialog')
  await expect(dialog).toContainText(`Шакшука ${seed.tag}`)

  // it behaves like the real guest menu: pick options, add to cart, open the cart
  await dialog.getByText('Большая').click()
  await dialog.getByText('Фета', { exact: true }).click()
  await expect(preview.getByTestId('total')).toContainText('110')
  await dialog.getByRole('button', { name: /В корзину/ }).click()
  await preview.getByTestId('cart-bar').click()
  await preview.getByRole('button', { name: /Заказать/ }).click()
  await expect(preview.getByRole('alert')).toContainText('предпросмотр')
  await preview.getByLabel('Закрыть').click()

  await preview.getByTestId('call-waiter').click()
  await expect(preview.getByRole('status').filter({ hasText: 'предпросмотр' })).toBeVisible()

  // nothing reached the staff
  expect((await seed.call('get', '/orders')).length).toBe(ordersBefore)
  expect((await seed.call('get', '/calls')).length).toBe(callsBefore)
})

test('the preview follows menu edits live and switches language', async ({ browser, baseURL }) => {
  const staff = await adminPage(browser, baseURL, '/admin/menu')
  const preview = staff.frameLocator('[data-testid=phone-preview] iframe')
  await staff
    .getByTestId('category')
    .filter({ hasText: `Яйца ${seed.tag}` })
    .first()
    .getByRole('button', { name: 'Показать в превью' })
    .first()
    .click()
  await expect(preview.getByText(`Кофе ${seed.tag}`)).toBeVisible()

  await seed.call('put', `/items/${data.drink.id}`, {
    category_id: data.category.id,
    name: { ru: `Латте ${seed.tag}`, en: `Latte ${seed.tag}` },
    prices: [{ amount: 50000 }],
  })
  await expect(preview.getByText(`Латте ${seed.tag}`)).toBeVisible({ timeout: 3000 })

  await staff.getByLabel('Язык превью').selectOption('en')
  await openMenu(preview)
  await expect(preview.getByText(`Latte ${seed.tag}`)).toBeVisible()
})
