/**
 * Нормализация и нечёткий поиск городов.
 * Канонический slug: "москва", "санкт_петербург", "набережные_челны"
 */

const YO = /ё/g;

/** Известные варианты написания → slug */
const ALIASES = new Map([
  ['мск', 'москва'],
  ['moscow', 'москва'],
  ['спб', 'санкт_петербург'],
  ['питер', 'санкт_петербург'],
  ['петербург', 'санкт_петербург'],
  ['leningrad', 'санкт_петербург'],
  ['н_челны', 'набережные_челны'],
  ['челны', 'набережные_челны'],
  ['наб_челны', 'набережные_челны'],
]);

export function toCitySlug(input) {
  if (!input) return '';
  let s = String(input).trim().toLowerCase().replace(YO, 'е');
  s = s.replace(/^г\.?\s*/u, '');
  s = s.replace(/^город\s+/u, '');
  s = s.replace(/[^a-zа-я0-9\s_-]+/gu, ' ');
  s = s.replace(/[\s-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return ALIASES.get(s) || s;
}

/** Человекочитаемое имя из slug: санкт_петербург → Санкт-Петербург */
export function formatCityDisplay(slug, displayName) {
  if (displayName) return displayName;
  if (!slug) return '';
  return slug
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join('-');
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length) + 0.15;
  }
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - dist / maxLen;
}

/**
 * @param {string} rawInput
 * @param {Array<{ slug: string, display_name: string }>} cities
 * @returns {{ slug: string, display_name: string, score: number } | null}
 */
export function findBestCityMatch(rawInput, cities) {
  const slug = toCitySlug(rawInput);
  if (!slug || !cities?.length) return null;

  let best = null;
  for (const city of cities) {
    const bySlug = similarity(slug, city.slug);
    const byName = similarity(slug, toCitySlug(city.display_name));
    const score = Math.max(bySlug, byName);
    if (!best || score > best.score) {
      best = {
        slug: city.slug,
        display_name: city.display_name,
        score,
      };
    }
  }

  if (!best || best.score < 0.55) return null;
  return best;
}

export function normalizePhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  return null;
}

export function isValidEmail(input) {
  const email = String(input || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
