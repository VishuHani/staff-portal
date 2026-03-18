'use client';

import * as React from 'react';
import { 
  Palette, 
  Type, 
  Square, 
  Layout, 
  Sun, 
  Moon, 
  Monitor, 
  RotateCcw,
  Check,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  FormTheme,
  ThemeColors,
  ThemeTypography,
  ThemeSpacing,
  ThemeBorders,
  ThemeLayout,
  BUILT_IN_THEMES,
  DEFAULT_THEME,
  getThemeById,
  createCustomTheme,
  BorderRadiusSize,
  ShadowSize,
  FormLayoutType,
  FieldLayoutStyle,
} from '@/lib/types/form-theme';

// ============================================================================
// COLOR INPUT COMPONENT
// ============================================================================

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
}

function ColorInput({ label, value, onChange, description }: ColorInputProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-6 w-6 rounded border cursor-pointer"
          />
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-20 h-6 text-xs font-mono px-1"
          />
        </div>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

// ============================================================================
// SECTION HEADER COMPONENT
// ============================================================================

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function SectionHeader({ title, icon, defaultOpen = true, children }: SectionHeaderProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  
  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left"
      >
        {icon}
        <span className="text-sm font-medium">{title}</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
        )}
      </button>
      {isOpen && <div className="space-y-3 pl-6">{children}</div>}
    </div>
  );
}

// ============================================================================
// THEME PREVIEW COMPONENT
// ============================================================================

interface ThemePreviewProps {
  theme: FormTheme;
}

function ThemePreview({ theme }: ThemePreviewProps) {
  return (
    <div 
      className="rounded-lg border p-4 space-y-4"
      style={{
        backgroundColor: theme.colors.background,
        borderColor: theme.colors.border,
        color: theme.colors.text,
      }}
    >
      {/* Header */}
      <div className="space-y-2">
        <h4 
          className="text-lg font-semibold"
          style={{ color: theme.colors.text }}
        >
          Form Preview
        </h4>
        <p 
          className="text-sm"
          style={{ color: theme.colors.textMuted }}
        >
          This is how your form will look with the current theme.
        </p>
      </div>
      
      {/* Sample Input */}
      <div className="space-y-1.5">
        <label 
          className="text-sm font-medium"
          style={{ color: theme.colors.text }}
        >
          Sample Field
        </label>
        <input
          type="text"
          placeholder="Enter text..."
          className="w-full px-3 py-2 text-sm border focus:outline-none focus:ring-2"
          style={{
            backgroundColor: theme.inputs.backgroundColor,
            borderColor: theme.inputs.borderColor,
            color: theme.inputs.textColor,
            borderRadius: `var(--radius-${theme.borders.inputRadius})`,
          }}
        />
      </div>
      
      {/* Sample Select */}
      <div className="space-y-1.5">
        <label 
          className="text-sm font-medium"
          style={{ color: theme.colors.text }}
        >
          Sample Select
        </label>
        <select
          className="w-full px-3 py-2 text-sm border"
          style={{
            backgroundColor: theme.inputs.backgroundColor,
            borderColor: theme.inputs.borderColor,
            color: theme.inputs.textColor,
            borderRadius: `var(--radius-${theme.borders.inputRadius})`,
          }}
        >
          <option>Option 1</option>
          <option>Option 2</option>
        </select>
      </div>
      
      {/* Sample Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          className="px-4 py-2 text-sm font-medium"
          style={{
            backgroundColor: theme.buttons.variants.primary.background,
            color: theme.buttons.variants.primary.text,
            borderRadius: `var(--radius-${theme.borders.buttonRadius})`,
          }}
        >
          Primary
        </button>
        <button
          className="px-4 py-2 text-sm font-medium border"
          style={{
            backgroundColor: theme.buttons.variants.secondary.background,
            color: theme.buttons.variants.secondary.text,
            borderRadius: `var(--radius-${theme.borders.buttonRadius})`,
          }}
        >
          Secondary
        </button>
        <button
          className="px-4 py-2 text-sm font-medium border"
          style={{
            backgroundColor: theme.buttons.variants.outline.background,
            color: theme.buttons.variants.outline.text,
            borderColor: theme.buttons.variants.outline.border,
            borderRadius: `var(--radius-${theme.borders.buttonRadius})`,
          }}
        >
          Outline
        </button>
      </div>
      
      {/* Success/Error states */}
      <div className="flex gap-4 text-sm">
        <span style={{ color: theme.colors.success }}>✓ Success message</span>
        <span style={{ color: theme.colors.error }}>✗ Error message</span>
      </div>
    </div>
  );
}

// ============================================================================
// THEME SELECTOR COMPONENT
// ============================================================================

interface ThemeSelectorProps {
  currentTheme: FormTheme;
  onSelectTheme: (theme: FormTheme) => void;
}

function ThemeSelector({ currentTheme, onSelectTheme }: ThemeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {BUILT_IN_THEMES.map((theme) => (
        <button
          key={theme.id}
          onClick={() => onSelectTheme(theme)}
          className={cn(
            "relative p-3 rounded-lg border-2 text-left transition-all",
            currentTheme.id === theme.id
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          )}
        >
          {currentTheme.id === theme.id && (
            <div className="absolute top-2 right-2">
              <Check className="h-4 w-4 text-primary" />
            </div>
          )}
          
          {/* Mini preview */}
          <div 
            className="h-12 rounded mb-2 flex items-center justify-center gap-1"
            style={{ backgroundColor: theme.colors.background }}
          >
            <div 
              className="w-6 h-3 rounded"
              style={{ backgroundColor: theme.colors.primary }}
            />
            <div 
              className="w-6 h-3 rounded"
              style={{ backgroundColor: theme.colors.secondary }}
            />
            <div 
              className="w-6 h-3 rounded"
              style={{ backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}` }}
            />
          </div>
          
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{theme.name}</p>
            {theme.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {theme.description}
              </p>
            )}
          </div>
          
          {theme.isBuiltIn && (
            <Badge variant="outline" className="mt-2 text-xs">
              Built-in
            </Badge>
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// COLORS EDITOR COMPONENT
// ============================================================================

interface ColorsEditorProps {
  colors: ThemeColors;
  onChange: (colors: ThemeColors) => void;
}

function ColorsEditor({ colors, onChange }: ColorsEditorProps) {
  const updateColor = (key: keyof ThemeColors, value: string) => {
    onChange({ ...colors, [key]: value });
  };
  
  return (
    <div className="space-y-4">
      <SectionHeader 
        title="Brand Colors" 
        icon={<Palette className="h-4 w-4 text-primary" />}
      >
        <ColorInput
          label="Primary"
          value={colors.primary}
          onChange={(v) => updateColor('primary', v)}
          description="Buttons, links, accents"
        />
        <ColorInput
          label="Secondary"
          value={colors.secondary}
          onChange={(v) => updateColor('secondary', v)}
          description="Less prominent elements"
        />
      </SectionHeader>
      
      <SectionHeader 
        title="Backgrounds" 
        icon={<Square className="h-4 w-4 text-primary" />}
        defaultOpen={false}
      >
        <ColorInput
          label="Background"
          value={colors.background}
          onChange={(v) => updateColor('background', v)}
          description="Form container background"
        />
        <ColorInput
          label="Surface"
          value={colors.surface}
          onChange={(v) => updateColor('surface', v)}
          description="Cards, panels"
        />
      </SectionHeader>
      
      <SectionHeader 
        title="Text Colors" 
        icon={<Type className="h-4 w-4 text-primary" />}
        defaultOpen={false}
      >
        <ColorInput
          label="Text"
          value={colors.text}
          onChange={(v) => updateColor('text', v)}
          description="Main text color"
        />
        <ColorInput
          label="Text Muted"
          value={colors.textMuted}
          onChange={(v) => updateColor('textMuted', v)}
          description="Subdued text"
        />
      </SectionHeader>
      
      <SectionHeader 
        title="Borders & States" 
        icon={<Square className="h-4 w-4 text-primary" />}
        defaultOpen={false}
      >
        <ColorInput
          label="Border"
          value={colors.border}
          onChange={(v) => updateColor('border', v)}
        />
        <ColorInput
          label="Error"
          value={colors.error}
          onChange={(v) => updateColor('error', v)}
        />
        <ColorInput
          label="Success"
          value={colors.success}
          onChange={(v) => updateColor('success', v)}
        />
        <ColorInput
          label="Warning"
          value={colors.warning}
          onChange={(v) => updateColor('warning', v)}
        />
      </SectionHeader>
    </div>
  );
}

// ============================================================================
// TYPOGRAPHY EDITOR COMPONENT
// ============================================================================

interface TypographyEditorProps {
  typography: ThemeTypography;
  onChange: (typography: ThemeTypography) => void;
}

const FONT_FAMILIES = [
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'system-ui, sans-serif', label: 'System UI' },
  { value: '"Open Sans", sans-serif', label: 'Open Sans' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: '"Noto Sans", sans-serif', label: 'Noto Sans' },
  { value: 'Lato, sans-serif', label: 'Lato' },
  { value: 'Poppins, sans-serif', label: 'Poppins' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
];

function TypographyEditor({ typography, onChange }: TypographyEditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <label className="text-sm font-medium">Font Family</label>
        <Select
          value={typography.fontFamily}
          onValueChange={(v) => onChange({ ...typography, fontFamily: v })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                <span style={{ fontFamily: font.value }}>{font.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-3">
        <label className="text-sm font-medium">Heading Font (optional)</label>
        <Select
          value={typography.headingFont || typography.fontFamily}
          onValueChange={(v) => onChange({ ...typography, headingFont: v })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                <span style={{ fontFamily: font.value }}>{font.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-3">
        <label className="text-sm font-medium">Base Font Size</label>
        <Select
          value={typography.fontSize.base}
          onValueChange={(v) => {
            const scale = parseFloat(v);
            onChange({
              ...typography,
              fontSize: {
                xs: `${scale * 0.75}rem`,
                sm: `${scale * 0.875}rem`,
                base: `${scale}rem`,
                lg: `${scale * 1.125}rem`,
                xl: `${scale * 1.25}rem`,
                '2xl': `${scale * 1.5}rem`,
                '3xl': `${scale * 1.875}rem`,
              },
            });
          }}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0.875">Small (14px)</SelectItem>
            <SelectItem value="1">Default (16px)</SelectItem>
            <SelectItem value="1.125">Large (18px)</SelectItem>
            <SelectItem value="1.25">Extra Large (20px)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ============================================================================
// BORDERS EDITOR COMPONENT
// ============================================================================

interface BordersEditorProps {
  borders: ThemeBorders;
  onChange: (borders: ThemeBorders) => void;
}

const RADIUS_OPTIONS: { value: BorderRadiusSize; label: string }[] = [
  { value: 'none', label: 'None (0px)' },
  { value: 'sm', label: 'Small (4px)' },
  { value: 'md', label: 'Medium (8px)' },
  { value: 'lg', label: 'Large (12px)' },
  { value: 'xl', label: 'Extra Large (16px)' },
  { value: '2xl', label: '2XL (24px)' },
  { value: 'full', label: 'Full (9999px)' },
];

function BordersEditor({ borders, onChange }: BordersEditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <label className="text-sm font-medium">Global Border Radius</label>
        <Select
          value={borders.radius}
          onValueChange={(v) => onChange({ ...borders, radius: v as BorderRadiusSize })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RADIUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-3">
        <label className="text-sm font-medium">Input Border Radius</label>
        <Select
          value={borders.inputRadius}
          onValueChange={(v) => onChange({ ...borders, inputRadius: v as BorderRadiusSize })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RADIUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-3">
        <label className="text-sm font-medium">Button Border Radius</label>
        <Select
          value={borders.buttonRadius}
          onValueChange={(v) => onChange({ ...borders, buttonRadius: v as BorderRadiusSize })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RADIUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-3">
        <label className="text-sm font-medium">Card Border Radius</label>
        <Select
          value={borders.cardRadius}
          onValueChange={(v) => onChange({ ...borders, cardRadius: v as BorderRadiusSize })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RADIUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ============================================================================
// LAYOUT EDITOR COMPONENT
// ============================================================================

interface LayoutEditorProps {
  layout: ThemeLayout;
  onChange: (layout: ThemeLayout) => void;
}

const LAYOUT_TYPES: { value: FormLayoutType; label: string; description: string }[] = [
  { value: 'single', label: 'Single Page', description: 'All fields on one page' },
  { value: 'multi-step', label: 'Multi-Step', description: 'Fields split into steps' },
  { value: 'card', label: 'Card Layout', description: 'Fields in a card container' },
  { value: 'accordion', label: 'Accordion', description: 'Collapsible sections' },
];

const FIELD_LAYOUTS: { value: FieldLayoutStyle; label: string }[] = [
  { value: 'stacked', label: 'Stacked (vertical)' },
  { value: 'inline', label: 'Inline (horizontal)' },
  { value: 'grid', label: 'Grid' },
];

const MAX_WIDTHS = [
  { value: '480px', label: 'Small (480px)' },
  { value: '640px', label: 'Medium (640px)' },
  { value: '768px', label: 'Large (768px)' },
  { value: '1024px', label: 'Extra Large (1024px)' },
  { value: '100%', label: 'Full Width' },
];

function LayoutEditor({ layout, onChange }: LayoutEditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <label className="text-sm font-medium">Form Layout</label>
        <div className="grid grid-cols-2 gap-2">
          {LAYOUT_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => onChange({ ...layout, type: type.value })}
              className={cn(
                "p-2 rounded-lg border text-left transition-all",
                layout.type === type.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <p className="text-sm font-medium">{type.label}</p>
              <p className="text-xs text-muted-foreground">{type.description}</p>
            </button>
          ))}
        </div>
      </div>
      
      <div className="space-y-3">
        <label className="text-sm font-medium">Field Layout</label>
        <Select
          value={layout.fieldLayout}
          onValueChange={(v) => onChange({ ...layout, fieldLayout: v as FieldLayoutStyle })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_LAYOUTS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {layout.fieldLayout === 'grid' && (
        <div className="space-y-3">
          <label className="text-sm font-medium">Columns</label>
          <Select
            value={String(layout.columns || 1)}
            onValueChange={(v) => onChange({ ...layout, columns: Number(v) as 1 | 2 | 3 | 4 })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Column</SelectItem>
              <SelectItem value="2">2 Columns</SelectItem>
              <SelectItem value="3">3 Columns</SelectItem>
              <SelectItem value="4">4 Columns</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      
      <div className="space-y-3">
        <label className="text-sm font-medium">Maximum Width</label>
        <Select
          value={layout.maxWidth}
          onValueChange={(v) => onChange({ ...layout, maxWidth: v })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MAX_WIDTHS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Center Form</label>
        <input
          type="checkbox"
          checked={layout.centered}
          onChange={(e) => onChange({ ...layout, centered: e.target.checked })}
          className="h-4 w-4"
        />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN THEME EDITOR COMPONENT
// ============================================================================

export interface ThemeEditorProps {
  theme: FormTheme;
  onChange: (theme: FormTheme) => void;
  showPreview?: boolean;
}

export function ThemeEditor({ theme, onChange, showPreview = true }: ThemeEditorProps) {
  const [activeTab, setActiveTab] = React.useState('themes');
  
  const handleSelectTheme = (selectedTheme: FormTheme) => {
    onChange({ ...selectedTheme });
  };
  
  const handleReset = () => {
    onChange({ ...DEFAULT_THEME });
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Theme Editor</h3>
          <p className="text-xs text-muted-foreground">
            Customize the look and feel of your form
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-4 pt-2 border-b">
            <TabsList className="w-full grid grid-cols-4 h-8">
              <TabsTrigger value="themes" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Themes
              </TabsTrigger>
              <TabsTrigger value="colors" className="text-xs">
                <Palette className="h-3 w-3 mr-1" />
                Colors
              </TabsTrigger>
              <TabsTrigger value="typography" className="text-xs">
                <Type className="h-3 w-3 mr-1" />
                Type
              </TabsTrigger>
              <TabsTrigger value="layout" className="text-xs">
                <Layout className="h-3 w-3 mr-1" />
                Layout
              </TabsTrigger>
            </TabsList>
          </div>
          
          <div className="flex-1 overflow-auto">
            <TabsContent value="themes" className="p-4 space-y-4 m-0">
              <ThemeSelector
                currentTheme={theme}
                onSelectTheme={handleSelectTheme}
              />
              
              {showPreview && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Preview</h4>
                    <ThemePreview theme={theme} />
                  </div>
                </>
              )}
            </TabsContent>
            
            <TabsContent value="colors" className="p-4 m-0">
              <ColorsEditor
                colors={theme.colors}
                onChange={(colors) => onChange({ ...theme, colors })}
              />
            </TabsContent>
            
            <TabsContent value="typography" className="p-4 m-0">
              <TypographyEditor
                typography={theme.typography}
                onChange={(typography) => onChange({ ...theme, typography })}
              />
            </TabsContent>
            
            <TabsContent value="layout" className="p-4 space-y-4 m-0">
              <LayoutEditor
                layout={theme.layout}
                onChange={(layout) => onChange({ ...theme, layout })}
              />
              
              <Separator />
              
              <BordersEditor
                borders={theme.borders}
                onChange={(borders) => onChange({ ...theme, borders })}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export default ThemeEditor;