import { Building2, Car, Inbox, MessageSquarePlus, Plus, ClipboardList, X } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useUser } from '../store'
import type { TopicCategory } from '../types'
import { TOPIC_CATEGORIES, TICKET_CATEGORIES } from '../types'
import { categoryLabel, EmptyState, Field, houseTitle, PrimaryButton, TextArea, TextInput } from '../ui'

function CreateTicketModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createTicket = useAppStore((s) => s.createTicket)
  const [category, setCategory] = useState<TopicCategory>('accident')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  if (!open) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = await createTicket({ category, title, description })
    if (!result.ok) {
      setError(result.error ?? 'Не удалось создать заявку')
      return
    }
    setTitle('')
    setDescription('')
    onClose()
  }

  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, flex: 1 }}>Новая заявка в УК</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <Field label="Категория">
            <select value={category} onChange={(e) => setCategory(e.target.value as TopicCategory)}>
              {TICKET_CATEGORIES.map((id) => (
                <option key={id} value={id}>
                  {categoryLabel(id)}
                </option>
              ))}
              <option value="parking">Парковка</option>
              <option value="other">Другое</option>
            </select>
          </Field>
          <Field label="Заголовок">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field label="Описание">
            <TextArea value={description} onChange={(e) => setDescription(e.target.value)} required />
          </Field>
          {error ? <div className="error">{error}</div> : null}
          <PrimaryButton type="submit">Отправить заявку</PrimaryButton>
        </form>
      </div>
    </div>
  )
}

export function FeedScreen() {
  const user = useUser()
  const topics = useAppStore((s) => s.topics)
  const houses = useAppStore((s) => s.houses)
  const [filter, setFilter] = useState<'all' | TopicCategory>('all')
  const [fabOpen, setFabOpen] = useState(false)
  const [ticketOpen, setTicketOpen] = useState(false)
  const navigate = useNavigate()
  const house = houses.find((h) => h.id === user?.houseId)
  const mine = topics.filter((t) => t.houseId === user?.houseId)
  const list = useMemo(
    () => (filter === 'all' ? mine : mine.filter((t) => t.category === filter)),
    [filter, mine],
  )

  return (
    <>
      <div className="pad" style={{ paddingBottom: 8 }}>
        <div className="home-quick">
          <button type="button" className="house-teaser" onClick={() => navigate('/app/house')}>
            <Building2 size={28} />
            <span>
              <strong>План дома</strong>
              <span>Подъезды и этажи</span>
            </span>
          </button>
          <button type="button" className="house-teaser parking-teaser" onClick={() => navigate('/app/parking')}>
            <Car size={28} />
            <span>
              <strong>Парковка</strong>
              <span>Свободные места</span>
            </span>
          </button>
        </div>
        <div className="chips">
          <button
            type="button"
            className={filter === 'all' ? 'chip active' : 'chip'}
            onClick={() => setFilter('all')}
          >
            Все
          </button>
          {TOPIC_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={filter === c.id ? 'chip active' : 'chip'}
              onClick={() => setFilter(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="pad" style={{ paddingTop: 0 }}>
        {house ? (
          <p className="muted" style={{ marginTop: 0 }}>
            {houseTitle(house.city, house.address)}
          </p>
        ) : null}
        {list.length === 0 ? (
          <EmptyState
            icon={<Inbox size={40} />}
            title="Лента пуста"
            text="Создайте чат дома или заявку в УК кнопкой +"
          />
        ) : (
          list.map((topic) => (
            <button
              key={topic.id}
              type="button"
              className="card"
              style={{ width: '100%', textAlign: 'left', border: 0 }}
              onClick={() => navigate(`/app/chats/${topic.chatId}`)}
            >
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                {categoryLabel(topic.category)} · {topic.time}
              </div>
              <h3>{topic.title}</h3>
              <p className="muted" style={{ margin: 0 }}>
                {topic.description}
              </p>
            </button>
          ))
        )}
      </div>

      {user?.role === 'resident' ? (
        <div className="fab-wrap">
          {fabOpen ? (
            <div className="fab-sheet">
              <button
                type="button"
                className="fab-sheet-item"
                onClick={() => {
                  setFabOpen(false)
                  setTicketOpen(true)
                }}
              >
                <ClipboardList size={18} /> Создать заявку
              </button>
              <button
                type="button"
                className="fab-sheet-item"
                onClick={() => {
                  setFabOpen(false)
                  navigate('/app/topics?new=1')
                }}
              >
                <MessageSquarePlus size={18} /> Создать чат
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="fab"
            aria-label="Создать"
            onClick={() => setFabOpen((v) => !v)}
          >
            {fabOpen ? <X size={22} /> : <Plus size={22} />}
          </button>
        </div>
      ) : null}

      <CreateTicketModal open={ticketOpen} onClose={() => setTicketOpen(false)} />
    </>
  )
}
