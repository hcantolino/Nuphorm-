import { mysqlTable, int, varchar, text, timestamp, mysqlEnum } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
// Add storage quota field to users table
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  
  // Subscription fields
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["trial", "active", "canceled", "expired"]).default("trial").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  subscriptionStartDate: timestamp("subscriptionStartDate"),
  subscriptionEndDate: timestamp("subscriptionEndDate"),
  trialUsedCount: int("trialUsedCount").default(0).notNull(),
  trialUsedAt: timestamp("trialUsedAt"),
  
  // Profile
  profileImage: text("profileImage"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Subscription events table for tracking
export const subscriptionEvents = mysqlTable("subscriptionEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  stripeEventId: varchar("stripeEventId", { length: 255 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;
export type InsertSubscriptionEvent = typeof subscriptionEvents.$inferInsert;

// Storage tracking table
export const storageUsage = mysqlTable("storageUsage", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  totalStorageBytes: int("totalStorageBytes").default(0).notNull(),
  fileCount: int("fileCount").default(0).notNull(),
  csvStorageBytes: int("csvStorageBytes").default(0).notNull(),
  xlsxStorageBytes: int("xlsxStorageBytes").default(0).notNull(),
  otherStorageBytes: int("otherStorageBytes").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StorageUsage = typeof storageUsage.$inferSelect;
export type InsertStorageUsage = typeof storageUsage.$inferInsert;

// Uploaded files table for tracking user uploads
export const uploadedFiles = mysqlTable("uploadedFiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSizeBytes: int("fileSizeBytes").notNull(),
  folderId: varchar("folderId", { length: 64 }),
  tags: text("tags"), // JSON array of tag IDs
  description: text("description"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type InsertUploadedFile = typeof uploadedFiles.$inferInsert;

export const technicalFiles = mysqlTable("technicalFiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  chartImage: text("chartImage"),
  dataFiles: text("dataFiles"),
  measurements: text("measurements"),
  generatedAt: timestamp("generatedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TechnicalFile = typeof technicalFiles.$inferSelect;
export type InsertTechnicalFile = typeof technicalFiles.$inferInsert;

// User feedback table for collecting issues and suggestions
export const userFeedback = mysqlTable("userFeedback", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  feedbackType: mysqlEnum("feedbackType", ["bug", "suggestion", "feature_request", "general"]).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  page: varchar("page", { length: 100 }),
  userEmail: varchar("userEmail", { length: 320 }),
  status: mysqlEnum("status", ["new", "acknowledged", "in_progress", "resolved", "closed"]).default("new").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserFeedback = typeof userFeedback.$inferSelect;
export type InsertUserFeedback = typeof userFeedback.$inferInsert;

// Regulatory Documentation Producer Tables

// Table for tracking regulatory documentation projects
export const regulatoryProjects = mysqlTable("regulatoryProjects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectName: varchar("projectName", { length: 255 }).notNull(),
  deviceName: varchar("deviceName", { length: 255 }).notNull(),
  deviceType: varchar("deviceType", { length: 100 }).notNull(), // e.g., "diagnostic", "therapeutic", "monitoring"
  intendedUse: text("intendedUse"),
  predicateDevices: text("predicateDevices"), // JSON array of predicate device info
  status: mysqlEnum("status", ["draft", "in_progress", "generated", "reviewed", "submitted"]).default("draft").notNull(),
  // Document editor fields
  content: text("content"),
  referenceFormat: varchar("referenceFormat", { length: 20 }).default("apa"),
  paperLayout: varchar("paperLayout", { length: 20 }).default("document"),
  regulatoryStandard: varchar("regulatoryStandard", { length: 10 }).default("US"),
  // Document settings extras
  sourceFileIds: text("sourceFileIds"), // JSON array of uploadedFile IDs
  templateId: int("templateId"),       // FK to regulatoryTemplates.id (nullable)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Join table linking regulatory projects to uploaded files
export const regulatoryProjectFiles = mysqlTable("regulatoryProjectFiles", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  fileId: int("fileId").notNull(),
  linkedAt: timestamp("linkedAt").defaultNow().notNull(),
});

export type RegulatoryProject = typeof regulatoryProjects.$inferSelect;
export type InsertRegulatoryProject = typeof regulatoryProjects.$inferInsert;

export type RegulatoryProjectFile = typeof regulatoryProjectFiles.$inferSelect;
export type InsertRegulatoryProjectFile = typeof regulatoryProjectFiles.$inferInsert;

// Table for tracking source documents used in generation
export const regulatorySourceDocuments = mysqlTable("regulatorySourceDocuments", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  sourceType: mysqlEnum("sourceType", ["clinical_data", "technical_spec", "safety_report", "performance_data", "literature", "other"]).notNull(),
  documentName: varchar("documentName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSizeBytes: int("fileSizeBytes").notNull(),
  extractedText: text("extractedText"), // Extracted text content for AI processing
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type RegulatorySourceDocument = typeof regulatorySourceDocuments.$inferSelect;
export type InsertRegulatorySourceDocument = typeof regulatorySourceDocuments.$inferInsert;

// Table for tracking generated regulatory documents
export const generatedRegulatoryDocuments = mysqlTable("generatedRegulatoryDocuments", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  documentType: mysqlEnum("documentType", [
    "device_description",
    "intended_use",
    "substantial_equivalence",
    "safety_evaluation",
    "performance_evaluation",
    "clinical_evaluation",
    "risk_analysis",
    "biocompatibility",
    "sterilization",
    "labeling_instructions",
    "510k_summary",
    "de_novo_summary"
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(), // Generated document content
  generationStatus: mysqlEnum("generationStatus", ["generating", "completed", "failed"]).default("generating").notNull(),
  generationError: text("generationError"), // Error message if generation failed
  generatedAt: timestamp("generatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GeneratedRegulatoryDocument = typeof generatedRegulatoryDocuments.$inferSelect;
export type InsertGeneratedRegulatoryDocument = typeof generatedRegulatoryDocuments.$inferInsert;

// Table for tracking citations and source references in generated documents
export const documentCitations = mysqlTable("documentCitations", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  sourceDocumentId: int("sourceDocumentId").notNull(),
  citationText: text("citationText").notNull(), // The text that was cited
  citationContext: text("citationContext"), // Surrounding context for the citation
  citationPage: varchar("citationPage", { length: 50 }), // Page number or section reference
  confidence: int("confidence").default(100), // Confidence score (0-100) of citation accuracy
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentCitation = typeof documentCitations.$inferSelect;
export type InsertDocumentCitation = typeof documentCitations.$inferInsert;

// Table for tracking document generation jobs
export const documentGenerationJobs = mysqlTable("documentGenerationJobs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  jobType: varchar("jobType", { length: 100 }).notNull(), // e.g., "full_submission", "single_document"
  documentsToGenerate: text("documentsToGenerate"), // JSON array of document types to generate
  status: mysqlEnum("status", ["queued", "processing", "completed", "failed"]).default("queued").notNull(),
  progress: int("progress").default(0), // Progress percentage (0-100)
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DocumentGenerationJob = typeof documentGenerationJobs.$inferSelect;
export type InsertDocumentGenerationJob = typeof documentGenerationJobs.$inferInsert;

// Templates for regulatory documents (user-uploaded PDF/DOCX/MD files)
export const regulatoryTemplates = mysqlTable("regulatoryTemplates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(), // S3 key
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSizeBytes: int("fileSizeBytes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RegulatoryTemplate = typeof regulatoryTemplates.$inferSelect;
export type InsertRegulatoryTemplate = typeof regulatoryTemplates.$inferInsert;
