import { createContext, useContext, useEffect, useState } from 'react'
import { settingsAPI } from '../api/settings'
import type { FeatureControls } from '../api/settings'
import {
  DEFAULT_FEATURE_CONTROLS,
  FEATURE_CONTROLS_STORAGE_KEY,
  FEATURE_CONTROLS_UPDATED_EVENT,
  normalizeFeatureControls,
} from '../utils/featureControls'

const FeatureControlsContext = createContext<FeatureControls>(DEFAULT_FEATURE_CONTROLS)

/**
 * Reads the latest feature controls from localStorage (instant, no flash)
 * so the initial state is already correct before the API call returns.
 */
function readFromStorage(): FeatureControls {
  try {
    const stored = localStorage.getItem(FEATURE_CONTROLS_STORAGE_KEY)
    if (stored) return normalizeFeatureControls(JSON.parse(stored)?.featureControls)
  } catch {
    // ignore
  }
  return DEFAULT_FEATURE_CONTROLS
}

export function FeatureControlsProvider({ children }: { children: React.ReactNode }) {
  const [controls, setControls] = useState<FeatureControls>(readFromStorage)

  useEffect(() => {
    // Fetch fresh from server on mount
    settingsAPI
      .getAppConfig()
      .then((res) => {
        if (res.success) setControls(normalizeFeatureControls(res.data.featureControls))
      })
      .catch(() => {})

    // Listen for in-tab updates (Settings page saves)
    const handleFCUpdated = (e: Event) => {
      setControls(normalizeFeatureControls((e as CustomEvent).detail))
    }

    // Listen for cross-tab updates (other tabs change settings)
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== FEATURE_CONTROLS_STORAGE_KEY || !e.newValue) return
      try {
        setControls(normalizeFeatureControls(JSON.parse(e.newValue)?.featureControls))
      } catch {
        // ignore
      }
    }

    window.addEventListener(FEATURE_CONTROLS_UPDATED_EVENT, handleFCUpdated as EventListener)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener(FEATURE_CONTROLS_UPDATED_EVENT, handleFCUpdated as EventListener)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  return (
    <FeatureControlsContext.Provider value={controls}>
      {children}
    </FeatureControlsContext.Provider>
  )
}

/** Hook — use anywhere inside the app to read feature controls */
export const useFeatureControls = () => useContext(FeatureControlsContext)
