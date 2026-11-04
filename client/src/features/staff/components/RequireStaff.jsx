import { Navigate, useLocation } from 'react-router';

import { useStaffSession } from '../session';

/** Staff pages need a signed-in user; others go to sign-in and come back after. */
export function RequireStaff({ children }) {
  const session = useStaffSession();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/staff/login" replace state={{ from: location }} />;
  }
  return children;
}
