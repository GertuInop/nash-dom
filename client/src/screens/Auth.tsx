import { type FormEvent, type ReactNode, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Field, Logo, PhoneInput, PrimaryButton, TextInput, isCompletePhone } from '../ui'
import { useAppStore } from '../store'

function AuthLayout({
  title,
  children,
  step = 1,
}: {
  title: string
  children: ReactNode
  step?: number
}) {
  return (
    <div className="auth-page">
      <div className="auth-shell">
        <aside className="auth-aside">
          <Logo light />
          <div className="auth-aside-copy">
            <span className="auth-pill">Наш Дом · MAX</span>
            <h2>Дом и УК в одном месте</h2>
            <p>Заявки, чаты дома и паспорт подъездов — как в мессенджере MAX.</p>
          </div>
          <div className="auth-steps">
            {[
              'Войдите или создайте аккаунт',
              'Выберите дом',
              'Следите за работами УК',
            ].map((label, i) => (
              <div key={label} className={`auth-step${step === i + 1 ? ' active' : ''}`}>
                <span>{i + 1}</span>
                <p>{label}</p>
              </div>
            ))}
          </div>
        </aside>
        <div className="auth-card">
          <div className="auth-card-brand">
            <Logo />
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
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isCompletePhone(phone)) {
      setError('Укажите телефон полностью')
      return
    }
    if (password.length < 4) {
      setError('Пароль — минимум 4 символа')
      return
    }
    setBusy(true)
    const err = await login(phone, password)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    navigate('/')
  }

  return (
    <AuthLayout title="Вход" step={1}>
      <p className="muted">Для жителей и сотрудников УК</p>
      <form onSubmit={onSubmit}>
        <Field label="Телефон">
          <PhoneInput value={phone} onChange={setPhone} />
        </Field>
        <Field label="Пароль">
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Минимум 4 символа"
            autoComplete="current-password"
          />
        </Field>
        {error ? <div className="error">{error}</div> : null}
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? 'Вход…' : 'Продолжить'}
        </PrimaryButton>
      </form>
      <div className="links">
        <Link to="/register">Регистрация жителя</Link>
        <Link to="/register-uk">Регистрация УК</Link>
      </div>
      <div className="demo">
        Демо: +7 900 123-45-67 / 1234 — житель. Номер на 1 — УК: +7 900 123-45-61 / 1234.
      </div>
    </AuthLayout>
  )
}

export function RegisterResidentScreen() {
  const registerResident = useAppStore((s) => s.registerResident)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (name.trim().split(/\s+/).length < 2) {
      setError('Укажите имя и фамилию')
      return
    }
    if (!isCompletePhone(phone)) {
      setError('Укажите телефон полностью')
      return
    }
    if (password.length < 4) {
      setError('Пароль — минимум 4 символа')
      return
    }
    setBusy(true)
    const err = await registerResident(name, phone, password)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    navigate('/')
  }

  return (
    <AuthLayout title="Регистрация жителя" step={1}>
      <form onSubmit={onSubmit}>
        <Field label="ФИО">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Телефон">
          <PhoneInput value={phone} onChange={setPhone} />
        </Field>
        <Field label="Пароль">
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error ? <div className="error">{error}</div> : null}
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? 'Создание…' : 'Продолжить'}
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
  const [ukName, setUkName] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ukName.trim()) {
      setError('Укажите название УК')
      return
    }
    if (name.trim().split(/\s+/).length < 2) {
      setError('Укажите ФИО ответственного')
      return
    }
    if (!isCompletePhone(phone)) {
      setError('Укажите телефон полностью')
      return
    }
    if (password.length < 4) {
      setError('Пароль — минимум 4 символа')
      return
    }
    setBusy(true)
    const err = await registerUk(ukName, name, phone, password)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    navigate('/')
  }

  return (
    <AuthLayout title="Регистрация УК" step={1}>
      <form onSubmit={onSubmit}>
        <Field label="Название УК">
          <TextInput value={ukName} onChange={(e) => setUkName(e.target.value)} />
        </Field>
        <Field label="ФИО ответственного">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Телефон">
          <PhoneInput value={phone} onChange={setPhone} />
        </Field>
        <Field label="Пароль">
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error ? <div className="error">{error}</div> : null}
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? 'Создание…' : 'Продолжить'}
        </PrimaryButton>
      </form>
      <div className="links">
        <Link to="/login">Уже есть аккаунт</Link>
        <Link to="/register">Я житель</Link>
      </div>
    </AuthLayout>
  )
}
