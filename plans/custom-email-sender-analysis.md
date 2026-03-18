# Custom Email Sender System - Detailed Architecture Plan

## Overview

A comprehensive email broadcasting system with AI-assisted email building, recipient targeting, and marketing/transactional classification. This system will enable Staff Portal administrators and venue managers to create beautiful, targeted email communications.

---

## Core Features

### 1. Email Builder with AI Assistance
- Rich HTML editor with full customizability
- Support for GIFs, images, custom code, responsive design
- AI assistant to help generate email content
- AI-powered classification (Marketing vs Transactional)
- Real-time preview

### 2. Recipient Targeting System
- Select users by role (Admin, Manager, Staff)
- Select by venue assignment
- Select by user status (active, inactive, pending)
- Select by notification preferences
- Custom segment builder (e.g., users who joined in last 30 days)
- Preview recipient count before sending

### 3. Email Classification
- **Marketing**: Promotional content, feature announcements, newsletters
- **Transactional**: System notifications, time-off approvals, roster updates
- AI scans and recommends classification
- Manual override capability

### 4. Use Cases
- New feature announcements
- Important system notifications
- Venue-specific urgent notifications
- Onboarding communications
- Policy updates
- Event invitations

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     EMAIL SENDER SYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Email      │    │   Recipient  │    │     AI       │      │
│  │   Builder    │───▶│   Targeting  │───▶│  Assistant   │      │
│  │   (UI)       │    │   System     │    │              │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    PREVIEW & CLASSIFY                    │   │
│  │  - Email preview (desktop/mobile)                        │   │
│  │  - Recipient list preview                                │   │
│  │  - AI classification result                              │   │
│  │  - Spam score check                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    SEND / SCHEDULE                       │   │
│  │  - Send immediately                                      │   │
│  │  - Schedule for later                                    │   │
│  │  - Save as draft                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    BREVO API                             │   │
│  │  - Email delivery                                        │   │
│  │  - Tracking (opens, clicks)                              │   │
│  │  - Webhooks for status updates                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Models Required

```prisma
// Email Campaign/Broadcast
model EmailCampaign {
  id              String        @id @default(cuid())
  name            String        // Internal name
  subject         String
  previewText     String?       // Email preview text
  
  // Content
  htmlContent     String        @db.Text
  textContent     String?       @db.Text
  designJson      Json?         // Builder state for re-editing
  
  // Classification
  emailType       EmailType     @default(TRANSACTIONAL)
  aiClassification EmailType?   // AI suggested classification
  aiConfidence    Float?        // AI confidence score 0-1
  classificationReason String?  // Why AI chose this classification
  
  // Targeting
  targetRoles     String[]      // ["ADMIN", "MANAGER", "STAFF"]
  targetVenueIds  String[]      // Specific venues (empty = all)
  targetStatus    String[]      // ["ACTIVE", "INACTIVE"]
  customSegment   Json?         // Custom segment rules
  
  // Stats
  recipientCount  Int           @default(0)
  sentCount       Int           @default(0)
  deliveredCount  Int           @default(0)
  openedCount     Int           @default(0)
  clickedCount    Int           @default(0)
  bouncedCount    Int           @default(0)
  unsubscribedCount Int         @default(0)
  
  // Status
  status          CampaignStatus @default(DRAFT)
  scheduledAt     DateTime?
  sentAt          DateTime?
  
  // Ownership
  createdBy       String
  venueId         String?       // Null = system-wide, set = venue-specific
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  // Relations
  creator         User          @relation(fields: [createdBy], references: [id])
  venue           Venue?        @relation(fields: [venueId], references: [id])
  recipients      EmailRecipient[]
  analytics       EmailCampaignAnalytics?
  
  @@index([status])
  @@index([emailType])
  @@index([venueId])
  @@index([createdBy])
  @@map("email_campaigns")
}

// Individual recipient tracking
model EmailRecipient {
  id              String        @id @default(cuid())
  campaignId      String
  userId          String
  email           String
  name            String?
  
  // Delivery status
  status          EmailRecipientStatus @default(PENDING)
  brevoMessageId  String?
  
  // Tracking
  sentAt          DateTime?
  deliveredAt     DateTime?
  openedAt        DateTime?
  clickedAt       DateTime?
  clickedUrl      String?
  
  // Error tracking
  error           String?       @db.Text
  bounceReason    String?
  
  // Relations
  campaign        EmailCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  user            User          @relation(fields: [userId], references: [id])
  
  @@unique([campaignId, userId])
  @@index([campaignId])
  @@index([userId])
  @@index([status])
  @@map("email_recipients")
}

// Campaign analytics aggregation
model EmailCampaignAnalytics {
  id              String        @id @default(cuid())
  campaignId      String        @unique
  
  // Aggregate stats
  openRate        Float         @default(0)    // Percentage
  clickRate       Float         @default(0)    // Percentage
  bounceRate      Float         @default(0)    // Percentage
  unsubscribeRate Float         @default(0)    // Percentage
  
  // Device breakdown
  desktopOpens    Int           @default(0)
  mobileOpens     Int           @default(0)
  
  // Time-based analytics
  opensByHour     Json?         // { "0": 5, "1": 2, ... }
  clicksByDay     Json?         // { "Mon": 10, "Tue": 15, ... }
  
  // Geographic (if available)
  opensByCountry  Json?         // { "US": 50, "AU": 30, ... }
  
  updatedAt       DateTime      @updatedAt
  
  campaign        EmailCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  
  @@map("email_campaign_analytics")
}

// Email templates (reusable)
model EmailTemplate {
  id              String        @id @default(cuid())
  name            String
  description     String?
  category        String?       // "announcement", "notification", "marketing"
  
  // Content
  subject         String
  htmlContent     String        @db.Text
  designJson      Json?         // Builder state
  
  // Variables supported
  variables       String[]      // ["userName", "venueName", etc.]
  
  // Ownership
  isSystem        Boolean       @default(false)  // System templates can't be deleted
  venueId         String?       // Null = available to all
  createdBy       String
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  venue           Venue?        @relation(fields: [venueId], references: [id])
  creator         User          @relation(fields: [createdBy], references: [id])
  
  @@index([venueId])
  @@index([category])
  @@map("email_templates")
}

// AI generation history (for learning/improvement)
model EmailGeneration {
  id              String        @id @default(cuid())
  prompt          String        @db.Text
  generatedHtml   String        @db.Text
  generatedSubject String?
  modelUsed       String        // "gpt-4", "claude-3", etc.
  
  // User feedback
  rating          Int?          // 1-5 stars
  wasUsed         Boolean       @default(false)  // Was this generation used in a campaign?
  
  createdBy       String
  createdAt       DateTime      @default(now())
  
  user            User          @relation(fields: [createdBy], references: [id])
  
  @@map("email_generations")
}

// Enums
enum EmailType {
  TRANSACTIONAL
  MARKETING
}

enum CampaignStatus {
  DRAFT
  SCHEDULED
  SENDING
  SENT
  FAILED
  CANCELLED
}

enum EmailRecipientStatus {
  PENDING
  SENT
  DELIVERED
  OPENED
  CLICKED
  BOUNCED
  UNSUBSCRIBED
  FAILED
}
```

### Updates to Existing Models

```prisma
model User {
  // ... existing fields ...
  
  // Email preferences
  emailPreferences Json?         // { marketing: true, transactional: true }
  unsubscribedAt   DateTime?
  unsubscribedFrom String[]      // ["MARKETING", "ALL"]
  
  // Relations
  emailCampaigns   EmailRecipient[]
  emailGenerations EmailGeneration[]
  emailTemplates   EmailTemplate[]
}

model Venue {
  // ... existing fields ...
  
  // Relations
  emailCampaigns   EmailCampaign[]
  emailTemplates   EmailTemplate[]
}
```

---

## User Interface Design

### 1. Email Campaign List Page
**Route:** `/system/emails` or `/manage/emails`

Features:
- List all campaigns with status badges
- Filter by status, type, venue
- Search by name/subject
- Quick actions (duplicate, delete, view stats)
- Create new campaign button

### 2. Email Builder Page
**Route:** `/system/emails/new` or `/system/emails/[id]/edit`

#### Step 1: Compose Email
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Campaigns           Create Email Campaign            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Campaign Name                                           │   │
│  │  [March 2024 Feature Update                         ]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Subject Line                                           │   │
│  │  [🎉 New Features Available in Staff Portal          ]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Preview Text (shown in email client before open)       │   │
│  │  [Check out the latest updates to your portal...    ]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🤖 AI Assistant                              [Ask AI]  │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │ Describe what you want to create...               │  │   │
│  │  │                                                   │  │   │
│  │  │ Example: "Create an email announcing new shift    │  │   │
│  │  │ swap feature with a celebratory tone"             │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Email Content Editor                                   │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │ [B] [I] [U] [Link] [Image] [GIF] [Code] [Var]    │  │   │
│  │  ├───────────────────────────────────────────────────┤  │   │
│  │  │                                                   │  │   │
│  │  │     <h1>🎉 New Features!</h1>                     │  │   │
│  │  │     <p>Hello {{userName}},</p>                    │  │   │
│  │  │     <img src="feature-preview.gif">               │  │   │
│  │  │     ...                                           │  │   │
│  │  │                                                   │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                              [Next: Select Recipients →]        │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 2: Select Recipients
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back                    Select Recipients                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Target Audience                                         │   │
│  │                                                          │   │
│  │  ☑ By Role                                               │   │
│  │    ☑ Admin  ☑ Manager  ☐ Staff                          │   │
│  │                                                          │   │
│  │  ☑ By Venue                                              │   │
│  │    ☑ All Venues  or  ☐ Select Specific: [Dropdown]      │   │
│  │                                                          │   │
│  │  ☑ By Status                                             │   │
│  │    ☑ Active  ☐ Inactive  ☐ Pending                      │   │
│  │                                                          │   │
│  │  ☐ By Notification Preferences                           │   │
│  │    [Email notifications enabled]                         │   │
│  │                                                          │   │
│  │  ☐ Custom Segment (Advanced)                             │   │
│  │    [Users who joined in last 30 days]                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Recipient Preview                                       │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │  📊 Total Recipients: 156                         │  │   │
│  │  │                                                   │  │   │
│  │  │  By Role:                                         │  │   │
│  │  │    • Admins: 5                                   │  │   │
│  │  │    • Managers: 23                                │  │   │
│  │  │    • Staff: 128                                  │  │   │
│  │  │                                                   │  │   │
│  │  │  By Venue:                                        │  │   │
│  │  │    • Sydney CBD: 45                              │  │   │
│  │  │    • Melbourne: 38                               │  │   │
│  │  │    • ... (5 more venues)                         │  │   │
│  │  │                                                   │  │   │
│  │  │  [View Full List] [Export CSV]                   │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│              [← Back: Edit Content]  [Next: Preview & Send →]  │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 3: Preview & Send
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back                    Preview & Send                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🤖 AI Classification                                    │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │  Recommended: MARKETING                            │  │   │
│  │  │  Confidence: 92%                                   │  │   │
│  │  │                                                   │  │   │
│  │  │  Reason: Contains promotional language about new  │  │   │
│  │  │  features, uses celebratory tone, and includes    │  │   │
│  │  │  call-to-action encouraging feature adoption.     │  │   │
│  │  │                                                   │  │   │
│  │  │  [Change to TRANSACTIONAL]                        │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Email Preview                                           │   │
│  │  [Desktop] [Mobile]                                     │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │  ┌─────────────────────────────────────────────┐  │  │   │
│  │  │  │  Subject: 🎉 New Features Available...      │  │  │   │
│  │  │  ├─────────────────────────────────────────────┤  │  │   │
│  │  │  │                                             │  │  │   │
│  │  │  │     🎉 New Features!                        │  │  │   │
│  │  │  │                                             │  │  │   │
│  │  │  │     Hello John Doe,                         │  │  │   │
│  │  │  │                                             │  │  │   │
│  │  │  │     We're excited to announce...            │  │  │   │
│  │  │  │     [GIF showing feature]                   │  │  │   │
│  │  │  │                                             │  │  │   │
│  │  │  │     [View Features Button]                  │  │  │   │
│  │  │  │                                             │  │  │   │
│  │  │  └─────────────────────────────────────────────┘  │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Spam Check                                              │   │
│  │  ✅ Spam Score: 1/10 (Low risk)                         │   │
│  │  ✅ No broken links detected                            │   │
│  │  ✅ Images have alt text                                │   │
│  │  ⚠️ Consider adding plain text version                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Send Options                                            │   │
│  │                                                          │   │
│  │  ○ Send Now                                              │   │
│  │  ○ Schedule for later: [Date Picker] [Time Picker]      │   │
│  │  ○ Save as Draft                                         │   │
│  │  ○ Send Test Email to: [email input]                    │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│       [← Back: Recipients]  [Save Draft]  [🚀 Send Campaign]   │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Campaign Analytics Page
**Route:** `/system/emails/[id]/analytics`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Campaigns    Campaign Analytics                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  March 2024 Feature Update                                      │
│  Sent: March 15, 2024 at 10:00 AM                              │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │  Sent      │ │  Opened    │ │  Clicked   │ │  Bounced   │   │
│  │    156     │ │    98      │ │    45      │ │     2      │   │
│  │   100%     │ │   62.8%    │ │   28.8%    │ │   1.3%     │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Opens Over Time                                        │   │
│  │  [Chart showing open rate over 48 hours]                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │  Device Breakdown    │  │  Top Clicked Links   │            │
│  │  Desktop: 60%        │  │  1. View Features    │            │
│  │  Mobile: 40%         │  │  2. Learn More       │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Email Campaign Actions

```typescript
// src/lib/actions/email-campaigns.ts

// Create new campaign
export async function createEmailCampaign(data: CreateCampaignInput)

// Update campaign (draft only)
export async function updateEmailCampaign(id: string, data: UpdateCampaignInput)

// Delete campaign (draft only)
export async function deleteEmailCampaign(id: string)

// Get campaign by ID
export async function getEmailCampaign(id: string)

// List campaigns with filters
export async function getEmailCampaigns(filters: CampaignFilters)

// Preview recipients based on targeting
export async function previewCampaignRecipients(targeting: TargetingRules)

// AI generate email content
export async function generateEmailContent(prompt: string, context?: object)

// AI classify email
export async function classifyEmail(htmlContent: string, subject: string)

// Send test email
export async function sendTestEmail(campaignId: string, testEmail: string)

// Send campaign
export async function sendEmailCampaign(campaignId: string)

// Schedule campaign
export async function scheduleEmailCampaign(campaignId: string, scheduledAt: Date)

// Cancel scheduled campaign
export async function cancelEmailCampaign(campaignId: string)

// Get campaign analytics
export async function getCampaignAnalytics(campaignId: string)
```

### Email Template Actions

```typescript
// src/lib/actions/email-templates.ts

// Create template
export async function createEmailTemplate(data: CreateTemplateInput)

// Update template
export async function updateEmailTemplate(id: string, data: UpdateTemplateInput)

// Delete template
export async function deleteEmailTemplate(id: string)

// List templates
export async function getEmailTemplates(filters?: TemplateFilters)

// Get template by ID
export async function getEmailTemplate(id: string)
```

---

## AI Integration

### Email Generation

```typescript
// Using existing AI service
import { aiService } from '@/lib/services/ai-service';

interface EmailGenerationRequest {
  prompt: string;
  tone?: 'professional' | 'friendly' | 'urgent' | 'celebratory';
  includeImages?: boolean;
  targetAudience?: string;
  callToAction?: string;
}

async function generateEmail(request: EmailGenerationRequest) {
  const systemPrompt = `You are an expert email marketing copywriter. 
    Generate beautiful, engaging HTML emails that are mobile-responsive.
    Use inline CSS for styling. Include placeholders like {{userName}} for personalization.`;
  
  const response = await aiService.generateContent({
    systemPrompt,
    userPrompt: request.prompt,
    // ... other params
  });
  
  return {
    html: response.content,
    subject: response.subject,
    suggestedVariables: extractVariables(response.content),
  };
}
```

### Email Classification

```typescript
interface ClassificationResult {
  type: 'MARKETING' | 'TRANSACTIONAL';
  confidence: number;
  reason: string;
  suggestions?: string[];
}

async function classifyEmail(
  htmlContent: string, 
  subject: string
): Promise<ClassificationResult> {
  const prompt = `Analyze this email and classify it as MARKETING or TRANSACTIONAL.
    
    MARKETING: Promotional content, announcements, newsletters, feature updates, 
    anything encouraging engagement or adoption.
    
    TRANSACTIONAL: System notifications, account updates, approvals, receipts,
    time-sensitive operational information.
    
    Email Subject: ${subject}
    Email Content: ${htmlContent.substring(0, 2000)}
    
    Respond with JSON: { "type": "MARKETING|TRANSACTIONAL", "confidence": 0-1, "reason": "..." }`;
  
  // Call AI service
  const result = await aiService.generateContent({ prompt });
  
  return JSON.parse(result.content);
}
```

---

## Implementation Phases

### Phase 1: Database & Core Infrastructure
- [ ] Add Prisma models (EmailCampaign, EmailRecipient, EmailTemplate, etc.)
- [ ] Run migration
- [ ] Create base server actions for CRUD operations
- [ ] Update User model with email preferences

### Phase 2: Email Builder UI
- [ ] Create campaign list page
- [ ] Build step-by-step campaign wizard
- [ ] Integrate rich text editor (TipTap or similar)
- [ ] Add image/GIF upload support
- [ ] Implement variable insertion UI

### Phase 3: Recipient Targeting
- [ ] Build targeting rules engine
- [ ] Create recipient preview component
- [ ] Implement segment builder
- [ ] Add recipient count API

### Phase 4: AI Integration
- [ ] Connect to existing AI service
- [ ] Build email generation prompt templates
- [ ] Implement classification logic
- [ ] Add AI suggestions in UI

### Phase 5: Sending & Tracking
- [ ] Integrate with Brevo batch sending API
- [ ] Create email queue for large sends
- [ ] Set up Brevo webhooks for tracking
- [ ] Build analytics dashboard

### Phase 6: Templates & Polish
- [ ] Create reusable template system
- [ ] Add template library with defaults
- [ ] Implement scheduling system
- [ ] Add spam checking integration
- [ ] Final UI polish and testing

---

## Technical Considerations

### Email Rendering
- Use inline CSS for maximum compatibility
- Test across email clients (Gmail, Outlook, Apple Mail)
- Provide plain text fallback
- Keep emails under 100KB for deliverability

### Rate Limiting
- Brevo has daily/hourly limits based on plan
- Implement queue for large sends
- Batch sends (e.g., 100 emails per API call)

### Compliance
- Include unsubscribe link in all marketing emails
- Honor unsubscribe requests within 24 hours
- Include physical mailing address (CAN-SPAM requirement)
- Respect user email preferences

### Security
- Validate all user input before rendering
- Sanitize HTML to prevent XSS
- Rate limit campaign creation
- Audit log all campaign actions

---

## File Structure

```
src/
├── app/
│   ├── system/
│   │   └── emails/
│   │       ├── page.tsx                    # Campaign list
│   │       ├── new/
│   │       │   └── page.tsx                # Create campaign wizard
│   │       ├── [id]/
│   │       │   ├── page.tsx                # Edit campaign
│   │       │   └── analytics/
│   │       │       └── page.tsx            # Campaign analytics
│   │       └── templates/
│   │           ├── page.tsx                # Template library
│   │           └── [id]/
│   │               └── page.tsx            # Edit template
│   └── api/
│       └── webhooks/
│           └── brevo/
│               └── route.ts                # Brevo webhook handler
│
├── lib/
│   ├── actions/
│   │   ├── email-campaigns.ts              # Campaign server actions
│   │   └── email-templates.ts              # Template server actions
│   │
│   ├── services/
│   │   └── email/
│   │       ├── brevo.ts                    # Existing Brevo service
│   │       ├── templates.ts                # Existing templates
│   │       ├── campaign-sender.ts          # NEW: Batch sending
│   │       ├── ai-generator.ts             # NEW: AI email generation
│   │       ├── classifier.ts               # NEW: Email classification
│   │       └── targeting.ts                # NEW: Recipient targeting
│   │
│   └── components/
│       └── email-builder/
│           ├── EmailEditor.tsx             # Rich text editor
│           ├── RecipientSelector.tsx       # Targeting UI
│           ├── CampaignPreview.tsx         # Preview component
│           ├── AIClassification.tsx        # Classification display
│           ├── AIAssistant.tsx             # AI generation UI
│           ├── VariableInserter.tsx        # Variable picker
│           └── AnalyticsDashboard.tsx      # Stats display
│
└── types/
    └── email-campaign.ts                   # TypeScript types
```

---

## Questions for Clarification

1. **AI Provider**: Should we use the existing AI service (OpenAI) or add support for other providers?

2. **Image Storage**: Where should uploaded email images be stored? (Supabase storage, external URL, base64 inline?)

3. **Scheduling**: Do you need a job queue system (BullMQ) for scheduled sends, or is simple cron acceptable?

4. **Permissions**: Who can send marketing emails? (Admins only, or venue managers too?)

5. **Unsubscribe**: Should we build a preference center where users can manage email preferences?

6. **Templates**: Should templates support conditional content (e.g., show different content for admins vs staff)?
