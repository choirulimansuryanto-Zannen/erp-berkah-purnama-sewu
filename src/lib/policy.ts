// Defaults mirror prd.md §1.2 (checkpoints 09:00-20:00 every 30 min) and
// §5.3 (leave entitlements) until HRGA configures otherwise via /hrga.
export const DEFAULT_ATTENDANCE_POLICY = {
  checkpointStartHour: 9,
  checkpointEndHour: 20,
  checkpointIntervalMinutes: 30,
  gracePeriodMinutes: 15,
  annualLeaveDays: 12,
  sickLeaveDays: 12,
  personalLeaveDays: 3,
};

export function checkpointTimes(policy: {
  checkpointStartHour: number;
  checkpointEndHour: number;
  checkpointIntervalMinutes: number;
}): string[] {
  const times: string[] = [];
  const totalMinutes = (policy.checkpointEndHour - policy.checkpointStartHour) * 60;
  for (let m = 0; m <= totalMinutes; m += policy.checkpointIntervalMinutes) {
    const hour = policy.checkpointStartHour + Math.floor(m / 60);
    const minute = m % 60;
    times.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
  return times;
}
