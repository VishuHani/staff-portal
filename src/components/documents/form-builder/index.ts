/**
 * Form Builder Field Components
 * 
 * This module exports all field type components for the form builder.
 */

// Input fields
export { TextField, TextFieldBuilder } from './TextField';
export { TextareaField, TextareaFieldBuilder } from './TextareaField';
export { NumberField, NumberFieldBuilder } from './NumberField';
export { EmailField, EmailFieldBuilder } from './EmailField';
export { PhoneField, PhoneFieldBuilder } from './PhoneField';
export { DateField, DateFieldBuilder } from './DateField';
export { TimeField, TimeFieldBuilder } from './TimeField';

// Choice fields
export { SelectField, SelectFieldBuilder } from './SelectField';
export { MultiSelectField, MultiSelectFieldBuilder } from './MultiSelectField';
export { RadioField, RadioFieldBuilder } from './RadioField';
export { CheckboxField, CheckboxFieldBuilder } from './CheckboxField';
export { ToggleField, ToggleFieldBuilder } from './ToggleField';

// Upload fields
export { FileField, FileFieldBuilder } from './FileField';
export { ImageField, ImageFieldBuilder } from './ImageField';
export { SignatureField, SignatureFieldBuilder } from './SignatureField';

// Layout fields
export { DividerField, DividerFieldBuilder } from './DividerField';
export { HeaderField, HeaderFieldBuilder } from './HeaderField';
export { ParagraphField, ParagraphFieldBuilder } from './ParagraphField';

// Advanced fields (NEW)
export { RatingField, RatingFieldBuilder } from './RatingField';
export { ScaleField, ScaleFieldBuilder } from './ScaleField';
export { SliderField, SliderFieldBuilder } from './SliderField';
export { 
  CalculationField, 
  CalculationFieldBuilder, 
  FormulaBuilder,
  evaluateFormula,
  getFormulaFields,
} from './CalculationField';
export { CurrencyField, CurrencyFieldBuilder } from './CurrencyField';
export { PercentageField, PercentageFieldBuilder } from './PercentageField';
export { UrlField, UrlFieldBuilder } from './UrlField';
export { 
  MatrixField, 
  MatrixFieldBuilder, 
  MatrixFieldConfig 
} from './MatrixField';

// Conditional Logic Builder (NEW)
export {
  ConditionalLogicBuilder,
  ConditionalLogicPanel,
  createEmptyCondition,
  createEmptyConditionGroup,
  createEmptyConditionalLogic,
  getOperatorsForFieldType,
  operatorNeedsValue,
  operatorNeedsTwoValues,
} from './ConditionBuilder';

// Theme Editor (NEW)
export { ThemeEditor } from './ThemeEditor';

// AI Components (NEW)
export { AIFieldSuggestionsPanel } from './AIFieldSuggestions';
export { AIFormGenerator } from './AIFormGenerator';

// Export Components (NEW)
export { FormExporter } from './FormExporter';

// Phase 6: Repeating Section (NEW)
export {
  RepeatingSectionBuilder,
  RepeatingSectionRenderer,
  RepeatingSectionConfig,
  PageBreakBuilder,
  PageBreakConfig,
} from './RepeatingSection';

// Phase 6: Multi-Page Form (NEW)
export {
  FormProgressBar,
  MultiPageNavigation,
  MultiPageForm,
  PageBreakIndicator,
  splitFieldsIntoPages,
  getDefaultMultiPageSettings,
} from './MultiPageForm';

// Phase 6: Save & Resume (NEW)
export {
  SaveProgressButton,
  ResumeFormCard,
  ShareResumeLink,
  SaveResumeConfigPanel,
  AutoSaveIndicator,
  getDefaultSaveResumeConfig,
} from './SaveResume';

// Phase 6: Collaboration (NEW)
export {
  CollaboratorList,
  CommentThread,
  CommentsPanel,
  VersionHistory,
  CollaborationPanel,
  getDefaultCollaboration,
} from './FormCollaboration';

// Phase 7: Analytics (NEW)
export {
  FormAnalyticsDashboard,
} from './FormAnalytics';

// Types
export * from './types';

// Re-export types from form-schema
export type {
  FormField,
  FieldError,
  FieldType,
  FieldValidation,
  SelectOption,
  ConditionalLogic,
  FieldAppearance,
  FileUploadConfig,
  UploadedFile,
} from '@/lib/types/form-schema';
