/**
 * Pay Calculator Utilities
 * Calculate shift pay based on hourly rates, day type, overtime, and late hours
 * 
 * CONFIDENTIAL: Pay rate calculations should only be exposed to ADMIN/MANAGER roles
 */

import { Decimal } from "@prisma/client/runtime/library";

// ============================================================================
// TYPES
// ============================================================================

export interface ShiftPayInput {
  date: Date;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  breakMinutes: number;
}

export interface StaffPayRates {
  weekdayRate: Decimal | number | null | unknown;
  saturdayRate: Decimal | number | null | unknown;
  sundayRate: Decimal | number | null | unknown;
  publicHolidayRate?: Decimal | number | null | unknown;
  overtimeRate?: Decimal | number | null | unknown;
  lateRate?: Decimal | number | null | unknown;
}

export interface VenuePayConfig {
  defaultWeekdayRate: Decimal | number | null | unknown;
  defaultSaturdayRate: Decimal | number | null | unknown;
  defaultSundayRate: Decimal | number | null | unknown;
  defaultPublicHolidayRate: Decimal | number | null | unknown;
  defaultOvertimeRate: Decimal | number | null | unknown;
  defaultLateRate: Decimal | number | null | unknown;
  overtimeThresholdHours: number;
  overtimeMultiplier: Decimal | number | null | unknown;
  lateStartHour: number;
  autoCalculateBreaks: boolean;
  breakThresholdHours: number;
  defaultBreakMinutes: number;
  publicHolidayRegion: string | null;
  customPublicHolidays: string[] | null; // Array of date strings
  // Superannuation settings
  superRate: Decimal | number | null | unknown;
  superEnabled: boolean;
}

// ============================================================================
// SUPERANNUATION TYPES
// ============================================================================

/**
 * Superannuation configuration for a staff member
 */
export interface SuperConfig {
  enabled: boolean;
  rate: number;  // e.g., 0.115 for 11.5%
}

/**
 * User-level superannuation settings (overrides venue default)
 */
export interface UserSuperSettings {
  superEnabled: boolean | null;  // null = use venue default
  customSuperRate: Decimal | number | null | unknown;
}

/**
 * Extended shift pay breakdown including superannuation
 */
export interface ShiftPayBreakdownWithSuper extends ShiftPayBreakdown {
  superPay: number;        // Super amount for this shift
  superRate: number;       // Rate applied
  grossPay: number;        // Total pay before super
  totalCost: number;       // grossPay + superPay
}

/**
 * Daily pay summary with superannuation
 */
export interface DailyPaySummary {
  date: Date;
  dateKey: string;
  totalHours: number;
  basePay: number;
  overtimePay: number;
  latePay: number;
  grossPay: number;        // Total wage
  superPay: number;        // Superannuation amount
  totalCost: number;       // grossPay + superPay
  shiftCount: number;
}

/**
 * Staff pay summary with superannuation
 */
export interface StaffPaySummary {
  staffId: string;
  staffName: string;
  totalHours: number;
  basePay: number;
  overtimePay: number;
  latePay: number;
  grossPay: number;        // Total wage
  superPay: number;        // Superannuation amount
  totalCost: number;       // grossPay + superPay
  superEnabled: boolean;
  superRate: number;
}

/**
 * Weekly pay summary with full breakdown
 */
export interface WeeklyPaySummary {
  totalHours: number;
  basePay: number;
  overtimePay: number;
  latePay: number;
  grossPay: number;        // Total wage before super
  superPay: number;        // Total superannuation
  totalCost: number;       // grossPay + superPay
  superRate: number;       // Average or venue default rate
  dailyBreakdown: DailyPaySummary[];
  staffBreakdown: StaffPaySummary[];
}

export interface CustomRate {
  name: string;
  startDate: Date;
  endDate: Date;
  rateType: "FIXED" | "MULTIPLIER";
  fixedRate: Decimal | number | null | unknown;
  multiplier: Decimal | number | null | unknown;
  startTime: string | null;
  endTime: string | null;
  isRecurring: boolean;
}

export interface ShiftPayBreakdown {
  baseHours: number;
  basePay: number;
  overtimeHours: number;
  overtimePay: number;
  lateHours: number;
  latePay: number;
  totalHours: number;
  totalPay: number;
  rateType: "WEEKDAY" | "SATURDAY" | "SUNDAY" | "PUBLIC_HOLIDAY" | "CUSTOM";
  appliedRates: {
    base: number;
    overtime?: number;
    late?: number;
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert Decimal to number safely
 */
function toNumber(value: Decimal | number | null | unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return (value as Decimal).toNumber();
  }
  return null;
}

/**
 * Check if a time string is valid (HH:mm format)
 */
function isValidTime(time: string): boolean {
  if (!time || typeof time !== "string") return false;
  if (time === "-" || time === "") return false;
  const parts = time.split(":");
  if (parts.length !== 2) return false;
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  return !isNaN(hour) && !isNaN(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

/**
 * Parse time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

// ============================================================================
// SHIFT HOURS CALCULATION
// ============================================================================

/**
 * Calculate shift duration in hours
 */
export function calculateShiftHours(
  startTime: string,
  endTime: string,
  breakMinutes: number = 0
): number {
  // Return 0 for invalid times
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return 0;
  }

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  let totalMinutes = endH * 60 + endM - (startH * 60 + startM);

  // Handle overnight shifts
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }

  const workMinutes = totalMinutes - breakMinutes;
  return Math.max(0, workMinutes / 60);
}

// ============================================================================
// RATE DETERMINATION
// ============================================================================

/**
 * Get the day type for a given date
 */
export function getDayType(date: Date): "WEEKDAY" | "SATURDAY" | "SUNDAY" {
  const dayOfWeek = new Date(date).getDay();
  if (dayOfWeek === 0) return "SUNDAY";
  if (dayOfWeek === 6) return "SATURDAY";
  return "WEEKDAY";
}

/**
 * Format date as YYYY-MM-DD for comparison
 */
function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

/**
 * Check if a date is a public holiday
 * TODO: Integrate with actual public holiday API or database
 */
export function isPublicHoliday(
  date: Date,
  region: string = "NSW",
  customHolidays: string[] = []
): boolean {
  const dateStr = formatDate(date);
  
  // Check custom public holidays first
  if (customHolidays.includes(dateStr)) {
    return true;
  }
  
  // Common Australian public holidays (simplified - should use proper API)
  // This is a placeholder - in production, use a proper holiday library or API
  const year = new Date(date).getFullYear();
  const month = new Date(date).getMonth();
  const day = new Date(date).getDate();
  const dayOfWeek = new Date(date).getDay();
  
  // Fixed date holidays
  const fixedHolidays = [
    { month: 0, day: 1 },   // New Year's Day
    { month: 0, day: 26 },  // Australia Day
    { month: 3, day: 25 },  // ANZAC Day
    { month: 11, day: 25 }, // Christmas Day
    { month: 11, day: 26 }, // Boxing Day
  ];
  
  for (const holiday of fixedHolidays) {
    if (month === holiday.month && day === holiday.day) {
      return true;
    }
  }
  
  // Variable date holidays (simplified calculations)
  // Queen's/King's Birthday - second Monday in June (most states)
  if (month === 5 && dayOfWeek === 1 && day >= 8 && day <= 14) {
    return true;
  }
  
  // Labour Day - first Monday in October (NSW, ACT, SA)
  if (region === "NSW" && month === 9 && dayOfWeek === 1 && day <= 7) {
    return true;
  }
  
  return false;
}

/**
 * Find applicable custom rate for a date
 */
export function findCustomRate(
  date: Date,
  customRates: CustomRate[],
  time?: string
): CustomRate | null {
  const dateStr = formatDate(date);
  const checkDate = new Date(date);
  
  for (const rate of customRates) {
    const startDate = formatDate(rate.startDate);
    const endDate = formatDate(rate.endDate);
    
    // Check if date falls within range
    let matches = dateStr >= startDate && dateStr <= endDate;
    
    // For recurring rates, check month/day match
    if (rate.isRecurring) {
      const rateStartMonth = new Date(rate.startDate).getMonth();
      const rateStartDay = new Date(rate.startDate).getDate();
      const rateEndMonth = new Date(rate.endDate).getMonth();
      const rateEndDay = new Date(rate.endDate).getDate();
      
      const currentMonth = checkDate.getMonth();
      const currentDay = checkDate.getDate();
      
      if (rateStartMonth === rateEndMonth) {
        // Same month range
        matches = currentMonth === rateStartMonth && 
                  currentDay >= rateStartDay && 
                  currentDay <= rateEndDay;
      } else {
        // Cross-month range
        matches = (currentMonth === rateStartMonth && currentDay >= rateStartDay) ||
                  (currentMonth === rateEndMonth && currentDay <= rateEndDay);
      }
    }
    
    if (!matches) continue;
    
    // Check time restrictions if specified
    if (time && rate.startTime && rate.endTime) {
      const timeMins = timeToMinutes(time);
      const startMins = timeToMinutes(rate.startTime);
      const endMins = timeToMinutes(rate.endTime);
      
      if (timeMins < startMins || timeMins > endMins) {
        continue;
      }
    }
    
    return rate;
  }
  
  return null;
}

/**
 * Get the applicable base pay rate for a given date
 */
export function getApplicableRate(
  date: Date,
  rates: StaffPayRates,
  venueConfig?: VenuePayConfig | null,
  customRates?: CustomRate[]
): { rate: number | null; rateType: ShiftPayBreakdown["rateType"] } {
  // Check for custom rate first
  if (customRates && customRates.length > 0) {
    const customRate = findCustomRate(date, customRates);
    if (customRate) {
      if (customRate.rateType === "FIXED") {
        const rate = toNumber(customRate.fixedRate);
        if (rate !== null) {
          return { rate, rateType: "CUSTOM" };
        }
      }
    }
  }
  
  // Check for public holiday
  const region = venueConfig?.publicHolidayRegion || "NSW";
  const customHolidays = venueConfig?.customPublicHolidays || [];
  
  if (isPublicHoliday(date, region, customHolidays)) {
    // Try user's public holiday rate, then venue default
    let rate = toNumber(rates.publicHolidayRate);
    if (rate === null && venueConfig) {
      rate = toNumber(venueConfig.defaultPublicHolidayRate);
    }
    if (rate !== null) {
      return { rate, rateType: "PUBLIC_HOLIDAY" };
    }
  }
  
  // Standard day rates
  const dayType = getDayType(date);
  
  switch (dayType) {
    case "SUNDAY":
      const sundayRate = toNumber(rates.sundayRate) ?? toNumber(venueConfig?.defaultSundayRate);
      return { rate: sundayRate, rateType: "SUNDAY" };
    case "SATURDAY":
      const saturdayRate = toNumber(rates.saturdayRate) ?? toNumber(venueConfig?.defaultSaturdayRate);
      return { rate: saturdayRate, rateType: "SATURDAY" };
    default:
      const weekdayRate = toNumber(rates.weekdayRate) ?? toNumber(venueConfig?.defaultWeekdayRate);
      return { rate: weekdayRate, rateType: "WEEKDAY" };
  }
}

// ============================================================================
// OVERTIME CALCULATION
// ============================================================================

/**
 * Calculate overtime hours and pay
 */
export function calculateOvertime(
  totalHours: number,
  baseRate: number,
  config: VenuePayConfig
): { overtimeHours: number; overtimePay: number; overtimeRate: number } {
  const threshold = config.overtimeThresholdHours || 8;
  const overtimeHours = Math.max(0, totalHours - threshold);
  
  if (overtimeHours <= 0) {
    return { overtimeHours: 0, overtimePay: 0, overtimeRate: 0 };
  }
  
  // Calculate overtime rate: either fixed rate or multiplier
  let overtimeRate = toNumber(config.defaultOvertimeRate);
  
  if (overtimeRate === null) {
    // Use multiplier
    const multiplier = toNumber(config.overtimeMultiplier) ?? 1.5;
    overtimeRate = baseRate * multiplier;
  }
  
  const overtimePay = overtimeHours * overtimeRate;
  
  return {
    overtimeHours,
    overtimePay: Math.round(overtimePay * 100) / 100,
    overtimeRate
  };
}

// ============================================================================
// LATE HOURS CALCULATION
// ============================================================================

/**
 * Calculate late hours (hours worked after lateStartHour)
 */
export function calculateLateHours(
  startTime: string,
  endTime: string,
  lateStartHour: number = 22
): number {
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return 0;
  }
  
  const startMins = timeToMinutes(startTime);
  let endMins = timeToMinutes(endTime);
  
  // Handle overnight shifts
  if (endMins < startMins) {
    endMins += 24 * 60;
  }
  
  const lateStartMins = lateStartHour * 60;
  const lateEndMins = 24 * 60; // Midnight
  
  // Calculate overlap with late hours
  let lateMinutes = 0;
  
  // First day late hours
  if (startMins < lateEndMins) {
    const effectiveStart = Math.max(startMins, lateStartMins);
    const effectiveEnd = Math.min(endMins, lateEndMins);
    if (effectiveEnd > effectiveStart) {
      lateMinutes += effectiveEnd - effectiveStart;
    }
  }
  
  // Second day late hours (for overnight shifts extending past midnight)
  if (endMins > 24 * 60) {
    const secondDayEnd = endMins - 24 * 60;
    if (secondDayEnd > lateStartMins) {
      lateMinutes += Math.min(secondDayEnd, lateEndMins) - lateStartMins;
    } else if (secondDayEnd <= 6 * 60) {
      // Early morning hours (midnight to 6am) are also considered late
      lateMinutes += secondDayEnd;
    }
  }
  
  return lateMinutes / 60;
}

/**
 * Calculate late hours pay
 */
export function calculateLatePay(
  startTime: string,
  endTime: string,
  baseRate: number,
  config: VenuePayConfig
): { lateHours: number; latePay: number; lateRate: number } {
  const lateStartHour = config.lateStartHour || 22;
  const lateHours = calculateLateHours(startTime, endTime, lateStartHour);
  
  if (lateHours <= 0) {
    return { lateHours: 0, latePay: 0, lateRate: 0 };
  }
  
  // Calculate late rate
  let lateRate = toNumber(config.defaultLateRate);
  
  if (lateRate === null) {
    // Default to base rate + 25% if no late rate configured
    lateRate = baseRate * 1.25;
  }
  
  const latePay = lateHours * lateRate;
  
  return {
    lateHours,
    latePay: Math.round(latePay * 100) / 100,
    lateRate
  };
}

// ============================================================================
// BREAK CALCULATION
// ============================================================================

export interface BreakRule {
  name: string;
  minShiftHours: number;
  maxShiftHours: number | null;
  breakMinutes: number;
  isPaid: boolean;
  additionalBreakMinutes: number | null;
  additionalBreakThreshold: number | null;
  priority: number;
  isDefault: boolean;
  isActive?: boolean;
}

/**
 * Calculate break minutes based on shift duration and rules
 */
export function calculateBreakMinutes(
  shiftHours: number,
  rules: BreakRule[],
  defaultBreakMinutes: number = 30
): number {
  // Sort rules by priority (highest first)
  const sortedRules = [...rules]
    .filter(r => r.isActive !== false)
    .sort((a, b) => b.priority - a.priority);
  
  for (const rule of sortedRules) {
    const meetsMin = shiftHours >= rule.minShiftHours;
    const meetsMax = rule.maxShiftHours === null || shiftHours < rule.maxShiftHours;
    
    if (meetsMin && meetsMax) {
      let totalBreak = rule.breakMinutes;
      
      // Add additional break if threshold met
      if (rule.additionalBreakThreshold && rule.additionalBreakMinutes) {
        if (shiftHours >= rule.additionalBreakThreshold) {
          totalBreak += rule.additionalBreakMinutes;
        }
      }
      
      return totalBreak;
    }
  }
  
  // Return default if no rule matches
  return defaultBreakMinutes;
}

// ============================================================================
// MAIN PAY CALCULATION
// ============================================================================

/**
 * Calculate comprehensive pay breakdown for a single shift
 */
export function calculateShiftPayBreakdown(
  shift: ShiftPayInput,
  rates: StaffPayRates,
  venueConfig?: VenuePayConfig | null,
  customRates?: CustomRate[]
): ShiftPayBreakdown | null {
  // Get base rate and type
  const { rate: baseRate, rateType } = getApplicableRate(
    shift.date,
    rates,
    venueConfig,
    customRates
  );
  
  if (baseRate === null) {
    return null;
  }
  
  // Calculate total hours
  const totalHours = calculateShiftHours(
    shift.startTime,
    shift.endTime,
    shift.breakMinutes
  );
  
  // Calculate base pay (without overtime/late adjustments)
  const baseHours = Math.min(totalHours, venueConfig?.overtimeThresholdHours ?? 8);
  const basePay = baseHours * baseRate;
  
  // Calculate overtime
  let overtimeHours = 0;
  let overtimePay = 0;
  let overtimeRate = 0;
  
  if (venueConfig) {
    const overtime = calculateOvertime(totalHours, baseRate, venueConfig);
    overtimeHours = overtime.overtimeHours;
    overtimePay = overtime.overtimePay;
    overtimeRate = overtime.overtimeRate;
  }
  
  // Calculate late hours pay
  let lateHours = 0;
  let latePay = 0;
  let lateRate = 0;
  
  if (venueConfig) {
    const late = calculateLatePay(
      shift.startTime,
      shift.endTime,
      baseRate,
      venueConfig
    );
    lateHours = late.lateHours;
    latePay = late.latePay;
    lateRate = late.lateRate;
  }
  
  // Calculate total pay
  // Note: Late hours are already included in totalHours, so we add the differential
  const lateDifferential = latePay - (lateHours * baseRate);
  const totalPay = basePay + overtimePay + Math.max(0, lateDifferential);
  
  return {
    baseHours,
    basePay: Math.round(basePay * 100) / 100,
    overtimeHours,
    overtimePay,
    lateHours,
    latePay,
    totalHours,
    totalPay: Math.round(totalPay * 100) / 100,
    rateType,
    appliedRates: {
      base: baseRate,
      overtime: overtimeRate || undefined,
      late: lateRate || undefined
    }
  };
}

/**
 * Calculate simple pay for a single shift (backward compatible)
 */
export function calculateShiftPay(
  shift: ShiftPayInput,
  rates: StaffPayRates
): number | null {
  const rate = getApplicableRate(shift.date, rates);
  
  if (rate.rate === null) return null;
  
  const hours = calculateShiftHours(
    shift.startTime,
    shift.endTime,
    shift.breakMinutes
  );
  
  return Math.round(hours * rate.rate * 100) / 100;
}

/**
 * Calculate total pay for multiple shifts with breakdown
 */
export function calculateTotalPay(
  shifts: ShiftPayInput[],
  rates: StaffPayRates,
  venueConfig?: VenuePayConfig | null,
  customRates?: CustomRate[]
): { 
  total: number | null; 
  breakdown: { 
    hours: number; 
    pay: number | null;
    detailedBreakdown?: ShiftPayBreakdown;
  }[] 
} {
  const breakdown = shifts.map((shift) => {
    const hours = calculateShiftHours(
      shift.startTime,
      shift.endTime,
      shift.breakMinutes
    );
    
    const detailedBreakdown = venueConfig 
      ? calculateShiftPayBreakdown(shift, rates, venueConfig, customRates)
      : null;
    
    const pay = detailedBreakdown 
      ? detailedBreakdown.totalPay 
      : calculateShiftPay(shift, rates);
    
    return {
      hours,
      pay,
      detailedBreakdown: detailedBreakdown || undefined
    };
  });
  
  // If any shift has null pay (no rate), return null for total
  if (breakdown.some((b) => b.pay === null)) {
    const totalHours = breakdown.reduce((sum, b) => sum + b.hours, 0);
    return { total: null, breakdown };
  }
  
  const total = breakdown.reduce((sum, b) => sum + (b.pay || 0), 0);
  return { total: Math.round(total * 100) / 100, breakdown };
}

/**
 * Calculate total hours for multiple shifts
 */
export function calculateTotalHours(shifts: ShiftPayInput[]): number {
  return shifts.reduce(
    (sum, shift) =>
      sum +
      calculateShiftHours(shift.startTime, shift.endTime, shift.breakMinutes),
    0
  );
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format currency for display
 */
export function formatCurrency(amount: number | null): string {
  if (amount === null) return "N/A";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format hours for display (e.g., "22.5h")
 */
export function formatHours(hours: number): string {
  if (isNaN(hours) || hours === 0) return "0h";
  if (hours % 1 === 0) return `${hours}h`;
  return `${hours.toFixed(1)}h`;
}

/**
 * Convert 24-hour time to 12-hour format (e.g., "07:00" -> "7am")
 */
export function formatTime12Hour(time: string): string {
  if (!time || typeof time !== "string") return time || "";
  
  const parts = time.split(":");
  const hour = Number(parts[0]) || 0;
  const minute = Number(parts[1]) || 0;
  
  const period = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 || 12;
  
  if (minute === 0) {
    return `${displayHour}${period}`;
  }
  return `${displayHour}:${minute.toString().padStart(2, "0")}${period}`;
}

/**
 * Format time range (e.g., "7am - 3pm")
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime12Hour(startTime)} - ${formatTime12Hour(endTime)}`;
}

// ============================================================================
// SUPERANNUATION CALCULATION
// ============================================================================

/**
 * Get effective super configuration for a staff member
 * Resolves user override vs venue default
 */
export function getEffectiveSuperConfig(
  userSuperEnabled: boolean | null,
  userSuperRate: Decimal | number | null | unknown,
  venueSuperEnabled: boolean,
  venueSuperRate: Decimal | number | null | unknown
): SuperConfig {
  // Determine if super is enabled
  const enabled = userSuperEnabled !== null
    ? userSuperEnabled
    : venueSuperEnabled;
  
  if (!enabled) {
    return { enabled: false, rate: 0 };
  }
  
  // Determine rate (user override or venue default)
  const rate = toNumber(userSuperRate)
    ?? toNumber(venueSuperRate)
    ?? 0.115;  // Default to current Australian SG rate
  
  return {
    enabled: true,
    rate
  };
}

/**
 * Calculate superannuation for a gross pay amount
 */
export function calculateSuperAmount(
  grossPay: number,
  superConfig: SuperConfig
): number {
  if (!superConfig.enabled || grossPay <= 0) {
    return 0;
  }
  
  const superAmount = grossPay * superConfig.rate;
  return Math.round(superAmount * 100) / 100;
}

/**
 * Calculate comprehensive pay breakdown for a single shift with super
 */
export function calculateShiftPayBreakdownWithSuper(
  shift: ShiftPayInput,
  rates: StaffPayRates,
  venueConfig?: VenuePayConfig | null,
  customRates?: CustomRate[],
  superConfig?: SuperConfig
): ShiftPayBreakdownWithSuper | null {
  // Get base breakdown
  const baseBreakdown = calculateShiftPayBreakdown(shift, rates, venueConfig, customRates);
  
  if (!baseBreakdown) {
    return null;
  }
  
  // Calculate super
  const effectiveSuperConfig = superConfig || {
    enabled: venueConfig?.superEnabled ?? true,
    rate: toNumber(venueConfig?.superRate) ?? 0.115
  };
  
  const superPay = calculateSuperAmount(baseBreakdown.totalPay, effectiveSuperConfig);
  const grossPay = baseBreakdown.totalPay;
  const totalCost = grossPay + superPay;
  
  return {
    ...baseBreakdown,
    superPay,
    superRate: effectiveSuperConfig.rate,
    grossPay,
    totalCost
  };
}

/**
 * Calculate weekly pay summary with full breakdown
 */
export function calculateWeeklyPaySummary(
  shifts: Array<ShiftPayInput & { userId: string; shiftId: string }>,
  staffRates: Record<string, StaffPayRates>,
  staffSuperConfigs: Record<string, SuperConfig>,
  venueConfig?: VenuePayConfig | null
): WeeklyPaySummary {
  const dailyMap = new Map<string, DailyPaySummary>();
  const staffMap = new Map<string, StaffPaySummary>();
  
  let totalHours = 0;
  let basePay = 0;
  let overtimePay = 0;
  let latePay = 0;
  let grossPay = 0;
  let superPay = 0;
  
  for (const shift of shifts) {
    const rates = staffRates[shift.userId];
    const superCfg = staffSuperConfigs[shift.userId] || {
      enabled: venueConfig?.superEnabled ?? true,
      rate: toNumber(venueConfig?.superRate) ?? 0.115
    };
    
    if (!rates) continue;
    
    const breakdown = calculateShiftPayBreakdownWithSuper(
      shift,
      rates,
      venueConfig,
      undefined,
      superCfg
    );
    
    if (!breakdown) continue;
    
    // Accumulate totals
    totalHours += breakdown.totalHours;
    basePay += breakdown.basePay;
    overtimePay += breakdown.overtimePay;
    latePay += breakdown.latePay;
    grossPay += breakdown.grossPay;
    superPay += breakdown.superPay;
    
    // Daily breakdown
    const dateKey = formatDate(shift.date);
    const existingDay = dailyMap.get(dateKey) || {
      date: shift.date,
      dateKey,
      totalHours: 0,
      basePay: 0,
      overtimePay: 0,
      latePay: 0,
      grossPay: 0,
      superPay: 0,
      totalCost: 0,
      shiftCount: 0
    };
    
    existingDay.totalHours += breakdown.totalHours;
    existingDay.basePay += breakdown.basePay;
    existingDay.overtimePay += breakdown.overtimePay;
    existingDay.latePay += breakdown.latePay;
    existingDay.grossPay += breakdown.grossPay;
    existingDay.superPay += breakdown.superPay;
    existingDay.totalCost += breakdown.totalCost;
    existingDay.shiftCount++;
    
    dailyMap.set(dateKey, existingDay);
    
    // Staff breakdown
    const existingStaff = staffMap.get(shift.userId) || {
      staffId: shift.userId,
      staffName: '',
      totalHours: 0,
      basePay: 0,
      overtimePay: 0,
      latePay: 0,
      grossPay: 0,
      superPay: 0,
      totalCost: 0,
      superEnabled: superCfg.enabled,
      superRate: superCfg.rate
    };
    
    existingStaff.totalHours += breakdown.totalHours;
    existingStaff.basePay += breakdown.basePay;
    existingStaff.overtimePay += breakdown.overtimePay;
    existingStaff.latePay += breakdown.latePay;
    existingStaff.grossPay += breakdown.grossPay;
    existingStaff.superPay += breakdown.superPay;
    existingStaff.totalCost += breakdown.totalCost;
    
    staffMap.set(shift.userId, existingStaff);
  }
  
  return {
    totalHours,
    basePay: Math.round(basePay * 100) / 100,
    overtimePay: Math.round(overtimePay * 100) / 100,
    latePay: Math.round(latePay * 100) / 100,
    grossPay: Math.round(grossPay * 100) / 100,
    superPay: Math.round(superPay * 100) / 100,
    totalCost: Math.round((grossPay + superPay) * 100) / 100,
    superRate: venueConfig?.superRate ? (toNumber(venueConfig.superRate) ?? 0.115) : 0.115,
    dailyBreakdown: Array.from(dailyMap.values()),
    staffBreakdown: Array.from(staffMap.values())
  };
}

/**
 * Format pay breakdown for display (extended with super)
 */
export function formatPayBreakdownWithSuper(breakdown: ShiftPayBreakdownWithSuper): string {
  const parts: string[] = [];
  
  parts.push(`Base: ${formatCurrency(breakdown.basePay)} (${formatHours(breakdown.baseHours)})`);
  
  if (breakdown.overtimeHours > 0) {
    parts.push(`OT: ${formatCurrency(breakdown.overtimePay)} (${formatHours(breakdown.overtimeHours)})`);
  }
  
  if (breakdown.lateHours > 0) {
    parts.push(`Late: ${formatCurrency(breakdown.latePay)} (${formatHours(breakdown.lateHours)})`);
  }
  
  if (breakdown.superPay > 0) {
    parts.push(`Super: ${formatCurrency(breakdown.superPay)} (${(breakdown.superRate * 100).toFixed(1)}%)`);
  }
  
  return parts.join(" | ");
}

/**
 * Format pay breakdown for display
 */
export function formatPayBreakdown(breakdown: ShiftPayBreakdown): string {
  const parts: string[] = [];
  
  parts.push(`Base: ${formatCurrency(breakdown.basePay)} (${formatHours(breakdown.baseHours)})`);
  
  if (breakdown.overtimeHours > 0) {
    parts.push(`OT: ${formatCurrency(breakdown.overtimePay)} (${formatHours(breakdown.overtimeHours)})`);
  }
  
  if (breakdown.lateHours > 0) {
    parts.push(`Late: ${formatCurrency(breakdown.latePay)} (${formatHours(breakdown.lateHours)})`);
  }
  
  return parts.join(" | ");
}
