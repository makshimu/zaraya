/**
 * Acceptance scenarios from the spec (section 10), run in real browsers against a live stack:
 * a guest phone and the staff panel side by side.
 */
import { expect, test } from '@playwright/test'

import { adminPage, chimes, phone, Seed } from './helpers'

let seed: Seed
let data: Awaited<ReturnType<Seed['menuAndTable']>>

test.beforeEach(async ({ playwright, baseURL }) => {
  const api = await playwright.request.newContext({
    baseURL,
    ignoreHTTPSErrors: true,
  })
  seed = await new Seed(api).login()
  await seed.settings({
    require_first_order_confirmation: true,
    require_table_open: false,
    session_ttl_minutes: 180,
  })
  data = await seed.menuAndTable()
})

test.afterEach(async () => {
  await seed.cleanup()
})

test('scan the table QR → the menu opens with the table number', async ({ browser, baseURL }) => {
  const guest = await phone(browser, baseURL)
  await guest.goto(data.table.qr_url)
  await expect(guest.getByText(`Стол e2e-${seed.tag}`)).toBeVisible()
  await expect(guest.getByText(`Шакшука ${seed.tag}`)).toBeVisible()
})

test('order a dish with a topping → the order shows up in the staff panel within 2 s, with sound', async ({
  browser,
  baseURL,
}) => {
  const staff = await adminPage(browser, baseURL)
  const guest = await phone(browser, baseURL)
  await guest.goto(data.table.qr_url)

  await guest.getByText(`Шакшука ${seed.tag}`).click()
  await guest.getByRole('dialog').getByText('Большая').click()
  await guest.getByRole('dialog').getByText('Фета', { exact: true }).click()
  await guest.getByRole('button', { name: /В корзину/ }).click()
  await guest.getByTestId('cart-bar').click()
  await expect(guest.getByTestId('cart-total')).toContainText('110')

  const before = await chimes(staff)
  const started = Date.now()
  await guest.getByRole('button', { name: /Заказать/ }).click()
  const feed = staff.getByTestId('feed-order').filter({ hasText: `e2e-${seed.tag}` })
  await expect(feed).toBeVisible({ timeout: 2000 })
  expect(Date.now() - started).toBeLessThan(2000)
  expect(await chimes(staff)).toBeGreaterThan(before)

  // the guest follows the status live
  await expect(guest.getByTestId('order-status').first()).toContainText('Ждёт подтверждения')
  await feed.getByRole('button', { name: 'Принять' }).click()
  await expect(guest.locator('[data-status="accepted"]')).toBeVisible({
    timeout: 3000,
  })
})

test('call the waiter → the table lights up in the hall; "Take" reaches the guest', async ({ browser, baseURL }) => {
  const staff = await adminPage(browser, baseURL)
  const guest = await phone(browser, baseURL)
  await guest.goto(data.table.qr_url)
  await expect(guest.getByTestId('call-waiter')).toBeVisible()

  await guest.getByTestId('call-waiter').click()
  const tile = staff.getByTestId('hall-table').filter({ hasText: `e2e-${seed.tag}` })
  await expect(tile).toHaveAttribute('data-state', 'waiter', { timeout: 2000 })

  await staff
    .getByTestId('feed-call')
    .filter({ hasText: `e2e-${seed.tag}` })
    .getByRole('button', { name: 'Взял' })
    .click()
  await expect(guest.getByRole('status').filter({ hasText: 'Официант уже идёт' })).toBeVisible({ timeout: 3000 })
  await expect(tile).toHaveAttribute('data-state', 'occupied')
})

test('ask for the bill, then close the table → the guest token stops working', async ({ browser, baseURL }) => {
  const staff = await adminPage(browser, baseURL)
  const guest = await phone(browser, baseURL)
  await guest.goto(data.table.qr_url)

  await guest.getByTestId('ask-bill').click()
  await guest.getByRole('button', { name: 'Картой' }).click()
  const tile = staff.getByTestId('hall-table').filter({ hasText: `e2e-${seed.tag}` })
  await expect(tile).toHaveAttribute('data-state', 'bill', { timeout: 2000 })
  await expect(tile).toContainText('карта')

  await tile.click()
  await staff.getByRole('button', { name: 'Закрыть стол' }).click()
  await staff.getByRole('button', { name: 'Да, закрыть' }).click()
  await expect(guest.getByText('Визит завершён').first()).toBeVisible({
    timeout: 3000,
  })
  const status = await guest.evaluate(
    async () =>
      (
        await fetch('/api/guest/calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"type":"waiter"}',
        })
      ).status,
  )
  expect(status).toBe(403)
})

test('reissue the QR → the old link stops working', async ({ browser, baseURL }) => {
  await seed.call('post', `/tables/${data.table.id}/regenerate-token`)
  const guest = await phone(browser, baseURL)
  await guest.goto(data.table.qr_url)
  await expect(guest.getByText('QR-код недействителен')).toBeVisible()
})

test('switch a dish off → it disappears for the guest and in the live preview without reload', async ({
  browser,
  baseURL,
}) => {
  const guest = await phone(browser, baseURL)
  await guest.goto(data.table.qr_url)
  await expect(guest.getByText(`Кофе ${seed.tag}`)).toBeVisible()

  const staff = await adminPage(browser, baseURL, '/admin/menu')
  const preview = staff.frameLocator('[data-testid=phone-preview] iframe')
  await expect(preview.getByText(`Кофе ${seed.tag}`)).toBeVisible()

  await staff
    .getByTestId('item')
    .filter({ hasText: `Кофе ${seed.tag}` })
    .getByRole('switch')
    .click()
  await expect(guest.getByText(`Кофе ${seed.tag}`)).toBeHidden({
    timeout: 3000,
  })
  await expect(preview.getByText(`Кофе ${seed.tag}`)).toBeHidden({
    timeout: 3000,
  })
})

test('"table must be open": ordering waits until a waiter opens the table', async ({ browser, baseURL }) => {
  await seed.settings({ require_table_open: true })
  const guest = await phone(browser, baseURL)
  await guest.goto(data.table.qr_url)
  await expect(guest.getByText('Попросите официанта открыть стол').first()).toBeVisible()

  await seed.call('post', `/tables/${data.table.id}/open`)
  await expect(guest.getByText('Попросите официанта открыть стол')).toHaveCount(0, { timeout: 3000 })
})

test('session TTL: after it expires the guest can browse but must rescan to order', async ({ browser, baseURL }) => {
  test.slow() // waits out a real one-minute session
  await seed.settings({ session_ttl_minutes: 1 })
  const guest = await phone(browser, baseURL)
  await guest.goto(data.table.qr_url)
  await expect(guest.getByText(`Шакшука ${seed.tag}`)).toBeVisible()
  await expect(guest.getByText('Отсканируйте QR-код на столе заново').first()).toBeVisible({ timeout: 80_000 })
  await expect(guest.getByText(`Шакшука ${seed.tag}`)).toBeVisible()
})
