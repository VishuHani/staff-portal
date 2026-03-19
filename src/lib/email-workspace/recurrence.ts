import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export type EmailRecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export interface EmailRecurrenceRule {
  frequency: EmailRecurrenceFrequency;
  timezone: string;
  time: string; // HH:mm
  interval?: number; // defaults to 1
  weekdays?: number[]; // 0 (Sunday) - 6 (Saturday), weekly only
  monthDays?: number[]; // 1-31, monthly only
  startDate?: string; // YYYY-MM-DD in rule timezone
  endDate?: string; // YYYY-MM-DD in rule timezone
}

export interface RecurrenceValidationResult {
  valid: boolean;
  errors: string[];
}

const MAX_LOOKAHEAD_DAYS = 366 * 5;

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateOnly: string, days: number): string {
  const date = parseDateOnly(dateOnly);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

function differenceInDays(start: string, end: string): number {
  return Math.floor((parseDateOnly(end).getTime() - parseDateOnly(start).getTime()) / 86_400_000);
}

function differenceInMonths(start: string, end: string): number {
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);

  return (
    (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    (endDate.getUTCMonth() - startDate.getUTCMonth())
  );
}

function getDayOfWeek(dateOnly: string): number {
  return parseDateOnly(dateOnly).getUTCDay();
}

function getDayOfMonth(dateOnly: string): number {
  return parseDateOnly(dateOnly).getUTCDate();
}

function getDaysInMonth(dateOnly: string): number {
  const date = parseDateOnly(dateOnly);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = parseDateOnly(value);
  return formatDateOnly(parsed) === value;
}

function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function isValidTime(time: string): boolean {
  const match = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return Boolean(match);
}

function normalizeSortedUnique(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function resolveAnchorDate(rule: EmailRecurrenceRule, after: Date): string {
  if (rule.startDate) {
    return rule.startDate;
  }

  return formatInTimeZone(after, rule.timezone, "yyyy-MM-dd");
}

function matchesCadence(rule: EmailRecurrenceRule, candidateDate: string, anchorDate: string): boolean {
  const interval = Math.max(1, rule.interval ?? 1);

  if (rule.frequency === "DAILY") {
    return differenceInDays(anchorDate, candidateDate) % interval === 0;
  }

  if (rule.frequency === "WEEKLY") {
    const weekdays =
      rule.weekdays && rule.weekdays.length > 0
        ? normalizeSortedUnique(rule.weekdays)
        : [getDayOfWeek(anchorDate)];

    if (!weekdays.includes(getDayOfWeek(candidateDate))) {
      return false;
    }

    const weeksElapsed = Math.floor(differenceInDays(anchorDate, candidateDate) / 7);
    return weeksElapsed % interval === 0;
  }

  const monthDays =
    rule.monthDays && rule.monthDays.length > 0
      ? normalizeSortedUnique(rule.monthDays)
      : [getDayOfMonth(anchorDate)];

  const dayOfMonth = getDayOfMonth(candidateDate);
  const daysInMonth = getDaysInMonth(candidateDate);
  if (dayOfMonth > daysInMonth || !monthDays.includes(dayOfMonth)) {
    return false;
  }

  return differenceInMonths(anchorDate, candidateDate) % interval === 0;
}

export function validateRecurrenceRule(rule: EmailRecurrenceRule): RecurrenceValidationResult {
  const errors: string[] = [];

  if (!isValidTimezone(rule.timezone)) {
    errors.push("A valid IANA timezone is required.");
  }

  if (!isValidTime(rule.time)) {
    errors.push("Time must be in HH:mm (24-hour) format.");
  }

  if (rule.interval !== undefined && (!Number.isInteger(rule.interval) || rule.interval < 1)) {
    errors.push("Interval must be an integer greater than 0.");
  }

  if (rule.startDate && !isValidDateOnly(rule.startDate)) {
    errors.push("startDate must be YYYY-MM-DD.");
  }

  if (rule.endDate && !isValidDateOnly(rule.endDate)) {
    errors.push("endDate must be YYYY-MM-DD.");
  }

  if (rule.startDate && rule.endDate && rule.endDate < rule.startDate) {
    errors.push("endDate must be on or after startDate.");
  }

  if (rule.frequency === "WEEKLY" && rule.weekdays && rule.weekdays.some((d) => d < 0 || d > 6)) {
    errors.push("weekdays must contain numbers between 0 and 6.");
  }

  if (rule.frequency === "MONTHLY" && rule.monthDays && rule.monthDays.some((d) => d < 1 || d > 31)) {
    errors.push("monthDays must contain numbers between 1 and 31.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function getNextRunAt(rule: EmailRecurrenceRule, after: Date = new Date()): Date | null {
  const validation = validateRecurrenceRule(rule);
  if (!validation.valid) {
    return null;
  }

  const anchorDate = resolveAnchorDate(rule, after);
  const searchStartDate = formatInTimeZone(after, rule.timezone, "yyyy-MM-dd");
  const timeWithSeconds = `${rule.time}:00`;

  for (let dayOffset = 0; dayOffset <= MAX_LOOKAHEAD_DAYS; dayOffset += 1) {
    const candidateDate = addDays(searchStartDate, dayOffset);

    if (candidateDate < anchorDate) {
      continue;
    }

    if (rule.endDate && candidateDate > rule.endDate) {
      return null;
    }

    if (!matchesCadence(rule, candidateDate, anchorDate)) {
      continue;
    }

    const candidateUtc = fromZonedTime(`${candidateDate}T${timeWithSeconds}`, rule.timezone);

    if (candidateUtc.getTime() > after.getTime()) {
      return candidateUtc;
    }
  }

  return null;
}
