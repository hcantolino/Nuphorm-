import { describe, it, expect } from 'vitest';
import {
  colorSchemes,
  getColorForScheme,
  getFillForScheme,
  getGridColorForScheme,
  getBackgroundColorForScheme,
  hexToRgba,
  getAllColorsForScheme,
} from './chartColorSchemes';

describe('chartColorSchemes', () => {
  describe('colorSchemes object', () => {
    it('should have all required color schemes', () => {
      expect(colorSchemes).toHaveProperty('default');
      expect(colorSchemes).toHaveProperty('publication');
      expect(colorSchemes).toHaveProperty('dark');
      expect(colorSchemes).toHaveProperty('minimal');
      expect(colorSchemes).toHaveProperty('vibrant');
    });

    it('should have all required colors in each scheme', () => {
      Object.values(colorSchemes).forEach((scheme) => {
        expect(scheme).toHaveProperty('primary');
        expect(scheme).toHaveProperty('secondary');
        expect(scheme).toHaveProperty('accent');
        expect(scheme).toHaveProperty('grid');
        expect(scheme).toHaveProperty('background');
      });
    });
  });

  describe('getColorForScheme', () => {
    it('should return primary color for index 0', () => {
      const color = getColorForScheme('dataset1', 'default', 0);
      expect(color).toBe(colorSchemes.default.primary);
    });

    it('should return secondary color for index 1', () => {
      const color = getColorForScheme('dataset2', 'default', 1);
      expect(color).toBe(colorSchemes.default.secondary);
    });

    it('should return accent color for index 2', () => {
      const color = getColorForScheme('dataset3', 'default', 2);
      expect(color).toBe(colorSchemes.default.accent);
    });

    it('should cycle back to primary for index 3', () => {
      const color = getColorForScheme('dataset4', 'default', 3);
      expect(color).toBe(colorSchemes.default.primary);
    });

    it('should work with different color schemes', () => {
      const defaultColor = getColorForScheme('data', 'default', 0);
      const darkColor = getColorForScheme('data', 'dark', 0);
      expect(defaultColor).not.toBe(darkColor);
      expect(darkColor).toBe(colorSchemes.dark.primary);
    });
  });

  describe('getFillForScheme', () => {
    it('should return rgba color with 0.3 opacity', () => {
      const fill = getFillForScheme('dataset1', 'default', 0);
      expect(fill).toMatch(/rgba\(\d+, \d+, \d+, 0\.3\)/);
    });

    it('should convert hex to rgba correctly', () => {
      const fill = getFillForScheme('dataset1', 'default', 0);
      // Default primary is #3b82f6 which is rgb(59, 130, 246)
      expect(fill).toBe('rgba(59, 130, 246, 0.3)');
    });
  });

  describe('getGridColorForScheme', () => {
    it('should return grid color for default scheme', () => {
      const gridColor = getGridColorForScheme('default');
      expect(gridColor).toBe(colorSchemes.default.grid);
    });

    it('should return different grid colors for different schemes', () => {
      const defaultGrid = getGridColorForScheme('default');
      const darkGrid = getGridColorForScheme('dark');
      expect(defaultGrid).not.toBe(darkGrid);
    });
  });

  describe('getBackgroundColorForScheme', () => {
    it('should return background color for default scheme', () => {
      const bgColor = getBackgroundColorForScheme('default');
      expect(bgColor).toBe(colorSchemes.default.background);
    });

    it('should return white background for default and minimal', () => {
      expect(getBackgroundColorForScheme('default')).toBe('#ffffff');
      expect(getBackgroundColorForScheme('minimal')).toBe('#ffffff');
    });

    it('should return dark background for dark scheme', () => {
      expect(getBackgroundColorForScheme('dark')).toBe('#1f2937');
    });
  });

  describe('hexToRgba', () => {
    it('should convert hex to rgba with default alpha', () => {
      const rgba = hexToRgba('#3b82f6');
      expect(rgba).toBe('rgba(59, 130, 246, 1)');
    });

    it('should convert hex to rgba with custom alpha', () => {
      const rgba = hexToRgba('#3b82f6', 0.5);
      expect(rgba).toBe('rgba(59, 130, 246, 0.5)');
    });

    it('should handle black color', () => {
      const rgba = hexToRgba('#000000', 0.5);
      expect(rgba).toBe('rgba(0, 0, 0, 0.5)');
    });

    it('should handle white color', () => {
      const rgba = hexToRgba('#ffffff', 0.5);
      expect(rgba).toBe('rgba(255, 255, 255, 0.5)');
    });
  });

  describe('getAllColorsForScheme', () => {
    it('should return all colors for a scheme', () => {
      const colors = getAllColorsForScheme('default');
      expect(colors).toEqual(colorSchemes.default);
    });

    it('should return different colors for different schemes', () => {
      const defaultColors = getAllColorsForScheme('default');
      const darkColors = getAllColorsForScheme('dark');
      expect(defaultColors).not.toEqual(darkColors);
    });
  });
});
