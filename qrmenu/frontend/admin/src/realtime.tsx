import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { tokenStore } from './api/client'
import type { Order, StaffCall } from './api/types'

/** A new order or call, shown as a pop-up in the corner of any admin page. */
export interface LiveAlert {
  id: string
  kind: 'order' | 'call'
  title: string
  body: string
}

interface RealtimeState {
  connected: boolean
  soundOn: boolean
  notificationsOn: boolean
  enableNotifications: () => Promise<void>
  alerts: LiveAlert[]
  dismissAlert: (id: string) => void
}

const RealtimeContext = createContext<RealtimeState>({
  connected: false,
  soundOn: false,
  notificationsOn: false,
  enableNotifications: async () => {},
  alerts: [],
  dismissAlert: () => {},
})

const ALERT_MS = 10_000
const notificationsSupported = typeof Notification !== 'undefined'

// Browsers keep sound off until the page gets a click or key press; the context is created at
// once and resumed by the first interaction anywhere, not only by the "enable" button
let audio: AudioContext | null = null
function getAudio() {
  audio ??= new AudioContext()
  return audio
}

/** Short two-tone chime; no audio file to load. */
function chime() {
  const audio = getAudio()
  if (audio.state === 'suspended') void audio.resume()
  const now = audio.currentTime
  for (const [i, freq] of [880, 1320].entries()) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, now + i * 0.18)
    gain.gain.exponentialRampToValueAtTime(0.3, now + i * 0.18 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.35)
    osc.connect(gain).connect(audio.destination)
    osc.start(now + i * 0.18)
    osc.stop(now + i * 0.18 + 0.4)
  }
}

/**
 * Staff live feed. Events only say "something changed": lists refetch over REST. After every
 * (re)connect all queries refetch, so nothing is lost while the socket was down.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const [connected, setConnected] = useState(false)
  const [notificationsOn, setNotificationsOn] = useState(
    () => !notificationsSupported || Notification.permission !== 'default',
  )
  const [soundOn, setSoundOn] = useState(() => getAudio().state === 'running')
  const [alerts, setAlerts] = useState<LiveAlert[]>([])
  const tRef = useRef(t)
  tRef.current = t

  const dismissAlert = useCallback((id: string) => setAlerts((list) => list.filter((a) => a.id !== id)), [])

  useEffect(() => {
    const audio = getAudio()
    const sync = () => setSoundOn(audio.state === 'running')
    const unlock = () => void audio.resume().then(sync)
    audio.addEventListener('statechange', sync)
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      audio.removeEventListener('statechange', sync)
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    let ws: WebSocket | null = null
    let retry = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const alert = (kind: LiveAlert['kind'], title: string, body: string, tag: string) => {
      try {
        chime()
      } catch {
        /* no audio on this device */
      }
      setAlerts((list) => [{ id: tag, kind, title, body }, ...list.filter((a) => a.id !== tag)].slice(0, 4))
      setTimeout(() => setAlerts((list) => list.filter((a) => a.id !== tag)), ALERT_MS)
      // Another tab or window in front: the system notification is what gets noticed
      if (notificationsSupported && Notification.permission === 'granted' && document.hidden) {
        new Notification(title, { body, tag })
      }
    }
    const onNewOrder = (order: Order) =>
      alert(
        'order',
        tRef.current('orders.newOrderTitle', { table: order.table_number }),
        tRef.current('orders.newOrderBody', { count: order.items.length }),
        `order-${order.id}`,
      )
    const onNewCall = (call: StaffCall) =>
      alert(
        'call',
        tRef.current(`hall.callTitle.${call.type}`, { table: call.table_number }),
        call.payment_method ? tRef.current(`hall.pay.${call.payment_method}`) : '',
        `call-${call.id}`,
      )
    // Anything about orders, calls or sessions changes the hall screen
    const invalidateHall = () => ['hall', 'visit', 'calls'].forEach((key) => qc.invalidateQueries({ queryKey: [key] }))

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${location.host}/api/admin/ws?token=${encodeURIComponent(tokenStore.get() ?? '')}`)
      ws.onmessage = (e) => {
        const event = JSON.parse(e.data)
        switch (event.type) {
          case 'hello':
          case 'resync':
            retry = 0
            setConnected(true)
            qc.invalidateQueries()
            break
          case 'order.created':
            qc.invalidateQueries({ queryKey: ['orders'] })
            invalidateHall()
            onNewOrder(event.order)
            break
          case 'order.updated':
            qc.invalidateQueries({ queryKey: ['orders'] })
            invalidateHall()
            break
          case 'call.created':
            invalidateHall()
            onNewCall(event.call)
            break
          case 'call.updated':
          case 'table.updated':
            invalidateHall()
            break
          case 'menu.changed':
            qc.invalidateQueries({ queryKey: ['menu'] })
            break
        }
      }
      ws.onclose = (e) => {
        setConnected(false)
        if (stopped || e.code === 4401) return // 4401: token no longer valid, the app logs out
        timer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++))
      }
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(timer)
      ws?.close()
    }
  }, [qc])

  const enableNotifications = useCallback(async () => {
    await getAudio().resume() // user gesture: unlocks sound for later events
    setSoundOn(getAudio().state === 'running')
    chime() // so staff hear what a new order sounds like
    if (notificationsSupported && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    setNotificationsOn(true)
  }, [])

  return (
    <RealtimeContext.Provider
      value={{ connected, soundOn, notificationsOn, enableNotifications, alerts, dismissAlert }}
    >
      {children}
    </RealtimeContext.Provider>
  )
}

export const useRealtime = () => useContext(RealtimeContext)
