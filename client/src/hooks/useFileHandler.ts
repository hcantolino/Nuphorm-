/**
 * useFileHandler — Universal file upload handler.
 *
 * EVERY component that accepts file uploads MUST use this hook instead of
 * directly reading files. This ensures:
 *   1. Binary files (xlsx, xls, pdf, docx) NEVER get read as text
 *   2. All files go through the centralized router (fileUploadRouter.ts)
 *   3. Server-side parsing is used for binary formats
 *   4. Errors are handled consistently
 *
 * DO NOT:
 * - Call file.text() directly on user uploads
 * - Use new FileReader() for parsing user uploads
 * - Use Papa.parse() directly on user uploads
 * - Use XLSX.read() directly on user uploads
 *
 * This hook handles:
 * - CSV/TSV/TXT: client-side Papa.parse (with binary guard)
 * - XLSX/XLS: server-side Python pandas parser
 * - PDF: server-side text extraction
 * - JSON: client-side JSON.parse (with binary guard)
 * - Magic byte validation (catches mislabeled files)
 * - File size limits (50MB max)
 * - Error handling and toast notifications
 *
 * Usage:
 *   const { handleFile, handleFiles } = useFileHandler();
 *   const result = await handleFile(file);
 *   if (result.success) { setFullData(result.rows); }
 *
 * Last audit: 2026-04-23
 * Components verified: AIBiostatisticsChatTabIntegrated,
 *   ProjectContextPanel, DataUploadAI, BiostatisticsChat,
 *   BiostatisticsCompute, UploadSection, DataManagementPanel,
 *   AIBiostatisticsChat, useDataUpload
 */

import { useCallback } from 'react';
import { routeFileUpload, type ParsedFile } from '@/utils/fileUploadRouter';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const BINARY_EXTENSIONS = new Set([
  'xlsx', 'xls', 'pdf', 'docx', 'doc', 'pptx',
  'zip', 'gz', 'tar', 'rar', '7z', 'exe', 'bin',
]);

export function useFileHandler() {
  const parseXlsxMutation = trpc.files.parseXlsx.useMutation();
  const parsePdfMutation = trpc.files.parsePdf.useMutation();

  const handleFile = useCallback(
    async (file: File): Promise<ParsedFile> => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);

      console.log(`[FileHandler] Processing: ${file.name} (${ext}, ${sizeMB}MB)`);

      if (BINARY_EXTENSIONS.has(ext)) {
        console.log(`[FileHandler] Binary format (${ext}) — server parser required`);
      }

      try {
        const result = await routeFileUpload(file, {
          parseXlsx: async (b64: string, fname: string) => {
            console.log('[FileHandler] Calling server xlsx parser for', fname);
            const r = await parseXlsxMutation.mutateAsync({
              fileData: b64,
              fileName: fname,
            });
            console.log('[FileHandler] Server xlsx result:', r?.rows?.length, 'rows');
            return r;
          },
          parsePdf: async (b64: string, fname: string) => {
            console.log('[FileHandler] Calling server PDF parser for', fname);
            const r = await parsePdfMutation.mutateAsync({
              fileData: b64,
              fileName: fname,
            });
            return r;
          },
        });

        if (!result.success) {
          console.error('[FileHandler] Parse failed:', result.error);
          toast.error(result.error || `Could not parse ${file.name}`);
        } else {
          console.log(
            `[FileHandler] Success: ${result.rowCount} rows, ${result.columns.length} cols (${result.sourceType})`,
          );
        }

        return result;
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.error('[FileHandler] Unexpected error:', msg);
        toast.error(`Parse failed for ${file.name}: ${msg}`);
        return {
          success: false,
          rows: [],
          columns: [],
          rowCount: 0,
          sourceType: 'unknown',
          error: msg,
        };
      }
    },
    [parseXlsxMutation, parsePdfMutation],
  );

  const handleFiles = useCallback(
    async (files: File[]): Promise<ParsedFile[]> => {
      return Promise.all(files.map((f) => handleFile(f)));
    },
    [handleFile],
  );

  return { handleFile, handleFiles };
}
