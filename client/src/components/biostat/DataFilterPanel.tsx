import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Filter, RotateCcw } from 'lucide-react';

export interface FilterSettings {
  dateRangeStart?: string;
  dateRangeEnd?: string;
  valueMin?: number;
  valueMax?: number;
  selectedCategories?: string[];
  aggregationType?: 'none' | 'daily' | 'weekly' | 'monthly';
  smoothingEnabled?: boolean;
  smoothingWindow?: number;
}

interface DataFilterPanelProps {
  onFilterChange: (filters: FilterSettings) => void;
  availableCategories?: string[];
  dataDateRange?: { min: string; max: string };
  dataValueRange?: { min: number; max: number };
}

export default function DataFilterPanel({
  onFilterChange,
  availableCategories = [],
  dataDateRange,
  dataValueRange,
}: DataFilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterSettings>({
    aggregationType: 'none',
    smoothingEnabled: false,
    smoothingWindow: 3,
  });

  const handleFilterUpdate = (newFilters: FilterSettings) => {
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleReset = () => {
    const resetFilters: FilterSettings = {
      aggregationType: 'none',
      smoothingEnabled: false,
      smoothingWindow: 3,
    };
    setFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  return (
    <Card className="p-4 bg-white border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium"
        >
          <Filter className="w-4 h-4" />
          <span>Data Filters & Transformations</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-gray-600 hover:text-gray-900"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Reset
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-6 border-t pt-4">
          {/* Date Range Filter */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Date Range</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Start Date</Label>
                <Input
                  type="date"
                  value={filters.dateRangeStart || ''}
                  onChange={(e) =>
                    handleFilterUpdate({
                      ...filters,
                      dateRangeStart: e.target.value,
                    })
                  }
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">End Date</Label>
                <Input
                  type="date"
                  value={filters.dateRangeEnd || ''}
                  onChange={(e) =>
                    handleFilterUpdate({
                      ...filters,
                      dateRangeEnd: e.target.value,
                    })
                  }
                  className="text-sm"
                />
              </div>
            </div>
            {dataDateRange && (
              <p className="text-xs text-gray-500">
                Data range: {dataDateRange.min} to {dataDateRange.max}
              </p>
            )}
          </div>

          {/* Value Range Filter */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Value Range</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Min Value</Label>
                <Input
                  type="number"
                  value={filters.valueMin ?? ''}
                  onChange={(e) =>
                    handleFilterUpdate({
                      ...filters,
                      valueMin: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  placeholder="Auto"
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Max Value</Label>
                <Input
                  type="number"
                  value={filters.valueMax ?? ''}
                  onChange={(e) =>
                    handleFilterUpdate({
                      ...filters,
                      valueMax: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  placeholder="Auto"
                  className="text-sm"
                />
              </div>
            </div>
            {dataValueRange && (
              <p className="text-xs text-gray-500">
                Data range: {dataValueRange.min.toFixed(2)} to {dataValueRange.max.toFixed(2)}
              </p>
            )}
          </div>

          {/* Category Filter */}
          {availableCategories.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Categories</h3>
              <div className="space-y-2">
                {availableCategories.map((category) => (
                  <label key={category} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.selectedCategories?.includes(category) ?? false}
                      onChange={(e) => {
                        const selected = filters.selectedCategories || [];
                        const updated = e.target.checked
                          ? [...selected, category]
                          : selected.filter((c) => c !== category);
                        handleFilterUpdate({
                          ...filters,
                          selectedCategories: updated.length > 0 ? updated : undefined,
                        });
                      }}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{category}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Aggregation */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Aggregation</h3>
            <select
              value={filters.aggregationType || 'none'}
              onChange={(e) =>
                handleFilterUpdate({
                  ...filters,
                  aggregationType: e.target.value as FilterSettings['aggregationType'],
                })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white"
            >
              <option value="none">None</option>
              <option value="daily">Daily Average</option>
              <option value="weekly">Weekly Average</option>
              <option value="monthly">Monthly Average</option>
            </select>
          </div>

          {/* Smoothing */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.smoothingEnabled || false}
                onChange={(e) =>
                  handleFilterUpdate({
                    ...filters,
                    smoothingEnabled: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm font-semibold text-gray-700">Enable Smoothing</span>
            </label>
            {filters.smoothingEnabled && (
              <div>
                <Label className="text-xs text-gray-600">Smoothing Window (points)</Label>
                <Input
                  type="number"
                  min="2"
                  max="20"
                  value={filters.smoothingWindow || 3}
                  onChange={(e) =>
                    handleFilterUpdate({
                      ...filters,
                      smoothingWindow: parseInt(e.target.value),
                    })
                  }
                  className="text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Larger values create smoother curves
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
