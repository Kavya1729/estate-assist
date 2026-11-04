import { RequireStaff } from './RequireStaff';
import { StaffShell } from './StaffShell';

/** Signed-in staff pages: the guard, then the console shell around the page. */
export function StaffLayout() {
  return (
    <RequireStaff>
      <StaffShell />
    </RequireStaff>
  );
}
