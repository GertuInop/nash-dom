type MaxBridge = {
  openLink?: (url: string) => void
  openMaxLink?: (url: string) => void
}

/** Открыть профиль человека в MAX (не во внешнем браузере). */
export function openMaxProfile(opts: {
  maxProfileUrl?: string | null
  maxPublicUrl?: string | null
  username?: string | null
  maxUserId?: string | number | null
}) {
  const wa = window.WebApp as MaxBridge | undefined
  const username = String(opts.username || '')
    .trim()
    .replace(/^@/, '')
  const publicUrl =
    opts.maxPublicUrl
    || (username ? `https://max.ru/${username}` : null)
  const deep =
    opts.maxProfileUrl
    || (opts.maxUserId ? `max://user/${opts.maxUserId}` : null)

  // 1) Публичный https://max.ru/username — внутри MAX через openMaxLink
  if (publicUrl && typeof wa?.openMaxLink === 'function') {
    try {
      wa.openMaxLink(publicUrl)
      return
    } catch {
      /* fall through */
    }
  }

  // 2) max://user/{id} — НЕ через openLink (он уводит во внешний браузер).
  // WebView MAX перехватывает клик по max:// и открывает профиль.
  if (deep?.startsWith('max://')) {
    try {
      const a = document.createElement('a')
      a.href = deep
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      a.remove()
      return
    } catch {
      try {
        window.location.href = deep
        return
      } catch {
        /* fall through */
      }
    }
  }

  if (publicUrl) {
    window.open(publicUrl, '_blank', 'noopener,noreferrer')
  }
}
