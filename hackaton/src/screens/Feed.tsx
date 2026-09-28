import { Building2, Inbox, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useUser } from '../store'
import type { TopicCategory } from '../types'
import { TOPIC_CATEGORIES } from '../types'
import { categoryLabel, EmptyState, houseTitle } from '../ui'

export function FeedScreen() {
  const user = useUser()
  const topics = useAppStore((s) => s.topics)
  const houses = useAppStore((s) => s.houses)
  const [filter, setFilter] = useState<'all' | TopicCategory>('all')
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
        <button type="button" className="house-teaser" onClick={() => navigate('/app/house')}>
          <Building2 size={28} />
          <span>
            <strong>План дома</strong>
            <span>Подъезды, этажи и статус работ</span>
          </span>
        </button>
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
            text="Пока нет событий. Создайте тему — она появится здесь и в чатах дома."
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
        <button
          type="button"
          className="fab"
          aria-label="Создать тему"
          onClick={() => navigate('/app/topics?new=1')}
        >
          <Plus size={22} />
        </button>
      ) : null}
    </>
  )
}
