export type UserRole = 'resident' | 'uk' | 'admin'

export type ChatType = 'general' | 'uk' | 'topic'

export type TicketStatus = 'new' | 'in_progress' | 'done' | 'rejected'

export type TopicCategory =
  | 'accident'
  | 'cleaning'
  | 'parking'
  | 'overhaul'
  | 'elevator'
  | 'heating'
  | 'power'
  | 'water'
  | 'landscaping'
  | 'quality'
  | 'other'

export interface User {
  id: string
  name: string
  phone: string
  password?: string
  role: UserRole
  houseId?: string
  ukName?: string
  /** Приватные поля: только сам пользователь */
  street?: string
  entrance?: string
  flat?: string
  skippedAddress?: boolean
  companyId?: string
  blocked?: boolean
  maxUserId?: string
  username?: string
  consentAccepted?: boolean
}

export interface House {
  id: string
  address: string
  uk: string
  city: string
  companyId?: string
  floors: number
  entrances: number
}

export type WorkStatus = 'todo' | 'in_progress' | 'done'

export interface EntranceWork {
  id: string
  houseId: string
  entrance: number
  floor: number | null
  title: string
  detail: string
  status: WorkStatus
}

export interface ParkingSpot {
  id: string
  houseId: string
  label: string
  row: number
  col: number
  active: boolean
  occupied: boolean
  occupiedByUserId: string | null
  occupiedAt: string | null
}

export function workLabel(status: WorkStatus) {
  if (status === 'done') return 'Сделано'
  if (status === 'in_progress') return 'В работе'
  return 'Нужно сделать'
}

export interface Chat {
  id: string
  houseId: string
  name: string
  type: ChatType
  lastMessage: string
  time: string
  unread: number
  topicId?: string
}

export interface Message {
  id: string
  chatId: string
  text: string
  senderId: string
  senderName: string
  time: string
  hidden?: boolean
  system?: boolean
  photoLabel?: string
  photoUrl?: string
}

export interface Topic {
  id: string
  houseId: string
  chatId: string
  category: TopicCategory
  title: string
  description: string
  authorId: string
  author: string
  comments: number
  time: string
  photoLabel?: string
  photoUrl?: string
}

export interface CompanyMember {
  id: string
  name: string
  phone: string
  role: string
  username?: string
  maxUserId?: string
  maxProfileUrl?: string
  city?: string
  address?: string
  personalAccount?: string
}

export interface Ticket {
  id: string
  publicNumber?: string
  houseId?: string
  title: string
  description: string
  category: TopicCategory
  status: TicketStatus
  /** Только адрес дома, без подъезда и квартиры */
  address: string
  createdAt: string
  authorId: string
  author: string
  authorMaxUserId?: string
  authorUsername?: string
  authorMaxProfileUrl?: string
  ukComment?: string
  companyId?: string
  messages?: { id: string; role: string; body: string; createdAt: string }[]
}

export interface Toast {
  type: 'success' | 'error' | 'info'
  text: string
}

export const TOPIC_CATEGORIES: { id: TopicCategory; label: string }[] = [
  { id: 'accident', label: 'Авария' },
  { id: 'cleaning', label: 'Уборка' },
  { id: 'parking', label: 'Парковка' },
  { id: 'overhaul', label: 'Капремонт' },
  { id: 'elevator', label: 'Лифт' },
  { id: 'heating', label: 'Отопление' },
  { id: 'power', label: 'Электричество' },
  { id: 'water', label: 'Водоснабжение' },
  { id: 'landscaping', label: 'Благоустройство' },
  { id: 'quality', label: 'Качество услуг' },
  { id: 'other', label: 'Другое' },
]

export const TICKET_CATEGORIES: TopicCategory[] = ['accident', 'quality']
