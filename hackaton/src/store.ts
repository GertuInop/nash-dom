import { create } from 'zustand'
import { clientApi, getToken, setToken, type BootstrapPayload } from './api'
import type {
  Chat,
  EntranceWork,
  House,
  Message,
  Ticket,
  TicketStatus,
  Toast,
  Topic,
  TopicCategory,
  User,
  WorkStatus,
} from './types'

const SEND_GAP_MS = 3000
const DUP_WINDOW_MS = 15000

export interface AppStore {
  ready: boolean
  apiError: string | null
  token: string | null
  user: User | null
  houses: House[]
  chats: Chat[]
  messages: Message[]
  topics: Topic[]
  tickets: Ticket[]
  works: EntranceWork[]
  toast: Toast | null
  lastSendAt: number
  lastSendText: string
  lastSendTextAt: number
  setToast: (toast: Toast | null) => void
  hydrate: () => Promise<void>
  applyBootstrap: (data: BootstrapPayload, token?: string) => void
  login: (phone: string, password: string) => Promise<string | null>
  registerResident: (name: string, phone: string, password: string) => Promise<string | null>
  registerUk: (ukName: string, name: string, phone: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
  selectHouse: (houseId: string) => Promise<void>
  savePrivateAddress: (street: string, entrance: string, flat: string) => Promise<void>
  skipPrivateAddress: () => Promise<void>
  sendMessage: (chatId: string, text: string) => Promise<boolean>
  createTopic: (input: {
    category: TopicCategory
    title: string
    description: string
    photoLabel?: string
    photoUrl?: string
  }) => Promise<{ ok: boolean; chatId?: string; error?: string }>
  setTicketStatus: (id: string, status: TicketStatus) => Promise<void>
  setWorkStatus: (id: string, status: WorkStatus) => Promise<void>
}

function applyData(
  set: (partial: Partial<AppStore>) => void,
  data: BootstrapPayload,
  token?: string,
) {
  const nextToken = token ?? getToken()
  if (token) setToken(token)
  set({
    ready: true,
    apiError: null,
    token: nextToken,
    user: { ...data.user, password: '' },
    houses: data.houses || [],
    chats: data.chats || [],
    messages: data.messages || [],
    topics: data.topics || [],
    tickets: data.tickets || [],
    works: data.works || [],
  })
}

function apiDownMessage(e: unknown) {
  const msg = e instanceof Error ? e.message : ''
  if (/Failed to fetch|NetworkError|ECONNREFUSED|Load failed/i.test(msg)) {
    return 'Сервер недоступен. Запустите API в папке bot (npm run api или docker compose up).'
  }
  return msg || 'Ошибка сервера'
}

export const useAppStore = create<AppStore>((set, get) => ({
  ready: false,
  apiError: null,
  token: getToken(),
  user: null,
  houses: [],
  chats: [],
  messages: [],
  topics: [],
  tickets: [],
  works: [],
  toast: null,
  lastSendAt: 0,
  lastSendText: '',
  lastSendTextAt: 0,

  setToast: (toast) => set({ toast }),

  applyBootstrap: (data, token) => applyData(set, data, token),

  hydrate: async () => {
    const token = getToken()
    if (!token) {
      set({ ready: true, user: null, token: null, apiError: null })
      return
    }
    try {
      const data = await clientApi.me()
      applyData(set, data)
    } catch (e) {
      setToken(null)
      set({
        ready: true,
        user: null,
        token: null,
        houses: [],
        chats: [],
        messages: [],
        topics: [],
        tickets: [],
        works: [],
        apiError: apiDownMessage(e),
      })
    }
  },

  login: async (phone, password) => {
    try {
      const data = await clientApi.login(phone, password)
      applyData(set, data, data.token)
      return null
    } catch (e) {
      return apiDownMessage(e)
    }
  },

  registerResident: async (name, phone, password) => {
    try {
      const data = await clientApi.register({ name, phone, password, role: 'resident' })
      applyData(set, data, data.token)
      return null
    } catch (e) {
      return apiDownMessage(e)
    }
  },

  registerUk: async (ukName, name, phone, password) => {
    try {
      const data = await clientApi.register({ name, phone, password, role: 'uk', ukName })
      applyData(set, data, data.token)
      return null
    } catch (e) {
      return apiDownMessage(e)
    }
  },

  logout: async () => {
    try {
      await clientApi.logout()
    } catch {
      /* ignore */
    }
    setToken(null)
    set({
      token: null,
      user: null,
      houses: [],
      chats: [],
      messages: [],
      topics: [],
      tickets: [],
      works: [],
      apiError: null,
    })
  },

  selectHouse: async (houseId) => {
    const data = await clientApi.selectHouse(houseId)
    applyData(set, data)
  },

  savePrivateAddress: async (street, entrance, flat) => {
    const { user } = await clientApi.saveAddress(street, entrance, flat)
    set({ user: { ...user, password: '' } })
  },

  skipPrivateAddress: async () => {
    const { user } = await clientApi.skipAddress()
    set({ user: { ...user, password: '' } })
  },

  sendMessage: async (chatId, text) => {
    const now = Date.now()
    const trimmed = text.trim()
    if (now - get().lastSendAt < SEND_GAP_MS) {
      set({ toast: { type: 'info', text: 'Подождите 3 секунды перед следующим сообщением' } })
      return false
    }
    if (trimmed === get().lastSendText && now - get().lastSendTextAt < DUP_WINDOW_MS) {
      set({ toast: { type: 'error', text: 'Это сообщение уже отправлено' } })
      return false
    }

    try {
      const res = await clientApi.sendMessage(chatId, trimmed)
      set({
        messages: [...get().messages.filter((m) => m.id !== res.message.id), res.message],
        chats: res.chats?.length
          ? res.chats
          : get().chats.map((c) =>
              c.id === chatId ? { ...c, lastMessage: res.message.text, time: res.message.time } : c,
            ),
        lastSendAt: now,
        lastSendText: trimmed,
        lastSendTextAt: now,
      })
      return true
    } catch (e) {
      try {
        const data = await clientApi.me()
        applyData(set, data)
      } catch {
        /* ignore */
      }
      set({
        lastSendAt: now,
        toast: { type: 'error', text: e instanceof Error ? e.message : 'Не удалось отправить' },
      })
      return false
    }
  },

  createTopic: async (input) => {
    try {
      const data = await clientApi.createTopic(input)
      applyData(set, data)
      set({
        toast: {
          type: 'success',
          text: data.tickets?.some((t) => t.title === input.title.trim())
            ? 'Тема опубликована, заявка для УК создана'
            : 'Тема опубликована',
        },
      })
      return { ok: true, chatId: data.chatId }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Ошибка' }
    }
  },

  setTicketStatus: async (id, status) => {
    const { ticket } = await clientApi.setTicketStatus(id, status)
    set({
      tickets: get().tickets.map((t) => (t.id === id ? ticket : t)),
    })
  },

  setWorkStatus: async (id, status) => {
    const { work } = await clientApi.setWorkStatus(id, status)
    set({
      works: get().works.map((item) => (item.id === id ? work : item)),
    })
  },
}))

export function useUser() {
  return useAppStore((s) => s.user)
}
