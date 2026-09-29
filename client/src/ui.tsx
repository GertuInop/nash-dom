import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { NavLink } from 'react-router-dom'

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className={light ? 'logo logo-light' : 'logo'}>
      <div className="logo-mark">ND</div>
      <div>
        <strong>Наш Дом</strong>
        <div className="muted" style={{ fontSize: 12 }}>
          мини-приложение MAX
        </div>
      </div>
    </div>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />
}

/** Нормализация: всегда 11 цифр, начиная с 7 */
export function phoneDigits(value: string) {
  let d = value.replace(/\D/g, '')
  if (d.startsWith('8')) d = `7${d.slice(1)}`
  if (!d.startsWith('7') && d.length > 0) d = `7${d}`
  return d.slice(0, 11)
}

/** Маска +7 XXX XXX-XX-XX */
export function formatPhoneMask(value: string) {
  const d = phoneDigits(value)
  if (!d) return ''
  const rest = d.slice(1)
  let out = '+7'
  if (rest.length === 0) return out
  out += ` ${rest.slice(0, 3)}`
  if (rest.length > 3) out += ` ${rest.slice(3, 6)}`
  if (rest.length > 6) out += `-${rest.slice(6, 8)}`
  if (rest.length > 8) out += `-${rest.slice(8, 10)}`
  return out
}

export function isCompletePhone(value: string) {
  return phoneDigits(value).length === 11
}

export function PhoneInput({
  value,
  onChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string
  onChange: (masked: string) => void
}) {
  return (
    <input
      {...props}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder={props.placeholder ?? '+7 900 123-45-67'}
      value={formatPhoneMask(value)}
      onChange={(e) => onChange(formatPhoneMask(e.target.value))}
      onFocus={(e) => {
        if (!phoneDigits(value)) onChange('+7 ')
        props.onFocus?.(e)
      }}
    />
  )
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} />
}

export function PrimaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="btn btn-primary" {...props}>
      {children}
    </button>
  )
}

export function EmptyState({
  icon,
  title,
  text,
}: {
  icon: ReactNode
  title: string
  text: string
}) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

export function Header({
  title,
  sub,
  back,
  extra,
}: {
  title: string
  sub?: string
  back?: ReactNode
  extra?: ReactNode
}) {
  return (
    <header className="header">
      {back}
      <div className="grow">
        <h2>{title}</h2>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      {extra}
    </header>
  )
}

export function DesktopNav({
  items,
}: {
  items: { to: string; label: string; end?: boolean }[]
}) {
  return (
    <nav className="desktop-nav">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function categoryLabel(id: string) {
  const map: Record<string, string> = {
    accident: 'Авария',
    cleaning: 'Уборка',
    parking: 'Парковка',
    overhaul: 'Капремонт',
    elevator: 'Лифт',
    heating: 'Отопление',
    power: 'Электричество',
    water: 'Водоснабжение',
    landscaping: 'Благоустройство',
    quality: 'Качество услуг',
    other: 'Другое',
  }
  return map[id] ?? id
}

export function statusLabel(status: string) {
  if (status === 'new') return 'Новая'
  if (status === 'in_progress') return 'В работе'
  if (status === 'rejected') return 'Отклонена'
  return 'Выполнена'
}

export function statusClass(status: string) {
  if (status === 'new') return 'badge badge-new'
  if (status === 'in_progress') return 'badge badge-work'
  if (status === 'rejected') return 'badge badge-rejected'
  return 'badge badge-done'
}

export function houseTitle(city: string, address: string) {
  return `${city}, ${address}`
}

export { workLabel } from './types'
