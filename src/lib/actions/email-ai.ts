"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import OpenAI from "openai";
import type { EmailType } from "@/types/email-campaign";

// Lazy-initialized OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("OPENAI_API_KEY not set, email AI features will not work");
      return null;
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ============================================================================
// AI EMAIL GENERATION
// ============================================================================

export interface GenerateEmailInput {
  prompt: string;
  tone?: "professional" | "friendly" | "urgent" | "celebratory" | "informational";
  targetAudience?: string;
  includeCallToAction?: boolean;
  previousContent?: string;
}

export interface GeneratedEmail {
  subject: string;
  htmlContent: string;
  textContent: string;
  suggestedType: EmailType;
  confidence: number;
  reasoning: string;
}

export async function generateEmail(input: GenerateEmailInput): Promise<{
  success: boolean;
  email?: GeneratedEmail;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    const openai = getOpenAIClient();

    if (!openai) {
      return { success: false, error: "AI service is not available. Please set OPENAI_API_KEY." };
    }

    const tone = input.tone || "professional";
    const targetAudience = input.targetAudience || "staff members";

    const systemPrompt = `You are an expert email copywriter for a staff management portal. 
Generate professional emails that are clear, concise, and effective.

Rules:
1. Always generate valid HTML with inline styles for email compatibility
2. Include a compelling subject line
3. Use the specified tone: ${tone}
4. Target audience: ${targetAudience}
5. Keep emails concise but complete
6. Include appropriate greeting and sign-off
7. ${input.includeCallToAction ? "Include a clear call-to-action" : "Keep informational without strong call-to-action"}

Email HTML should:
- Use table-based layout for compatibility
- Have inline CSS styles
- Be mobile-responsive
- Use web-safe fonts
- Have a maximum width of 600px

Return JSON with:
{
  "subject": "Email subject line",
  "htmlContent": "<html>...</html>",
  "textContent": "Plain text version"
}`;

    const userPrompt = input.previousContent
      ? `Based on this draft content, improve and format it professionally:\n\n${input.previousContent}\n\nAdditional instructions: ${input.prompt}`
      : `Generate an email with the following requirements:\n\n${input.prompt}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: "No content generated" };
    }

    const parsed = JSON.parse(content);
    
    // Validate required fields
    if (!parsed.subject || !parsed.htmlContent) {
      return { success: false, error: "Generated content missing required fields" };
    }

    // Classify the email
    const classification = await classifyEmail(parsed.htmlContent);

    // Save generation to history
    await prisma.emailGeneration.create({
      data: {
        prompt: input.prompt,
        generatedHtml: parsed.htmlContent,
        generatedSubject: parsed.subject,
        generatedText: parsed.textContent,
        modelUsed: "gpt-4o",
        tokensUsed: completion.usage?.total_tokens,
        tone: input.tone,
        targetAudience: input.targetAudience,
        emailType: classification.type as any,
        createdBy: user.id,
      },
    });

    return {
      success: true,
      email: {
        subject: parsed.subject,
        htmlContent: parsed.htmlContent,
        textContent: parsed.textContent || "",
        suggestedType: classification.type,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
      },
    };
  } catch (error) {
    console.error("Error generating email:", error);
    return { success: false, error: "Failed to generate email" };
  }
}

// ============================================================================
// EMAIL CLASSIFICATION
// ============================================================================

export interface EmailClassification {
  type: EmailType;
  confidence: number;
  reasoning: string;
}

export async function classifyEmail(content: string): Promise<EmailClassification> {
  try {
    const openai = getOpenAIClient();

    if (!openai) {
      return {
        type: "TRANSACTIONAL" as EmailType,
        confidence: 0.5,
        reasoning: "AI not available, defaulting to transactional",
      };
    }

    const systemPrompt = `You are an email classification expert. Classify emails as either TRANSACTIONAL or MARKETING.

TRANSACTIONAL emails are:
- Operational updates about user's account or work
- System notifications
- Schedule changes
- Important alerts
- Password resets
- Order confirmations
- Direct responses to user actions

MARKETING emails are:
- Newsletters
- Promotional offers
- Product announcements
- Event invitations
- General updates about the platform
- Cross-selling or upselling
- Content designed to drive engagement

Respond with JSON containing:
- type: "TRANSACTIONAL" or "MARKETING"
- confidence: number between 0 and 1
- reasoning: brief explanation`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Classify this email:\n\n${content.substring(0, 2000)}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return {
        type: "TRANSACTIONAL" as EmailType,
        confidence: 0.5,
        reasoning: "Unable to classify, defaulting to transactional",
      };
    }

    const parsed = JSON.parse(response);
    
    return {
      type: (parsed.type === "MARKETING" ? "MARKETING" : "TRANSACTIONAL") as EmailType,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      reasoning: parsed.reasoning || "No reasoning provided",
    };
  } catch (error) {
    console.error("Error classifying email:", error);
    return {
      type: "TRANSACTIONAL" as EmailType,
      confidence: 0.5,
      reasoning: "Classification failed, defaulting to transactional",
    };
  }
}

// ============================================================================
// IMPROVE EMAIL
// ============================================================================

export interface ImproveEmailInput {
  content: string;
  improvements: string[];
}

export async function improveEmail(input: ImproveEmailInput): Promise<{
  success: boolean;
  improvedContent?: string;
  suggestions?: string[];
  error?: string;
}> {
  try {
    await requireAuth();
    const openai = getOpenAIClient();

    if (!openai) {
      return { success: false, error: "AI service is not available" };
    }

    const systemPrompt = `You are an expert email editor. Improve the given email content based on the requested improvements.
    
Maintain the original message and intent while making the requested changes.
Return HTML with inline styles for email compatibility.`;

    const userPrompt = `Improve this email with the following changes:
${input.improvements.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}

Current content:
${input.content}

Return the improved HTML content.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 2000,
    });

    const improvedContent = completion.choices[0]?.message?.content;
    if (!improvedContent) {
      return { success: false, error: "No improved content generated" };
    }

    return {
      success: true,
      improvedContent,
      suggestions: input.improvements,
    };
  } catch (error) {
    console.error("Error improving email:", error);
    return { success: false, error: "Failed to improve email" };
  }
}

// ============================================================================
// GENERATE SUBJECT LINE SUGGESTIONS
// ============================================================================

export async function generateSubjectLines(content: string): Promise<{
  success: boolean;
  subjects?: string[];
  error?: string;
}> {
  try {
    await requireAuth();
    const openai = getOpenAIClient();

    if (!openai) {
      return { success: false, error: "AI service is not available" };
    }

    const systemPrompt = `You are an email subject line expert. Generate 5 compelling subject lines that:
1. Are concise (under 50 characters ideal, max 100)
2. Create urgency or curiosity when appropriate
3. Accurately represent the content
4. Avoid spam trigger words
5. Are personalized when possible

Return a JSON object with a "subjects" array of 5 subject line strings.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate subject lines for this email:\n\n${content.substring(0, 1000)}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return { success: false, error: "No subject lines generated" };
    }

    const parsed = JSON.parse(response);
    const subjects = parsed.subjects || parsed.subjectLines || Object.values(parsed).flat();

    return {
      success: true,
      subjects: Array.isArray(subjects) ? subjects.slice(0, 5) : [],
    };
  } catch (error) {
    console.error("Error generating subject lines:", error);
    return { success: false, error: "Failed to generate subject lines" };
  }
}

// ============================================================================
// RATE AI GENERATION
// ============================================================================

export async function rateEmailGeneration(
  generationId: string,
  rating: number,
  feedback?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    // Verify the generation belongs to the user
    const generation = await prisma.emailGeneration.findFirst({
      where: { id: generationId, createdBy: user.id },
    });

    if (!generation) {
      return { success: false, error: "Generation not found" };
    }

    await prisma.emailGeneration.update({
      where: { id: generationId },
      data: { rating, feedback },
    });

    return { success: true };
  } catch (error) {
    console.error("Error rating generation:", error);
    return { success: false, error: "Failed to save rating" };
  }
}
