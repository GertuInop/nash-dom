import { Building2, Home, LayoutDashboard, MessageCircle, Shield, UserRound } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAppStore, useUser } from '../store'
import { DesktopNav, Header, houseTitle } from '../ui'

export function AppShell() {
  const user = useUser()
  const houses = useAppStore((s) => s.houses)
  const location = useLocation()
  const house = houses.find((h) => h.id === user?.houseId)
  const isChat = location.pathname.startsWith('/app/chats')
  const isUk = user?.role === 'uk'
  const isAdmin = user?.role === 'admin'
  const hideChrome = location.pathname === '/app/house' || location.pathname === '/app/parking'

  const nav = isAdmin
    ? [
        { to: '/app', label: 'Админ', icon: Shield, end: true },
        { to: '/app/profile', label: 'Профиль', icon: UserRound },
      ]
    : isUk
      ? [
          { to: '/app', label: 'Панель', icon: LayoutDashboard, end: true },
          { to: '/app/house', label: 'Дом', icon: Building2 },
          { to: '/app/chats', label: 'Чаты', icon: MessageCircle },
          { to: '/app/profile', label: 'Профиль', icon: UserRound },
        ]
      : [
          { to: '/app', label: 'Лента', icon: Home, end: true },
          { to: '/app/house', label: 'Дом', icon: Building2 },
          { to: '/app/chats', label: 'Чаты', icon: MessageCircle },
          { to: '/app/profile', label: 'Профиль', icon: UserRound },
        ]

  const title = isAdmin ? 'Админ-панель' : isUk ? 'Панель УК' : 'Дом под рукой'
  const sub = isAdmin
    ? 'Управление УК и пользователями'
    : house
      ? houseTitle(house.city, house.address)
      : 'Дом не выбран'

  return (
    <div className="shell-root">
      <div className={isChat ? 'shell chat-wide' : 'shell'}>
        {!hideChrome ? (
          <Header
            title={title}
            sub={sub}
            extra={<DesktopNav items={nav.map(({ to, label, end }) => ({ to, label, end }))} />}
          />
        ) : null}
        <div
          className="content"
          style={isChat ? { display: 'flex', flexDirection: 'column', overflow: 'hidden' } : undefined}
        >
          <Outlet />
        </div>
        <nav className="bottom-nav bubble-nav" aria-label="Основное меню">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-item">
              <span className="nav-icon">
                <item.icon size={20} strokeWidth={2} />
              </span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
