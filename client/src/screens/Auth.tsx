import { Logo } from '../ui'
import { useAppStore } from '../store'

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
            <span className="auth-pill">Наш Дом · MAX</span>
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
