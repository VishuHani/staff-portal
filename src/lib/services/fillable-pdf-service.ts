// ============================================================================
// FILLABLE PDF SERVICE
// Creates and manages fillable PDF forms using pdf-lib
// ============================================================================

import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, rgb, StandardFonts } from 'pdf-lib';

// ============================================================================
// TYPES
// ============================================================================

export type FormFieldType = 'text' | 'checkbox' | 'signature' | 'date' | 'select' | 'radio';

export interface FormFieldDefinition {
  id: string;
  name: string;
  type: FormFieldType;
  required: boolean;
  defaultValue?: string | boolean;
  options?: string[]; // For select/radio fields
  placeholder?: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
  position?: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FillablePdfTemplate {
  id: string;
  name: string;
  description?: string;
  fields: FormFieldDefinition[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFillablePdfOptions {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  addPageNumbers?: boolean;
  pageSize?: 'letter' | 'a4' | 'legal';
}

export interface FillFieldData {
  fieldId: string;
  value: string | boolean;
}

export interface ExtractedFormData {
  [fieldId: string]: string | boolean;
}

// ============================================================================
// FILLABLE PDF CREATOR CLASS
// ============================================================================

export class FillablePdfCreator {
  private pdfDoc: PDFDocument | null = null;
  private fields: Map<string, FormFieldDefinition> = new Map();
  private formFields: Map<string, PDFTextField | PDFCheckBox | PDFDropdown | PDFRadioGroup> = new Map();

  /**
   * Initialize a new PDF document
   */
  async initialize(options: CreateFillablePdfOptions = {}): Promise<void> {
    this.pdfDoc = await PDFDocument.create();
    
    // Set metadata
    if (options.title) this.pdfDoc.setTitle(options.title);
    if (options.author) this.pdfDoc.setAuthor(options.author);
    if (options.subject) this.pdfDoc.setSubject(options.subject);
    if (options.keywords) this.pdfDoc.setKeywords(options.keywords);
    
    // Add a default page
    const pageSize = options.pageSize || 'letter';
    const dimensions = this.getPageSize(pageSize);
    this.pdfDoc.addPage(dimensions);
  }

  /**
   * Load an existing PDF to add form fields
   */
  async loadExistingPdf(pdfBytes: Uint8Array): Promise<void> {
    this.pdfDoc = await PDFDocument.load(pdfBytes);
  }

  /**
   * Get page dimensions for standard paper sizes
   */
  private getPageSize(size: 'letter' | 'a4' | 'legal'): [number, number] {
    switch (size) {
      case 'a4':
        return [595.28, 841.89]; // A4 in points
      case 'legal':
        return [612, 1008]; // Legal in points
      case 'letter':
      default:
        return [612, 792]; // Letter in points
    }
  }

  /**
   * Add a text field to the PDF
   */
  addTextField(field: FormFieldDefinition): void {
    if (!this.pdfDoc) throw new Error('PDF not initialized');
    
    const form = this.pdfDoc.getForm();
    const page = this.pdfDoc.getPage(field.position?.page || 0);
    
    const textField = form.createTextField(field.id);
    
    if (field.position) {
      textField.addToPage(page, {
        x: field.position.x,
        y: field.position.y,
        width: field.position.width,
        height: field.position.height,
      });
    }
    
    // Set default value if provided
    if (field.defaultValue && typeof field.defaultValue === 'string') {
      textField.setText(field.defaultValue);
    }
    
    // Note: pdf-lib doesn't support placeholders directly, but we can set a default value
    // that appears as placeholder-like text
    if (field.placeholder && !field.defaultValue) {
      // Set a gray placeholder-like text (user should replace this)
      textField.setText(field.placeholder);
    }
    
    // Set as required (visual indicator)
    if (field.required) {
      textField.enableRequired();
    }
    
    this.fields.set(field.id, field);
    this.formFields.set(field.id, textField);
  }

  /**
   * Add a checkbox field to the PDF
   */
  addCheckbox(field: FormFieldDefinition): void {
    if (!this.pdfDoc) throw new Error('PDF not initialized');
    
    const form = this.pdfDoc.getForm();
    const page = this.pdfDoc.getPage(field.position?.page || 0);
    
    const checkBox = form.createCheckBox(field.id);
    
    if (field.position) {
      checkBox.addToPage(page, {
        x: field.position.x,
        y: field.position.y,
        width: field.position.width || 20,
        height: field.position.height || 20,
      });
    }
    
    // Set default value if provided
    if (field.defaultValue === true) {
      checkBox.check();
    }
    
    this.fields.set(field.id, field);
    this.formFields.set(field.id, checkBox);
  }

  /**
   * Add a dropdown/select field to the PDF
   */
  addDropdown(field: FormFieldDefinition): void {
    if (!this.pdfDoc) throw new Error('PDF not initialized');
    if (!field.options || field.options.length === 0) {
      throw new Error('Dropdown field requires options');
    }
    
    const form = this.pdfDoc.getForm();
    const page = this.pdfDoc.getPage(field.position?.page || 0);
    
    const dropdown = form.createDropdown(field.id);
    dropdown.addOptions(field.options);
    
    if (field.position) {
      dropdown.addToPage(page, {
        x: field.position.x,
        y: field.position.y,
        width: field.position.width,
        height: field.position.height,
      });
    }
    
    // Set default value if provided
    if (field.defaultValue && typeof field.defaultValue === 'string') {
      dropdown.select(field.defaultValue);
    }
    
    this.fields.set(field.id, field);
    this.formFields.set(field.id, dropdown);
  }

  /**
   * Add a radio group to the PDF
   */
  addRadioGroup(field: FormFieldDefinition): void {
    if (!this.pdfDoc) throw new Error('PDF not initialized');
    if (!field.options || field.options.length === 0) {
      throw new Error('Radio group requires options');
    }
    
    const form = this.pdfDoc.getForm();
    const page = this.pdfDoc.getPage(field.position?.page || 0);
    
    const radioGroup = form.createRadioGroup(field.id);
    
    // Add each option as a radio button
    field.options.forEach((option, index) => {
      if (field.position) {
        // Arrange radio buttons vertically
        const offsetY = index * 25; // 25 points between each option
        radioGroup.addOptionToPage(option, page, {
          x: field.position!.x,
          y: field.position!.y - offsetY,
          width: 20,
          height: 20,
        });
      }
    });
    
    // Set default value if provided
    if (field.defaultValue && typeof field.defaultValue === 'string') {
      radioGroup.select(field.defaultValue);
    }
    
    this.fields.set(field.id, field);
    this.formFields.set(field.id, radioGroup);
  }

  /**
   * Add a signature field placeholder (text field with styling)
   * Note: pdf-lib doesn't support actual signature fields, but we can create
   * a styled text field for signatures
   */
  addSignatureField(field: FormFieldDefinition): void {
    if (!this.pdfDoc) throw new Error('PDF not initialized');
    
    const form = this.pdfDoc.getForm();
    const page = this.pdfDoc.getPage(field.position?.page || 0);
    
    // Create a text field styled for signatures
    const signatureField = form.createTextField(field.id);
    
    if (field.position) {
      signatureField.addToPage(page, {
        x: field.position.x,
        y: field.position.y,
        width: field.position.width,
        height: field.position.height,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });
    }
    
    // Set placeholder-like text for signature field
    signatureField.setText('Sign here');
    
    this.fields.set(field.id, { ...field, type: 'text' }); // Store as text since that's what it is
    this.formFields.set(field.id, signatureField);
  }

  /**
   * Add a field based on its type
   */
  addField(field: FormFieldDefinition): void {
    switch (field.type) {
      case 'text':
      case 'date':
        this.addTextField(field);
        break;
      case 'checkbox':
        this.addCheckbox(field);
        break;
      case 'select':
        this.addDropdown(field);
        break;
      case 'radio':
        this.addRadioGroup(field);
        break;
      case 'signature':
        this.addSignatureField(field);
        break;
      default:
        throw new Error(`Unknown field type: ${field.type}`);
    }
  }

  /**
   * Add multiple fields at once
   */
  addFields(fields: FormFieldDefinition[]): void {
    fields.forEach(field => this.addField(field));
  }

  /**
   * Add a new page to the document
   */
  addPage(size: 'letter' | 'a4' | 'legal' = 'letter'): number {
    if (!this.pdfDoc) throw new Error('PDF not initialized');
    
    const dimensions = this.getPageSize(size);
    const page = this.pdfDoc.addPage(dimensions);
    return this.pdfDoc.getPageCount() - 1;
  }

  /**
   * Add text content to a page
   */
  async addText(
    text: string,
    options: {
      page?: number;
      x: number;
      y: number;
      fontSize?: number;
      font?: 'helvetica' | 'times-roman' | 'courier';
      color?: { r: number; g: number; b: number };
    }
  ): Promise<void> {
    if (!this.pdfDoc) throw new Error('PDF not initialized');
    
    const page = this.pdfDoc.getPage(options.page || 0);
    
    // Get font
    let font;
    switch (options.font) {
      case 'times-roman':
        font = await this.pdfDoc.embedFont(StandardFonts.TimesRoman);
        break;
      case 'courier':
        font = await this.pdfDoc.embedFont(StandardFonts.Courier);
        break;
      case 'helvetica':
      default:
        font = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
        break;
    }
    
    const color = options.color ? rgb(options.color.r, options.color.g, options.color.b) : rgb(0, 0, 0);
    
    page.drawText(text, {
      x: options.x,
      y: options.y,
      size: options.fontSize || 12,
      font,
      color,
    });
  }

  /**
   * Generate the PDF bytes
   */
  async generate(): Promise<Uint8Array> {
    if (!this.pdfDoc) throw new Error('PDF not initialized');
    return await this.pdfDoc.save();
  }

  /**
   * Get the field definitions
   */
  getFieldDefinitions(): FormFieldDefinition[] {
    return Array.from(this.fields.values());
  }
}

// ============================================================================
// PDF FORM FILLER CLASS
// ============================================================================

export class PdfFormFiller {
  /**
   * Fill form fields in an existing PDF
   */
  static async fillForm(
    pdfBytes: Uint8Array,
    data: FillFieldData[]
  ): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    
    for (const { fieldId, value } of data) {
      try {
        const field = form.getField(fieldId);
        
        if (field instanceof PDFTextField) {
          field.setText(String(value));
        } else if (field instanceof PDFCheckBox) {
          if (value === true || value === 'true' || value === '1') {
            field.check();
          } else {
            field.uncheck();
          }
        } else if (field instanceof PDFDropdown) {
          field.select(String(value));
        } else if (field instanceof PDFRadioGroup) {
          field.select(String(value));
        }
      } catch (error) {
        console.warn(`Field ${fieldId} not found or could not be filled:`, error);
      }
    }
    
    return await pdfDoc.save();
  }

  /**
   * Extract form data from a filled PDF
   */
  static async extractFormData(pdfBytes: Uint8Array): Promise<ExtractedFormData> {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    const data: ExtractedFormData = {};
    
    for (const field of fields) {
      const name = field.getName();
      
      if (field instanceof PDFTextField) {
        data[name] = field.getText() || '';
      } else if (field instanceof PDFCheckBox) {
        data[name] = field.isChecked();
      } else if (field instanceof PDFDropdown) {
        const selected = field.getSelected();
        data[name] = selected.length > 0 ? selected[0] : '';
      } else if (field instanceof PDFRadioGroup) {
        data[name] = field.getSelected() || '';
      }
    }
    
    return data;
  }

  /**
   * Get list of all form fields in a PDF
   */
  static async getFormFields(pdfBytes: Uint8Array): Promise<{
    id: string;
    type: string;
    value: string | boolean;
  }[]> {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    return fields.map(field => {
      let type = 'unknown';
      let value: string | boolean = '';
      
      if (field instanceof PDFTextField) {
        type = 'text';
        value = field.getText() || '';
      } else if (field instanceof PDFCheckBox) {
        type = 'checkbox';
        value = field.isChecked();
      } else if (field instanceof PDFDropdown) {
        type = 'select';
        const selected = field.getSelected();
        value = selected.length > 0 ? selected[0] : '';
      } else if (field instanceof PDFRadioGroup) {
        type = 'radio';
        value = field.getSelected() || '';
      }
      
      return {
        id: field.getName(),
        type,
        value,
      };
    });
  }

  /**
   * Flatten a form (make fields read-only)
   */
  static async flattenForm(pdfBytes: Uint8Array): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    form.flatten();
    return await pdfDoc.save();
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a simple fillable PDF from field definitions
 */
export async function createFillablePdf(
  title: string,
  fields: FormFieldDefinition[],
  options: CreateFillablePdfOptions = {}
): Promise<Uint8Array> {
  const creator = new FillablePdfCreator();
  await creator.initialize({ ...options, title });
  creator.addFields(fields);
  return await creator.generate();
}

/**
 * Create a fillable PDF from a template
 */
export async function createFromTemplate(
  template: FillablePdfTemplate,
  options: CreateFillablePdfOptions = {}
): Promise<Uint8Array> {
  return createFillablePdf(template.name, template.fields, {
    ...options,
    title: template.name,
    author: template.description,
  });
}

/**
 * Pre-fill a PDF with user data
 */
export async function preFillPdf(
  pdfBytes: Uint8Array,
  userData: Record<string, string | boolean>
): Promise<Uint8Array> {
  const data: FillFieldData[] = Object.entries(userData).map(([fieldId, value]) => ({
    fieldId,
    value,
  }));
  
  return PdfFormFiller.fillForm(pdfBytes, data);
}

/**
 * Generate a document name with timestamp
 */
export function generateDocumentName(baseName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${baseName}_${timestamp}.pdf`;
}

export default {
  FillablePdfCreator,
  PdfFormFiller,
  createFillablePdf,
  createFromTemplate,
  preFillPdf,
  generateDocumentName,
};
