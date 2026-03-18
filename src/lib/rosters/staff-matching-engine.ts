/**
 * Staff Matching Engine for Roster Extraction
 * 
 * Deterministic matching strategy chain with:
 * - Ordered strategies: exact email → exact name → alias → fuzzy
 * - Confidence bands: 100 (exact), 85-99 (high), 60-84 (medium), 40-59 (low), <40 (unmatched)
 * - Explainability metadata for UI display and debugging
 */

// ============================================================================
// TYPES
// ============================================================================

export type MatchStrategy = 
  | 'exact_email'
  | 'exact_full_name'
  | 'exact_first_name'
  | 'name_with_initial'
  | 'alias_match'
  | 'fuzzy_high'
  | 'fuzzy_medium'
  | 'fuzzy_low'
  | 'no_match';

export type ConfidenceBand = 'exact' | 'high' | 'medium' | 'low' | 'none';

export interface StaffMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  /** Optional known aliases/nicknames for this staff member */
  aliases?: string[];
}

export interface MatchResult {
  matchedUserId: string | null;
  confidence: number;
  confidenceBand: ConfidenceBand;
  strategy: MatchStrategy;
  /** Human-readable explanation of how the match was determined */
  matchReason: string;
  /** Which field was matched against (email, firstName, lastName, fullName, alias) */
  matchedField: 'email' | 'firstName' | 'lastName' | 'fullName' | 'alias' | 'none';
  /** The normalized value that was matched */
  matchedValue: string | null;
  /** Alternative matches that were considered (for UI disambiguation) */
  alternatives: Array<{
    userId: string;
    confidence: number;
    strategy: MatchStrategy;
    staffName: string;
  }>;
  /** Whether this match requires manual confirmation */
  requiresConfirmation: boolean;
}

export interface MatchedShift<T = unknown> {
  staffName: string;
  matchResult: MatchResult;
  shiftData: T;
}

export interface MatchingConfig {
  /** Minimum confidence for automatic match (default: 85) */
  autoMatchThreshold: number;
  /** Minimum confidence to include in alternatives (default: 50) */
  alternativeThreshold: number;
  /** Fuzzy match threshold (0-1, default: 0.7) */
  fuzzyThreshold: number;
  /** Whether to include aliases in matching (default: true) */
  useAliases: boolean;
  /** Custom alias mappings: staffId -> aliases */
  aliasMap?: Map<string, string[]>;
}

export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  autoMatchThreshold: 85,
  alternativeThreshold: 50,
  fuzzyThreshold: 0.7,
  useAliases: true,
};

// ============================================================================
// CONFIDENCE BANDS
// ============================================================================

export function getConfidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 100) return 'exact';
  if (confidence >= 85) return 'high';
  if (confidence >= 60) return 'medium';
  if (confidence >= 40) return 'low';
  return 'none';
}

export function getStrategyConfidenceRange(strategy: MatchStrategy): { min: number; max: number } {
  switch (strategy) {
    case 'exact_email':
    case 'exact_full_name':
      return { min: 100, max: 100 };
    case 'exact_first_name':
      return { min: 80, max: 85 };
    case 'name_with_initial':
      return { min: 75, max: 85 };
    case 'alias_match':
      return { min: 85, max: 95 };
    case 'fuzzy_high':
      return { min: 85, max: 99 };
    case 'fuzzy_medium':
      return { min: 60, max: 84 };
    case 'fuzzy_low':
      return { min: 40, max: 59 };
    case 'no_match':
      return { min: 0, max: 0 };
    default:
      return { min: 0, max: 0 };
  }
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Normalize a string for comparison
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/[^a-z0-9\s@._-]/g, '');  // Remove special chars except email chars
}

/**
 * Get initials from a name
 */
function getInitials(firstName: string | null, lastName: string | null): string {
  const first = firstName?.trim().charAt(0).toUpperCase() || '';
  const last = lastName?.trim().charAt(0).toUpperCase() || '';
  return first + last;
}

/**
 * Build full name from parts
 */
function buildFullName(firstName: string | null, lastName: string | null): string {
  return `${firstName || ''} ${lastName || ''}`.trim();
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }
  
  return costs[s2.length];
}

/**
 * Calculate string similarity (0-1)
 */
function calculateSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Check if a name matches with initial pattern (e.g., "John S" matches "John Smith")
 */
function matchesWithInitial(inputName: string, firstName: string | null, lastName: string | null): { matches: boolean; confidence: number } {
  const parts = inputName.trim().split(/\s+/);
  if (parts.length !== 2) return { matches: false, confidence: 0 };
  
  const [inputFirst, inputLast] = parts;
  const normalizedFirst = normalize(firstName || '');
  const normalizedLast = normalize(lastName || '');
  
  // First name must match exactly
  if (normalize(inputFirst) !== normalizedFirst) {
    return { matches: false, confidence: 0 };
  }
  
  // Last part must be a single character (initial)
  if (inputLast.length !== 1) {
    return { matches: false, confidence: 0 };
  }
  
  // Check if initial matches last name
  if (normalizedLast.charAt(0) === normalize(inputLast)) {
    return { matches: true, confidence: 80 };
  }
  
  return { matches: false, confidence: 0 };
}

// ============================================================================
// MATCHING STRATEGIES
// ============================================================================

interface StrategyResult {
  matched: boolean;
  confidence: number;
  matchedField: 'email' | 'firstName' | 'lastName' | 'fullName' | 'alias';
  matchedValue: string;
  reason: string;
}

/**
 * Strategy 1: Exact email match
 */
function tryExactEmailMatch(
  normalizedInput: string,
  staff: StaffMember
): StrategyResult | null {
  const normalizedEmail = normalize(staff.email);
  
  if (normalizedInput === normalizedEmail) {
    return {
      matched: true,
      confidence: 100,
      matchedField: 'email',
      matchedValue: staff.email,
      reason: `Exact email match: "${staff.email}"`,
    };
  }
  
  // Also check if input looks like it contains the email local part
  const emailLocalPart = staff.email.split('@')[0];
  if (normalizedInput === normalize(emailLocalPart) && !normalizedInput.includes('@')) {
    return {
      matched: true,
      confidence: 95,
      matchedField: 'email',
      matchedValue: staff.email,
      reason: `Email local part match: "${emailLocalPart}" from "${staff.email}"`,
    };
  }
  
  return null;
}

/**
 * Strategy 2: Exact full name match
 */
function tryExactFullNameMatch(
  normalizedInput: string,
  staff: StaffMember
): StrategyResult | null {
  const fullName = buildFullName(staff.firstName, staff.lastName);
  const normalizedFullName = normalize(fullName);
  
  if (normalizedInput === normalizedFullName) {
    return {
      matched: true,
      confidence: 100,
      matchedField: 'fullName',
      matchedValue: fullName,
      reason: `Exact full name match: "${fullName}"`,
    };
  }
  
  // Try reversed name (Last First format)
  const reversedName = buildFullName(staff.lastName, staff.firstName);
  if (normalizedInput === normalize(reversedName)) {
    return {
      matched: true,
      confidence: 98,
      matchedField: 'fullName',
      matchedValue: reversedName,
      reason: `Full name match (reversed): "${reversedName}"`,
    };
  }
  
  return null;
}

/**
 * Strategy 3: Exact first name match (with uniqueness check done by caller)
 */
function tryExactFirstNameMatch(
  normalizedInput: string,
  staff: StaffMember
): StrategyResult | null {
  const normalizedFirstName = normalize(staff.firstName || '');
  
  if (normalizedInput === normalizedFirstName && normalizedFirstName.length > 0) {
    return {
      matched: true,
      confidence: 80,
      matchedField: 'firstName',
      matchedValue: staff.firstName || '',
      reason: `First name match: "${staff.firstName}"`,
    };
  }
  
  return null;
}

/**
 * Strategy 4: Name with initial match
 */
function tryNameWithInitialMatch(
  normalizedInput: string,
  staff: StaffMember
): StrategyResult | null {
  const result = matchesWithInitial(normalizedInput, staff.firstName, staff.lastName);
  
  if (result.matches) {
    const fullName = buildFullName(staff.firstName, staff.lastName);
    return {
      matched: true,
      confidence: result.confidence,
      matchedField: 'fullName',
      matchedValue: fullName,
      reason: `Name with initial match: "${normalizedInput}" → "${fullName}"`,
    };
  }
  
  return null;
}

/**
 * Strategy 5: Alias match
 */
function tryAliasMatch(
  normalizedInput: string,
  staff: StaffMember,
  aliasMap?: Map<string, string[]>
): StrategyResult | null {
  if (!aliasMap) return null;
  
  const aliases = aliasMap.get(staff.id) || staff.aliases || [];
  
  for (const alias of aliases) {
    if (normalize(alias) === normalizedInput) {
      return {
        matched: true,
        confidence: 90,
        matchedField: 'alias',
        matchedValue: alias,
        reason: `Alias match: "${alias}" → ${buildFullName(staff.firstName, staff.lastName)}`,
      };
    }
  }
  
  return null;
}

/**
 * Strategy 6: Fuzzy match
 */
function tryFuzzyMatch(
  normalizedInput: string,
  staff: StaffMember,
  threshold: number
): StrategyResult | null {
  const fullName = buildFullName(staff.firstName, staff.lastName);
  const normalizedFullName = normalize(fullName);
  
  const similarity = calculateSimilarity(normalizedInput, normalizedFullName);
  
  if (similarity >= threshold) {
    let strategy: MatchStrategy;
    let confidence: number;
    
    if (similarity >= 0.95) {
      strategy = 'fuzzy_high';
      confidence = Math.round(85 + (similarity - 0.95) * 100); // 85-99
    } else if (similarity >= 0.8) {
      strategy = 'fuzzy_medium';
      confidence = Math.round(60 + (similarity - 0.8) * 166); // 60-84
    } else {
      strategy = 'fuzzy_low';
      confidence = Math.round(40 + (similarity - 0.7) * 66); // 40-59
    }
    
    return {
      matched: true,
      confidence,
      matchedField: 'fullName',
      matchedValue: fullName,
      reason: `Fuzzy match (${Math.round(similarity * 100)}% similar): "${normalizedInput}" ≈ "${fullName}"`,
    };
  }
  
  return null;
}

// ============================================================================
// MAIN MATCHING FUNCTION
// ============================================================================

/**
 * Match a single staff name to the best matching user
 */
export function matchStaffName(
  staffName: string,
  venueStaff: StaffMember[],
  config: Partial<MatchingConfig> = {}
): MatchResult {
  const fullConfig = { ...DEFAULT_MATCHING_CONFIG, ...config };
  const normalizedInput = normalize(staffName);
  
  if (!normalizedInput || venueStaff.length === 0) {
    return createNoMatchResult(staffName);
  }
  
  // Collect all potential matches
  const candidates: Array<{
    staff: StaffMember;
    result: StrategyResult;
    strategy: MatchStrategy;
  }> = [];
  
  for (const staff of venueStaff) {
    // Strategy 1: Exact email
    const emailResult = tryExactEmailMatch(normalizedInput, staff);
    if (emailResult) {
      candidates.push({
        staff,
        result: emailResult,
        strategy: 'exact_email',
      });
      continue;  // Exact email is definitive
    }
    
    // Strategy 2: Exact full name
    const fullNameResult = tryExactFullNameMatch(normalizedInput, staff);
    if (fullNameResult) {
      candidates.push({
        staff,
        result: fullNameResult,
        strategy: 'exact_full_name',
      });
      continue;
    }
    
    // Strategy 3: Name with initial
    const initialResult = tryNameWithInitialMatch(normalizedInput, staff);
    if (initialResult) {
      candidates.push({
        staff,
        result: initialResult,
        strategy: 'name_with_initial',
      });
      continue;
    }
    
    // Strategy 4: Alias match
    if (fullConfig.useAliases) {
      const aliasResult = tryAliasMatch(normalizedInput, staff, fullConfig.aliasMap);
      if (aliasResult) {
        candidates.push({
          staff,
          result: aliasResult,
          strategy: 'alias_match',
        });
        continue;
      }
    }
    
    // Strategy 5: Exact first name (only if unique)
    const firstNameResult = tryExactFirstNameMatch(normalizedInput, staff);
    if (firstNameResult) {
      candidates.push({
        staff,
        result: firstNameResult,
        strategy: 'exact_first_name',
      });
      continue;
    }
    
    // Strategy 6: Fuzzy match
    const fuzzyResult = tryFuzzyMatch(normalizedInput, staff, fullConfig.fuzzyThreshold);
    if (fuzzyResult) {
      candidates.push({
        staff,
        result: fuzzyResult,
        strategy: fuzzyResult.confidence >= 85 ? 'fuzzy_high' 
                 : fuzzyResult.confidence >= 60 ? 'fuzzy_medium' 
                 : 'fuzzy_low',
      });
    }
  }
  
  // Sort by confidence descending
  candidates.sort((a, b) => b.result.confidence - a.result.confidence);
  
  // No matches found
  if (candidates.length === 0) {
    return createNoMatchResult(staffName);
  }
  
  // Get best match
  const best = candidates[0];
  
  // Build alternatives (excluding the best match)
  const alternatives = candidates
    .slice(1, 4)  // Top 3 alternatives
    .filter(c => c.result.confidence >= fullConfig.alternativeThreshold)
    .map(c => ({
      userId: c.staff.id,
      confidence: c.result.confidence,
      strategy: c.strategy,
      staffName: buildFullName(c.staff.firstName, c.staff.lastName),
    }));
  
  // Determine if manual confirmation is required
  const requiresConfirmation = best.result.confidence < fullConfig.autoMatchThreshold;
  
  return {
    matchedUserId: best.staff.id,
    confidence: best.result.confidence,
    confidenceBand: getConfidenceBand(best.result.confidence),
    strategy: best.strategy,
    matchReason: best.result.reason,
    matchedField: best.result.matchedField,
    matchedValue: best.result.matchedValue,
    alternatives,
    requiresConfirmation,
  };
}

/**
 * Create a no-match result
 */
function createNoMatchResult(staffName: string): MatchResult {
  return {
    matchedUserId: null,
    confidence: 0,
    confidenceBand: 'none',
    strategy: 'no_match',
    matchReason: `No match found for "${staffName}"`,
    matchedField: 'none',
    matchedValue: null,
    alternatives: [],
    requiresConfirmation: true,
  };
}

// ============================================================================
// BATCH MATCHING
// ============================================================================

/**
 * Match multiple shifts to staff members
 */
export function matchShiftsToStaff<T>(
  shifts: Array<{ staffName: string; shiftData: T }>,
  venueStaff: StaffMember[],
  config: Partial<MatchingConfig> = {}
): Array<MatchedShift<T>> {
  return shifts.map(({ staffName, shiftData }) => ({
    staffName,
    matchResult: matchStaffName(staffName, venueStaff, config),
    shiftData,
  }));
}

/**
 * Get matching statistics for a batch of matches
 */
export function getMatchingStats(matches: Array<MatchedShift>): {
  total: number;
  matched: number;
  autoMatched: number;
  needsConfirmation: number;
  unmatched: number;
  byBand: Record<ConfidenceBand, number>;
  byStrategy: Record<MatchStrategy, number>;
} {
  const stats = {
    total: matches.length,
    matched: 0,
    autoMatched: 0,
    needsConfirmation: 0,
    unmatched: 0,
    byBand: {
      exact: 0,
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    } as Record<ConfidenceBand, number>,
    byStrategy: {
      exact_email: 0,
      exact_full_name: 0,
      exact_first_name: 0,
      name_with_initial: 0,
      alias_match: 0,
      fuzzy_high: 0,
      fuzzy_medium: 0,
      fuzzy_low: 0,
      no_match: 0,
    } as Record<MatchStrategy, number>,
  };
  
  for (const match of matches) {
    const { matchResult } = match;
    
    if (matchResult.matchedUserId) {
      stats.matched++;
      if (!matchResult.requiresConfirmation) {
        stats.autoMatched++;
      } else {
        stats.needsConfirmation++;
      }
    } else {
      stats.unmatched++;
    }
    
    stats.byBand[matchResult.confidenceBand]++;
    stats.byStrategy[matchResult.strategy]++;
  }
  
  return stats;
}

// ============================================================================
// UNRESOLVED IDENTITY HELPERS
// ============================================================================

/**
 * Categorize matches into resolved, needs review, and unresolved
 */
export function categorizeMatches(
  matches: Array<MatchedShift>,
  config: Partial<MatchingConfig> = {}
): {
  resolved: Array<MatchedShift>;        // High confidence, auto-matched
  needsReview: Array<MatchedShift>;     // Medium confidence, has alternatives
  unresolved: Array<MatchedShift>;      // No match or very low confidence
} {
  const fullConfig = { ...DEFAULT_MATCHING_CONFIG, ...config };
  
  const resolved: Array<MatchedShift> = [];
  const needsReview: Array<MatchedShift> = [];
  const unresolved: Array<MatchedShift> = [];
  
  for (const match of matches) {
    const { matchResult } = match;
    
    if (!matchResult.matchedUserId) {
      unresolved.push(match);
    } else if (matchResult.confidence >= fullConfig.autoMatchThreshold) {
      resolved.push(match);
    } else if (matchResult.alternatives.length > 0) {
      needsReview.push(match);
    } else {
      unresolved.push(match);
    }
  }
  
  return { resolved, needsReview, unresolved };
}

/**
 * Generate a summary report for matching results
 */
export function generateMatchingReport(matches: Array<MatchedShift>): string {
  const stats = getMatchingStats(matches);
  const { resolved, needsReview, unresolved } = categorizeMatches(matches);
  
  const lines = [
    '=== Staff Matching Report ===',
    `Total shifts: ${stats.total}`,
    `Matched: ${stats.matched} (${Math.round(stats.matched / stats.total * 100)}%)`,
    `  - Auto-matched: ${stats.autoMatched}`,
    `  - Needs confirmation: ${stats.needsConfirmation}`,
    `Unmatched: ${stats.unmatched}`,
    '',
    'By Confidence Band:',
    `  - Exact (100%): ${stats.byBand.exact}`,
    `  - High (85-99%): ${stats.byBand.high}`,
    `  - Medium (60-84%): ${stats.byBand.medium}`,
    `  - Low (40-59%): ${stats.byBand.low}`,
    `  - None (<40%): ${stats.byBand.none}`,
    '',
    'By Strategy:',
    ...Object.entries(stats.byStrategy)
      .filter(([, count]) => count > 0)
      .map(([strategy, count]) => `  - ${strategy}: ${count}`),
  ];
  
  if (unresolved.length > 0) {
    lines.push('', 'Unresolved identities:');
    for (const match of unresolved.slice(0, 10)) {
      lines.push(`  - "${match.staffName}"`);
    }
    if (unresolved.length > 10) {
      lines.push(`  ... and ${unresolved.length - 10} more`);
    }
  }
  
  return lines.join('\n');
}
