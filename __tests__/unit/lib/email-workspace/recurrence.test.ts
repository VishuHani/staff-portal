import { describe, expect, it } from "vitest";
import { getNextRunAt, validateRecurrenceRule } from "@/lib/email-workspace/recurrence";

describe("Email Recurrence Engine", () => {
  it("returns same-day daily run when target time is still ahead", () => {
    const next = getNextRunAt(
      {
        frequency: "DAILY",
        timezone: "UTC",
        time: "09:00",
      },
      new Date("2026-03-18T08:30:00.000Z")
    );

    expect(next?.toISOString()).toBe("2026-03-18T09:00:00.000Z");
  });

  it("returns next-day daily run when target time already passed", () => {
    const next = getNextRunAt(
      {
        frequency: "DAILY",
        timezone: "UTC",
        time: "09:00",
      },
      new Date("2026-03-18T10:30:00.000Z")
    );

    expect(next?.toISOString()).toBe("2026-03-19T09:00:00.000Z");
  });

  it("supports weekly rules across timezone offsets", () => {
    const next = getNextRunAt(
      {
        frequency: "WEEKLY",
        timezone: "America/New_York",
        time: "09:00",
        weekdays: [1], // Monday
        startDate: "2026-03-02",
      },
      new Date("2026-03-16T14:30:00.000Z")
    );

    expect(next?.toISOString()).toBe("2026-03-23T13:00:00.000Z");
  });

  it("supports monthly day-of-month rules and skips invalid months", () => {
    const next = getNextRunAt(
      {
        frequency: "MONTHLY",
        timezone: "UTC",
        time: "08:00",
        monthDays: [31],
        startDate: "2026-01-31",
      },
      new Date("2026-04-15T00:00:00.000Z")
    );

    expect(next?.toISOString()).toBe("2026-05-31T08:00:00.000Z");
  });

  it("returns null when rule endDate has elapsed", () => {
    const next = getNextRunAt(
      {
        frequency: "DAILY",
        timezone: "UTC",
        time: "10:00",
        endDate: "2026-03-20",
      },
      new Date("2026-03-20T11:00:00.000Z")
    );

    expect(next).toBeNull();
  });

  it("validates malformed rules", () => {
    const result = validateRecurrenceRule({
      frequency: "WEEKLY",
      timezone: "Invalid/Zone",
      time: "25:00",
      weekdays: [1, 9],
      interval: 0,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
