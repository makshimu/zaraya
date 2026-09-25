// The admin's live preview embeds the menu with ?preview=1&lang=xx. Everything is clickable,
// but orders and calls are not sent: the admin sees how it looks, the staff get nothing.
const params = new URLSearchParams(location.search)

export const isPreview = params.has('preview')
export const previewLang = params.get('lang')
