import { useEffect, useState } from 'react'
import { useAppStore } from '../store'
import { Logo, PrimaryButton } from '../ui'

/** Экран, если мини-приложение открыто вне MAX (нет Bridge initData) */
export function MaxRequiredScreen() {
  const apiError = useAppStore((s) => s.apiError)
  const hydrate = useAppStore((s) => s.hydrate)

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <aside className="auth-aside">
          <Logo light />
          <div className="auth-aside-copy">
            <span className="auth-pill">Дом под рукой · MAX</span>
            <h2>Мини-приложение MAX</h2>
            <p>Вход не нужен — профиль подтягивается по вашему id в MAX.</p>
          </div>
        </aside>
        <div className="auth-card">
          <div className="auth-card-brand">
            <Logo />
          </div>
          <h1>Откройте в MAX</h1>
          <p className="muted">
            Приложение запускается из бота или из меню мини-приложений MAX. Данные пользователя
            (имя, телефон, УК) берутся из базы автоматически.
          </p>
          {apiError ? <div className="error">{apiError}</div> : null}
          <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={() => void hydrate()}>
            Повторить
          </button>
        </div>
      </div>
    </div>
  )
}

/** Согласие — текст внутри приложения, без внешнего PDF/URL */
export function ConsentScreen() {
  const acceptConsent = useAppStore((s) => s.acceptConsent)
  const setToast = useAppStore((s) => s.setToast)
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('Загрузка соглашения…')

  useEffect(() => {
    void fetch('/server/consent-text')
      .then((r) => r.json())
      .then((d) => setText(String(d.text || '')))
      .catch(() => setText('Не удалось загрузить текст соглашения. Нажмите «Согласен», если принимаете условия сервиса «Дом под рукой».'))
  }, [])

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <aside className="auth-aside">
          <Logo light />
          <div className="auth-aside-copy">
            <span className="auth-pill">Дом под рукой · MAX</span>
            <h2>Пользовательское соглашение</h2>
            <p>Перед работой с сервисом нужно подтвердить согласие с условиями.</p>
          </div>
        </aside>
        <div className="auth-card">
          <div className="auth-card-brand">
            <Logo />
          </div>
          <h1>Согласие</h1>
          <div className="consent-scroll">{text}</div>
          <p className="consent-note">
            Полная PDF-версия доступна в боте («Открыть PDF соглашения») и по адресу{' '}
            <a href="/server/consent.pdf" target="_blank" rel="noreferrer">
              /server/consent.pdf
            </a>
            .
          </p>
          <PrimaryButton
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await acceptConsent()
                setToast({ type: 'success', text: 'Согласие принято' })
              } catch (e) {
                setToast({ type: 'error', text: e instanceof Error ? e.message : 'Ошибка' })
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Сохранение…' : 'Согласен'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
