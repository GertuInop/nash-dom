import { type FormEvent, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useUser } from '../store'
import { Field, Header, houseTitle, PrimaryButton, TextInput } from '../ui'

export function SelectHouseScreen() {
  const user = useUser()
  const houses = useAppStore((s) => s.houses)
  const selectHouse = useAppStore((s) => s.selectHouse)
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

  return (
    <div className="shell-root">
      <div className="shell">
        <Header title="Выбор дома" sub="Адрес и управляющая компания" />
        <div className="content pad">
          <Field label="Поиск">
            <TextInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Улица, город или УК"
            />
          </Field>
          <div style={{ marginTop: 14 }}>
            {list.length === 0 ? (
              <p className="muted">
                Список домов пуст. Убедитесь, что API и MySQL запущены в папке bot.
              </p>
            ) : null}
            {list.map((house) => (
              <button
                key={house.id}
                type="button"
                className={picked === house.id ? 'house-item picked' : 'house-item'}
                onClick={() => setPicked(house.id)}
              >
                <strong>{houseTitle(house.city, house.address)}</strong>
                <div className="muted">{house.uk}</div>
              </button>
            ))}
          </div>
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
        <Header title="Мой адрес" sub="Видно только вам" />
        <div className="content pad">
          <p className="muted">
            Улица, подъезд и квартира не показываются соседям и в заявках УК. В заявке
            уходит только адрес дома.
          </p>
          <form onSubmit={onSubmit}>
            <Field label="Улица">
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
            <button
              type="button"
              className="btn btn-ghost btn-block"
              style={{ marginTop: 10 }}
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
          </form>
        </div>
      </div>
    </div>
  )
}
