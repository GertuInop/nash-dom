import { type FormEvent, type ReactNode, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Field, Logo, PhoneInput, PrimaryButton, TextInput, isCompletePhone } from '../ui'
import { useAppStore } from '../store'

function AuthLayout({
  title,
  children,
  step = 1,
  onBack,
}: {
  title: string
  children: ReactNode
  step?: number
  onBack?: () => void
}) {
  return (
    <div className="auth-page">
      <div className="auth-shell">
        <aside className="auth-aside">
          <Logo light />
          <div className="auth-aside-copy">
            <span className="auth-pill">Наш Дом · MAX</span>
            <h2>Как в боте MAX</h2>
            <p>Роль → данные → дом. Пароль не нужен: вы уже в аккаунте MAX.</p>
          </div>
          <div className="auth-steps">
            {['Выберите роль', 'Укажите данные', 'Выберите дом'].map((label, i) => (
              <div key={label} className={`auth-step${step === i + 1 ? ' active' : ''}`}>
                <span>{i + 1}</span>
                <p>{label}</p>
              </div>
            ))}
          </div>
        </aside>
        <div className="auth-card">
          <div className="auth-card-brand">
            {onBack ? (
              <button type="button" className="back-btn" onClick={onBack} aria-label="Назад">
                <ChevronLeft size={20} /> Назад
              </button>
            ) : (
              <Logo />
            )}
          </div>
          <h1>{title}</h1>
          {children}
        </div>
      </div>
    </div>
  )
}

export function LoginScreen() {
  const login = useAppStore((s) => s.login)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isCompletePhone(phone)) {
      setError('Укажите телефон полностью')
      return
    }
    setBusy(true)
    const err = await login(phone)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    navigate('/')
  }

  return (
    <AuthLayout title="Вход через MAX" step={1}>
      <p className="muted">Достаточно телефона из аккаунта — пароль не спрашиваем.</p>
      <form onSubmit={onSubmit}>
        <Field label="Телефон">
          <PhoneInput value={phone} onChange={setPhone} />
        </Field>
        {error ? <div className="error">{error}</div> : null}
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? 'Вход…' : 'Продолжить'}
        </PrimaryButton>
      </form>
      <div className="links">
        <Link to="/register">Я новый житель</Link>
        <Link to="/register-uk">Я из УК</Link>
      </div>
      <div className="demo">
        Демо: +7 900 123-45-67 — житель. Номер на 1 — УК: +7 900 123-45-61.
      </div>
    </AuthLayout>
  )
}

export function RegisterResidentScreen() {
  const registerResident = useAppStore((s) => s.registerResident)
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('Калининград')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (step === 1) {
      if (name.trim().split(/\s+/).length < 2) {
        setError('Укажите имя и фамилию')
        return
      }
      setError('')
      setStep(2)
      return
    }
    if (!isCompletePhone(phone)) {
      setError('Укажите телефон полностью')
      return
    }
    setBusy(true)
    const err = await registerResident(name, phone, city)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    navigate('/select-house')
  }

  return (
    <AuthLayout
      title={step === 1 ? 'Житель: как вас зовут?' : 'Город и телефон'}
      step={step === 1 ? 2 : 3}
      onBack={() => (step === 1 ? navigate('/login') : setStep(1))}
    >
      <p className="muted">Тот же путь, что в боте: роль → данные → дом. Без пароля.</p>
      <form onSubmit={onSubmit}>
        {step === 1 ? (
          <Field label="ФИО">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван Иванов" />
          </Field>
        ) : (
          <>
            <Field label="Город">
              <TextInput value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="Телефон">
              <PhoneInput value={phone} onChange={setPhone} />
            </Field>
          </>
        )}
        {error ? <div className="error">{error}</div> : null}
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? 'Создание…' : step === 1 ? 'Далее' : 'Продолжить к выбору дома'}
        </PrimaryButton>
      </form>
      <div className="links">
        <Link to="/login">Уже есть аккаунт</Link>
        <Link to="/register-uk">Я из УК</Link>
      </div>
    </AuthLayout>
  )
}

export function RegisterUkScreen() {
  const registerUk = useAppStore((s) => s.registerUk)
  const [step, setStep] = useState(1)
  const [ukName, setUkName] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('Калининград')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (step === 1) {
      if (!ukName.trim()) {
        setError('Укажите название УК')
        return
      }
      if (name.trim().split(/\s+/).length < 2) {
        setError('Укажите ФИО ответственного')
        return
      }
      setError('')
      setStep(2)
      return
    }
    if (!isCompletePhone(phone)) {
      setError('Укажите телефон полностью')
      return
    }
    setBusy(true)
    const err = await registerUk(ukName, name, phone, city)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    navigate('/select-house')
  }

  return (
    <AuthLayout
      title={step === 1 ? 'УК: название и контакт' : 'Город и телефон'}
      step={step === 1 ? 2 : 3}
      onBack={() => (step === 1 ? navigate('/login') : setStep(1))}
    >
      <p className="muted">Как в боте: заявка УК без пароля. Дальше — выбор дома.</p>
      <form onSubmit={onSubmit}>
        {step === 1 ? (
          <>
            <Field label="Название УК">
              <TextInput value={ukName} onChange={(e) => setUkName(e.target.value)} />
            </Field>
            <Field label="ФИО ответственного">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Город">
              <TextInput value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="Телефон">
              <PhoneInput value={phone} onChange={setPhone} />
            </Field>
          </>
        )}
        {error ? <div className="error">{error}</div> : null}
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? 'Создание…' : step === 1 ? 'Далее' : 'Продолжить'}
        </PrimaryButton>
      </form>
      <div className="links">
        <Link to="/login">Уже есть аккаунт</Link>
        <Link to="/register">Я житель</Link>
      </div>
    </AuthLayout>
  )
}
