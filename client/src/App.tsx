import { useState, useEffect, useRef, useCallback } from 'react'

type Role = 'resident' | 'uk'
type Screen =
  | 'auth-login'
  | 'auth-register-resident'
  | 'auth-register-uk'
  | 'select-house'
  | 'private-address'
  | 'home'
  | 'chats'
  | 'chat'
  | 'topics'
  | 'profile'
  | 'my-tickets'
  | 'uk-dashboard'

interface User {
  id: string
  name: string
  phone: string
  role: Role
  houseId?: string
  apartment?: string
  ukName?: string
  street?: string
  entrance?: string
  flat?: string
}

interface House {
  id: string
  address: string
  uk: string
  city: string
}

interface Message {
  id: string
  text: string
  senderId: string
  senderName: string
  time: string
  hidden?: boolean
  system?: boolean
  photoLabel?: string
  photoUrl?: string
}

interface Chat {
  id: string
  name: string
  type: 'general' | 'uk' | 'topic'
  lastMessage: string
  time: string
  unread: number
}

interface Topic {
  id: string
  category: string
  title: string
  description: string
  author: string
  comments: number
  time: string
  status?: string
  photoLabel?: string
  photoUrl?: string
}

interface Ticket {
  id: string
  title: string
  description: string
  category: string
  status: 'new' | 'in_progress' | 'done'
  address: string
  createdAt: string
  author: string
}

const HOUSES: House[] = [
  { id: 'h1', address: 'ул. Уральская, 3', uk: 'УК «Жилсервис»', city: 'Курган' },
  { id: 'h2', address: 'ул. Советская, 113а', uk: 'УК «Управдом 68»', city: 'Тамбов' },
  { id: 'h3', address: 'ул. Володарского, 74', uk: 'ЖЭУ ЗАВ ремстрой', city: 'Архангельск' },
  { id: 'h4', address: 'ул. Ленина, 25', uk: 'Жилфонд-Сервис', city: 'Каспийск' },
  { id: 'h5', address: 'ул. Шишканя, 12', uk: 'УК «Север»', city: 'Всеволожск' },
]

const CATEGORIES = [
  'Авария', 'Уборка', 'Парковка', 'Капремонт', 'Лифт',
  'Отопление', 'Электричество', 'Водоснабжение', 'Благоустройство',
  'Качество услуг', 'Другое',
]

const FILTERS = [
  'Все', 'Авария', 'Уборка', 'Парковка', 'Капремонт',
  'Лифт', 'Отопление', 'Электричество', 'Водоснабжение', 'Благоустройство',
]

const BANNED_PATTERNS: RegExp[] = [
  /б[лl]+я/i, /су[кk]+а/i, /х[уy]+[йиi]/i, /п[иi]+зд/i,
  /еб[аa]+н/i, /муд[аa]+к/i, /де[бb]+ил/i, /ид[иi]+от/i,
  /пид[оo]+р/i, /ганд[оo]+н/i, /шлюх/i, /бляд/i,
  /\bspam\b/i, /\breklama\b/i, /\bреклама\b/i,
  /http[s]?:\/\/(?!max\.ru|gosuslugi)/i,
  /(.)\1{6,}/,
]

function moderateMessage(text: string): { allowed: boolean; reason?: string } {
  const trimmed = text.trim()
  if (!trimmed) return { allowed: false, reason: 'Пустое сообщение' }
  if (trimmed.length > 2000) return { allowed: false, reason: 'Сообщение слишком длинное (макс. 2000 символов)' }
  if (trimmed.length < 2) return { allowed: false, reason: 'Слишком короткое сообщение' }
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, reason: 'Сообщение нарушает правила сообщества' }
    }
  }
  const letters = trimmed.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '')
  if (letters.length > 10) {
    const upper = letters.replace(/[^A-ZА-ЯЁ]/g, '').length
    if (upper / letters.length > 0.7) {
      return { allowed: false, reason: 'Избыточное использование ЗАГЛАВНЫХ букв' }
    }
  }
  if (/^[\d\s\W]+$/.test(trimmed) && trimmed.length > 5) {
    return { allowed: false, reason: 'Сообщение похоже на спам' }
  }
  if (/(.)\1{5,}/.test(trimmed)) {
    return { allowed: false, reason: 'Обнаружен спам (повтор символов)' }
  }
  return { allowed: true }
}

const I = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  back: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  send: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  plus: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  building: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
    </svg>
  ),
  alert: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  check: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  empty: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  ),
}

function useToast() {
  const [toast, setToast] = useState<{ text: string; type: string } | null>(null)
  const show = useCallback((text: string, type = 'info') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 2800)
  }, [])
  return { toast, show }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('auth-login')
  const [user, setUser] = useState<User | null>(null)
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [topics, setTopics] = useState<Topic[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [filter, setFilter] = useState('Все')
  const [chatInput, setChatInput] = useState('')
  const [lastSentAt, setLastSentAt] = useState(0)
  const [lastSentText, setLastSentText] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900)

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [regName, setRegName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regPass, setRegPass] = useState('')
  const [regUkName, setRegUkName] = useState('')
  const [regError, setRegError] = useState('')

  const [privStreet, setPrivStreet] = useState('')
  const [privEntrance, setPrivEntrance] = useState('')
  const [privFlat, setPrivFlat] = useState('')

  const [topicCat, setTopicCat] = useState('Авария')
  const [topicTitle, setTopicTitle] = useState('')
  const [topicDesc, setTopicDesc] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast, show } = useToast()

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeChatId])

  const now = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  const ensureDefaultChats = () => {
    setChats(prev => {
      if (prev.length > 0) return prev
      return [
        { id: 'c-general', name: 'Общий чат дома', type: 'general', lastMessage: '', time: '', unread: 0 },
        { id: 'c-uk', name: 'Чат с УК', type: 'uk', lastMessage: '', time: '', unread: 0 },
      ]
    })
    setMessages(prev => {
      if (prev['c-general'] || prev['c-uk']) return prev
      return { ...prev, 'c-general': [], 'c-uk': [] }
    })
  }

  const handleLogin = () => {
    setRegError('')
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      setRegError('Введите корректный номер телефона')
      return
    }
    if (!password || password.length < 4) {
      setRegError('Пароль должен быть не менее 4 символов')
      return
    }
    const isUk = phone.replace(/\D/g, '').endsWith('1')
    const u: User = {
      id: 'me',
      name: isUk ? 'Оператор УК' : 'Александр Иванов',
      phone,
      role: isUk ? 'uk' : 'resident',
      apartment: isUk ? undefined : '42',
      ukName: isUk ? 'УК «Жилсервис»' : undefined,
    }
    setUser(u)
    if (isUk) {
      ensureDefaultChats()
      setScreen('uk-dashboard')
    } else {
      setScreen('select-house')
    }
    show(isUk ? 'Вход как УК' : 'Добро пожаловать', 'success')
  }

  const handleRegResident = () => {
    setRegError('')
    if (!regName.trim()) { setRegError('Введите ФИО'); return }
    if (!regPhone || regPhone.replace(/\D/g, '').length < 10) { setRegError('Введите телефон'); return }
    if (!regPass || regPass.length < 4) { setRegError('Пароль не менее 4 символов'); return }
    setUser({ id: 'me', name: regName.trim(), phone: regPhone, role: 'resident' })
    setScreen('select-house')
    show('Регистрация успешна', 'success')
  }

  const handleRegUk = () => {
    setRegError('')
    if (!regUkName.trim()) { setRegError('Введите название УК'); return }
    if (!regName.trim()) { setRegError('Введите ФИО ответственного'); return }
    if (!regPhone || regPhone.replace(/\D/g, '').length < 10) { setRegError('Введите телефон'); return }
    if (!regPass || regPass.length < 4) { setRegError('Пароль не менее 4 символов'); return }
    setUser({ id: 'me', name: regName.trim(), phone: regPhone, role: 'uk', ukName: regUkName.trim() })
    ensureDefaultChats()
    setScreen('uk-dashboard')
    show('Заявка УК зарегистрирована', 'success')
  }

  const handleSelectHouse = (house: House) => {
    setSelectedHouse(house)
    setUser(u => (u ? { ...u, houseId: house.id } : u))
    ensureDefaultChats()
    if (!privStreet) {
      const parts = house.address.split(',')
      setPrivStreet(parts[0]?.trim() || house.address)
    }
    setScreen('private-address')
    show(`Дом: ${house.address}`, 'success')
  }

  const handleSavePrivateAddress = () => {
    if (!privStreet.trim()) { show('Укажите улицу', 'error'); return }
    if (!privEntrance.trim()) { show('Укажите подъезд', 'error'); return }
    if (!privFlat.trim()) { show('Укажите номер квартиры', 'error'); return }
    setUser(u =>
      u
        ? {
            ...u,
            street: privStreet.trim(),
            entrance: privEntrance.trim(),
            flat: privFlat.trim(),
            apartment: privFlat.trim(),
          }
        : u
    )
    setScreen('home')
    show('Адрес сохранён (виден только вам)', 'success')
  }

  const handleLogout = () => {
    setUser(null)
    setSelectedHouse(null)
    setChats([])
    setMessages({})
    setTopics([])
    setTickets([])
    setActiveChatId(null)
    setScreen('auth-login')
    setPhone('')
    setPassword('')
    setRegName('')
    setRegPhone('')
    setRegPass('')
    setRegUkName('')
    setPrivStreet('')
    setPrivEntrance('')
    setPrivFlat('')
    setLastSentAt(0)
    setLastSentText('')
  }

  const openChat = (chatId: string) => {
    setActiveChatId(chatId)
    setScreen('chat')
    setChats(prev => prev.map(c => (c.id === chatId ? { ...c, unread: 0 } : c)))
  }

  const sendMessage = () => {
    if (!chatInput.trim() || !activeChatId) return
    const nowMs = Date.now()
    if (nowMs - lastSentAt < 3000) {
      const sec = Math.ceil((3000 - (nowMs - lastSentAt)) / 1000)
      show(`Подождите ${sec} сек. перед следующим сообщением`, 'error')
      return
    }
    const text = chatInput.trim()
    if (text === lastSentText && nowMs - lastSentAt < 15000) {
      show('Нельзя отправлять одно и то же сообщение повторно', 'error')
      return
    }
    const result = moderateMessage(text)
    const time = now()
    if (!result.allowed) {
      setMessages(prev => ({
        ...prev,
        [activeChatId]: [
          ...(prev[activeChatId] || []),
          {
            id: `m-${Date.now()}`,
            text: 'Сообщение скрыто модерацией',
            senderId: 'system',
            senderName: '',
            time,
            hidden: true,
          },
        ],
      }))
      show(result.reason || 'Сообщение отклонено', 'error')
      setChatInput('')
      return
    }
    setMessages(prev => ({
      ...prev,
      [activeChatId]: [
        ...(prev[activeChatId] || []),
        { id: `m-${Date.now()}`, text, senderId: 'me', senderName: 'Вы', time },
      ],
    }))
    setChats(prev =>
      prev.map(c => (c.id === activeChatId ? { ...c, lastMessage: text.slice(0, 40), time } : c))
    )
    setChatInput('')
    setLastSentAt(nowMs)
    setLastSentText(text)
  }

  const handleCreateTopic = () => {
    if (!topicTitle.trim()) { show('Введите заголовок', 'error'); return }
    const titleCheck = moderateMessage(topicTitle)
    if (!titleCheck.allowed) { show(titleCheck.reason || 'Заголовок нарушает правила', 'error'); return }
    if (topicDesc.trim()) {
      const descCheck = moderateMessage(topicDesc)
      if (!descCheck.allowed) { show(descCheck.reason || 'Описание нарушает правила', 'error'); return }
    }
    const id = `t-${Date.now()}`
    const title = topicTitle.trim()
    const description = topicDesc.trim()
    setTopics(prev => [
      {
        id,
        category: topicCat,
        title,
        description,
        author: user?.name || 'Вы',
        comments: 0,
        time: 'сейчас',
      },
      ...prev,
    ])
    const chatId = `c-${id}`
    setChats(prev => [
      { id: chatId, name: title, type: 'topic', lastMessage: 'Тема создана', time: now(), unread: 0 },
      ...prev,
    ])
    setMessages(prev => ({
      ...prev,
      [chatId]: [
        {
          id: `m-${Date.now()}`,
          text: `Тема создана: ${title}`,
          senderId: 'system',
          senderName: '',
          time: now(),
          system: true,
        },
      ],
    }))
    if (topicCat === 'Авария' || topicCat === 'Качество услуг') {
      setTickets(prev => [
        {
          id: `TK-${String(prev.length + 1).padStart(3, '0')}`,
          title,
          description,
          category: topicCat,
          status: 'new',
          address: selectedHouse?.address || '',
          createdAt: new Date().toLocaleString('ru-RU'),
          author: user?.name || 'Житель',
        },
        ...prev,
      ])
    }
    setShowCreate(false)
    setTopicTitle('')
    setTopicDesc('')
    show('Тема опубликована', 'success')
  }

  const updateTicket = (id: string, status: Ticket['status']) => {
    setTickets(prev => prev.map(t => (t.id === id ? { ...t, status } : t)))
    show(status === 'in_progress' ? 'Заявка в работе' : 'Заявка выполнена', 'success')
  }

  const statusBadge = (s: Ticket['status']) => {
    if (s === 'new') return <span className="badge badge-new">Новая</span>
    if (s === 'in_progress') return <span className="badge badge-progress">В работе</span>
    return <span className="badge badge-done">Выполнена</span>
  }

  const BottomNav = (
    <nav className="bottom-nav">
      <button
        className={`nav-item ${screen === 'home' || screen === 'topics' ? 'active' : ''}`}
        onClick={() => setScreen('home')}
      >
        {I.home}<span>Лента</span>
      </button>
      <button className={`nav-item ${screen === 'chats' || screen === 'chat' ? 'active' : ''}`} onClick={() => setScreen('chats')}>
        {I.chat}<span>Чаты</span>
      </button>
      <button className={`nav-item ${screen === 'topics' ? 'active' : ''}`} onClick={() => setScreen('topics')}>
        {I.list}<span>Темы</span>
      </button>
      <button
        className={`nav-item ${screen === 'profile' || screen === 'my-tickets' ? 'active' : ''}`}
        onClick={() => setScreen('profile')}
      >
        {I.user}<span>Профиль</span>
      </button>
    </nav>
  )

  const createModal = showCreate ? (
    <div className="overlay" onClick={() => setShowCreate(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">Новая тема</div>
        <div className="form-group">
          <label className="form-label">Категория</label>
          <select className="input" value={topicCat} onChange={e => setTopicCat(e.target.value)}>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Заголовок</label>
          <input
            className="input"
            placeholder="Кратко опишите проблему"
            value={topicTitle}
            onChange={e => setTopicTitle(e.target.value)}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label className="form-label">Описание</label>
          <textarea
            className="input"
            rows={3}
            placeholder="Подробности, этаж, подъезд..."
            value={topicDesc}
            onChange={e => setTopicDesc(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Фото (необязательно)</label>
          <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 8, fontSize: 13, color: 'var(--text-2)' }}>
            Фото: foto_problemy.jpg
            <br />
            URL: https://example.com/photo.jpg
          </div>
        </div>
        <button className="btn btn-primary btn-block" onClick={handleCreateTopic}>
          Опубликовать
        </button>
      </div>
    </div>
  ) : null

  const Toast = toast ? <div className={`toast ${toast.type}`}>{toast.text}</div> : null

  // ---- AUTH LOGIN ----
  if (screen === 'auth-login') {
    return (
      <div className="app-root">
        <div className="auth-page">
          {Toast}
          <div className="auth-box">
            <div className="auth-logo">ND</div>
            <div className="auth-title">Наш Дом</div>
            <div className="auth-sub">Сервис для жителей и УК</div>
            <div className="form-group">
              <label className="form-label">Телефон</label>
              <input className="input" type="tel" placeholder="+7 900 000-00-00" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Пароль</label>
              <input className="input" type="password" placeholder="Минимум 4 символа" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {regError && <div className="form-error">{regError}</div>}
            <button className="btn btn-primary btn-block" style={{ marginTop: 4 }} onClick={handleLogin}>
              Войти
            </button>
            <div className="auth-footer">
              Нет аккаунта?{' '}
              <a href="#" onClick={e => { e.preventDefault(); setScreen('auth-register-resident'); setRegError('') }}>Житель</a>
              {' / '}
              <a href="#" onClick={e => { e.preventDefault(); setScreen('auth-register-uk'); setRegError('') }}>УК</a>
            </div>
            <div className="auth-hint">
              Демо: любой телефон + пароль от 4 символов.
              Телефон, оканчивающийся на 1 — вход как УК.
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---- REGISTER RESIDENT ----
  if (screen === 'auth-register-resident') {
    return (
      <div className="app-root">
        <div className="auth-page">
          {Toast}
          <div className="auth-box">
            <div className="auth-logo">ND</div>
            <div className="auth-title">Регистрация жителя</div>
            <div className="auth-sub">Создайте аккаунт</div>
            <div className="form-group">
              <label className="form-label">ФИО</label>
              <input className="input" placeholder="Иванов Иван Иванович" value={regName} onChange={e => setRegName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Телефон</label>
              <input className="input" type="tel" placeholder="+7 900 000-00-00" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Пароль</label>
              <input className="input" type="password" placeholder="Минимум 4 символа" value={regPass} onChange={e => setRegPass(e.target.value)} />
            </div>
            {regError && <div className="form-error">{regError}</div>}
            <button className="btn btn-primary btn-block" style={{ marginTop: 4 }} onClick={handleRegResident}>
              Зарегистрироваться
            </button>
            <div className="auth-footer">
              Уже есть аккаунт?{' '}
              <a href="#" onClick={e => { e.preventDefault(); setScreen('auth-login'); setRegError('') }}>Войти</a>
              {' · '}
              <a href="#" onClick={e => { e.preventDefault(); setScreen('auth-register-uk'); setRegError('') }}>Регистрация УК</a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---- REGISTER UK ----
  if (screen === 'auth-register-uk') {
    return (
      <div className="app-root">
        <div className="auth-page">
          {Toast}
          <div className="auth-box">
            <div className="auth-logo">ND</div>
            <div className="auth-title">Регистрация УК</div>
            <div className="auth-sub">Аккаунт управляющей компании</div>
            <div className="form-group">
              <label className="form-label">Название УК</label>
              <input className="input" placeholder="УК Жилсервис" value={regUkName} onChange={e => setRegUkName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">ФИО ответственного</label>
              <input className="input" placeholder="Петров Пётр Петрович" value={regName} onChange={e => setRegName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Телефон</label>
              <input className="input" type="tel" placeholder="+7 900 000-00-00" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Пароль</label>
              <input className="input" type="password" placeholder="Минимум 4 символа" value={regPass} onChange={e => setRegPass(e.target.value)} />
            </div>
            {regError && <div className="form-error">{regError}</div>}
            <button className="btn btn-primary btn-block" style={{ marginTop: 4 }} onClick={handleRegUk}>
              Зарегистрировать УК
            </button>
            <div className="auth-footer">
              Уже есть аккаунт?{' '}
              <a href="#" onClick={e => { e.preventDefault(); setScreen('auth-login'); setRegError('') }}>Войти</a>
              {' · '}
              <a href="#" onClick={e => { e.preventDefault(); setScreen('auth-register-resident'); setRegError('') }}>Регистрация жителя</a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---- SELECT HOUSE ----
  if (screen === 'select-house') {
    return (
      <div className="app-root">
        <div className="shell">
          {Toast}
          <div className="header">
            <div className="header-title">Выберите дом</div>
          </div>
          <div className="content pad no-nav">
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 16 }}>
              Найдите свой дом в списке
            </p>
            <input className="input" placeholder="Поиск по адресу..." style={{ marginBottom: 16 }} />
            {HOUSES.map(h => (
              <div key={h.id} className="house-item" onClick={() => handleSelectHouse(h)}>
                <div className="house-icon">{I.building}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{h.address}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                    {h.city} · {h.uk}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ---- PRIVATE ADDRESS ----
  if (screen === 'private-address') {
    return (
      <div className="app-root">
        <div className="shell">
          {Toast}
          <div className="header">
            <div className="header-title">Ваш адрес</div>
          </div>
          <div className="content pad no-nav">
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 8, lineHeight: 1.5 }}>
              Укажите улицу, подъезд и номер квартиры. Эти данные видны только вам — другие жители и УК их не увидят.
            </p>
            <div
              style={{
                padding: 12,
                background: 'var(--purple-soft)',
                borderRadius: 10,
                fontSize: 13,
                color: 'var(--purple)',
                marginBottom: 20,
                lineHeight: 1.4,
              }}
            >
              Конфиденциально: адрес используется только для ваших заявок и профиля.
            </div>
            {selectedHouse && (
              <div className="info-card" style={{ marginBottom: 16 }}>
                <div className="info-label">Выбранный дом</div>
                <div className="info-value">{selectedHouse.address}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{selectedHouse.uk}</div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Улица</label>
              <input className="input" placeholder="ул. Уральская" value={privStreet} onChange={e => setPrivStreet(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Подъезд</label>
              <input className="input" placeholder="2" value={privEntrance} onChange={e => setPrivEntrance(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Квартира</label>
              <input className="input" placeholder="42" value={privFlat} onChange={e => setPrivFlat(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} onClick={handleSavePrivateAddress}>
              Сохранить
            </button>
            <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setScreen('home')}>
              Пропустить
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---- CHAT ----
  if (screen === 'chat' && activeChatId) {
    const chat = chats.find(c => c.id === activeChatId)
    const msgs = messages[activeChatId] || []

    const chatMain = (
      <div className="chat-page" style={{ maxWidth: 'none', width: '100%' }}>
        {Toast}
        <div className="header">
          <button
            className="header-back"
            onClick={() => setScreen(user?.role === 'uk' ? 'uk-dashboard' : 'chats')}
          >
            {I.back}
          </button>
          <div className="header-title">{chat?.name || 'Чат'}</div>
        </div>
        <div className="messages">
          {msgs.length === 0 && (
            <div className="empty" style={{ marginTop: 40 }}>
              <div className="empty-icon">{I.empty}</div>
              <div className="empty-title">Нет сообщений</div>
              <div className="empty-sub">Напишите первое сообщение</div>
            </div>
          )}
          {msgs.map(m => (
            <div
              key={m.id}
              className={`msg ${m.hidden ? 'hidden' : m.system ? 'system' : m.senderId === 'me' ? 'own' : 'other'}`}
            >
              {!m.hidden && !m.system && m.senderId !== 'me' && (
                <div className="msg-name">{m.senderName}</div>
              )}
              {m.text}
              {m.photoLabel && (
                <div className="msg-photo">
                  Фото: {m.photoLabel}
                  <br />
                  <span style={{ fontSize: 11 }}>URL: {m.photoUrl || 'https://example.com/photo.jpg'}</span>
                </div>
              )}
              {!m.hidden && !m.system && <div className="msg-time">{m.time}</div>}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="input-bar">
          <textarea
            rows={1}
            placeholder="Сообщение..."
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
          />
          <button
            className="send-btn"
            onClick={sendMessage}
            disabled={!chatInput.trim() || Date.now() - lastSentAt < 3000}
          >
            {I.send}
          </button>
        </div>
      </div>
    )

    if (isDesktop && user?.role !== 'uk') {
      return (
        <div className="app-root">
          <div className="shell">
            <div className="shell-sidebar">
              <div className="header">
                <div className="header-title">Чаты</div>
              </div>
              <div className="content" style={{ paddingBottom: 8 }}>
                {chats.length === 0 ? (
                  <div className="empty">
                    <div className="empty-sub">Нет чатов</div>
                  </div>
                ) : (
                  chats.map(c => (
                    <div
                      key={c.id}
                      className="list-item"
                      onClick={() => openChat(c.id)}
                      style={c.id === activeChatId ? { background: 'var(--purple-soft)' } : undefined}
                    >
                      <div className={`avatar ${c.type === 'uk' ? 'green' : c.type === 'topic' ? 'orange' : ''}`}>
                        {c.type === 'uk' ? 'UK' : c.type === 'topic' ? 'T' : 'O'}
                      </div>
                      <div className="list-body">
                        <div className="list-title">{c.name}</div>
                        <div className="list-sub">{c.lastMessage || 'Нет сообщений'}</div>
                      </div>
                      <div className="list-meta">
                        {c.time && <div className="list-time">{c.time}</div>}
                        {c.unread > 0 && <div className="badge-count">{c.unread}</div>}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {BottomNav}
            </div>
            <div className="shell-main">{chatMain}</div>
          </div>
        </div>
      )
    }

    return <div className="app-root">{chatMain}</div>
  }

  // ---- UK DASHBOARD ----
  if (screen === 'uk-dashboard' && user?.role === 'uk') {
    const nNew = tickets.filter(t => t.status === 'new').length
    const nProg = tickets.filter(t => t.status === 'in_progress').length
    const nDone = tickets.filter(t => t.status === 'done').length
    return (
      <div className="app-root">
        <div className="shell">
          {Toast}
          <div className="header">
            <div className="header-title">Панель УК</div>
            <button className="btn btn-ghost" onClick={handleLogout}>
              {I.logout}
            </button>
          </div>
          <div className="content no-nav">
            <div className="stats">
              <div className="stat">
                <div className="stat-num">{nNew}</div>
                <div className="stat-lbl">Новые</div>
              </div>
              <div className="stat">
                <div className="stat-num">{nProg}</div>
                <div className="stat-lbl">В работе</div>
              </div>
              <div className="stat">
                <div className="stat-num">{nDone}</div>
                <div className="stat-lbl">Выполнено</div>
              </div>
            </div>
            <div className="section-label">Заявки</div>
            {tickets.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">{I.empty}</div>
                <div className="empty-title">Нет заявок</div>
                <div className="empty-sub">Заявки от жителей появятся здесь</div>
              </div>
            ) : (
              tickets.map(t => (
                <div key={t.id} className="ticket">
                  <div className="ticket-top">
                    <div>
                      <div className="ticket-id">
                        {t.id} · {t.createdAt}
                      </div>
                      <div className="ticket-title">{t.title}</div>
                    </div>
                    {statusBadge(t.status)}
                  </div>
                  {t.description && <div className="ticket-desc">{t.description}</div>}
                  <div className="ticket-meta">
                    {t.address} · {t.author}
                  </div>
                  {t.status !== 'done' && (
                    <div className="ticket-actions">
                      {t.status === 'new' && (
                        <button className="btn btn-primary btn-sm" onClick={() => updateTicket(t.id, 'in_progress')}>
                          Принять в работу
                        </button>
                      )}
                      {t.status === 'in_progress' && (
                        <button className="btn btn-primary btn-sm" onClick={() => updateTicket(t.id, 'done')}>
                          {I.check} Выполнено
                        </button>
                      )}
                      <button className="btn btn-secondary btn-sm" onClick={() => openChat('c-uk')}>
                        Чат
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            <div className="section-label">Чаты</div>
            {chats.length === 0 ? (
              <div className="empty">
                <div className="empty-sub">Нет чатов</div>
              </div>
            ) : (
              chats.map(c => (
                <div key={c.id} className="list-item" onClick={() => openChat(c.id)}>
                  <div className={`avatar ${c.type === 'uk' ? 'green' : c.type === 'topic' ? 'orange' : ''}`}>
                    {c.type === 'uk' ? 'UK' : c.type === 'topic' ? 'T' : 'O'}
                  </div>
                  <div className="list-body">
                    <div className="list-title">{c.name}</div>
                    <div className="list-sub">{c.lastMessage || 'Нет сообщений'}</div>
                  </div>
                  <div className="list-meta">
                    {c.time && <div className="list-time">{c.time}</div>}
                    {c.unread > 0 && <div className="badge-count">{c.unread}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  // ---- HOME ----
  if (screen === 'home') {
    const filtered = filter === 'Все' ? topics : topics.filter(t => t.category === filter)
    return (
      <div className="app-root">
        <div className="shell">
          {Toast}
          <div className="header">
            <div className="header-title">{selectedHouse?.address || 'Мой дом'}</div>
          </div>
          <div className="content">
            <div className="filters">
              {FILTERS.map(f => (
                <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                  {f}
                </button>
              ))}
            </div>
            <div className="section-label">События дома</div>
            {filtered.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">{I.empty}</div>
                <div className="empty-title">Пока нет событий</div>
                <div className="empty-sub">Создайте тему, чтобы сообщить о проблеме</div>
              </div>
            ) : (
              filtered.map(t => (
                <div
                  key={t.id}
                  className="card"
                  onClick={() => {
                    const cid = chats.find(c => c.name === t.title)?.id || `c-${t.id}`
                    if (!messages[cid]) {
                      setMessages(prev => ({ ...prev, [cid]: [] }))
                      setChats(prev => [
                        ...prev,
                        { id: cid, name: t.title, type: 'topic', lastMessage: '', time: t.time, unread: 0 },
                      ])
                    }
                    openChat(cid)
                  }}
                >
                  <div className="card-top">
                    <span className="tag">{t.category}</span>
                    {t.status && <span className="badge badge-progress">{t.status}</span>}
                  </div>
                  <div className="card-title">{t.title}</div>
                  {t.description && <div className="card-desc">{t.description}</div>}
                  {t.photoLabel && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
                      Фото: {t.photoLabel} | URL: {t.photoUrl || 'https://example.com/photo.jpg'}
                    </div>
                  )}
                  <div className="card-footer">
                    <span>{t.author}</span>
                    <span>{t.comments} коммент.</span>
                    <span>{t.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <button className="fab" onClick={() => setShowCreate(true)}>
            {I.plus}
          </button>
          {BottomNav}
          {createModal}
        </div>
      </div>
    )
  }

  // ---- CHATS ----
  if (screen === 'chats') {
    return (
      <div className="app-root">
        <div className="shell">
          {Toast}
          <div className="header">
            <div className="header-title">Чаты</div>
          </div>
          <div className="content">
            {chats.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">{I.empty}</div>
                <div className="empty-title">Нет чатов</div>
                <div className="empty-sub">Чаты появятся после выбора дома</div>
              </div>
            ) : (
              chats.map(c => (
                <div key={c.id} className="list-item" onClick={() => openChat(c.id)}>
                  <div className={`avatar ${c.type === 'uk' ? 'green' : c.type === 'topic' ? 'orange' : ''}`}>
                    {c.type === 'uk' ? 'UK' : c.type === 'topic' ? 'T' : 'O'}
                  </div>
                  <div className="list-body">
                    <div className="list-title">{c.name}</div>
                    <div className="list-sub">{c.lastMessage || 'Нет сообщений'}</div>
                  </div>
                  <div className="list-meta">
                    {c.time && <div className="list-time">{c.time}</div>}
                    {c.unread > 0 && <div className="badge-count">{c.unread}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
          {BottomNav}
        </div>
      </div>
    )
  }

  // ---- TOPICS ----
  if (screen === 'topics') {
    return (
      <div className="app-root">
        <div className="shell">
          {Toast}
          <div className="header">
            <div className="header-title">Обсуждения</div>
          </div>
          <div className="content">
            <div className="section-label">Все темы</div>
            {topics.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">{I.empty}</div>
                <div className="empty-title">Нет тем</div>
                <div className="empty-sub">Создайте первую тему о проблеме в доме</div>
              </div>
            ) : (
              topics.map(t => (
                <div
                  key={t.id}
                  className="card"
                  onClick={() => {
                    const cid = chats.find(c => c.name === t.title)?.id
                    if (cid) openChat(cid)
                  }}
                >
                  <div className="card-top">
                    <span className="tag">{t.category}</span>
                  </div>
                  <div className="card-title">{t.title}</div>
                  {t.description && <div className="card-desc">{t.description}</div>}
                  <div className="card-footer">
                    <span>{t.author}</span>
                    <span>{t.comments} коммент.</span>
                    <span>{t.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <button className="fab" onClick={() => setShowCreate(true)}>
            {I.plus}
          </button>
          {BottomNav}
          {createModal}
        </div>
      </div>
    )
  }

  // ---- PROFILE ----
  if (screen === 'profile') {
    return (
      <div className="app-root">
        <div className="shell">
          {Toast}
          <div className="content">
            <div className="profile-top">
              <div className="profile-avatar">{(user?.name || 'U').charAt(0)}</div>
              <div className="profile-name">{user?.name}</div>
              <div className="profile-role">
                {user?.role === 'uk'
                  ? user.ukName || 'Управляющая компания'
                  : `Житель · кв. ${user?.apartment || '—'}`}
              </div>
            </div>
            <div className="profile-body">
              <div className="info-card">
                <div className="info-label">Дом</div>
                <div className="info-value">{selectedHouse?.address || 'Не выбран'}</div>
                {selectedHouse && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{selectedHouse.uk}</div>
                )}
              </div>
              {(user?.street || user?.entrance || user?.flat) && (
                <div className="info-card">
                  <div className="info-label">Ваш адрес (только вы видите)</div>
                  <div className="info-value">
                    {[
                      user?.street,
                      user?.entrance && `подъезд ${user.entrance}`,
                      user?.flat && `кв. ${user.flat}`,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                </div>
              )}
              <div className="menu-item" onClick={() => setScreen('my-tickets')}>
                <div className="menu-icon">{I.alert}</div>
                <div>
                  <div className="menu-text">Мои обращения</div>
                  <div className="menu-sub">История заявок</div>
                </div>
              </div>
              <div
                className="menu-item"
                onClick={() => {
                  setPrivStreet(user?.street || '')
                  setPrivEntrance(user?.entrance || '')
                  setPrivFlat(user?.flat || '')
                  setScreen('private-address')
                }}
              >
                <div className="menu-icon">{I.building}</div>
                <div>
                  <div className="menu-text">Мой адрес</div>
                  <div className="menu-sub">Улица, подъезд, квартира (только вы)</div>
                </div>
              </div>
              <div className="menu-item" onClick={() => setScreen('select-house')}>
                <div className="menu-icon">{I.building}</div>
                <div>
                  <div className="menu-text">Сменить дом</div>
                  <div className="menu-sub">Привязать другой адрес</div>
                </div>
              </div>
              <div className="menu-item" onClick={handleLogout}>
                <div className="menu-icon red">{I.logout}</div>
                <div>
                  <div className="menu-text">Выйти</div>
                </div>
              </div>
            </div>
          </div>
          {BottomNav}
        </div>
      </div>
    )
  }

  // ---- MY TICKETS ----
  if (screen === 'my-tickets') {
    return (
      <div className="app-root">
        <div className="shell">
          {Toast}
          <div className="header">
            <button className="header-back" onClick={() => setScreen('profile')}>
              {I.back}
            </button>
            <div className="header-title">Мои обращения</div>
          </div>
          <div className="content">
            {tickets.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">{I.empty}</div>
                <div className="empty-title">Нет обращений</div>
                <div className="empty-sub">Создайте тему в категории Авария</div>
              </div>
            ) : (
              tickets.map(t => (
                <div key={t.id} className="ticket">
                  <div className="ticket-top">
                    <div>
                      <div className="ticket-id">{t.id}</div>
                      <div className="ticket-title">{t.title}</div>
                    </div>
                    {statusBadge(t.status)}
                  </div>
                  {t.description && <div className="ticket-desc">{t.description}</div>}
                </div>
              ))
            )}
          </div>
          {BottomNav}
        </div>
      </div>
    )
  }

  return (
    <div className="app-root">
      <div className="shell">
        <div className="empty">Загрузка...</div>
      </div>
    </div>
  )
}
