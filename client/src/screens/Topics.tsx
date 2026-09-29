import { ChevronLeft, Hash, Plus, X } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppStore, useUser } from '../store'
import type { TopicCategory } from '../types'
import { TOPIC_CATEGORIES } from '../types'
import { categoryLabel, EmptyState, Field, PrimaryButton, TextArea, TextInput } from '../ui'

function CreateTopicModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const createTopic = useAppStore((s) => s.createTopic)
  const navigate = useNavigate()
  const [category, setCategory] = useState<TopicCategory>('other')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setCategory('other')
      setTitle('')
      setDescription('')
      setError('')
    }
  }, [open])

  if (!open) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const result = await createTopic({ category, title, description })
    if (!result.ok) {
      setError(result.error ?? 'Не удалось создать чат')
      return
    }
    onClose()
    if (result.chatId) navigate(`/app/chats/${result.chatId}`)
  }

  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="create-topic-title"
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h3 id="create-topic-title" style={{ margin: 0, flex: 1 }}>
            Новый чат дома
          </h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <Field label="Категория">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TopicCategory)}
            >
              {TOPIC_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Заголовок">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Описание">
            <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="photo-future">📷 Прикрепление фото — функционал в будущем</div>
          {error ? <div className="error">{error}</div> : null}
          <PrimaryButton type="submit">Создать чат</PrimaryButton>
        </form>
      </div>
    </div>
  )
}

export function TopicsScreen() {
  const user = useUser()
  const topicsAll = useAppStore((s) => s.topics)
  const topics = topicsAll.filter((t) => t.houseId === user?.houseId)
  const [params, setParams] = useSearchParams()
  const open = params.get('new') === '1'
  const navigate = useNavigate()

  return (
    <>
      <div className="pad">
        <button type="button" className="back-btn" onClick={() => navigate('/app')}>
          <ChevronLeft size={18} /> Назад
        </button>
        {topics.length === 0 ? (
          <EmptyState
            icon={<Hash size={40} />}
            title="Чатов-тем пока нет"
            text="Создайте обсуждение: авария, уборка, парковка и другие вопросы дома."
          />
        ) : (
          topics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              className="card"
              style={{ width: '100%', textAlign: 'left', border: 0 }}
              onClick={() => navigate(`/app/chats/${topic.chatId}`)}
            >
              <div className="muted" style={{ fontSize: 12 }}>
                {categoryLabel(topic.category)} · {topic.author}
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
          <button
            type="button"
            className="fab"
            aria-label="Создать чат"
            onClick={() => setParams({ new: '1' })}
          >
            <Plus size={22} />
          </button>
        </div>
      ) : null}
      <CreateTopicModal open={open} onClose={() => setParams({})} />
    </>
  )
}
