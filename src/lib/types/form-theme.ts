/**
 * Form Theme Types for Document Management System
 * 
 * This module defines the TypeScript types for the form theming system
 * used to customize the appearance of forms.
 */

// ============================================================================
// COLOR TYPES
// ============================================================================

/**
 * Color palette for form themes
 */
export interface ThemeColors {
  /** Primary brand color for buttons, links, accents */
  primary: string;
  /** Secondary color for less prominent elements */
  secondary: string;
  /** Background color for the form container */
  background: string;
  /** Surface color for cards, panels */
  surface: string;
  /** Main text color */
  text: string;
  /** Muted/subdued text color */
  textMuted: string;
  /** Border color for inputs, dividers */
  border: string;
  /** Error state color */
  error: string;
  /** Success state color */
  success: string;
  /** Warning state color */
  warning: string;
  /** Info state color */
  info: string;
  /** Focus ring color */
  focusRing: string;
  /** Hover state overlay color */
  hoverOverlay: string;
}

// ============================================================================
// TYPOGRAPHY TYPES
// ============================================================================

/**
 * Font size scale
 */
export interface FontSizeScale {
  xs: string;
  sm: string;
  base: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
}

/**
 * Line height options
 */
export interface LineHeightScale {
  tight: number;
  snug: number;
  normal: number;
  relaxed: number;
  loose: number;
}

/**
 * Font weight options
 */
export interface FontWeightScale {
  light: number;
  normal: number;
  medium: number;
  semibold: number;
  bold: number;
}

/**
 * Typography configuration
 */
export interface ThemeTypography {
  /** Primary font family */
  fontFamily: string;
  /** Heading font family (optional, defaults to fontFamily) */
  headingFont?: string;
  /** Monospace font for code, calculations */
  monoFont?: string;
  /** Font size scale */
  fontSize: FontSizeScale;
  /** Line height scale */
  lineHeight: LineHeightScale;
  /** Font weight scale */
  fontWeight: FontWeightScale;
}

// ============================================================================
// SPACING TYPES
// ============================================================================

/**
 * Spacing configuration
 */
export interface ThemeSpacing {
  /** Gap between form fields */
  fieldGap: string;
  /** Gap between sections */
  sectionGap: string;
  /** Padding inside input fields */
  inputPadding: string;
  /** Padding inside cards/containers */
  cardPadding: string;
  /** Padding around the form page */
  pagePadding: string;
  /** Label to input spacing */
  labelGap: string;
}

// ============================================================================
// BORDER TYPES
// ============================================================================

/**
 * Border radius options
 */
export type BorderRadiusSize = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

/**
 * Border style options
 */
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'none';

/**
 * Border configuration
 */
export interface ThemeBorders {
  /** Default border radius */
  radius: BorderRadiusSize;
  /** Border radius for inputs */
  inputRadius: BorderRadiusSize;
  /** Border radius for buttons */
  buttonRadius: BorderRadiusSize;
  /** Border radius for cards */
  cardRadius: BorderRadiusSize;
  /** Default border width */
  width: string;
  /** Default border style */
  style: BorderStyle;
  /** Input border width */
  inputWidth: string;
}

// ============================================================================
// SHADOW TYPES
// ============================================================================

/**
 * Shadow size options
 */
export type ShadowSize = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * Shadow configuration
 */
export interface ThemeShadows {
  /** No shadow */
  none: string;
  /** Small shadow */
  sm: string;
  /** Medium shadow */
  md: string;
  /** Large shadow */
  lg: string;
  /** Extra large shadow */
  xl: string;
  /** Default shadow for cards */
  card: ShadowSize;
  /** Default shadow for inputs */
  input: ShadowSize;
  /** Default shadow for dropdowns/popovers */
  dropdown: ShadowSize;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Input field styling
 */
export interface ThemeInputs {
  /** Background color */
  backgroundColor: string;
  /** Text color */
  textColor: string;
  /** Border color */
  borderColor: string;
  /** Focus border color */
  focusBorderColor: string;
  /** Placeholder color */
  placeholderColor: string;
  /** Disabled background color */
  disabledBackground: string;
  /** Disabled text color */
  disabledText: string;
  /** Error border color */
  errorBorderColor: string;
  /** Height for standard inputs */
  height: string;
  /** Height for large inputs */
  heightLg: string;
  /** Height for small/compact inputs */
  heightSm: string;
}

// ============================================================================
// BUTTON TYPES
// ============================================================================

/**
 * Button variant styles
 */
export interface ThemeButtonVariants {
  primary: {
    background: string;
    text: string;
    hoverBackground: string;
    border: string;
  };
  secondary: {
    background: string;
    text: string;
    hoverBackground: string;
    border: string;
  };
  outline: {
    background: string;
    text: string;
    hoverBackground: string;
    border: string;
  };
  ghost: {
    background: string;
    text: string;
    hoverBackground: string;
    border: string;
  };
  destructive: {
    background: string;
    text: string;
    hoverBackground: string;
    border: string;
  };
}

/**
 * Button configuration
 */
export interface ThemeButtons {
  /** Button variants */
  variants: ThemeButtonVariants;
  /** Default button height */
  height: string;
  /** Large button height */
  heightLg: string;
  /** Small button height */
  heightSm: string;
}

// ============================================================================
// BRANDING TYPES
// ============================================================================

/**
 * Logo configuration
 */
export interface ThemeLogo {
  /** URL to logo image */
  url: string;
  /** Logo position */
  position: 'left' | 'center' | 'right';
  /** Logo size */
  size: 'sm' | 'md' | 'lg';
  /** Optional link when logo is clicked */
  link?: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Max width for logo */
  maxWidth?: string;
}

/**
 * Header configuration
 */
export interface ThemeHeader {
  /** Show header */
  show: boolean;
  /** Header background color */
  backgroundColor?: string;
  /** Header text */
  text?: string;
  /** Header text color */
  textColor?: string;
  /** Background image URL */
  backgroundImage?: string;
  /** Background image position */
  backgroundPosition?: string;
  /** Background image size */
  backgroundSize?: string;
  /** Header height */
  height?: string;
}

/**
 * Footer configuration
 */
export interface ThemeFooter {
  /** Show footer */
  show: boolean;
  /** Footer text */
  text?: string;
  /** Footer text color */
  textColor?: string;
  /** Footer links */
  links?: Array<{
    label: string;
    url: string;
    openInNewTab?: boolean;
  }>;
  /** Footer background color */
  backgroundColor?: string;
}

/**
 * Branding configuration
 */
export interface ThemeBranding {
  /** Logo configuration */
  logo?: ThemeLogo;
  /** Header configuration */
  header?: ThemeHeader;
  /** Footer configuration */
  footer?: ThemeFooter;
  /** Custom CSS to inject */
  customCSS?: string;
  /** Favicon URL */
  favicon?: string;
}

// ============================================================================
// LAYOUT TYPES
// ============================================================================

/**
 * Form layout type
 */
export type FormLayoutType = 'single' | 'multi-step' | 'accordion' | 'tabs' | 'card';

/**
 * Progress indicator style
 */
export type ProgressStyle = 'dots' | 'bar' | 'steps' | 'none';

/**
 * Progress indicator position
 */
export type ProgressPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * Field layout style
 */
export type FieldLayoutStyle = 'stacked' | 'inline' | 'grid';

/**
 * Multi-step form configuration
 */
export interface ThemeMultiStep {
  /** Show progress indicator */
  showProgress: boolean;
  /** Progress indicator style */
  progressStyle: ProgressStyle;
  /** Progress indicator position */
  progressPosition: ProgressPosition;
  /** Allow jumping between steps */
  allowJump: boolean;
  /** Show step titles */
  showStepTitles: boolean;
  /** Show step numbers */
  showStepNumbers: boolean;
}

/**
 * Card style configuration
 */
export interface ThemeCardStyle {
  /** Show card container */
  showCard: boolean;
  /** Card shadow size */
  shadow: ShadowSize;
  /** Card padding */
  padding: 'sm' | 'md' | 'lg';
  /** Card border */
  showBorder: boolean;
  /** Card border color */
  borderColor?: string;
}

/**
 * Layout configuration
 */
export interface ThemeLayout {
  /** Form layout type */
  type: FormLayoutType;
  /** Multi-step specific settings */
  multiStep?: ThemeMultiStep;
  /** Field layout style */
  fieldLayout: FieldLayoutStyle;
  /** Number of columns for grid layout */
  columns?: 1 | 2 | 3 | 4;
  /** Card style */
  cardStyle?: ThemeCardStyle;
  /** Maximum form width */
  maxWidth: string;
  /** Center the form */
  centered: boolean;
}

// ============================================================================
// MAIN THEME TYPE
// ============================================================================

/**
 * Complete form theme definition
 */
export interface FormTheme {
  /** Unique theme identifier */
  id: string;
  /** Theme name */
  name: string;
  /** Theme description */
  description?: string;
  /** Is this a built-in theme */
  isBuiltIn?: boolean;
  /** Is this the default theme */
  isDefault?: boolean;
  
  /** Color palette */
  colors: ThemeColors;
  /** Typography settings */
  typography: ThemeTypography;
  /** Spacing settings */
  spacing: ThemeSpacing;
  /** Border settings */
  borders: ThemeBorders;
  /** Shadow settings */
  shadows: ThemeShadows;
  /** Input styling */
  inputs: ThemeInputs;
  /** Button styling */
  buttons: ThemeButtons;
  /** Branding options */
  branding?: ThemeBranding;
  /** Layout options */
  layout: ThemeLayout;
  
  /** Created timestamp */
  createdAt?: string;
  /** Updated timestamp */
  updatedAt?: string;
  /** Created by user ID */
  createdBy?: string;
}

// ============================================================================
// PRE-BUILT THEMES
// ============================================================================

/**
 * Default light theme
 */
export const DEFAULT_THEME: FormTheme = {
  id: 'default',
  name: 'Default',
  description: 'Clean, professional light theme',
  isBuiltIn: true,
  isDefault: true,
  
  colors: {
    primary: '#3b82f6',
    secondary: '#64748b',
    background: '#ffffff',
    surface: '#ffffff',
    text: '#0f172a',
    textMuted: '#64748b',
    border: '#e2e8f0',
    error: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
    info: '#3b82f6',
    focusRing: '#3b82f6',
    hoverOverlay: 'rgba(0, 0, 0, 0.04)',
  },
  
  typography: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    headingFont: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    monoFont: '"JetBrains Mono", "Fira Code", Consolas, monospace',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    lineHeight: {
      tight: 1.25,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625,
      loose: 2,
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  
  spacing: {
    fieldGap: '1.5rem',
    sectionGap: '2rem',
    inputPadding: '0.625rem 0.875rem',
    cardPadding: '1.5rem',
    pagePadding: '2rem',
    labelGap: '0.5rem',
  },
  
  borders: {
    radius: 'md',
    inputRadius: 'md',
    buttonRadius: 'md',
    cardRadius: 'lg',
    width: '1px',
    style: 'solid',
    inputWidth: '1px',
  },
  
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    card: 'sm',
    input: 'none',
    dropdown: 'lg',
  },
  
  inputs: {
    backgroundColor: '#ffffff',
    textColor: '#0f172a',
    borderColor: '#e2e8f0',
    focusBorderColor: '#3b82f6',
    placeholderColor: '#94a3b8',
    disabledBackground: '#f8fafc',
    disabledText: '#94a3b8',
    errorBorderColor: '#ef4444',
    height: '2.5rem',
    heightLg: '3rem',
    heightSm: '2rem',
  },
  
  buttons: {
    variants: {
      primary: {
        background: '#3b82f6',
        text: '#ffffff',
        hoverBackground: '#2563eb',
        border: 'transparent',
      },
      secondary: {
        background: '#f1f5f9',
        text: '#475569',
        hoverBackground: '#e2e8f0',
        border: 'transparent',
      },
      outline: {
        background: 'transparent',
        text: '#3b82f6',
        hoverBackground: '#eff6ff',
        border: '#3b82f6',
      },
      ghost: {
        background: 'transparent',
        text: '#64748b',
        hoverBackground: '#f1f5f9',
        border: 'transparent',
      },
      destructive: {
        background: '#ef4444',
        text: '#ffffff',
        hoverBackground: '#dc2626',
        border: 'transparent',
      },
    },
    height: '2.5rem',
    heightLg: '3rem',
    heightSm: '2rem',
  },
  
  layout: {
    type: 'single',
    fieldLayout: 'stacked',
    maxWidth: '768px',
    centered: true,
  },
};

/**
 * Dark theme
 */
export const DARK_THEME: FormTheme = {
  id: 'dark',
  name: 'Dark Mode',
  description: 'Modern dark theme for reduced eye strain',
  isBuiltIn: true,
  
  colors: {
    primary: '#60a5fa',
    secondary: '#94a3b8',
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    border: '#334155',
    error: '#f87171',
    success: '#4ade80',
    warning: '#fbbf24',
    info: '#60a5fa',
    focusRing: '#60a5fa',
    hoverOverlay: 'rgba(255, 255, 255, 0.08)',
  },
  
  typography: DEFAULT_THEME.typography,
  
  spacing: DEFAULT_THEME.spacing,
  
  borders: DEFAULT_THEME.borders,
  
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.3)',
    card: 'md',
    input: 'none',
    dropdown: 'xl',
  },
  
  inputs: {
    backgroundColor: '#1e293b',
    textColor: '#f8fafc',
    borderColor: '#334155',
    focusBorderColor: '#60a5fa',
    placeholderColor: '#64748b',
    disabledBackground: '#0f172a',
    disabledText: '#475569',
    errorBorderColor: '#f87171',
    height: '2.5rem',
    heightLg: '3rem',
    heightSm: '2rem',
  },
  
  buttons: {
    variants: {
      primary: {
        background: '#60a5fa',
        text: '#0f172a',
        hoverBackground: '#3b82f6',
        border: 'transparent',
      },
      secondary: {
        background: '#334155',
        text: '#e2e8f0',
        hoverBackground: '#475569',
        border: 'transparent',
      },
      outline: {
        background: 'transparent',
        text: '#60a5fa',
        hoverBackground: '#1e3a5f',
        border: '#60a5fa',
      },
      ghost: {
        background: 'transparent',
        text: '#94a3b8',
        hoverBackground: '#334155',
        border: 'transparent',
      },
      destructive: {
        background: '#ef4444',
        text: '#ffffff',
        hoverBackground: '#dc2626',
        border: 'transparent',
      },
    },
    height: '2.5rem',
    heightLg: '3rem',
    heightSm: '2rem',
  },
  
  layout: DEFAULT_THEME.layout,
};

/**
 * Minimal theme
 */
export const MINIMAL_THEME: FormTheme = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Simple, elegant design with minimal styling',
  isBuiltIn: true,
  
  colors: {
    primary: '#18181b',
    secondary: '#71717a',
    background: '#ffffff',
    surface: '#ffffff',
    text: '#18181b',
    textMuted: '#71717a',
    border: '#e4e4e7',
    error: '#dc2626',
    success: '#16a34a',
    warning: '#ca8a04',
    info: '#18181b',
    focusRing: '#18181b',
    hoverOverlay: 'rgba(0, 0, 0, 0.02)',
  },
  
  typography: {
    ...DEFAULT_THEME.typography,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  
  spacing: {
    ...DEFAULT_THEME.spacing,
    fieldGap: '2rem',
  },
  
  borders: {
    radius: 'none',
    inputRadius: 'none',
    buttonRadius: 'none',
    cardRadius: 'none',
    width: '1px',
    style: 'solid',
    inputWidth: '1px',
  },
  
  shadows: {
    none: 'none',
    sm: 'none',
    md: 'none',
    lg: 'none',
    xl: 'none',
    card: 'none',
    input: 'none',
    dropdown: 'sm',
  },
  
  inputs: {
    ...DEFAULT_THEME.inputs,
    borderColor: '#e4e4e7',
    focusBorderColor: '#18181b',
  },
  
  buttons: {
    variants: {
      primary: {
        background: '#18181b',
        text: '#ffffff',
        hoverBackground: '#27272a',
        border: 'transparent',
      },
      secondary: {
        background: '#f4f4f5',
        text: '#3f3f46',
        hoverBackground: '#e4e4e7',
        border: 'transparent',
      },
      outline: {
        background: 'transparent',
        text: '#18181b',
        hoverBackground: '#f4f4f5',
        border: '#18181b',
      },
      ghost: {
        background: 'transparent',
        text: '#71717a',
        hoverBackground: '#f4f4f5',
        border: 'transparent',
      },
      destructive: {
        background: '#dc2626',
        text: '#ffffff',
        hoverBackground: '#b91c1c',
        border: 'transparent',
      },
    },
    height: '2.5rem',
    heightLg: '3rem',
    heightSm: '2rem',
  },
  
  layout: DEFAULT_THEME.layout,
};

/**
 * Australian Government theme
 */
export const AUSTRALIAN_GOV_THEME: FormTheme = {
  id: 'australian-gov',
  name: 'Australian Government',
  description: 'Official Australian Government styling',
  isBuiltIn: true,
  
  colors: {
    primary: '#1e3a8a', // Australian Government blue
    secondary: '#64748b',
    background: '#ffffff',
    surface: '#ffffff',
    text: '#1e293b',
    textMuted: '#64748b',
    border: '#cbd5e1',
    error: '#b91c1c',
    success: '#15803d',
    warning: '#a16207',
    info: '#1e40af',
    focusRing: '#1e3a8a',
    hoverOverlay: 'rgba(30, 58, 138, 0.04)',
  },
  
  typography: {
    fontFamily: '"Open Sans", Arial, sans-serif',
    headingFont: '"Open Sans", Arial, sans-serif',
    monoFont: 'Consolas, monospace',
    fontSize: DEFAULT_THEME.typography.fontSize,
    lineHeight: DEFAULT_THEME.typography.lineHeight,
    fontWeight: DEFAULT_THEME.typography.fontWeight,
  },
  
  spacing: DEFAULT_THEME.spacing,
  
  borders: {
    radius: 'none',
    inputRadius: 'none',
    buttonRadius: 'none',
    cardRadius: 'none',
    width: '1px',
    style: 'solid',
    inputWidth: '2px',
  },
  
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 2px 4px 0 rgb(0 0 0 / 0.1)',
    lg: '0 4px 8px 0 rgb(0 0 0 / 0.1)',
    xl: '0 8px 16px 0 rgb(0 0 0 / 0.1)',
    card: 'none',
    input: 'none',
    dropdown: 'md',
  },
  
  inputs: {
    backgroundColor: '#ffffff',
    textColor: '#1e293b',
    borderColor: '#cbd5e1',
    focusBorderColor: '#1e3a8a',
    placeholderColor: '#94a3b8',
    disabledBackground: '#f8fafc',
    disabledText: '#94a3b8',
    errorBorderColor: '#b91c1c',
    height: '2.75rem',
    heightLg: '3.25rem',
    heightSm: '2.25rem',
  },
  
  buttons: {
    variants: {
      primary: {
        background: '#1e3a8a',
        text: '#ffffff',
        hoverBackground: '#1e40af',
        border: 'transparent',
      },
      secondary: {
        background: '#f1f5f9',
        text: '#334155',
        hoverBackground: '#e2e8f0',
        border: 'transparent',
      },
      outline: {
        background: 'transparent',
        text: '#1e3a8a',
        hoverBackground: '#eff6ff',
        border: '#1e3a8a',
      },
      ghost: {
        background: 'transparent',
        text: '#64748b',
        hoverBackground: '#f1f5f9',
        border: 'transparent',
      },
      destructive: {
        background: '#b91c1c',
        text: '#ffffff',
        hoverBackground: '#991b1b',
        border: 'transparent',
      },
    },
    height: '2.75rem',
    heightLg: '3.25rem',
    heightSm: '2.25rem',
  },
  
  layout: {
    type: 'single',
    fieldLayout: 'stacked',
    maxWidth: '800px',
    centered: true,
  },
};

/**
 * All built-in themes
 */
export const BUILT_IN_THEMES: FormTheme[] = [
  DEFAULT_THEME,
  DARK_THEME,
  MINIMAL_THEME,
  AUSTRALIAN_GOV_THEME,
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get a theme by ID
 */
export function getThemeById(id: string): FormTheme | undefined {
  return BUILT_IN_THEMES.find(theme => theme.id === id);
}

/**
 * Get the default theme
 */
export function getDefaultTheme(): FormTheme {
  return DEFAULT_THEME;
}

/**
 * Merge custom theme with default
 */
export function mergeWithDefaultTheme(custom: Partial<FormTheme>): FormTheme {
  return {
    ...DEFAULT_THEME,
    ...custom,
    colors: {
      ...DEFAULT_THEME.colors,
      ...custom.colors,
    },
    typography: {
      ...DEFAULT_THEME.typography,
      ...custom.typography,
    },
    spacing: {
      ...DEFAULT_THEME.spacing,
      ...custom.spacing,
    },
    borders: {
      ...DEFAULT_THEME.borders,
      ...custom.borders,
    },
    shadows: {
      ...DEFAULT_THEME.shadows,
      ...custom.shadows,
    },
    inputs: {
      ...DEFAULT_THEME.inputs,
      ...custom.inputs,
    },
    buttons: {
      ...DEFAULT_THEME.buttons,
      variants: {
        ...DEFAULT_THEME.buttons.variants,
        ...custom.buttons?.variants,
      },
    },
    layout: {
      ...DEFAULT_THEME.layout,
      ...custom.layout,
    },
  };
}

/**
 * Generate CSS variables from theme
 */
export function themeToCSSVariables(theme: FormTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  
  // Colors
  Object.entries(theme.colors).forEach(([key, value]) => {
    vars[`--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`] = value;
  });
  
  // Typography
  vars['--font-family'] = theme.typography.fontFamily;
  if (theme.typography.headingFont) {
    vars['--font-heading'] = theme.typography.headingFont;
  }
  if (theme.typography.monoFont) {
    vars['--font-mono'] = theme.typography.monoFont;
  }
  
  Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
    vars[`--text-${key}`] = value;
  });
  
  // Spacing
  Object.entries(theme.spacing).forEach(([key, value]) => {
    vars[`--spacing-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`] = value;
  });
  
  // Borders
  vars['--radius'] = `var(--radius-${theme.borders.radius})`;
  vars['--radius-input'] = `var(--radius-${theme.borders.inputRadius})`;
  vars['--radius-button'] = `var(--radius-${theme.borders.buttonRadius})`;
  vars['--radius-card'] = `var(--radius-${theme.borders.cardRadius})`;
  
  // Input heights
  vars['--input-height'] = theme.inputs.height;
  vars['--input-height-lg'] = theme.inputs.heightLg;
  vars['--input-height-sm'] = theme.inputs.heightSm;
  
  // Button heights
  vars['--button-height'] = theme.buttons.height;
  vars['--button-height-lg'] = theme.buttons.heightLg;
  vars['--button-height-sm'] = theme.buttons.heightSm;
  
  // Layout
  vars['--form-max-width'] = theme.layout.maxWidth;
  
  return vars;
}

/**
 * Create a custom theme
 */
export function createCustomTheme(
  name: string,
  options: Partial<FormTheme> = {}
): FormTheme {
  const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    ...mergeWithDefaultTheme(options),
    id,
    name,
    isBuiltIn: false,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}