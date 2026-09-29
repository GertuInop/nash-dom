import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useUser } from '../store'
import { Field, Logo, PrimaryButton, TextInput } from '../ui'

type ResidentStep = 'phone' | 'city' | 'address' | 'entrance' | 'flat' | 'uk'
type UkStep = 'name' | 'phone' | 'city' | 'address' | 'entrances' | 'floors' | 'parking'

const RESIDENT_STEPS: ResidentStep[] = ['phone', 'city', 'address', 'entrance', 'flat', 'uk']
const UK_STEPS: UkStep[] = ['name', 'phone', 'city', 'address', 'entrances', 'floors', 'parking']

function Shell({
  title,
  sub,
  step,
  total,
  children,
}: {
  title: string
  sub?: string
  step?: number
  total?: number
  children: React.ReactNode
}) {
  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-card-brand">
            <Logo />
          </div>
          <h1>{title}</h1>
          {sub ? <p className="muted" style={{ marginTop: 0 }}>{sub}</p> : null}
          {step != null && total != null ? (
            <div className="onboard-progress" aria-hidden>
              <div className="onboard-progress-bar" style={{ width: `${(step / total) * 100}%` }} />
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  )
}

export function OnboardingScreen() {
  const user = useUser()
  const companies = useAppStore((s) => s.companies)
  const setRole = useAppStore((s) => s.setRole)
  const saveResidentOnboarding = useAppStore((s) => s.saveResidentOnboarding)
  const registerUkOnboarding = useAppStore((s) => s.registerUkOnboarding)
  const selectCompany = useAppStore((s) => s.selectCompany)
  const setToast = useAppStore((s) => s.setToast)
  const navigate = useNavigate()

  const [busy, setBusy] = useState(false)
  const [residentStep, setResidentStep] = useState<ResidentStep>('phone')
  const [ukStep, setUkStep] = useState<UkStep>('name')

  const [phone, setPhone] = useState(user?.phone || '')
  const [city, setCity] = useState(user?.city || '')
  const [street, setStreet] = useState(user?.street || '')
  const [entrance, setEntrance] = useState(user?.entrance || '')
  const [flat, setFlat] = useState(user?.flat || '')
  const [ukName, setUkName] = useState('')
  const [ukAddress, setUkAddress] = useState('')
  const [entrances, setEntrances] = useState('')
  const [floors, setFloors] = useState('')
  const [parkingSpots, setParkingSpots] = useState('')
  const [ukQuery, setUkQuery] = useState('')
  const [pickedUk, setPickedUk] = useState('')

  useEffect(() => {
    if (
      user?.role === 'resident'
      && user.phone
      && user.citySlug
      && user.street
      && user.entrance
      && user.flat
      && !user.companyId
    ) {
      setResidentStep('uk')
    }
  }, [user?.role, user?.phone, user?.citySlug, user?.street, user?.entrance, user?.flat, user?.companyId])

  const filteredCompanies = useMemo(() => {
    const q = ukQuery.trim().toLowerCase()
    return companies.filter(
      (c) =>
        !q
        || c.name.toLowerCase().includes(q)
        || c.city.toLowerCase().includes(q)
        || c.address.toLowerCase().includes(q),
    )
  }, [companies, ukQuery])

  async function pickRole(role: 'resident' | 'uk') {
    setBusy(true)
    try {
      await setRole(role)
      setToast({ type: 'success', text: role === 'resident' ? 'Роль: житель' : 'Роль: руководитель УК' })
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Ошибка' })
    } finally {
      setBusy(false)
    }
  }

  async function finishResidentProfile() {
    setBusy(true)
    try {
      await saveResidentOnboarding({ phone, city, street, entrance, flat })
      setResidentStep('uk')
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Ошибка' })
    } finally {
      setBusy(false)
    }
  }

  async function finishUk() {
    setBusy(true)
    try {
      await registerUkOnboarding({
        name: ukName,
        phone,
        city,
        address: ukAddress,
        entrances: Number(entrances),
        floors: Number(floors),
        parkingSpots: Number(parkingSpots),
      })
      setToast({ type: 'success', text: 'УК зарегистрирована' })
      navigate('/app', { replace: true })
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Ошибка' })
    } finally {
      setBusy(false)
    }
  }

  async function confirmUk() {
    if (!pickedUk) return
    setBusy(true)
    try {
      await selectCompany(pickedUk)
      setToast({ type: 'success', text: 'Добро пожаловать' })
      navigate('/app', { replace: true })
    } catch (e) {
      setToast({ type: 'error', text: e instanceof Error ? e.message : 'Ошибка' })
    } finally {
      setBusy(false)
    }
  }

  if (!user?.role) {
    return (
      <Shell title="Кто вы?" sub="Выберите роль — дальше короткий опрос по шагам">
        <div className="role-pick">
          <button type="button" className="role-card" disabled={busy} onClick={() => void pickRole('resident')}>
            <strong>Житель</strong>
            <span className="muted">Обращения, чаты дома, парковка</span>
          </button>
          <button type="button" className="role-card" disabled={busy} onClick={() => void pickRole('uk')}>
            <strong>Руководитель УК</strong>
            <span className="muted">Регистрация компании и управление домом</span>
          </button>
        </div>
      </Shell>
    )
  }

  if (user.role === 'resident') {
    const idx = RESIDENT_STEPS.indexOf(residentStep)
    const total = RESIDENT_STEPS.length

    if (residentStep === 'uk') {
      return (
        <Shell title="Выбор УК" sub="Найдите свою управляющую компанию" step={total} total={total}>
          <Field label="Поиск">
            <TextInput
              value={ukQuery}
              onChange={(e) => setUkQuery(e.target.value)}
              placeholder="Название или город"
            />
          </Field>
          <div className="onboard-list">
            {filteredCompanies.length === 0 ? (
              <p className="muted">Пока нет зарегистрированных УК. Попросите руководителя пройти регистрацию.</p>
            ) : (
              filteredCompanies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={pickedUk === c.id ? 'house-item picked' : 'house-item'}
                  onClick={() => setPickedUk(c.id)}
                >
                  <strong>{c.name}</strong>
                  {c.address ? <div className="muted">{c.address}</div> : null}
                  <div className="hint">{c.city}</div>
                </button>
              ))
            )}
          </div>
          <PrimaryButton disabled={!pickedUk || busy} onClick={() => void confirmUk()}>
            {busy ? 'Сохранение…' : 'Продолжить'}
          </PrimaryButton>
        </Shell>
      )
    }

    const titles: Record<Exclude<ResidentStep, 'uk'>, { title: string; label: string; placeholder: string }> = {
      phone: { title: 'Телефон', label: 'Номер телефона', placeholder: '+7…' },
      city: { title: 'Город', label: 'Город', placeholder: 'Например, Казань' },
      address: { title: 'Адрес', label: 'Улица, дом', placeholder: 'ул. Примерная, 1' },
      entrance: { title: 'Подъезд', label: 'Номер подъезда', placeholder: '1' },
      flat: { title: 'Квартира', label: 'Номер квартиры', placeholder: '42' },
    }
    const meta = titles[residentStep]
    const value =
      residentStep === 'phone' ? phone
        : residentStep === 'city' ? city
          : residentStep === 'address' ? street
            : residentStep === 'entrance' ? entrance
              : flat
    const setValue =
      residentStep === 'phone' ? setPhone
        : residentStep === 'city' ? setCity
          : residentStep === 'address' ? setStreet
            : residentStep === 'entrance' ? setEntrance
              : setFlat

    return (
      <Shell title={meta.title} sub="Шаг регистрации жителя" step={idx + 1} total={total}>
        <Field label={meta.label}>
          <TextInput
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={meta.placeholder}
            autoFocus
          />
        </Field>
        <div className="onboard-nav">
          {idx > 0 ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setResidentStep(RESIDENT_STEPS[idx - 1]!)}
            >
              Назад
            </button>
          ) : <span />}
          <PrimaryButton
            disabled={busy || !value.trim()}
            onClick={() => {
              if (residentStep === 'flat') void finishResidentProfile()
              else setResidentStep(RESIDENT_STEPS[idx + 1]!)
            }}
          >
            {busy ? 'Сохранение…' : residentStep === 'flat' ? 'Далее к выбору УК' : 'Далее'}
          </PrimaryButton>
        </div>
      </Shell>
    )
  }

  const idx = UK_STEPS.indexOf(ukStep)
  const total = UK_STEPS.length
  const ukMeta: Record<UkStep, { title: string; label: string; placeholder: string; value: string; set: (v: string) => void }> = {
    name: { title: 'Название УК', label: 'Управляющая компания', placeholder: 'УК «…»', value: ukName, set: setUkName },
    phone: { title: 'Телефон', label: 'Номер руководителя', placeholder: '+7…', value: phone, set: setPhone },
    city: { title: 'Город', label: 'Город', placeholder: 'Например, Казань', value: city, set: setCity },
    address: { title: 'Адрес УК', label: 'Адрес дома / офиса', placeholder: 'ул. …', value: ukAddress, set: setUkAddress },
    entrances: { title: 'Подъезды', label: 'Количество подъездов', placeholder: '2', value: entrances, set: setEntrances },
    floors: { title: 'Этажи', label: 'Количество этажей', placeholder: '9', value: floors, set: setFloors },
    parking: { title: 'Парковка', label: 'Парковочных мест у дома', placeholder: '18', value: parkingSpots, set: setParkingSpots },
  }
  const meta = ukMeta[ukStep]

  return (
    <Shell title={meta.title} sub="Регистрация руководителя УК" step={idx + 1} total={total}>
      <Field label={meta.label}>
        <TextInput
          value={meta.value}
          onChange={(e) => meta.set(e.target.value)}
          placeholder={meta.placeholder}
          inputMode={['entrances', 'floors', 'parking', 'phone'].includes(ukStep) ? 'numeric' : undefined}
          autoFocus
        />
      </Field>
      <div className="onboard-nav">
        {idx > 0 ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => setUkStep(UK_STEPS[idx - 1]!)}
          >
            Назад
          </button>
        ) : <span />}
        <PrimaryButton
          disabled={busy || !meta.value.trim()}
          onClick={() => {
            if (ukStep === 'parking') void finishUk()
            else setUkStep(UK_STEPS[idx + 1]!)
          }}
        >
          {busy ? 'Сохранение…' : ukStep === 'parking' ? 'Открыть платформу' : 'Далее'}
        </PrimaryButton>
      </div>
    </Shell>
  )
}
