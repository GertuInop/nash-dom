import { type FormEvent, useState } from 'react'
import { ChevronLeft, ChevronRight, Home, LogOut, Settings, Ticket } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useUser } from '../store'
import { DigitInput, Field, houseTitle, isCompletePhone, PhoneInput, PrimaryButton, TextInput } from '../ui'

export function ProfileScreen() {
  const user = useUser()
  const logout = useAppStore((s) => s.logout)
  const updateProfile = useAppStore((s) => s.updateProfile)
  const setToast = useAppStore((s) => s.setToast)
  const ticketsAll = useAppStore((s) => s.tickets)
  const houses = useAppStore((s) => s.houses)
  const tickets = ticketsAll.filter((t) => String(t.authorId) === String(user?.id))
  const house = houses.find((h) => h.id === user?.houseId)
  const navigate = useNavigate()

  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [city, setCity] = useState(user?.city ?? '')
  const [street, setStreet] = useState(user?.street ?? '')
  const [entrance, setEntrance] = useState(user?.entrance ?? '')
  const [flat, setFlat] = useState(user?.flat ?? '')

  if (!user) return null

  const letter = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault()
    if (!isCompletePhone(phone)) {
      setToast({ type: 'error', text: 'Укажите полный номер телефона' })
      return
    }
    setBusy(true)
    try {
      const payload: {
        phone: string
        city: string
        street?: string
        entrance?: string
        flat?: string
      } = { phone, city: city.trim() }
      if (user?.role === 'resident') {
        payload.street = street.trim()
        payload.entrance = entrance.trim()
        payload.flat = flat.trim()
      }
      await updateProfile(payload)
      setToast({ type: 'success', text: 'Данные сохранены' })
      setEditOpen(false)
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Не удалось сохранить' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="profile-hero">
        <button type="button" className="back-btn back-btn-light" onClick={() => navigate('/app')}>
          <ChevronLeft size={18} /> Назад
        </button>
        <div className="avatar" style={{ width: 64, height: 64, fontSize: 22, marginBottom: 12 }}>
          {letter || 'Н'}
        </div>
        <h2 style={{ margin: 0 }}>{user.name}</h2>
        <div style={{ opacity: 0.9, fontSize: 14 }}>
          {user.role === 'admin'
            ? 'Администратор'
            : user.role === 'uk'
              ? user.ukName ?? 'Управляющая компания'
              : 'Житель'}
        </div>
        <div style={{ opacity: 0.9, fontSize: 13, marginTop: 6 }}>{user.phone || 'Телефон не указан'}</div>
      </div>
      <div className="pad" style={{ marginTop: -18 }}>
        <div className="card">
          <div className="muted">Дом</div>
          <strong>{house ? houseTitle(house.city, house.address) : 'Не выбран'}</strong>
          {house ? <div className="muted">{house.uk}</div> : null}
        </div>
        {user.role === 'resident' ? (
          <div className="card">
            <div className="muted">Мой адрес (только вы)</div>
            {user.street || user.entrance || user.flat ? (
              <div>
                {user.city ? <div>Город: {user.city}</div> : null}
                {user.street ? <div>Улица: {user.street}</div> : null}
                {user.entrance ? <div>Подъезд: {user.entrance}</div> : null}
                {user.flat ? <div>Квартира: {user.flat}</div> : null}
              </div>
            ) : (
              <div className="muted">Не указан</div>
            )}
          </div>
        ) : (
          <div className="card">
            <div className="muted">Город</div>
            <strong>{user.city || 'Не указан'}</strong>
          </div>
        )}
      </div>

      <button
        type="button"
        className="menu-item"
        onClick={() => {
          setPhone(user.phone ?? '')
          setCity(user.city ?? '')
          setStreet(user.street ?? '')
          setEntrance(user.entrance ?? '')
          setFlat(user.flat ?? '')
          setEditOpen((v) => !v)
        }}
      >
        <Settings size={18} />
        <span className="grow">Мои данные</span>
        <ChevronRight size={16} style={{ transform: editOpen ? 'rotate(90deg)' : undefined }} />
      </button>

      {editOpen ? (
        <div className="pad profile-edit">
          <form onSubmit={onSaveProfile}>
            <Field label="Телефон">
              <PhoneInput value={phone} onChange={setPhone} />
            </Field>
            <Field label="Город">
              <TextInput value={city} onChange={(e) => setCity(e.target.value)} required />
            </Field>
            {user.role === 'resident' ? (
              <>
                <Field label="Улица / дом">
                  <TextInput value={street} onChange={(e) => setStreet(e.target.value)} required />
                </Field>
                <Field label="Подъезд">
                  <DigitInput value={entrance} onChange={setEntrance} maxLength={4} required />
                </Field>
                <Field label="Квартира">
                  <DigitInput value={flat} onChange={setFlat} maxLength={4} required />
                </Field>
              </>
            ) : null}
            <PrimaryButton type="submit" disabled={busy}>
              {busy ? 'Сохранение…' : 'Сохранить'}
            </PrimaryButton>
          </form>
        </div>
      ) : null}

      {user.role === 'resident' || user.role === 'uk' ? (
        <button type="button" className="menu-item" onClick={() => navigate('/app/tickets')}>
          <Ticket size={18} />
          <span className="grow">{user.role === 'uk' ? 'Заявки УК' : 'Мои обращения'}</span>
          <span className="muted">{user.role === 'uk' ? ticketsAll.length : tickets.length}</span>
          <ChevronRight size={16} />
        </button>
      ) : null}
      {user.role === 'resident' ? (
        <button type="button" className="menu-item" onClick={() => navigate('/select-uk')}>
          <Home size={18} />
          <span className="grow">Сменить УК</span>
          <ChevronRight size={16} />
        </button>
      ) : null}
      <button
        type="button"
        className="menu-item"
        onClick={async () => {
          await logout()
          navigate('/')
        }}
      >
        <LogOut size={18} />
        <span className="grow">Сбросить сессию</span>
      </button>
    </div>
  )
}

export { MyTicketsScreen } from './Tickets'
