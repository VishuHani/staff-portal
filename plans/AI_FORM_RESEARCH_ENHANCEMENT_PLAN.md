# AI Form Generation Enhancement Plan: Online Research Capability

## Executive Summary

This plan outlines the enhancement of the AI form generation feature to include online research capability. This will allow users to create more comprehensive, compliant, and industry-standard forms by leveraging web search to gather relevant information about form requirements, best practices, and compliance standards.

---

## Current Implementation Analysis

### What's Already Implemented

1. **AI Form Generation from Description** ([`ai-form-generation.ts`](src/lib/actions/documents/ai-form-generation.ts:167-279))
   - Uses OpenAI GPT-4-turbo-preview
   - Accepts natural language description
   - Generates complete form schema with fields, validation, and settings
   - Returns structured `FormSchema` object

2. **AI Form Generation from PDF** ([`ai-form-generation.ts`](src/lib/actions/documents/ai-form-generation.ts:68-157))
   - Extracts fillable fields from PDFs using pdf-lib
   - Uses GPT-4o Vision for non-fillable PDFs
   - Detects field types, labels, and positions

3. **Comprehensive Prompt System** ([`ai-prompts.ts`](src/lib/documents/ai-prompts.ts))
   - Structure detection prompts
   - Field detection prompts
   - Form generation prompts
   - Fallback detection using regex patterns

4. **UI Components**
   - [`AIFormGenerator.tsx`](src/components/documents/form-builder/AIFormGenerator.tsx) - Standalone generator component
   - [`new-template-client.tsx`](src/app/manage/documents/new/new-template-client.tsx) - Template creation page with AI tab
   - [`FormCreationWizard.tsx`](src/components/documents/form-creation/FormCreationWizard.tsx) - Multi-step form creation wizard

### Current Limitations

1. **No External Knowledge Access** - AI only knows what's in the training data
2. **No Compliance Research** - Cannot look up legal/regulatory requirements
3. **No Industry Standards** - Cannot reference best practices for specific form types
4. **No Template Suggestions** - Cannot suggest fields based on form category
5. **Limited Context** - Only uses user's description without enrichment

---

## Enhancement Plan

### Phase 1: Research Infrastructure (Backend)

#### 1.1 Web Search Service Integration

**Selected: OpenAI Built-in Browsing (Recommended)**
- Uses existing OpenAI API key (already configured)
- No additional API subscription needed
- GPT-4o has built-in web search capability via tools
- Simplified architecture - single AI provider
- Higher cost per request but no separate API management

**How OpenAI Web Search Works:**
1. Use GPT-4o with `tools` parameter including web search
2. OpenAI automatically searches the web when needed
3. Returns grounded responses with source citations
4. Can be configured with `response_format` for structured output

**Alternative Options (Not Selected):**
- **Tavily API** - Purpose-built for AI, requires separate API key
- **Serper API** - Google Search results, requires separate API key

#### 1.2 Create Research Service

```typescript
// src/lib/services/web-research-service.ts

interface ResearchResult {
  query: string;
  summary: string;
  sources: {
    title: string;
    url: string;
    snippet: string;
  }[];
  keyFacts: string[];
  complianceRequirements?: string[];
  industryStandards?: string[];
}

export async function researchFormRequirements(
  formDescription: string,
  options?: {
    includeCompliance?: boolean;
    includeBestPractices?: boolean;
    industry?: string;
    region?: string;
  }
): Promise<ResearchResult>
```

#### 1.3 Research Cache System

- Cache research results to avoid redundant API calls
- Use Redis or in-memory cache with TTL
- Key: hash of form description + options
- TTL: 24 hours

### Phase 2: Enhanced AI Generation

#### 2.1 Research-Enhanced Prompts

Update the system prompt to incorporate research findings:

```typescript
const enhancedSystemPrompt = `You are a form schema generator with access to research data.

Research Findings:
${researchResult.summary}

Key Facts:
${researchResult.keyFacts.join('\n')}

Compliance Requirements:
${researchResult.complianceRequirements?.join('\n') || 'None specific found'}

Industry Standards:
${researchResult.industryStandards?.join('\n') || 'None specific found'}

Generate a comprehensive form schema that:
1. Includes all standard fields for this form type
2. Incorporates compliance requirements
3. Follows industry best practices
4. Has appropriate validation rules
...`;
```

#### 2.2 Multi-Step Generation Process

1. **Analyze Request** - Parse user's description
2. **Research Phase** - Search for relevant information
3. **Synthesis Phase** - Combine research with AI knowledge
4. **Generation Phase** - Create form schema
5. **Validation Phase** - Ensure completeness

#### 2.3 New Server Action

```typescript
// src/lib/actions/documents/ai-form-generation.ts

interface GenerateFormWithResearchOptions {
  name?: string;
  enableResearch?: boolean;
  industry?: string;
  region?: string;
  researchDepth?: 'quick' | 'standard' | 'comprehensive';
}

export async function generateFormFromDescriptionWithResearch(
  description: string,
  options?: GenerateFormWithResearchOptions
): Promise<ActionResult<FormSchema & { researchMetadata?: ResearchMetadata }>>
```

### Phase 3: UI Enhancements

#### 3.1 Research Toggle in AI Generator

Add a toggle to enable/disable research (disabled by default):
- Toggle is OFF by default - user must opt-in
- Show when research is in progress
- Display research findings summary
- Allow user to review before generating

#### 3.2 Research Progress Indicator

```
🔍 Researching form requirements...
  ✓ Found 5 compliance requirements
  ✓ Found 12 industry standard fields
  ✓ Found 3 validation rules
```

#### 3.3 Research Preview Panel

Show research findings before form generation:
- Summary of findings
- Sources used
- Key fields identified
- Compliance notes

#### 3.4 Enhanced Form Preview

After generation, show:
- Which fields came from research
- Compliance notes for specific fields
- Links to sources for more information

### Phase 4: Compliance Database

#### 4.1 Built-in Compliance Rules

Create a database of common compliance requirements:

```typescript
// src/lib/documents/compliance-rules.ts

export const complianceRules = {
  'employment-application': {
    regions: {
      'US': {
        prohibitedFields: ['age', 'marital_status', 'religion'],
        requiredFields: ['eeo_statement'],
        recommendedFields: ['ada_accommodation']
      },
      'EU': {
        requiredFields: ['gdpr_consent'],
        prohibitedFields: ['race', 'ethnic_origin']
      },
      'AU': {
        requiredFields: ['privacy_statement'],
        recommendedFields: ['diversity_statement']
      }
    }
  },
  'medical-form': {
    regions: {
      'US': {
        requiredFields: ['hipaa_notice'],
        validationRules: { 'ssn': 'encrypted' }
      }
    }
  }
};
```

#### 4.2 Form Type Detection

Automatically detect form type from description:
- Employment application
- Medical/Patient form
- Financial application
- Legal contract
- Survey/Feedback
- Registration form
- etc.

### Phase 5: Implementation Details

#### 5.1 File Structure

```
src/lib/services/
  web-research-service.ts      # Web search integration
  research-cache.ts            # Caching layer
  
src/lib/actions/documents/
  ai-form-generation.ts        # Enhanced with research
  research-actions.ts          # Research-specific actions
  
src/lib/documents/
  compliance-rules.ts          # Built-in compliance DB
  form-type-detection.ts       # Auto-detect form type
  
src/components/documents/form-builder/
  ResearchPanel.tsx            # Research preview UI
  ResearchProgress.tsx         # Progress indicator
  ComplianceBadge.tsx          # Compliance indicator
```

#### 5.2 Environment Variables

```env
# OpenAI API key (already configured - used for both AI and web search)
OPENAI_API_KEY=sk-xxxxx

# Research feature configuration
RESEARCH_ENABLED=true
RESEARCH_CACHE_TTL=86400  # 24 hours
RESEARCH_CACHE_ENABLED=true
```

#### 5.3 API Costs Estimation

| Service | Pricing Model | Estimated Cost |
|---------|---------------|----------------|
| OpenAI GPT-4o | ~$2.50/1M input tokens, $10/1M output tokens | ~$0.05-0.15 per research request |
| OpenAI GPT-4o-mini | ~$0.15/1M input tokens, $0.60/1M output tokens | ~$0.01-0.03 per research request |

**Estimated monthly cost:** $10-30 for moderate usage (using existing OpenAI API key)

---

## Implementation Timeline

### Week 1: Backend Infrastructure
- [ ] Create web research service
- [ ] Implement Tavily API integration
- [ ] Add caching layer
- [ ] Create research actions

### Week 2: Enhanced Generation
- [ ] Update AI prompts with research context
- [ ] Implement multi-step generation
- [ ] Add compliance rules database
- [ ] Create form type detection

### Week 3: UI Components
- [ ] Add research toggle to AI generator
- [ ] Create research progress indicator
- [ ] Build research preview panel
- [ ] Add compliance badges

### Week 4: Testing & Polish
- [ ] Test with various form types
- [ ] Optimize research queries
- [ ] Add error handling
- [ ] Documentation

---

## Success Metrics

1. **Form Completeness** - Forms generated with research should have more relevant fields
2. **Compliance Score** - Forms should meet regional/industry requirements
3. **User Satisfaction** - Reduced need for manual field additions
4. **Time Saved** - Faster form creation with pre-researched fields

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| API rate limits | Implement caching, graceful degradation |
| Inaccurate research | Show sources, allow user review |
| Cost overruns | Set usage limits, monitor spending |
| Slow generation | Async processing, progress indicators |
| Irrelevant results | Query optimization, result filtering |

---

## Next Steps

1. ~~Approve Plan~~ - ✅ Approved with OpenAI and disabled by default
2. ~~Set Up API Keys~~ - ✅ Using existing OpenAI API key
3. **Start Implementation** - Begin with Phase 1 (Backend Infrastructure)

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Search API | OpenAI Built-in | Uses existing API key, simplified architecture |
| Default State | Disabled (opt-in) | Reduces API costs, user choice |
| Caching | Global with TTL | Efficient, reduces redundant searches |
| Sources Display | Summary with expandable details | Clean UI, detailed info available |
