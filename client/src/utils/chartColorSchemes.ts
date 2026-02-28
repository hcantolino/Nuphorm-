import type { ColorScheme } from '@/stores/chartSettingsStore';

export const colorSchemes: Record<ColorScheme, { primary: string; secondary: string; accent: string; grid: string; background: string }> = {
  default: {
    primary: '#3b82f6',
    secondary: '#10b981',
    accent: '#f59e0b',
    grid: '#e5e7eb',
    background: '#ffffff',
  },
  publication: {
    primary: '#000000',
    secondary: '#404040',
    accent: '#808080',
    grid: '#d3d3d3',
    background: '#ffffff',
  },
  dark: {
    primary: '#60a5fa',
    secondary: '#34d399',
    accent: '#fbbf24',
    grid: '#4b5563',
    background: '#1f2937',
  },
  minimal: {
    primary: '#1f2937',
    secondary: '#9ca3af',
    accent: '#d1d5db',
    grid: '#f3f4f6',
    background: '#ffffff',
  },
  vibrant: {
    primary: '#ef4444',
    secondary: '#8b5cf6',
    accent: '#ec4899',
    grid: '#fca5a5',
    background: '#fef2f2',
  },
};

/**
 * Get the color for a specific dataset label based on the color scheme
 * Cycles through primary, secondary, and accent colors for multiple datasets
 */
export const getColorForScheme = (
  datasetLabel: string,
  colorScheme: ColorScheme,
  index: number = 0
): string => {
  const scheme = colorSchemes[colorScheme];
  const colors = [scheme.primary, scheme.secondary, scheme.accent];
  return colors[index % colors.length];
};

/**
 * Get the fill color for a dataset (for bar/area charts)
 * Returns a slightly transparent version of the stroke color
 */
export const getFillForScheme = (
  datasetLabel: string,
  colorScheme: ColorScheme,
  index: number = 0
): string => {
  const strokeColor = getColorForScheme(datasetLabel, colorScheme, index);
  // Convert hex to rgba with 0.3 opacity
  return hexToRgba(strokeColor, 0.3);
};

/**
 * Get the grid color for the current scheme
 */
export const getGridColorForScheme = (colorScheme: ColorScheme): string => {
  return colorSchemes[colorScheme].grid;
};

/**
 * Get the background color for the current scheme
 */
export const getBackgroundColorForScheme = (colorScheme: ColorScheme): string => {
  return colorSchemes[colorScheme].background;
};

/**
 * Convert hex color to rgba
 */
export const hexToRgba = (hex: string, alpha: number = 1): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Get all colors for a scheme
 */
export const getAllColorsForScheme = (colorScheme: ColorScheme) => {
  return colorSchemes[colorScheme];
};
