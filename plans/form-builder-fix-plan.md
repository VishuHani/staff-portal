# Form Builder & Document Template Creation - Fix Plan

## Executive Summary

The current form builder and document template creation system has several critical issues that need to be addressed:

1. **Drag and Drop is broken** - Conflicting implementations between native HTML5 drag and react-dnd
2. **UI is not responsive** - Fixed widths/heights cause overflow issues
3. **AI generation is not connected** - Services exist but aren't wired to the UI
4. **PDF upload flow is incomplete** - Uploads PDF but doesn't extract fields or generate forms
5. **Text-to-form AI is a placeholder** - No actual implementation

---

## Current State Analysis

### 1. Form Builder Issues

**File:** `src/components/documents/form-builder/FormBuilder.tsx`

#### Problem 1: Conflicting Drag Implementations
The `FieldPalette` component uses BOTH:
- `useDrag` from react-dnd (lines 130-140)
- Native HTML5 `draggable` attribute (lines 163-166)

This causes the drag and drop to malfunction because:
- react-dnd's `useDrag` expects to manage the drag state
- Native HTML5 drag events fire independently
- The `onAddField` callback is called from the wrong place

#### Problem 2: Fixed Layout Widths
```tsx
<div className="w-64 border-r">  // Left panel - fixed 256px
<div className="flex-1 p-4 overflow-auto">  // Center - flexible
<div className="w-80 border-l">  // Right panel - fixed 320px
```
On smaller screens, this causes horizontal overflow.

#### Problem 3: Canvas Drop Zone Not Working
The `FormCanvas` component's drop zone doesn't properly receive palette items because the drag type matching is inconsistent.

### 2. New Template Page Issues

**File:** `src/app/manage/documents/new/new-template-client.tsx`

#### Problem 1: Fixed Height Container
```tsx
<Card className="h-[calc(100vh-300px)]">
  <FormBuilder ... />
</Card>
```
This constrains the form builder to a fixed height that doesn't work on all screen sizes.

#### Problem 2: AI Tab is Placeholder
```tsx
<TabsContent value="ai" className="mt-4">
  <Card>
    {/* Just a textarea and button - no functionality */}
    <p className="text-sm text-muted-foreground text-center">
      AI generation is coming soon...
    </p>
  </Card>
</TabsContent>
```

#### Problem 3: PDF Upload Doesn't Generate Forms
The `handlePDFUpload` callback just stores the URL:
```tsx
const handlePDFUpload = useCallback((result) => {
  setPdfUrl(result.url);
  setPdfFileName(result.fileName);
}, []);
```
It doesn't:
- Extract form fields from the PDF
- Generate a form schema from detected fields
- Allow editing of detected fields

### 3. Existing AI Services (Not Connected!)

The following services exist but are NOT used in the UI:

| Service | File | Purpose |
|---------|------|---------|
| `analyzePDFFromBuffer` | `ai-field-detection.ts` | Extract text and detect fields from PDF |
| `detectFieldsWithAI` | `ai-field-detection.ts` | AI-powered field detection |
| `generateFormFromFields` | `ai-form-generation.ts` | Generate form schema from detected fields |
| `createFormSchemaFromFields` | `ai-form-generation.ts` | Create schema from field array |
| `extractPDFFormFields` | `pdf-field-extraction.ts` | Extract fillable fields from PDFs |

---

## Fix Plan

### Phase 1: Fix Form Builder Drag and Drop

#### 1.1 Remove Native HTML5 Drag from FieldPalette
Replace the conflicting implementation with pure react-dnd:

```tsx
// BEFORE (broken)
<div
  draggable
  onDragStart={(e) => {
    e.dataTransfer.setData('fieldType', config.type);
  }}
  onClick={() => onAddField(config.type)}
>

// AFTER (fixed)
const [{ isDragging }, drag] = useDrag(() => ({
  type: DRAG_TYPES.FIELD_PALETTE,
  item: { type: DRAG_TYPES.FIELD_PALETTE, fieldType: config.type },
  end: (item, monitor) => {
    if (monitor.didDrop() && item.fieldType) {
      onAddField(item.fieldType);
    }
  },
  collect: (monitor) => ({
    isDragging: monitor.isDragging(),
  }),
}), [config.type, onAddField]);

return (
  <div
    ref={drag}
    onClick={() => onAddField(config.type)}
    className={cn(
      "flex flex-col items-center justify-center p-3 rounded-lg border border-dashed hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors",
      isDragging && "opacity-50"
    )}
  >
```

#### 1.2 Fix FormCanvas Drop Handler
Ensure the drop zone properly handles both palette items and canvas reordering:

```tsx
const [{ isOver, canDrop }, drop] = useDrop(() => ({
  accept: [DRAG_TYPES.FIELD_PALETTE, DRAG_TYPES.FIELD_CANVAS],
  drop: (item: DragItem, monitor: DropTargetMonitor) => {
    if (item.type === DRAG_TYPES.FIELD_PALETTE && item.fieldType) {
      onAddField(item.fieldType);
      return { added: true };
    }
    return { moved: true };
  },
  collect: (monitor: DropTargetMonitor) => ({
    isOver: monitor.isOver(),
    canDrop: monitor.canDrop(),
  }),
}), [onAddField]);
```

### Phase 2: Fix UI Responsiveness

#### 2.1 Make Form Builder Responsive
Replace fixed widths with responsive grid:

```tsx
// BEFORE
<div className="w-64 border-r">
  <FieldPalette ... />
</div>
<div className="flex-1 p-4 overflow-auto">
  <FormCanvas ... />
</div>
<div className="w-80 border-l">
  <FieldConfigPanel ... />
</div>

// AFTER
<div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4 h-full">
  <div className="hidden lg:block overflow-auto">
    <FieldPalette ... />
  </div>
  <div className="overflow-auto">
    <FormCanvas ... />
  </div>
  <div className="hidden lg:block overflow-auto">
    <FieldConfigPanel ... />
  </div>
</div>
```

#### 2.2 Add Mobile Field Selector
For mobile, add a bottom sheet or collapsible panel:

```tsx
{/* Mobile field selector */}
<div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t p-4">
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="outline" className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add Field
      </Button>
    </SheetTrigger>
    <SheetContent side="bottom">
      <FieldPalette onAddField={handleAddField} />
    </SheetContent>
  </Sheet>
</div>
```

#### 2.3 Fix New Template Page Layout
Remove fixed height and use flexible layout:

```tsx
// BEFORE
<Card className="h-[calc(100vh-300px)]">
  <FormBuilder ... />
</Card>

// AFTER
<div className="min-h-[500px] flex flex-col">
  <FormBuilder ... />
</div>
```

### Phase 3: Connect AI PDF Form Generation

#### 3.1 Create Server Action for PDF Analysis

**New File:** `src/lib/actions/documents/ai-form-generation.ts`

```tsx
'use server';

import { analyzePDFFromBuffer } from '@/lib/documents/ai-field-detection';
import { generateFormFromFields } from '@/lib/documents/ai-form-generation';
import { extractPDFFormFields } from '@/lib/documents/pdf-field-extraction';

export async function generateFormFromPDF(
  pdfUrl: string,
  options?: { name?: string; skipAI?: boolean }
): Promise<ActionResult<FormSchema>> {
  try {
    // 1. Download PDF
    const response = await fetch(pdfUrl);
    const buffer = await response.arrayBuffer();
    
    // 2. Extract existing fillable fields
    const existingFields = await extractPDFFormFields(buffer);
    
    // 3. AI analysis for additional fields
    const analysis = await analyzePDFFromBuffer(buffer, {
      skipAI: options?.skipAI,
    });
    
    // 4. Generate form schema
    const result = await generateFormFromFields(
      analysis.fields.fields,
      analysis.structure,
      options?.name || 'Generated Form'
    );
    
    return { success: true, data: result.schema };
  } catch (error) {
    return { success: false, error: 'Failed to generate form from PDF' };
  }
}
```

#### 3.2 Update PDF Upload Handler

```tsx
// In new-template-client.tsx
const [isGeneratingForm, setIsGeneratingForm] = useState(false);
const [detectedFields, setDetectedFields] = useState<ExtractedPDFField[]>([]);

const handlePDFUpload = useCallback(async (result: PDFUploadResult) => {
  setPdfUrl(result.url);
  setPdfFileName(result.fileName);
  
  // Auto-detect fields from PDF
  if (result.formFields && result.formFields.length > 0) {
    setDetectedFields(result.formFields);
    toast.success(`Detected ${result.formFields.length} form fields`);
  }
  
  // If PDF has no fillable fields, offer AI detection
  if (!result.formFields || result.formFields.length === 0) {
    toast.info("No fillable fields detected. Use AI to analyze the PDF?");
  }
}, []);

const handleGenerateFormFromPDF = useCallback(async () => {
  if (!pdfUrl) return;
  
  setIsGeneratingForm(true);
  try {
    const result = await generateFormFromPDF(pdfUrl, { name });
    if (result.success && result.data) {
      setFormSchema(result.data);
      setMode("form"); // Switch to form builder
      toast.success("Form generated from PDF!");
    } else {
      toast.error(result.error || "Failed to generate form");
    }
  } finally {
    setIsGeneratingForm(false);
  }
}, [pdfUrl, name]);
```

#### 3.3 Update PDF Tab UI

```tsx
<TabsContent value="pdf" className="mt-4">
  <Card>
    <CardHeader>
      <CardTitle>Upload PDF Document</CardTitle>
      <CardDescription>
        Upload a PDF and we'll detect form fields automatically
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <PDFUploader
        venueId={selectedVenueId}
        onUploadComplete={handlePDFUpload}
      />
      
      {/* Detected Fields Preview */}
      {detectedFields.length > 0 && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Detected Fields ({detectedFields.length})</h4>
          <ScrollArea className="h-[200px] border rounded-lg p-2">
            {detectedFields.map((field) => (
              <div key={field.id} className="flex items-center justify-between py-1">
                <span className="text-sm">{field.name}</span>
                <Badge variant="outline">{field.type}</Badge>
              </div>
            ))}
          </ScrollArea>
          <Button 
            onClick={handleGenerateFormFromPDF}
            disabled={isGeneratingForm}
            className="mt-2"
          >
            {isGeneratingForm ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4 mr-2" />
            )}
            Generate Form from Fields
          </Button>
        </div>
      )}
      
      {/* AI Analysis Option */}
      {pdfUrl && detectedFields.length === 0 && (
        <Button 
          onClick={handleGenerateFormFromPDF}
          disabled={isGeneratingForm}
          variant="outline"
          className="w-full"
        >
          {isGeneratingForm ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4 mr-2" />
          )}
          Analyze PDF with AI
        </Button>
      )}
    </CardContent>
  </Card>
</TabsContent>
```

### Phase 4: Implement Text-to-Form AI Generation

#### 4.1 Create Server Action

**Add to:** `src/lib/actions/documents/ai-form-generation.ts`

```tsx
export async function generateFormFromDescription(
  description: string,
  options?: { name?: string }
): Promise<ActionResult<FormSchema>> {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return { success: false, error: 'AI service not available' };
    }
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are a form schema generator. Generate a complete form schema based on the user's description.
Return ONLY a valid JSON object matching this FormSchema type:
{
  "name": "string",
  "description": "string",
  "fields": [
    {
      "id": "string",
      "type": "text|textarea|number|email|phone|date|time|select|multiselect|radio|checkbox|toggle|file|image|signature",
      "label": "string",
      "placeholder": "string",
      "required": boolean,
      "options": [{"value": "string", "label": "string"}]
    }
  ]
}`
        },
        {
          role: 'user',
          content: description
        }
      ],
      response_format: { type: 'json_object' },
    });
    
    const schema = JSON.parse(response.choices[0].message.content);
    return { success: true, data: schema };
  } catch (error) {
    return { success: false, error: 'Failed to generate form' };
  }
}
```

#### 4.2 Update AI Tab UI

```tsx
const [aiDescription, setAiDescription] = useState("");
const [isGeneratingFromAI, setIsGeneratingFromAI] = useState(false);

const handleGenerateFromDescription = useCallback(async () => {
  if (!aiDescription.trim()) {
    toast.error("Please describe the form you want to create");
    return;
  }
  
  setIsGeneratingFromAI(true);
  try {
    const result = await generateFormFromDescription(aiDescription, { name });
    if (result.success && result.data) {
      setFormSchema(result.data);
      setMode("form"); // Switch to form builder
      toast.success("Form generated! You can edit it in the form builder.");
    } else {
      toast.error(result.error || "Failed to generate form");
    }
  } finally {
    setIsGeneratingFromAI(false);
  }
}, [aiDescription, name]);

// In the AI Tab
<TabsContent value="ai" className="mt-4">
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Wand2 className="h-5 w-5" />
        AI-Powered Form Generation
      </CardTitle>
      <CardDescription>
        Describe the document you want to create and AI will generate a form for you.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <Textarea
        value={aiDescription}
        onChange={(e) => setAiDescription(e.target.value)}
        placeholder="Describe the document you want to create... e.g., 'Create an employee onboarding form with fields for personal details, emergency contacts, and bank account information'"
        rows={6}
      />
      <Button 
        onClick={handleGenerateFromDescription}
        disabled={isGeneratingFromAI || !aiDescription.trim()}
        className="w-full"
      >
        {isGeneratingFromAI ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Wand2 className="h-4 w-4 mr-2" />
        )}
        Generate Form
      </Button>
      
      {/* Example prompts */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Try these examples:</p>
        <div className="flex flex-wrap gap-2">
          {[
            "Employee onboarding form with personal details and emergency contacts",
            "WHS safety acknowledgment form",
            "Bank account details collection form",
            "Leave request form with date pickers",
          ].map((example) => (
            <Button
              key={example}
              variant="outline"
              size="sm"
              onClick={() => setAiDescription(example)}
            >
              {example}
            </Button>
          ))}
        </div>
      </div>
    </CardContent>
  </Card>
</TabsContent>
```

---

## Implementation Order

1. **Phase 1: Fix Drag and Drop** (Critical - blocks form builder usage)
   - Fix FieldPalette drag implementation
   - Fix FormCanvas drop handler
   - Test field reordering

2. **Phase 2: Fix UI Responsiveness** (High - affects usability)
   - Make form builder responsive
   - Add mobile field selector
   - Fix new template page layout

3. **Phase 3: Connect PDF AI Generation** (High - core feature)
   - Create server action for PDF analysis
   - Update PDF upload handler
   - Add detected fields preview

4. **Phase 4: Implement Text-to-Form AI** (Medium - enhancement)
   - Create server action for text-to-form
   - Update AI tab UI
   - Add example prompts

---

## Testing Checklist

### Form Builder
- [ ] Can drag fields from palette to canvas
- [ ] Can click fields in palette to add
- [ ] Can reorder fields by dragging
- [ ] Can select field and edit properties
- [ ] Can delete fields
- [ ] Can duplicate fields
- [ ] Undo/redo works
- [ ] Export schema works
- [ ] Responsive on mobile (field selector works)

### PDF Upload
- [ ] Can upload PDF
- [ ] Fillable fields are detected
- [ ] Can generate form from detected fields
- [ ] AI analysis works for non-fillable PDFs
- [ ] Generated form is editable

### AI Generation
- [ ] Can describe form in natural language
- [ ] AI generates valid form schema
- [ ] Generated form is editable
- [ ] Example prompts work

### Template Creation
- [ ] Can save template with form
- [ ] Can save template with PDF
- [ ] All settings are saved correctly
- [ ] Template appears in document list

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/documents/form-builder/FormBuilder.tsx` | Fix drag/drop, responsive layout |
| `src/app/manage/documents/new/new-template-client.tsx` | Connect AI, fix layout |
| `src/lib/actions/documents/ai-form-generation.ts` | New file - server actions |
| `src/components/documents/pdf/PDFUploader.tsx` | Return detected fields |
| `src/components/documents/form-builder/index.ts` | Export all field builders |

---

## Estimated Effort

| Phase | Complexity |
|-------|------------|
| Phase 1: Drag and Drop Fix | Medium |
| Phase 2: UI Responsiveness | Medium |
| Phase 3: PDF AI Generation | Medium |
| Phase 4: Text-to-Form AI | Low |

Total: Medium complexity - all required services exist, just need to be wired together.
