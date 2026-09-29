import { ChevronLeft, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useUser } from '../store'
import { categoryLabel, EmptyState, houseTitle, statusClass, statusLabel } from '../ui'

export function UkPanelScreen() {
  const user = useUser()
  const tickets = useAppStore((s) => s.tickets)
  const chatsAll = useAppStore((s) => s.chats)
  const messagesAll = useAppStore((s) => s.messages)
  const houses = useAppStore((s) => s.houses)
  const setTicketStatus = useAppStore((s) => s.setTicketStatus)
  const chats = chatsAll.filter((c) => c.houseId === user?.houseId && c.type === 'uk')
  const hidden = messagesAll.filter(
    (m) => m.hidden && chatsAll.some((c) => c.houseId === user?.houseId && c.id === m.chatId),
  )
  const navigate = useNavigate()
  const house = houses.find((h) => h.id === user?.houseId)

  const nNew = tickets.filter((t) => t.status === 'new').length
  const nWork = tickets.filter((t) => t.status === 'in_progress').length
  const nDone = tickets.filter((t) => t.status === 'done').length
  const ukChat = chats[0]

  return (
    <div className="pad">
      <button type="button" className="back-btn" onClick={() => navigate('/app/house')}>
        <ChevronLeft size={18} /> К дому
      </button>
      <p className="muted">
        {house ? houseTitle(house.city, house.address) : 'Дом не выбран'} · {user?.ukName}
      </p>
      <div className="stats">
        <div className="stat">
          <b>{nNew}</b>
          <span className="muted">Новые</span>
        </div>
        <div className="stat">
          <b>{nWork}</b>
          <span className="muted">В работе</span>
        </div>
        <div className="stat">
          <b>{nDone}</b>
          <span className="muted">Выполнено</span>
        </div>
      </div>
      <h3>Заявки</h3>
      {tickets.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert size={36} />}
          title="Заявок нет"
          text="Жители создают заявки через темы «Авария» и «Качество услуг». Адрес в заявке — только дом."
        />
      ) : (
        tickets.map((t) => (
          <div key={t.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong>№{t.id}</strong>
              <span className={statusClass(t.status)}>{statusLabel(t.status)}</span>
            </div>
            <h3>{t.title}</h3>
            <p className="muted">{t.description}</p>
            <div className="hint">{t.address}</div>
            <div className="hint">
              {categoryLabel(t.category)} · {t.author} · {t.createdAt}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {t.status === 'new' ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setTicketStatus(t.id, 'in_progress')}
                >
                  Принять в работу
                </button>
              ) : null}
              {t.status === 'in_progress' ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setTicketStatus(t.id, 'done')}
                >
                  Выполнено
                </button>
              ) : null}
              {ukChat ? (
                <button type="button" className="btn btn-ghost" onClick={() => navigate(`/app/chats/${ukChat.id}`)}>
                  В чат
                </button>
              ) : null}
            </div>
          </div>
        ))
      )}
      <h3>Модерация</h3>
      {hidden.length === 0 ? (
        <p className="muted">Скрытых сообщений нет</p>
      ) : (
        hidden.map((m) => (
          <div key={m.id} className="card">
            <div className="muted">{m.time}</div>
            <div>{m.text}</div>
          </div>
        ))
      )}
    </div>
  )
}
