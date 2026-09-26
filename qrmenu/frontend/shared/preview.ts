// Messages from the admin to the guest menu running in its phone preview (an iframe on the
// same origin). The guest app only listens when opened with ?preview=1.

export const PREVIEW_SOURCE = 'qrmenu-admin'

/** Welcome-screen fields as edited in the admin, shown before they are saved. */
export interface RestaurantDraft {
  tagline: Record<string, string>
  logo_urls: { w400: string; w1200: string } | null
  cover_urls: { w400: string; w1200: string } | null
  wifi_name: string | null
  wifi_password: string | null
  opening_hours: { open: string; close: string; closed: boolean }[] | null
}

export type PreviewCommand =
  | { source: typeof PREVIEW_SOURCE; type: 'show-item'; itemId: number }
  | { source: typeof PREVIEW_SOURCE; type: 'show-category'; categoryId: number }
  | { source: typeof PREVIEW_SOURCE; type: 'restaurant-draft'; restaurant: RestaurantDraft }

export function isPreviewCommand(data: unknown): data is PreviewCommand {
  return typeof data === 'object' && data !== null && (data as PreviewCommand).source === PREVIEW_SOURCE
}

// The guest app answers once its menu is on screen, so the admin knows commands will land
export const GUEST_SOURCE = 'qrmenu-guest'

export function isGuestReady(data: unknown): boolean {
  return typeof data === 'object' && data !== null && (data as { source?: string }).source === GUEST_SOURCE
}
