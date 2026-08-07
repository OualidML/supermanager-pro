import React, { createContext, useContext, useState, useEffect } from 'react'

type AccessMode = 'owner' | 'employee'

interface AccessModeContextType {
  accessMode: AccessMode
  setAccessMode: (mode: AccessMode) => void
}

const AccessModeContext = createContext<AccessModeContextType | undefined>(undefined)

export function AccessModeProvider({ children }: { children: React.ReactNode }) {
  const [accessMode, setAccessModeState] = useState<AccessMode>(() => {
    const saved = localStorage.getItem('access_mode')
    return (saved === 'employee' ? 'employee' : 'owner') as AccessMode
  })

  const setAccessMode = (mode: AccessMode) => {
    setAccessModeState(mode)
    localStorage.setItem('access_mode', mode)
  }

  return (
    <AccessModeContext.Provider value={{ accessMode, setAccessMode }}>
      {children}
    </AccessModeContext.Provider>
  )
}

export function useAccessMode() {
  const context = useContext(AccessModeContext)
  if (!context) {
    throw new Error('useAccessMode must be used within an AccessModeProvider')
  }
  return context
}
