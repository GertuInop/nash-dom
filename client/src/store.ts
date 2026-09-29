import { create } from 'zustand'
import {
  clientApi,
  getMaxInitData,
  getMaxPlatform,
  getMaxUnsafeUser,
  getToken,
  setToken,
  type BootstrapPayload,
  type Company,
} from './api'
import type {
  Chat,
  EntranceWork,
  House,
  Message,
  ParkingSpot,
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
  companies: Company[]
  chats: Chat[]
  messages: Message[]
  topics: Topic[]
  tickets: Ticket[]
  works: EntranceWork[]
  parking: ParkingSpot[]
  toast: Toast | null
  lastSendAt: number
  lastSendText: string
  lastSendTextAt: number
  setToast: (toast: Toast | null) => void
  hydrate: () => Promise<void>
  applyBootstrap: (data: BootstrapPayload, token?: string) => void
  logout: () => Promise<void>
  selectCompany: (companyId: string) => Promise<void>
  selectHouse: (houseId: string) => Promise<void>
  savePrivateAddress: (street: string, entrance: string, flat: string) => Promise<void>
  skipPrivateAddress: () => Promise<void>
  sendMessage: (chatId: string, text: string) => Promise<boolean>
  createTopic: (input: {
    category: TopicCategory
    title: string
    description: string
  }) => Promise<{ ok: boolean; chatId?: string; error?: string }>
  createTicket: (input: {
    category: TopicCategory
    title: string
    description: string
  }) => Promise<{ ok: boolean; error?: string }>
  setTicketStatus: (id: string, status: TicketStatus) => Promise<void>
  setWorkStatus: (id: string, status: WorkStatus) => Promise<void>
  claimParking: (id: string) => Promise<string | null>
  releaseParking: (id: string) => Promise<string | null>
  appealParking: (id: string) => Promise<string | null>
  setParkingActive: (id: string, active: boolean) => Promise<string | null>
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
    companies: data.companies || [],
    chats: data.chats || [],
    messages: data.messages || [],
    topics: data.topics || [],
    tickets: data.tickets || [],
    works: data.works || [],
    parking: data.parking || [],
  })
}

function apiDownMessage(e: unknown) {
  const msg = e instanceof Error ? e.message : ''
  if (/Failed to fetch|NetworkError|ECONNREFUSED|Load failed/i.test(msg)) {
    return 'Сервер недоступен. Запустите API в папке bot (npm run api или docker compose up).'
  }
  return msg || 'Ошибка сервера'
}

async function authViaBridge(): Promise<BootstrapPayload & { token: string }> {
  const initData = getMaxInitData()
  const unsafeUser = getMaxUnsafeUser()
  if (!initData && !unsafeUser) {
    throw new Error('Нет данных MAX Bridge. Откройте мини-приложение внутри MAX.')
  }
  window.WebApp?.ready?.()
  window.WebApp?.expand?.()
  return clientApi.loginMax(initData || '', getMaxPlatform(), unsafeUser)
}

export const useAppStore = create<AppStore>((set, get) => ({
  ready: false,
  apiError: null,
  token: getToken(),
  user: null,
  houses: [],
  companies: [],
  chats: [],
  messages: [],
  topics: [],
  tickets: [],
  works: [],
  parking: [],
  toast: null,
  lastSendAt: 0,
  lastSendText: '',
  lastSendTextAt: 0,

  setToast: (toast) => set({ toast }),

  applyBootstrap: (data, token) => applyData(set, data, token),

  hydrate: async () => {
    const token = getToken()
    const initData = getMaxInitData()
    const unsafeUser = getMaxUnsafeUser()

    // Всегда предпочитаем свежий Bridge-сеанс, если есть initData / user
    if (initData || unsafeUser) {
      try {
        const data = await authViaBridge()
        applyData(set, data, data.token)
        return
      } catch (e) {
        // если Bridge не прошёл, пробуем старый токен
        if (!token) {
          set({
            ready: true,
            user: null,
            token: null,
            apiError: apiDownMessage(e),
          })
          return
        }
      }
    }

    if (!token) {
      set({
        ready: true,
        user: null,
        token: null,
        apiError: initData
          ? null
          : 'Откройте мини-приложение в MAX — вход по телефону отключён.',
      })
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
        companies: [],
        chats: [],
        messages: [],
        topics: [],
        tickets: [],
        works: [],
        parking: [],
        apiError: apiDownMessage(e),
      })
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
      companies: [],
      chats: [],
      messages: [],
      topics: [],
      tickets: [],
      works: [],
      parking: [],
      apiError: null,
    })
  },

  selectCompany: async (companyId) => {
    const data = await clientApi.selectCompany(companyId)
    applyData(set, data)
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
      set({ toast: { type: 'success', text: 'Тема (чат) создана' } })
      return { ok: true, chatId: data.chatId }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Ошибка' }
    }
  },

  createTicket: async (input) => {
    try {
      const { tickets } = await clientApi.createTicket(input)
      set({
        tickets,
        toast: { type: 'success', text: 'Заявка отправлена в УК' },
      })
      return { ok: true }
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

  claimParking: async (id) => {
    try {
      const { parking } = await clientApi.claimParking(id)
      set({ parking, toast: { type: 'success', text: 'Место занято за вами' } })
      return null
    } catch (e) {
      return apiDownMessage(e)
    }
  },

  releaseParking: async (id) => {
    try {
      const { parking } = await clientApi.releaseParking(id)
      set({ parking, toast: { type: 'info', text: 'Место освобождено' } })
      return null
    } catch (e) {
      return apiDownMessage(e)
    }
  },

  appealParking: async (id) => {
    try {
      const { parking, ticket } = await clientApi.appealParking(id)
      set({
        parking,
        tickets: [...get().tickets.filter((t) => t.id !== ticket.id), ticket],
        toast: { type: 'success', text: 'Обжалование отправлено руководителю УК' },
      })
      return null
    } catch (e) {
      return apiDownMessage(e)
    }
  },

  setParkingActive: async (id, active) => {
    try {
      const { parking } = await clientApi.setParkingActive(id, active)
      set({
        parking,
        toast: { type: 'info', text: active ? 'Место активировано' : 'Место отключено' },
      })
      return null
    } catch (e) {
      return apiDownMessage(e)
    }
  },
}))

export function useUser() {
  return useAppStore((s) => s.user)
}
