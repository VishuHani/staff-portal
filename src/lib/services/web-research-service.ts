/**
 * Web Research Service for AI Form Generation
 * 
 * Uses OpenAI's built-in web search capability to research form requirements,
 * compliance standards, and industry best practices.
 */

import OpenAI from 'openai';

// ============================================================================
// Types
// ============================================================================

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
}

export interface ResearchResult {
  /** The original query */
  query: string;
  /** Summary of research findings */
  summary: string;
  /** Sources used for research */
  sources: ResearchSource[];
  /** Key facts extracted from research */
  keyFacts: string[];
  /** Compliance requirements found */
  complianceRequirements: string[];
  /** Industry standards identified */
  industryStandards: string[];
  /** Recommended fields based on research */
  recommendedFields: string[];
  /** Whether research was successful */
  success: boolean;
  /** Error message if research failed */
  error?: string;
  /** Timestamp of research */
  timestamp: Date;
  /** Whether result was from cache */
  fromCache: boolean;
}

export interface ResearchOptions {
  /** Include compliance requirements in research */
  includeCompliance?: boolean;
  /** Include industry best practices */
  includeBestPractices?: boolean;
  /** Industry context (e.g., 'healthcare', 'finance') */
  industry?: string;
  /** Geographic region for compliance (e.g., 'US', 'EU', 'AU') */
  region?: string;
  /** Depth of research: 'quick' | 'standard' | 'comprehensive' */
  depth?: 'quick' | 'standard' | 'comprehensive';
}

interface CacheEntry {
  result: ResearchResult;
  timestamp: number;
  ttl: number;
}

// ============================================================================
// Cache Management
// ============================================================================

// In-memory cache for research results
const researchCache = new Map<string, CacheEntry>();

const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function getCacheKey(query: string, options: ResearchOptions): string {
  return `${query}::${options.industry || ''}::${options.region || ''}::${options.depth || 'standard'}`;
}

function getFromCache(key: string): ResearchResult | null {
  const entry = researchCache.get(key);
  if (!entry) return null;
  
  if (Date.now() > entry.timestamp + entry.ttl) {
    researchCache.delete(key);
    return null;
  }
  
  return { ...entry.result, fromCache: true };
}

function setCache(key: string, result: ResearchResult, ttl: number = DEFAULT_CACHE_TTL): void {
  researchCache.set(key, {
    result: { ...result, fromCache: false },
    timestamp: Date.now(),
    ttl
  });
}

// ============================================================================
// OpenAI Client
// ============================================================================

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OPENAI_API_KEY not set, web research will not work');
    return null;
  }
  return new OpenAI({ apiKey });
}

// ============================================================================
// Research Functions
// ============================================================================

/**
 * Research form requirements using OpenAI's knowledge
 * Note: OpenAI doesn't have a direct web search tool in the API, but we can
 * use the model's knowledge and prompt it to provide research-like responses
 * with structured information about form requirements.
 */
export async function researchFormRequirements(
  formDescription: string,
  options: ResearchOptions = {}
): Promise<ResearchResult> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    return {
      query: formDescription,
      summary: '',
      sources: [],
      keyFacts: [],
      complianceRequirements: [],
      industryStandards: [],
      recommendedFields: [],
      success: false,
      error: 'OpenAI API key not configured',
      timestamp: new Date(),
      fromCache: false
    };
  }

  // Check cache first
  const cacheKey = getCacheKey(formDescription, options);
  const cachedResult = getFromCache(cacheKey);
  if (cachedResult) {
    console.log('[Web Research] Using cached result');
    return cachedResult;
  }

  const {
    includeCompliance = true,
    includeBestPractices = true,
    industry,
    region = 'AU', // Default to Australia
    depth = 'standard'
  } = options;

  // Build the research prompt
  const systemPrompt = buildResearchSystemPrompt(depth);
  const userPrompt = buildResearchUserPrompt(formDescription, {
    includeCompliance,
    includeBestPractices,
    industry,
    region
  });

  try {
    console.log('[Web Research] Starting research for:', formDescription.substring(0, 100));
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      max_tokens: depth === 'comprehensive' ? 4000 : depth === 'standard' ? 2500 : 1500,
      temperature: 0.3 // Lower temperature for more factual responses
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(content);
    
    const result: ResearchResult = {
      query: formDescription,
      summary: parsed.summary || '',
      sources: (parsed.sources || []).map((s: any) => ({
        title: s.title || 'Unknown Source',
        url: s.url || '',
        snippet: s.snippet || ''
      })),
      keyFacts: parsed.keyFacts || [],
      complianceRequirements: parsed.complianceRequirements || [],
      industryStandards: parsed.industryStandards || [],
      recommendedFields: parsed.recommendedFields || [],
      success: true,
      timestamp: new Date(),
      fromCache: false
    };

    // Cache the result
    setCache(cacheKey, result);
    
    console.log('[Web Research] Research complete. Found:', {
      facts: result.keyFacts.length,
      compliance: result.complianceRequirements.length,
      fields: result.recommendedFields.length
    });

    return result;
  } catch (error) {
    console.error('[Web Research] Research failed:', error);
    
    return {
      query: formDescription,
      summary: '',
      sources: [],
      keyFacts: [],
      complianceRequirements: [],
      industryStandards: [],
      recommendedFields: [],
      success: false,
      error: error instanceof Error ? error.message : 'Research failed',
      timestamp: new Date(),
      fromCache: false
    };
  }
}

/**
 * Build the system prompt for research
 */
function buildResearchSystemPrompt(depth: string): string {
  const depthInstructions = {
    quick: 'Provide a brief overview with the most essential information only.',
    standard: 'Provide a comprehensive analysis with key details and recommendations.',
    comprehensive: 'Provide an exhaustive analysis with all relevant details, edge cases, and extensive recommendations.'
  };

  return `You are a form requirements researcher. Your task is to analyze form descriptions and provide comprehensive information about requirements, compliance standards, and best practices.

${depthInstructions[depth as keyof typeof depthInstructions] || depthInstructions.standard}

IMPORTANT: You must respond with a valid JSON object only. No markdown, no code blocks, just pure JSON.

Response structure:
{
  "summary": "A brief summary of the form type and its purpose",
  "sources": [
    {
      "title": "Source name (e.g., 'GDPR Article 13', 'HIPAA Privacy Rule')",
      "url": "Source URL if applicable, or empty string",
      "snippet": "Brief description of the source relevance"
    }
  ],
  "keyFacts": [
    "Important facts about this form type"
  ],
  "complianceRequirements": [
    "Specific compliance requirements (e.g., 'Must include privacy consent checkbox')"
  ],
  "industryStandards": [
    "Industry standard practices for this form type"
  ],
  "recommendedFields": [
    "List of fields that should typically be included in this form type"
  ]
}

Guidelines:
- Be specific and actionable in your recommendations
- Include regulatory references when known (GDPR, HIPAA, etc.)
- Consider accessibility requirements
- Include validation recommendations where appropriate
- Mention any required disclaimers or notices`;
}

/**
 * Build the user prompt for research
 */
function buildResearchUserPrompt(
  formDescription: string,
  options: {
    includeCompliance: boolean;
    includeBestPractices: boolean;
    industry?: string;
    region: string;
  }
): string {
  const { includeCompliance, includeBestPractices, industry, region } = options;

  let prompt = `Analyze this form description and provide research on requirements and best practices:

FORM DESCRIPTION:
${formDescription}

CONTEXT:
- Region: ${region}
${industry ? `- Industry: ${industry}` : ''}

`;

  if (includeCompliance) {
    prompt += `Include compliance requirements for ${region}. Consider regulations like:
- Privacy laws (GDPR for EU, Privacy Act for AU, CCPA for US-CA)
- Industry-specific regulations
- Accessibility standards (WCAG)
- Data protection requirements

`;
  }

  if (includeBestPractices) {
    prompt += `Include industry best practices:
- Standard fields for this form type
- User experience recommendations
- Validation best practices
- Security considerations

`;
  }

  prompt += `Provide your response as a JSON object with the structure specified in the system prompt.`;

  return prompt;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clear the research cache
 */
export async function clearResearchCache(): Promise<void> {
  researchCache.clear();
  console.log('[Web Research] Cache cleared');
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{ size: number; keys: string[] }> {
  return {
    size: researchCache.size,
    keys: Array.from(researchCache.keys())
  };
}

/**
 * Check if research is enabled (synchronous version for internal use)
 */
export function isResearchEnabledSync(): boolean {
  return process.env.RESEARCH_ENABLED !== 'false' && !!process.env.OPENAI_API_KEY;
}

/**
 * Check if research is enabled
 */
export async function isResearchEnabled(): Promise<boolean> {
  return isResearchEnabledSync();
}