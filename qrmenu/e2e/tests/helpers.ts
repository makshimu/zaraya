import { devices, expect, type APIRequestContext, type Browser, type BrowserContext, type FrameLocator, type Page } from '@playwright/test'

export const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? 'admin@example.com',
  password: process.env.ADMIN_PASSWORD ?? 'admin',
}

/** Admin REST client used to prepare data; everything created is removed in cleanup(). */
export class Seed {
  private headers: Record<string, string> = {}
  private created: {
    tables: number[]
    categories: number[]
    groups: number[]
  } = { tables: [], categories: [], groups: [] }
  private originalSettings: Record<string, unknown> | null = null
  readonly tag = Math.random().toString(36).slice(2, 7)

  constructor(private api: APIRequestContext) {}

  async login() {
    const resp = await this.api.post('/api/admin/auth/login', { data: ADMIN })
    expect(resp.ok(), 'admin login (set ADMIN_EMAIL / ADMIN_PASSWORD)').toBeTruthy()
    this.headers = {
      authorization: `Bearer ${(await resp.json()).access_token}`,
    }
    return this
  }

  async call<T = any>(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, data?: unknown): Promise<T> {
    const resp = await this.api[method](`/api/admin${path}`, {
      headers: this.headers,
      data,
    })
    expect(resp.ok(), `${method.toUpperCase()} ${path}: ${resp.status()} ${await resp.text()}`).toBeTruthy()
    return resp.status() === 204 ? (undefined as T) : resp.json()
  }

  async settings(changes: Record<string, unknown>) {
    const current = await this.call('get', '/settings')
    delete current.logo_urls
    delete current.cover_urls
    delete current.telegram_token_set
    this.originalSettings ??= { ...current }
    await this.call('put', '/settings', { ...current, ...changes })
  }

  /** A category with a dish (two sizes, a topping group) and a drink, plus one table. */
  async menuAndTable() {
    const group = await this.call('post', '/modifier-groups', {
      name: { ru: `Топпинги ${this.tag}`, en: `Toppings ${this.tag}` },
      max_select: 2,
      modifiers: [
        { name: { ru: 'Фета', en: 'Feta' }, price: 15000 },
        { name: { ru: 'Бекон', en: 'Bacon' }, price: 20000 },
      ],
    })
    this.created.groups.push(group.id)
    const category = await this.call('post', '/categories', {
      name: { ru: `Яйца ${this.tag}`, en: `Eggs ${this.tag}` },
    })
    this.created.categories.push(category.id)
    const dish = await this.call('post', '/items', {
      category_id: category.id,
      name: { ru: `Шакшука ${this.tag}`, en: `Shakshuka ${this.tag}` },
      prices: [
        { name: { ru: 'Обычная' }, amount: 75000 },
        { name: { ru: 'Большая' }, amount: 95000 },
      ],
      modifier_group_ids: [group.id],
    })
    const drink = await this.call('post', '/items', {
      category_id: category.id,
      name: { ru: `Кофе ${this.tag}`, en: `Coffee ${this.tag}` },
      prices: [{ amount: 45000 }],
    })
    const table = await this.call('post', '/tables', {
      number: `e2e-${this.tag}`,
    })
    this.created.tables.push(table.id)
    return { group, category, dish, drink, table }
  }

  async cleanup() {
    for (const id of this.created.tables)
      await this.api.delete(`/api/admin/tables/${id}`, {
        headers: this.headers,
      })
    for (const id of this.created.categories)
      await this.api.delete(`/api/admin/categories/${id}`, {
        headers: this.headers,
      })
    for (const id of this.created.groups)
      await this.api.delete(`/api/admin/modifier-groups/${id}`, {
        headers: this.headers,
      })
    if (this.originalSettings) await this.call('put', '/settings', this.originalSettings)
  }
}

// Every phone and staff window opened by a test; closed afterwards so their live sockets
// don't keep reacting to the next test's events
const contexts: BrowserContext[] = []

export async function closeContexts() {
  await Promise.all(contexts.splice(0).map((c) => c.close()))
}

/** A guest phone: its own browser context, so its own session cookie. */
export async function phone(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    baseURL,
    ignoreHTTPSErrors: true,
    locale: 'ru-RU',
  })
  contexts.push(context)
  return context.newPage()
}

/** From the guest home screen (what the QR opens) to the full menu. */
export async function openMenu(guest: Page | FrameLocator) {
  await guest.getByTestId('open-menu').click()
}

/** The staff panel, signed in, counting chimes so tests can assert "with sound". */
export async function adminPage(browser: Browser, baseURL: string | undefined, path = '/admin/hall'): Promise<Page> {
  const context = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: true,
    locale: 'ru-RU',
    viewport: { width: 1440, height: 900 },
  })
  contexts.push(context)
  const page = await context.newPage()
  await page.addInitScript(() => {
    ;(window as any).__chimes = 0
    const original = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function () {
      ;(window as any).__chimes++
      return original.call(this)
    }
  })
  await page.goto('/admin/')
  await page.fill('#email', ADMIN.email)
  await page.fill('#password', ADMIN.password)
  await page.click('button[type=submit]')
  await page.getByText('Онлайн').waitFor()
  if (path !== '/admin/hall') await page.goto(path)
  await page.getByText('Онлайн').waitFor()
  return page
}

export const chimes = (page: Page) => page.evaluate(() => (window as any).__chimes as number)
