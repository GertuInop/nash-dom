import { ChevronLeft, ChevronRight, Home, LogOut, MapPin, Ticket } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientApi } from '../api'
import { useAppStore, useUser } from '../store'
import { houseTitle, statusClass, statusLabel } from '../ui'

export function ProfileScreen() {
  const user = useUser()
  const logout = useAppStore((s) => s.logout)
  const ticketsAll = useAppStore((s) => s.tickets)
  const houses = useAppStore((s) => s.houses)
  const tickets = ticketsAll.filter((t) => t.authorId === user?.id)
  const house = houses.find((h) => h.id === user?.houseId)
  const navigate = useNavigate()
  if (!user) return null

  const letter = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

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
        <div style={{ opacity: 0.9, fontSize: 13, marginTop: 6 }}>{user.phone}</div>
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
                {user.street ? <div>Улица: {user.street}</div> : null}
                {user.entrance ? <div>Подъезд: {user.entrance}</div> : null}
                {user.flat ? <div>Квартира: {user.flat}</div> : null}
              </div>
            ) : (
              <div className="muted">Не указан</div>
            )}
          </div>
        ) : null}
      </div>
      {user.role === 'resident' ? (
        <>
          <button type="button" className="menu-item" onClick={() => navigate('/app/tickets')}>
            <Ticket size={18} />
            <span className="grow">Мои обращения</span>
            <span className="muted">{tickets.length}</span>
            <ChevronRight size={16} />
          </button>
          <button type="button" className="menu-item" onClick={() => navigate('/address')}>
            <MapPin size={18} />
            <span className="grow">Мой адрес</span>
            <ChevronRight size={16} />
          </button>
        </>
      ) : null}
      <button type="button" className="menu-item" onClick={() => navigate('/select-uk')}>
        <Home size={18} />
        <span className="grow">Сменить УК</span>
        <ChevronRight size={16} />
      </button>
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

export function MyTicketsScreen() {
  const user = useUser()
  const ticketsAll = useAppStore((s) => s.tickets)
  const applyBootstrap = useAppStore((s) => s.applyBootstrap)
  const tickets = ticketsAll.filter((t) => String(t.authorId) === String(user?.id))
  const navigate = useNavigate()

  useEffect(() => {
    void clientApi.me().then((data) => applyBootstrap(data)).catch(() => {})
  }, [applyBootstrap])

  return (
    <div className="pad">
      <button type="button" className="back-btn" onClick={() => navigate('/app/profile')}>
        <ChevronLeft size={18} /> Назад
      </button>
      {tickets.length === 0 ? (
        <p className="muted">Обращений нет. Тема «Авария» или «Качество услуг» создаёт заявку УК.</p>
      ) : (
        tickets.map((t) => (
          <div key={t.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>№{t.publicNumber || t.id}</strong>
              <span className={statusClass(t.status)}>{statusLabel(t.status)}</span>
            </div>
            <h3>{t.title}</h3>
            <p className="muted">{t.description}</p>
            <div className="hint">{t.address}</div>
            {t.ukComment ? <div className="hint">Ответ УК: {t.ukComment}</div> : null}
          </div>
        ))
      )}
    </div>
  )
}
