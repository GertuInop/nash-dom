import { type FormEvent, useEffect, useState } from 'react'
import { ChevronLeft, ExternalLink, ShieldAlert, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { clientApi } from '../api'
import { openMaxProfile } from '../max-utils'
import { useAppStore, useUser } from '../store'
import type { TicketStatus } from '../types'
import { categoryLabel, EmptyState, Field, houseTitle, PrimaryButton, statusClass, statusLabel, TextArea } from '../ui'

export function UkPanelScreen() {
  const user = useUser()
  const tickets = useAppStore((s) => s.tickets)
  const residents = useAppStore((s) => s.residents)
  const houses = useAppStore((s) => s.houses)
  const applyBootstrap = useAppStore((s) => s.applyBootstrap)
  const setTicketStatus = useAppStore((s) => s.setTicketStatus)
  const commentTicket = useAppStore((s) => s.commentTicket)
  const setToast = useAppStore((s) => s.setToast)
  const [openId, setOpenId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const house = houses.find((h) => h.id === user?.houseId)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const data = await clientApi.me()
        if (!cancelled) applyBootstrap(data)
      } catch (e) {
        if (!cancelled) {
          setToast({ type: 'error', text: e instanceof Error ? e.message : 'Не удалось загрузить заявки' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applyBootstrap, setToast])

  async function changeStatus(id: string, status: TicketStatus) {
    setBusy(true)
    try {
      await setTicketStatus(id, status)
      setToast({
        type: 'success',
        text:
          status === 'rejected'
            ? 'Заявка отклонена'
            : status === 'done'
              ? 'Заявка выполнена'
              : 'Статус обновлён',
      })
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Не удалось сменить статус' })
    } finally {
      setBusy(false)
    }
  }

  const nNew = tickets.filter((t) => t.status === 'new').length
  const nWork = tickets.filter((t) => t.status === 'in_progress').length
  const nDone = tickets.filter((t) => t.status === 'done').length
  const residentOnly = residents.filter((r) => r.role === 'resident')

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
        <div className="stat">
          <b>{residentOnly.length}</b>
          <span className="muted">Жильцы</span>
        </div>
      </div>

      <h3>Жильцы ({residentOnly.length})</h3>
      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : residentOnly.length === 0 ? (
        <EmptyState
          icon={<Users size={36} />}
          title="Пока никого нет"
          text="Когда житель выберет вашу УК в боте или мини-приложении — он появится здесь сразу (без заявки на одобрение)."
        />
      ) : (
        residentOnly.map((r) => (
          <div key={r.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong>{r.name}</strong>
              {r.maxUserId || r.username ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    openMaxProfile({
                      maxProfileUrl: r.maxProfileUrl,
                      username: r.username,
                      maxUserId: r.maxUserId,
                    })
                  }
                >
                  <ExternalLink size={14} /> MAX
                </button>
              ) : null}
            </div>
            <div className="muted">{r.phone || 'телефон не указан'}</div>
            {r.address ? <div className="hint">{r.address}</div> : null}
            {r.personalAccount ? <div className="hint">Л/с: {r.personalAccount}</div> : null}
          </div>
        ))
      )}

      <h3>Заявки (бот + мини-приложение)</h3>
      {loading ? (
        <p className="muted">Загрузка заявок…</p>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert size={36} />}
          title="Заявок нет"
          text={
            user?.companyId
              ? 'Пока нет заявок от жителей этой УК. Создайте заявку из бота или мини-приложения жителя.'
              : 'У вашего аккаунта не привязана УК (company_id). Откройте бота и завершите регистрацию УК, затем обновите мини-приложение.'
          }
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
            {t.authorMaxUserId || t.authorUsername ? (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: 6 }}
                onClick={() =>
                  openMaxProfile({
                    maxProfileUrl: t.authorMaxProfileUrl,
                    username: t.authorUsername,
                    maxUserId: t.authorMaxUserId,
                  })
                }
              >
                <ExternalLink size={14} /> Профиль жителя
              </button>
            ) : null}
            {t.ukComment ? <div className="hint">Комментарий УК: {t.ukComment}</div> : null}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {t.status === 'new' ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => void changeStatus(t.id, 'in_progress')}
                >
                  Принять в работу
                </button>
              ) : null}
              {t.status === 'in_progress' || t.status === 'new' ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => void changeStatus(t.id, 'done')}
                >
                  Выполнено
                </button>
              ) : null}
              {t.status !== 'rejected' && t.status !== 'done' ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm('Отклонить заявку?')) return
                    void changeStatus(t.id, 'rejected')
                  }}
                >
                  Отклонить
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
