# Document Management System

A comprehensive, enterprise-grade document management and onboarding system built entirely in-house with AI-powered features.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Installation](#installation)
5. [API Documentation](#api-documentation)
6. [Component Usage Guide](#component-usage-guide)
7. [Integration Instructions](#integration-instructions)
8. [Security](#security)
9. [Performance](#performance)
10. [Testing](#testing)

---

## Overview

The Document Management System provides a complete solution for creating, assigning, tracking, and managing documents for staff onboarding and compliance. Key capabilities include:

- **PDF Processing**: Upload, render, fill, and generate PDFs
- **Form Builder**: Drag-and-drop form creation with 15+ field types
- **AI Integration**: Automatic field detection and form generation from PDFs
- **Signature Capture**: In-house signature pad with verification
- **Document Bundles**: Group documents into packages for bulk assignment
- **Analytics & Reporting**: Track completion rates and compliance
- **Audit Trail**: Complete history of all document actions

### Document Types Supported

| Type | Description | Interactive | Signable | Uploadable |
|------|-------------|-------------|----------|------------|
| **Fillable PDF** | PDF with form fields | Yes | Yes | Yes |
| **Static PDF** | Non-fillable PDF | No (overlay only) | Yes | Yes |
| **AI-Generated Form** | Form created from PDF analysis | Yes | Yes | No |
| **Manual Form** | Form built from scratch | Yes | Yes | No |
| **External Link** | Link to external resource | No | No | No |

---

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Templates  │  │ Assignments │  │  Analytics  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Form Builder│  │  PDF Viewer │  │  Signatures │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                        Server Actions                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ templates.ts │ assignments.ts │ analytics.ts │ bundles.ts  ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                         Core Libraries                           │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐ │
│  │ pdf-render │ │ pdf-gen    │ │ ai-detect  │ │ performance  │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                      Storage & Database                          │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │   Supabase Storage  │  │      PostgreSQL (Prisma)        │  │
│  │   - PDFs            │  │      - Templates                │  │
│  │   - Signatures      │  │      - Assignments              │  │
│  │   - Attachments     │  │      - Submissions              │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── app/
│   ├── system/documents/          # Admin document management
│   └── my/documents/              # Staff document portal
├── components/
│   └── documents/
│       ├── form-builder/          # Form builder components
│       ├── pdf-viewer/            # PDF viewing components
│       ├── signatures/            # Signature capture
│       ├── skeletons/             # Loading state skeletons
│       └── ErrorBoundary.tsx      # Error handling
├── lib/
│   ├── actions/documents/         # Server actions
│   │   ├── templates.ts           # Template CRUD
│   │   ├── assignments.ts         # Assignment management
│   │   ├── bundles.ts             # Bundle operations
│   │   └── analytics.ts           # Analytics queries
│   └── documents/                 # Core libraries
│       ├── pdf-renderer.ts        # PDF.js integration
│       ├── pdf-generation.ts      # pdf-lib integration
│       ├── ai-field-detection.ts  # AI field detection
│       ├── performance.ts         # Performance utilities
│       ├── security.ts            # Security utilities
│       └── accessibility.ts       # Accessibility utilities
└── __tests__/
    ├── integration/documents/     # Integration tests
    └── e2e/documents/             # E2E tests
```

---

## Features

### Phase 1: Foundation
- ✅ Database schema with versioning
- ✅ Supabase storage bucket setup
- ✅ RBAC permissions
- ✅ Basic template CRUD
- ✅ Assignment system

### Phase 2: Form Builder
- ✅ Drag-and-drop form builder
- ✅ 15+ field types
- ✅ Validation engine
- ✅ Conditional logic
- ✅ Auto-save drafts

### Phase 3: PDF Integration
- ✅ PDF upload and storage
- ✅ PDF.js rendering
- ✅ Fillable field extraction
- ✅ PDF pre-population
- ✅ Filled PDF generation

### Phase 4: AI Features
- ✅ AI field detection
- ✅ Form generation from PDF
- ✅ Change detection
- ✅ Overlay field creation

### Phase 5: Signatures & Uploads
- ✅ Signature pad
- ✅ Photo capture
- ✅ File attachments
- ✅ Print-only confirmation

### Phase 6: Bundles & Workflows
- ✅ Document bundles
- ✅ Bundle assignment
- ✅ Reminder system
- ✅ Due date tracking
- ✅ Bulk operations

### Phase 7: Analytics & Reporting
- ✅ Completion analytics
- ✅ Audit log system
- ✅ CSV export
- ✅ Dashboard widgets

### Phase 8: Polish & Testing
- ✅ Performance optimization
- ✅ Security enhancements
- ✅ Error boundaries
- ✅ Loading skeletons
- ✅ Accessibility improvements
- ✅ Documentation
- ✅ Integration tests
- ✅ E2E tests

---

## Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Supabase account (for storage)

### Setup

1. **Run database migrations**

```bash
npx prisma migrate dev --name document-management
```

2. **Set up Supabase storage bucket**

Run the SQL script in `scripts/setup-document-storage.sql` in your Supabase dashboard.

3. **Seed permissions**

```bash
npx tsx scripts/seed-document-permissions.ts
```

4. **Configure environment variables**

```env
# Supabase (for file storage)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (for AI features)
OPENAI_API_KEY=your-openai-api-key

# Upstash Redis (for caching/rate limiting - optional)
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

---

## API Documentation

### Template Actions

#### Create Template

```typescript
import { createTemplate } from '@/lib/actions/documents/templates';

const result = await createTemplate({
  name: 'WHS Safety Form',
  description: 'Workplace Health and Safety acknowledgment',
  category: 'COMPLIANCE',
  documentType: 'FORM',
  venueId: 'venue-id',
  formSchema: {
    fields: [
      { id: 'name', type: 'text', label: 'Full Name', required: true },
      { id: 'signature', type: 'signature', label: 'Signature', required: true }
    ]
  },
  requireSignature: true,
});
```

#### Get Templates by Venue

```typescript
import { getTemplates } from '@/lib/actions/documents/templates';

const templates = await getTemplates({
  venueId: 'venue-id',
  category: 'COMPLIANCE',
  includeInactive: false,
});
```

### Assignment Actions

#### Create Assignment

```typescript
import { createAssignment } from '@/lib/actions/documents/assignments';

const assignment = await createAssignment({
  templateId: 'template-id',
  userId: 'user-id',
  venueId: 'venue-id',
  dueDate: new Date('2025-03-01'),
  notes: 'Please complete by end of month',
});
```

#### Get User Assignments

```typescript
import { getUserAssignments } from '@/lib/actions/documents/assignments';

const assignments = await getUserAssignments({
  status: ['PENDING', 'IN_PROGRESS'],
  includeSubmissions: true,
});
```

### Submission Actions

#### Submit Form

```typescript
import { submitForm } from '@/lib/actions/documents/assignments';

const result = await submitForm({
  assignmentId: 'assignment-id',
  formData: {
    name: 'John Doe',
    email: 'john@example.com',
    signature: 'data:image/png;base64,...',
  },
});
```

### Analytics Actions

#### Get Completion Stats

```typescript
import { getCompletionStats } from '@/lib/actions/documents/analytics';

const stats = await getCompletionStats({
  venueId: 'venue-id',
  dateRange: {
    start: new Date('2025-01-01'),
    end: new Date('2025-01-31'),
  },
});
```

---

## Component Usage Guide

### Form Builder

```tsx
import { FormBuilder } from '@/components/documents/form-builder';

function CreateFormPage() {
  const handleSave = async (schema: FormSchema) => {
    await saveTemplate(schema);
  };

  return (
    <FormBuilder
      initialSchema={existingSchema}
      onSave={handleSave}
      availableFields={['text', 'email', 'phone', 'signature']}
    />
  );
}
```

### PDF Viewer

```tsx
import { PDFViewer } from '@/components/documents/pdf-viewer';
import { PDFErrorBoundary } from '@/components/documents/ErrorBoundary';

function ViewDocumentPage({ templateId }: { templateId: string }) {
  return (
    <PDFErrorBoundary>
      <PDFViewer
        templateId={templateId}
        mode="fill" // 'view' | 'fill' | 'sign'
        onSave={handleSave}
        showThumbnails={true}
        enableSearch={true}
      />
    </PDFErrorBoundary>
  );
}
```

### Signature Capture

```tsx
import { SignaturePad } from '@/components/documents/signatures';
import { SignatureErrorBoundary } from '@/components/documents/ErrorBoundary';

function SignatureField() {
  const handleSignature = (dataUrl: string) => {
    console.log('Signature captured:', dataUrl);
  };

  return (
    <SignatureErrorBoundary>
      <SignaturePad
        onSignature={handleSignature}
        width={400}
        height={150}
        penColor="#000000"
      />
    </SignatureErrorBoundary>
  );
}
```

### Loading States

```tsx
import {
  DocumentListSkeleton,
  FormBuilderSkeleton,
  PDFViewerSkeleton,
  AnalyticsSkeleton,
} from '@/components/documents/skeletons';

function LoadingPage() {
  return (
    <div>
      {/* Document list loading */}
      <DocumentListSkeleton count={5} view="table" />

      {/* Form builder loading */}
      <FormBuilderSkeleton fieldCount={6} showSidebar={true} />

      {/* PDF viewer loading */}
      <PDFViewerSkeleton showToolbar={true} showSidebar={true} />

      {/* Analytics loading */}
      <AnalyticsSkeleton showCharts={true} showTables={true} />
    </div>
  );
}
```

### Error Boundaries

```tsx
import {
  DocumentErrorBoundary,
  FormErrorBoundary,
  PDFErrorBoundary,
  UploadErrorBoundary,
} from '@/components/documents/ErrorBoundary';

// Wrap components with appropriate error boundary
<DocumentErrorBoundary
  componentName="Document Dashboard"
  operationType="view"
  onRetry={() => window.location.reload()}
>
  <DocumentDashboard />
</DocumentErrorBoundary>
```

---

## Integration Instructions

### Adding Document Management to a Venue

1. **Create templates for the venue**

```typescript
// Create a new template
const template = await createTemplate({
  name: 'Employee Handbook Acknowledgment',
  venueId: venue.id,
  documentType: 'PDF',
  pdfUrl: uploadedPdfUrl,
  requireSignature: true,
});
```

2. **Create a bundle for onboarding**

```typescript
// Create bundle
const bundle = await createBundle({
  name: 'New Employee Onboarding',
  venueId: venue.id,
  items: [
    { templateId: template1.id, order: 1, required: true },
    { templateId: template2.id, order: 2, required: true },
  ],
  dueWithinDays: 14,
});
```

3. **Assign to users**

```typescript
// Assign bundle to new employee
await assignBundle({
  bundleId: bundle.id,
  userId: newEmployee.id,
  venueId: venue.id,
});
```

### Setting Up Notifications

The system integrates with the existing Brevo email service:

```typescript
import { sendDocumentNotification } from '@/lib/services/email/brevo';

// Notification types are handled automatically:
// - DocumentAssigned
// - DocumentDueSoon
// - DocumentOverdue
// - DocumentSubmitted
// - DocumentApproved
// - DocumentRejected
```

### Webhook Integration

```typescript
// Set up webhooks for external systems
const webhookConfig = {
  url: 'https://your-system.com/webhook',
  events: [
    'document.submitted',
    'document.approved',
    'document.rejected',
    'assignment.created',
  ],
  secret: 'your-webhook-secret',
};
```

---

## Security

### File Validation

All uploaded files are validated using magic number checking:

```typescript
import { validatePDFFile, validateImageFile } from '@/lib/documents/security';

// Validate PDF
const pdfResult = await validatePDFFile(file);
if (!pdfResult.valid) {
  console.error('Invalid PDF:', pdfResult.errors);
}

// Validate image
const imageResult = await validateImageFile(file);
if (!imageResult.valid) {
  console.error('Invalid image:', imageResult.errors);
}
```

### XSS Prevention

All user content is sanitized:

```typescript
import { sanitizeFieldContent, sanitizeFormData } from '@/lib/documents/security';

// Sanitize single field
const safeContent = sanitizeFieldContent(userInput, {
  allowHtml: false,
  maxLength: 1000,
});

// Sanitize form data
const safeData = sanitizeFormData(formData);
```

### Rate Limiting

Document operations are rate-limited:

```typescript
import { checkRateLimit } from '@/lib/documents/security';

// Check rate limit before operation
const { allowed, resetIn } = await checkRateLimit('submission', userId);
if (!allowed) {
  throw new Error(`Rate limit exceeded. Try again in ${resetIn}ms`);
}
```

### CSRF Protection

```typescript
import { createCSRFToken, verifyCSRFToken } from '@/lib/documents/security';

// Create token
const { token } = createCSRFToken(secret, sessionId);

// Verify token
const { valid, error } = verifyCSRFToken(token, secret, sessionId);
```

---

## Performance

### Caching Strategy

```typescript
import { documentCacheKeys, invalidateDocumentCache } from '@/lib/documents/performance';

// Cache template data
const template = await cache.getOrSet(
  documentCacheKeys.template(templateId),
  () => fetchTemplate(templateId),
  documentCacheTTL.template
);

// Invalidate cache on update
await invalidateDocumentCache.template(templateId);
```

### Auto-Save Configuration

```typescript
import { createAutoSave } from '@/lib/documents/performance';

const autoSave = createAutoSave(
  async (data) => {
    await saveDraft(data);
  },
  {
    debounceMs: 1000,
    maxWaitMs: 30000,
    localStorageBackup: true,
  }
);

// Trigger save
autoSave.save(formData);

// Flush pending saves
await autoSave.flush();
```

### Virtual Scrolling

For long lists of fields or documents:

```typescript
import { calculateVisibleRange } from '@/lib/documents/performance';

const { startIndex, endIndex } = calculateVisibleRange(
  scrollTop,
  { itemHeight: 60, overscan: 5, containerHeight: 400 },
  totalItems
);
```

---

## Testing

### Integration Tests

Located in `__tests__/integration/documents/`:

```typescript
// template-crud.test.ts
describe('Template CRUD Operations', () => {
  it('should create a new template', async () => {
    const template = await createTemplate({
      name: 'Test Template',
      venueId: testVenue.id,
      documentType: 'FORM',
    });
    expect(template.id).toBeDefined();
  });
});
```

### E2E Tests

Located in `__tests__/e2e/documents/`:

```typescript
// document-lifecycle.spec.ts
describe('Document Lifecycle', () => {
  it('should complete full document lifecycle', async () => {
    // Create template
    // Assign to user
    // User fills form
    // Submit
    // Review
    // Approve
  });
});
```

### Running Tests

```bash
# Run integration tests
npm run test:integration -- --grep documents

# Run E2E tests
npm run test:e2e -- --grep documents
```

---

## Support

For issues or questions:

1. Check the [Architecture Document](/plans/document-management-architecture-v2.md)
2. Review the [API Documentation](#api-documentation)
3. Contact the development team

---

*Last Updated: February 2025*
*Version: 1.0.0*