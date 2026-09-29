import { type FormEvent, useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useUser } from '../store'
import { Field, Header, PrimaryButton, TextInput } from '../ui'

export function SelectHouseScreen() {
  const user = useUser()
  const houses = useAppStore((s) => s.houses)
  const selectHouse = useAppStore((s) => s.selectHouse)
  const logout = useAppStore((s) => s.logout)
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState(user?.houseId ?? '')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return houses.filter(
      (h) =>
        !s ||
        h.address.toLowerCase().includes(s) ||
        h.city.toLowerCase().includes(s) ||
        h.uk.toLowerCase().includes(s),
    )
  }, [q, houses])

  const byCity = useMemo(() => {
    const map = new Map<string, typeof list>()
    for (const h of list) {
      const arr = map.get(h.city) || []
      arr.push(h)
      map.set(h.city, arr)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru'))
  }, [list])

  return (
    <div className="shell-root">
      <div className="shell">
        <Header
          title="Выбор дома"
          sub="Город · улица · УК"
          back={
            <button
              type="button"
              className="back-btn"
              onClick={async () => {
                await logout()
                navigate('/login')
              }}
            >
              <ChevronLeft size={18} /> Назад
            </button>
          }
        />
        <div className={`content pad house-pick${picked ? ' has-confirm' : ''}`}>
          <Field label="Поиск">
            <TextInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Улица, город или УК"
            />
          </Field>
          <div style={{ marginTop: 14 }}>
            {list.length === 0 ? (
              <p className="muted">Список домов пуст. Убедитесь, что API и MySQL запущены.</p>
            ) : null}
            {byCity.map(([city, items]) => (
              <div key={city} className="city-group">
                <h3 className="city-group-title">{city}</h3>
                {items.map((house) => (
                  <button
                    key={house.id}
                    type="button"
                    className={picked === house.id ? 'house-item picked' : 'house-item'}
                    onClick={() => setPicked(house.id)}
                  >
                    <strong>{house.address}</strong>
                    <div className="muted">{house.uk}</div>
                    <div className="hint">
                      {house.entrances} под. · {house.floors} эт.
                    </div>
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
                await selectHouse(picked)
                navigate('/')
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
            <button type="button" className="back-btn" onClick={() => navigate('/select-house')}>
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
