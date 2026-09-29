interface MaxWebAppUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

interface MaxWebApp {
  initData: string
  initDataUnsafe?: {
    user?: MaxWebAppUser
    auth_date?: number
    hash?: string
    start_param?: string
  }
  platform?: string
  version?: string
  ready?: () => void
  expand?: () => void
}

interface Window {
  WebApp?: MaxWebApp
}
