/**
 * Position Color Constants
 * Default colors for positions without a configured color
 */

// Default position colors for the color picker
export const DEFAULT_POSITION_COLORS = [
  { name: "Blue", hex: "#3B82F6" },
  { name: "Orange", hex: "#F97316" },
  { name: "Purple", hex: "#8B5CF6" },
  { name: "Green", hex: "#22C55E" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Teal", hex: "#14B8A6" },
  { name: "Yellow", hex: "#EAB308" },
  { name: "Red", hex: "#EF4444" },
  { name: "Indigo", hex: "#6366F1" },
  { name: "Cyan", hex: "#06B6D4" },
];

// Fallback colors for positions without configured colors
export const FALLBACK_POSITION_COLORS: Record<string, string> = {
  barista: "#3B82F6",
  chef: "#F97316",
  server: "#8B5CF6",
  manager: "#22C55E",
  bartender: "#EC4899",
  host: "#14B8A6",
  kitchen: "#EAB308",
  default: "#6B7280",
};

/**
 * Get a position color from the fallback map
 */
export function getFallbackPositionColor(positionName: string | null): string {
  if (!positionName) return FALLBACK_POSITION_COLORS.default;
  const key = positionName.toLowerCase();
  return FALLBACK_POSITION_COLORS[key] || FALLBACK_POSITION_COLORS.default;
}
