export interface ModerationResult {
  allowed: boolean
  reason?: string
}

const PROFANITY =
  /(хуй|пизд|бляд|ебан|ёбан|сука|мудак|идиот|дурак|дебил|гандон|fuck|shit|bitch)/i

const SPAM =
  /(казино|ставк[аи]|крипт|купить сейчас|бесплатн\w+ денег|виагр|кредит без)/i

function stripUrls(text: string): string[] {
  return text.match(/https?:\/\/[^\s]+/gi) ?? []
}

function isAllowedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host === 'max.ru' || host.endsWith('.max.ru') || host === 'gosuslugi.ru' || host.endsWith('.gosuslugi.ru')
  } catch {
    return false
  }
}

/** Мок нейросетевой модерации. */
export function moderateMessage(text: string): ModerationResult {
  const trimmed = text.trim()
  if (!trimmed) return { allowed: false, reason: 'Пустое сообщение' }
  if (trimmed.length < 2) return { allowed: false, reason: 'Слишком коротко' }
  if (trimmed.length > 2000) return { allowed: false, reason: 'Больше 2000 символов' }

  if (PROFANITY.test(trimmed)) return { allowed: false, reason: 'Оскорбления и мат запрещены' }
  if (SPAM.test(trimmed)) return { allowed: false, reason: 'Похоже на спам или рекламу' }

  const urls = stripUrls(trimmed)
  if (urls.some((url) => !isAllowedHost(url))) {
    return { allowed: false, reason: 'Внешние ссылки запрещены' }
  }

  const letters = trimmed.replace(/[^A-Za-zА-Яа-яЁё]/g, '')
  if (letters.length > 10) {
    const caps = letters.replace(/[^A-ZА-ЯЁ]/g, '').length
    if (caps / letters.length > 0.7) {
      return { allowed: false, reason: 'Слишком много заглавных букв' }
    }
  }

  const withoutSpace = trimmed.replace(/\s/g, '')
  const hasLetter = /[A-Za-zА-Яа-яЁё]/.test(withoutSpace)
  if (withoutSpace.length >= 6 && !hasLetter) {
    return { allowed: false, reason: 'Сообщение без текста' }
  }

  if (/(.)\1{5,}/.test(trimmed)) {
    return { allowed: false, reason: 'Повтор символов' }
  }

  return { allowed: true }
}
