'use server';

import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/auth/supabase-server';
import { analyzeDocument, quickAnalysisCheck, generateValidationRules } from '@/lib/services/document-analysis-service';
import { 
  DocumentAnalysisResult, 
  AnalyzeDocumentRequest,
  AnalysisStatus,
  DocumentValidationRule 
} from '@/lib/types/document-analysis';
import { revalidatePath } from 'next/cache';

// ============================================================================
// GET CURRENT USER
// ============================================================================

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ============================================================================
// ANALYZE SUBMITTED DOCUMENT
// ============================================================================

interface AnalyzeSubmissionInput {
  submissionId: string;
}

export async function analyzeDocumentSubmission(input: AnalyzeSubmissionInput) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get the submission
    const submission = await prisma.documentSubmission.findUnique({
      where: { id: input.submissionId },
      include: {
        assignment: {
          include: {
            template: true,
          },
        },
      },
    });

    if (!submission) {
      return { success: false, error: 'Submission not found' };
    }

    // Get user record
    const userRecord = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { role: true },
    });

    if (!userRecord) {
      return { success: false, error: 'User not found' };
    }

    // Check if user has permission
    if (submission.userId !== authUser.id) {
      // Check if user is a manager/admin
      if (!['ADMIN', 'MANAGER'].includes(userRecord.role.name)) {
        return { success: false, error: 'Unauthorized' };
      }
    }

    // Check if there's a PDF to analyze
    if (!submission.pdfUrl) {
      return { success: false, error: 'No document to analyze' };
    }

    // Check if template exists
    const template = submission.assignment.template;
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    // Update status to analyzing (using raw query until Prisma is regenerated)
    await prisma.$executeRaw`
      UPDATE document_submissions 
      SET ai_analysis_status = 'ANALYZING'
      WHERE id = ${input.submissionId}
    `;

    // Get validation rules from template
    let validationRules: DocumentValidationRule[] = [];
    
    if (template.formSchema) {
      // Extract validation rules from form schema
      const schema = template.formSchema as { fields?: Array<{ id: string; label: string; type: string; required?: boolean }> };
      if (schema.fields) {
        validationRules = schema.fields.map(field => ({
          fieldId: field.id,
          fieldName: field.label,
          fieldType: mapFieldType(field.type),
          required: field.required || false,
        }));
      }
    }

    // Run analysis
    const analysisRequest: AnalyzeDocumentRequest = {
      submissionId: input.submissionId,
      pdfUrl: submission.pdfUrl,
      templateId: template.id,
      validationRules,
      options: {
        extractText: true,
        detectFields: true,
        validateFields: true,
        ocrEnabled: true,
      },
    };

    const result = await analyzeDocument(analysisRequest);

    // Update submission with results (using raw query until Prisma is regenerated)
    await prisma.$executeRaw`
      UPDATE document_submissions 
      SET 
        ai_analysis_status = ${result.status},
        ai_analysis_result = ${JSON.stringify(result)}::jsonb,
        ai_completeness_score = ${result.completenessScore},
        ai_confidence_score = ${result.confidenceScore},
        ai_analyzed_at = ${result.analyzedAt},
        ai_analysis_errors = ${result.issues.length > 0 ? JSON.stringify({ issues: result.issues }) : null}::jsonb,
        status = ${result.completenessScore >= 80 ? 'APPROVED' : 'NEEDS_REVISION'}::text
      WHERE id = ${input.submissionId}
    `;

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        resourceType: 'SUBMISSION',
        resourceId: input.submissionId,
        action: 'REVIEWED',
        description: `AI analysis completed. Completeness: ${result.completenessScore}%`,
        userId: authUser.id,
        newValue: JSON.parse(JSON.stringify(result)),
        submissionId: input.submissionId,
      },
    });

    revalidatePath('/manage/documents');
    revalidatePath(`/manage/documents/${template.id}`);

    return {
      success: true,
      data: {
        submissionId: input.submissionId,
        status: result.status,
        completenessScore: result.completenessScore,
        confidenceScore: result.confidenceScore,
        issues: result.issues,
        summary: result.summary,
      },
    };
  } catch (error) {
    console.error('Document analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze document',
    };
  }
}

// ============================================================================
// GET ANALYSIS STATUS
// ============================================================================

interface GetAnalysisStatusInput {
  submissionId: string;
}

export async function getAnalysisStatus(input: GetAnalysisStatusInput) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    // Use raw query to get analysis fields
    const submissions = await prisma.$queryRaw<Array<{
      id: string;
      ai_analysis_status: string | null;
      ai_completeness_score: number | null;
      ai_confidence_score: number | null;
      ai_analyzed_at: Date | null;
      ai_analysis_result: unknown | null;
      status: string;
    }>>`
      SELECT 
        id,
        ai_analysis_status,
        ai_completeness_score,
        ai_confidence_score,
        ai_analyzed_at,
        ai_analysis_result,
        status
      FROM document_submissions
      WHERE id = ${input.submissionId}
    `;

    const submission = submissions[0];
    if (!submission) {
      return { success: false, error: 'Submission not found' };
    }

    return {
      success: true,
      data: {
        submissionId: submission.id,
        status: submission.ai_analysis_status as AnalysisStatus | null,
        completenessScore: submission.ai_completeness_score,
        confidenceScore: submission.ai_confidence_score,
        analyzedAt: submission.ai_analyzed_at,
        result: submission.ai_analysis_result as DocumentAnalysisResult | null,
        submissionStatus: submission.status,
      },
    };
  } catch (error) {
    console.error('Get analysis status error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get analysis status',
    };
  }
}

// ============================================================================
// QUICK COMPLETENESS CHECK
// ============================================================================

interface QuickCheckInput {
  pdfUrl: string;
}

export async function quickCompletenessCheckAction(input: QuickCheckInput) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    const result = await quickAnalysisCheck(input.pdfUrl);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('Quick check error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check document',
    };
  }
}

// ============================================================================
// GENERATE VALIDATION RULES FROM TEMPLATE
// ============================================================================

interface GenerateRulesInput {
  templateId: string;
  pdfUrl: string;
}

export async function generateTemplateValidationRules(input: GenerateRulesInput) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check if user is admin or manager
    const userRecord = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { role: true },
    });

    if (!userRecord || !['ADMIN', 'MANAGER'].includes(userRecord.role.name)) {
      return { success: false, error: 'Unauthorized - Admin or Manager role required' };
    }

    const rules = await generateValidationRules(input.pdfUrl);

    // Update template with validation rules
    if (rules.length > 0) {
      await prisma.documentTemplate.update({
        where: { id: input.templateId },
        data: {
          formSchema: {
            fields: rules.map(rule => ({
              id: rule.fieldId,
              label: rule.fieldName,
              type: rule.fieldType,
              required: rule.required,
            })),
          },
        },
      });
    }

    return {
      success: true,
      data: rules,
    };
  } catch (error) {
    console.error('Generate validation rules error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate validation rules',
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapFieldType(type: string): 'text' | 'checkbox' | 'signature' | 'date' | 'select' {
  const typeMap: Record<string, 'text' | 'checkbox' | 'signature' | 'date' | 'select'> = {
    text: 'text',
    textarea: 'text',
    email: 'text',
    phone: 'text',
    number: 'text',
    checkbox: 'checkbox',
    toggle: 'checkbox',
    signature: 'signature',
    date: 'date',
    datetime: 'date',
    select: 'select',
    multiselect: 'select',
    radio: 'select',
  };

  return typeMap[type] || 'text';
}
