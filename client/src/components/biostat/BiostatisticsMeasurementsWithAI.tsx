import React, { useState } from "react";
import { ChevronDown, Plus, X, Send, Sparkles, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
// import MeasurementTooltip from "./MeasurementTooltip";
import { AIBiostatisticsChatTabIntegrated } from "./AIBiostatisticsChatTabIntegrated";
import { measurementMetadata } from "@/data/measurementMetadata";
import { useMeasurementTriggerStore } from "@/stores/measurementTriggerStore";
import { formatMeasurementQuery, getFirstNumericColumn } from "@/utils/measurementQueryFormatter";

interface Measurement {
  id: string;
  name: string;
  category: string;
  description?: string;
}

interface BiostatisticsMeasurementsWithAIProps {
  selectedMeasurements?: string[];
  selectedDataFiles?: string[];
  onSelectMeasurement?: (measurementId: string) => void;
  onRemoveMeasurement?: (measurementId: string) => void;
  onChatMessage?: (message: string, files: string[], measurements: string[]) => void;
  onDataLoaded?: (data: any) => void;
  compact?: boolean;
  showChatOnly?: boolean;
}

const measurements: Measurement[] = [
  // Descriptive Statistics
  { id: "mean", name: "Mean", category: "Descriptive Statistics", description: "Average value of continuous variables" },
  { id: "median", name: "Median", category: "Descriptive Statistics", description: "Middle value of continuous variables" },
  { id: "mode", name: "Mode", category: "Descriptive Statistics", description: "Most frequently occurring value" },
  { id: "std_dev", name: "Standard Deviation", category: "Descriptive Statistics", description: "Measure of data spread" },
  { id: "variance", name: "Variance", category: "Descriptive Statistics", description: "Squared standard deviation" },
  { id: "range", name: "Range", category: "Descriptive Statistics", description: "Difference between max and min values" },
  { id: "iqr", name: "Interquartile Range (IQR)", category: "Descriptive Statistics", description: "Range of middle 50% of data" },
  { id: "min_max", name: "Min/Max Values", category: "Descriptive Statistics", description: "Minimum and maximum values" },
  { id: "freq", name: "Frequencies and Percentages", category: "Descriptive Statistics", description: "Count and proportion of categorical variables" },
  { id: "patient_disp", name: "Patient Disposition", category: "Descriptive Statistics", description: "Enrollment, randomization, completion rates" },
  { id: "exposure", name: "Exposure Summaries", category: "Descriptive Statistics", description: "Treatment duration and dose compliance" },

  // Efficacy Analyses
  { id: "t_test", name: "T-tests", category: "Efficacy Analyses", description: "Compare means between two groups" },
  { id: "wilcoxon", name: "Wilcoxon Rank-Sum / Mann-Whitney", category: "Efficacy Analyses", description: "Non-parametric test for continuous data" },
  { id: "chi_square", name: "Chi-Square Test", category: "Efficacy Analyses", description: "Test for categorical data associations" },
  { id: "fisher_exact", name: "Fisher's Exact Test", category: "Efficacy Analyses", description: "Exact test for categorical data" },
  { id: "ancova", name: "ANCOVA", category: "Efficacy Analyses", description: "Analysis of Covariance with adjusted means" },
  { id: "anova", name: "ANOVA", category: "Efficacy Analyses", description: "Compare means across multiple groups" },
  { id: "logistic_reg", name: "Logistic Regression", category: "Efficacy Analyses", description: "Odds ratios for binary outcomes" },
  { id: "mmrm", name: "Mixed Models for Repeated Measures (MMRM)", category: "Efficacy Analyses", description: "Handle longitudinal data" },
  { id: "non_inferiority", name: "Non-Inferiority/Superiority Testing", category: "Efficacy Analyses", description: "Test margins and confidence intervals" },
  { id: "ci", name: "Confidence Intervals", category: "Efficacy Analyses", description: "Range of plausible parameter values" },
  { id: "p_value", name: "P-values", category: "Efficacy Analyses", description: "Statistical significance testing" },

  // Survival and Time-to-Event Analyses
  { id: "km", name: "Kaplan-Meier Estimates", category: "Survival and Time-to-Event Analyses", description: "Survival curves and median survival times" },
  { id: "log_rank", name: "Log-Rank Test", category: "Survival and Time-to-Event Analyses", description: "Compare survival distributions" },
  { id: "cox", name: "Cox Proportional Hazards Regression", category: "Survival and Time-to-Event Analyses", description: "Hazard ratios adjusted for covariates" },
  { id: "pfs", name: "Progression-Free Survival (PFS)", category: "Survival and Time-to-Event Analyses", description: "Time to disease progression" },
  { id: "os", name: "Overall Survival (OS)", category: "Survival and Time-to-Event Analyses", description: "Time to death from any cause" },
  { id: "ttp", name: "Time to Progression", category: "Survival and Time-to-Event Analyses", description: "Time until disease progression" },

  // Safety Analyses
  { id: "ae_incidence", name: "Adverse Event Incidence Tables", category: "Safety Analyses", description: "AE counts by System Organ Class and severity" },
  { id: "sae", name: "Serious Adverse Events (SAEs)", category: "Safety Analyses", description: "SAEs, deaths, discontinuations due to AEs" },
  { id: "shift_tables", name: "Shift Tables", category: "Safety Analyses", description: "Lab values and vital signs changes" },
  { id: "lab_summaries", name: "Laboratory Parameter Summaries", category: "Safety Analyses", description: "Means, changes from baseline, outliers" },
  { id: "vital_signs", name: "Vital Signs Summaries", category: "Safety Analyses", description: "Blood pressure, heart rate, temperature" },
  { id: "ecg", name: "ECG Summaries", category: "Safety Analyses", description: "Electrocardiogram findings and changes" },

  // Pharmacokinetic (PK) and Pharmacodynamic (PD) Analyses
  { id: "auc", name: "AUC (Area Under Curve)", category: "PK/PD Analyses", description: "Total drug exposure over time" },
  { id: "cmax", name: "Cmax (Maximum Concentration)", category: "PK/PD Analyses", description: "Peak drug concentration" },
  { id: "tmax", name: "Tmax (Time to Maximum Concentration)", category: "PK/PD Analyses", description: "Time when peak concentration occurs" },
  { id: "t_half", name: "Half-life (t1/2)", category: "PK/PD Analyses", description: "Time for drug concentration to reduce by half" },
  { id: "clearance", name: "Clearance", category: "PK/PD Analyses", description: "Rate of drug elimination" },
  { id: "vd", name: "Volume of Distribution (Vd)", category: "PK/PD Analyses", description: "Theoretical drug distribution volume" },
  { id: "pop_pk", name: "Population PK Modeling", category: "PK/PD Analyses", description: "Non-linear mixed effects models" },
  { id: "exposure_response", name: "Exposure-Response Relationships", category: "PK/PD Analyses", description: "PK-efficacy/safety correlations" },
  { id: "conc_time", name: "Concentration-Time Profiles", category: "PK/PD Analyses", description: "Plots and summaries of drug levels" },

  // Bioequivalence and Biosimilarity Analyses
  { id: "be_ci", name: "90% Confidence Intervals", category: "Bioequivalence/Biosimilarity", description: "Geometric mean ratios for AUC and Cmax" },
  { id: "avg_be", name: "Average Bioequivalence Testing", category: "Bioequivalence/Biosimilarity", description: "ANOVA on log-transformed data" },
  { id: "ind_be", name: "Individual Bioequivalence", category: "Bioequivalence/Biosimilarity", description: "Subject-by-formulation interactions" },
  { id: "pop_be", name: "Population Bioequivalence", category: "Bioequivalence/Biosimilarity", description: "Variability between formulations" },
  { id: "biosim_comp", name: "Biosimilarity Comparability Studies", category: "Bioequivalence/Biosimilarity", description: "PK/PD similarity assessment" },
];

export default function BiostatisticsMeasurementsWithAI({
  selectedMeasurements = [],
  selectedDataFiles = [],
  onSelectMeasurement,
  onRemoveMeasurement,
  onChatMessage,
  onDataLoaded,
  compact = false,
  showChatOnly = false,
}: BiostatisticsMeasurementsWithAIProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["Descriptive Statistics"])
  );
  const [activeTab, setActiveTab] = useState("ai-chat");
  const { setPendingMessage } = useMeasurementTriggerStore();

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Since search is removed, use all measurements
  const groupedMeasurements = measurements.reduce(
    (acc, measurement) => {
      const category = measurement.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(measurement);
      return acc;
    },
    {} as Record<string, Measurement[]>
  );

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* AI Chat at the Top */}
      <div className="border-b border-border">
        <AIBiostatisticsChatTabIntegrated
          selectedFiles={selectedDataFiles}
          onMeasurementSelect={onSelectMeasurement}
          onDataLoaded={onDataLoaded}
        />
      </div>

      {/* Measurements Below */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* Selected Measurements */}
        {selectedMeasurements.length > 0 && (
          <div className="p-3 border-b border-border bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Selected ({selectedMeasurements.length})</p>
            <div className="flex flex-wrap gap-1">
              {selectedMeasurements.map((id) => {
                const measurement = measurements.find((m) => m.id === id);
                return (
                  <Badge
                    key={id}
                    variant="secondary"
                    className="cursor-pointer flex items-center gap-1"
                    onClick={() => onRemoveMeasurement?.(id)}
                  >
                    {measurement?.name}
                    <X className="w-3 h-3" />
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Measurements List */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {Object.entries(groupedMeasurements).map(([category, items]) => (
                <div key={category}>
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between p-2 hover:bg-muted rounded-md transition-colors"
                  >
                    <span className="text-xs font-semibold text-foreground">{category}</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        expandedCategories.has(category) ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {expandedCategories.has(category) && (
                    <div className="space-y-1 ml-2">
                      {items.map((measurement) => (
                        <button
                          key={measurement.id}
                          onClick={() => {
                    onSelectMeasurement?.(measurement.id);
                    // Format and insert measurement query into AI chat
                    const query = formatMeasurementQuery(measurement.id, measurement.name);
                    setPendingMessage(query);
                  }}
                          className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${
                            selectedMeasurements.includes(measurement.id)
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted text-foreground"
                          }`}
                          title={measurement.description}
                        >
                          <div className="flex items-center gap-2">
                            <Plus className="w-3 h-3" />
                            <span className="font-medium">{measurement.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
