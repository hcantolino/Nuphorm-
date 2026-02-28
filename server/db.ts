import { eq, and, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, uploadedFiles } from "../drizzle/schema";
import * as schema from "../drizzle/schema";
import "../drizzle/relations";
import { ENV } from './_core/env';
import fs from "fs";
import path from "path";
import { UPLOADS_DIR } from "./storage";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

// ── Local JSON metadata store (used when DATABASE_URL is not set) ─────────────
// Persists uploaded-file records to ./uploads/.metadata.json so uploads survive
// server restarts in development without a real database.

const LOCAL_METADATA_PATH = path.join(UPLOADS_DIR, ".metadata.json");

interface LocalFileRecord {
  id: number;
  userId: number;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  mimeType: string;
  fileSizeBytes: number;
  folderId?: string;
  tags?: string;
  description?: string;
  uploadedAt: string;
  updatedAt: string;
}

function readLocalMetadata(): LocalFileRecord[] {
  try {
    if (!fs.existsSync(LOCAL_METADATA_PATH)) return [];
    return JSON.parse(fs.readFileSync(LOCAL_METADATA_PATH, "utf-8")) as LocalFileRecord[];
  } catch {
    return [];
  }
}

function writeLocalMetadata(records: LocalFileRecord[]): void {
  try {
    fs.mkdirSync(path.dirname(LOCAL_METADATA_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_METADATA_PATH, JSON.stringify(records, null, 2), "utf-8");
  } catch (err) {
    console.error("[LocalMetadata] Write failed:", err);
  }
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL, { schema, mode: 'default' });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    // Always include lastSignedIn in the update set if provided
    if (user.lastSignedIn) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }

    const insertQuery = db.insert(users).values(values);
    
    // Always use onDuplicateKeyUpdate to handle existing users
    await insertQuery.onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Upsert user error:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.query.users.findFirst({
      where: eq(users.openId, openId),
    });
    return result || null;
  } catch (error) {
    console.error("[Database] Get user error:", error);
    return null;
  }
}

export async function getUserSubscriptionStatus(userId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    return user || null;
  } catch (error) {
    console.error("[Database] Get subscription status error:", error);
    return null;
  }
}

export async function getUserByStripeCustomerId(customerId: string) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.query.users.findFirst({
      where: eq(users.stripeCustomerId, customerId),
    });
    return result || null;
  } catch (error) {
    console.error("[Database] Get user by stripe customer error:", error);
    return null;
  }
}

export async function updateUserSubscription(userId: number, data: {
  subscriptionStatus?: 'trial' | 'active' | 'canceled' | 'expired';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string | null;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
}) {
  const db = await getDb();
  if (!db) return;

  try {
    await db.update(users).set(data).where(eq(users.id, userId));
  } catch (error) {
    console.error("[Database] Update subscription error:", error);
    throw error;
  }
}

export async function incrementTrialUsage(userId: number) {
  const db = await getDb();
  if (!db) return;

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (user) {
      await db.update(users).set({
        trialUsedCount: (user.trialUsedCount || 0) + 1,
        trialUsedAt: new Date(),
      }).where(eq(users.id, userId));
    }
  } catch (error) {
    console.error("[Database] Increment trial usage error:", error);
    throw error;
  }
}

export async function logSubscriptionEvent(userId: number, eventType: string, metadata?: any) {
  const db = await getDb();
  if (!db) return;

  try {
    // Implementation would go here
  } catch (error) {
    console.error("[Database] Log subscription event error:", error);
  }
}

export async function getSubscriptionEvents(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  try {
    // Implementation would go here
    return [];
  } catch (error) {
    console.error("[Database] Get subscription events error:", error);
    return [];
  }
}

export async function logUploadedFile(userId: number, data: {
  fileName: string;
  fileKey: string;
  fileUrl: string;
  mimeType: string;
  fileSizeBytes: number;
  folderId?: string;
  tags?: string[];
  description?: string;
}) {
  const db = await getDb();
  if (!db) {
    // No database — persist to local JSON file instead
    const records = readLocalMetadata();
    const now = new Date().toISOString();
    const newId = records.length > 0 ? Math.max(...records.map((r) => r.id)) + 1 : 1;
    records.push({
      id: newId,
      userId,
      fileName: data.fileName,
      fileKey: data.fileKey,
      fileUrl: data.fileUrl,
      mimeType: data.mimeType,
      fileSizeBytes: data.fileSizeBytes,
      ...(data.folderId && { folderId: data.folderId }),
      ...(data.tags?.length && { tags: JSON.stringify(data.tags) }),
      ...(data.description && { description: data.description }),
      uploadedAt: now,
      updatedAt: now,
    });
    writeLocalMetadata(records);
    console.log("[LocalMetadata] Saved file record:", data.fileName, "id:", newId);
    return;
  }
  
  try {
    const now = new Date();
    console.log('Generated insert SQL:', db.insert(uploadedFiles).values({
      userId,
      fileName: data.fileName,
      fileKey: data.fileKey,
      fileUrl: data.fileUrl,
      mimeType: data.mimeType,
      fileSizeBytes: data.fileSizeBytes,
      ...(data.folderId !== undefined && { folderId: data.folderId }),
      ...(data.tags && data.tags.length > 0 && { tags: JSON.stringify(data.tags) }),
      ...(data.description !== undefined && { description: data.description }),
      uploadedAt: now,
      updatedAt: now,
    } as any).toSQL().sql);
    await db.insert(uploadedFiles).values({
        userId,
        fileName: data.fileName,
        fileKey: data.fileKey,
        fileUrl: data.fileUrl,
        mimeType: data.mimeType,
        fileSizeBytes: data.fileSizeBytes,
        ...(data.folderId !== undefined && { folderId: data.folderId }),
        ...(data.tags && data.tags.length > 0 && { tags: JSON.stringify(data.tags) }),
        ...(data.description !== undefined && { description: data.description }),
        uploadedAt: now,
        updatedAt: now,
      });
  } catch (error: any) {
    console.error("[Database] Log uploaded file error:", error);
    // Capture the SQL for debugging
    const debugNow = new Date();
    const debugSql = db.insert(uploadedFiles).values({
        userId,
        fileName: data.fileName,
        fileKey: data.fileKey,
        fileUrl: data.fileUrl,
        mimeType: data.mimeType,
        fileSizeBytes: data.fileSizeBytes,
        ...(data.folderId !== undefined && { folderId: data.folderId }),
        ...(data.tags && data.tags.length > 0 && { tags: JSON.stringify(data.tags) }),
        ...(data.description !== undefined && { description: data.description }),
        uploadedAt: debugNow,
        updatedAt: debugNow,
      }).toSQL().sql;
    console.error('[DEBUG] Generated SQL:', debugSql);
    const errorMsg = error?.message || 'Unknown error';
    throw new Error(`DB Error: ${errorMsg} | SQL: ${debugSql}`);
  }
}

export async function logGeneration(userId: number, data: {
  generationType: string;
  dataType?: string;
  generationTime?: number;
  success?: boolean;
  errorMessage?: string;
}) {
  const db = await getDb();
  if (!db) return;

  try {
    // Implementation would go here
  } catch (error) {
    console.error("[Database] Log generation error:", error);
  }
}

export async function getUserUploadedFiles(userId: number) {
  const db = await getDb();
  if (!db) {
    // No database — read from local JSON file
    const records = readLocalMetadata();
    return records
      .filter((r) => r.userId === userId)
      .map((r) => ({
        ...r,
        uploadedAt: new Date(r.uploadedAt),
        updatedAt: new Date(r.updatedAt),
      }));
  }

  try {
    const files = await (db.query.uploadedFiles as any).findMany({
      where: eq(uploadedFiles.userId, userId),
    });
    return files || [];
  } catch (error) {
    console.error("[Database] Get uploaded files error:", error);
    return [];
  }
}

export async function getUploadedFilesByDateRange(userId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];

  try {
    const files = await (db.query.uploadedFiles as any).findMany({
      where: and(
        eq(uploadedFiles.userId, userId),
        gte(uploadedFiles.uploadedAt, startDate),
        lte(uploadedFiles.uploadedAt, endDate)
      ),
    });
    return files || [];
  } catch (error) {
    console.error("[Database] Get uploaded files by date range error:", error);
    return [];
  }
}

export async function updateStorageUsage(userId: number, data: {
  totalStorageBytes?: number;
  fileCount?: number;
  csvStorageBytes?: number;
  xlsxStorageBytes?: number;
  otherStorageBytes?: number;
}) {
  const db = await getDb();
  if (!db) return;

  try {
    // Implementation would go here
  } catch (error) {
    console.error("[Database] Update storage usage error:", error);
  }
}

export async function getStorageUsage(userId: number) {
  const db = await getDb();
  if (!db) return { totalStorageBytes: 0, fileCount: 0 };

  try {
    const files = await db
      .select({
        fileSizeBytes: uploadedFiles.fileSizeBytes,
      })
      .from(uploadedFiles)
      .where(eq(uploadedFiles.userId, userId));

    const totalStorageBytes = files.reduce((sum, file) => sum + (file.fileSizeBytes || 0), 0);
    
    return {
      totalStorageBytes,
      fileCount: files.length,
    };
  } catch (error) {
    console.error("[Database] Get storage usage error:", error);
    return { totalStorageBytes: 0, fileCount: 0 };
  }
}

export async function formatBytes(bytes: number): Promise<string> {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// ── Local JSON store for technical files (no-DB fallback) ────────────────────

const LOCAL_TECHNICAL_PATH = path.join(UPLOADS_DIR, ".technical-files.json");

interface LocalTechnicalRecord {
  id: number;
  userId: number;
  title: string;
  content: string;
  chartImage?: string;
  dataFiles?: string;
  measurements?: string;
  createdAt: string;
}

function readLocalTechnical(): LocalTechnicalRecord[] {
  try {
    if (!fs.existsSync(LOCAL_TECHNICAL_PATH)) return [];
    return JSON.parse(fs.readFileSync(LOCAL_TECHNICAL_PATH, "utf-8")) as LocalTechnicalRecord[];
  } catch { return []; }
}

function writeLocalTechnical(records: LocalTechnicalRecord[]): void {
  try {
    fs.mkdirSync(path.dirname(LOCAL_TECHNICAL_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_TECHNICAL_PATH, JSON.stringify(records, null, 2), "utf-8");
  } catch (err) { console.error("[LocalTechnical] Write failed:", err); }
}

export async function saveTechnicalFile(userId: number, data: {
  title: string;
  content: string;
  chartImage?: string;
  dataFiles?: string | string[];
  measurements?: string;
}) {
  const db = await getDb();
  const dataFilesStr = typeof data.dataFiles === 'string'
    ? data.dataFiles
    : data.dataFiles ? JSON.stringify(data.dataFiles) : undefined;

  if (!db) {
    const records = readLocalTechnical();
    const newId = records.length > 0 ? Math.max(...records.map((r) => r.id)) + 1 : 1;
    records.push({
      id: newId,
      userId,
      title: data.title,
      content: data.content,
      ...(data.chartImage && { chartImage: data.chartImage }),
      ...(dataFilesStr && { dataFiles: dataFilesStr }),
      ...(data.measurements && { measurements: data.measurements }),
      createdAt: new Date().toISOString(),
    });
    writeLocalTechnical(records);
    return { id: newId };
  }

  try {
    // DB implementation placeholder
    console.log("[Database] saveTechnicalFile: DB not fully implemented, using local fallback");
    const records = readLocalTechnical();
    const newId = records.length > 0 ? Math.max(...records.map((r) => r.id)) + 1 : 1;
    records.push({
      id: newId,
      userId,
      title: data.title,
      content: data.content,
      ...(data.chartImage && { chartImage: data.chartImage }),
      ...(dataFilesStr && { dataFiles: dataFilesStr }),
      ...(data.measurements && { measurements: data.measurements }),
      createdAt: new Date().toISOString(),
    });
    writeLocalTechnical(records);
    return { id: newId };
  } catch (error) {
    console.error("[Database] Save technical file error:", error);
  }
}

export async function getTechnicalFiles(userId: number) {
  const db = await getDb();
  const records = readLocalTechnical();
  const userRecords = records.filter((r) => r.userId === userId);

  if (!db) {
    return userRecords.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      chartImage: r.chartImage,
      dataFiles: r.dataFiles ? (JSON.parse(r.dataFiles) as string[]) : [],
      measurements: r.measurements ? (JSON.parse(r.measurements) as string[]) : [],
      createdAt: r.createdAt,
    }));
  }

  try {
    // Return local records as fallback since DB schema not fully wired
    return userRecords.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      chartImage: r.chartImage,
      dataFiles: r.dataFiles ? (JSON.parse(r.dataFiles) as string[]) : [],
      measurements: r.measurements ? (JSON.parse(r.measurements) as string[]) : [],
      createdAt: r.createdAt,
    }));
  } catch (error) {
    console.error("[Database] Get technical files error:", error);
    return [];
  }
}

export async function getTechnicalFileById(fileId: number, userId: number) {
  const records = readLocalTechnical();
  const record = records.find((r) => r.id === fileId && r.userId === userId);
  if (!record) return null;
  return {
    id: record.id,
    title: record.title,
    content: record.content,
    chartImage: record.chartImage,
    dataFiles: record.dataFiles ? (JSON.parse(record.dataFiles) as string[]) : [],
    measurements: record.measurements ? (JSON.parse(record.measurements) as string[]) : [],
    createdAt: record.createdAt,
  };
}

export async function deleteUploadedFile(fileId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    const records = readLocalMetadata();
    const filtered = records.filter((r) => !(r.id === fileId && r.userId === userId));
    if (filtered.length === records.length) return false; // nothing deleted
    writeLocalMetadata(filtered);
    return true;
  }

  try {
    await db
      .delete(uploadedFiles)
      .where(
        and(
          eq(uploadedFiles.id, fileId),
          eq(uploadedFiles.userId, userId)
        )
      );
    return true;
  } catch (error) {
    console.error("[Database] Delete uploaded file error:", error);
    return false;
  }
}

export async function deleteTechnicalFile(fileId: number, userId: number) {
  const db = await getDb();
  if (!db) return;

  try {
    // Implementation would go here
  } catch (error) {
    console.error("[Database] Delete technical file error:", error);
  }
}

export async function submitFeedback(userId: number, data: {
  title: string;
  message: string;
  category?: string;
}) {
  const db = await getDb();
  if (!db) return;

  try {
    // Implementation would go here
  } catch (error) {
    console.error("[Database] Submit feedback error:", error);
  }
}

export async function getUserFeedback(userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    // Implementation would go here
    return [];
  } catch (error) {
    console.error("[Database] Get user feedback error:", error);
    return [];
  }
}

export async function getAllFeedback(limit = 100) {
  const db = await getDb();
  if (!db) return [];

  try {
    // Implementation would go here
    return [];
  } catch (error) {
    console.error("[Database] Get all feedback error:", error);
    return [];
  }
}

export async function updateFeedbackStatus(feedbackId: number, status: 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed') {
  const db = await getDb();
  if (!db) return;

  try {
    // Implementation would go here
  } catch (error) {
    console.error("[Database] Update feedback status error:", error);
  }
}
