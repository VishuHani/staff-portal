# Form Builder Enhancement Plan
## World-Class Dynamic Form Builder for Staff Portal

This document outlines a comprehensive plan to transform the current form builder into a world-class solution comparable to Typeform, JotForm, Airtable, and other industry leaders.

---

## Executive Summary

### Current State Analysis

**Existing Field Types (19):**
- Input: text, textarea, number, email, phone, date, time, datetime
- Choice: select, multiselect, radio, checkbox, toggle
- Upload: file, image, signature
- Layout: divider, header, paragraph

**Existing Features:**
- Drag-and-drop field placement
- Basic field configuration (label, placeholder, help text, required)
- Conditional logic framework (show/hide/require/disable)
- Validation rules (min, max, minLength, maxLength, pattern, email, url, phone)
- Form settings (layout modes, auto-save, submission config)
- Basic theming (primaryColor, backgroundColor, borderColor)
- Undo/redo functionality
- Export schema as JSON

**Current Gaps:**
- Conditional logic UI is placeholder only
- Limited field types for complex use cases
- No branding/design customization
- No PDF export of forms
- No AI-assisted form building
- No calculation fields
- No multi-page/section branching

---

## Phase 1: Advanced Field Types

### 1.1 Rating & Scale Fields

```typescript
// New field types
| 'rating'        // Star rating (1-5, 1-10)
| 'scale'         // Numeric scale (NPS, satisfaction)
| 'slider'        // Range slider with min/max
| 'ranking'       // Drag to rank items
```

**Features:**
- Customizable scale range (1-5, 1-7, 1-10)
- Custom labels for endpoints (e.g., "Not likely" to "Very likely")
- NPS (Net Promoter Score) preset
- Star vs number vs emoji display options
- Optional comment field for rating explanation

### 1.2 Matrix/Grid Fields

```typescript
| 'matrix'        // Grid/ Likert scale
| 'matrix_radio'  // Single choice per row
| 'matrix_checkbox' // Multiple choices per row
```

**Features:**
- Rows and columns configuration
- Likert scale presets (Agree/Disagree, Frequency, Importance)
- Row grouping
- Required row validation

### 1.3 Advanced Input Fields

```typescript
| 'currency'      // Currency with formatting
| 'percentage'    // Percentage with validation
| 'url'           // URL with validation
| 'password'      // Password with strength indicator
| 'color'         // Color picker
| 'mask'          // Custom input mask (ABN, TFN, etc.)
```

**Features:**
- Currency symbol selection (AUD, USD, etc.)
- Automatic formatting
- Input masking for Australian formats (ABN: XX XXX XXX XXX, TFN: XXX XXX XXX)
- Password strength meter
- Color picker with hex/rgb output

### 1.4 Location & Contact Fields

```typescript
| 'address'       // Address with autocomplete
| 'country'       // Country selector
| 'timezone'      // Timezone selector
| 'map'           // Map location picker
```

**Features:**
- Google Places autocomplete integration
- Australian address validation
- Automatic timezone detection
- Coordinate storage for map fields

### 1.5 Rich Content Fields

```typescript
| 'rich_text'     // Rich text editor
| 'code'          // Code editor with syntax highlighting
| 'markdown'      // Markdown editor
| 'emoji_picker'  // Emoji selection
```

### 1.6 Media & Capture Fields

```typescript
| 'audio'         // Audio recording/upload
| 'video'         // Video recording/upload
| 'drawing'       // Drawing/sketch pad
| 'qr_scan'       // QR code scanner
| 'barcode'       // Barcode scanner
```

### 1.7 Special Fields

```typescript
| 'calculation'   // Computed value from other fields
| 'hidden'        // Hidden field (for data passing)
| 'captcha'       // Spam protection
| 'consent'       // GDPR/privacy consent
| 'likert'        // Quick Likert scale
```

---

## Phase 2: Advanced Conditional Logic

### 2.1 Enhanced Condition Types

```typescript
// Current operators
type ConditionOperator =
  | 'equals' | 'not_equals'
  | 'contains' | 'not_contains'
  | 'greater_than' | 'less_than'
  | 'greater_than_or_equal' | 'less_than_or_equal'
  | 'is_empty' | 'is_not_empty';

// New operators to add
| 'starts_with' | 'ends_with'
| 'matches_regex'
| 'is_between'
| 'is_one_of' | 'is_not_one_of'
| 'has_any_of' | 'has_all_of' | 'has_none_of' // For multiselect
| 'is_before' | 'is_after' | 'is_date_between' // For dates
| 'is_today' | 'is_in_past' | 'is_in_future'
| 'length_equals' | 'length_greater' | 'length_less'
```

### 2.2 Advanced Actions

```typescript
// Current actions
type ConditionalAction = 'show' | 'hide' | 'require' | 'disable';

// New actions to add
| 'set_value'           // Set field value
| 'clear_value'         // Clear field value
| 'set_options'         // Dynamic options for select
| 'set_default'         // Set default value
| 'set_min' | 'set_max' // Dynamic min/max for numbers
| 'skip_to'             // Jump to section/page
| 'end_form'            // End form early
| 'show_message'        // Display inline message
| 'trigger_webhook'     // Call external API
```

### 2.3 Condition Groups

```typescript
interface ConditionGroup {
  id: string;
  operator: 'and' | 'or';
  conditions: (Condition | ConditionGroup)[]; // Nested groups
}

interface EnhancedConditionalLogic {
  action: ConditionalAction;
  conditionGroups: ConditionGroup[];
  elseAction?: ConditionalAction; // Fallback action
}
```

### 2.4 Conditional Logic UI Builder

**Visual Rule Builder:**
- Drag-and-drop condition builder
- Visual representation of logic flow
- Real-time preview of conditions
- Test conditions with sample data
- Import/export logic rules

**Example UI:**
```
┌─────────────────────────────────────────────────────────────┐
│ Show this field when:                          [+ Add Rule] │
├─────────────────────────────────────────────────────────────┤
│ ┌─ Group 1 (ANY) ─────────────────────────────────────────┐ │
│ │ ○ "Employment Type" equals "Full-time"                 │ │
│ │ ○ "Employment Type" equals "Part-time"                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                         AND                                 │
│ ┌─ Group 2 (ALL) ─────────────────────────────────────────┐ │
│ │ ○ "Start Date" is after "2024-01-01"                   │ │
│ │ ○ "Department" is one of ["Sales", "Marketing"]        │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.5 Field Dependencies

```typescript
interface FieldDependency {
  sourceFieldId: string;
  targetFieldId: string;
  dependencyType: 'options' | 'validation' | 'default' | 'visibility';
  transform?: (value: unknown) => unknown;
}

// Example: Dynamic options based on another field
// Country → State/Province dropdown
// Category → Subcategory dropdown
```

---

## Phase 3: Design & Branding

### 3.1 Theme System

```typescript
interface FormTheme {
  id: string;
  name: string;
  isDefault?: boolean;
  
  // Colors
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    error: string;
    success: string;
    warning: string;
  };
  
  // Typography
  typography: {
    fontFamily: string;
    headingFont?: string;
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };
  
  // Spacing
  spacing: {
    fieldGap: string;
    sectionGap: string;
    pagePadding: string;
  };
  
  // Borders
  borders: {
    radius: 'none' | 'sm' | 'md' | 'lg' | 'full';
    width: string;
    style: 'solid' | 'dashed' | 'dotted';
  };
  
  // Shadows
  shadows: {
    none: string;
    sm: string;
    md: string;
    lg: string;
  };
}
```

### 3.2 Branding Options

```typescript
interface FormBranding {
  // Logo
  logo?: {
    url: string;
    position: 'left' | 'center' | 'right';
    size: 'sm' | 'md' | 'lg';
    link?: string;
  };
  
  // Header
  header?: {
    show: boolean;
    backgroundColor?: string;
    text?: string;
    backgroundImage?: string;
  };
  
  // Footer
  footer?: {
    show: boolean;
    text?: string;
    links?: Array<{
      label: string;
      url: string;
    }>;
  };
  
  // Custom CSS
  customCSS?: string;
}
```

### 3.3 Pre-built Themes

1. **Professional** - Clean, corporate look
2. **Modern** - Bold colors, rounded corners
3. **Minimal** - Simple, elegant
4. **Dark Mode** - Dark background
5. **Australian Government** - Official styling
6. **Healthcare** - Medical industry themed
7. **Education** - School/institution themed

### 3.4 Layout Templates

```typescript
interface FormLayoutTemplate {
  id: string;
  name: string;
  type: 'single' | 'multi-step' | 'accordion' | 'tabs' | 'card';
  
  // For multi-step
  steps?: {
    showProgress: boolean;
    allowJump: boolean;
    progressPosition: 'top' | 'bottom' | 'left';
    progressStyle: 'dots' | 'bar' | 'steps';
  };
  
  // Field layout
  fieldLayout: 'stacked' | 'inline' | 'grid';
  columns?: 1 | 2 | 3 | 4;
  
  // Card style
  cardStyle?: {
    showCard: boolean;
    shadow: 'none' | 'sm' | 'md' | 'lg';
    padding: 'sm' | 'md' | 'lg';
  };
}
```

---

## Phase 4: AI Capabilities

### 4.1 AI Field Suggestions

```typescript
interface AIFieldSuggestion {
  field: FormField;
  confidence: number;
  reason: string;
  alternatives?: FormField[];
}

// API: Suggest fields based on form context
async function suggestNextField(
  currentFields: FormField[],
  formContext: string
): Promise<AIFieldSuggestion[]>;
```

**Features:**
- Suggest next field based on form type
- Suggest validation rules
- Suggest field labels and options
- Detect missing required fields

### 4.2 AI Form Generation

**Enhanced Templates:**
```typescript
interface AIGeneratedForm {
  schema: FormSchema;
  suggestions: {
    missingFields: string[];
    recommendedValidations: string[];
    conditionalLogicSuggestions: string[];
  };
}

// Generate form from description
async function generateFormFromDescription(
  description: string,
  options: {
    industry?: string;
    compliance?: 'GDPR' | 'HIPAA' | 'Australian Privacy';
    includeSignature?: boolean;
  }
): Promise<AIGeneratedForm>;
```

### 4.3 Smart Validation Messages

```typescript
interface SmartValidation {
  fieldId: string;
  validationType: string;
  aiMessage: string; // Context-aware error message
  suggestions: string[]; // Suggested corrections
}

// Generate contextual validation messages
async function generateValidationMessage(
  field: FormField,
  value: unknown,
  validationType: string
): Promise<string>;
```

### 4.4 AI-Powered Features

1. **Auto-translate** - Translate form to multiple languages
2. **Sentiment Analysis** - Analyze open-text responses
3. **Smart Defaults** - Predict default values based on user
4. **Response Categorization** - Auto-categorize submissions
5. **Anomaly Detection** - Flag unusual responses

---

## Phase 5: Export & Integration

### 5.1 PDF Export

```typescript
interface PDFExportOptions {
  // Layout
  layout: 'form' | 'submission' | 'summary';
  pageSize: 'A4' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  
  // Styling
  theme: FormTheme;
  includeBranding: boolean;
  
  // Content
  includeEmptyFields: boolean;
  includeFieldDescriptions: boolean;
  includeHelpText: boolean;
  
  // Header/Footer
  header?: {
    text: string;
    includeLogo: boolean;
    includeDate: boolean;
    includePageNumbers: boolean;
  };
  
  footer?: {
    text: string;
    includeTimestamp: boolean;
  };
  
  // Security
  password?: string;
  watermark?: string;
}

async function exportFormAsPDF(
  schema: FormSchema,
  options: PDFExportOptions
): Promise<Blob>;
```

### 5.2 Document Generation

```typescript
interface DocumentGeneration {
  // Generate filled document from template
  generateFromTemplate(
    templateId: string,
    data: FormData
  ): Promise<Blob>;
  
  // Merge multiple submissions
  mergeSubmissions(
    submissions: FormData[]
  ): Promise<Blob>;
  
  // Generate summary report
  generateSummary(
    schema: FormSchema,
    submissions: FormData[]
  ): Promise<Blob>;
}
```

### 5.3 Export Formats

1. **PDF** - Form preview, filled submission, summary report
2. **Word** - Editable document
3. **Excel/CSV** - Data export
4. **JSON** - Schema and data
5. **HTML** - Standalone form

---

## Phase 6: Advanced Features

### 6.1 Calculation Fields

```typescript
interface CalculationField extends FormField {
  type: 'calculation';
  formula: string; // Expression language
  displayFormat?: 'number' | 'currency' | 'percentage';
  decimalPlaces?: number;
}

// Formula examples:
// "{field_1} + {field_2}"
// "{hours} * {rate} * 1.5" // Overtime
// "SUM({item_prices})"
// "IF({status} = 'approved', {amount}, 0)"
```

### 6.2 Repeating Sections

```typescript
interface RepeatingSection extends FormField {
  type: 'repeating_section';
  fields: FormField[];
  minItems?: number;
  maxItems?: number;
  addButtonText?: string;
  removeButtonText?: string;
}
```

### 6.3 Multi-Page Forms

```typescript
interface FormPage {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  conditionalLogic?: ConditionalLogic; // Skip page logic
}

interface MultiPageForm extends FormSchema {
  pages: FormPage[];
  navigation: {
    showProgressBar: boolean;
    allowBackNavigation: boolean;
    saveOnPageChange: boolean;
  };
}
```

### 6.4 Save & Resume

```typescript
interface SaveResumeConfig {
  enabled: boolean;
  method: 'email' | 'link' | 'account';
  expirationDays?: number;
  reminderEmails?: boolean;
}

interface SavedFormProgress {
  id: string;
  formId: string;
  userId?: string;
  email?: string;
  data: FormData;
  currentPage?: number;
  expiresAt: Date;
  resumeUrl: string;
}
```

### 6.5 Collaboration

```typescript
interface FormCollaboration {
  // Multi-user editing
  collaborators: Array<{
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    lastActive: Date;
  }>;
  
  // Comments
  comments: Array<{
    id: string;
    fieldId?: string;
    userId: string;
    message: string;
    resolved: boolean;
    createdAt: Date;
  }>;
  
  // Version history
  versions: Array<{
    version: number;
    schema: FormSchema;
    changedBy: string;
    changedAt: Date;
    changeDescription?: string;
  }>;
}
```

---

## Phase 7: Analytics & Insights

### 7.1 Form Analytics

```typescript
interface FormAnalytics {
  // Completion metrics
  totalViews: number;
  totalStarts: number;
  totalCompletions: number;
  completionRate: number;
  averageCompletionTime: number;
  
  // Drop-off analysis
  dropOffByField: Array<{
    fieldId: string;
    dropOffCount: number;
    dropOffRate: number;
  }>;
  
  // Field analytics
  fieldAnalytics: Array<{
    fieldId: string;
    fillRate: number;
    averageTime: number;
    errorRate: number;
    commonErrors: string[];
  }>;
  
  // Time analysis
  submissionsByTime: Array<{
    date: string;
    count: number;
  }>;
}
```

### 7.2 Response Analytics

```typescript
interface ResponseAnalytics {
  // Summary statistics
  fieldSummaries: Array<{
    fieldId: string;
    type: FieldType;
    summary: FieldSummary;
  }>;
  
  // Cross-tabulation
  crossTabs?: Array<{
    field1: string;
    field2: string;
    matrix: Record<string, Record<string, number>>;
  }>;
}

type FieldSummary =
  | { type: 'text'; topValues: Array<{ value: string; count: number }> }
  | { type: 'number'; min: number; max: number; mean: number; median: number }
  | { type: 'choice'; distribution: Array<{ option: string; count: number; percentage: number }> }
  | { type: 'date'; earliest: Date; latest: Date; distribution: Array<{ date: string; count: number }> };
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
- [ ] Extend field types with rating, scale, slider
- [ ] Add currency, percentage, URL fields
- [ ] Implement calculation field basics
- [ ] Build conditional logic UI

### Phase 2: Enhanced Logic (Weeks 5-8)
- [ ] Implement all condition operators
- [ ] Add condition groups (nested AND/OR)
- [ ] Build field dependencies
- [ ] Add skip logic and branching

### Phase 3: Design System (Weeks 9-12)
- [ ] Create theme system
- [ ] Build theme editor UI
- [ ] Add logo/branding support
- [ ] Create pre-built themes

### Phase 4: AI Integration (Weeks 13-16)
- [ ] AI field suggestions
- [ ] Enhanced form generation
- [ ] Smart validation messages
- [ ] Response categorization

### Phase 5: Export & Integration (Weeks 17-20)
- [ ] PDF export functionality
- [ ] Document generation
- [ ] Multi-format export
- [ ] Print optimization

### Phase 6: Advanced Features (Weeks 21-24)
- [ ] Repeating sections
- [ ] Multi-page forms
- [ ] Save & resume
- [ ] Collaboration features

### Phase 7: Analytics (Weeks 25-28)
- [ ] Form analytics dashboard
- [ ] Response analytics
- [ ] Drop-off analysis
- [ ] Export reports

---

## Technical Architecture

### New File Structure

```
src/lib/types/
├── form-schema.ts          # Existing - extend with new types
├── form-theme.ts           # NEW - Theme definitions
├── form-conditional.ts     # NEW - Enhanced conditional logic
└── form-analytics.ts       # NEW - Analytics types

src/components/documents/form-builder/
├── FormBuilder.tsx         # Main builder
├── fields/                 # Field builder components
│   ├── RatingField.tsx     # NEW
│   ├── ScaleField.tsx      # NEW
│   ├── SliderField.tsx     # NEW
│   ├── MatrixField.tsx     # NEW
│   ├── CurrencyField.tsx   # NEW
│   ├── CalculationField.tsx # NEW
│   └── ...
├── conditional/            # NEW - Conditional logic UI
│   ├── ConditionBuilder.tsx
│   ├── ConditionGroup.tsx
│   ├── ActionBuilder.tsx
│   └── LogicPreview.tsx
├── theme/                  # NEW - Theme editor
│   ├── ThemeEditor.tsx
│   ├── ColorPicker.tsx
│   ├── FontSelector.tsx
│   └── ThemePreview.tsx
└── export/                 # NEW - Export functionality
    ├── PDFExporter.tsx
    ├── ExportDialog.tsx
    └── PreviewDialog.tsx

src/lib/documents/
├── pdf-export.ts           # NEW - PDF generation
├── calculations.ts         # NEW - Formula evaluation
└── form-analytics.ts       # NEW - Analytics processing
```

### Dependencies to Add

```json
{
  "dependencies": {
    "@react-pdf/renderer": "^3.1.0",     // PDF generation
    "mathjs": "^12.0.0",                  // Calculation formulas
    "react-colorful": "^5.6.0",           // Color picker
    "framer-motion": "^10.0.0",           // Animations
    "react-beautiful-dnd": "^13.1.0"      // Enhanced drag-drop (or upgrade to dnd-kit)
  }
}
```

---

## Success Metrics

1. **Field Type Coverage**: 40+ field types (currently 19)
2. **Conditional Logic**: Support for 20+ operators (currently 10)
3. **Theme Options**: 10+ pre-built themes, full customization
4. **Export Formats**: 5 formats (PDF, Word, Excel, JSON, HTML)
5. **AI Features**: 5+ AI-powered capabilities
6. **Performance**: < 2s form load, < 100ms field interactions
7. **Accessibility**: WCAG 2.1 AA compliance
8. **Mobile**: Full responsive support with touch optimization

---

## Conclusion

This plan transforms the form builder into a world-class solution that rivals Typeform, JotForm, and Airtable. The phased approach allows for incremental delivery while building toward a comprehensive feature set.

Key differentiators for this implementation:
1. **Australian Focus**: ABN/TFN validation, Australian address autocomplete, government-compliant themes
2. **Workplace Integration**: Deep integration with existing staff portal features
3. **AI-First**: Leverage existing OpenAI integration for smart features
4. **Enterprise Ready**: Audit logging, permissions, compliance features
