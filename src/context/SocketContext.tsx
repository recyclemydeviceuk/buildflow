import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

interface SocketContextType {
  socket: Socket | null
  connected: boolean
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL || 'http://localhost:5000'

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect()
        setSocket(null)
        setConnected(false)
      }
      return
    }

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    })

    newSocket.on('connect', () => {
      console.log('Socket connected')
      setConnected(true)
      newSocket.emit('join:user', user.id)
      newSocket.emit('join:team', 'all') // Default team room
    })

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected')
      setConnected(false)
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [token, user?.id])

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
