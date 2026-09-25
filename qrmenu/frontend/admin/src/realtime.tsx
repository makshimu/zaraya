import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { tokenStore } from './api/client'
import type { Order, StaffCall } from './api/types'

interface RealtimeState {
  connected: boolean
  notificationsOn: boolean
  enableNotifications: () => Promise<void>
}

const RealtimeContext = createContext<RealtimeState>({
  connected: false,
  notificationsOn: false,
  enableNotifications: async () => {},
})

let audio: AudioContext | null = null

/** Short two-tone chime; no audio file to load. */
function chime() {
  audio ??= new AudioContext()
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
    () => typeof Notification !== 'undefined' && Notification.permission === 'granted',
  )
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    let ws: WebSocket | null = null
    let retry = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const alert = (title: string, body: string, tag: string) => {
      try {
        chime()
      } catch {
        /* audio blocked until the first click */
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        new Notification(title, { body, tag })
      }
    }
    const onNewOrder = (order: Order) =>
      alert(
        tRef.current('orders.newOrderTitle', { table: order.table_number }),
        tRef.current('orders.newOrderBody', { count: order.items.length }),
        `order-${order.id}`,
      )
    const onNewCall = (call: StaffCall) =>
      alert(
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
    audio ??= new AudioContext()
    await audio.resume() // user gesture: unlocks sound for later events
    if (typeof Notification !== 'undefined') {
      setNotificationsOn((await Notification.requestPermission()) === 'granted')
    }
  }, [])

  return (
    <RealtimeContext.Provider value={{ connected, notificationsOn, enableNotifications }}>
      {children}
    </RealtimeContext.Provider>
  )
}

export const useRealtime = () => useContext(RealtimeContext)
