"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Download, FileText, FileSpreadsheet, ChevronLeft, ChevronRight, Search,
  AlertCircle, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown, BarChart3, Table2,
  Image as ImageIcon, FileType,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

export type FileContentType = "txt" | "csv" | "pdf" | "image" | "xlsx" | null;

export interface FilePreviewFile {
  /** Display name */
  name: string;
  /** Raw string content of the file */
  content: string;
  /** File type — determines how content is rendered */
  type: FileContentType;
  /** Optional size string shown in footer (e.g. "24 KB") */
  size?: string;
  /** Optional upload date string (e.g. "2026-01-15") */
  uploadedDate?: string;
  /** Error message from backend if content failed to load */
  error?: string;
  /** URL for image or PDF files */
  fileUrl?: string;
  /** Whether the backend flagged this as having chart-worthy data */
  hasGraphs?: boolean;
}

export interface FilePreviewModalProps {
  /** The file to preview. Pass `null` to hide the modal. */
  file: FilePreviewFile | null;
  /** Called when the modal should close */
  onClose: () => void;
}

// ── Chart colors (Finbox blue palette) ──────────────────────────────────────

const CHART_COLORS = [
  "#007BFF", "#66B2FF", "#0056b3", "#339CFF", "#004085",
  "#80BFFF", "#1A8CFF", "#4DA6FF", "#0069D9", "#B3D9FF",
];

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

const FAKE_TRIAL_DATA = `PatientID,Age,Sex,Treatment,Arm,Visit,SBP_mmHg,DBP_mmHg,HeartRate,Weight_kg,BMI,HbA1c,LDL_mg_dL,eGFR,AE_Reported,AE_Severity,ResponseCategory,TumorSize_mm,DaysOnTreatment,Completed
PT-001,54,M,DrugA,Active,Baseline,142,88,76,82.3,27.1,7.2,145,89,No,,Enrolled,32.1,0,Yes
PT-002,61,F,Placebo,Control,Baseline,138,84,72,67.8,25.4,6.9,132,95,No,,Enrolled,28.4,0,Yes
PT-003,47,M,DrugA,Active,Week4,136,82,74,81.5,26.8,6.8,128,91,Yes,Mild,Stable Disease,31.8,28,Yes
PT-004,58,F,DrugA,Active,Week4,130,78,70,69.2,26.0,6.5,118,88,No,,Partial Response,24.2,28,Yes
PT-005,65,M,Placebo,Control,Week4,140,86,75,83.1,27.4,7.1,142,86,Yes,Moderate,Progressive Disease,35.6,28,Yes
PT-006,52,F,DrugA,Active,Week12,124,76,68,68.4,25.7,6.1,108,92,No,,Partial Response,18.7,84,Yes
PT-007,69,M,Placebo,Control,Week12,139,85,74,84.0,27.7,7.3,148,82,Yes,Mild,Stable Disease,29.1,84,Yes
PT-008,44,F,DrugA,Active,Week12,122,74,66,66.9,25.1,5.8,98,96,No,,Complete Response,0.0,84,Yes
PT-009,57,M,DrugA,Active,Week24,120,72,65,80.2,26.4,5.6,92,93,No,,Complete Response,0.0,168,Yes
PT-010,63,F,Placebo,Control,Week24,141,87,76,68.5,25.7,7.4,150,80,Yes,Severe,Progressive Disease,42.3,168,No`;

const FAKE_SAFETY_DATA = `EventID,PatientID,Age,Sex,Treatment,AE_Term,SOC,AE_Severity,AE_Serious,Onset_Day,Resolution_Day,Outcome,Causality,Action_Taken
AE-001,PT-001,54,M,DrugA,Headache,Nervous system disorders,Mild,No,3,5,Resolved,Possible,None
AE-002,PT-003,47,M,DrugA,Nausea,Gastrointestinal disorders,Mild,No,7,10,Resolved,Probable,None
AE-003,PT-005,65,M,Placebo,Dizziness,Nervous system disorders,Moderate,No,14,21,Resolved,Unlikely,Dose reduced
AE-004,PT-007,69,M,Placebo,Fatigue,General disorders,Mild,No,5,12,Resolved,Unlikely,None
AE-005,PT-010,63,F,Placebo,Hepatic enzyme increased,Hepatobiliary disorders,Severe,Yes,42,89,Resolved,Unlikely,Drug withdrawn
AE-006,PT-006,52,F,DrugA,Rash,Skin disorders,Mild,No,21,28,Resolved,Probable,None
AE-007,PT-004,58,F,DrugA,Arthralgia,Musculoskeletal disorders,Moderate,No,35,56,Resolved,Possible,Dose reduced
AE-008,PT-009,57,M,DrugA,Diarrhea,Gastrointestinal disorders,Mild,No,10,14,Resolved,Probable,None
AE-009,PT-008,44,F,DrugA,Injection site reaction,General disorders,Mild,No,1,3,Resolved,Definite,None
AE-010,PT-002,61,F,Placebo,Back pain,Musculoskeletal disorders,Mild,No,28,42,Resolved,Unrelated,None`;

const FAKE_BIOMARKER_DATA = `SampleID,PatientID,Timepoint,CRP_mg_L,IL6_pg_mL,TNFa_pg_mL,CD4_cells_uL,CD8_cells_uL,PDL1_TPS_pct,Ki67_pct,ctDNA_VAF_pct,Albumin_g_dL,Hemoglobin_g_dL,WBC_10e9_L,Platelets_10e9_L
BM-001,PT-001,Baseline,8.2,12.4,6.8,680,320,45,32,2.1,3.8,13.2,7.4,245
BM-002,PT-001,Week4,5.1,8.9,4.2,720,380,38,24,1.2,3.9,13.5,6.8,252
BM-003,PT-002,Baseline,6.4,10.1,5.5,710,340,22,18,0.8,4.1,14.1,6.2,268
BM-004,PT-003,Baseline,12.8,18.6,9.2,540,260,68,48,4.5,3.5,11.8,8.9,198
BM-005,PT-003,Week4,9.4,14.2,7.1,590,300,55,36,3.1,3.6,12.2,7.8,212
BM-006,PT-004,Baseline,7.6,11.3,5.8,690,350,42,28,1.8,4.0,13.8,6.5,258
BM-007,PT-004,Week12,3.2,5.4,2.8,780,420,18,12,0.3,4.2,14.4,5.9,275
BM-008,PT-005,Baseline,15.4,22.1,11.5,480,220,75,55,6.2,3.3,11.2,9.8,185
BM-009,PT-006,Week12,2.8,4.8,2.4,800,440,15,10,0.1,4.3,14.6,5.6,282
BM-010,PT-008,Week12,1.9,3.2,1.8,850,480,8,6,0.0,4.4,14.8,5.2,295`;

export const MOCK_FILE_CONTENTS: Record<string, { content: string; type: "txt" | "csv" }> = {
  "fakepkrawdata.txt": { content: FAKE_PK_RAW_DATA, type: "txt" },
  "fäkepkrawdata.txt": { content: FAKE_PK_RAW_DATA, type: "txt" },
  "raw_oncology_trial_data.csv": { content: FAKE_CSV_DATA, type: "csv" },
  "trial_phase2_data.csv": { content: FAKE_TRIAL_DATA, type: "csv" },
  "safety_data_2025.xlsx": { content: FAKE_SAFETY_DATA, type: "csv" },
  "biomarkers_q4_2025.csv": { content: FAKE_BIOMARKER_DATA, type: "csv" },
  "efficacy_outcomes.xlsx": { content: FAKE_CSV_DATA, type: "csv" },
  "pk_study_data.csv": { content: FAKE_PK_RAW_DATA, type: "txt" },
};

// ── CSV parser ───────────────────────────────────────────────────────────────

function parseCSV(raw: string): { headers: string[]; rows: string[][] } {
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

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

// ── Column analysis ─────────────────────────────────────────────────────────

interface ColumnAnalysis {
  numericCols: number[];
  numericHeaders: string[];
  labelCol: number;
  hasPlottableData: boolean;
}

function analyzeColumns(headers: string[], rows: string[][]): ColumnAnalysis {
  const numericCols: number[] = [];

  for (let ci = 0; ci < headers.length; ci++) {
    const values = rows.map(r => r[ci]).filter(Boolean);
    if (values.length === 0) continue;
    const numericRatio = values.filter(v => !isNaN(parseFloat(v)) && isFinite(Number(v))).length / values.length;
    if (numericRatio >= 0.8) numericCols.push(ci);
  }

  // Find best label column (first non-numeric column, or first column)
  let labelCol = 0;
  for (let ci = 0; ci < headers.length; ci++) {
    if (!numericCols.includes(ci)) { labelCol = ci; break; }
  }

  // Need at least 2 numeric columns OR 1 numeric + a label to plot
  const hasPlottableData = numericCols.length >= 2 || (numericCols.length >= 1 && rows.length >= 2);
  const numericHeaders = numericCols.map(ci => headers[ci]);

  return { numericCols, numericHeaders, labelCol, hasPlottableData };
}

// ── Pagination ───────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 15;

// ── Sort types ───────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc" | null;

// ── Sub-components ───────────────────────────────────────────────────────────

function HighlightText({ text, search }: { text: string; search: string }) {
  if (!search.trim()) return <>{text}</>;
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-[#BFDBFE] text-[#1E40AF] rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function FileTypeIcon({ type, name }: { type: FileContentType; name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (type === "csv" || ext === "csv" || ext === "xlsx" || ext === "xls")
    return <FileSpreadsheet className="w-5 h-5 text-[#007BFF] flex-shrink-0" />;
  if (type === "pdf" || ext === "pdf")
    return <FileType className="w-5 h-5 text-red-500 flex-shrink-0" />;
  if (type === "image" || ext === "png" || ext === "jpg" || ext === "jpeg")
    return <ImageIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />;
  return <FileText className="w-5 h-5 text-[#007BFF] flex-shrink-0" />;
}

function FileTypeBadge({ type, name }: { type: FileContentType; name: string }) {
  const ext = name.split(".").pop()?.toUpperCase() || "FILE";
  const colors: Record<string, string> = {
    CSV: "bg-[#EFF6FF] text-[#007BFF] border-[#BFDBFE]",
    XLSX: "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]",
    XLS: "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]",
    JSON: "bg-[#FFF7ED] text-[#EA580C] border-[#FED7AA]",
    PDF: "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]",
    TXT: "bg-[#F8FAFC] text-[#6C757D] border-[#DEE2E6]",
  };
  const cls = colors[ext] || colors.TXT;
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${cls}`}>
      {ext}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [viewTab, setViewTab] = useState<"data" | "chart">("data");
  const [showSuccess, setShowSuccess] = useState(false);
  const searchInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) node.focus();
  }, []);

  // Reset state and log when file changes
  useEffect(() => {
    setCurrentPage(0);
    setSearchTerm("");
    setSearchOpen(false);
    setSortCol(null);
    setSortDir(null);
    setViewTab("data");

    if (file) {
      console.log("[FilePreview] Opening file:", file.name, "type:", file.type, "size:", file.size, "hasContent:", !!file.content);
      setShowSuccess(true);
      const t = setTimeout(() => setShowSuccess(false), 1500);
      return () => clearTimeout(t);
    }
  }, [file?.name]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!file) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (searchOpen) { setSearchOpen(false); setSearchTerm(""); }
        else onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [file, onClose, searchOpen]);

  // Lock body scroll
  useEffect(() => {
    if (!file) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [file]);

  // Resolve content
  const resolvedContent = useMemo(() => {
    if (!file) return null;
    if (file.content) return file.content;
    const key = file.name.toLowerCase();
    const mock = MOCK_FILE_CONTENTS[key];
    if (mock) return mock.content;

    // Try partial filename match for uploaded files
    for (const [mockKey, mockVal] of Object.entries(MOCK_FILE_CONTENTS)) {
      if (key.includes(mockKey) || mockKey.includes(key)) return mockVal.content;
    }
    return null;
  }, [file]);

  const resolvedType = useMemo((): FileContentType => {
    if (!file) return null;
    if (file.type) return file.type;
    const key = file.name.toLowerCase();
    const mock = MOCK_FILE_CONTENTS[key];
    if (mock) return mock.type;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") return "csv";
    if (ext === "xlsx" || ext === "xls") return "csv"; // treat as CSV if we have text content
    if (ext === "json") return "txt";
    if (ext === "txt" || ext === "tsv") return "txt";
    if (ext === "pdf") return "pdf";
    if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext ?? "")) return "image";
    return "txt";
  }, [file]);

  // Parse CSV data
  const csvData = useMemo(() => {
    if ((resolvedType !== "csv") || !resolvedContent) return null;
    try {
      return parseCSV(resolvedContent);
    } catch (err) {
      console.error("[FilePreview] CSV parse error:", err);
      return null;
    }
  }, [resolvedType, resolvedContent]);

  // Column analysis for chart detection
  const colAnalysis = useMemo(() => {
    if (!csvData) return null;
    return analyzeColumns(csvData.headers, csvData.rows);
  }, [csvData]);

  const hasChartData = !!(colAnalysis?.hasPlottableData) || file?.hasGraphs;

  // Sorted rows
  const sortedRows = useMemo(() => {
    if (!csvData) return [];
    if (sortCol === null || sortDir === null) return csvData.rows;
    return [...csvData.rows].sort((a, b) => {
      const va = a[sortCol] ?? "";
      const vb = b[sortCol] ?? "";
      const na = parseFloat(va);
      const nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) {
        return sortDir === "asc" ? na - nb : nb - na;
      }
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [csvData, sortCol, sortDir]);

  const totalPages = csvData ? Math.ceil(sortedRows.length / ROWS_PER_PAGE) : 0;
  const paginatedRows = sortedRows.slice(currentPage * ROWS_PER_PAGE, (currentPage + 1) * ROWS_PER_PAGE);

  // Chart data
  const chartData = useMemo(() => {
    if (!csvData || !colAnalysis || !colAnalysis.hasPlottableData) return null;
    const { numericCols, labelCol } = colAnalysis;
    // Use up to first 5 numeric columns and limit to 50 rows for performance
    const plotCols = numericCols.slice(0, 5);
    const maxRows = Math.min(csvData.rows.length, 50);
    return csvData.rows.slice(0, maxRows).map((row) => {
      const point: Record<string, string | number> = {
        label: row[labelCol] ?? "",
      };
      for (const ci of plotCols) {
        point[csvData.headers[ci]] = parseFloat(row[ci]) || 0;
      }
      return point;
    });
  }, [csvData, colAnalysis]);

  // Search match count
  const searchMatchCount = useMemo(() => {
    if (!searchTerm.trim() || !resolvedContent) return 0;
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    return (resolvedContent.match(regex) ?? []).length;
  }, [searchTerm, resolvedContent]);

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

  const handleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortCol(null); setSortDir(null); }
    } else {
      setSortCol(colIdx);
      setSortDir("asc");
    }
    setCurrentPage(0);
  };

  // ── Render ────────────────────────────────────────────────────────────────

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

          {/* Modal */}
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
              {/* ── Header ──────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#DEE2E6] bg-white flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <FileTypeIcon type={resolvedType} name={file.name} />
                  <h2 className="text-lg font-semibold text-[#1a1f36] truncate">
                    {file.name}
                  </h2>
                  <FileTypeBadge type={resolvedType} name={file.name} />
                  {/* Success indicator */}
                  <AnimatePresence>
                    {showSuccess && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-1 text-[#28A745]"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs font-medium">Loaded</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex items-center gap-2">
                  {/* Data / Chart toggle */}
                  {hasChartData && resolvedContent && (
                    <div className="flex items-center bg-[#F3F4F6] rounded-md p-0.5 gap-0.5 mr-2">
                      <button
                        onClick={() => setViewTab("data")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                          viewTab === "data"
                            ? "bg-white text-[#007BFF] shadow-sm"
                            : "text-[#6C757D] hover:text-[#374151]"
                        }`}
                      >
                        <Table2 className="w-3.5 h-3.5" />
                        Data
                      </button>
                      <button
                        onClick={() => setViewTab("chart")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                          viewTab === "chart"
                            ? "bg-white text-[#007BFF] shadow-sm"
                            : "text-[#6C757D] hover:text-[#374151]"
                        }`}
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Chart
                      </button>
                    </div>
                  )}
                  {/* Search toggle */}
                  <button
                    onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearchTerm(""); }}
                    className={`p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                      searchOpen ? "bg-blue-50 text-[#007BFF]" : "text-gray-400 hover:text-gray-800 hover:bg-gray-100"
                    }`}
                    title="Search in document (Ctrl+F)"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-[#007BFF] hover:text-[#0056b3] hover:bg-[#EFF6FF] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
                    aria-label="Close preview"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* ── Search Bar ──────────────────────────────────────── */}
              {searchOpen && (
                <div className="flex items-center gap-3 px-6 py-2.5 border-b border-[#DEE2E6] bg-[#F8FAFC] flex-shrink-0">
                  <Search className="w-4 h-4 text-[#007BFF] flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search in document..."
                    className="flex-1 text-sm bg-transparent border-none outline-none text-[#1a1f36] placeholder-[#6C757D]"
                  />
                  {searchTerm && (
                    <span className="text-xs text-[#6C757D] flex-shrink-0">
                      {searchMatchCount} match{searchMatchCount !== 1 ? "es" : ""}
                    </span>
                  )}
                  <button
                    onClick={() => { setSearchTerm(""); setSearchOpen(false); }}
                    className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* ── Content ──────────────────────────────────────────── */}
              <div className="flex-1 overflow-auto">
                {/* Error state */}
                {file.error ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#FEF2F2] flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-[#DC3545]" />
                    </div>
                    <p className="text-sm font-medium text-[#DC3545]">
                      Error loading content: {file.error}
                    </p>
                    <p className="text-xs text-[#6C757D]">
                      Try downloading the file directly or contact support.
                    </p>
                  </div>
                ) : !resolvedContent ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#F8F9FA] flex items-center justify-center">
                      <FileText className="w-6 h-6 text-[#6C757D]" />
                    </div>
                    <p className="text-sm text-[#6C757D]">
                      No content available for this file.
                    </p>
                    <p className="text-xs text-[#ADB5BD]">
                      The file may be binary, too large for preview, or still uploading.
                    </p>
                  </div>
                ) : viewTab === "chart" && chartData && colAnalysis ? (
                  /* ── Chart View ─────────────────────────────────── */
                  <div className="p-6">
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-[#1a1f36] mb-1">
                        Auto-Generated Chart
                      </h3>
                      <p className="text-xs text-[#6C757D]">
                        Plotting {colAnalysis.numericHeaders.slice(0, 5).join(", ")} across {Math.min(csvData!.rows.length, 50)} data points
                      </p>
                    </div>
                    {/* Line chart */}
                    <div className="border border-[#DEE2E6] rounded-lg p-4 bg-white mb-6">
                      <p className="text-xs font-medium text-[#6C757D] mb-3 uppercase tracking-wide">Line Chart</p>
                      <ResponsiveContainer width="100%" height={320}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6C757D" }} angle={-30} textAnchor="end" height={60} />
                          <YAxis tick={{ fontSize: 11, fill: "#6C757D" }} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #DEE2E6" }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {colAnalysis.numericHeaders.slice(0, 5).map((header, i) => (
                            <Line
                              key={header}
                              type="monotone"
                              dataKey={header}
                              stroke={CHART_COLORS[i % CHART_COLORS.length]}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Bar chart */}
                    <div className="border border-[#DEE2E6] rounded-lg p-4 bg-white">
                      <p className="text-xs font-medium text-[#6C757D] mb-3 uppercase tracking-wide">Bar Chart</p>
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6C757D" }} angle={-30} textAnchor="end" height={60} />
                          <YAxis tick={{ fontSize: 11, fill: "#6C757D" }} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #DEE2E6" }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {colAnalysis.numericHeaders.slice(0, 5).map((header, i) => (
                            <Bar
                              key={header}
                              dataKey={header}
                              fill={CHART_COLORS[i % CHART_COLORS.length]}
                              radius={[4, 4, 0, 0]}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : resolvedType === "csv" && csvData ? (
                  /* ── CSV Table ──────────────────────────────────── */
                  <div className="p-4">
                    <div className="overflow-x-auto border border-[#DEE2E6] rounded-lg">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#F8F9FA] border-b border-[#DEE2E6] sticky top-0 z-10">
                            {csvData.headers.map((h, i) => (
                              <th
                                key={i}
                                onClick={() => handleSort(i)}
                                className="px-4 py-2.5 text-left font-semibold text-[#007BFF] whitespace-nowrap text-xs uppercase tracking-wide cursor-pointer hover:bg-[#EFF6FF] transition-colors select-none"
                              >
                                <div className="flex items-center gap-1.5">
                                  <HighlightText text={h} search={searchTerm} />
                                  {sortCol === i ? (
                                    sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 opacity-30" />
                                  )}
                                </div>
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
                                  ? "bg-white hover:bg-[#EFF6FF] transition-colors"
                                  : "bg-[#F8F9FA] hover:bg-[#EFF6FF] transition-colors"
                              }
                            >
                              {row.map((cell, ci) => (
                                <td
                                  key={ci}
                                  className="px-4 py-2 text-[#2d3748] whitespace-nowrap border-b border-[#e5e7eb]"
                                >
                                  {cell ? <HighlightText text={cell} search={searchTerm} /> : "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-between text-sm text-[#6C757D]">
                        <span>
                          Showing {currentPage * ROWS_PER_PAGE + 1}–
                          {Math.min((currentPage + 1) * ROWS_PER_PAGE, sortedRows.length)} of{" "}
                          {sortedRows.length} rows
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
                ) : resolvedType === "pdf" && file.fileUrl ? (
                  /* ── PDF embed ──────────────────────────────────── */
                  <div className="flex-1 flex items-center justify-center p-4">
                    <embed
                      src={`${file.fileUrl}${file.fileUrl.includes("?") ? "&" : "?"}response-content-disposition=inline`}
                      type="application/pdf"
                      className="w-full h-full min-h-[60vh] rounded"
                    />
                  </div>
                ) : resolvedType === "image" && file.fileUrl ? (
                  /* ── Image viewer ───────────────────────────────── */
                  <div className="flex-1 flex items-center justify-center p-4 bg-[#F8F9FA]">
                    <img
                      src={file.fileUrl}
                      alt={file.name}
                      className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
                    />
                  </div>
                ) : (
                  /* ── Plain text ─────────────────────────────────── */
                  <div className="p-4">
                    <pre
                      className="bg-[#F8F9FA] p-4 rounded-lg text-sm leading-relaxed text-[#2d3748] overflow-x-auto"
                      style={{
                        fontFamily: "'Consolas', 'Monaco', 'Menlo', monospace",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                      }}
                    >
                      <HighlightText text={resolvedContent} search={searchTerm} />
                    </pre>
                  </div>
                )}
              </div>

              {/* ── Footer ──────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-[#DEE2E6] bg-[#F8F9FA] flex-shrink-0 text-xs text-[#6C757D]">
                <div className="flex items-center gap-4">
                  {file.size && <span>File size: {file.size}</span>}
                  {file.uploadedDate && <span>Uploaded: {file.uploadedDate}</span>}
                  {resolvedType === "csv" && csvData && (
                    <span>
                      {csvData.rows.length} rows &times; {csvData.headers.length} columns
                    </span>
                  )}
                  {hasChartData && (
                    <span className="flex items-center gap-1 text-[#007BFF]">
                      <BarChart3 className="w-3 h-3" /> Chart-ready data
                    </span>
                  )}
                </div>
                <button
                  onClick={handleDownload}
                  disabled={!resolvedContent}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#007BFF] text-[#007BFF] hover:bg-[#EFF6FF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200"
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
