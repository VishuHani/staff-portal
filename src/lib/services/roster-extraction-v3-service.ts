/**
 * Roster Extraction V3 Service
 * 
 * Production-grade extraction with:
 * - Single GPT-4o vision call
 * - Image preprocessing
 * - Code-based validation
 * - Retry mechanism with correction prompt
 * - Confidence gating
 */

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import { preprocessImage, detectImageMimeType, imageToDataUrl } from "./image-preprocessing";
import {
  validateExtraction,
  normalizeExtraction,
  formatErrorsForCorrection,
  type ExtractionData,
  type ExtractedShift,
  type ValidationResult,
} from "./extraction-validator";
import {
  SYSTEM_PROMPT,
  EXTRACTION_PROMPT,
  generateCorrectionPrompt,
  getConfidenceLevel,
  isConfidenceAcceptable,
  shouldRetry,
} from "./extraction-prompts";

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractionContext {
  venueId: string;
  venueStaff: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>;
}

export interface ExtractionResultV3 {
  success: boolean;
  data: ExtractionData | null;
  validation: ValidationResult | null;
  metadata: {
    processingTimeMs: number;
    attemptCount: number;
    preprocessedImageSize: { width: number; height: number };
    modelUsed: string;
  };
  error?: string;
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract roster data from an image file using single-pass extraction
 */
export async function extractRosterFromImageV3(
  imageBuffer: Buffer,
  fileName: string,
  context: ExtractionContext
): Promise<ExtractionResultV3> {
  const startTime = Date.now();
  console.log(`[V3] Starting single-pass extraction for: ${fileName}`);

  try {
    // Step 1: Preprocess the image
    console.log("[V3] Step 1: Preprocessing image...");
    const preprocessed = await preprocessImage(imageBuffer, {
      minWidth: 1000,
      maxWidth: 2000,
      contrastBoost: 1.2,
      cropWhitespace: true,
      sharpen: true,
    });
    console.log(`[V3] Preprocessed image: ${preprocessed.width}x${preprocessed.height}`);

    // Step 2: Extract with retry mechanism
    console.log("[V3] Step 2: Extracting data...");
    const { data, attemptCount } = await extractWithRetry(preprocessed.buffer, preprocessed.mimeType);

    if (!data) {
      return {
        success: false,
        data: null,
        validation: null,
        metadata: {
          processingTimeMs: Date.now() - startTime,
          attemptCount,
          preprocessedImageSize: { width: preprocessed.width, height: preprocessed.height },
          modelUsed: "gpt-4o",
        },
        error: "Failed to extract data after maximum retries",
      };
    }

    // Step 3: Normalize the extracted data
    console.log("[V3] Step 3: Normalizing data...");
    const normalizedData = normalizeExtraction(data);

    // Step 4: Validate the extraction
    console.log("[V3] Step 4: Validating extraction...");
    const validation = validateExtraction(normalizedData);
    console.log(`[V3] Validation: ${validation.confidence}% confidence, ${validation.errors.length} errors, ${validation.warnings.length} warnings`);

    const processingTime = Date.now() - startTime;
    console.log(`[V3] Extraction complete: ${normalizedData.shifts.length} shifts in ${processingTime}ms`);

    return {
      success: true,
      data: normalizedData,
      validation,
      metadata: {
        processingTimeMs: processingTime,
        attemptCount,
        preprocessedImageSize: { width: preprocessed.width, height: preprocessed.height },
        modelUsed: "gpt-4o",
      },
    };
  } catch (error) {
    console.error("[V3] Extraction failed:", error);
    return {
      success: false,
      data: null,
      validation: null,
      metadata: {
        processingTimeMs: Date.now() - startTime,
        attemptCount: 0,
        preprocessedImageSize: { width: 0, height: 0 },
        modelUsed: "gpt-4o",
      },
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// EXTRACTION WITH RETRY
// ============================================================================

/**
 * Extract data with retry mechanism
 */
async function extractWithRetry(
  imageBuffer: Buffer,
  mimeType: string,
  maxRetries: number = 2
): Promise<{ data: ExtractionData | null; attemptCount: number }> {
  let attemptCount = 0;
  let lastValidation: ValidationResult | null = null;
  let lastData: ExtractionData | null = null;

  while (attemptCount <= maxRetries) {
    attemptCount++;
    console.log(`[V3] Extraction attempt ${attemptCount}/${maxRetries + 1}`);

    try {
      // Generate extraction prompt
      const prompt = attemptCount === 1
        ? EXTRACTION_PROMPT
        : lastValidation
          ? generateCorrectionPrompt(lastValidation.errors)
          : EXTRACTION_PROMPT;

      // Call GPT-4o
      const data = await callGPT4oVision(imageBuffer, mimeType, prompt);
      lastData = data;

      // Validate
      const normalizedData = normalizeExtraction(data);
      lastValidation = validateExtraction(normalizedData);

      console.log(`[V3] Attempt ${attemptCount} result: ${lastValidation.confidence}% confidence`);

      // Check if acceptable
      if (isConfidenceAcceptable(lastValidation.confidence)) {
        return { data: normalizedData, attemptCount };
      }

      // Check if we should retry
      if (!shouldRetry(lastValidation.confidence, attemptCount)) {
        console.log("[V3] Confidence too low, not retrying");
        return { data: normalizedData, attemptCount };
      }

      console.log(`[V3] Retrying with correction prompt...`);
    } catch (error) {
      console.error(`[V3] Attempt ${attemptCount} failed:`, error);
      
      // If this was the last attempt, return what we have
      if (attemptCount > maxRetries) {
        return { data: lastData, attemptCount };
      }
    }
  }

  return { data: lastData, attemptCount };
}

// ============================================================================
// GPT-4O VISION CALL
// ============================================================================

/**
 * Call GPT-4o vision API
 */
async function callGPT4oVision(
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string
): Promise<ExtractionData> {
  const base64Image = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const { text } = await generateText({
    model: openai("gpt-4o"),
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image",
            image: dataUrl,
          },
        ],
      },
    ],
    temperature: 0.1, // Low temperature for consistent extraction
  });

  // Parse the response
  const cleanedText = cleanJsonResponse(text);
  const data = JSON.parse(cleanedText);

  return data as ExtractionData;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Clean JSON response from AI
 */
function cleanJsonResponse(text: string): string {
  return text
    .trim()
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .replace(/^[^{]*/, "") // Remove anything before the first {
    .replace(/[^}]*$/, ""); // Remove anything after the last }
}

/**
 * Get venue staff for extraction context
 */
export async function getExtractionContextV3(venueId: string): Promise<ExtractionContext> {
  const venueStaff = await prisma.user.findMany({
    where: {
      venues: {
        some: {
          venueId,
        },
      },
      active: true,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  return {
    venueId,
    venueStaff,
  };
}

/**
 * Match extracted staff names to database users
 */
export function matchStaffToUsers(
  shifts: ExtractedShift[],
  venueStaff: ExtractionContext["venueStaff"]
): Array<ExtractedShift & { matchedUserId: string | null; matchConfidence: number }> {
  return shifts.map((shift) => {
    const normalizedName = shift.staff_name.toLowerCase().trim();
    
    // Try exact match first
    const exactMatch = venueStaff.find((staff) => {
      const fullName = `${staff.firstName || ""} ${staff.lastName || ""}`.toLowerCase().trim();
      return fullName === normalizedName;
    });

    if (exactMatch) {
      return {
        ...shift,
        matchedUserId: exactMatch.id,
        matchConfidence: 100,
      };
    }

    // Try first name match
    const firstName = normalizedName.split(/\s+/)[0];
    const firstNameMatch = venueStaff.find((staff) => {
      return staff.firstName?.toLowerCase().trim() === firstName;
    });

    if (firstNameMatch) {
      return {
        ...shift,
        matchedUserId: firstNameMatch.id,
        matchConfidence: 80,
      };
    }

    // Try fuzzy match
    let bestMatch: { user: (typeof venueStaff)[0]; score: number } | null = null;
    for (const staff of venueStaff) {
      const fullName = `${staff.firstName || ""} ${staff.lastName || ""}`.toLowerCase().trim();
      const score = calculateSimilarity(normalizedName, fullName);
      if (score > 0.7 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { user: staff, score };
      }
    }

    if (bestMatch) {
      return {
        ...shift,
        matchedUserId: bestMatch.user.id,
        matchConfidence: Math.round(bestMatch.score * 100),
      };
    }

    // No match
    return {
      ...shift,
      matchedUserId: null,
      matchConfidence: 0,
    };
  });
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
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
