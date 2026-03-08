/**
 * NuPhormeCTD.jsx — eCTD Regulatory Document Generation Platform
 * Complete single-file React application for NuPhorm
 *
 * Features: AI-powered eCTD document generation, PDF viewer with citation linking,
 * file upload, annotation system, export, and demo data.
 *
 * CDN Dependencies (add to HTML head):
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"></script>
 *   <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
 */

import React, { useState, useReducer, useRef, useCallback, useEffect, useMemo } from 'react';

// ════════════════════════════════════════════════════════════════
// SECTION 1: SVG ICONS
// ════════════════════════════════════════════════════════════════

function Icon({ name, size = 20, className = '', onClick = undefined, style = undefined }) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round',
    strokeLinejoin: 'round', className,
    ...(onClick ? { onClick } : {}),
    ...(style ? { style } : {}),
  };
  const icons = {
    fileText: <><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
    upload: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
    barChart: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    edit: <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    layers: <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
    database: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>,
    user: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    send: <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    book: <><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    chevronDown: <><polyline points="6 9 12 15 18 9"/></>,
    chevronUp: <><polyline points="18 15 12 9 6 15"/></>,
    chevronLeft: <><polyline points="15 18 9 12 15 6"/></>,
    chevronRight: <><polyline points="9 18 15 12 9 6"/></>,
    search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    download: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    alertCircle: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    zoomIn: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></>,
    zoomOut: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff: <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></>,
    maximize: <><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></>,
    printer: <><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  };
  return <svg {...props}>{icons[name] || null}</svg>;
}

// ════════════════════════════════════════════════════════════════
// SECTION 2: CONSTANTS
// ════════════════════════════════════════════════════════════════

const COLORS = {
  navy: '#1a2035',
  navyLight: '#243049',
  panelBg: '#ffffff',
  pageBg: '#f0f4f8',
  accent: '#3b82f6',
  accentHover: '#2563eb',
  teal: '#0ea5e9',
  amber: '#f59e0b',
  green: '#22c55e',
  red: '#ef4444',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
};

const SHADOW = '0 1px 4px rgba(0,0,0,0.08)';
const RADIUS = '8px';

const FORMAT_STANDARDS = [
  { id: 'fda-estar', label: 'FDA eSTAR', region: 'US FDA' },
  { id: 'ema-ctd', label: 'EMA CTD', region: 'EU EMA' },
  { id: 'ich-ctd', label: 'ICH CTD', region: 'International' },
  { id: 'pmda', label: 'PMDA', region: 'Japan' },
  { id: 'health-canada', label: 'Health Canada', region: 'Canada' },
];

const ECTD_MODULES = [
  { module: '1', title: 'Administrative Information', sections: [
    { code: '1.0', name: 'Cover Letter' },
    { code: '1.0.1', name: 'Comprehensive Table of Contents' },
  ]},
  { module: '2', title: 'CTD Summaries', sections: [
    { code: '2.5', name: 'Clinical Overview' },
    { code: '2.6', name: 'Nonclinical Written Summary' },
    { code: '2.7.1', name: 'Summary of Biopharmaceutic Studies' },
    { code: '2.7.2', name: 'Summary of Clinical Pharmacology Studies' },
    { code: '2.7.3', name: 'Summary of Clinical Efficacy' },
    { code: '2.7.4', name: 'Summary of Clinical Safety' },
    { code: '2.7.5', name: 'Literature References' },
    { code: '2.7.6', name: 'Synopses of Individual Studies' },
  ]},
  { module: '3', title: 'Quality', sections: [
    { code: '3.2.S', name: 'Drug Substance' },
    { code: '3.2.P', name: 'Drug Product' },
  ]},
  { module: '4', title: 'Nonclinical Study Reports', sections: [
    { code: '4.2.1', name: 'Pharmacology' },
    { code: '4.2.2', name: 'Pharmacokinetics' },
    { code: '4.2.3', name: 'Toxicology' },
  ]},
  { module: '5', title: 'Clinical Study Reports', sections: [
    { code: '5.3.1', name: 'Reports of Biopharmaceutic Studies' },
    { code: '5.3.3', name: 'Reports of Controlled Clinical Studies' },
    { code: '5.3.5', name: 'Reports of Efficacy and Safety Studies' },
    { code: '5.3.7', name: 'Case Report Forms' },
  ]},
];

// ════════════════════════════════════════════════════════════════
// SECTION 3: DEMO DATA
// ════════════════════════════════════════════════════════════════

const DEMO_CLINICAL_TRIAL = {
  id: 'demo-1',
  name: 'CLINICAL_TRIAL_PHASE3_NP2847.txt',
  size: 28400,
  pageCount: 12,
  status: 'processed',
  rawText: `CLINICAL STUDY REPORT — PHASE 3, RANDOMIZED, DOUBLE-BLIND, PLACEBO-CONTROLLED
Study ID: NP-2847-CLN-003
Compound: Veridapastat Mesylate (NP-2847) 200mg oral once daily
Indication: Moderate-to-Severe Chronic Inflammatory Arthropathy (CIA)
Sponsor: NuPhorm Therapeutics, Inc.
Study Period: March 2024 – November 2025

1. STUDY DESIGN AND PATIENT POPULATION
This was a Phase 3, multicenter, randomized, double-blind, placebo-controlled study evaluating the efficacy and safety of veridapastat mesylate 200mg administered orally once daily in adult patients (≥18 years) with moderate-to-severe chronic inflammatory arthropathy (CIA). Patients were required to have an ACR functional class of I–III, disease duration ≥6 months, and inadequate response to at least one conventional DMARD.

A total of 499 patients were randomized 1:1 to veridapastat 200mg (n=248) or placebo (n=251) and treated for 24 weeks. The study was conducted across 42 clinical sites in the US, EU, and Japan.

Baseline demographics: mean age 52.4 years (SD 11.8), 67% female, mean disease duration 7.3 years (SD 4.9). Baseline DAS28-CRP mean: 5.82 (SD 1.02).

2. PRIMARY EFFICACY ENDPOINT
The primary endpoint was the change from baseline in DAS28-CRP score at Week 12.

Results:
- Veridapastat group: mean change -2.14 (SD 1.21)
- Placebo group: mean change -0.87 (SD 1.15)
- Treatment difference: -1.27 (95% CI: -1.48, -1.06; p<0.0001)

ACR20 response rate at Week 12: Veridapastat 68.5% vs Placebo 34.3% (p<0.0001)
ACR50 response rate at Week 12: Veridapastat 41.1% vs Placebo 15.5% (p<0.0001)
ACR70 response rate at Week 12: Veridapastat 18.5% vs Placebo 5.2% (p<0.0001)

3. SAFETY SUMMARY
The overall incidence of treatment-emergent adverse events (TEAEs) was 71.4% in the veridapastat group vs 58.2% in the placebo group.

Most Common Adverse Events (≥5% in either group):
| Adverse Event                | Veridapastat (n=248) | Placebo (n=251) |
|------------------------------|---------------------|-----------------|
| Upper respiratory infection   | 14.1% (35)          | 11.6% (29)      |
| Nausea                       | 12.5% (31)          | 5.6% (14)       |
| Headache                     | 10.9% (27)          | 9.2% (23)       |
| Diarrhea                     | 8.5% (21)           | 4.4% (11)       |
| Fatigue                      | 7.3% (18)           | 5.2% (13)       |
| Dizziness                    | 6.5% (16)           | 3.6% (9)        |
| Elevated ALT                 | 5.6% (14)           | 2.0% (5)        |
| Arthralgia                   | 4.8% (12)           | 6.0% (15)       |
| Injection site reaction      | 0%                  | 0%              |

Serious Adverse Events (SAEs):
Total SAEs: Veridapastat 4.8% (12/248) vs Placebo 3.2% (8/251)

Veridapastat SAEs:
- Pneumonia: 2 patients (0.8%)
- Hepatic enzyme elevation (ALT >5x ULN): 2 patients (0.8%), both resolved upon discontinuation
- Deep vein thrombosis: 1 patient (0.4%)
- Acute pancreatitis: 1 patient (0.4%)
- Herpes zoster (disseminated): 1 patient (0.4%)
- Major adverse cardiovascular event (non-fatal MI): 1 patient (0.4%)
- Severe neutropenia (ANC <500/mm3): 1 patient (0.4%)
- Intestinal perforation: 1 patient (0.4%)
- Anaphylactic reaction: 1 patient (0.4%)
- Interstitial lung disease: 1 patient (0.4%)

Placebo SAEs:
- Pneumonia: 2 patients (0.8%)
- Hip fracture: 2 patients (0.8%)
- Acute coronary syndrome: 1 patient (0.4%)
- Appendicitis: 1 patient (0.4%)
- Cellulitis: 1 patient (0.4%)
- Pulmonary embolism: 1 patient (0.4%)

Deaths: 0 in veridapastat group, 1 in placebo group (motor vehicle accident, unrelated to treatment)

4. LABORATORY ABNORMALITIES
Hematology:
- Neutropenia (ANC <1000/mm3): Veridapastat 3.2% vs Placebo 0.4%
- Lymphopenia (<500/mm3): Veridapastat 2.4% vs Placebo 0.8%
- Anemia (Hgb <8 g/dL): Veridapastat 1.2% vs Placebo 0.8%

Hepatic:
- ALT >3x ULN: Veridapastat 5.6% vs Placebo 2.0%
- ALT >5x ULN: Veridapastat 0.8% vs Placebo 0%
- AST >3x ULN: Veridapastat 3.6% vs Placebo 1.6%
- Total bilirubin >2x ULN: Veridapastat 1.2% vs Placebo 0.4%

Lipids:
- Total cholesterol increase ≥30 mg/dL: Veridapastat 18.5% vs Placebo 4.8%
- LDL cholesterol increase ≥20 mg/dL: Veridapastat 14.1% vs Placebo 3.2%
- HDL cholesterol increase ≥5 mg/dL: Veridapastat 8.1% vs Placebo 2.0%

5. DISCONTINUATIONS
Discontinuation due to AEs: Veridapastat 6.9% (17/248) vs Placebo 3.6% (9/251)
Most common reasons for discontinuation in veridapastat group: elevated transaminases (n=5), nausea (n=3), neutropenia (n=2), rash (n=2), other (n=5)

6. CONCLUSIONS
Veridapastat 200mg demonstrated statistically significant and clinically meaningful improvement in DAS28-CRP at Week 12, with robust ACR20/50/70 response rates. The safety profile was consistent with the known mechanism of action (JAK inhibitor class effects). The hepatic enzyme elevations and hematologic changes warrant monitoring per the proposed label. No unexpected safety signals were identified.`,
};

const DEMO_FDA_GUIDANCE = {
  id: 'demo-2',
  name: 'FDA_GUIDANCE_ADVERSE_REACTIONS.txt',
  size: 14200,
  pageCount: 6,
  status: 'processed',
  rawText: `FDA GUIDANCE FOR INDUSTRY
Adverse Reactions Section of Labeling for Human Prescription Drug and Biological Products
(Excerpt for Reference)

1. GENERAL PRINCIPLES
The adverse reactions section of labeling should describe the overall adverse reaction profile of the drug based on the entire safety database, including data from clinical trials, postmarketing surveillance, and relevant nonclinical data.

The adverse reactions section should:
a) List adverse reactions that occur at an incidence of ≥1% and at a higher incidence than placebo
b) Include a table of common adverse reactions if ≥5 adverse reactions meet the ≥1% threshold
c) Organize by System Organ Class (SOC) when multiple body systems are affected
d) Describe serious adverse reactions in a separate subsection, regardless of incidence
e) Include laboratory abnormalities that are clinically significant

2. SERIOUS ADVERSE REACTIONS
A separate subsection should highlight serious adverse reactions observed during clinical trials. These include:
- Events requiring hospitalization or prolongation of hospitalization
- Events that are life-threatening
- Events resulting in persistent or significant disability/incapacity
- Events resulting in death
- Important medical events that may jeopardize the patient

For each serious adverse reaction, the following should be provided:
- Nature of the event
- Incidence (number and percentage) in drug and comparator groups
- Time to onset if relevant
- Risk factors if identified
- Outcome (resolution, sequelae, death)

3. LABORATORY ABNORMALITIES
Clinically significant laboratory changes should be reported separately from clinical adverse events. For JAK inhibitors specifically, FDA recommends monitoring and reporting of:
- Complete blood count including neutrophils, lymphocytes, and hemoglobin
- Hepatic transaminases (ALT, AST) and bilirubin
- Lipid parameters (total cholesterol, LDL, HDL, triglycerides)
- Serum creatinine and CPK

Grade 3-4 laboratory abnormalities should always be reported with incidence tables.

4. ADVERSE REACTIONS IN SPECIFIC POPULATIONS
Consider adverse reaction reporting specific to:
- Geriatric patients (≥65 years)
- Patients with hepatic impairment
- Patients with renal impairment
- Patients receiving concomitant immunosuppressive therapy

5. COMPARISON WITH CLASS EFFECTS
For drugs within established pharmacological classes (e.g., JAK inhibitors, TNF inhibitors), the labeling should address known class effects including:
- Serious infections including tuberculosis and opportunistic infections
- Malignancies including lymphoma
- Thrombotic events (DVT, PE)
- Cardiovascular events (MACE)
- Gastrointestinal perforations

The section should clearly state whether observed rates are consistent with class expectations or represent signals requiring further investigation.`,
};

// ════════════════════════════════════════════════════════════════
// SECTION 4: STATE MANAGEMENT
// ════════════════════════════════════════════════════════════════

const initialState = {
  apiKey: '',
  apiKeySet: false,
  uploadedDocs: [],
  currentDocument: {
    title: '',
    sectionCode: '',
    content: '',
    annotatedHtml: '',
    wordCount: 0,
    characterCount: 0,
    lastSaved: null,
    format: 'FDA eSTAR',
    standard: 'US FDA',
    subsections: [],
  },
  citations: [],
  activeTab: 'sources',
  annotationsVisible: true,
  activePdfDocId: null,
  activePdfPage: 1,
  activeCitationId: null,
  isGenerating: false,
  generatingStatus: '',
  showApiModal: true,
  showUploadModal: false,
  showDocTypeSelector: false,
  showExportMenu: false,
  showFormatMenu: false,
  showAnnotationSidebar: false,
  sidebarActiveItem: 'document',
  chatInput: '',
  selectedDocType: null,
  toasts: [],
  streamedContent: '',
  isStreaming: false,
  documentVersions: [],
  pdfZoom: 1.0,
};

let toastCounter = 0;

function reducer(state, action) {
  switch (action.type) {
    case 'SET_API_KEY':
      return { ...state, apiKey: action.payload, apiKeySet: true, showApiModal: false };
    case 'TOGGLE_API_MODAL':
      return { ...state, showApiModal: !state.showApiModal };
    case 'TOGGLE_UPLOAD_MODAL':
      return { ...state, showUploadModal: !state.showUploadModal };
    case 'TOGGLE_DOC_TYPE':
      return { ...state, showDocTypeSelector: !state.showDocTypeSelector };
    case 'TOGGLE_EXPORT':
      return { ...state, showExportMenu: !state.showExportMenu };
    case 'TOGGLE_FORMAT':
      return { ...state, showFormatMenu: !state.showFormatMenu };
    case 'TOGGLE_ANNOTATIONS':
      return { ...state, annotationsVisible: !state.annotationsVisible };
    case 'TOGGLE_ANNOTATION_SIDEBAR':
      return { ...state, showAnnotationSidebar: !state.showAnnotationSidebar };
    case 'SET_SIDEBAR_ITEM':
      return { ...state, sidebarActiveItem: action.payload };
    case 'SET_CHAT_INPUT':
      return { ...state, chatInput: action.payload };
    case 'SET_DOC_TYPE':
      return {
        ...state,
        selectedDocType: action.payload,
        showDocTypeSelector: false,
        chatInput: `Generate a ${action.payload.code} ${action.payload.name} in ${state.currentDocument.format} format using all uploaded reference documents`,
      };
    case 'ADD_DOCUMENT':
      return { ...state, uploadedDocs: [...state.uploadedDocs, action.payload] };
    case 'REMOVE_DOCUMENT':
      return { ...state, uploadedDocs: state.uploadedDocs.filter(d => d.id !== action.payload) };
    case 'SET_FORMAT':
      return {
        ...state,
        currentDocument: { ...state.currentDocument, format: action.payload.label, standard: action.payload.region },
        showFormatMenu: false,
      };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_ACTIVE_PDF':
      return { ...state, activePdfDocId: action.payload, activePdfPage: 1 };
    case 'SET_PDF_PAGE':
      return { ...state, activePdfPage: action.payload };
    case 'SET_PDF_ZOOM':
      return { ...state, pdfZoom: action.payload };
    case 'SET_ACTIVE_CITATION': {
      const cite = state.citations.find(c => c.id === action.payload);
      const updates = { activeCitationId: action.payload };
      if (cite) {
        const doc = state.uploadedDocs.find(d => d.name === cite.docName || d.id === cite.docId);
        if (doc) {
          updates.activePdfDocId = doc.id;
          updates.activePdfPage = cite.page || 1;
        }
        updates.activeTab = 'sources';
      }
      return { ...state, ...updates };
    }
    case 'SET_CITATION_STATUS':
      return {
        ...state,
        citations: state.citations.map(c =>
          c.id === action.payload.id ? { ...c, status: action.payload.status } : c
        ),
      };
    case 'SET_GENERATING':
      return { ...state, isGenerating: action.payload.active, generatingStatus: action.payload.status || '' };
    case 'SET_DOCUMENT': {
      const version = {
        id: Date.now().toString(),
        title: action.payload.title,
        sectionCode: action.payload.sectionCode,
        wordCount: action.payload.wordCount,
        timestamp: new Date(),
      };
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          ...action.payload,
          lastSaved: new Date(),
        },
        documentVersions: [version, ...state.documentVersions].slice(0, 20),
      };
    }
    case 'SET_CITATIONS':
      return { ...state, citations: action.payload };
    case 'SET_STREAMED_CONTENT':
      return { ...state, streamedContent: action.payload };
    case 'APPEND_STREAM_WORD':
      return { ...state, streamedContent: state.streamedContent + (state.streamedContent ? ' ' : '') + action.payload };
    case 'SET_STREAMING':
      return { ...state, isStreaming: action.payload };
    case 'ADD_TOAST': {
      const id = ++toastCounter;
      return { ...state, toasts: [...state.toasts, { id, ...action.payload }] };
    }
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
    case 'LOAD_DEMO': {
      const docs = [
        { ...DEMO_CLINICAL_TRIAL, pdfData: null },
        { ...DEMO_FDA_GUIDANCE, pdfData: null },
      ];
      return {
        ...state,
        uploadedDocs: docs,
        activePdfDocId: docs[0].id,
        chatInput: 'Generate a 2.7.4 Summary of Clinical Safety in FDA eSTAR format using all uploaded reference documents',
        selectedDocType: { code: '2.7.4', name: 'Summary of Clinical Safety' },
        showUploadModal: false,
      };
    }
    case 'CLOSE_ALL_MENUS':
      return {
        ...state,
        showDocTypeSelector: false,
        showExportMenu: false,
        showFormatMenu: false,
      };
    default:
      return state;
  }
}

// ════════════════════════════════════════════════════════════════
// SECTION 5: UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTime(date) {
  if (!date) return 'Never';
  return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Parse {{CITE:N}} markers in document text and return annotated HTML + citation list.
 */
function parseCitationMarkers(text, citationsData) {
  if (!text) return { html: '', plainText: '' };
  let html = text;
  const citeRegex = /\{\{CITE:(\d+)\}\}/g;
  html = html.replace(citeRegex, (match, num) => {
    const n = parseInt(num);
    return `<sup class="cite-ref" data-cite-id="${n}" style="color:${COLORS.accent};cursor:pointer;font-weight:600;font-size:11px;margin-left:1px">[${n}]</sup>`;
  });
  // Wrap paragraphs
  html = html.split('\n\n').map(p => {
    if (p.trim().startsWith('#')) {
      const level = (p.match(/^#+/) || [''])[0].length;
      const text = p.replace(/^#+\s*/, '');
      const tag = level <= 2 ? 'h3' : 'h4';
      return `<${tag} style="font-family:'IBM Plex Sans',sans-serif;font-weight:600;font-size:${level <= 2 ? '16px' : '14px'};margin:16px 0 8px;color:${COLORS.textPrimary}">${text}</${tag}>`;
    }
    if (p.trim().startsWith('|')) return `<pre style="font-size:12px;line-height:1.6;overflow-x:auto">${p}</pre>`;
    return `<p style="margin:0 0 12px;line-height:1.7">${p}</p>`;
  }).join('');
  const plainText = text.replace(citeRegex, '[$1]');
  return { html, plainText };
}

/**
 * Extract text from uploaded file based on type.
 */
async function extractTextFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      reader.onload = async (e) => {
        try {
          if (window.pdfjsLib) {
            const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise;
            let text = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              text += content.items.map(item => item.str).join(' ') + '\n\n';
            }
            resolve({ text, pageCount: pdf.numPages, pdfData: e.target.result });
          } else {
            resolve({ text: '[PDF.js not loaded — text extraction unavailable]', pageCount: 0, pdfData: e.target.result });
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (file.name.endsWith('.docx') && window.mammoth) {
      reader.onload = async (e) => {
        try {
          const result = await window.mammoth.extractRawText({ arrayBuffer: e.target.result });
          resolve({ text: result.value, pageCount: Math.ceil(result.value.length / 3000) });
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        const text = e.target.result;
        resolve({ text, pageCount: Math.ceil(text.length / 3000) });
      };
      reader.readAsText(file);
    }
  });
}

/**
 * Call Claude API to generate regulatory document.
 */
async function callClaudeAPI(apiKey, userMessage, uploadedDocs, format) {
  const docsContext = uploadedDocs.map((doc, i) =>
    `--- SOURCE DOCUMENT ${i + 1}: "${doc.name}" ---\n${doc.rawText.slice(0, 8000)}\n`
  ).join('\n\n');

  const systemPrompt = `You are an expert regulatory medical writer specializing in FDA eCTD submissions. You have been given source documents to analyze.

CRITICAL OUTPUT REQUIREMENT: Return ONLY a valid JSON object. No markdown fences, no backticks, no preamble text. The JSON must have this exact structure:
{
  "documentContent": "the full generated document text with section headings marked by ## prefix. After EVERY factual claim, statistic, adverse event rate, patient number, or clinical finding, insert {{CITE:N}} where N is the citation number starting from 1",
  "citations": [
    {"id": 1, "docName": "source filename", "page": 1, "excerpt": "exact quoted text from source supporting this claim", "claim": "the specific claim this citation supports"}
  ],
  "sectionTitle": "the full section title e.g. 2.7.4 Summary of Clinical Safety",
  "wordCount": 0,
  "subsections": ["list of all subsection headings generated"]
}

FORMAT: ${format || 'FDA eSTAR'}

CITATION RULES:
- Every data point, statistic, adverse event rate, patient number, lab value, or clinical finding MUST have a {{CITE:N}} marker
- Citations must reference specific source documents by filename
- Page numbers should be estimated based on document position
- Aim for comprehensive coverage with 15-30 citations for a full section
- Generate a substantive document of 500-1500 words with proper regulatory language`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: `SOURCE DOCUMENTS:\n${docsContext}\n\nUSER REQUEST: ${userMessage}` }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text;
  const clean = text.replace(/```json\s*|```\s*/g, '').trim();
  return JSON.parse(clean);
}

// ════════════════════════════════════════════════════════════════
// SECTION 6: SHARED STYLES
// ════════════════════════════════════════════════════════════════

const S = {
  panel: {
    backgroundColor: COLORS.panelBg,
    borderRadius: RADIUS,
    boxShadow: SHADOW,
    border: `1px solid ${COLORS.border}`,
    overflow: 'hidden',
  },
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '6px 12px', borderRadius: '6px', fontSize: '13px',
    fontWeight: 500, cursor: 'pointer', border: 'none',
    transition: 'all 150ms ease',
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  btnPrimary: {
    backgroundColor: COLORS.accent, color: '#fff',
  },
  btnGhost: {
    backgroundColor: 'transparent', color: COLORS.textSecondary,
  },
  input: {
    width: '100%', padding: '8px 12px', borderRadius: '6px',
    border: `1px solid ${COLORS.border}`, fontSize: '14px',
    fontFamily: "'IBM Plex Sans', sans-serif",
    outline: 'none', transition: 'border-color 150ms',
  },
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '32px',
    width: '90%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  dropdown: {
    position: 'absolute', backgroundColor: '#fff', borderRadius: RADIUS,
    boxShadow: '0 8px 30px rgba(0,0,0,0.15)', border: `1px solid ${COLORS.border}`,
    zIndex: 100, overflow: 'hidden',
  },
  tabBtn: (active) => ({
    padding: '8px 16px', fontSize: '13px', fontWeight: active ? 600 : 400,
    color: active ? COLORS.accent : COLORS.textSecondary,
    backgroundColor: active ? `${COLORS.accent}10` : 'transparent',
    border: 'none', borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent',
    cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif",
    transition: 'all 150ms',
  }),
};

// ════════════════════════════════════════════════════════════════
// SECTION 7: TOAST COMPONENT
// ════════════════════════════════════════════════════════════════

function Toast({ toast, onDismiss }) {
  const colors = { success: COLORS.green, error: COLORS.red, info: COLORS.accent, warning: COLORS.amber };
  const icons = { success: 'check', error: 'alertCircle', info: 'alertCircle', warning: 'alertCircle' };
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 16px', borderRadius: '8px', backgroundColor: '#fff',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: `1px solid ${COLORS.border}`,
      borderLeft: `4px solid ${colors[toast.type] || COLORS.accent}`,
      marginBottom: '8px', minWidth: '300px', maxWidth: '420px',
      fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px',
      animation: 'slideInRight 300ms ease',
    }}>
      <Icon name={icons[toast.type] || 'alertCircle'} size={16}
        style={{ color: colors[toast.type], flexShrink: 0 }} />
      <span style={{ flex: 1, color: COLORS.textPrimary }}>{toast.message}</span>
      <Icon name="x" size={14} style={{ cursor: 'pointer', color: COLORS.textMuted }}
        onClick={() => onDismiss(toast.id)} />
    </div>
  );
}

function ToastContainer({ toasts, dispatch }) {
  const handleDismiss = useCallback((id) => dispatch({ type: 'REMOVE_TOAST', payload: id }), [dispatch]);
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 2000 }}>
      {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={handleDismiss} />)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SECTION 8: API KEY MODAL
// ════════════════════════════════════════════════════════════════

function ApiKeyModal({ show, onConnect, onClose, hasKey }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  if (!show) return null;

  const handleConnect = () => {
    if (!key.startsWith('sk-ant')) {
      setError('API key must start with "sk-ant"');
      return;
    }
    if (key.length < 20) {
      setError('API key appears too short');
      return;
    }
    setError('');
    onConnect(key);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            backgroundColor: `${COLORS.accent}15`, display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Icon name="settings" size={24} style={{ color: COLORS.accent }} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: COLORS.textPrimary, margin: '0 0 8px',
            fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Connect Your Claude API Key
          </h2>
          <p style={{ fontSize: '13px', color: COLORS.textSecondary, margin: 0,
            fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Your key is stored in memory only and never sent anywhere except Anthropic's API
          </p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <input
            type="password"
            placeholder="sk-ant-..."
            value={key}
            onChange={e => { setKey(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleConnect()}
            style={{ ...S.input, borderColor: error ? COLORS.red : COLORS.border }}
          />
          {error && (
            <p style={{ color: COLORS.red, fontSize: '12px', margin: '6px 0 0',
              fontFamily: "'IBM Plex Sans', sans-serif" }}>{error}</p>
          )}
        </div>

        <button onClick={handleConnect} style={{
          ...S.btn, ...S.btnPrimary, width: '100%', justifyContent: 'center',
          padding: '10px', fontSize: '14px',
        }}>
          Connect
        </button>

        {hasKey && (
          <button onClick={onClose} style={{
            ...S.btn, ...S.btnGhost, width: '100%', justifyContent: 'center',
            marginTop: '8px', color: COLORS.textMuted,
          }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SECTION 9: UPLOAD MODAL
// ════════════════════════════════════════════════════════════════

function UploadModal({ show, onClose, dispatch, uploadedDocs }) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  if (!show) return null;

  const processFile = async (file) => {
    const docId = generateId();
    dispatch({ type: 'ADD_DOCUMENT', payload: {
      id: docId, name: file.name, size: file.size, pageCount: 0,
      rawText: '', pdfData: null, status: 'processing',
    }});
    try {
      const result = await extractTextFromFile(file);
      dispatch({ type: 'REMOVE_DOCUMENT', payload: docId });
      dispatch({ type: 'ADD_DOCUMENT', payload: {
        id: docId, name: file.name, size: file.size,
        pageCount: result.pageCount || 1,
        rawText: result.text, pdfData: result.pdfData || null,
        status: 'processed',
      }});
      dispatch({ type: 'ADD_TOAST', payload: { type: 'success', message: `${file.name} processed` } });
    } catch (err) {
      dispatch({ type: 'REMOVE_DOCUMENT', payload: docId });
      dispatch({ type: 'ADD_DOCUMENT', payload: {
        id: docId, name: file.name, size: file.size, pageCount: 0,
        rawText: '', pdfData: null, status: 'error',
      }});
      dispatch({ type: 'ADD_TOAST', payload: { type: 'error', message: `Failed to process ${file.name}` } });
    }
  };

  const handleFiles = (files) => {
    Array.from(files).forEach(processFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const statusIcon = (s) => {
    if (s === 'processed') return <Icon name="check" size={14} style={{ color: COLORS.green }} />;
    if (s === 'processing') return <span style={{ fontSize: '12px' }}>⏳</span>;
    return <Icon name="alertCircle" size={14} style={{ color: COLORS.red }} />;
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: COLORS.textPrimary, margin: 0,
            fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Upload Source Documents
          </h2>
          <Icon name="x" size={20} style={{ cursor: 'pointer', color: COLORS.textMuted }} onClick={onClose} />
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? COLORS.accent : COLORS.border}`,
            borderRadius: '8px', padding: '40px 20px', textAlign: 'center',
            backgroundColor: dragOver ? `${COLORS.accent}08` : '#fafbfc',
            cursor: 'pointer', transition: 'all 200ms', marginBottom: '16px',
          }}
        >
          <Icon name="upload" size={32} style={{ color: COLORS.textMuted, margin: '0 auto 12px', display: 'block' }} />
          <p style={{ margin: '0 0 8px', fontWeight: 600, color: COLORS.textPrimary, fontSize: '14px',
            fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Drop your source documents here
          </p>
          <p style={{ margin: '0 0 12px', color: COLORS.textMuted, fontSize: '12px',
            fontFamily: "'IBM Plex Sans', sans-serif" }}>
            or click to browse files
          </p>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
            {['PDF', 'DOCX', 'TXT', 'CSV'].map(fmt => (
              <span key={fmt} style={{
                padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
                backgroundColor: `${COLORS.accent}12`, color: COLORS.accent, fontWeight: 600,
              }}>{fmt}</span>
            ))}
          </div>
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.txt,.csv"
            style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
        </div>

        {/* Demo data button */}
        <button onClick={() => dispatch({ type: 'LOAD_DEMO' })} style={{
          ...S.btn, width: '100%', justifyContent: 'center', marginBottom: '16px',
          backgroundColor: `${COLORS.teal}12`, color: COLORS.teal, fontWeight: 600,
        }}>
          ⚡ Load Demo Data (Phase 3 Trial + FDA Guidance)
        </button>

        {/* File list */}
        {uploadedDocs.length > 0 && (
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {uploadedDocs.map(doc => (
              <div key={doc.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', borderRadius: '6px', marginBottom: '4px',
                backgroundColor: '#fafbfc', border: `1px solid ${COLORS.border}`,
              }}>
                <Icon name="fileText" size={16} style={{ color: COLORS.textMuted, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: COLORS.textPrimary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: "'IBM Plex Sans', sans-serif" }}>{doc.name}</div>
                  <div style={{ fontSize: '11px', color: COLORS.textMuted,
                    fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    {formatBytes(doc.size)} · {doc.pageCount} pages
                  </div>
                </div>
                {statusIcon(doc.status)}
                <Icon name="trash" size={14}
                  style={{ cursor: 'pointer', color: COLORS.textMuted }}
                  onClick={() => dispatch({ type: 'REMOVE_DOCUMENT', payload: doc.id })} />
              </div>
            ))}
          </div>
        )}

        {uploadedDocs.length >= 10 && (
          <p style={{ fontSize: '11px', color: COLORS.amber, marginTop: '8px',
            fontFamily: "'IBM Plex Sans', sans-serif" }}>
            ⚠ Demo limit: 10 files or ~500KB text. Production uses a RAG pipeline.
          </p>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SECTION 10: DOCUMENT TYPE SELECTOR
// ════════════════════════════════════════════════════════════════

function DocTypeSelector({ show, onSelect, onClose }) {
  if (!show) return null;
  return (
    <div style={{ ...S.dropdown, top: '100%', left: 0, width: '380px', maxHeight: '440px', overflowY: 'auto', marginTop: '4px' }}>
      {ECTD_MODULES.map(mod => (
        <div key={mod.module}>
          <div style={{
            padding: '8px 16px', fontSize: '11px', fontWeight: 700,
            color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px',
            backgroundColor: '#fafbfc', borderBottom: `1px solid ${COLORS.border}`,
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}>
            Module {mod.module} — {mod.title}
          </div>
          {mod.sections.map(sec => (
            <div key={sec.code}
              onClick={() => { onSelect(sec); onClose(); }}
              style={{
                padding: '8px 16px 8px 24px', fontSize: '13px', cursor: 'pointer',
                color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}05`,
                fontFamily: "'IBM Plex Sans', sans-serif",
                transition: 'background-color 100ms',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = `${COLORS.accent}08`}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontWeight: 600, color: COLORS.accent, marginRight: '8px' }}>{sec.code}</span>
              {sec.name}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SECTION 11: SIDEBAR
// ════════════════════════════════════════════════════════════════

function Sidebar({ state, dispatch }) {
  const items = [
    { id: 'files', icon: 'fileText', label: 'Documents', badge: state.uploadedDocs.length || null },
    { id: 'document', icon: 'edit', label: 'Editor' },
    { id: 'upload', icon: 'upload', label: 'Upload' },
    { id: 'analytics', icon: 'barChart', label: 'Analytics' },
    { id: 'layers', icon: 'layers', label: 'Versions' },
    { id: 'database', icon: 'database', label: 'Knowledge Base' },
    { id: 'user', icon: 'user', label: 'Profile' },
  ];

  const handleClick = (id) => {
    if (id === 'upload') {
      dispatch({ type: 'TOGGLE_UPLOAD_MODAL' });
    } else if (id === 'files') {
      dispatch({ type: 'TOGGLE_UPLOAD_MODAL' });
    } else {
      dispatch({ type: 'SET_SIDEBAR_ITEM', payload: id });
    }
  };

  return (
    <div style={{
      width: '60px', backgroundColor: COLORS.navy, display: 'flex',
      flexDirection: 'column', alignItems: 'center', paddingTop: '16px',
      flexShrink: 0, position: 'relative',
    }}>
      {/* Logo */}
      <div style={{
        width: '36px', height: '36px', borderRadius: '10px',
        background: 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '24px', fontWeight: 800, color: '#fff', fontSize: '14px',
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}>N</div>

      {/* Nav items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {items.map(item => (
          <div key={item.id}
            onClick={() => handleClick(item.id)}
            title={item.label}
            style={{
              width: '40px', height: '40px', borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', position: 'relative',
              backgroundColor: state.sidebarActiveItem === item.id ? `${COLORS.accent}25` : 'transparent',
              color: state.sidebarActiveItem === item.id ? '#fff' : '#8892a4',
              transition: 'all 150ms',
            }}
          >
            <Icon name={item.icon} size={20} />
            {item.badge && (
              <span style={{
                position: 'absolute', top: '2px', right: '2px',
                width: '16px', height: '16px', borderRadius: '50%',
                backgroundColor: COLORS.accent, color: '#fff',
                fontSize: '9px', fontWeight: 700, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>{item.badge}</span>
            )}
          </div>
        ))}
      </div>

      {/* Bottom: Settings + Branding */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', paddingBottom: '12px' }}>
        <div
          onClick={() => dispatch({ type: 'TOGGLE_API_MODAL' })}
          title="Settings — API Key"
          style={{
            width: '40px', height: '40px', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#8892a4', position: 'relative',
          }}
        >
          <Icon name="settings" size={20} />
          {state.apiKeySet && (
            <span style={{
              position: 'absolute', top: '6px', right: '6px',
              width: '8px', height: '8px', borderRadius: '50%',
              backgroundColor: COLORS.green, border: '2px solid ' + COLORS.navy,
            }} />
          )}
        </div>
        <div style={{
          fontSize: '8px', color: '#556078', textAlign: 'center', lineHeight: 1.2,
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}>
          © 2026<br/>NuPhorm
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SECTION 12: TOP CHAT BAR
// ════════════════════════════════════════════════════════════════

function TopChatBar({ state, dispatch, onSend }) {
  const textareaRef = useRef(null);
  const canSend = state.chatInput.trim() && state.uploadedDocs.length > 0 && state.apiKeySet && !state.isGenerating;

  const getTooltip = () => {
    if (!state.apiKeySet) return 'Set your API key first (gear icon)';
    if (state.uploadedDocs.length === 0) return 'Upload at least one document first';
    if (!state.chatInput.trim()) return 'Type a message';
    if (state.isGenerating) return 'Generation in progress...';
    return '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div style={{
      padding: '12px 16px', backgroundColor: COLORS.panelBg,
      borderBottom: `1px solid ${COLORS.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        {/* Book icon — doc type selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_DOC_TYPE' })}
            style={{ ...S.btn, ...S.btnGhost, padding: '8px', color: COLORS.accent }}
            title="Select document type"
          >
            <Icon name="book" size={20} />
            <Icon name="chevronDown" size={14} />
          </button>
          <DocTypeSelector
            show={state.showDocTypeSelector}
            onSelect={(sec) => dispatch({ type: 'SET_DOC_TYPE', payload: sec })}
            onClose={() => dispatch({ type: 'TOGGLE_DOC_TYPE' })}
          />
        </div>

        {/* Chat input */}
        <textarea
          ref={textareaRef}
          value={state.chatInput}
          onChange={e => dispatch({ type: 'SET_CHAT_INPUT', payload: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="Chat with AI about your regulatory documents... (Shift+Enter for new line)"
          rows={1}
          style={{
            ...S.input, flex: 1, resize: 'none', minHeight: '38px', maxHeight: '120px',
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
          onInput={e => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
        />

        {/* Send button */}
        <button
          onClick={canSend ? onSend : undefined}
          title={getTooltip()}
          style={{
            ...S.btn, ...S.btnPrimary, padding: '9px',
            opacity: canSend ? 1 : 0.4, cursor: canSend ? 'pointer' : 'not-allowed',
          }}
        >
          {state.isGenerating ? (
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', width: 20, height: 20 }}>⏳</span>
          ) : (
            <Icon name="send" size={18} />
          )}
        </button>
      </div>

      {/* Tip line */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px',
        fontSize: '12px', color: COLORS.textMuted, fontFamily: "'IBM Plex Sans', sans-serif",
      }}>
        {state.selectedDocType && (
          <span style={{
            padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
            backgroundColor: `${COLORS.accent}12`, color: COLORS.accent, fontWeight: 600,
          }}>
            {state.selectedDocType.code} {state.selectedDocType.name}
          </span>
        )}
        <span>
          {state.isGenerating ? (
            <span style={{ color: COLORS.accent }}>
              {state.generatingStatus || 'Generating...'}
            </span>
          ) : (
            <>💡 Tip: Select a document type from the book icon, then describe what you need</>
          )}
        </span>
        {/* Status indicator */}
        <span style={{ marginLeft: 'auto' }}>
          {state.isGenerating ? '🔵' : state.uploadedDocs.length > 0 && state.apiKeySet ? '🟢' : '🟡'}
          <span style={{ marginLeft: '4px', fontSize: '11px' }}>
            {state.isGenerating ? 'Generating' : state.apiKeySet ? 'Ready' : 'Setup needed'}
          </span>
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SECTION 13: DOCUMENT PANEL (Left Panel)
// ════════════════════════════════════════════════════════════════

function ExportDropdown({ show, onClose, currentDocument, citations }) {
  if (!show) return null;

  const exportAsWord = () => {
    const citationFootnotes = citations.map((c, i) =>
      `[${i + 1}] ${c.docName || 'Source'}, p.${c.page || '?'}: "${c.excerpt || c.claim || ''}"`
    ).join('\n');
    const html = `<html><head><meta charset="utf-8"><style>
      body{font-family:'Times New Roman',serif;font-size:12pt;margin:1in;line-height:1.6}
      h1{font-size:16pt;margin-bottom:6pt}h2{font-size:14pt}h3{font-size:12pt}
      .header{text-align:center;font-size:10pt;color:#666;border-bottom:1px solid #ccc;padding-bottom:8pt;margin-bottom:24pt}
      .footnotes{margin-top:24pt;border-top:1px solid #ccc;padding-top:12pt;font-size:10pt}
    </style></head><body>
      <div class="header">CONFIDENTIAL — Regulatory Submission Document — NuPhorm</div>
      <h1>${currentDocument.sectionCode} ${currentDocument.title}</h1>
      <p><em>Format: ${currentDocument.format} | Standard: ${currentDocument.standard}</em></p>
      <hr/>
      ${currentDocument.annotatedHtml || currentDocument.content.split('\n').map(l => `<p>${l}</p>`).join('')}
      <div class="footnotes"><h3>References</h3><pre>${citationFootnotes}</pre></div>
    </body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDocument.sectionCode || 'Document'}_${new Date().toISOString().split('T')[0]}_NuPhorm.doc`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  const exportAsPdf = () => {
    window.print();
    onClose();
  };

  const copyToClipboard = () => {
    const text = currentDocument.content || '';
    navigator.clipboard.writeText(text).catch(() => {});
    onClose();
  };

  return (
    <div style={{ ...S.dropdown, top: '100%', right: 0, width: '220px', marginTop: '4px', padding: '4px' }}>
      {[
        { label: 'Export as Word (.doc)', icon: 'download', action: exportAsWord },
        { label: 'Export as PDF', icon: 'printer', action: exportAsPdf },
        { label: 'Copy to Clipboard', icon: 'copy', action: copyToClipboard },
      ].map(item => (
        <div key={item.label}
          onClick={item.action}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
            fontSize: '13px', color: COLORS.textPrimary,
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = `${COLORS.accent}08`}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Icon name={item.icon} size={15} style={{ color: COLORS.textMuted }} />
          {item.label}
        </div>
      ))}
    </div>
  );
}

function FormatDropdown({ show, onSelect, onClose, current }) {
  if (!show) return null;
  return (
    <div style={{ ...S.dropdown, top: '100%', left: 0, width: '240px', marginTop: '4px', padding: '4px' }}>
      {FORMAT_STANDARDS.map(f => (
        <div key={f.id}
          onClick={() => onSelect(f)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
            fontSize: '13px', color: COLORS.textPrimary,
            backgroundColor: current === f.label ? `${COLORS.accent}08` : 'transparent',
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = `${COLORS.accent}12`}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = current === f.label ? `${COLORS.accent}08` : 'transparent'}
        >
          <span><strong>{f.label}</strong></span>
          <span style={{ fontSize: '11px', color: COLORS.textMuted }}>{f.region}</span>
        </div>
      ))}
    </div>
  );
}

function DocumentPanel({ state, dispatch }) {
  const doc = state.currentDocument;
  const contentRef = useRef(null);

  const { html: annotatedHtml } = useMemo(() => {
    if (state.isStreaming) return { html: '' };
    return parseCitationMarkers(doc.content, state.citations);
  }, [doc.content, state.citations, state.isStreaming]);

  // Handle citation clicks via event delegation
  const handleContentClick = useCallback((e) => {
    const citeEl = e.target.closest('[data-cite-id]');
    if (citeEl) {
      const citeId = parseInt(citeEl.dataset.citeId);
      dispatch({ type: 'SET_ACTIVE_CITATION', payload: citeId });
    }
  }, [dispatch]);

  // Streaming cursor effect
  const streamDisplay = useMemo(() => {
    if (!state.isStreaming && !state.streamedContent) return null;
    const text = state.streamedContent || '';
    return text + (state.isStreaming ? ' ▊' : '');
  }, [state.streamedContent, state.isStreaming]);

  const wordCount = doc.content ? doc.content.split(/\s+/).filter(Boolean).length : 0;
  const charCount = doc.content ? doc.content.length : 0;

  // Extract subsection headings for mini TOC
  const subsections = useMemo(() => {
    if (!doc.content) return [];
    const headings = [];
    doc.content.split('\n').forEach((line, i) => {
      const match = line.match(/^(#{1,4})\s+(.+)/);
      if (match) headings.push({ level: match[1].length, text: match[2], line: i });
    });
    return headings;
  }, [doc.content]);

  const hasContent = doc.content || state.isStreaming || state.streamedContent;

  return (
    <div style={{ ...S.panel, display: 'flex', flexDirection: 'column', flex: '0 0 55%', minWidth: 0 }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h3 style={{ margin: '0 0 2px', fontSize: '15px', fontWeight: 700, color: COLORS.textPrimary,
            fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Document Content
          </h3>
          {/* Format / Standard selector */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <span
              onClick={() => dispatch({ type: 'TOGGLE_FORMAT' })}
              style={{
                fontSize: '12px', color: COLORS.textSecondary, cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
            >
              Format: <strong>{doc.format}</strong> | Standard: <strong>{doc.standard}</strong>
              <Icon name="chevronDown" size={12} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
            </span>
            <FormatDropdown
              show={state.showFormatMenu}
              current={doc.format}
              onSelect={f => dispatch({ type: 'SET_FORMAT', payload: f })}
              onClose={() => dispatch({ type: 'TOGGLE_FORMAT' })}
            />
          </div>
        </div>

        {/* Header buttons */}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_ANNOTATIONS' })}
          style={{
            ...S.btn,
            backgroundColor: state.annotationsVisible ? `${COLORS.amber}18` : 'transparent',
            color: state.annotationsVisible ? COLORS.amber : COLORS.textMuted,
          }}
        >
          <Icon name={state.annotationsVisible ? 'eye' : 'eyeOff'} size={15} />
          Annotations
        </button>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_EXPORT' })}
            style={{ ...S.btn, ...S.btnGhost }}
          >
            <Icon name="download" size={15} />
            Export
            <Icon name="chevronDown" size={12} />
          </button>
          <ExportDropdown
            show={state.showExportMenu}
            onClose={() => dispatch({ type: 'TOGGLE_EXPORT' })}
            currentDocument={doc}
            citations={state.citations}
          />
        </div>
      </div>

      {/* Section breadcrumb */}
      {doc.sectionCode && (
        <div style={{
          padding: '6px 16px', backgroundColor: '#fafbfc',
          borderBottom: `1px solid ${COLORS.border}`,
          fontSize: '12px', color: COLORS.textSecondary,
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}>
          eCTD → Module {doc.sectionCode.charAt(0)} → <strong>{doc.sectionCode} {doc.title}</strong>
        </div>
      )}

      {/* Document content area */}
      <div ref={contentRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {hasContent ? (
          <div
            onClick={handleContentClick}
            style={{
              padding: '20px 24px', fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '13px', lineHeight: 1.7, color: COLORS.textPrimary,
              minHeight: '100%',
            }}
          >
            {state.isStreaming || (state.streamedContent && !doc.content) ? (
              <pre style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px',
                lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
              }}>
                {streamDisplay}
              </pre>
            ) : (
              <div
                dangerouslySetInnerHTML={{
                  __html: state.annotationsVisible ? annotatedHtml : doc.content.split('\n').map(l => `<p style="margin:0 0 8px">${l}</p>`).join('')
                }}
              />
            )}
          </div>
        ) : state.isGenerating ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', padding: '40px',
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.accent,
              animation: 'spin 1s linear infinite', marginBottom: '16px',
            }} />
            <p style={{ fontSize: '14px', fontWeight: 600, color: COLORS.textPrimary,
              fontFamily: "'IBM Plex Sans', sans-serif", margin: '0 0 4px' }}>
              {state.generatingStatus || 'Analyzing documents...'}
            </p>
            <p style={{ fontSize: '12px', color: COLORS.textMuted,
              fontFamily: "'IBM Plex Sans', sans-serif", margin: 0 }}>
              Processing {state.uploadedDocs.length} source document{state.uploadedDocs.length !== 1 ? 's' : ''}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', padding: '40px', textAlign: 'center',
          }}>
            <Icon name="edit" size={40} style={{ color: COLORS.textMuted, marginBottom: '16px', opacity: 0.4 }} />
            <p style={{ fontSize: '15px', fontWeight: 600, color: COLORS.textSecondary,
              fontFamily: "'IBM Plex Sans', sans-serif", margin: '0 0 8px' }}>
              No document generated yet
            </p>
            <p style={{ fontSize: '13px', color: COLORS.textMuted, maxWidth: '320px',
              fontFamily: "'IBM Plex Sans', sans-serif", margin: 0 }}>
              Upload source documents and use the chat bar to generate an eCTD-compliant regulatory document
            </p>
          </div>
        )}
      </div>

      {/* Mini TOC */}
      {subsections.length > 0 && (
        <div style={{
          padding: '8px 16px', borderTop: `1px solid ${COLORS.border}`,
          backgroundColor: '#fafbfc', maxHeight: '80px', overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {subsections.map((s, i) => (
              <span key={i} style={{
                fontSize: '11px', color: COLORS.accent, cursor: 'pointer',
                padding: '2px 6px', borderRadius: '3px', backgroundColor: `${COLORS.accent}08`,
                fontFamily: "'IBM Plex Sans', sans-serif", whiteSpace: 'nowrap',
              }}>
                {s.text}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: '8px 16px', borderTop: `1px solid ${COLORS.border}`,
        display: 'flex', alignItems: 'center', gap: '16px',
        fontSize: '11px', color: COLORS.textMuted, fontFamily: "'IBM Plex Sans', sans-serif",
      }}>
        <span>{charCount.toLocaleString()} chars</span>
        <span>{wordCount.toLocaleString()} words</span>
        <span>{state.citations.length} citations</span>
        <span style={{ marginLeft: 'auto' }}>
          Last saved: {formatTime(doc.lastSaved)}
        </span>
        {doc.sectionCode && <span>{doc.sectionCode} {doc.title}</span>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SECTION 14: PDF VIEWER
// ════════════════════════════════════════════════════════════════

function PdfViewer({ doc, page, zoom, activeCitation, dispatch }) {
  const canvasRef = useRef(null);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState(null);

  // Load PDF document
  useEffect(() => {
    if (!doc?.pdfData || !window.pdfjsLib) return;
    let cancelled = false;
    (async () => {
      try {
        const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(doc.pdfData) }).promise;
        if (!cancelled) {
          setPdfDoc(pdf);
          setTotalPages(pdf.numPages);
        }
      } catch (err) {
        console.error('PDF load error:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [doc?.pdfData]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfPage = await pdfDoc.getPage(Math.min(page, totalPages) || 1);
        const viewport = pdfPage.getViewport({ scale: zoom * 1.2 });
        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;

        // Draw citation highlight overlay (approximate positioning for demo)
        if (activeCitation) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
          const y = viewport.height * 0.3;
          const h = viewport.height * 0.12;
          ctx.fillRect(20, y, viewport.width - 40, h);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
          ctx.lineWidth = 2;
          ctx.strokeRect(20, y, viewport.width - 40, h);
        }
      } catch (err) {
        if (!cancelled) console.error('Page render error:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfDoc, page, zoom, totalPages, activeCitation]);

  if (!doc?.pdfData) {
    // Text-only fallback for non-PDF documents
    return (
      <div style={{ padding: '16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px',
        lineHeight: 1.6, color: COLORS.textPrimary, overflow: 'auto', flex: 1, whiteSpace: 'pre-wrap' }}>
        {doc?.rawText || 'No content available'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Page controls */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        padding: '6px 12px', borderBottom: `1px solid ${COLORS.border}`,
        fontSize: '12px', color: COLORS.textSecondary, fontFamily: "'IBM Plex Sans', sans-serif",
      }}>
        <button onClick={() => dispatch({ type: 'SET_PDF_PAGE', payload: Math.max(1, page - 1) })}
          disabled={page <= 1}
          style={{ ...S.btn, ...S.btnGhost, padding: '4px 6px', opacity: page <= 1 ? 0.3 : 1 }}>
          <Icon name="chevronLeft" size={14} />
        </button>
        <span>Page {page} of {totalPages || '?'}</span>
        <button onClick={() => dispatch({ type: 'SET_PDF_PAGE', payload: Math.min(totalPages, page + 1) })}
          disabled={page >= totalPages}
          style={{ ...S.btn, ...S.btnGhost, padding: '4px 6px', opacity: page >= totalPages ? 0.3 : 1 }}>
          <Icon name="chevronRight" size={14} />
        </button>
        <span style={{ margin: '0 8px', color: COLORS.border }}>|</span>
        <button onClick={() => dispatch({ type: 'SET_PDF_ZOOM', payload: Math.max(0.5, zoom - 0.2) })}
          style={{ ...S.btn, ...S.btnGhost, padding: '4px 6px' }}>
          <Icon name="zoomOut" size={14} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => dispatch({ type: 'SET_PDF_ZOOM', payload: Math.min(2.5, zoom + 0.2) })}
          style={{ ...S.btn, ...S.btnGhost, padding: '4px 6px' }}>
          <Icon name="zoomIn" size={14} />
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '8px', backgroundColor: '#e8ecf0' }}>
        <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SECTION 15: SOURCES TAB
// ════════════════════════════════════════════════════════════════

function SourcesTab({ state, dispatch }) {
  const activeDoc = state.uploadedDocs.find(d => d.id === state.activePdfDocId) || state.uploadedDocs[0];
  const activeCitation = state.citations.find(c => c.id === state.activeCitationId);

  if (state.uploadedDocs.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', padding: '40px', textAlign: 'center',
      }}>
        <Icon name="fileText" size={36} style={{ color: COLORS.textMuted, marginBottom: '12px', opacity: 0.4 }} />
        <p style={{ fontSize: '14px', fontWeight: 600, color: COLORS.textSecondary, margin: '0 0 8px',
          fontFamily: "'IBM Plex Sans', sans-serif" }}>No source documents</p>
        <p style={{ fontSize: '12px', color: COLORS.textMuted, margin: '0 0 16px',
          fontFamily: "'IBM Plex Sans', sans-serif" }}>Upload documents or load demo data to get started</p>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_UPLOAD_MODAL' })}
          style={{ ...S.btn, ...S.btnPrimary, fontSize: '13px' }}
        >
          <Icon name="upload" size={15} /> Upload Documents
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Document pills */}
      <div style={{
        display: 'flex', gap: '4px', padding: '8px 12px', overflowX: 'auto',
        borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
      }}>
        {state.uploadedDocs.map(doc => (
          <button key={doc.id}
            onClick={() => dispatch({ type: 'SET_ACTIVE_PDF', payload: doc.id })}
            style={{
              ...S.btn, padding: '4px 10px', fontSize: '11px', whiteSpace: 'nowrap',
              backgroundColor: doc.id === (activeDoc?.id) ? `${COLORS.accent}15` : '#f1f5f9',
              color: doc.id === (activeDoc?.id) ? COLORS.accent : COLORS.textSecondary,
              fontWeight: doc.id === (activeDoc?.id) ? 600 : 400,
              border: doc.id === (activeDoc?.id) ? `1px solid ${COLORS.accent}30` : `1px solid transparent`,
            }}
          >
            <Icon name="fileText" size={12} />
            {doc.name.length > 24 ? doc.name.slice(0, 22) + '...' : doc.name}
          </button>
        ))}
      </div>

      {/* Viewer */}
      {activeDoc?.pdfData ? (
        <PdfViewer
          doc={activeDoc}
          page={state.activePdfPage}
          zoom={state.pdfZoom}
          activeCitation={activeCitation}
          dispatch={dispatch}
        />
      ) : (
        <div style={{
          flex: 1, overflow: 'auto', padding: '16px',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px',
          lineHeight: 1.6, color: COLORS.textPrimary, whiteSpace: 'pre-wrap',
        }}>
          {activeDoc?.rawText || 'No content available'}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SECTION 16: CITATIONS TAB
// ════════════════════════════════════════════════════════════════

function CitationsTab({ citations, activeCitationId, dispatch }) {
  const statusBadge = (status) => {
    const map = {
      verified: { label: '✓ Verified', color: COLORS.green },
      review: { label: '⚠ Needs Review', color: COLORS.amber },
      disputed: { label: '✗ Disputed', color: COLORS.red },
    };
    const s = map[status] || map.review;
    return (
      <span style={{
        fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '3px',
        backgroundColor: `${s.color}15`, color: s.color,
      }}>{s.label}</span>
    );
  };

  if (citations.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', padding: '40px', textAlign: 'center',
      }}>
        <p style={{ fontSize: '14px', color: COLORS.textSecondary, fontFamily: "'IBM Plex Sans', sans-serif" }}>
          No citations yet — generate a document to see citations
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div style={{
        padding: '8px 12px', borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.textSecondary,
          fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {citations.length} citation{citations.length !== 1 ? 's' : ''}
        </span>
      </div>

      {citations.map((cite, i) => (
        <div key={cite.id || i}
          onClick={() => dispatch({ type: 'SET_ACTIVE_CITATION', payload: cite.id })}
          style={{
            padding: '10px 14px', borderBottom: `1px solid ${COLORS.border}`,
            cursor: 'pointer', transition: 'background-color 100ms',
            backgroundColor: cite.id === activeCitationId ? `${COLORS.accent}08` : 'transparent',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = `${COLORS.accent}05`}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = cite.id === activeCitationId ? `${COLORS.accent}08` : 'transparent'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              fontWeight: 700, color: COLORS.accent, fontSize: '13px',
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}>[{cite.id || i + 1}]</span>
            <span style={{
              fontSize: '12px', color: COLORS.textPrimary, fontWeight: 500,
              fontFamily: "'IBM Plex Sans', sans-serif",
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>{cite.docName || 'Source Document'}</span>
            <span style={{ fontSize: '11px', color: COLORS.textMuted }}>p.{cite.page || '?'}</span>
          </div>
          <p style={{
            margin: '0 0 4px', fontSize: '12px', color: COLORS.textSecondary,
            fontFamily: "'IBM Plex Mono', monospace", fontStyle: 'italic',
            lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            "{cite.excerpt || cite.claim || ''}"
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {statusBadge(cite.status || 'review')}
            <button
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'SET_CITATION_STATUS', payload: { id: cite.id, status: 'verified' } });
              }}
              style={{ ...S.btn, ...S.btnGhost, padding: '2px 6px', fontSize: '10px' }}
            >✓ Verify</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SECTION 17: REFERENCE SHEET TAB
// ════════════════════════════════════════════════════════════════

function ReferenceSheetTab({ citations }) {
  const refList = useMemo(() => {
    const seen = new Set();
    return citations.filter(c => {
      const key = c.docName || c.docId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((c, i) => ({
      num: i + 1,
      text: `${c.docName || 'Source Document'}. Cited on p.${c.page || '?'}. NuPhorm Therapeutics, Inc. 2025. Data on file.`,
    }));
  }, [citations]);

  const copyAll = () => {
    const text = refList.map(r => `${r.num}. ${r.text}`).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const exportDoc = () => {
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:'Times New Roman',serif;font-size:12pt;margin:1in;line-height:1.8}h1{font-size:14pt}ol li{margin-bottom:8pt}</style></head><body>
      <h1>Reference List — NLM/Vancouver Format</h1>
      <ol>${refList.map(r => `<li>${r.text}</li>`).join('')}</ol>
    </body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `References_${new Date().toISOString().split('T')[0]}_NuPhorm.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (citations.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px' }}>
        <p style={{ fontSize: '13px', color: COLORS.textMuted, fontFamily: "'IBM Plex Sans', sans-serif" }}>
          Generate a document to build a reference sheet
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '8px 12px', borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: COLORS.textSecondary,
          fontFamily: "'IBM Plex Sans', sans-serif" }}>
          NLM/Vancouver Format
        </span>
        <button onClick={copyAll} style={{ ...S.btn, ...S.btnGhost, padding: '4px 8px', fontSize: '11px' }}>
          <Icon name="copy" size={13} /> Copy All
        </button>
        <button onClick={exportDoc} style={{ ...S.btn, ...S.btnGhost, padding: '4px 8px', fontSize: '11px' }}>
          <Icon name="download" size={13} /> Export
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <ol style={{
          margin: 0, paddingLeft: '24px', fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '12px', lineHeight: 1.8, color: COLORS.textPrimary,
        }}>
          {refList.map(r => <li key={r.num} style={{ marginBottom: '8px' }}>{r.text}</li>)}
        </ol>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SECTION 18: REFERENCES PANEL (Right Panel)
// ════════════════════════════════════════════════════════════════

function ReferencesPanel({ state, dispatch }) {
  const tabs = [
    { id: 'sources', label: 'Sources', emoji: '📄' },
    { id: 'citations', label: 'Citations', emoji: '🔖' },
    { id: 'reference', label: 'Reference Sheet', emoji: '📋' },
  ];

  return (
    <div style={{ ...S.panel, display: 'flex', flexDirection: 'column', flex: '0 0 45%', minWidth: 0 }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: COLORS.textPrimary,
          fontFamily: "'IBM Plex Sans', sans-serif", flex: 1 }}>
          References
        </h3>
        {state.uploadedDocs.length > 0 && (
          <span style={{
            fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
            backgroundColor: `${COLORS.accent}12`, color: COLORS.accent, fontWeight: 600,
          }}>
            {state.uploadedDocs.length} document{state.uploadedDocs.length !== 1 ? 's' : ''}
          </span>
        )}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_UPLOAD_MODAL' })}
          style={{ ...S.btn, ...S.btnPrimary, padding: '5px 10px', fontSize: '12px' }}
        >
          <Icon name="plus" size={14} /> Add
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', borderBottom: `1px solid ${COLORS.border}`,
      }}>
        {tabs.map(tab => (
          <button key={tab.id}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab.id })}
            style={S.tabBtn(state.activeTab === tab.id)}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {state.activeTab === 'sources' && <SourcesTab state={state} dispatch={dispatch} />}
        {state.activeTab === 'citations' && (
          <CitationsTab citations={state.citations} activeCitationId={state.activeCitationId} dispatch={dispatch} />
        )}
        {state.activeTab === 'reference' && <ReferenceSheetTab citations={state.citations} />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SECTION 19: ANNOTATION SIDEBAR
// ════════════════════════════════════════════════════════════════

function AnnotationSidebar({ show, citations, activeCitationId, dispatch, onClose }) {
  const [filter, setFilter] = useState('all');
  if (!show) return null;

  const filtered = citations.filter(c => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: '340px',
      backgroundColor: '#fff', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
      borderLeft: `1px solid ${COLORS.border}`, zIndex: 50,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <h4 style={{ margin: 0, flex: 1, fontSize: '14px', fontWeight: 700, color: COLORS.textPrimary,
          fontFamily: "'IBM Plex Sans', sans-serif" }}>
          Annotations ({citations.length})
        </h4>
        <Icon name="x" size={18} style={{ cursor: 'pointer', color: COLORS.textMuted }} onClick={onClose} />
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', borderBottom: `1px solid ${COLORS.border}` }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'verified', label: '✓ Approved' },
          { id: 'review', label: '⚠ Review' },
          { id: 'disputed', label: '✗ Disputed' },
        ].map(f => (
          <button key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              ...S.btn, padding: '3px 8px', fontSize: '11px',
              backgroundColor: filter === f.id ? `${COLORS.accent}12` : 'transparent',
              color: filter === f.id ? COLORS.accent : COLORS.textMuted,
              fontWeight: filter === f.id ? 600 : 400,
            }}
          >{f.label}</button>
        ))}
      </div>

      {/* Annotation cards */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.map((cite, i) => (
          <div key={cite.id || i}
            onClick={() => dispatch({ type: 'SET_ACTIVE_CITATION', payload: cite.id })}
            style={{
              padding: '10px 14px', borderBottom: `1px solid ${COLORS.border}`,
              cursor: 'pointer',
              backgroundColor: cite.id === activeCitationId ? `${COLORS.amber}10` : 'transparent',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, color: COLORS.accent, fontSize: '12px' }}>[{cite.id || i + 1}]</span>
              <span style={{ fontSize: '11px', color: COLORS.textMuted, flex: 1 }}>{cite.docName} p.{cite.page}</span>
            </div>
            <p style={{ margin: '0 0 4px', fontSize: '11px', color: COLORS.textPrimary, lineHeight: 1.4,
              fontFamily: "'IBM Plex Sans', sans-serif" }}>
              <strong>Claim:</strong> {cite.claim || '—'}
            </p>
            <p style={{ margin: '0 0 6px', fontSize: '11px', color: COLORS.textSecondary,
              fontFamily: "'IBM Plex Mono', monospace", fontStyle: 'italic', lineHeight: 1.3 }}>
              "{(cite.excerpt || '').slice(0, 100)}{(cite.excerpt || '').length > 100 ? '...' : ''}"
            </p>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['verified', 'review', 'disputed'].map(s => (
                <button key={s}
                  onClick={e => { e.stopPropagation(); dispatch({ type: 'SET_CITATION_STATUS', payload: { id: cite.id, status: s } }); }}
                  style={{
                    ...S.btn, padding: '2px 6px', fontSize: '10px',
                    backgroundColor: cite.status === s ? `${COLORS.accent}12` : 'transparent',
                    color: cite.status === s ? COLORS.accent : COLORS.textMuted,
                  }}
                >
                  {s === 'verified' ? '✓' : s === 'review' ? '⚠' : '✗'} {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SECTION 20: MAIN APP COMPONENT
// ════════════════════════════════════════════════════════════════

export default function NuPhormeCTD() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const streamIntervalRef = useRef(null);

  // Load Google Fonts on mount
  useEffect(() => {
    if (!document.querySelector('link[href*="IBM+Plex"]')) {
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, []);

  // Load PDF.js on mount
  useEffect(() => {
    if (window.pdfjsLib) return;
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
    };
    document.head.appendChild(script);
  }, []);

  // Load mammoth.js on mount
  useEffect(() => {
    if (window.mammoth) return;
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    document.head.appendChild(script);
  }, []);

  // Inject keyframe animations
  useEffect(() => {
    if (document.querySelector('#nuphorm-keyframes')) return;
    const style = document.createElement('style');
    style.id = 'nuphorm-keyframes';
    style.textContent = `
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      @media print {
        .no-print { display: none !important; }
        .print-only { display: block !important; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Close dropdown menus on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('[data-dropdown]')) {
        dispatch({ type: 'CLOSE_ALL_MENUS' });
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Cleanup streaming interval on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    };
  }, []);

  // ── AI DOCUMENT GENERATION ──────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!state.chatInput.trim() || !state.apiKeySet || state.uploadedDocs.length === 0) return;

    const message = state.chatInput;
    dispatch({ type: 'SET_CHAT_INPUT', payload: '' });
    dispatch({ type: 'SET_GENERATING', payload: { active: true, status: `Analyzing ${state.uploadedDocs.length} document${state.uploadedDocs.length !== 1 ? 's' : ''}...` } });
    dispatch({ type: 'SET_STREAMED_CONTENT', payload: '' });
    dispatch({ type: 'SET_STREAMING', payload: false });
    dispatch({ type: 'ADD_TOAST', payload: { type: 'info', message: `Generating document from ${state.uploadedDocs.length} sources...` } });

    try {
      dispatch({ type: 'SET_GENERATING', payload: { active: true, status: 'Calling Claude API...' } });

      const result = await callClaudeAPI(
        state.apiKey,
        message,
        state.uploadedDocs,
        state.currentDocument.format
      );

      dispatch({ type: 'SET_GENERATING', payload: { active: true, status: 'Streaming document...' } });

      // Parse citations from response
      const citations = (result.citations || []).map((c, i) => ({
        id: c.id || i + 1,
        docName: c.docName || c.doc || 'Source',
        docId: null,
        page: c.page || 1,
        excerpt: c.excerpt || '',
        claim: c.claim || '',
        status: 'review',
      }));

      // Match citation docNames to uploaded doc IDs
      citations.forEach(cite => {
        const match = state.uploadedDocs.find(d =>
          d.name.toLowerCase().includes((cite.docName || '').toLowerCase().split('.')[0]) ||
          (cite.docName || '').toLowerCase().includes(d.name.toLowerCase().split('.')[0])
        );
        if (match) {
          cite.docId = match.id;
          cite.docName = match.name;
        } else if (state.uploadedDocs.length > 0) {
          cite.docId = state.uploadedDocs[0].id;
          cite.docName = state.uploadedDocs[0].name;
        }
      });

      dispatch({ type: 'SET_CITATIONS', payload: citations });

      // Simulate streaming word by word
      const docContent = result.documentContent || '';
      const words = docContent.split(' ');
      let wordIndex = 0;

      dispatch({ type: 'SET_STREAMING', payload: true });
      dispatch({ type: 'SET_STREAMED_CONTENT', payload: '' });

      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);

      streamIntervalRef.current = setInterval(() => {
        if (wordIndex < words.length) {
          dispatch({ type: 'APPEND_STREAM_WORD', payload: words[wordIndex] });
          wordIndex++;
        } else {
          clearInterval(streamIntervalRef.current);
          streamIntervalRef.current = null;

          // Streaming complete — set final document
          dispatch({ type: 'SET_STREAMING', payload: false });
          const { html } = parseCitationMarkers(docContent, citations);
          dispatch({ type: 'SET_DOCUMENT', payload: {
            title: result.sectionTitle || '',
            sectionCode: (result.sectionTitle || '').match(/^[\d.]+/)?.[0] || '',
            content: docContent,
            annotatedHtml: html,
            wordCount: result.wordCount || words.length,
            characterCount: docContent.length,
            subsections: result.subsections || [],
          }});
          dispatch({ type: 'SET_GENERATING', payload: { active: false, status: '' } });
          dispatch({ type: 'ADD_TOAST', payload: {
            type: 'success',
            message: `Document generated — ${words.length} words, ${citations.length} citations`,
          }});

          // Auto-switch to sources tab and activate first citation's document
          if (citations.length > 0 && citations[0].docId) {
            dispatch({ type: 'SET_ACTIVE_PDF', payload: citations[0].docId });
          }
        }
      }, 30);

    } catch (err) {
      dispatch({ type: 'SET_GENERATING', payload: { active: false, status: '' } });
      dispatch({ type: 'SET_STREAMING', payload: false });

      let errorMsg = err.message || 'Unknown error';
      if (errorMsg.includes('rate_limit') || errorMsg.includes('429')) {
        errorMsg = 'API rate limit hit — please wait a moment and try again';
      } else if (errorMsg.includes('context') || errorMsg.includes('too long')) {
        errorMsg = 'Documents too large for context window — try fewer/shorter documents';
      } else if (errorMsg.includes('invalid_api_key') || errorMsg.includes('401')) {
        errorMsg = 'Invalid API key — check your key in settings';
      }

      dispatch({ type: 'ADD_TOAST', payload: { type: 'error', message: errorMsg } });
      console.error('Generation error:', err);
    }
  }, [state.chatInput, state.apiKey, state.apiKeySet, state.uploadedDocs, state.currentDocument.format]);

  // ── RENDER ──────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      fontFamily: "'IBM Plex Sans', sans-serif", backgroundColor: COLORS.pageBg,
      overflow: 'hidden',
    }}>
      {/* CSS Animations */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>

      {/* Sidebar */}
      <Sidebar state={state} dispatch={dispatch} />

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        {/* Top Chat Bar */}
        <TopChatBar state={state} dispatch={dispatch} onSend={handleSend} />

        {/* Content area: DocumentPanel + ReferencesPanel */}
        <div style={{
          flex: 1, display: 'flex', gap: '12px', padding: '12px 16px',
          minHeight: 0, overflow: 'hidden',
        }}>
          <DocumentPanel state={state} dispatch={dispatch} />
          <ReferencesPanel state={state} dispatch={dispatch} />
        </div>

        {/* Annotation Sidebar (slide-out) */}
        <AnnotationSidebar
          show={state.showAnnotationSidebar}
          citations={state.citations}
          activeCitationId={state.activeCitationId}
          dispatch={dispatch}
          onClose={() => dispatch({ type: 'TOGGLE_ANNOTATION_SIDEBAR' })}
        />
      </div>

      {/* Modals */}
      <ApiKeyModal
        show={state.showApiModal}
        hasKey={state.apiKeySet}
        onConnect={(key) => {
          dispatch({ type: 'SET_API_KEY', payload: key });
          dispatch({ type: 'ADD_TOAST', payload: { type: 'success', message: 'API key connected' } });
        }}
        onClose={() => dispatch({ type: 'TOGGLE_API_MODAL' })}
      />

      <UploadModal
        show={state.showUploadModal}
        onClose={() => dispatch({ type: 'TOGGLE_UPLOAD_MODAL' })}
        dispatch={dispatch}
        uploadedDocs={state.uploadedDocs}
      />

      {/* Toast notifications */}
      <ToastContainer toasts={state.toasts} dispatch={dispatch} />
    </div>
  );
}
