import React from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

type UIContextType = {
  showAdd: boolean
  setShowAdd: (v: boolean) => void
}

const UIContext = React.createContext<UIContextType | null>(null)

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [showAdd, setShowAdd] = useLocalStorage<boolean>('ui-show-add', false)
  return <UIContext.Provider value={{ showAdd, setShowAdd }}>{children}</UIContext.Provider>
}

export function useUI() {
  const ctx = React.useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used within UIProvider')
  return ctx
}

export default UIContext
