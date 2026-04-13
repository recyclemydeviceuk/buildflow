import type { FeatureControls } from '../api/settings'

export const DEFAULT_FEATURE_CONTROLS: FeatureControls = {
  manualAssignment: true,
  dialer: true,
  callRecording: true,
  duplicateDetection: true,
  autoQueueing: true,
  smsEnabled: false,
  whatsappEnabled: false,
  followUpReminders: true,
  exportLeads: true,
  bulkEdit: true,
  auditLog: true,
  analyticsAccess: true,
  representativeCanDelete: false,
}

export const FEATURE_CONTROLS_STORAGE_KEY = 'buildflow:feature-controls'
export const FEATURE_CONTROLS_UPDATED_EVENT = 'buildflow:feature-controls-updated'

const bool = (val: unknown, fallback: boolean): boolean =>
  typeof val === 'boolean' ? val : fallback

export const normalizeFeatureControls = (raw?: Partial<FeatureControls> | null): FeatureControls => ({
  manualAssignment: bool(raw?.manualAssignment, DEFAULT_FEATURE_CONTROLS.manualAssignment),
  dialer: bool(raw?.dialer, DEFAULT_FEATURE_CONTROLS.dialer),
  callRecording: bool(raw?.callRecording, DEFAULT_FEATURE_CONTROLS.callRecording),
  duplicateDetection: bool(raw?.duplicateDetection, DEFAULT_FEATURE_CONTROLS.duplicateDetection),
  autoQueueing: bool(raw?.autoQueueing, DEFAULT_FEATURE_CONTROLS.autoQueueing),
  smsEnabled: bool(raw?.smsEnabled, DEFAULT_FEATURE_CONTROLS.smsEnabled),
  whatsappEnabled: bool(raw?.whatsappEnabled, DEFAULT_FEATURE_CONTROLS.whatsappEnabled),
  followUpReminders: bool(raw?.followUpReminders, DEFAULT_FEATURE_CONTROLS.followUpReminders),
  exportLeads: bool(raw?.exportLeads, DEFAULT_FEATURE_CONTROLS.exportLeads),
  bulkEdit: bool(raw?.bulkEdit, DEFAULT_FEATURE_CONTROLS.bulkEdit),
  auditLog: bool(raw?.auditLog, DEFAULT_FEATURE_CONTROLS.auditLog),
  analyticsAccess: bool(raw?.analyticsAccess, DEFAULT_FEATURE_CONTROLS.analyticsAccess),
  representativeCanDelete: bool(raw?.representativeCanDelete, DEFAULT_FEATURE_CONTROLS.representativeCanDelete),
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
