import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  ExternalLink,
  Shield,
  UserRound,
  Users,
} from 'lucide-react'
import { clientApi } from '../api'
import { useAppStore, useUser } from '../store'
import { EmptyState, Field, PrimaryButton, TextInput } from '../ui'

type AdminTab = 'requests' | 'companies' | 'users'

function openMaxProfile(url?: string | null) {
  if (!url) return
  try {
    if (window.WebApp && typeof (window.WebApp as { openLink?: (u: string) => void }).openLink === 'function') {
      ;(window.WebApp as { openLink: (u: string) => void }).openLink(url)
      return
    }
  } catch {
    /* fall through */
  }
  window.location.href = url
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'Новая',
    approved: 'Активна',
    rejected: 'Отклонена',
    blocked: 'Заблокирована',
  }
  return <span className={`status-pill status-${status}`}>{map[status] || status}</span>
}

export function AdminPanelScreen() {
  const user = useUser()
  const setToast = useAppStore((s) => s.setToast)
  const [tab, setTab] = useState<AdminTab>('requests')
  const [loading, setLoading] = useState(true)
  const [pendingUk, setPendingUk] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [q, setQ] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [moveUserId, setMoveUserId] = useState<string | null>(null)
  const [moveCompanyId, setMoveCompanyId] = useState('')

  async function reload() {
    setLoading(true)
    try {
      const data = await clientApi.adminOverview()
      setPendingUk(data.pendingUk || [])
      setCompanies(data.companies || [])
      setUsers(data.users || [])
      setStats(data.stats || {})
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Ошибка загрузки' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) || null,
    [companies, selectedCompanyId],
  )

  const filteredUsers = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return users
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(s)
        || u.phone?.toLowerCase().includes(s)
        || u.username?.toLowerCase().includes(s)
        || u.companyName?.toLowerCase().includes(s),
    )
  }, [q, users])

  async function run(id: string, fn: () => Promise<void>) {
    setBusyId(id)
    try {
      await fn()
      await reload()
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Ошибка' })
    } finally {
      setBusyId(null)
    }
  }

  if (user?.role !== 'admin') {
    return <EmptyState icon={<Shield size={36} />} title="Нет доступа" text="Раздел только для администратора" />
  }

  if (loading) {
    return <div className="pad muted">Загрузка админ-панели…</div>
  }

  return (
    <div className="pad admin-panel">
      <div className="admin-hero">
        <Shield size={22} />
        <div>
          <strong>Админ · {user.name}</strong>
          <div className="muted">Заявки УК · компании · пользователи</div>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <b>{stats.pendingUk ?? 0}</b>
          <span className="muted">Заявки УК</span>
        </div>
        <div className="stat">
          <b>{stats.approvedCompanies ?? 0}</b>
          <span className="muted">УК активны</span>
        </div>
        <div className="stat">
          <b>{stats.users ?? 0}</b>
          <span className="muted">Пользователи</span>
        </div>
      </div>

      <div className="admin-tabs">
        {(
          [
            ['requests', 'Заявки УК', pendingUk.length],
            ['companies', 'Все УК', companies.length],
            ['users', 'Люди', users.length],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'admin-tab active' : 'admin-tab'}
            onClick={() => {
              setTab(id)
              setSelectedCompanyId(null)
            }}
          >
            {label}
            <span className="admin-tab-count">{count}</span>
          </button>
        ))}
      </div>

      {tab === 'requests' ? (
        <section>
          {pendingUk.length === 0 ? (
            <EmptyState
              icon={<Building2 size={36} />}
              title="Новых заявок нет"
              text="Когда УК подаст заявку через бота — она появится здесь."
            />
          ) : (
            pendingUk.map((item) => (
              <div key={item.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{item.name}</strong>
                  <StatusPill status={item.status} />
                </div>
                <div className="muted">Город: {item.city || '—'}</div>
                <div className="muted">Тел. УК: {item.phone || '—'}</div>
                <div className="muted">Адрес: {item.address || '—'}</div>
                <div className="hint" style={{ marginTop: 8 }}>
                  Руководитель: {item.manager?.name}
                  {item.manager?.phone ? ` · ${item.manager.phone}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {item.manager?.maxProfileUrl ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => openMaxProfile(item.manager.maxProfileUrl)}
                    >
                      <ExternalLink size={14} /> Профиль в MAX
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === item.id}
                    onClick={() =>
                      run(item.id, async () => {
                        await clientApi.adminDecideUk(item.id, 'approve')
                        setToast({ type: 'success', text: 'УК одобрена' })
                      })
                    }
                  >
                    Одобрить
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busyId === item.id}
                    onClick={() =>
                      run(item.id, async () => {
                        await clientApi.adminDecideUk(item.id, 'reject')
                        setToast({ type: 'info', text: 'Заявка отклонена' })
                      })
                    }
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}

      {tab === 'companies' ? (
        <section>
          {selectedCompany ? (
            <div>
              <button type="button" className="back-btn" onClick={() => setSelectedCompanyId(null)}>
                ← Ко всем УК
              </button>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{selectedCompany.name}</strong>
                  <StatusPill status={selectedCompany.status} />
                </div>
                <div className="muted">Город: {selectedCompany.city || '—'}</div>
                <div className="muted">Телефон: {selectedCompany.phone || '—'}</div>
                <div className="muted">Email: {selectedCompany.email || '—'}</div>
                <div className="muted">Адрес: {selectedCompany.address || '—'}</div>
                <h3 style={{ marginTop: 14 }}>Руководитель</h3>
                <div>{selectedCompany.manager?.name}</div>
                <div className="muted">{selectedCompany.manager?.phone || 'нет телефона'}</div>
                {selectedCompany.manager?.maxProfileUrl ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ marginTop: 8 }}
                    onClick={() => openMaxProfile(selectedCompany.manager.maxProfileUrl)}
                  >
                    <ExternalLink size={14} /> Профиль руководителя в MAX
                  </button>
                ) : null}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {selectedCompany.status !== 'blocked' ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busyId === selectedCompany.id}
                      onClick={() =>
                        run(selectedCompany.id, async () => {
                          if (!window.confirm(`Заблокировать УК «${selectedCompany.name}»? Жители будут отвязаны и уведомлены.`)) {
                            return
                          }
                          await clientApi.adminBlockCompany(selectedCompany.id)
                          setToast({ type: 'info', text: 'УК заблокирована, жители уведомлены' })
                        })
                      }
                    >
                      Заблокировать УК
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busyId === selectedCompany.id}
                      onClick={() =>
                        run(selectedCompany.id, async () => {
                          await clientApi.adminUnblockCompany(selectedCompany.id)
                          setToast({ type: 'success', text: 'УК разблокирована' })
                        })
                      }
                    >
                      Разблокировать УК
                    </button>
                  )}
                </div>
              </div>

              <h3>Жители и сотрудники ({selectedCompany.residents?.length || 0})</h3>
              {(selectedCompany.residents || []).length === 0 ? (
                <p className="muted">Пока никого нет</p>
              ) : (
                selectedCompany.residents.map((u: any) => (
                  <UserAdminCard
                    key={u.id}
                    u={u}
                    companies={companies}
                    busyId={busyId}
                    moveUserId={moveUserId}
                    moveCompanyId={moveCompanyId}
                    setMoveUserId={setMoveUserId}
                    setMoveCompanyId={setMoveCompanyId}
                    onRun={run}
                    onReload={reload}
                    setToast={setToast}
                  />
                ))
              )}
            </div>
          ) : companies.length === 0 ? (
            <EmptyState icon={<Building2 size={36} />} title="УК пока нет" text="Одобрите заявки или дождитесь регистрации через бота." />
          ) : (
            companies.map((c) => (
              <button
                key={c.id}
                type="button"
                className="house-item"
                onClick={() => setSelectedCompanyId(c.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{c.name}</strong>
                  <StatusPill status={c.status} />
                </div>
                <div className="muted">{c.city || 'без города'} · жителей: {c.residentsCount}</div>
                <div className="hint">Рук.: {c.manager?.name}</div>
              </button>
            ))
          )}
        </section>
      ) : null}

      {tab === 'users' ? (
        <section>
          <Field label="Поиск">
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, телефон, УК" />
          </Field>
          {filteredUsers.length === 0 ? (
            <EmptyState icon={<Users size={36} />} title="Никого не найдено" text="" />
          ) : (
            filteredUsers.map((u) => (
              <UserAdminCard
                key={u.id}
                u={u}
                companies={companies}
                busyId={busyId}
                moveUserId={moveUserId}
                moveCompanyId={moveCompanyId}
                setMoveUserId={setMoveUserId}
                setMoveCompanyId={setMoveCompanyId}
                onRun={run}
                onReload={reload}
                setToast={setToast}
              />
            ))
          )}
        </section>
      ) : null}
    </div>
  )
}

function UserAdminCard({
  u,
  companies,
  busyId,
  moveUserId,
  moveCompanyId,
  setMoveUserId,
  setMoveCompanyId,
  onRun,
  onReload,
  setToast,
}: any) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong>{u.name}</strong>
        <span className="hint">{u.role}{u.blocked ? ' · блок' : ''}</span>
      </div>
      <div className="muted">{u.phone || 'нет телефона'}</div>
      <div className="muted">УК: {u.companyName || 'не привязан'}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        {u.maxProfileUrl ? (
          <button type="button" className="btn btn-ghost" onClick={() => openMaxProfile(u.maxProfileUrl)}>
            <ExternalLink size={14} /> MAX
          </button>
        ) : null}
        {u.role !== 'admin' ? (
          u.blocked ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busyId === u.id}
              onClick={() =>
                onRun(u.id, async () => {
                  await clientApi.adminUnblockUser(u.id)
                  setToast({ type: 'success', text: 'Пользователь разблокирован' })
                })
              }
            >
              Разблокировать
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busyId === u.id}
              onClick={() =>
                onRun(u.id, async () => {
                  if (!window.confirm(`Заблокировать ${u.name}?`)) return
                  await clientApi.adminBlockUser(u.id)
                  setToast({ type: 'info', text: 'Пользователь заблокирован' })
                })
              }
            >
              Заблокировать
            </button>
          )
        ) : null}
        {u.role !== 'admin' ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setMoveUserId(moveUserId === u.id ? null : u.id)
              setMoveCompanyId(u.companyId || '')
            }}
          >
            <UserRound size={14} /> Перенести в УК
          </button>
        ) : null}
      </div>
      {moveUserId === u.id ? (
        <div style={{ marginTop: 10 }}>
          <select
            className="input"
            value={moveCompanyId}
            onChange={(e) => setMoveCompanyId(e.target.value)}
          >
            <option value="">— Без УК —</option>
            {companies
              .filter((c: any) => c.status === 'approved')
              .map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <PrimaryButton
            style={{ marginTop: 8 }}
            disabled={busyId === u.id}
            onClick={() =>
              onRun(u.id, async () => {
                await clientApi.adminMoveUser(u.id, moveCompanyId || null)
                setMoveUserId(null)
                setToast({ type: 'success', text: 'Пользователь перенесён' })
                await onReload()
              })
            }
          >
            Сохранить
          </PrimaryButton>
        </div>
      ) : null}
    </div>
  )
}
