import { useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import MeasurementTooltip from "./MeasurementTooltip";
import { measurementMetadata } from "@/data/measurementMetadata";

interface Measurement {
  id: string;
  name: string;
  category: string;
}

interface BiostatisticsMeasurementsProps {
  selectedMeasurements?: string[];
  onSelectMeasurement?: (measurementId: string) => void;
  onRemoveMeasurement?: (measurementId: string) => void;
}

const measurements: Measurement[] = [
  // Descriptive Statistics
  { id: "mean", name: "Mean", category: "Measures of Central Tendency" },
  { id: "median", name: "Median", category: "Measures of Central Tendency" },
  { id: "mode", name: "Mode", category: "Measures of Central Tendency" },

  // Dispersion
  { id: "std_dev", name: "Standard Deviation", category: "Measures of Dispersion" },
  { id: "variance", name: "Variance", category: "Measures of Dispersion" },
  { id: "range", name: "Range", category: "Measures of Dispersion" },
  { id: "iqr", name: "Interquartile Range (IQR)", category: "Measures of Dispersion" },

  // Frequencies
  { id: "freq", name: "Frequencies", category: "Frequencies and Percentages" },
  { id: "percent", name: "Percentages", category: "Frequencies and Percentages" },
  { id: "cum_freq", name: "Cumulative Frequencies", category: "Frequencies and Percentages" },

  // Hypothesis Testing
  { id: "p_value", name: "P-values", category: "P-values" },
  { id: "t_test", name: "T-tests / ANOVA", category: "T-tests / ANOVA" },
  { id: "chi_square", name: "Chi-square / Fisher's Exact Test", category: "Chi-square / Fisher's Exact Test" },

  // Survival Analysis
  { id: "km", name: "Kaplan-Meier Estimator", category: "Survival Analysis" },
  { id: "log_rank", name: "Log-Rank Test", category: "Survival Analysis" },
  { id: "cox", name: "Cox Proportional Hazards Model", category: "Survival Analysis" },

  // Regression
  { id: "linear_reg", name: "Linear Regression", category: "Regression Analysis" },
  { id: "logistic_reg", name: "Logistic Regression", category: "Regression Analysis" },
  { id: "ancova", name: "ANCOVA (Analysis of Covariance)", category: "Regression Analysis" },

  // Study Design
  { id: "sample_size", name: "Sample Size", category: "Study Design" },
  { id: "power", name: "Power Analysis", category: "Study Design" },
  { id: "itt", name: "Intention-to-Treat (ITT) vs. Per-Protocol (PP)", category: "Study Design" },
  { id: "bioequiv", name: "Bioequivalence (BE) Metrics", category: "Study Design" },
];

const categories = [
  "Measures of Central Tendency",
  "Measures of Dispersion",
  "Frequencies and Percentages",
  "P-values",
  "T-tests / ANOVA",
  "Chi-square / Fisher's Exact Test",
  "Survival Analysis",
  "Regression Analysis",
  "Study Design",
];

export default function BiostatisticsMeasurements({
  selectedMeasurements = [],
  onSelectMeasurement,
  onRemoveMeasurement,
}: BiostatisticsMeasurementsProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.slice(0, 2))
  );

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getCategoryMeasurements = (category: string) => {
    return measurements.filter((m) => m.category === category);
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-200 sticky top-0 bg-white">
        <h2 className="text-sm font-semibold text-gray-900">Biostatistical Measurements</h2>
        <p className="text-xs text-gray-500 mt-1">Select measurements to analyze</p>
      </div>

      {/* Selected Measurements */}
      {selectedMeasurements.length > 0 && (
        // BEFORE: bg-blue-50, text-blue-900, border-blue-200
        // AFTER:  unified slate tones
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <p className="text-xs font-semibold text-slate-700 mb-2">SELECTED ({selectedMeasurements.length})</p>
          <div className="space-y-1">
            {selectedMeasurements.map((id) => {
              const measurement = measurements.find((m) => m.id === id);
              return (
                <div
                  key={id}
                  className="flex items-center justify-between px-2 py-1.5 bg-white rounded border border-slate-200 text-xs"
                >
                  <span className="text-slate-700 font-medium">{measurement?.name}</span>
                  <button
                    onClick={() => onRemoveMeasurement?.(id)}
                    className="text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Measurements List */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-1">
          {categories.map((category) => {
            const isExpanded = expandedCategories.has(category);
            const categoryMeasurements = getCategoryMeasurements(category);

            return (
              <div key={category} className="mb-2">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded transition-colors text-left"
                >
                  <span className="text-xs font-semibold text-gray-700">{category}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Category Items */}
                {isExpanded && (
                  <div className="pl-3 space-y-1 mt-1">
                    {categoryMeasurements.map((measurement) => {
                      const isSelected = selectedMeasurements.includes(measurement.id);
                      return (
                        <MeasurementTooltip
                          key={measurement.id}
                          measurement={measurementMetadata[measurement.id]}
                        >
                          <button
                            onClick={() => onSelectMeasurement?.(measurement.id)}
                            // BEFORE: selected = bg-blue-100 text-blue-900 border-blue-300
                            // AFTER:  selected = bg-slate-900 text-white border-slate-900
                            className={`w-full flex items-center justify-between px-2 py-2 rounded text-xs transition-all group ${
                              isSelected
                                ? "bg-slate-900 text-white border border-slate-900"
                                : "text-slate-700 hover:bg-slate-50 border border-transparent"
                            }`}
                          >
                            <span className="font-medium">{measurement.name}</span>
                            {/* BEFORE: X plain, Plus text-gray-400 */}
                            {/* AFTER:  white icons on dark selected row */}
                            {isSelected ? (
                              <X className="w-3.5 h-3.5 text-slate-300" />
                            ) : (
                              <Plus className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        </MeasurementTooltip>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
