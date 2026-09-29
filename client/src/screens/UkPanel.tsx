import { type FormEvent, useState } from 'react'
import { ChevronLeft, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useUser } from '../store'
import { categoryLabel, EmptyState, Field, houseTitle, PrimaryButton, statusClass, statusLabel, TextArea } from '../ui'

export function UkPanelScreen() {
  const user = useUser()
  const tickets = useAppStore((s) => s.tickets)
  const houses = useAppStore((s) => s.houses)
  const setTicketStatus = useAppStore((s) => s.setTicketStatus)
  const commentTicket = useAppStore((s) => s.commentTicket)
  const [openId, setOpenId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const house = houses.find((h) => h.id === user?.houseId)

  const nNew = tickets.filter((t) => t.status === 'new').length
  const nWork = tickets.filter((t) => t.status === 'in_progress').length
  const nDone = tickets.filter((t) => t.status === 'done').length

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
      <h3>Заявки (бот + мини-приложение)</h3>
      {tickets.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert size={36} />}
          title="Заявок нет"
          text="Заявки жителей из бота и мини-приложения появятся здесь."
        />
      ) : (
        tickets.map((t) => (
          <div key={t.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong>№{t.publicNumber || t.id}</strong>
              <span className={statusClass(t.status)}>{statusLabel(t.status)}</span>
            </div>
            <h3>{t.title}</h3>
            <p className="muted">{t.description}</p>
            <div className="hint">{t.address}</div>
            <div className="hint">
              {categoryLabel(t.category)} · {t.author} · {t.createdAt}
            </div>
            {t.ukComment ? <div className="hint">Комментарий УК: {t.ukComment}</div> : null}
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
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setOpenId(openId === t.id ? null : t.id)
                  setComment('')
                }}
              >
                Комментарий
              </button>
            </div>
            {openId === t.id ? (
              <form
                style={{ marginTop: 10 }}
                onSubmit={async (e: FormEvent) => {
                  e.preventDefault()
                  setBusy(true)
                  const err = await commentTicket(t.id, comment)
                  setBusy(false)
                  if (!err) {
                    setComment('')
                    setOpenId(null)
                  }
                }}
              >
                <Field label="Сообщение жителю">
                  <TextArea value={comment} onChange={(e) => setComment(e.target.value)} required />
                </Field>
                <PrimaryButton type="submit" disabled={busy || !comment.trim()}>
                  {busy ? 'Отправка…' : 'Отправить'}
                </PrimaryButton>
              </form>
            ) : null}
          </div>
        ))
      )}
    </div>
  )
}
