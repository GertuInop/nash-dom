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

export interface BootstrapPayload {
  user: User
  houses?: House[]
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
    throw new Error((data as { error?: string }).error || `Ошибка ${res.status}`)
  }
  return data as T
}

export const clientApi = {
  login: (phone: string, extra?: { name?: string; role?: string; ukName?: string }) =>
    api<BootstrapPayload & { token: string }>('/server/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, ...extra }),
    }),

  register: (body: {
    name: string
    phone: string
    role: 'resident' | 'uk'
    ukName?: string
    city?: string
  }) =>
    api<BootstrapPayload & { token: string }>('/server/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () => api<{ ok: boolean }>('/server/auth/logout', { method: 'POST' }),

  me: () => api<BootstrapPayload>('/server/me'),

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
