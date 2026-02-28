import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

export interface ExportOptions {
  filename: string;
  format: 'png' | 'svg' | 'csv' | 'xlsx';
  chartElement?: HTMLElement;
  data?: any[];
  columns?: string[];
  colorScheme?: {
    lineColor?: string;
    barColor?: string;
    gridColor?: string;
    chartBackground?: string;
    axisTextColor?: string;
  };
}

/**
 * Convert OKLCH color string to RGB hex format
 * Handles CSS variables and oklch() function
 */
function convertOklchToRgb(color: string): string {
  // If it's already a hex or rgb color, return as-is
  if (color.startsWith('#') || color.startsWith('rgb')) {
    return color;
  }
  
  // Default fallback colors for common CSS variables
  const colorMap: Record<string, string> = {
    'var(--background)': '#ffffff',
    'var(--foreground)': '#000000',
    'var(--card)': '#ffffff',
    'var(--card-foreground)': '#000000',
    'var(--primary)': '#3b82f6',
    'var(--primary-foreground)': '#ffffff',
    'var(--secondary)': '#6b7280',
    'var(--secondary-foreground)': '#ffffff',
    'var(--muted)': '#f3f4f6',
    'var(--muted-foreground)': '#6b7280',
    'var(--accent)': '#3b82f6',
    'var(--accent-foreground)': '#ffffff',
    'var(--destructive)': '#ef4444',
    'var(--destructive-foreground)': '#ffffff',
    'var(--border)': '#e5e7eb',
    'var(--input)': '#e5e7eb',
    'var(--ring)': '#3b82f6',
  };
  
  // Check if it's a CSS variable
  if (color.startsWith('var(')) {
    return colorMap[color] || '#ffffff';
  }
  
  // If it contains oklch, convert to a reasonable default
  if (color.includes('oklch')) {
    return '#ffffff';
  }
  
  return color;
}

/**
 * Clone element and apply inline styles to avoid CSS variable issues
 */
function cloneElementWithInlineStyles(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Apply computed styles inline to all elements
  const applyInlineStyles = (el: HTMLElement) => {
    const computed = window.getComputedStyle(el);
    
    // Copy important styles that might use CSS variables
    const stylesToCopy = [
      'backgroundColor',
      'color',
      'borderColor',
      'fill',
      'stroke',
    ];
    
    stylesToCopy.forEach(style => {
      const value = computed.getPropertyValue(style);
      if (value && value.trim()) {
        const convertedValue = convertOklchToRgb(value);
        (el.style as any)[style] = convertedValue;
      }
    });
    
    // Recursively apply to children
    Array.from(el.children).forEach(child => {
      applyInlineStyles(child as HTMLElement);
    });
  };
  
  applyInlineStyles(clone);
  return clone;
}

/**
 * Export chart as PNG image
 */
export async function exportChartAsPNG(options: ExportOptions): Promise<void> {
  if (!options.chartElement) {
    throw new Error('Chart element is required for PNG export');
  }

  try {
    // Clone the element and apply inline styles to avoid CSS variable issues
    const clonedElement = cloneElementWithInlineStyles(options.chartElement);
    
    // Create a temporary container and append the cloned element
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.appendChild(clonedElement);
    document.body.appendChild(tempContainer);
    
    try {
      const canvas = await html2canvas(clonedElement, {
        backgroundColor: options.colorScheme?.chartBackground || '#ffffff',
        scale: 2,
        logging: false,
        allowTaint: true,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${options.filename}.png`;
      link.click();
    } finally {
      // Clean up temporary container
      document.body.removeChild(tempContainer);
    }
  } catch (error) {
    console.error('Failed to export chart as PNG:', error);
    throw new Error('Failed to export chart as PNG');
  }
}

/**
 * Export chart as SVG image
 */
export async function exportChartAsSVG(options: ExportOptions): Promise<void> {
  if (!options.chartElement) {
    throw new Error('Chart element is required for SVG export');
  }

  try {
    const svgElement = options.chartElement.querySelector('svg');
    if (!svgElement) {
      throw new Error('No SVG element found in chart');
    }

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${options.filename}.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error('Failed to export chart as SVG:', error);
    throw new Error('Failed to export chart as SVG');
  }
}

/**
 * Export data as CSV
 */
export function exportDataAsCSV(options: ExportOptions): void {
  if (!options.data || options.data.length === 0) {
    throw new Error('Data is required for CSV export');
  }

  try {
    const columns = options.columns || Object.keys(options.data[0]);
    const csvContent = [
      columns.join(','),
      ...options.data.map((row) =>
        columns
          .map((col) => {
            const value = row[col];
            // Escape quotes and wrap in quotes if contains comma
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${options.filename}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error('Failed to export data as CSV:', error);
    throw new Error('Failed to export data as CSV');
  }
}

/**
 * Export data as Excel (XLSX)
 */
export function exportDataAsExcel(options: ExportOptions): void {
  if (!options.data || options.data.length === 0) {
    throw new Error('Data is required for Excel export');
  }

  try {
    const columns = options.columns || Object.keys(options.data[0]);
    const worksheetData = [
      columns,
      ...options.data.map((row) => columns.map((col) => row[col])),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

    // Add color scheme metadata as a separate sheet if provided
    if (options.colorScheme) {
      const colorSchemeData = [
        ['Color Scheme Settings'],
        ['Line Color', options.colorScheme.lineColor || 'Default'],
        ['Bar Color', options.colorScheme.barColor || 'Default'],
        ['Grid Color', options.colorScheme.gridColor || 'Default'],
        ['Chart Background', options.colorScheme.chartBackground || 'Default'],
        ['Axis Text Color', options.colorScheme.axisTextColor || 'Default'],
      ];
      const colorSchemeSheet = XLSX.utils.aoa_to_sheet(colorSchemeData);
      XLSX.utils.book_append_sheet(workbook, colorSchemeSheet, 'Color Scheme');
    }

    XLSX.writeFile(workbook, `${options.filename}.xlsx`);
  } catch (error) {
    console.error('Failed to export data as Excel:', error);
    throw new Error('Failed to export data as Excel');
  }
}

/**
 * Export with format selection
 */
export async function exportChart(options: ExportOptions): Promise<void> {
  switch (options.format) {
    case 'png':
      return exportChartAsPNG(options);
    case 'svg':
      return exportChartAsSVG(options);
    case 'csv':
      return exportDataAsCSV(options);
    case 'xlsx':
      return exportDataAsExcel(options);
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}
