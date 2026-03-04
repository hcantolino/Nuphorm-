"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, FileText, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface FilePreviewFile {
  /** Display name */
  name: string;
  /** Raw string content of the file */
  content: string;
  /** File type — determines how content is rendered */
  type: "txt" | "csv" | null;
  /** Optional size string shown in footer (e.g. "24 KB") */
  size?: string;
  /** Optional upload date string (e.g. "2026-01-15") */
  uploadedDate?: string;
}

export interface FilePreviewModalProps {
  /** The file to preview. Pass `null` to hide the modal. */
  file: FilePreviewFile | null;
  /** Called when the modal should close */
  onClose: () => void;
}

// ── Mock data for testing ────────────────────────────────────────────────────

const FAKE_PK_RAW_DATA = `Subject	Time_hr	Conc_ng_mL	Dose_mg	Period	Formulation
101	0.00	0.00	100	1	Test
101	0.25	12.34	100	1	Test
101	0.50	45.67	100	1	Test
101	1.00	98.23	100	1	Test
101	2.00	134.56	100	1	Test
101	4.00	112.89	100	1	Test
101	6.00	78.45	100	1	Test
101	8.00	56.12	100	1	Test
101	12.00	34.78	100	1	Test
101	24.00	12.34	100	1	Test
102	0.00	0.00	100	1	Reference
102	0.25	8.91	100	1	Reference
102	0.50	34.56	100	1	Reference
102	1.00	87.65	100	1	Reference
102	2.00	123.45	100	1	Reference
102	4.00	98.76	100	1	Reference
102	6.00	67.89	100	1	Reference
102	8.00	45.23	100	1	Reference
102	12.00	23.45	100	1	Reference
102	24.00	8.91	100	1	Reference
103	0.00	0.00	200	2	Test
103	0.25	24.68	200	2	Test
103	0.50	91.34	200	2	Test
103	1.00	196.46	200	2	Test
103	2.00	269.12	200	2	Test
103	4.00	225.78	200	2	Test
103	6.00	156.90	200	2	Test
103	8.00	112.24	200	2	Test
103	12.00	69.56	200	2	Test
103	24.00	24.68	200	2	Test`;

const FAKE_CSV_DATA = `PatientID,Age,Sex,TumorStage,Treatment,BaselineTumorSize_mm,Week12TumorSize_mm,ResponseCategory,OS_months,PFS_months,AE_Grade3Plus,ECOG_Score
ONC-001,58,M,IIIA,Pembrolizumab+Chemo,42.3,28.1,Partial Response,18.4,12.1,Yes,1
ONC-002,64,F,IIIB,Pembrolizumab+Chemo,38.7,41.2,Progressive Disease,8.2,4.3,No,0
ONC-003,51,M,IV,Nivolumab,55.1,32.4,Partial Response,22.6,15.8,Yes,1
ONC-004,72,F,IIIA,Pembrolizumab+Chemo,29.8,0.0,Complete Response,36.0,30.2,No,0
ONC-005,45,M,IV,Atezolizumab,61.5,58.9,Stable Disease,14.7,9.5,Yes,2
ONC-006,67,F,IIIB,Nivolumab,33.2,35.8,Progressive Disease,6.1,3.2,Yes,1
ONC-007,53,M,IV,Pembrolizumab+Chemo,48.9,12.3,Partial Response,28.3,20.1,No,0
ONC-008,69,F,IIIA,Atezolizumab,25.6,0.0,Complete Response,42.1,38.7,No,0
ONC-009,41,M,IIIB,Pembrolizumab+Chemo,57.8,52.1,Stable Disease,16.9,11.4,Yes,1
ONC-010,76,F,IV,Nivolumab,44.2,48.7,Progressive Disease,7.8,3.9,No,2
ONC-011,59,M,IIIA,Pembrolizumab+Chemo,36.1,18.5,Partial Response,24.5,17.3,Yes,1
ONC-012,63,F,IV,Atezolizumab,50.4,0.0,Complete Response,39.8,34.6,No,0
ONC-013,48,M,IIIB,Nivolumab,41.7,39.2,Stable Disease,15.3,10.8,No,1
ONC-014,71,F,IIIA,Pembrolizumab+Chemo,28.3,30.9,Progressive Disease,9.4,5.1,Yes,2
ONC-015,55,M,IV,Pembrolizumab+Chemo,63.2,34.7,Partial Response,26.1,18.9,No,0`;

/**
 * Lookup map: filename → mock content.
 * Used when no `content` string is provided in the file prop.
 */
export const MOCK_FILE_CONTENTS: Record<string, { content: string; type: "txt" | "csv" }> = {
  "fakepkrawdata.txt": { content: FAKE_PK_RAW_DATA, type: "txt" },
  "fäkepkrawdata.txt": { content: FAKE_PK_RAW_DATA, type: "txt" },
  "raw_oncology_trial_data.csv": { content: FAKE_CSV_DATA, type: "csv" },
};

// ── CSV parser ───────────────────────────────────────────────────────────────

function parseCSV(raw: string): { headers: string[]; rows: string[][] } {
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  // Auto-detect delimiter
  const firstLine = lines[0];
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const sep = tabCount > commaCount ? "\t" : ",";

  const headers = firstLine.split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) =>
    line.split(sep).map((cell) => cell.trim().replace(/^"|"$/g, ""))
  );
  return { headers, rows };
}

// ── Pagination ───────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 15;

// ── Component ────────────────────────────────────────────────────────────────

export default function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const [currentPage, setCurrentPage] = useState(0);

  // Reset page when file changes
  useEffect(() => {
    setCurrentPage(0);
  }, [file?.name]);

  // Close on Escape
  useEffect(() => {
    if (!file) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [file, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (!file) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [file]);

  // Resolve content — use provided content or fall back to mock
  const resolvedContent = useMemo(() => {
    if (!file) return null;
    if (file.content) return file.content;
    const key = file.name.toLowerCase();
    const mock = MOCK_FILE_CONTENTS[key];
    return mock?.content ?? null;
  }, [file]);

  const resolvedType = useMemo(() => {
    if (!file) return null;
    if (file.type) return file.type;
    const key = file.name.toLowerCase();
    const mock = MOCK_FILE_CONTENTS[key];
    if (mock) return mock.type;
    // Infer from extension
    if (file.name.endsWith(".csv")) return "csv";
    if (file.name.endsWith(".txt") || file.name.endsWith(".tsv")) return "txt";
    return "txt";
  }, [file]);

  // Parsed CSV
  const csvData = useMemo(() => {
    if (resolvedType !== "csv" || !resolvedContent) return null;
    return parseCSV(resolvedContent);
  }, [resolvedType, resolvedContent]);

  const totalPages = csvData ? Math.ceil(csvData.rows.length / ROWS_PER_PAGE) : 0;
  const paginatedRows = csvData
    ? csvData.rows.slice(currentPage * ROWS_PER_PAGE, (currentPage + 1) * ROWS_PER_PAGE)
    : [];

  const handleDownload = useCallback(() => {
    if (!file || !resolvedContent) return;
    const blob = new Blob([resolvedContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [file, resolvedContent]);

  // ── Render via Portal ────────────────────────────────────────────────────

  return createPortal(
    <AnimatePresence>
      {file && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9998]"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal card */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto flex flex-col bg-white rounded-xl shadow-2xl w-full max-w-[90vw] md:max-w-[88vw] max-h-[92vh] overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-label={`Preview: ${file.name}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Header ─────────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {resolvedType === "csv" ? (
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  )}
                  <h2 className="text-lg font-semibold text-[#1a1f36] truncate">
                    {file.name}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="ml-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* ── Content ────────────────────────────────────────────── */}
              <div className="flex-1 overflow-auto">
                {!resolvedContent ? (
                  <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
                    No content available for this file.
                  </div>
                ) : resolvedType === "csv" && csvData ? (
                  /* ── CSV Table ─────────────────────────────────────── */
                  <div className="p-4">
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-blue-50 border-b border-gray-200 sticky top-0 z-10">
                            {csvData.headers.map((h, i) => (
                              <th
                                key={i}
                                className="px-4 py-2.5 text-left font-semibold text-[#2d3748] whitespace-nowrap text-xs uppercase tracking-wide"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedRows.map((row, ri) => (
                            <tr
                              key={ri}
                              className={
                                ri % 2 === 0
                                  ? "bg-white hover:bg-gray-50 transition-colors"
                                  : "bg-[#f9fafb] hover:bg-gray-100 transition-colors"
                              }
                            >
                              {row.map((cell, ci) => (
                                <td
                                  key={ci}
                                  className="px-4 py-2 text-[#2d3748] whitespace-nowrap border-b border-[#e5e7eb]"
                                >
                                  {cell || "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                        <span>
                          Showing {currentPage * ROWS_PER_PAGE + 1}–
                          {Math.min((currentPage + 1) * ROWS_PER_PAGE, csvData.rows.length)} of{" "}
                          {csvData.rows.length} rows
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                            disabled={currentPage === 0}
                            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="px-2 py-1 text-xs font-medium text-gray-600">
                            Page {currentPage + 1} of {totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                            disabled={currentPage === totalPages - 1}
                            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Plain text ────────────────────────────────────── */
                  <div className="p-4">
                    <pre
                      className="bg-gray-50 p-4 rounded-lg text-sm leading-relaxed text-[#2d3748] overflow-x-auto"
                      style={{
                        fontFamily: "'Consolas', 'Monaco', 'Menlo', monospace",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                      }}
                    >
                      {resolvedContent}
                    </pre>
                  </div>
                )}
              </div>

              {/* ── Footer ─────────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-[#fafafa] flex-shrink-0 text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  {file.size && <span>File size: {file.size}</span>}
                  {file.uploadedDate && <span>Uploaded: {file.uploadedDate}</span>}
                  {resolvedType === "csv" && csvData && (
                    <span>
                      {csvData.rows.length} rows &times; {csvData.headers.length} columns
                    </span>
                  )}
                </div>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#3b82f6] text-[#3b82f6] hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
