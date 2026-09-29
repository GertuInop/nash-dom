type MaxBridge = {
  openLink?: (url: string) => void
  openMaxLink?: (url: string) => void
}

/** Публичный диплинк MAX (только https://max.ru/… — см. WebApp.openMaxLink). */
export function buildMaxPublicProfileUrl(opts: {
  username?: string | null
  maxUserId?: string | number | null
}) {
  const username = String(opts.username || '')
    .trim()
    .replace(/^@/, '')
  if (username) return `https://max.ru/${encodeURIComponent(username)}`
  const id = opts.maxUserId != null ? String(opts.maxUserId).trim() : ''
  if (id) return `https://max.ru/id${id}`
  return null
}

/** Открыть профиль человека в MAX (не во внешнем браузере). */
export function openMaxProfile(opts: {
  maxProfileUrl?: string | null
  maxPublicUrl?: string | null
  username?: string | null
  maxUserId?: string | number | null
}) {
  const wa = window.WebApp as MaxBridge | undefined
  const publicUrl =
    opts.maxPublicUrl
    || buildMaxPublicProfileUrl({ username: opts.username, maxUserId: opts.maxUserId })

  const candidates = [
    publicUrl,
    opts.username ? `https://max.ru/${String(opts.username).replace(/^@/, '')}` : null,
    opts.maxUserId ? `https://max.ru/id${opts.maxUserId}` : null,
    opts.maxUserId ? `https://max.ru/u/${opts.maxUserId}` : null,
  ].filter(Boolean) as string[]

  for (const url of candidates) {
    if (!url.startsWith('https://max.ru/')) continue
    if (typeof wa?.openMaxLink === 'function') {
      try {
        wa.openMaxLink(url)
        return
      } catch {
        /* try next */
      }
    }
  }

  // Устаревший max:// — только если openMaxLink недоступен
  const legacy = opts.maxProfileUrl || (opts.maxUserId ? `max://user/${opts.maxUserId}` : null)
  if (legacy?.startsWith('max://') && typeof wa?.openMaxLink === 'function') {
    try {
      wa.openMaxLink(legacy)
      return
    } catch {
      /* fall through */
    }
  }

  if (publicUrl) {
    window.open(publicUrl, '_blank', 'noopener,noreferrer')
  }
}
