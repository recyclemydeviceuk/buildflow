import type { FeatureControls } from '../api/settings'

export const DEFAULT_FEATURE_CONTROLS: FeatureControls = {
  manualAssignment: true,
  dialer: true,
  callRecording: true,
}

export const FEATURE_CONTROLS_STORAGE_KEY = 'buildflow:feature-controls'
export const FEATURE_CONTROLS_UPDATED_EVENT = 'buildflow:feature-controls-updated'

export const normalizeFeatureControls = (raw?: Partial<FeatureControls> | null): FeatureControls => ({
  manualAssignment:
    typeof raw?.manualAssignment === 'boolean'
      ? raw.manualAssignment
      : DEFAULT_FEATURE_CONTROLS.manualAssignment,
  dialer: typeof raw?.dialer === 'boolean' ? raw.dialer : DEFAULT_FEATURE_CONTROLS.dialer,
  callRecording:
    typeof raw?.callRecording === 'boolean' ? raw.callRecording : DEFAULT_FEATURE_CONTROLS.callRecording,
})

export const broadcastFeatureControlsUpdated = (featureControls: FeatureControls) => {
  const normalized = normalizeFeatureControls(featureControls)

  window.localStorage.setItem(
    FEATURE_CONTROLS_STORAGE_KEY,
    JSON.stringify({ featureControls: normalized, updatedAt: Date.now() })
  )
  window.dispatchEvent(
    new CustomEvent(FEATURE_CONTROLS_UPDATED_EVENT, {
      detail: normalized,
    })
  )
}
