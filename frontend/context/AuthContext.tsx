'use client'

import React, {
  createContext,
  useState,
  useEffect,
  ReactNode,
  Dispatch,
  SetStateAction
} from 'react'

interface User {
  id: string
  email: string
  name: string
  created_at: string
}

interface AuthContextType {
  user: User | null
  ready: boolean
  setUser: Dispatch<SetStateAction<User | null>>
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  ready: false,
  setUser: () => {}
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const API = process.env.NEXT_PUBLIC_API_BASE_URL

  useEffect(() => {
    fetch(`${API}/auth/me`, {
      credentials: 'include',
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((u: User) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setReady(true))
  }, [API])

  return (
    <AuthContext.Provider value={{ user, ready, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}
