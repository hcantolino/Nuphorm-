import { getDb } from "./db";
import {
  regulatoryProjects,
  regulatoryProjectFiles,
  regulatorySourceDocuments,
  generatedRegulatoryDocuments,
  documentCitations,
  documentGenerationJobs,
  regulatoryTemplates,
  uploadedFiles,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Create a new regulatory documentation project
 */
export async function createRegulatoryProject(
  userId: number,
  projectName: string,
  deviceName: string,
  deviceType: string,
  intendedUse?: string,
  predicateDevices?: any[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(regulatoryProjects).values({
    userId,
    projectName,
    deviceName,
    deviceType,
    intendedUse,
    predicateDevices: predicateDevices ? JSON.stringify(predicateDevices) : null,
    status: "draft",
  });
}

/**
 * Get a regulatory project by ID
 */
export async function getRegulatoryProject(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const project = await db
    .select()
    .from(regulatoryProjects)
    .where(
      and(eq(regulatoryProjects.id, projectId), eq(regulatoryProjects.userId, userId))
    )
    .limit(1);

  return project[0] || null;
}

/**
 * Get all regulatory projects for a user
 */
export async function getUserRegulatoryProjects(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(regulatoryProjects)
    .where(eq(regulatoryProjects.userId, userId))
    .orderBy(regulatoryProjects.updatedAt);
}

/**
 * Update regulatory project status
 */
export async function updateRegulatoryProjectStatus(
  projectId: number,
  userId: number,
  status: "draft" | "in_progress" | "generated" | "reviewed" | "submitted"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .update(regulatoryProjects)
    .set({ status, updatedAt: new Date() })
    .where(
      and(eq(regulatoryProjects.id, projectId), eq(regulatoryProjects.userId, userId))
    );
}

/**
 * Add a source document to a project
 */
export async function addSourceDocument(
  projectId: number,
  userId: number,
  sourceType: string,
  documentName: string,
  fileKey: string,
  fileUrl: string,
  mimeType: string,
  fileSizeBytes: number,
  extractedText?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(regulatorySourceDocuments).values({
    projectId,
    userId,
    sourceType: sourceType as any,
    documentName,
    fileKey,
    fileUrl,
    mimeType,
    fileSizeBytes,
    extractedText,
  });
}

/**
 * Get source documents for a project
 */
export async function getProjectSourceDocuments(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(regulatorySourceDocuments)
    .where(
      and(
        eq(regulatorySourceDocuments.projectId, projectId),
        eq(regulatorySourceDocuments.userId, userId)
      )
    );
}

/**
 * Create a generated regulatory document
 */
export async function createGeneratedDocument(
  projectId: number,
  userId: number,
  documentType: string,
  title: string,
  content: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(generatedRegulatoryDocuments).values({
    projectId,
    userId,
    documentType: documentType as any,
    title,
    content,
    generationStatus: "completed",
    generatedAt: new Date(),
  });
}

/**
 * Get generated documents for a project
 */
export async function getProjectGeneratedDocuments(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(generatedRegulatoryDocuments)
    .where(
      and(
        eq(generatedRegulatoryDocuments.projectId, projectId),
        eq(generatedRegulatoryDocuments.userId, userId)
      )
    );
}

/**
 * Get a specific generated document
 */
export async function getGeneratedDocument(documentId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const doc = await db
    .select()
    .from(generatedRegulatoryDocuments)
    .where(
      and(
        eq(generatedRegulatoryDocuments.id, documentId),
        eq(generatedRegulatoryDocuments.userId, userId)
      )
    )
    .limit(1);

  return doc[0] || null;
}

/**
 * Update generated document content
 */
export async function updateGeneratedDocument(
  documentId: number,
  userId: number,
  content: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .update(generatedRegulatoryDocuments)
    .set({ content, updatedAt: new Date() })
    .where(
      and(
        eq(generatedRegulatoryDocuments.id, documentId),
        eq(generatedRegulatoryDocuments.userId, userId)
      )
    );
}

/**
 * Add a citation to a document
 */
export async function addDocumentCitation(
  documentId: number,
  sourceDocumentId: number,
  citationText: string,
  citationContext?: string,
  citationPage?: string,
  confidence: number = 100
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(documentCitations).values({
    documentId,
    sourceDocumentId,
    citationText,
    citationContext,
    citationPage,
    confidence,
  });
}

/**
 * Get citations for a document
 */
export async function getDocumentCitations(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(documentCitations)
    .where(eq(documentCitations.documentId, documentId));
}

/**
 * Create a document generation job
 */
export async function createGenerationJob(
  projectId: number,
  userId: number,
  jobType: string,
  documentsToGenerate: string[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(documentGenerationJobs).values({
    projectId,
    userId,
    jobType,
    documentsToGenerate: JSON.stringify(documentsToGenerate),
    status: "queued",
    progress: 0,
  });
}

/**
 * Get a generation job
 */
export async function getGenerationJob(jobId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const job = await db
    .select()
    .from(documentGenerationJobs)
    .where(
      and(
        eq(documentGenerationJobs.id, jobId),
        eq(documentGenerationJobs.userId, userId)
      )
    )
    .limit(1);

  return job[0] || null;
}

/**
 * Update a regulatory project's content/settings fields
 */
export async function updateRegulatoryProject(
  projectId: number,
  userId: number,
  data: {
    projectName?: string;
    content?: string;
    referenceFormat?: string;
    paperLayout?: string;
    regulatoryStandard?: string;
    sourceFileIds?: string;
    templateId?: number | null;
    status?: "draft" | "in_progress" | "generated" | "reviewed" | "submitted";
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .update(regulatoryProjects)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(eq(regulatoryProjects.id, projectId), eq(regulatoryProjects.userId, userId))
    );
}

/**
 * Link an uploaded file to a regulatory project
 */
export async function linkFileToProject(projectId: number, fileId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Avoid duplicate links
  const existing = await db
    .select()
    .from(regulatoryProjectFiles)
    .where(
      and(
        eq(regulatoryProjectFiles.projectId, projectId),
        eq(regulatoryProjectFiles.fileId, fileId)
      )
    )
    .limit(1);

  if (existing.length > 0) return;

  return await db.insert(regulatoryProjectFiles).values({ projectId, fileId });
}

/**
 * Unlink an uploaded file from a regulatory project
 */
export async function unlinkFileFromProject(projectId: number, fileId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .delete(regulatoryProjectFiles)
    .where(
      and(
        eq(regulatoryProjectFiles.projectId, projectId),
        eq(regulatoryProjectFiles.fileId, fileId)
      )
    );
}

/**
 * Get all uploaded files linked to a regulatory project (with file metadata)
 */
export async function getProjectFiles(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      id: uploadedFiles.id,
      fileName: uploadedFiles.fileName,
      fileKey: uploadedFiles.fileKey,
      fileUrl: uploadedFiles.fileUrl,
      mimeType: uploadedFiles.mimeType,
      fileSizeBytes: uploadedFiles.fileSizeBytes,
      uploadedAt: uploadedFiles.uploadedAt,
    })
    .from(regulatoryProjectFiles)
    .innerJoin(uploadedFiles, eq(regulatoryProjectFiles.fileId, uploadedFiles.id))
    .where(
      and(
        eq(regulatoryProjectFiles.projectId, projectId),
        eq(uploadedFiles.userId, userId)
      )
    );

  return rows;
}

/**
 * Update generation job status
 */
export async function updateGenerationJobStatus(
  jobId: number,
  userId: number,
  status: "queued" | "processing" | "completed" | "failed",
  progress: number = 0,
  errorMessage?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .update(documentGenerationJobs)
    .set({
      status,
      progress,
      errorMessage,
      updatedAt: new Date(),
      completedAt: status === "completed" || status === "failed" ? new Date() : null,
    })
    .where(
      and(
        eq(documentGenerationJobs.id, jobId),
        eq(documentGenerationJobs.userId, userId)
      )
    );
}

/**
 * Create a regulatory document template record
 */
export async function createTemplate(
  userId: number,
  data: {
    name: string;
    fileKey: string;
    fileUrl: string;
    mimeType: string;
    fileSizeBytes: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(regulatoryTemplates).values({ userId, ...data });
}

/**
 * Get all templates belonging to a user
 */
export async function getUserTemplates(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db
    .select()
    .from(regulatoryTemplates)
    .where(eq(regulatoryTemplates.userId, userId))
    .orderBy(regulatoryTemplates.createdAt);
}

/**
 * Delete a template record
 */
export async function deleteTemplate(templateId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db
    .delete(regulatoryTemplates)
    .where(
      and(
        eq(regulatoryTemplates.id, templateId),
        eq(regulatoryTemplates.userId, userId)
      )
    );
}
