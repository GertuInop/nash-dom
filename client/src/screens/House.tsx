import { type FormEvent, useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useUser } from '../store'
import { Field, Header, PrimaryButton, TextInput } from '../ui'

export function SelectCompanyScreen() {
  const user = useUser()
  const companies = useAppStore((s) => s.companies)
  const selectCompany = useAppStore((s) => s.selectCompany)
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState(user?.companyId ?? '')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return companies.filter(
      (c) =>
        !s ||
        c.name.toLowerCase().includes(s) ||
        c.city.toLowerCase().includes(s) ||
        c.address.toLowerCase().includes(s),
    )
  }, [q, companies])

  const byCity = useMemo(() => {
    const map = new Map<string, typeof list>()
    for (const c of list) {
      const city = c.city || 'Без города'
      const arr = map.get(city) || []
      arr.push(c)
      map.set(city, arr)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru'))
  }, [list])

  return (
    <div className="shell-root">
      <div className="shell">
        <Header
          title="Выбор УК"
          sub="Только управляющие компании из базы"
          back={
            <button type="button" className="back-btn" onClick={() => navigate('/app/profile')}>
              <ChevronLeft size={18} /> Назад
            </button>
          }
        />
        <div className={`content pad house-pick${picked ? ' has-confirm' : ''}`}>
          <Field label="Поиск">
            <TextInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Название УК или город"
            />
          </Field>
          <div style={{ marginTop: 14 }}>
            {list.length === 0 ? (
              <p className="muted">
                Пока нет УК в базе. Руководитель регистрирует УК через бота «Наш дом» — доступ открывается сразу.
              </p>
            ) : null}
            {byCity.map(([city, items]) => (
              <div key={city} className="city-group">
                <h3 className="city-group-title">{city}</h3>
                {items.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    className={picked === company.id ? 'house-item picked' : 'house-item'}
                    onClick={() => setPicked(company.id)}
                  >
                    <strong>{company.name}</strong>
                    {company.address ? <div className="muted">{company.address}</div> : null}
                    {company.phone ? <div className="hint">{company.phone}</div> : null}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className={`confirm-dock${picked ? ' show' : ''}`} aria-hidden={!picked}>
          <PrimaryButton
            disabled={!picked || busy}
            onClick={async () => {
              setBusy(true)
              try {
                await selectCompany(picked)
                navigate('/app')
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Сохранение…' : 'Подтвердить'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

/** @deprecated alias — оставлен для совместимости импортов */
export const SelectHouseScreen = SelectCompanyScreen

export function PrivateAddressScreen() {
  const user = useUser()
  const savePrivateAddress = useAppStore((s) => s.savePrivateAddress)
  const skipPrivateAddress = useAppStore((s) => s.skipPrivateAddress)
  const [street, setStreet] = useState(user?.street ?? '')
  const [entrance, setEntrance] = useState(user?.entrance ?? '')
  const [flat, setFlat] = useState(user?.flat ?? '')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await savePrivateAddress(street, entrance, flat)
      navigate('/')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shell-root">
      <div className="shell">
        <Header
          title="Мой адрес"
          sub="Видно только вам"
          back={
            <button type="button" className="back-btn" onClick={() => navigate('/app/profile')}>
              <ChevronLeft size={18} /> Назад
            </button>
          }
        />
        <div className="content pad">
          <form onSubmit={onSubmit}>
            <Field label="Улица / корпус">
              <TextInput value={street} onChange={(e) => setStreet(e.target.value)} />
            </Field>
            <Field label="Подъезд">
              <TextInput value={entrance} onChange={(e) => setEntrance(e.target.value)} />
            </Field>
            <Field label="Квартира">
              <TextInput value={flat} onChange={(e) => setFlat(e.target.value)} />
            </Field>
            <PrimaryButton type="submit" disabled={busy}>
              {busy ? 'Сохранение…' : 'Сохранить'}
            </PrimaryButton>
          </form>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: '100%', marginTop: 10 }}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await skipPrivateAddress()
                navigate('/')
              } finally {
                setBusy(false)
              }
            }}
          >
            Пропустить
          </button>
        </div>
      </div>
    </div>
  )
}
