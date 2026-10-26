/**
 * Lead status (disposition) names shared across screens. Mirrors
 * buildflow-backend/src/config/constants.ts.
 *
 * Stored values never change, so no lead data had to be migrated:
 *   - 'Visit Done' is shown everywhere as "Virtual Meeting" (Oct 2026).
 *   - 'Interested' is retired: never offered as a choice, but leads and notes
 *     that already have it still display it.
 */

// Statuses a lead can be moved to, in pipeline order.
export const DISPOSITION_OPTIONS = [
  'New',
  'Contacted/Open',
  'Qualified',
  'Visit Done',
  'Meeting Done',
  'Negotiation Done',
  'Booking Done',
  'Agreement Done',
  'Prospect',
  'Future',
  'Failed',
]

export const LEGACY_DISPOSITIONS = ['Interested']

const DISPOSITION_LABELS: Record<string, string> = {
  'Visit Done': 'Virtual Meeting',
}

/** User-facing name for a stored status value. */
export const dispositionLabel = (value: string | null | undefined): string =>
  (value && DISPOSITION_LABELS[value]) || value || ''

// Where a "Meeting Done" meeting took place. 'VC' is the old virtual option,
// kept only for display on leads that already have it.
export type MeetingPlace = 'Client Place' | 'Office Place'
export const MEETING_PLACES: MeetingPlace[] = ['Client Place', 'Office Place']

export const isMeetingPlace = (value: unknown): value is MeetingPlace =>
  MEETING_PLACES.includes(value as MeetingPlace)
