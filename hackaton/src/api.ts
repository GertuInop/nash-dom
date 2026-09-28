import type {
  Chat,
  EntranceWork,
  House,
  Message,
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

export interface BootstrapPayload {
  user: User
  houses?: House[]
  chats: Chat[]
  messages: Message[]
  topics: Topic[]
  tickets: Ticket[]
  works: EntranceWork[]
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
    throw new Error((data as { error?: string }).error || `Ошибка ${res.status}`)
  }
  return data as T
}

export const clientApi = {
  login: (phone: string, password: string) =>
    api<BootstrapPayload & { token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    }),

  register: (body: {
    name: string
    phone: string
    password: string
    role: 'resident' | 'uk'
    ukName?: string
  }) =>
    api<BootstrapPayload & { token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () => api<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  me: () => api<BootstrapPayload>('/api/me'),

  selectHouse: (houseId: string) =>
    api<BootstrapPayload>('/api/me/house', {
      method: 'POST',
      body: JSON.stringify({ houseId }),
    }),

  saveAddress: (street: string, entrance: string, flat: string) =>
    api<{ user: User }>('/api/me/address', {
      method: 'POST',
      body: JSON.stringify({ street, entrance, flat }),
    }),

  skipAddress: () =>
    api<{ user: User }>('/api/me/address', {
      method: 'POST',
      body: JSON.stringify({ skip: true }),
    }),

  sendMessage: (chatId: string, text: string) =>
    api<{ message: Message; chats: Chat[]; error?: string }>(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  createTopic: (input: {
    category: TopicCategory
    title: string
    description: string
    photoLabel?: string
    photoUrl?: string
  }) =>
    api<BootstrapPayload & { chatId: string; topic?: Topic }>('/api/topics', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  setTicketStatus: (id: string, status: TicketStatus) =>
    api<{ ticket: Ticket }>(`/api/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  setWorkStatus: (id: string, status: WorkStatus) =>
    api<{ work: EntranceWork }>(`/api/works/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
}
