/**
 * Accessibility Utilities for Document Management System
 * Phase 8 - Polish & Testing
 *
 * This module provides:
 * - ARIA label helpers
 * - Keyboard navigation utilities
 * - Focus management for modals
 * - Screen reader announcements
 * - Color contrast utilities
 */

import { useEffect, useRef, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

export interface AriaLabelOptions {
  /** The label text */
  label: string;
  /** Additional context for screen readers */
  description?: string;
  /** Hint for how to interact */
  hint?: string;
  /** Current state (for toggles, checkboxes) */
  state?: string;
  /** Position in a set */
  position?: {
    current: number;
    total: number;
  };
}

export interface FocusTrapOptions {
  /** Enable focus trap */
  enabled: boolean;
  /** Initial focus selector */
  initialFocus?: string;
  /** Return focus on deactivate */
  returnFocus?: boolean;
  /** Callback when escape is pressed */
  onEscape?: () => void;
}

export interface AnnounceOptions {
  /** Announcement priority */
  priority?: "polite" | "assertive";
  /** Clear delay in milliseconds */
  clearDelay?: number;
}

// ============================================================================
// ARIA LABEL GENERATORS
// ============================================================================

/**
 * Generate a complete accessible label for interactive elements
 */
export function generateAriaLabel(options: AriaLabelOptions): string {
  const parts: string[] = [options.label];

  if (options.state) {
    parts.push(`, ${options.state}`);
  }

  if (options.position) {
    parts.push(`, ${options.position.current} of ${options.position.total}`);
  }

  if (options.description) {
    parts.push(`. ${options.description}`);
  }

  if (options.hint) {
    parts.push(`. ${options.hint}`);
  }

  return parts.join("");
}

/**
 * Generate ARIA props for a form field
 */
export function getFieldAriaProps(
  fieldId: string,
  options: {
    required?: boolean;
    invalid?: boolean;
    errorMessage?: string;
    helpText?: string;
    disabled?: boolean;
  }
): Record<string, string | boolean | undefined> {
  const describedBy: string[] = [];

  if (options.helpText) {
    describedBy.push(`${fieldId}-help`);
  }

  if (options.invalid && options.errorMessage) {
    describedBy.push(`${fieldId}-error`);
  }

  return {
    "aria-required": options.required,
    "aria-invalid": options.invalid,
    "aria-disabled": options.disabled,
    "aria-describedby": describedBy.length > 0 ? describedBy.join(" ") : undefined,
  };
}

/**
 * Generate ARIA props for a button
 */
export function getButtonAriaProps(
  options: {
    pressed?: boolean;
    expanded?: boolean;
    controls?: string;
    hasPopup?: "menu" | "listbox" | "tree" | "grid" | "dialog";
    disabled?: boolean;
    busy?: boolean;
    label?: string;
  }
): Record<string, string | boolean | undefined> {
  return {
    "aria-pressed": options.pressed,
    "aria-expanded": options.expanded,
    "aria-controls": options.controls,
    "aria-haspopup": options.hasPopup,
    "aria-disabled": options.disabled,
    "aria-busy": options.busy,
    "aria-label": options.label,
  };
}

/**
 * Generate ARIA props for a listbox or select
 */
export function getListboxAriaProps(
  options: {
    expanded?: boolean;
    controls?: string;
    activedescendant?: string;
    multiselectable?: boolean;
    required?: boolean;
    disabled?: boolean;
    label?: string;
  }
): Record<string, string | boolean | undefined> {
  return {
    role: "listbox",
    "aria-expanded": options.expanded,
    "aria-controls": options.controls,
    "aria-activedescendant": options.activedescendant,
    "aria-multiselectable": options.multiselectable,
    "aria-required": options.required,
    "aria-disabled": options.disabled,
    "aria-label": options.label,
  };
}

// ============================================================================
// KEYBOARD NAVIGATION
// ============================================================================

/**
 * Key codes for keyboard navigation
 */
export const Keys = {
  ENTER: "Enter",
  ESCAPE: "Escape",
  SPACE: " ",
  TAB: "Tab",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  HOME: "Home",
  END: "End",
  PAGE_UP: "PageUp",
  PAGE_DOWN: "PageDown",
  DELETE: "Delete",
  BACKSPACE: "Backspace",
} as const;

/**
 * Check if a key is a navigation key
 */
export function isNavigationKey(key: string): boolean {
  const navigationKeys = [
    Keys.ARROW_UP,
    Keys.ARROW_DOWN,
    Keys.ARROW_LEFT,
    Keys.ARROW_RIGHT,
    Keys.HOME,
    Keys.END,
    Keys.TAB,
  ];
  return navigationKeys.includes(key as (typeof navigationKeys)[number]);
}

/**
 * Check if a key is an activation key
 */
export function isActivationKey(key: string): boolean {
  const activationKeys = [Keys.ENTER, Keys.SPACE];
  return activationKeys.includes(key as (typeof activationKeys)[number]);
}

/**
 * Handle keyboard navigation for a list
 */
export function handleListKeyboardNavigation(
  event: React.KeyboardEvent,
  options: {
    currentIndex: number;
    totalItems: number;
    onSelect: (index: number) => void;
    onActivate?: (index: number) => void;
    loop?: boolean;
    orientation?: "horizontal" | "vertical";
  }
): void {
  const { currentIndex, totalItems, onSelect, onActivate, loop = true, orientation = "vertical" } = options;

  const nextKey = orientation === "vertical" ? Keys.ARROW_DOWN : Keys.ARROW_RIGHT;
  const prevKey = orientation === "vertical" ? Keys.ARROW_UP : Keys.ARROW_LEFT;

  switch (event.key) {
    case nextKey: {
      event.preventDefault();
      const nextIndex = currentIndex < totalItems - 1 ? currentIndex + 1 : loop ? 0 : currentIndex;
      onSelect(nextIndex);
      break;
    }
    case prevKey: {
      event.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : loop ? totalItems - 1 : currentIndex;
      onSelect(prevIndex);
      break;
    }
    case Keys.HOME: {
      event.preventDefault();
      onSelect(0);
      break;
    }
    case Keys.END: {
      event.preventDefault();
      onSelect(totalItems - 1);
      break;
    }
    case Keys.ENTER:
    case Keys.SPACE: {
      event.preventDefault();
      onActivate?.(currentIndex);
      break;
    }
  }
}

/**
 * Handle keyboard navigation for a grid
 */
export function handleGridKeyboardNavigation(
  event: React.KeyboardEvent,
  options: {
    currentRow: number;
    currentCol: number;
    totalRows: number;
    totalCols: number;
    onSelect: (row: number, col: number) => void;
    onActivate?: (row: number, col: number) => void;
  }
): void {
  const { currentRow, currentCol, totalRows, totalCols, onSelect, onActivate } = options;

  switch (event.key) {
    case Keys.ARROW_UP: {
      event.preventDefault();
      if (currentRow > 0) {
        onSelect(currentRow - 1, currentCol);
      }
      break;
    }
    case Keys.ARROW_DOWN: {
      event.preventDefault();
      if (currentRow < totalRows - 1) {
        onSelect(currentRow + 1, currentCol);
      }
      break;
    }
    case Keys.ARROW_LEFT: {
      event.preventDefault();
      if (currentCol > 0) {
        onSelect(currentRow, currentCol - 1);
      }
      break;
    }
    case Keys.ARROW_RIGHT: {
      event.preventDefault();
      if (currentCol < totalCols - 1) {
        onSelect(currentRow, currentCol + 1);
      }
      break;
    }
    case Keys.HOME: {
      event.preventDefault();
      if (event.ctrlKey) {
        onSelect(0, 0);
      } else {
        onSelect(currentRow, 0);
      }
      break;
    }
    case Keys.END: {
      event.preventDefault();
      if (event.ctrlKey) {
        onSelect(totalRows - 1, totalCols - 1);
      } else {
        onSelect(currentRow, totalCols - 1);
      }
      break;
    }
    case Keys.ENTER:
    case Keys.SPACE: {
      event.preventDefault();
      onActivate?.(currentRow, currentCol);
      break;
    }
  }
}

// ============================================================================
// FOCUS MANAGEMENT
// ============================================================================

/**
 * Hook for trapping focus within a container
 */
export function useFocusTrap(options: FocusTrapOptions) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!options.enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Set initial focus
    if (options.initialFocus) {
      const initialElement = container.querySelector<HTMLElement>(options.initialFocus);
      initialElement?.focus();
    } else if (firstElement) {
      firstElement.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== Keys.TAB) return;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === Keys.ESCAPE && options.onEscape) {
        options.onEscape();
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    container.addEventListener("keydown", handleEscape);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      container.removeEventListener("keydown", handleEscape);
    };
  }, [options.enabled, options.initialFocus, options.onEscape]);

  return containerRef;
}

/**
 * Hook for managing focus restoration
 */
export function useFocusRestore(enabled: boolean = true) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (enabled) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }

    return () => {
      if (enabled && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [enabled]);
}

/**
 * Hook for auto-focusing an element
 */
export function useAutoFocus<T extends HTMLElement>(
  enabled: boolean = true,
  delay: number = 0
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!enabled || !ref.current) return;

    const timeoutId = setTimeout(() => {
      ref.current?.focus();
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [enabled, delay]);

  return ref;
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    )
  ).filter((el) => {
    // Check if element is visible
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

/**
 * Focus the next focusable element
 */
export function focusNext(container: HTMLElement): void {
  const elements = getFocusableElements(container);
  const currentIndex = elements.indexOf(document.activeElement as HTMLElement);
  const nextIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0;
  elements[nextIndex]?.focus();
}

/**
 * Focus the previous focusable element
 */
export function focusPrevious(container: HTMLElement): void {
  const elements = getFocusableElements(container);
  const currentIndex = elements.indexOf(document.activeElement as HTMLElement);
  const prevIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1;
  elements[prevIndex]?.focus();
}

// ============================================================================
// SCREEN READER ANNOUNCEMENTS
// ============================================================================

let announcementRegion: HTMLElement | null = null;

/**
 * Create or get the live region for announcements
 */
function getAnnouncementRegion(): HTMLElement {
  if (!announcementRegion) {
    announcementRegion = document.createElement("div");
    announcementRegion.setAttribute("role", "status");
    announcementRegion.setAttribute("aria-live", "polite");
    announcementRegion.setAttribute("aria-atomic", "true");
    announcementRegion.className = "sr-only";
    announcementRegion.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    document.body.appendChild(announcementRegion);
  }
  return announcementRegion;
}

/**
 * Announce a message to screen readers
 */
export function announce(
  message: string,
  options: AnnounceOptions = {}
): void {
  const { priority = "polite", clearDelay = 5000 } = options;
  const region = getAnnouncementRegion();

  // Set priority
  region.setAttribute("aria-live", priority);

  // Clear previous announcement
  region.textContent = "";

  // Set new announcement after a brief delay (ensures screen readers pick it up)
  setTimeout(() => {
    region.textContent = message;

    // Clear after delay
    if (clearDelay > 0) {
      setTimeout(() => {
        region.textContent = "";
      }, clearDelay);
    }
  }, 100);
}

/**
 * Hook for making announcements
 */
export function useAnnounce() {
  return useCallback((message: string, options?: AnnounceOptions) => {
    announce(message, options);
  }, []);
}

// ============================================================================
// COLOR CONTRAST UTILITIES
// ============================================================================

/**
 * Calculate relative luminance of a color
 */
export function getRelativeLuminance(hexColor: string): number {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const sRGB = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );

  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const L1 = getRelativeLuminance(color1);
  const L2 = getRelativeLuminance(color2);

  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG requirements
 */
export function meetsContrastRequirements(
  foreground: string,
  background: string,
  level: "AA" | "AAA" = "AA",
  isLargeText: boolean = false
): { passes: boolean; ratio: number } {
  const ratio = getContrastRatio(foreground, background);

  const requirements = {
    AA: { normal: 4.5, large: 3 },
    AAA: { normal: 7, large: 4.5 },
  };

  const threshold = isLargeText
    ? requirements[level].large
    : requirements[level].normal;

  return {
    passes: ratio >= threshold,
    ratio,
  };
}

// ============================================================================
// ACCESSIBILITY CHECK HELPERS
// ============================================================================

/**
 * Check if an element has accessible name
 */
export function hasAccessibleName(element: HTMLElement): boolean {
  // Check for aria-label
  if (element.getAttribute("aria-label")) return true;

  // Check for aria-labelledby
  if (element.getAttribute("aria-labelledby")) {
    const labelledById = element.getAttribute("aria-labelledby")!;
    const labelElement = document.getElementById(labelledById);
    if (labelElement?.textContent?.trim()) return true;
  }

  // Check for visible text content
  if (element.textContent?.trim()) return true;

  // Check for alt attribute (images)
  if (element.tagName === "IMG" && element.getAttribute("alt")) return true;

  // Check for title attribute
  if (element.getAttribute("title")) return true;

  // Check for label association (form elements)
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label?.textContent?.trim()) return true;
  }

  return false;
}

/**
 * Check if interactive element has proper role
 */
export function hasProperRole(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute("role");

  // Elements with implicit roles
  const implicitRoles: Record<string, string[]> = {
    button: ["button"],
    a: ["link"],
    input: ["textbox", "checkbox", "radio", "combobox"],
    select: ["combobox", "listbox"],
    textarea: ["textbox"],
  };

  // If element has explicit role, it's fine
  if (role) return true;

  // Check if element has implicit role
  if (implicitRoles[tagName]) return true;

  // Check if element is interactive (has click handler, etc.)
  const isInteractive =
    element.hasAttribute("onclick") ||
    element.hasAttribute("tabindex") ||
    element.tagName === "BUTTON" ||
    element.tagName === "A";

  // Interactive elements should have a role
  return !isInteractive;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  Keys,
  generateAriaLabel,
  getFieldAriaProps,
  getButtonAriaProps,
  getListboxAriaProps,
  isNavigationKey,
  isActivationKey,
  handleListKeyboardNavigation,
  handleGridKeyboardNavigation,
  useFocusTrap,
  useFocusRestore,
  useAutoFocus,
  getFocusableElements,
  focusNext,
  focusPrevious,
  announce,
  useAnnounce,
  getRelativeLuminance,
  getContrastRatio,
  meetsContrastRequirements,
  hasAccessibleName,
  hasProperRole,
};