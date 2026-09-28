import { checkpointTimes, DEFAULT_ATTENDANCE_POLICY } from "@/lib/policy";

describe("checkpointTimes", () => {
  it("generates 23 checkpoints for the default 09:00-20:00 / 30-minute policy", () => {
    const times = checkpointTimes(DEFAULT_ATTENDANCE_POLICY);
    expect(times).toHaveLength(23);
    expect(times[0]).toBe("09:00");
    expect(times[times.length - 1]).toBe("20:00");
  });

  it("adapts to a custom policy", () => {
    const times = checkpointTimes({ checkpointStartHour: 10, checkpointEndHour: 12, checkpointIntervalMinutes: 60 });
    expect(times).toEqual(["10:00", "11:00", "12:00"]);
  });
});
