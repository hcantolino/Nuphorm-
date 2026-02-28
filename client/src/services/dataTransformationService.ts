import { FilterSettings } from '@/components/biostat/DataFilterPanel';

export interface DataPoint {
  [key: string]: string | number | Date;
}

/**
 * Apply filters and transformations to data
 */
export function transformData(
  data: DataPoint[],
  filters: FilterSettings,
  numericColumns: string[]
): DataPoint[] {
  if (!data || data.length === 0) return data;

  let transformed = [...data];

  // Apply date range filter
  if (filters.dateRangeStart || filters.dateRangeEnd) {
    transformed = filterByDateRange(transformed, filters.dateRangeStart, filters.dateRangeEnd);
  }

  // Apply value range filter
  if (filters.valueMin !== undefined || filters.valueMax !== undefined) {
    transformed = filterByValueRange(transformed, filters.valueMin, filters.valueMax, numericColumns);
  }

  // Apply category filter
  if (filters.selectedCategories && filters.selectedCategories.length > 0) {
    transformed = filterByCategories(transformed, filters.selectedCategories);
  }

  // Apply aggregation
  if (filters.aggregationType && filters.aggregationType !== 'none') {
    transformed = aggregateData(transformed, filters.aggregationType, numericColumns);
  }

  // Apply smoothing
  if (filters.smoothingEnabled && filters.smoothingWindow && filters.smoothingWindow > 1) {
    transformed = smoothData(transformed, filters.smoothingWindow, numericColumns);
  }

  return transformed;
}

/**
 * Filter data by date range
 */
function filterByDateRange(
  data: DataPoint[],
  startDate?: string,
  endDate?: string
): DataPoint[] {
  if (!startDate && !endDate) return data;

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  return data.filter((point) => {
    // Try to find a date field
    const dateField = Object.entries(point).find(
      ([key, value]) =>
        typeof value === 'string' &&
        !isNaN(Date.parse(value)) &&
        (key.toLowerCase().includes('date') || key.toLowerCase().includes('time'))
    );

    if (!dateField) return true;

    const pointDate = new Date(dateField[1] as string);
    if (start && pointDate < start) return false;
    if (end && pointDate > end) return false;
    return true;
  });
}

/**
 * Filter data by value range
 */
function filterByValueRange(
  data: DataPoint[],
  minValue?: number,
  maxValue?: number,
  numericColumns: string[] = []
): DataPoint[] {
  if (minValue === undefined && maxValue === undefined) return data;

  return data.filter((point) => {
    for (const col of numericColumns) {
      const value = point[col];
      if (typeof value === 'number') {
        if (minValue !== undefined && value < minValue) return false;
        if (maxValue !== undefined && value > maxValue) return false;
      }
    }
    return true;
  });
}

/**
 * Filter data by categories
 */
function filterByCategories(data: DataPoint[], categories: string[]): DataPoint[] {
  if (categories.length === 0) return data;

  return data.filter((point) => {
    // Look for category-like fields
    for (const [key, value] of Object.entries(point)) {
      if (
        typeof value === 'string' &&
        (key.toLowerCase().includes('category') ||
          key.toLowerCase().includes('type') ||
          key.toLowerCase().includes('status'))
      ) {
        if (categories.includes(value)) return true;
      }
    }
    return false;
  });
}

/**
 * Aggregate data by time period
 */
function aggregateData(
  data: DataPoint[],
  aggregationType: 'daily' | 'weekly' | 'monthly',
  numericColumns: string[]
): DataPoint[] {
  if (data.length === 0) return data;

  const grouped: { [key: string]: DataPoint[] } = {};

  // Group data by period
  data.forEach((point) => {
    const dateField = Object.entries(point).find(
      ([key, value]) =>
        typeof value === 'string' &&
        !isNaN(Date.parse(value)) &&
        (key.toLowerCase().includes('date') || key.toLowerCase().includes('time'))
    );

    if (!dateField) {
      grouped['ungrouped'] = grouped['ungrouped'] || [];
      grouped['ungrouped'].push(point);
      return;
    }

    const date = new Date(dateField[1] as string);
    let periodKey = '';

    if (aggregationType === 'daily') {
      periodKey = date.toISOString().split('T')[0];
    } else if (aggregationType === 'weekly') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      periodKey = weekStart.toISOString().split('T')[0];
    } else if (aggregationType === 'monthly') {
      periodKey = date.toISOString().substring(0, 7);
    }

    grouped[periodKey] = grouped[periodKey] || [];
    grouped[periodKey].push(point);
  });

  // Average values within each group
  const aggregated: DataPoint[] = [];
  for (const [period, points] of Object.entries(grouped)) {
    const avgPoint: DataPoint = { period };

    for (const col of numericColumns) {
      const values = points
        .map((p) => p[col])
        .filter((v) => typeof v === 'number') as number[];

      if (values.length > 0) {
        avgPoint[col] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    }

    aggregated.push(avgPoint);
  }

  return aggregated;
}

/**
 * Apply moving average smoothing
 */
function smoothData(
  data: DataPoint[],
  windowSize: number,
  numericColumns: string[]
): DataPoint[] {
  if (data.length < windowSize) return data;

  const smoothed: DataPoint[] = [];

  for (let i = 0; i < data.length; i++) {
    const point = { ...data[i] };

    // Apply moving average to numeric columns
    for (const col of numericColumns) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(data.length, i + Math.ceil(windowSize / 2));

      const values = [];
      for (let j = start; j < end; j++) {
        const val = data[j][col];
        if (typeof val === 'number') {
          values.push(val);
        }
      }

      if (values.length > 0) {
        point[col] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    }

    smoothed.push(point);
  }

  return smoothed;
}

/**
 * Get data statistics
 */
export function getDataStatistics(data: DataPoint[], numericColumns: string[]) {
  const stats: { [key: string]: { min: number; max: number; avg: number } } = {};

  for (const col of numericColumns) {
    const values = data
      .map((p) => p[col])
      .filter((v) => typeof v === 'number') as number[];

    if (values.length > 0) {
      stats[col] = {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
      };
    }
  }

  return stats;
}

/**
 * Get date range from data
 */
export function getDateRange(data: DataPoint[]): { min: string; max: string } | null {
  const dates: Date[] = [];

  data.forEach((point) => {
    Object.values(point).forEach((value) => {
      if (typeof value === 'string' && !isNaN(Date.parse(value))) {
        dates.push(new Date(value));
      }
    });
  });

  if (dates.length === 0) return null;

  const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
  return {
    min: sorted[0].toISOString().split('T')[0],
    max: sorted[sorted.length - 1].toISOString().split('T')[0],
  };
}

/**
 * Get value range from data
 */
export function getValueRange(data: DataPoint[], numericColumns: string[]) {
  let min = Infinity;
  let max = -Infinity;

  for (const col of numericColumns) {
    data.forEach((point) => {
      const value = point[col];
      if (typeof value === 'number') {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    });
  }

  return min === Infinity ? null : { min, max };
}

/**
 * Get unique categories from data
 */
export function getCategories(data: DataPoint[]): string[] {
  const categories = new Set<string>();

  data.forEach((point) => {
    Object.entries(point).forEach(([key, value]) => {
      if (
        typeof value === 'string' &&
        (key.toLowerCase().includes('category') ||
          key.toLowerCase().includes('type') ||
          key.toLowerCase().includes('status'))
      ) {
        categories.add(value);
      }
    });
  });

  return Array.from(categories);
}
