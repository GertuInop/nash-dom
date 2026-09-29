import type {
  Chat,
  EntranceWork,
  House,
  Message,
  ParkingSpot,
  Ticket,
  TicketStatus,
  Topic,
  TopicCategory,
  User,
  WorkStatus,
} from './types'

const TOKEN_KEY = 'nash-dom-token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export interface Company {
  id: string
  name: string
  city: string
  citySlug: string
  phone: string
  email: string
  address: string
  status: string
}

export interface BootstrapPayload {
  user: User
  houses?: House[]
  companies?: Company[]
  chats: Chat[]
  messages: Message[]
  topics: Topic[]
  tickets: Ticket[]
  works: EntranceWork[]
  parking?: ParkingSpot[]
  token?: string
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(path, { ...init, headers })
  } catch {
    throw new Error('Failed to fetch')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = data as { error?: string; hint?: string; reason?: string }
    const parts = [err.error || `Ошибка ${res.status}`]
    if (err.hint) parts.push(err.hint)
    throw new Error(parts.join('. '))
  }
  return data as T
}

export function getMaxInitData(): string {
  const fromBridge = String(window.WebApp?.initData || '').trim()
  if (fromBridge) return fromBridge

  // Fallback: hash-фрагмент URL (#WebAppData=...)
  try {
    const raw = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash
    if (!raw) return ''
    const params = new URLSearchParams(raw)
    return String(params.get('WebAppData') || '').trim()
  } catch {
    return ''
  }
}

export function getMaxPlatform(): string | null {
  return window.WebApp?.platform || null
}

export const clientApi = {
  loginMax: (initData: string, platform?: string | null) =>
    api<BootstrapPayload & { token: string }>('/server/auth/max', {
      method: 'POST',
      body: JSON.stringify({ initData, platform: platform || undefined }),
    }),

  logout: () => api<{ ok: boolean }>('/server/auth/logout', { method: 'POST' }),

  me: () => api<BootstrapPayload>('/server/me'),

  selectCompany: (companyId: string) =>
    api<BootstrapPayload>('/server/me/company', {
      method: 'POST',
      body: JSON.stringify({ companyId }),
    }),

  selectHouse: (houseId: string) =>
    api<BootstrapPayload>('/server/me/house', {
      method: 'POST',
      body: JSON.stringify({ houseId }),
    }),

  saveAddress: (street: string, entrance: string, flat: string) =>
    api<{ user: User }>('/server/me/address', {
      method: 'POST',
      body: JSON.stringify({ street, entrance, flat }),
    }),

  skipAddress: () =>
    api<{ user: User }>('/server/me/address', {
      method: 'POST',
      body: JSON.stringify({ skip: true }),
    }),

  sendMessage: (chatId: string, text: string) =>
    api<{ message: Message; chats: Chat[]; error?: string }>(`/server/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  createTopic: (input: {
    category: TopicCategory
    title: string
    description: string
  }) =>
    api<BootstrapPayload & { chatId: string; topic?: Topic }>('/server/topics', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  createTicket: (input: { title: string; description: string; category: TopicCategory }) =>
    api<{ ticket: Ticket; tickets: Ticket[] }>('/server/tickets', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  setTicketStatus: (id: string, status: TicketStatus) =>
    api<{ ticket: Ticket }>(`/server/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  setWorkStatus: (id: string, status: WorkStatus) =>
    api<{ work: EntranceWork }>(`/server/works/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  listParking: () => api<{ parking: ParkingSpot[] }>('/server/parking'),

  claimParking: (id: string) =>
    api<{ parking: ParkingSpot[] }>(`/server/parking/${id}/claim`, { method: 'POST' }),

  releaseParking: (id: string) =>
    api<{ parking: ParkingSpot[] }>(`/server/parking/${id}/release`, { method: 'POST' }),

  appealParking: (id: string) =>
    api<{ ticket: Ticket; parking: ParkingSpot[] }>(`/server/parking/${id}/appeal`, {
      method: 'POST',
    }),

  setParkingActive: (id: string, active: boolean) =>
    api<{ parking: ParkingSpot[] }>(`/server/parking/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),
}
