import { getToken } from './api'

type RealtimeHandler = (event: Record<string, unknown>) => void

let socket: WebSocket | null = null
let handler: RealtimeHandler | null = null
let reconnectTimer: number | null = null
let pingTimer: number | null = null
let intentionalClose = false
let lastHouseId: string | null = null
let lastCompanyId: string | null = null

function wsUrl(token: string) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/server/ws?token=${encodeURIComponent(token)}`
}

function clearTimers() {
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (pingTimer) {
    window.clearInterval(pingTimer)
    pingTimer = null
  }
}

export function setRealtimeHandler(fn: RealtimeHandler | null) {
  handler = fn
}

export function syncRealtimeRooms(houseId?: string | null, companyId?: string | null) {
  lastHouseId = houseId || null
  lastCompanyId = companyId || null
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: 'sync',
        houseId: lastHouseId,
        companyId: lastCompanyId,
      }),
    )
  }
}

export function connectRealtime() {
  const token = getToken()
  if (!token) return
  intentionalClose = false

  if (
    socket
    && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  ) {
    return
  }

  try {
    socket = new WebSocket(wsUrl(token))
  } catch {
    scheduleReconnect()
    return
  }

  socket.onopen = () => {
    syncRealtimeRooms(lastHouseId, lastCompanyId)
    pingTimer = window.setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }))
      }
    }, 25000)
  }

  socket.onmessage = (ev) => {
    try {
      const data = JSON.parse(String(ev.data)) as Record<string, unknown>
      handler?.(data)
    } catch {
      /* ignore */
    }
  }

  socket.onclose = () => {
    clearTimers()
    socket = null
    if (!intentionalClose) scheduleReconnect()
  }

  socket.onerror = () => {
    try {
      socket?.close()
    } catch {
      /* ignore */
    }
  }
}

function scheduleReconnect() {
  if (intentionalClose || reconnectTimer) return
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    connectRealtime()
  }, 2000)
}

export function disconnectRealtime() {
  intentionalClose = true
  clearTimers()
  try {
    socket?.close()
  } catch {
    /* ignore */
  }
  socket = null
}

export function isRealtimeConnected() {
  return socket?.readyState === WebSocket.OPEN
}
