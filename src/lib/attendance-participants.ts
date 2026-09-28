/**
 * Joins the names of everyone sharing an outlet's shift session into one
 * display string — "sesi gabungan per shift" means the session itself is a
 * single unit (one check-in/check-out, one POS/report attribution), but up
 * to Outlet.maxPramuniagaPerShift people may be on it at once, so anywhere
 * that used to show a single roster name now shows all of them.
 */
export function formatParticipantNames(names: string[]): string {
  if (names.length === 0) return "-";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} & ${names[2]}`;
  return `${names[0]}, ${names[1]} & ${names.length - 2} lainnya`;
}
