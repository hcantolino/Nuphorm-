import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";

/**
 * Enhanced document generation router for regulatory documents
 * Integrates with BottomChatBar chat interface
 */

interface DocumentSection {
  id: string;
  heading: string;
  content: string;
  citations: Array<{
    id: string;
    text: string;
    sourceId: string;
    pageNumber?: number;
  }>;
}

interface GeneratedDocument {
  id: string;
  title: string;
  documentType: string;
  sections: DocumentSection[];
  citations: Array<{
    id: string;
    text: string;
    sourceId: string;
    pageNumber?: number;
  }>;
  generatedAt: Date;
  sourceAttributions: Map<string, string[]>; // sourceId -> snippets used
}

interface SourceSnippet {
  id: string;
  text: string;
  sourceId: string;
  pageNumber?: number;
}

/**
 * Extract citations from generated content
 * Maps sentences back to source snippets
 */
function extractCitationsFromContent(
  content: string,
  sourceSnippets: SourceSnippet[]
): Array<{
  id: string;
  text: string;
  sourceId: string;
  pageNumber?: number;
}> {
  const citations: Array<{
    id: string;
    text: string;
    sourceId: string;
    pageNumber?: number;
  }> = [];
  const citationId = new Map<string, string>();
  let idCounter = 0;

  // Split content into sentences
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [];

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (trimmedSentence.length < 10) continue;

    // Find matching source snippets (simple similarity matching)
    for (const snippet of sourceSnippets) {
      const snippetWords = snippet.text.toLowerCase().split(/\s+/);
      const sentenceWords = trimmedSentence.toLowerCase().split(/\s+/);

      // Calculate word overlap
      const overlap = snippetWords.filter((word) =>
        sentenceWords.some((sw) => sw.includes(word) || word.includes(sw))
      ).length;

      const overlapRatio = overlap / Math.max(snippetWords.length, sentenceWords.length);

      // If overlap > 40%, consider it a citation
      if (overlapRatio > 0.4) {
        const cid = `c${idCounter++}`;
        citations.push({
          id: cid,
          text: trimmedSentence,
          sourceId: snippet.sourceId,
          pageNumber: snippet.pageNumber,
        });
        citationId.set(trimmedSentence, cid);
        break;
      }
    }
  }

  return citations;
}

/**
 * Generate regulatory document with source attribution
 */
async function generateDocumentWithSources(
  documentType: string,
  deviceInfo: {
    deviceName: string;
    deviceType: string;
    intendedUse: string;
    predicateDevices?: any[];
  },
  sourceSnippets: SourceSnippet[],
  repositoryOnly: boolean
): Promise<GeneratedDocument> {
  const sourceText = sourceSnippets
    .map(
      (s, i) =>
        `Source ${i + 1} (ID: ${s.sourceId}${s.pageNumber ? `, Page ${s.pageNumber}` : ""}):\n${s.text}`
    )
    .join("\n\n");

  const systemPrompt = `You are an expert regulatory affairs specialist for FDA medical device submissions. Generate accurate, compliant regulatory documents based ONLY on provided source materials. 

CRITICAL RULES:
1. Every sentence must be grounded in the source materials
2. Do not hallucinate or add information not in sources
3. Use clear, professional regulatory language
4. Structure with clear sections and subsections
5. ${repositoryOnly ? "Use ONLY the provided sources - no external references" : "May reference FDA guidance and standards"}

Generate the document in a structured format with clear sections.`;

  const userPrompt = `Generate a ${documentType} regulatory document for:

Device Name: ${deviceInfo.deviceName}
Device Type: ${deviceInfo.deviceType}
Intended Use: ${deviceInfo.intendedUse}
${deviceInfo.predicateDevices?.length ? `Predicate Devices: ${JSON.stringify(deviceInfo.predicateDevices)}` : ""}

Source Materials (use these as your only reference):
${sourceText}

Generate a professional regulatory document with multiple sections. Structure it with clear headings and subsections. Ensure every statement is traceable to the source materials provided.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content =
      typeof response.choices[0].message.content === "string"
        ? response.choices[0].message.content
        : "";

    // Extract citations from generated content
    const citations = extractCitationsFromContent(content, sourceSnippets);

    // Parse sections from content (simple regex-based parsing)
    const sectionRegex = /^#+\s+(.+?)$/gm;
    const sections: DocumentSection[] = [];
    let lastIndex = 0;
    let match;

    while ((match = sectionRegex.exec(content)) !== null) {
      const heading = match[1];
      const startIndex = match.index + match[0].length;
      const nextMatch = sectionRegex.exec(content);
      const endIndex = nextMatch ? nextMatch.index : content.length;

      const sectionContent = content.substring(startIndex, endIndex).trim();
      const sectionCitations = citations.filter((c) =>
        sectionContent.includes(c.text)
      );

      sections.push({
        id: `sec${sections.length + 1}`,
        heading,
        content: sectionContent,
        citations: sectionCitations,
      });

      lastIndex = endIndex;
    }

    // If no sections found, create a default one
    if (sections.length === 0) {
      sections.push({
        id: "sec1",
        heading: "Document Content",
        content,
        citations,
      });
    }

    // Build source attributions map
    const sourceAttributions = new Map<string, string[]>();
    for (const citation of citations) {
      if (!sourceAttributions.has(citation.sourceId)) {
        sourceAttributions.set(citation.sourceId, []);
      }
      sourceAttributions.get(citation.sourceId)!.push(citation.text);
    }

    return {
      id: `doc${Date.now()}`,
      title: `${documentType} - ${deviceInfo.deviceName}`,
      documentType,
      sections,
      citations,
      generatedAt: new Date(),
      sourceAttributions,
    };
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to generate document: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

export const documentGenerationRouter = router({
  /**
   * Generate a single regulatory document from chat input
   * Used by BottomChatBar
   */
  generateFromChat: protectedProcedure
    .input(
      z.object({
        documentType: z.string(),
        projectId: z.number().optional(),
        deviceInfo: z.object({
          deviceName: z.string(),
          deviceType: z.string(),
          intendedUse: z.string(),
          predicateDevices: z.array(z.any()).optional(),
        }),
        sourceSnippets: z.array(
          z.object({
            id: z.string(),
            text: z.string(),
            sourceId: z.string(),
            pageNumber: z.number().optional(),
          })
        ),
        repositoryOnly: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const document = await generateDocumentWithSources(
          input.documentType,
          input.deviceInfo,
          input.sourceSnippets,
          input.repositoryOnly
        );

        // TODO: Save to database if projectId provided
        // const { createGeneratedDocument } = await import("../regulatoryDb");
        // if (input.projectId) {
        //   await createGeneratedDocument(
        //     input.projectId,
        //     ctx.user.id,
        //     document.documentType,
        //     document.title,
        //     JSON.stringify(document)
        //   );
        // }

        return {
          success: true,
          document,
          message: "Document generated successfully",
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to generate document: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Generate multiple document types in batch
   */
  generateBatch: protectedProcedure
    .input(
      z.object({
        projectId: z.number().optional(),
        documentTypes: z.array(z.string()),
        deviceInfo: z.object({
          deviceName: z.string(),
          deviceType: z.string(),
          intendedUse: z.string(),
          predicateDevices: z.array(z.any()).optional(),
        }),
        sourceSnippets: z.array(
          z.object({
            id: z.string(),
            text: z.string(),
            sourceId: z.string(),
            pageNumber: z.number().optional(),
          })
        ),
        repositoryOnly: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const documents = await Promise.all(
          input.documentTypes.map((docType) =>
            generateDocumentWithSources(
              docType,
              input.deviceInfo,
              input.sourceSnippets,
              input.repositoryOnly
            )
          )
        );

        return {
          success: true,
          documents,
          message: `Generated ${documents.length} documents successfully`,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to generate documents: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Regenerate document with modified parameters
   */
  regenerate: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        deviceInfo: z.object({
          deviceName: z.string(),
          deviceType: z.string(),
          intendedUse: z.string(),
          predicateDevices: z.array(z.any()).optional(),
        }),
        sourceSnippets: z.array(
          z.object({
            id: z.string(),
            text: z.string(),
            sourceId: z.string(),
            pageNumber: z.number().optional(),
          })
        ),
        repositoryOnly: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Extract document type from documentId or use default
        const documentType = "510(k)"; // TODO: Extract from stored document

        const document = await generateDocumentWithSources(
          documentType,
          input.deviceInfo,
          input.sourceSnippets,
          input.repositoryOnly
        );

        return {
          success: true,
          document,
          message: "Document regenerated successfully",
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to regenerate document: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),
});
