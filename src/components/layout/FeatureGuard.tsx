import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useFeatureControls } from '../../context/FeatureControlsContext'
import type { FeatureControls } from '../../api/settings'

interface Props {
  /** The feature control key that must be true for access */
  feature: keyof FeatureControls
  /** Optional: where to redirect when the feature is off. Defaults to user home. */
  redirectTo?: string
  children: React.ReactNode
}

/**
 * Route-level guard. Redirects to home (or redirectTo) if the given
 * feature control is disabled — even if the user types the URL directly.
 */
export default function FeatureGuard({ feature, redirectTo, children }: Props) {
  const { user } = useAuth()
  const controls = useFeatureControls()
  const home = user?.role === 'manager' ? '/dashboard' : '/agent'

  if (!controls[feature]) {
    return <Navigate to={redirectTo ?? home} replace />
  }

  return <>{children}</>
}
