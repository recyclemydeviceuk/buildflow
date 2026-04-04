import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authAPI, User } from '../api/auth'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (token: string, userData: User) => void
  logout: () => void
  refreshUser: () => Promise<void>
  updateUser: (patch: Partial<User>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('token')
      if (!storedToken) {
        setIsLoading(false)
        return
      }
      
      try {
        const response = await authAPI.getMe()
        if (response.success && response.data) {
          setUser(response.data)
        } else {
          logout()
        }
      } catch (err) {
        console.error('Session restore failed:', err)
        logout()
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [])

  const refreshUser = async () => {
    const response = await authAPI.getMe()
    if (response.success && response.data) {
      setUser(response.data)
    } else {
      logout()
    }
  }

  const login = (newToken: string, userData: User) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  const updateUser = (patch: Partial<User>) => {
    setUser((current) => (current ? { ...current, ...patch } : current))
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
