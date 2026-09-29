import { ChevronLeft, ClipboardList, MessageSquare, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientApi } from '../api'
import { useAppStore, useUser } from '../store'
import type { Ticket, TicketStatus } from '../types'
import { categoryLabel, EmptyState, statusClass, statusLabel } from '../ui'

type Filter = 'all' | TicketStatus

function TicketCard({ t, showAuthor }: { t: Ticket; showAuthor?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      type="button"
      className={`ticket-card status-${t.status}${open ? ' open' : ''}`}
      onClick={() => setOpen((v) => !v)}
    >
      <div className="ticket-card-top">
        <div>
          <div className="ticket-card-meta">
            <span className="ticket-num">№{t.publicNumber || t.id}</span>
            <span className="ticket-cat">{categoryLabel(t.category)}</span>
          </div>
          <h3>{t.title}</h3>
        </div>
        <span className={statusClass(t.status)}>{statusLabel(t.status)}</span>
      </div>
      <p className="ticket-desc">{t.description}</p>
      <div className="ticket-card-foot">
        <span>{t.address || 'Адрес не указан'}</span>
        <span>{t.createdAt}</span>
      </div>
      {showAuthor ? <div className="hint">От: {t.author}</div> : null}
      {t.ukComment ? (
        <div className="ticket-reply">
          <MessageSquare size={14} />
          <div>
            <strong>Ответ УК</strong>
            <div>{t.ukComment}</div>
          </div>
        </div>
      ) : null}
      {open && t.messages?.length ? (
        <div className="ticket-thread">
          {t.messages.map((m) => (
            <div key={m.id} className={`ticket-msg role-${m.role}`}>
              <div className="ticket-msg-who">{m.role === 'uk' ? 'УК' : 'Вы'}</div>
              <div>{m.body}</div>
              <div className="time">{m.createdAt}</div>
            </div>
          ))}
        </div>
      ) : null}
    </button>
  )
}

export function MyTicketsScreen() {
  const user = useUser()
  const ticketsAll = useAppStore((s) => s.tickets)
  const applyBootstrap = useAppStore((s) => s.applyBootstrap)
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const tickets = useMemo(() => {
    const mine =
      user?.role === 'uk' || user?.role === 'admin'
        ? ticketsAll
        : ticketsAll.filter((t) => String(t.authorId) === String(user?.id))
    if (filter === 'all') return mine
    return mine.filter((t) => t.status === filter)
  }, [ticketsAll, user, filter])

  const counts = useMemo(() => {
    const mine =
      user?.role === 'uk' || user?.role === 'admin'
        ? ticketsAll
        : ticketsAll.filter((t) => String(t.authorId) === String(user?.id))
    return {
      all: mine.length,
      new: mine.filter((t) => t.status === 'new').length,
      in_progress: mine.filter((t) => t.status === 'in_progress').length,
      done: mine.filter((t) => t.status === 'done').length,
      rejected: mine.filter((t) => t.status === 'rejected').length,
    }
  }, [ticketsAll, user])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const data = await clientApi.me()
        if (!cancelled) applyBootstrap(data)
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applyBootstrap])

  const isResident = user?.role === 'resident'

  return (
    <div className="tickets-page">
      <div className="tickets-hero">
        <button
          type="button"
          className="back-btn back-btn-light"
          onClick={() => navigate(isResident ? '/app' : '/app/profile')}
        >
          <ChevronLeft size={18} /> Назад
        </button>
        <div className="tickets-hero-icon">
          <ClipboardList size={28} />
        </div>
        <h1>{isResident ? 'Мои обращения' : 'Заявки'}</h1>
        <p>
          {isResident
            ? 'Заявки в УК из бота и мини-приложения. Статусы и ответы обновляются сразу.'
            : 'Все заявки жителей вашей УК.'}
        </p>
        <div className="tickets-stats">
          <div>
            <b>{counts.new}</b>
            <span>Новые</span>
          </div>
          <div>
            <b>{counts.in_progress}</b>
            <span>В работе</span>
          </div>
          <div>
            <b>{counts.done}</b>
            <span>Готово</span>
          </div>
          <div>
            <b>{counts.rejected}</b>
            <span>Отклонено</span>
          </div>
        </div>
      </div>

      <div className="pad tickets-body">
        <div className="chips tickets-filters">
          {(
            [
              ['all', 'Все', counts.all],
              ['new', 'Новые', counts.new],
              ['in_progress', 'В работе', counts.in_progress],
              ['done', 'Готово', counts.done],
              ['rejected', 'Отклонено', counts.rejected],
            ] as const
          ).map(([id, label, n]) => (
            <button
              key={id}
              type="button"
              className={filter === id ? 'chip active' : 'chip'}
              onClick={() => setFilter(id)}
            >
              {label}
              {n ? <span className="chip-count">{n}</span> : null}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="muted">Загрузка обращений…</p>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={40} />}
            title={filter === 'all' ? 'Обращений пока нет' : 'Нет заявок в этом статусе'}
            text={
              isResident
                ? 'Создайте заявку кнопкой «+» на ленте или темой «Авария» / «Качество услуг».'
                : 'Когда житель отправит заявку — она появится здесь.'
            }
          />
        ) : (
          tickets.map((t) => (
            <TicketCard key={t.id} t={t} showAuthor={!isResident} />
          ))
        )}

        {isResident ? (
          <button
            type="button"
            className="btn btn-primary tickets-create"
            onClick={() => navigate('/app')}
          >
            <Plus size={18} /> Создать заявку на ленте
          </button>
        ) : null}
      </div>
    </div>
  )
}
