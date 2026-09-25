import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import type { GuestOrder } from './types'

/** Live updates: menu changes and this phone's order statuses. Reconnects with backoff and
 * refetches everything after every (re)connect, so nothing is missed while offline. */
export function useGuestRealtime(sessionKey: string | null | undefined) {
  const qc = useQueryClient()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // The socket's channels depend on the session cookie: wait until the session is known
    if (sessionKey === undefined) return
    let ws: WebSocket | null = null
    let retry = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${location.host}/api/guest/ws`)
      ws.onmessage = (e) => {
        const event = JSON.parse(e.data)
        if (event.type === 'hello' || event.type === 'resync') {
          retry = 0
          setConnected(true)
          qc.invalidateQueries()
        } else if (event.type === 'menu.changed') {
          qc.invalidateQueries({ queryKey: ['menu'] })
        } else if (event.type === 'order.updated') {
          const order: GuestOrder = event.order
          qc.setQueryData<GuestOrder[]>(['orders'], (list) =>
            list?.some((o) => o.id === order.id)
              ? list.map((o) => (o.id === order.id ? order : o))
              : [order, ...(list ?? [])],
          )
        }
      }
      ws.onclose = () => {
        setConnected(false)
        if (stopped) return
        timer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++))
      }
    }

    // Phones drop sockets in the background: reconnect as soon as the page is visible again
    const onVisible = () => {
      if (document.visibilityState === 'visible' && ws?.readyState === WebSocket.CLOSED) {
        clearTimeout(timer)
        retry = 0
        connect()
      }
    }

    connect()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      ws?.close()
    }
  }, [qc, sessionKey])

  return connected
}
