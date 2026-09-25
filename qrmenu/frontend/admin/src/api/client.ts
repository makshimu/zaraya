const TOKEN_KEY = 'qrmenu_admin_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code)
  }
}

let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = tokenStore.get()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  const resp = await fetch(`/api/admin${path}`, { ...init, headers })
  if (resp.status === 401 && token) onUnauthorized()
  if (!resp.ok) {
    let code = 'unknown_error'
    try {
      const body = await resp.json()
      if (typeof body.detail === 'string') code = body.detail
      else if (resp.status === 422) code = 'validation_error'
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(resp.status, code)
  }
  return resp
}

export const api = {
  async get<T>(path: string): Promise<T> {
    return (await request(path)).json()
  },
  async post<T>(path: string, body?: unknown): Promise<T> {
    return (await request(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })).json()
  },
  async put<T>(path: string, body: unknown): Promise<T> {
    return (await request(path, { method: 'PUT', body: JSON.stringify(body) })).json()
  },
  async patch<T>(path: string, body: unknown): Promise<T> {
    return (await request(path, { method: 'PATCH', body: JSON.stringify(body) })).json()
  },
  async delete(path: string): Promise<void> {
    await request(path, { method: 'DELETE' })
  },
  async blob(path: string): Promise<Blob> {
    return (await request(path)).blob()
  },
}
