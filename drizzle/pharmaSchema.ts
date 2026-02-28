/**
 * Pharma Biostats Platform Database Schema
 * Stores reports, analysis history, and metadata
 */

import {
  mysqlTable,
  varchar,
  text,
  json,
  timestamp,
  int,
  decimal,
  boolean,
  enum as mysqlEnum,
} from "drizzle-orm/mysql-core";

/**
 * Pharma Reports Table
 */
export const pharmaReports = mysqlTable("pharma_reports", {
  id: varchar("id", { length: 255 }).primaryKey(),
  user_id: varchar("user_id", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  study_id: varchar("study_id", { length: 255 }),
  analysis_type: varchar("analysis_type", { length: 100 }).notNull(),
  data_file_id: varchar("data_file_id", { length: 255 }),
  data_summary: json("data_summary"),
  sections: json("sections"),
  tables: json("tables"),
  figures: json("figures"),
  regulatory_assessment: json("regulatory_assessment"),
  metadata: json("metadata"),
  status: mysqlEnum("status", [
    "draft",
    "completed",
    "archived",
  ]).default("draft"),
  fda_compliant: boolean("fda_compliant"),
  ema_compliant: boolean("ema_compliant"),
  quality_score: int("quality_score"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
  published_at: timestamp("published_at"),
});

/**
 * Analysis History Table
 */
export const analysisHistory = mysqlTable("analysis_history", {
  id: varchar("id", { length: 255 }).primaryKey(),
  user_id: varchar("user_id", { length: 255 }).notNull(),
  data_file_id: varchar("data_file_id", { length: 255 }),
  analysis_type: varchar("analysis_type", { length: 100 }).notNull(),
  query: text("query"),
  data_characteristics: json("data_characteristics"),
  baseline_analysis: json("baseline_analysis"),
  detected_intents: json("detected_intents"),
  results: json("results"),
  insights: json("insights"),
  execution_time_ms: int("execution_time_ms"),
  status: mysqlEnum("status", [
    "pending",
    "completed",
    "failed",
  ]).default("pending"),
  error_message: text("error_message"),
  created_at: timestamp("created_at").defaultNow(),
});

/**
 * Pharma Data Files Table
 */
export const pharmaDataFiles = mysqlTable("pharma_data_files", {
  id: varchar("id", { length: 255 }).primaryKey(),
  user_id: varchar("user_id", { length: 255 }).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  file_type: varchar("file_type", { length: 50 }).notNull(), // csv, xlsx, json
  s3_key: varchar("s3_key", { length: 255 }).notNull(),
  s3_url: varchar("s3_url", { length: 500 }).notNull(),
  file_size_bytes: int("file_size_bytes"),
  row_count: int("row_count"),
  column_count: int("column_count"),
  columns: json("columns"),
  data_characteristics: json("data_characteristics"),
  data_quality_score: int("data_quality_score"),
  baseline_analysis: json("baseline_analysis"),
  suggested_analyses: json("suggested_analyses"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

/**
 * Image Analysis Results Table
 */
export const imageAnalysisResults = mysqlTable("image_analysis_results", {
  id: varchar("id", { length: 255 }).primaryKey(),
  user_id: varchar("user_id", { length: 255 }).notNull(),
  image_filename: varchar("image_filename", { length: 255 }).notNull(),
  image_type: varchar("image_type", { length: 100 }).notNull(), // gel_blot, chromatogram, etc.
  s3_key: varchar("s3_key", { length: 255 }).notNull(),
  detected_features: json("detected_features"),
  quantification: json("quantification"),
  quality_assessment: json("quality_assessment"),
  suggested_analyses: json("suggested_analyses"),
  created_at: timestamp("created_at").defaultNow(),
});

/**
 * Pharma Metrics Cache Table
 */
export const pharmaMetricsCache = mysqlTable("pharma_metrics_cache", {
  id: varchar("id", { length: 255 }).primaryKey(),
  analysis_id: varchar("analysis_id", { length: 255 }).notNull(),
  metric_type: varchar("metric_type", { length: 100 }).notNull(),
  metric_name: varchar("metric_name", { length: 255 }).notNull(),
  metric_value: decimal("metric_value", { precision: 18, scale: 6 }),
  metric_unit: varchar("metric_unit", { length: 50 }),
  confidence_interval_lower: decimal("ci_lower", { precision: 18, scale: 6 }),
  confidence_interval_upper: decimal("ci_upper", { precision: 18, scale: 6 }),
  created_at: timestamp("created_at").defaultNow(),
});

/**
 * Report Templates Table
 */
export const reportTemplates = mysqlTable("report_templates", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  analysis_type: varchar("analysis_type", { length: 100 }).notNull(),
  sections: json("sections"),
  default_settings: json("default_settings"),
  created_by: varchar("created_by", { length: 255 }).notNull(),
  is_public: boolean("is_public").default(false),
  created_at: timestamp("created_at").defaultNow(),
});

/**
 * User Preferences Table
 */
export const userPharmaPreferences = mysqlTable("user_pharma_preferences", {
  id: varchar("id", { length: 255 }).primaryKey(),
  user_id: varchar("user_id", { length: 255 }).notNull().unique(),
  preferred_analysis_types: json("preferred_analysis_types"),
  default_confidence_level: decimal("default_confidence_level", {
    precision: 3,
    scale: 2,
  }).default("0.95"),
  auto_baseline_analysis: boolean("auto_baseline_analysis").default(true),
  auto_generate_report: boolean("auto_generate_report").default(false),
  report_format: mysqlEnum("report_format", [
    "pdf",
    "html",
    "docx",
  ]).default("pdf"),
  theme: varchar("theme", { length: 50 }).default("light"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export type PharmaReport = typeof pharmaReports.$inferSelect;
export type AnalysisHistoryRecord = typeof analysisHistory.$inferSelect;
export type PharmaDataFile = typeof pharmaDataFiles.$inferSelect;
export type ImageAnalysisResult = typeof imageAnalysisResults.$inferSelect;
export type PharmaMetricsCache = typeof pharmaMetricsCache.$inferSelect;
export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type UserPharmaPreferences = typeof userPharmaPreferences.$inferSelect;
