import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { jobRouter } from "./routers/jobRouter";
import { regressionRouter } from "./routers/regressionRouter";
import { mlRouter } from "./routers/mlRouter";
import { orchestrationRouter } from "./routers/orchestrationRouter";
import { documentGenerationRouter } from "./routers/documentGenerationRouter";
import { z } from "zod";
import {
  getUserSubscriptionStatus,
  updateUserSubscription,
  incrementTrialUsage,
  logSubscriptionEvent,
  getUserUploadedFiles,
  getStorageUsage,
  logGeneration,
  saveTechnicalFile,
  getTechnicalFiles,
  getTechnicalFileById,
  deleteTechnicalFile,
  updateTechnicalFile,
  deleteUploadedFile,
  submitFeedback,
  getUserFeedback,
  getAllFeedback,
  updateFeedbackStatus,
  updateUploadedFile,
} from "./db";
import { stripe, createStripeCustomer, createCheckoutSession, cancelSubscription } from "./stripe";
import { TRPCError } from "@trpc/server";
import { storagePut, storageGet, UPLOADS_DIR } from "./storage";
import fs from "fs";
import path from "path";
import { logUploadedFile } from "./db";

const COOKIE_NAME = "session";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function getFileFormat(fileName: string): string {
  const ext = fileName.split(".").pop()?.toUpperCase() || "";
  if (["CSV", "XLSX", "XLS", "JSON", "PDF"].includes(ext)) {
    return ext;
  }
  return "CSV";
}

function getContentType(fileName: string, mimeType?: string): string {
  if (mimeType) return mimeType;
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    csv: "text/csv", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel", json: "application/json", txt: "text/plain",
    tsv: "text/tab-separated-values", pdf: "application/pdf",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml",
  };
  return map[ext] || "application/octet-stream";
}

/** Detect if CSV content has numeric series suitable for charting */
function detectHasGraphs(content: string, fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext !== "csv" && ext !== "tsv" && ext !== "txt") return false;
  try {
    const lines = content.split("\n").filter(l => l.trim());
    if (lines.length < 3) return false;
    const sep = (lines[0].match(/\t/g) ?? []).length > (lines[0].match(/,/g) ?? []).length ? "\t" : ",";
    const headers = lines[0].split(sep);
    // Check how many columns are mostly numeric
    let numericCount = 0;
    for (let ci = 0; ci < headers.length; ci++) {
      const vals = lines.slice(1, Math.min(11, lines.length)).map(l => l.split(sep)[ci]?.trim()).filter(Boolean);
      const numRatio = vals.filter(v => !isNaN(parseFloat(v))).length / Math.max(vals.length, 1);
      if (numRatio >= 0.8) numericCount++;
    }
    return numericCount >= 2;
  } catch {
    return false;
  }
}

export const appRouter = router({
  system: systemRouter,
  job: jobRouter,
  regression: regressionRouter,
  ml: mlRouter,
  orchestration: orchestrationRouter,
  documentGeneration: documentGenerationRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  subscription: router({
    getStatus: protectedProcedure.query(async ({ ctx }) => {
      return getUserSubscriptionStatus(ctx.user.id);
    }),

    createCheckout: protectedProcedure
      .input(z.object({ returnUrl: z.string().url() }))
      .mutation(async ({ ctx, input }) => {
        let customerId = ctx.user.stripeCustomerId;

        if (!customerId) {
          const customer = await createStripeCustomer(
            ctx.user.email || "",
            ctx.user.name || undefined
          );
          customerId = customer.id;
          await updateUserSubscription(ctx.user.id, {
            stripeCustomerId: customerId,
          });
        }

        const priceId = process.env.STRIPE_PRICE_ID;
        if (!priceId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Stripe price not configured",
          });
        }

        const session = await createCheckoutSession(
          customerId,
          priceId,
          input.returnUrl
        );

        return { sessionId: session.id, url: session.url };
      }),

    useTrial: protectedProcedure.mutation(async ({ ctx }) => {
      const user = await getUserSubscriptionStatus(ctx.user.id);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (user.trialUsedCount >= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Trial already used",
        });
      }

      await incrementTrialUsage(ctx.user.id);
      await logSubscriptionEvent(ctx.user.id, "trial_used");

      return { success: true };
    }),

    cancel: protectedProcedure.mutation(async ({ ctx }) => {
      const user = await getUserSubscriptionStatus(ctx.user.id);

      if (!user?.stripeSubscriptionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active subscription",
        });
      }

      await cancelSubscription(user.stripeSubscriptionId);
      await logSubscriptionEvent(ctx.user.id, "subscription_canceled");

      return { success: true };
    }),
  }),

  analytics: router({
    getUsageStats: protectedProcedure.query(async ({ ctx }) => {
      return await getUserUploadedFiles(ctx.user.id);
    }),

    getStorageUsage: protectedProcedure.query(async ({ ctx }) => {
      return await getStorageUsage(ctx.user.id);
    }),

    logGeneration: protectedProcedure
      .input(z.object({
        generationType: z.string(),
        dataType: z.string().optional(),
        generationTime: z.number().optional(),
        success: z.boolean().optional(),
        errorMessage: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await logGeneration(ctx.user.id, {
          generationType: input.generationType,
          dataType: input.dataType,
          generationTime: input.generationTime,
          success: input.success !== false,
          errorMessage: input.errorMessage,
        });
        return { success: true };
      }),
  }),

  technical: router({
    saveReport: publicProcedure
      .input(z.object({
        title: z.string(),
        content: z.string(),
        chartImage: z.string().optional(),
        dataFiles: z.array(z.string()).optional(),
        measurements: z.array(z.string()).optional(),
        generatedAt: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user?.id || 1;
        await saveTechnicalFile(userId, {
          title: input.title,
          content: input.content,
          chartImage: input.chartImage,
          dataFiles: input.dataFiles,
          measurements: input.measurements ? JSON.stringify(input.measurements) : undefined,
        });
        return { success: true };
      }),

    getFiles: publicProcedure.query(async ({ ctx }) => {
      const userId = ctx.user?.id || 1;
      return await getTechnicalFiles(userId);
    }),

    getFile: publicProcedure
      .input(z.object({ fileId: z.number() }))
      .query(async ({ ctx, input }) => {
        const userId = ctx.user?.id || 1;
        return await getTechnicalFileById(input.fileId, userId);
      }),

    deleteFile: publicProcedure
      .input(z.object({ fileId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user?.id || 1;
        const success = await deleteTechnicalFile(input.fileId, userId);
        return { success };
      }),

    updateFile: publicProcedure
      .input(z.object({ fileId: z.number(), title: z.string().optional(), measurements: z.array(z.string()).optional() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user?.id || 1;
        const success = await updateTechnicalFile(input.fileId, userId, { title: input.title, measurements: input.measurements });
        return { success };
      }),

    createFolder: publicProcedure
      .input(z.object({ folderName: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user?.id || 1;
        await saveTechnicalFile(userId, {
          title: `${input.folderName} / .folder-placeholder`,
          content: '<!-- FOLDER_PLACEHOLDER -->',
          measurements: JSON.stringify(['foldertype:general']),
        });
        return { success: true };
      }),
  }),

  feedback: router({
    submitFeedback: protectedProcedure
      .input(z.object({
        feedbackType: z.enum(['bug', 'suggestion', 'feature_request', 'general']),
        category: z.string(),
        title: z.string(),
        description: z.string(),
        page: z.string().optional(),
        userEmail: z.string().email().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await submitFeedback(ctx.user.id, {
          title: input.title,
          message: input.description,
          category: input.category,
        });
        return { success: true };
      }),

    getUserFeedback: protectedProcedure.query(async ({ ctx }) => {
      return await getUserFeedback(ctx.user.id);
    }),

    getAllFeedback: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return await getAllFeedback();
    }),

    updateStatus: protectedProcedure
      .input(z.object({
        feedbackId: z.number(),
        status: z.enum(['new', 'acknowledged', 'in_progress', 'resolved', 'closed']),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const success = await updateFeedbackStatus(input.feedbackId, input.status);
        return { success };
      }),
  }),

  files: router({
    list: publicProcedure
      .input(z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().min(1).max(100).default(10),
      }))
      .query(async ({ ctx, input }) => {
        const userId = ctx.user?.id || 1;
        const offset = (input.page - 1) * input.limit;
        const files = await getUserUploadedFiles(userId);
        const paginatedFiles = files.slice(offset, offset + input.limit);
        const total = files.length;
        const totalPages = Math.ceil(total / input.limit);
        return {
          data: paginatedFiles.map((file: any) => ({
            id: file.id,
            name: file.fileName,
            fileName: file.fileName,
            uploadDate: file.uploadedAt?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
            size: formatFileSize(file.fileSizeBytes || 0),
            fileSizeBytes: file.fileSizeBytes || 0,
            format: getFileFormat(file.fileName),
            contentType: getContentType(file.fileName, file.mimeType),
            fileKey: file.fileKey,
            fileUrl: file.fileUrl,
            mimeType: file.mimeType,
            folderId: file.folderId,
            tags: file.tags ? JSON.parse(file.tags) : [],
            description: file.description,
          })),
          pagination: {
            page: input.page,
            limit: input.limit,
            total,
            totalPages,
            hasNextPage: input.page < totalPages,
            hasPreviousPage: input.page > 1,
          },
        };
      }),

    upload: publicProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(),
        mimeType: z.string(),
        fileSizeBytes: z.number(),
        folderId: z.string().optional(),
        tags: z.array(z.string()).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        console.log('User in upload procedure:', ctx.user || 'null');
        // TEMP: Use hardcoded userId for testing since no auth
        const userId = ctx.user?.id || 1;
        try {
          const buffer = Buffer.from(input.fileData, 'base64');
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const fileKey = `${userId}-files/${timestamp}-${randomSuffix}-${input.fileName}`;
          const { url } = await storagePut(fileKey, buffer, input.mimeType);
          await logUploadedFile(userId, {
            fileName: input.fileName,
            fileKey,
            fileUrl: url,
            mimeType: input.mimeType,
            fileSizeBytes: input.fileSizeBytes,
            folderId: input.folderId,
            tags: input.tags,
            description: input.description,
          });
          return {
            success: true,
            fileKey,
            fileUrl: url,
            message: `File ${input.fileName} uploaded successfully`,
          };
        } catch (error) {
          console.error('[Upload Error]', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }),

    download: protectedProcedure
      .input(z.object({
        fileKey: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        try {
          const { url } = await storageGet(input.fileKey);
          return { url, success: true };
        } catch (error) {
          console.error('[Download Error]', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to generate download URL',
          });
        }
      }),

    getFileContent: publicProcedure
      .input(z.object({
        fileId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const userId = ctx.user?.id || 1;
        let file: any;
        try {
          const files = await getUserUploadedFiles(userId);
          file = files.find((f: any) => f.id === input.fileId);
        } catch (error) {
          console.error('[Get File Content] DB lookup error:', { fileId: input.fileId, userId, error });
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database error looking up file' });
        }

        if (!file) {
          console.warn('[Get File Content] File not found:', { fileId: input.fileId, userId });
          throw new TRPCError({ code: 'NOT_FOUND', message: 'File not found' });
        }

        const contentType = getContentType(file.fileName, file.mimeType);
        const isBinary = contentType.startsWith("image/") || contentType === "application/pdf";

        // For binary files (images, PDFs), return URL only — no text content
        if (isBinary) {
          console.log('[Get File Content] Binary file, returning URL only:', { fileId: input.fileId, fileName: file.fileName, contentType });
          return {
            success: true,
            content: null,
            fileName: file.fileName,
            mimeType: file.mimeType,
            contentType,
            hasGraphs: false,
            fileUrl: file.fileUrl,
          };
        }

        // Text-based files: read content
        let content: string;
        try {
          const normalizedKey = file.fileKey.replace(/^\/+/, '');
          const fullPath = path.join(UPLOADS_DIR, normalizedKey);
          content = await fs.promises.readFile(fullPath, 'utf-8');
        } catch {
          try {
            const { url } = await storageGet(file.fileKey);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            content = await response.text();
          } catch (fetchErr) {
            console.error('[Get File Content] Failed to read file:', {
              fileId: input.fileId, fileName: file.fileName, userId,
              error: fetchErr instanceof Error ? fetchErr.message : 'Unknown',
            });
            return {
              success: false,
              content: null,
              fileName: file.fileName,
              mimeType: file.mimeType,
              contentType,
              hasGraphs: false,
              fileUrl: file.fileUrl,
              error: 'Content not available',
              reason: fetchErr instanceof Error ? fetchErr.message : 'Parse error',
            };
          }
        }

        const hasGraphs = detectHasGraphs(content, file.fileName);
        console.log('[Get File Content] Success:', { fileId: input.fileId, fileName: file.fileName, contentType, hasGraphs, contentLength: content.length });

        return {
          success: true,
          content,
          fileName: file.fileName,
          mimeType: file.mimeType,
          contentType,
          hasGraphs,
          fileUrl: file.fileUrl,
        };
      }),

    getFiles: protectedProcedure.query(async ({ ctx }) => {
      return await getUserUploadedFiles(ctx.user.id);
    }),

    getFileById: protectedProcedure
      .input(z.object({
        fileId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        try {
          const files = await getUserUploadedFiles(ctx.user.id);
          const file = files.find((f: any) => f.id === input.fileId);
          
          if (!file) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'File not found',
            });
          }
          
          return {
            id: file.id,
            name: file.fileName,
            fileName: file.fileName,
            uploadDate: file.uploadedAt?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
            size: formatFileSize(file.fileSizeBytes || 0),
            fileSizeBytes: file.fileSizeBytes || 0,
            format: getFileFormat(file.fileName),
            fileKey: file.fileKey,
            fileUrl: file.fileUrl,
            mimeType: file.mimeType,
            folderId: file.folderId,
            tags: file.tags ? JSON.parse(file.tags) : [],
            description: file.description,
          };
        } catch (error) {
          console.error('[Get File By ID Error]', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to fetch file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }),

    update: publicProcedure
      .input(z.object({
        fileId: z.number(),
        fileName: z.string().optional(),
        folderId: z.string().nullable().optional(),
        tags: z.array(z.string()).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user?.id || 1;
        const { fileId, ...data } = input;
        const success = await updateUploadedFile(fileId, userId, data);
        if (!success) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'File not found or update failed' });
        }
        return { success: true, message: 'File updated successfully' };
      }),

    bulkMove: publicProcedure
      .input(z.object({
        fileIds: z.array(z.number()),
        folderId: z.string().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user?.id || 1;
        const results = await Promise.all(
          input.fileIds.map(id => updateUploadedFile(id, userId, { folderId: input.folderId }))
        );
        const successCount = results.filter(Boolean).length;
        return { success: true, moved: successCount };
      }),

    delete: protectedProcedure
      .input(z.object({
        fileIds: z.array(z.number()),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const results = await Promise.all(
            input.fileIds.map(fileId => deleteUploadedFile(fileId, ctx.user.id))
          );
          const successCount = results.filter(r => r).length;
          return {
            success: true,
            deleted: successCount,
            message: `Successfully deleted ${successCount} file(s)`,
          };
        } catch (error) {
          console.error('[Delete Error]', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to delete files: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }),
  }),

  regulatory: router({
    // Project management
    createProject: protectedProcedure
      .input(
        z.object({
          projectName: z.string(),
          deviceName: z.string(),
          deviceType: z.string(),
          intendedUse: z.string().optional(),
          predicateDevices: z.array(z.any()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const { createRegulatoryProject } = await import("./regulatoryDb");
          const result = await createRegulatoryProject(
            ctx.user.id,
            input.projectName,
            input.deviceName,
            input.deviceType,
            input.intendedUse,
            input.predicateDevices
          );
          return { success: true, projectId: (result as any).insertId || 0 };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to create project: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),

    getProjects: protectedProcedure.query(async ({ ctx }) => {
      try {
        const { getUserRegulatoryProjects } = await import("./regulatoryDb");
        return await getUserRegulatoryProjects(ctx.user.id);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch projects: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

    getProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        try {
          const { getRegulatoryProject } = await import("./regulatoryDb");
          return await getRegulatoryProject(input.projectId, ctx.user.id);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to fetch project: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),

    // Document generation
    generateDocuments: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          documentTypes: z.array(z.string()),
          sourceDocuments: z.array(z.string()),
          deviceInfo: z.object({
            deviceName: z.string(),
            deviceType: z.string(),
            intendedUse: z.string(),
            predicateDevices: z.array(z.any()).optional(),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const { generateComplete510kSubmission } = await import("./regulatoryAI");
          const { createGeneratedDocument, addDocumentCitation, getProjectSourceDocuments } = await import("./regulatoryDb");

          // Generate documents using AI
          const result = await generateComplete510kSubmission(
            input.deviceInfo.deviceName,
            input.deviceInfo.deviceType,
            input.deviceInfo.intendedUse,
            input.deviceInfo.predicateDevices || [],
            input.sourceDocuments
          );

          // Save generated documents to database
          const savedDocs = [];
          for (const doc of result.documents) {
            const dbResult = await createGeneratedDocument(
              input.projectId,
              ctx.user.id,
              doc.type,
              doc.title,
              doc.content
            );
            savedDocs.push({
              id: (dbResult as any).insertId || 0,
              type: doc.type,
              title: doc.title,
              citations: doc.citations,
            });
          }

          return {
            success: true,
            documents: savedDocs,
            message: `Generated ${savedDocs.length} regulatory documents`,
          };
        } catch (error) {
          console.error("Document generation error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to generate documents: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),

    getGeneratedDocuments: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        try {
          const { getProjectGeneratedDocuments } = await import("./regulatoryDb");
          return await getProjectGeneratedDocuments(input.projectId, ctx.user.id);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to fetch documents: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),

    getDocument: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ ctx, input }) => {
        try {
          const { getGeneratedDocument, getDocumentCitations } = await import("./regulatoryDb");
          const doc = await getGeneratedDocument(input.documentId, ctx.user.id);
          if (!doc) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Document not found",
            });
          }
          const citations = await getDocumentCitations(input.documentId);
          return { ...doc, citations };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to fetch document: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),

    updateDocument: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
          content: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const { updateGeneratedDocument } = await import("./regulatoryDb");
          await updateGeneratedDocument(input.documentId, ctx.user.id, input.content);
          return { success: true, message: "Document updated" };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to update document: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),

    // Source document management
    addSourceDocument: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          sourceType: z.string(),
          documentName: z.string(),
          fileKey: z.string(),
          fileUrl: z.string(),
          mimeType: z.string(),
          fileSizeBytes: z.number(),
          extractedText: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const { addSourceDocument } = await import("./regulatoryDb");
          const result = await addSourceDocument(
            input.projectId,
            ctx.user.id,
            input.sourceType,
            input.documentName,
            input.fileKey,
            input.fileUrl,
            input.mimeType,
            input.fileSizeBytes,
            input.extractedText
          );
          return { success: true, sourceDocumentId: (result as any).insertId || 0 };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to add source document: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),

    getSourceDocuments: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        try {
          const { getProjectSourceDocuments } = await import("./regulatoryDb");
          return await getProjectSourceDocuments(input.projectId, ctx.user.id);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to fetch source documents: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),

    // Project content/settings update
    updateProject: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          projectName: z.string().optional(),
          content: z.string().optional(),
          referenceFormat: z.string().optional(),
          paperLayout: z.string().optional(),
          regulatoryStandard: z.string().optional(),
          sourceFileIds: z.string().optional(), // JSON-encoded number[]
          templateId: z.number().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const { updateRegulatoryProject } = await import("./regulatoryDb");
          const { projectId, ...data } = input;
          await updateRegulatoryProject(projectId, ctx.user.id, data);
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to update project: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),

    // Template upload — saves metadata; actual file bytes go via files.uploadFile
    uploadTemplate: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          fileKey: z.string(),
          fileUrl: z.string(),
          mimeType: z.string(),
          fileSizeBytes: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const { createTemplate } = await import("./regulatoryDb");
          await createTemplate(ctx.user.id, input);
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to save template: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),

    getTemplates: protectedProcedure.query(async ({ ctx }) => {
      try {
        const { getUserTemplates } = await import("./regulatoryDb");
        return await getUserTemplates(ctx.user.id);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch templates: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

    deleteTemplate: protectedProcedure
      .input(z.object({ templateId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const { deleteTemplate } = await import("./regulatoryDb");
          await deleteTemplate(input.templateId, ctx.user.id);
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to delete template: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),

    // File linking (many-to-many with uploadedFiles)
    linkFile: protectedProcedure
      .input(z.object({ projectId: z.number(), fileId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const { linkFileToProject } = await import("./regulatoryDb");
          await linkFileToProject(input.projectId, input.fileId);
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to link file: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),

    unlinkFile: protectedProcedure
      .input(z.object({ projectId: z.number(), fileId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const { unlinkFileFromProject } = await import("./regulatoryDb");
          await unlinkFileFromProject(input.projectId, input.fileId);
          return { success: true };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to unlink file: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),

    getProjectFiles: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        try {
          const { getProjectFiles } = await import("./regulatoryDb");
          return await getProjectFiles(input.projectId, ctx.user.id);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to fetch project files: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),

    // AI document generation from uploaded sources
    generateRegulatoryDoc: publicProcedure
      .input(
        z.object({
          message: z.string(),
          documentType: z.string().optional(),
          attachedFileNames: z.array(z.string()).default([]),
          sourceExcerpts: z.array(z.object({
            name: z.string(),
            type: z.string(),
            excerpt: z.string(),
          })).default([]),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const { invokeLLM } = await import("./_core/llm");

          // Build rich source context with actual excerpts
          let fileContext = "";
          if (input.sourceExcerpts.length > 0) {
            fileContext = "\n\n=== SOURCE DOCUMENTS ===\n" +
              input.sourceExcerpts.map((s, i) =>
                `Source ${i + 1}: ${s.name} (${s.type})\n${s.excerpt}`
              ).join("\n\n");
          } else if (input.attachedFileNames.length > 0) {
            fileContext = `\n\nAvailable source documents: ${input.attachedFileNames.join(", ")}`;
          }

          const jsonSchema = `
You MUST respond with ONLY valid JSON (no markdown fences, no extra text). The JSON object must have these exact keys:
{
  "content": "Full regulatory document as plain text. Use \\n for paragraph breaks. No HTML or markdown.",
  "annotations": [
    {
      "sentenceIndex": 0,
      "text": "The exact sentence text being annotated",
      "sourceName": "FileName.ext",
      "color": "yellow"
    }
  ],
  "usedFileNames": ["FileName1.ext", "FileName2.ext"],
  "references": [
    {
      "sourceName": "FileName.ext",
      "sourceType": "CSV",
      "excerpt": "Key excerpt from this source (50-150 words)",
      "annotation": "Tooltip explaining how this source supports the document",
      "citationKey": "ClinicalTrial:Table3",
      "color": "yellow"
    }
  ]
}

Rules for annotations:
- sentenceIndex is the 0-based index of the sentence when content is split by sentence boundaries
- color cycles per source: yellow for 1st source, blue for 2nd, green for 3rd, purple for 4th, orange for 5th
- Include at least 6-10 annotations spread across the document

Rules for references:
- One entry per source document used
- citationKey format: "ShortName:Section" (e.g. "ClinicalTrial:Table3")
- color must match the same source's annotation color`;

          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are an expert regulatory document writer for medical devices and pharmaceuticals. Generate professional, complete regulatory documents that fully comply with FDA 21 CFR and EU MDR/IVDR standards. Write in formal regulatory language with numbered sections and clear headings.\n\n${jsonSchema}`,
              },
              {
                role: "user",
                content: `${input.message}${fileContext}\nDocument type: ${input.documentType || "General Regulatory Document"}\n\nGenerate a complete, detailed regulatory document (at least 8-10 paragraphs with numbered sections). Insert inline citations in the format [SourceName:Section] throughout the document text where claims are sourced. For each key sentence or claim derived from a source document, include an annotation entry. Also produce a references array listing each source used with an excerpt and annotation tooltip. Remember: respond with ONLY valid JSON matching the schema above.`,
              },
            ],
            maxTokens: 16000,
          });

          const raw = result.choices[0]?.message?.content;
          if (!raw) throw new Error("Empty LLM response");

          const jsonStr =
            typeof raw === "string"
              ? raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim()
              : JSON.stringify(raw);

          const parsed = JSON.parse(jsonStr);

          return {
            content: (parsed.content as string) || "",
            annotations: ((parsed.annotations as any[]) || []).map(
              (ann: any, idx: number) => ({
                id: `ann-${Date.now()}-${idx}`,
                sentenceIndex: Number(ann.sentenceIndex ?? idx),
                text: String(ann.text ?? ""),
                sourceName: String(ann.sourceName ?? "Unknown Source"),
                color: String(ann.color ?? "yellow"),
              })
            ),
            usedFileNames: (parsed.usedFileNames as string[]) || [],
            references: ((parsed.references as any[]) || []).map(
              (ref: any, idx: number) => ({
                id: `ref-${Date.now()}-${idx}`,
                sourceName: String(ref.sourceName ?? "Unknown"),
                sourceType: String(ref.sourceType ?? "FILE"),
                excerpt: String(ref.excerpt ?? ""),
                annotation: String(ref.annotation ?? ""),
                citationKey: String(ref.citationKey ?? `Source${idx + 1}`),
                color: String(ref.color ?? "yellow"),
              })
            ),
          };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to generate document: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          });
        }
      }),
  }),

  biostatistics: router({
    analyzeBiostatisticsData: publicProcedure
      .input(
        z.object({
          userQuery: z.string(),
          dataPreview: z.string(),
          dataColumns: z.array(z.string()),
          classifications: z.record(z.string(), z.any()),
          conversationHistory: z.array(
            z.object({
              role: z.string(),
              content: z.string(),
            })
          ),
          fullData: z.array(z.record(z.string(), z.any())).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const { analyzeBiostatistics } = await import("./biostatisticsAI");
          const result = await analyzeBiostatistics(
            input.userQuery,
            input.dataPreview,
            input.dataColumns,
            input.classifications,
            input.conversationHistory,
            input.fullData
          );
          return result;
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Biostatistics analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),

    parseDataFile: publicProcedure
      .input(
        z.object({
          fileContent: z.string(),
          fileName: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const { parseDataFile } = await import("./biostatisticsAI");
          const result = await parseDataFile(
            Buffer.from(input.fileContent, "base64"),
            input.fileName
          );
          return result;
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Data parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }),


  }),
});
export type AppRouter = typeof appRouter;
