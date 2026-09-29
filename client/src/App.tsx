import { useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { MaxRequiredScreen, ConsentScreen } from './screens/Auth'
import { OnboardingScreen } from './screens/Onboarding'
import { AdminPanelScreen } from './screens/Admin'
import { ChatsScreen } from './screens/Chats'
import { FeedScreen } from './screens/Feed'
import { PrivateAddressScreen, SelectCompanyScreen } from './screens/House'
import { ProfileScreen } from './screens/Profile'
import { MyTicketsScreen } from './screens/Tickets'
import { AppShell } from './screens/Shell'
import { BuildingScreen } from './screens/Building'
import { ParkingScreen } from './screens/Parking'
import { TopicsScreen } from './screens/Topics'
import { UkPanelScreen } from './screens/UkPanel'
import { connectRealtime, disconnectRealtime, setRealtimeHandler, syncRealtimeRooms } from './realtime'
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

function NeedAuth() {
  const user = useUser()
  if (!user) return <MaxRequiredScreen />
  if (!user.consentAccepted) return <ConsentScreen />
  if (!user.onboardingComplete) return <OnboardingScreen />
  return <Outlet />
}

function OnboardingRoute() {
  const user = useUser()
  if (user?.onboardingComplete) return <Navigate to="/app" replace />
  return <OnboardingScreen />
}

function NeedHouse() {
  const user = useUser()
  const location = useLocation()
  if (!user?.consentAccepted) return <ConsentScreen />
  if (!user?.onboardingComplete) return <OnboardingScreen />
  if (user?.role === 'admin') return <Outlet />
  if (!user?.houseId && !user?.companyId) return <Navigate to="/onboarding" replace />
  if (!user?.houseId) return <Navigate to="/onboarding" replace />
  if (user.role === 'resident' && !user.skippedAddress && !user.street && !user.flat) {
    if (location.pathname !== '/address') return <Navigate to="/address" replace />
  }
  return <Outlet />
}

function HomeRedirect() {
  const user = useUser()
  if (!user) return <MaxRequiredScreen />
  if (!user.consentAccepted) return <ConsentScreen />
  if (!user.onboardingComplete) return <Navigate to="/onboarding" replace />
  if (user.role === 'admin') return <Navigate to="/app" replace />
  if (!user.houseId) return <Navigate to="/onboarding" replace />
  return <Navigate to="/app" replace />
}

function HomeScreen() {
  const user = useUser()
  if (user?.role === 'admin') return <AdminPanelScreen />
  if (user?.role === 'uk') return <UkPanelScreen />
  return <FeedScreen />
}

function Bootstrap({ children }: { children: React.ReactNode }) {
  const ready = useAppStore((s) => s.ready)
  const hydrate = useAppStore((s) => s.hydrate)
  const token = useAppStore((s) => s.token)
  const user = useUser()
  const handleRealtime = useAppStore((s) => s.handleRealtime)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    setRealtimeHandler(handleRealtime)
    return () => setRealtimeHandler(null)
  }, [handleRealtime])

  useEffect(() => {
    if (!ready || !token || !user) {
      disconnectRealtime()
      return
    }
    syncRealtimeRooms(user.houseId, user.companyId)
    connectRealtime()
    return () => disconnectRealtime()
  }, [ready, token, user?.id, user?.houseId, user?.companyId])

  if (!ready) {
    return (
      <div className="auth-page">
        <div className="muted">Загрузка профиля MAX…</div>
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
          <Route element={<NeedAuth />}>
            <Route path="/onboarding" element={<OnboardingRoute />} />
            <Route path="/select-uk" element={<SelectCompanyScreen />} />
            <Route path="/select-house" element={<Navigate to="/select-uk" replace />} />
            <Route path="/address" element={<PrivateAddressScreen />} />
            <Route element={<NeedHouse />}>
              <Route path="/app" element={<AppShell />}>
                <Route index element={<HomeScreen />} />
                <Route path="house" element={<BuildingScreen />} />
                <Route path="parking" element={<ParkingScreen />} />
                <Route path="chats" element={<ChatsScreen />} />
                <Route path="chats/:chatId" element={<ChatsScreen />} />
                <Route path="topics" element={<TopicsScreen />} />
                <Route path="profile" element={<ProfileScreen />} />
                <Route path="tickets" element={<MyTicketsScreen />} />
                <Route path="admin" element={<AdminPanelScreen />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Bootstrap>
    </BrowserRouter>
  )
}
