# Form Preview & Testing Capability - Implementation Plan

## Overview

This plan outlines the implementation of a comprehensive form preview and testing system that allows users to:
- Preview forms as end-users would see them
- Test conditional logic in real-time
- Validate required fields and validation rules
- Test multi-page forms and repeating sections
- Preview on different device sizes
- Test with different themes

## Current State Analysis

### Existing Components
1. **FormRenderer** (`src/components/documents/form-renderer/FormRenderer.tsx`)
   - Renders forms from schema
   - Handles validation, submission, drafts
   - Supports conditional logic via `shouldShowField()`
   - Missing: advanced field types (rating, scale, slider, etc.)

2. **TemplatePreview** (`src/components/documents/library/TemplatePreview.tsx`)
   - Shows field list with details
   - Read-only view, no interactive testing

3. **FormBuilder** (`src/components/documents/form-builder/FormBuilder.tsx`)
   - Has basic preview mode
   - Limited testing capabilities

### Gaps
- No dedicated preview/testing page
- FormRenderer missing support for new field types (rating, scale, slider, calculation, currency, percentage, url, matrix)
- No device preview (mobile/tablet/desktop)
- No test data simulation
- No validation testing panel
- No conditional logic visualization

---

## Implementation Phases

### Phase 1: Enhanced FormRenderer (Core)
**Goal:** Update FormRenderer to support all field types

#### Tasks:
1. [ ] Add support for advanced field types in FormRenderer:
   - RatingField
   - ScaleField
   - SliderField
   - CalculationField
   - CurrencyField
   - PercentageField
   - UrlField
   - MatrixField

2. [ ] Add support for structural field types:
   - Repeating sections
   - Page breaks (multi-page)

3. [ ] Enhance validation display:
   - Real-time validation feedback
   - Validation summary panel
   - Field-level error indicators

**Files to modify:**
- `src/components/documents/form-renderer/FormRenderer.tsx`

---

### Phase 2: Form Preview Modal/Page
**Goal:** Create a dedicated preview interface accessible from FormBuilder

#### Tasks:
1. [ ] Create `FormPreviewModal` component:
   - Full-screen modal with form preview
   - Device size selector (mobile/tablet/desktop)
   - Theme selector
   - Test data controls

2. [ ] Create `FormPreviewPage` for full-page preview:
   - Standalone route `/manage/documents/[id]/preview`
   - Shareable preview link
   - QR code for mobile testing

3. [ ] Add preview button to FormBuilder toolbar

**Files to create:**
- `src/components/documents/form-preview/FormPreviewModal.tsx`
- `src/components/documents/form-preview/FormPreviewPage.tsx`
- `src/components/documents/form-preview/DevicePreviewFrame.tsx`
- `src/app/manage/documents/[id]/preview/page.tsx`

---

### Phase 3: Testing Panel
**Goal:** Add interactive testing capabilities

#### Tasks:
1. [ ] Create `FormTestPanel` component:
   - Toggle test mode on/off
   - Show/hide conditional logic indicators
   - Display field visibility reasons
   - Show validation status for all fields

2. [ ] Create `ConditionalLogicVisualizer`:
   - Show which conditions are met/unmet
   - Highlight affected fields
   - Real-time condition evaluation display

3. [ ] Create `ValidationTestPanel`:
   - List all validation rules
   - Show pass/fail status for each
   - Test with specific values

4. [ ] Create `TestDataSimulator`:
   - Pre-fill form with test data
   - Generate random test data
   - Clear/reset form

**Files to create:**
- `src/components/documents/form-preview/FormTestPanel.tsx`
- `src/components/documents/form-preview/ConditionalLogicVisualizer.tsx`
- `src/components/documents/form-preview/ValidationTestPanel.tsx`
- `src/components/documents/form-preview/TestDataSimulator.tsx`

---

### Phase 4: Device & Theme Preview
**Goal:** Allow testing across different devices and themes

#### Tasks:
1. [ ] Create `DevicePreviewFrame`:
   - iPhone frame (375px)
   - iPad frame (768px)
   - Desktop frame (1024px+)
   - Custom size option

2. [ ] Integrate theme preview:
   - Theme selector dropdown
   - Live theme application
   - Custom theme editor integration

3. [ ] Add responsive preview controls:
   - Rotate device (portrait/landscape)
   - Zoom controls
   - Fullscreen toggle

**Files to create:**
- `src/components/documents/form-preview/DevicePreviewFrame.tsx`
- `src/components/documents/form-preview/ThemePreviewSelector.tsx`

---

### Phase 5: Test Data Management
**Goal:** Save and manage test scenarios

#### Tasks:
1. [ ] Create test data types:
   - TestScenario interface
   - TestResult interface

2. [ ] Create `TestScenarioManager`:
   - Save current form state as scenario
   - Load saved scenarios
   - Share scenarios with team

3. [ ] Add test history:
   - Track test runs
   - Compare results
   - Export test reports

**Files to create:**
- `src/lib/types/form-test.ts`
- `src/components/documents/form-preview/TestScenarioManager.tsx`
- `src/lib/actions/documents/test-scenarios.ts`

---

## Component Architecture

```
src/components/documents/form-preview/
├── index.ts                    # Exports
├── FormPreviewModal.tsx        # Main preview modal
├── FormPreviewPage.tsx         # Full-page preview
├── DevicePreviewFrame.tsx      # Device frame wrapper
├── FormTestPanel.tsx           # Testing controls
├── ConditionalLogicVisualizer.tsx
├── ValidationTestPanel.tsx
├── TestDataSimulator.tsx
├── TestScenarioManager.tsx
└── ThemePreviewSelector.tsx

src/app/manage/documents/[id]/
└── preview/
    └── page.tsx                # Preview page route
```

---

## UI/UX Design

### Preview Modal Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Form Preview                                    [Device] [X] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                    Device Frame                         │ │
│ │  ┌─────────────────────────────────────────────────┐   │ │
│ │  │  [Theme Selector] [Test Data] [Validation Panel]│   │ │
│ │  ├─────────────────────────────────────────────────┤   │ │
│ │  │                                                 │   │ │
│ │  │              Form Preview                       │   │ │
│ │  │                                                 │   │ │
│ │  │  Field 1: [____________]                        │   │ │
│ │  │  Field 2: [____________]  ← Condition met ✓     │   │ │
│ │  │  Field 3: [____________]  ← Hidden (condition)  │   │ │
│ │  │                                                 │   │ │
│ │  │        [Save Draft]  [Submit]                   │   │ │
│ │  └─────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Test Panel: [Conditional Logic] [Validation] [Test Data]    │
└─────────────────────────────────────────────────────────────┘
```

### Test Panel Tabs

#### Conditional Logic Tab
- Shows all conditional rules
- Green checkmark = condition met
- Red X = condition not met
- Click to highlight affected field

#### Validation Tab
- Lists all validation rules by field
- Shows current value vs expected
- Pass/fail indicators

#### Test Data Tab
- Pre-fill options
- Generate random data
- Load saved scenario
- Save current as scenario

---

## Technical Considerations

### Performance
- Lazy load preview components
- Debounce form updates during testing
- Cache rendered form state

### Accessibility
- Ensure preview is screen-reader friendly
- Keyboard navigation in test mode
- High contrast mode for testing

### Security
- Preview mode should not save real data
- Clear test data indicator
- Prevent submission in preview mode

---

## Success Criteria

1. ✅ Users can preview forms with all field types
2. ✅ Users can test conditional logic in real-time
3. ✅ Users can validate required fields and rules
4. ✅ Users can preview on mobile/tablet/desktop
5. ✅ Users can test with different themes
6. ✅ Users can save and load test scenarios
7. ✅ Preview mode clearly indicates it's a test

---

## Estimated Effort

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | Enhanced FormRenderer | 2-3 hours |
| Phase 2 | Preview Modal/Page | 3-4 hours |
| Phase 3 | Testing Panel | 3-4 hours |
| Phase 4 | Device & Theme Preview | 2-3 hours |
| Phase 5 | Test Data Management | 2-3 hours |
| **Total** | | **12-17 hours** |

---

## Dependencies

- Existing FormRenderer component
- Form validation utilities
- Theme system (already implemented)
- UI components (Dialog, Tabs, etc.)

---

## Next Steps

1. Review and approve this plan
2. Start with Phase 1: Enhanced FormRenderer
3. Iterate through remaining phases
4. Test thoroughly before deployment

---

## Questions for Consideration

1. Should preview mode require authentication?
2. Should we allow sharing preview links externally?
3. Do we need to track preview analytics?
4. Should test scenarios be stored per-user or per-template?
