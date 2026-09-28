import { useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { LoginScreen, RegisterResidentScreen, RegisterUkScreen } from './screens/Auth'
import { ChatsScreen } from './screens/Chats'
import { FeedScreen } from './screens/Feed'
import { PrivateAddressScreen, SelectHouseScreen } from './screens/House'
import { MyTicketsScreen, ProfileScreen } from './screens/Profile'
import { AppShell } from './screens/Shell'
import { BuildingScreen } from './screens/Building'
import { TopicsScreen } from './screens/Topics'
import { UkPanelScreen } from './screens/UkPanel'
import { useAppStore, useUser } from './store'

function ToastHost() {
  const toast = useAppStore((s) => s.toast)
  const setToast = useAppStore((s) => s.setToast)
  if (!toast) return null
  return (
    <button type="button" className="toast" onClick={() => setToast(null)}>
      {toast.text}
    </button>
  )
}

function GuestOnly() {
  const user = useUser()
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}

function NeedAuth() {
  const user = useUser()
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function NeedHouse() {
  const user = useUser()
  const location = useLocation()
  if (!user?.houseId) return <Navigate to="/select-house" replace />
  if (user.role === 'resident' && !user.skippedAddress && !user.street && !user.flat) {
    if (location.pathname !== '/address') return <Navigate to="/address" replace />
  }
  return <Outlet />
}

function HomeRedirect() {
  const user = useUser()
  if (!user) return <Navigate to="/login" replace />
  if (!user.houseId) return <Navigate to="/select-house" replace />
  if (user.role === 'resident' && !user.skippedAddress && !user.street && !user.flat) {
    return <Navigate to="/address" replace />
  }
  return <Navigate to="/app" replace />
}

function HomeScreen() {
  const user = useUser()
  return user?.role === 'uk' ? <UkPanelScreen /> : <FeedScreen />
}

function Bootstrap({ children }: { children: React.ReactNode }) {
  const ready = useAppStore((s) => s.ready)
  const hydrate = useAppStore((s) => s.hydrate)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (!ready) {
    return (
      <div className="auth-page">
        <div className="muted">Загрузка…</div>
      </div>
    )
  }

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Bootstrap>
        <ToastHost />
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/register" element={<RegisterResidentScreen />} />
            <Route path="/register-uk" element={<RegisterUkScreen />} />
          </Route>
          <Route element={<NeedAuth />}>
            <Route path="/select-house" element={<SelectHouseScreen />} />
            <Route path="/address" element={<PrivateAddressScreen />} />
            <Route element={<NeedHouse />}>
              <Route path="/app" element={<AppShell />}>
                <Route index element={<HomeScreen />} />
                <Route path="house" element={<BuildingScreen />} />
                <Route path="chats" element={<ChatsScreen />} />
                <Route path="chats/:chatId" element={<ChatsScreen />} />
                <Route path="topics" element={<TopicsScreen />} />
                <Route path="profile" element={<ProfileScreen />} />
                <Route path="tickets" element={<MyTicketsScreen />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Bootstrap>
    </BrowserRouter>
  )
}
