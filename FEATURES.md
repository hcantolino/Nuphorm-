# FEATURES.md — Living Feature Checklist
# NuPhorm Biostatistics Platform
# Verify after every code change

---

## Pages & Navigation

- [ ] Landing page renders (`pages/LandingPage.tsx`)
- [ ] Login page with auth form (`pages/Login.tsx`)
- [ ] Sign-up page (`pages/SignUp.tsx`)
- [ ] Dashboard page (`pages/Dashboard.tsx`)
- [ ] Biostatistics main workspace (`pages/Biostatistics.tsx`)
- [ ] Data Library / uploaded files page (`pages/DataUploaded.tsx`)
- [ ] Saved Technical Files page (`pages/SavedTechnicalFiles.tsx`)
- [ ] Saved Files page (`pages/SavedFiles.tsx`)
- [ ] Regulatory documents page (`pages/Regulatory.tsx`)
- [ ] Regulatory Enhanced page (`pages/RegulatoryEnhanced.tsx`)
- [ ] Profile page (`pages/Profile.tsx`)
- [ ] Profile Settings page (`pages/ProfileSettings.tsx`)
- [ ] Subscription page (`pages/Subscription.tsx`)
- [ ] Admin Feedback page (`pages/AdminFeedback.tsx`)
- [ ] Document Creator page (`pages/DocumentCreator.tsx`)
- [ ] Demo Create page (`pages/DemoCreate.tsx`)
- [ ] New Form page (`pages/NewForm.tsx`)
- [ ] Component Showcase page (`pages/ComponentShowcase.tsx`)
- [ ] 404 Not Found page (`pages/NotFound.tsx`)
- [ ] Home page (`pages/Home.tsx`)

---

## Biostatistics Workspace — Layout & Projects

- [ ] Dark navy sidebar with project list (`biostat/BiostatProjectsSidebar.tsx`)
- [ ] Project switcher in header (`biostat/ChartHeader.tsx → handleSwitchProject`)
- [ ] Create new project (`biostat/ChartHeader.tsx → handleCreateProject`)
- [ ] Delete active project (`biostat/ChartHeader.tsx → handleDeleteActiveProject`)
- [ ] Project tab snapshot save on switch (`stores/tabStore.ts → saveProjectTabSnapshot`)
- [ ] Project tab snapshot restore on switch (`stores/tabStore.ts → loadProjectTabSnapshot`)
- [ ] Project isolation — switching clears all tabs and restores target project's tabs
- [ ] Empty-tab placeholder with BarChart2 icon (`pages/Biostatistics.tsx`)

## Tab Management

- [ ] Add new tab via "+" button (`biostat/TabBar.tsx → addTab`)
- [ ] Switch between tabs (`biostat/TabBar.tsx → setActiveTab`)
- [ ] Close tab via X button (`biostat/TabBar.tsx → closeTab`)
- [ ] Rename tab via double-click (`biostat/TabBar.tsx → renameTab`)
- [ ] Auto-rename tab using AI's `graphTitle` after response arrives — never raw user query (`AIBiostatisticsChatTabIntegrated.tsx ~line 2395`)
- [ ] Tab title strips "Figure N." prefix for brevity, truncates to 35 chars with ellipsis
- [ ] Fallback to `generateTitleFromQuery()` only when AI provides no title (`utils/titleGeneration.ts`)
- [ ] Tab state persisted per-project (`stores/tabStore.ts`)
- [ ] Tab content state management (`stores/tabContentStore.ts`)
- [ ] Per-tab results stored in Zustand (`stores/aiPanelStore.ts → resultsByTab`)
- [ ] Per-tab customizations stored in Zustand (`stores/aiPanelStore.ts → customizationsByTab`)
- [ ] Tab cleanup removes customizations on close (`aiPanelStore.ts → removeTab`)

---

## AI Chat Panel

### Message Handling
- [ ] Send text message to AI (`AIBiostatisticsChatTabIntegrated.tsx → handleSendMessage`)
- [ ] User messages display in blue bubble; assistant in gray
- [ ] Assistant messages render with markdown (code blocks, tables, formatting)
- [ ] Loading dots animation while AI is thinking
- [ ] Empty chat state: Sparkles icon + "Ask me anything about your biostatistics data"
- [ ] Conversation history maintained per tab and auto-saved to localStorage
- [ ] Source names tagged on queries (`metadata.usedSources`)
- [ ] Prompt suggestions displayed as clickable chips (`biostat/PromptSuggestions.tsx`)
- [ ] Clear chat history button (resets conversation memory)
- [ ] Retry button on failed AI responses
- [ ] Relative timestamps on messages ("2 minutes ago")
- [ ] LLM online/offline indicator ("Powered by Claude" or WifiOff banner)
- [ ] Enter to send, Shift+Enter for newline
- [ ] Dynamic textarea height (auto-grows, 80-200px)
- [ ] Context-aware placeholder text (changes in edit mode)
- [ ] "Enter to send" keyboard hint on focus

### Query Augmentation
- [ ] Project instructions prefix in query (`[Project Instructions: ...]`)
- [ ] Dataset summary line (`[Current Dataset: filename, X rows, Y cols]`)
- [ ] Anti-hallucination clause appended when sources present
- [ ] Pasted CSV auto-detected and replaced with clean analysis instruction
- [ ] CSV data fallback chain: component → global store → project source → tab attachment → server fetch

### Dataset Tools
- [ ] Dataset pill showing filename, row count, "Cleaned" badge, X to clear
- [ ] Collapsible Dataset Tools panel with quick actions
- [ ] "Clean Dataset" action (auto-fills smart cleaning prompt)
- [ ] "CDISC" action (auto-fills SDTM standardization prompt)
- [ ] "AE Summary" action (auto-fills adverse events summary prompt)
- [ ] "KM Plot" action (auto-fills Kaplan-Meier plot prompt)
- [ ] "Export Cleaned" action (direct download without chat)

### Data Quality Scan (`biostatisticsAI.ts → scanDataIssues, isCleaningTrigger`)
- [ ] Scan trigger detects "scan my dataset", "data quality issues", etc. (`isCleaningTrigger`)
- [ ] Server-side scan runs without LLM — returns instantly (`scanDataIssues`)
- [ ] ALL issues shown simultaneously in results table (no sequential gating)
- [ ] Duplicate detection via exact row JSON matching
- [ ] Missing value detection (null, undefined, empty, NaN) per column
- [ ] Outlier detection via IQR method with P5/P95 percentiles per numeric column
- [ ] Categorical inconsistency detection (case-insensitive grouping, >30 unique skipped)
- [ ] Each issue shows proposed action and affected items
- [ ] User replies "apply" / "yes" / "proceed" to apply all fixes (`isApplyCleaningSignal`)
- [ ] Apply step runs server-side: removes duplicates, flags outliers/missing as NA, standardizes categoricals
- [ ] Compliance flagging (<80%) and dose reduction flagging
- [ ] CLEAN_FLAG column added to cleaned dataset (CLEAN/IMPUTED/FLAGGED_COMPLIANCE/FLAGGED_DOSE_REDUCTION/EXCLUDED)
- [ ] Audit log as results_table showing every change made
- [ ] "Download Clean Dataset" button appears only after apply step (`analysis_type === "data_cleaning"`)
- [ ] Follow-up questions answered with scan context via LLM (`isContinuingCleaningConversation`)

### File Attachment & Data Loading
- [ ] Upload CSV from computer (`AIBiostatisticsChatTabIntegrated.tsx → handleComputerUpload`)
- [ ] Upload XLSX/XLS from computer with SheetJS parsing
- [ ] Upload PDF with server-side text extraction (`parsePdfMutation`)
- [ ] PDF table extraction — pipe-delimited detection (`AIBiostatisticsChatTabIntegrated.tsx ~line 1668`)
- [ ] PDF table extraction — CSV/TSV fallback (`AIBiostatisticsChatTabIntegrated.tsx ~line 1693`)
- [ ] PDF extracted text stored as preview on tab file
- [ ] Auto-parse CSV text via PapaParse on upload
- [ ] Paste CSV detection and auto-parse (`AIBiostatisticsChatTabIntegrated.tsx → pastedDataDetected`)
- [ ] Attach files from Data Library (`biostat/AttachmentModal.tsx`)
- [ ] Attach files to project scope (shared across tabs)
- [ ] Attach files to tab scope (tab-specific)
- [ ] Dataset pill shows loaded filename and row count
- [ ] Column classification auto-detection (`deriveColumnTypes`)
- [ ] Last-resort CSV fetch from server for attached files (~line 1916)
- [ ] Last-resort PDF fetch from server for attached files (~line 1959)

### Project Context
- [ ] Project instructions text area (`biostat/ProjectContextPanel.tsx → handleInstructionsBlur`)
- [ ] Project source file upload (`ProjectContextPanel.tsx → handleSourceUpload`)
- [ ] Remove project source (`ProjectContextPanel.tsx → removeSource`)
- [ ] Sources panel with check/uncheck selection (`biostat/SourcesPanel.tsx`)
- [ ] Source selection toggles (Select All / Deselect All / Project Only / Tab Only)
- [ ] File preview from sources panel (`SourcesPanel.tsx → FilePreviewModal`)
- [ ] Cleaned Sources section in sources panel (Sparkles icon, row count, "Cleaned" badge)
- [ ] PDF warning modal when sending query with unparsable PDFs (`pdfWarningOpen`)
- [ ] Voice dictation button for speech-to-text input (`VoiceDictationButton.tsx`)

### Attachment Modal (`AttachmentModal.tsx`)
- [ ] Two tabs: "Project-Level Sources" and "Tab: [TabName]"
- [ ] Search bar for real-time source filtering
- [ ] Source rows with file icon, name, size, date, preview eye, remove button
- [ ] Lock icon on sources used in queries (prevents deletion)
- [ ] Delete guard modal with "Deselect Instead" alternative
- [ ] Upload scope selector: project or tab level
- [ ] "Upload from Computer" button (solid blue)
- [ ] "Add from Repository" button (outline blue)
- [ ] Empty states per section with "Add Files" button

### Graph Edit Mode
- [ ] Click chart to select for editing (`aiPanelStore.ts → setSelectedGraph`)
- [ ] Type edit instruction in chat for selected graph
- [ ] Graph edit prefix includes current chart_data JSON for AI context
- [ ] `updatePanelResult` deep-merges edits preserving existing data
- [ ] Validation: compare old vs new chart_data before confirming success
- [ ] Warning toast when AI response doesn't actually change chart_data
- [ ] Quick-action buttons auto-send via `queueGraphEdit` + `pendingEditAction`
- [ ] Clear graph selection (`clearSelectedGraph`)

### Table Edit Mode
- [ ] Table edit requests update existing result in-place
- [ ] Table edit success toast

---

## Results Panel (GraphTablePanel)

### Layout & Navigation
- [ ] Single-panel design — title, query, stats table, chart, interpretation in one scroll
- [ ] "Results — N/M" header with inline prev/next when >1 result
- [ ] Navigate between multiple results (prev/next arrows)
- [ ] Blank state with BarChart2 icon when no results
- [ ] Header buttons: Customize · Save · Export · Clear

### Statistics Table
- [ ] 2-column metric/value table rendering (`GraphTablePanel.tsx`)
- [ ] Multi-column dataset table rendering (headers + rows)
- [ ] Object cell value formatting: `typeof cellValue === 'object'` → "mean (lower, upper)" display (`DataPointsTable.tsx`)
- [ ] Publication-style Statistics Summary title: "Table. [variable] by [group]" — auto-generated from chart metadata (`GraphTablePanel.tsx`)
- [ ] Publication-style Data Points table title via `tableTitle` prop (`DataPointsTable.tsx`)
- [ ] "Source data" label for auto-generated chart data tables (replaces "Chart Source Data")
- [ ] Table zebra striping toggle
- [ ] Table filter input
- [ ] Table sort: Default / A→Z / Z→A / 0→9 / 9→0

### Chart Rendering — Recharts
- [ ] Bar chart (`GraphTablePanel.tsx → ChartRenderer`)
- [ ] Line chart
- [ ] Area chart
- [ ] Scatter chart (requires `{points:[{x,y}]}` format)
- [ ] Pie chart
- [ ] Custom colors from palette/overrides
- [ ] Axis labels, legend position, grid lines, data labels (LabelList)
- [ ] Scatter incompatibility toast warning + bar fallback

### Chart Rendering — Plotly (PlotlyInteractiveChart)
- [ ] Bar chart with grouped barmode (`PlotlyInteractiveChart.tsx ~line 1111`)
- [ ] Line chart with markers (`PlotlyInteractiveChart.tsx ~line 1144`)
- [ ] Scatter chart (`PlotlyInteractiveChart.tsx ~line 1144`)
- [ ] Box plot (`PlotlyInteractiveChart.tsx → buildBoxPlotTraces`)
- [ ] Heatmap (`PlotlyInteractiveChart.tsx → buildHeatmapTraces`)
- [ ] Waterfall chart (`PlotlyInteractiveChart.tsx → buildWaterfallTraces`)
- [ ] Forest plot (`PlotlyInteractiveChart.tsx → buildForestPlotTraces`)
- [ ] Volcano plot (`PlotlyInteractiveChart.tsx → buildVolcanoTraces`)
- [ ] Survival / Kaplan-Meier curve (`PlotlyInteractiveChart.tsx → buildSurvivalTraces`)
- [ ] Violin plot
- [ ] Histogram
- [ ] Bubble chart
- [ ] QQ plot
- [ ] Pareto chart
- [ ] Swimmer plot
- [ ] Funnel chart
- [ ] Auto-detection of Plotly vs Recharts (`isPlotlyChartData()`)
- [ ] `pharma_type` field routing to correct chart builder
- [ ] Adaptive legend/margin sizing (`calculateChartSizing`)
- [ ] Smart X-axis label sizing: auto-angle + auto-font-size based on label count/length (`calculateXAxisLabelConfig`)
- [ ] `automargin: true` on X-axis — Plotly auto-expands bottom margin for angled labels
- [ ] Bottom margin expansion for long/angled labels
- [ ] Auto-detect categorical X-axis: `layout.xaxis.type = 'category'` when X values are strings
- [ ] Research palette for >2 series
- [ ] KM palette for survival charts
- [ ] Marker shapes per series (`MARKER_SHAPES`)
- [ ] Reference/citation annotation below chart

### Chart Interactions
- [ ] Click data point to highlight trace (`PlotlyInteractiveChart.tsx → handlePlotlyClick`)
- [ ] Click-to-edit popover on point click — edit Y value via inline input (`EditableCell`)
- [ ] Click-to-edit popover — per-bar color picker with live update via `applyRestyle()`
- [ ] Click-to-edit popover — significance annotations (*, **, ***, ns) via `applyRelayout()`
- [ ] Click-to-edit popover — delete individual data point from trace
- [ ] Trace highlight: other series fade to 0.35 opacity; reset on close
- [ ] Right-click context menu on chart (`handleContextMenu`)
- [ ] Escape key closes edit popover and resets highlight
- [ ] Outside click closes edit popover
- [ ] Bottom action buttons: Add Labels, Pairwise Table, Percent Improvement, Add Trendline

### Inline Editable Labels (`PlotlyInteractiveChart.tsx → InlineEditableText`)
- [ ] Double-click chart title to edit inline — HTML overlay above Plotly SVG
- [ ] Double-click subtitle to edit inline
- [ ] Double-click X-axis label to edit inline (below chart)
- [ ] Double-click Y-axis label to edit inline (below chart)
- [ ] Hover hint: faint underline + text cursor on editable labels
- [ ] Enter commits edit, Escape reverts, blur commits
- [ ] Empty text revert — blank title not allowed
- [ ] Full text auto-selected on edit activation
- [ ] Edits persist via `onLabelEdit` → `setCustomization()` in Zustand store (`GraphTablePanel.tsx`)
- [ ] Bidirectional sync: inline edits update Customize panel and vice versa
- [ ] Plotly SVG title suppressed — HTML title rendered externally to avoid double-render

### Table Interactions (GraphTablePanel)
- [ ] Click table cell to edit inline (`GraphTablePanel.tsx → EditableCell`)
- [ ] Live chart sync from table edits (`syncedChartData` useMemo)
- [ ] Table filter by substring on metric column
- [ ] Table sort by metric or value (asc/desc)
- [ ] Zebra striping toggle on table rows
- [ ] "Add to Chat" button on chart card — adds chart data JSON to chat input
- [ ] "Add to Chat" button on table card — adds markdown table to chat input
- [ ] "Add to Chat" button on interpretation card — adds analysis text to chat input

### Data Validation (GraphTablePanel)
- [ ] "Validate & Correct" button cross-verifies results against source CSV (`handleValidateAndCorrect`)
- [ ] Corrected value indicator: orange badge + tooltip showing original LLM value
- [ ] Exact match indicator: green "Verified" checkmark badge
- [ ] Validation column in stats table (only shown when validated)
- [ ] Data integrity diff viewer: side-by-side Original vs Generated with Match/Corrected status
- [ ] Retry analysis button dispatches custom event for re-run with stricter validation

### Error Bars — Local Computation Architecture
- [ ] `computeErrorBarsFromRawData()` — computes SD/SE/95%CI from raw uploaded CSV rows (`PlotlyInteractiveChart.tsx`)
- [ ] `tCritical025()` — proper t-distribution critical values for small-sample 95% CI, lookup table df 1-120 (`PlotlyInteractiveChart.tsx`)
- [ ] Local computation OVERWRITES AI-returned error_y — AI signals intent only via `show_error_bars: true`
- [ ] Auto-detect group column by matching xLabels against unique values in each column (70% threshold)
- [ ] Auto-detect value column by matching trace series name to column names
- [ ] Fallback: first categorical column as group, first numeric column as value
- [ ] Error bar type selector in ControlPanel: ±SD / ±SEM / 95% CI (`ControlPanel.tsx → errorBarType`)
- [ ] Changing error bar type recomputes locally — no AI call needed
- [ ] Auto-enable `showErrorBars` when AI sets `show_error_bars: true` or returns error data (`GraphTablePanel.tsx` seeding effect)
- [ ] Auto-seed `errorBarType` from AI's `error_type` field (ci/confidence → ci95, se → se, else sd)
- [ ] AI system prompt updated: "Do NOT compute or return error_y arrays" (`biostatisticsAI.ts`)
- [ ] 10% approximation REMOVED — replaced by local computation from raw data
- [ ] Customization toggle forces error bars on/off
- [ ] Fallback: if local computation fails, keep AI-provided error bars if present
- [ ] `coerceErrorArray()` — handles plain arrays, Plotly objects `{ array: [...] }`, single numbers, case variants
- [ ] Case-insensitive property normalization in `normalizeChartData()` — `SD`/`SEM`/`Error_Y`/`CI_Lower` mapped to canonical names
- [ ] Warning toast when error bars requested but cannot be computed (`onValidationWarning`)
- [ ] Runtime error bar validation in debug useEffect — logs `[ERROR BAR VALIDATION FAILED]` if mismatch

### Box Plot Enforcement
- [ ] User query keyword detection forces `pharma_type: "box"` even if AI omits it (`biostatisticsAI.ts → forcePharmaMap`)
- [ ] Same enforcement for survival, forest, volcano, heatmap, waterfall chart types
- [ ] Box plot response template in system prompt requiring raw individual values (not summary stats)

### Chart Export
- [ ] Export PNG via Plotly.toImage for Plotly charts (`GraphTablePanel.tsx → handleImageExport`)
- [ ] Export JPEG
- [ ] Export JPEG-2000
- [ ] Export TIFF (custom uncompressed TIFF builder `createTiffBlob`)
- [ ] Export PDF via jsPDF
- [ ] Export SVG
- [ ] Export CSV (chart source data as CSV `downloadChartDataAsCSV`)
- [ ] Export statistics table as CSV (`downloadTableAsCSV`)
- [ ] Export statistics table as TXT (`downloadTableAsTxt`)
- [ ] Copy chart to clipboard (`handleCopy → Plotly.toImage` for Plotly, `html-to-image` fallback)
- [ ] Fallback: html-to-image for Recharts charts
- [ ] Clean export ref — hidden off-screen render for publication-quality (Recharts only)
- [ ] `data-export-btn` exclusion filter during capture
- [ ] Chart error boundary with fallback UI + "Retry" / "View as table" buttons (`ChartErrorBoundary`)
- [ ] Auto-chart from table: when no LLM chart_data but ≥2 numeric rows, synthesize bar chart with "Live" badge
- [ ] Chart fallback warning: amber alert when viz requested but only table returned
- [ ] Blocked analysis alert: red warning when subject mismatch detected (no fabricated data)

### Plotly Toolbar
- [ ] `displayModeBar: false` — entire Plotly toolbar hidden (custom export/controls used instead)
- [ ] `displaylogo: false` — Plotly logo hidden

---

## Customization Panel (CustomizeSidebar + ControlPanel)

### Chart Type Section
- [ ] Chart type buttons: bar, line, area, scatter, pie (`ControlPanel.tsx`)
- [ ] Corner Radius slider (`onSet("barBorderRadius", v)` → `marker.cornerradius`)
- [ ] Bar Gap slider (`onSet("barGap", v)` → `layout.bargap`)

### Colors Section
- [ ] 5 preset palettes: finbox, viridis, pastel, highContrast, publication (`ControlPanel.tsx`)
- [ ] Per-series color picker overrides (`<input type="color">`)

### Axes Section
- [ ] X-Axis Min / Max inputs → `layout.xaxis.range`
- [ ] Y-Axis Min / Max inputs → `layout.yaxis.range`
- [ ] X-Axis Step Size → `layout.xaxis.dtick`
- [ ] Y-Axis Step Size → `layout.yaxis.dtick`
- [ ] X-Axis Label Rotation → `layout.xaxis.tickangle`
- [ ] X-Axis Unit/Label → `layout.xaxis.title.text`
- [ ] Y-Axis Unit/Label → `layout.yaxis.title.text`
- [ ] Y-Axis Log Scale toggle → `layout.yaxis.type: 'log'`
- [ ] X-Axis Log Scale toggle → `layout.xaxis.type: 'log'`

### Titles & Labels Section
- [ ] Chart Title input → `layout.title.text`
- [ ] Subtitle input → annotation at top

### Grid & Background Section
- [ ] Background Color picker → `plot_bgcolor` + `paper_bgcolor`
- [ ] Show Grid Lines toggle → `xaxis.showgrid` + `yaxis.showgrid`
- [ ] Grid Color picker → `xaxis.gridcolor` + `yaxis.gridcolor`
- [ ] Grid Style buttons: Solid/Dashed/Dotted → `xaxis.griddash` + `yaxis.griddash`
- [ ] Show Chart Border toggle → `xaxis.showline` + `yaxis.showline` + `mirror`
- [ ] Border Color picker → `xaxis.linecolor` + `yaxis.linecolor`
- [ ] Show Minor Ticks toggle → `xaxis.minor.ticks`

### Legend Section
- [ ] Legend Position selector (Top/Bottom/Left/Right/None + corners)
- [ ] Legend Anchor (fine-grained: top-right, outside-right, etc.)
- [ ] Show Legend Border toggle → `legend.borderwidth`
- [ ] Legend Background color → `legend.bgcolor`
- [ ] Legend Font Size → `legend.font.size`

### Series / Lines / Bars Section (CustomizeSidebar)
- [ ] Per-series color picker
- [ ] Per-series line style dropdown (solid, dashed, dotted, dashdot)
- [ ] Per-series line width slider
- [ ] Per-series marker shape dropdown
- [ ] Per-series marker size slider
- [ ] Per-series show error bars toggle
- [ ] Per-series visible toggle

### Data Values Section
- [ ] Show Values toggle → `trace.text` + `trace.textposition`
- [ ] Value position (above/below/inside)
- [ ] Value font size
- [ ] Data label format
- [ ] Data label decimal places

### Other Controls
- [ ] Stroke Width slider (global line width)
- [ ] Marker Size slider (global marker size)
- [ ] Fill Opacity slider (area charts)
- [ ] Chart Theme: Light/Dark
- [ ] Show Data Labels toggle (`ControlPanel.tsx`)
- [ ] Table filter input (`ControlPanel.tsx`)
- [ ] Table sort options: Default/A→Z/Z→A/0→9/9→0 (`ControlPanel.tsx`)
- [ ] Zebra Striping toggle for tables (`ControlPanel.tsx`)

---

## Save & Persistence

### Save Analysis Modal (`SaveAnalysisModal.tsx`)
- [ ] Auto-generated filename from tab name + graph title + date
- [ ] Editable filename input
- [ ] Format selector: CSV, XLSX, PDF, PNG, JSON, SAS, DTA
- [ ] CSV export — metrics + values, AI interpretation as comments
- [ ] XLSX export — multi-sheet workbook (metadata sheet + one per result)
- [ ] PDF export — teal-branded, chart images + stats table + interpretation per result
- [ ] JSON export — structured with title, folder, tags, results array
- [ ] SAS/DTA export — uppercase column names, alphanumeric-safe metric names
- [ ] PNG export — captures chart from DOM at 2x retina resolution
- [ ] Tag management — dropdown with existing tags, add new tags, remove tags
- [ ] Folder selection — choose existing folder or create new
- [ ] Subfolder auto-creation (Graphs/, Tables/, Queries/ when >2 items)
- [ ] Tab selection — expand/collapse tabs, select individual graphs/tables/queries
- [ ] "Include All Tabs" master select button
- [ ] Per-tab "Select All" button
- [ ] Selection counter showing "X graphs, Y tables, Z queries"
- [ ] Include metadata toggle (study context, analysis type, row count)
- [ ] Chart DOM capture via html-to-image (`captureChartAsPNG`)
- [ ] Draggable + resizable modal panel
- [ ] Generating spinner during save process

### Other Persistence
- [ ] Project state save to server (`server/routers.ts → saveProjectState`)
- [ ] Project state load from server (`server/routers.ts → loadProjectState`)
- [ ] Tab persistence via localStorage

---

## Data Library (DataUploaded Page)

### File Management
- [ ] Upload files via modal (`pages/DataUploaded.tsx → UploadModal`)
- [ ] File list with pagination (`trpc.files.list`)
- [ ] File preview modal with content fetch (`FilePreviewModal.tsx`)
- [ ] Preview loading spinner while fetching content
- [ ] File preview: CSV table view with sortable columns
- [ ] File preview: chart view with auto-detected chart data
- [ ] File preview: raw text view with search highlighting
- [ ] File preview: search within content (Cmd+F style)
- [ ] File preview: download button
- [ ] File delete (single and bulk) (`trpc.files.delete`)
- [ ] File update metadata (`trpc.files.update`)
- [ ] Bulk move files to folder (`trpc.files.bulkMove`)
- [ ] Context menu (right-click) on files: Preview, Delete, etc.
- [ ] Folder management: create folders
- [ ] Tag management: create/assign tags
- [ ] Filter by folder, tag, format
- [ ] Sample datasets shown when no real files exist
- [ ] Technical files merged into dataset list

### File Preview Modal (FilePreviewModal.tsx)
- [ ] Resolves content from `file.content`, mock data fallback, or partial filename match
- [ ] CSV parsing with `parseCSV` for table view
- [ ] Column analysis: numeric vs categorical detection
- [ ] Chart auto-generation from CSV data (bar + line charts)
- [ ] View tabs: Table / Chart / Raw
- [ ] Search within file content with highlight
- [ ] Match count display for search
- [ ] Download file as text blob
- [ ] Error state with message
- [ ] Loading state (spinner overlay)

---

## Server API (tRPC Endpoints)

### Auth (`auth` router)
- [ ] `me` — get current user
- [ ] `logout` — clear session

### Subscription (`subscription` router)
- [ ] Subscription management endpoints

### Analytics (`analytics` router)
- [ ] Analytics tracking endpoints

### Technical Files (`technical` router)
- [ ] `saveReport` — save analysis report
- [ ] `getFiles` — list technical files
- [ ] `getFile` — get single technical file
- [ ] `deleteFile` — delete technical file
- [ ] `updateFile` — update file metadata
- [ ] `createFolder` — create folder

### Files (`files` router)
- [ ] `list` — paginated file list with metadata mapping
- [ ] `upload` — upload file (base64 → disk + metadata)
- [ ] `getFileContent` — fetch file content (CSV text, PDF extraction, image URL)
- [ ] `update` — update file metadata (tags, folder, description)
- [ ] `bulkMove` — move multiple files to folder
- [ ] `delete` — bulk delete files
- [ ] `parsePdf` — extract text from PDF via pdf-parse

### Feedback (`feedback` router)
- [ ] Feedback submission endpoints

### Regulatory (`regulatory` router)
- [ ] `generateRegulatoryDoc` — generate regulatory document
- [ ] Template management (CRUD)
- [ ] `saveProjectState` — persist project state
- [ ] `loadProjectState` — restore project state

### Biostatistics (`biostatistics` router)
- [ ] `analyzeBiostatisticsData` — main AI analysis endpoint
- [ ] `parseDataFile` — parse uploaded data files
- [ ] `validateAndCorrect` — data validation/cleaning

### Subscription (`subscription` router)
- [ ] `getStatus` — fetch subscription status (active/trial/canceled/free)
- [ ] `createCheckout` — initialize Stripe checkout session
- [ ] `useTrial` — activate 1-use trial
- [ ] `cancel` — cancel active subscription

### Analytics (`analytics` router)
- [ ] `getUsageStats` — track uploaded file count/size per user
- [ ] `getStorageUsage` — get storage breakdown by category
- [ ] `logGeneration` — log analysis generation events

### Job / Async Processing
- [ ] `job.submitJob` — queue async analysis job
- [ ] `job.getJobStatus` — poll job completion status
- [ ] `job.getJobResult` — retrieve completed job results
- [ ] `job.cancelJob` — cancel queued/running job
- [ ] `job.getUserJobs` — list user's jobs
- [ ] `job.getQueueStats` — get queue statistics

### Document Generation
- [ ] `documentGeneration.generateFromChat` — generate documents from chat context
- [ ] `documentGeneration.generateWithContext` — generate with additional context
- [ ] `documentGeneration.listTemplates` — fetch available document templates

### Regression Analysis
- [ ] `regression.fitModel` — fit linear/polynomial/logistic regression
- [ ] `regression.predictValues` — make predictions using fitted model
- [ ] `regression.getModelSummary` — get R², coefficients, diagnostics
- [ ] `regression.validateModel` — cross-validation and residual analysis

### Machine Learning
- [ ] `ml.clusterData` — K-means clustering
- [ ] `ml.performPCA` — principal component analysis
- [ ] `ml.classifyData` — classification model training
- [ ] `ml.predictMl` — make ML predictions

### Pharma / Clinical
- [ ] `pharma.generateSurvivalCurve` — Kaplan-Meier survival analysis
- [ ] `pharma.generateForestPlot` — forest plot for effect sizes
- [ ] `pharma.generateVolcanoPlot` — volcano plot for DE analysis
- [ ] `pharma.generateHeatmap` — gene expression heatmap
- [ ] `pharma.generateWaterfallPlot` — waterfall plot for response rates
- [ ] `pharma.generateBoxPlot` — box plot visualization
- [ ] `pharma.validatePharmaData` — validate pharma dataset format

---

## AI Analysis Backend (biostatisticsAI.ts)

### Supported Analysis Types
- [ ] Descriptive statistics (mean, SD, SEM, CI, quartiles)
- [ ] Two-sample t-test
- [ ] ANOVA / one-way ANOVA
- [ ] Chi-square test
- [ ] Linear regression
- [ ] Correlation analysis
- [ ] Survival analysis (Kaplan-Meier)
- [ ] Dose-response analysis
- [ ] PK parameter analysis (Cmax, AUC, Tmax, etc.)
- [ ] Bioequivalence assessment
- [ ] Data cleaning / validation

### Data Handling
- [ ] CSV/TSV/TXT/XLSX data accepted
- [ ] PDF text extraction and table parsing
- [ ] Full data injection into LLM prompt as CSV block
- [ ] Data preview fallback when full data unavailable
- [ ] Column classification context sent to LLM
- [ ] Missing value detection (NA, BQL, -999, empty)
- [ ] Subject ID enumeration guardrail
- [ ] Anti-hallucination clause for data integrity
- [ ] Markdown table extraction from AI response (`parseMarkdownTableToResults`)
- [ ] `pharma_type` stamping on chart_data based on `detectAnalysisType`
- [ ] Visualization instruction injection for chart-generating queries

### System Prompt Features
- [ ] Mandatory chart fields enforcement (title, x_label, y_label)
- [ ] Error bar instructions (SD/SEM/CI format)
- [ ] Column selection rules (skip IDs, dates; analyze efficacy, PK, labs)
- [ ] Chart type rules per analysis type
- [ ] PDF data handling instructions
- [ ] Graph edit mode instructions with error bar format
- [ ] Figure title format: "Figure N. [description]" — never includes chart type, sentence case (`biostatisticsAI.ts → GRAPHTITLE RULES`)
- [ ] Figure legend instructions: returned in `chart_data.reference` field with error bar type, statistical test, significance definitions, sample sizes
- [ ] Biostatistics Handbook knowledge base — statistical test decision tree, graph type selection rules, publication-quality graph guidelines (McDonald 2014)
- [ ] X-axis label abbreviation instructions for long category names

### Response Parsing & Validation
- [ ] Markdown fence stripping: `/```(?:json)?\s*([\s\S]*?)```/i` (`biostatisticsAI.ts ~line 3887`)
- [ ] Leading/trailing text stripping before/after JSON braces
- [ ] Recovery A: repair trailing commas, control chars, unescaped newlines (`biostatisticsAI.ts ~line 3922`)
- [ ] Recovery B: brace-balanced extraction — longest matched `{...}` substring (`biostatisticsAI.ts ~line 3929`)
- [ ] Recovery C: markdown table fallback via `parseMarkdownTableToResults()` (`biostatisticsAI.ts ~line 3949`)
- [ ] Case B recovery: build chart_data from numeric results_table rows instead of blocking (`biostatisticsAI.ts ~line 4310`)
- [ ] Case C recovery: extract markdown table from analysis text before blocking (`biostatisticsAI.ts ~line 4318`)
- [ ] Soft "Note" rows instead of hard "Error" blocks for recoverable failures
- [ ] Amber warning card for "Note" metric rows (`GraphTablePanel.tsx`)
- [ ] Red error card for "Error" metric rows — subject mismatch vs generic (`GraphTablePanel.tsx`)
- [ ] Subject fabrication detection and blocking (`biostatisticsAI.ts ~line 4105`)
- [ ] Hallucinated group filtering from results_table (`biostatisticsAI.ts ~line 4321`)
- [ ] AJV schema validation with coercion fallback (`biostatisticsAI.ts ~line 4048`)

---

## Zustand Stores

### aiPanelStore.ts
- [ ] Per-tab results storage (`resultsByTab`)
- [ ] Per-tab customizations (`customizationsByTab`)
- [ ] Active result tracking per tab (`activeResultIdByTab`)
- [ ] `setPanelResult` — add new result to tab
- [ ] `updatePanelResult` — deep-merge edit patch into existing result
- [ ] `setCustomization` — set single customization key
- [ ] `resetCustomizations` — reset to defaults
- [ ] `getTabCustomizations` — get customizations for tab
- [ ] `removeTab` — cleanup results + customizations
- [ ] `selectedGraphId` / `setSelectedGraph` / `clearSelectedGraph` — graph edit selection
- [ ] `queueGraphEdit` / `consumePendingEdit` — deferred graph edit actions

### tabStore.ts
- [ ] Tab CRUD: `addTab`, `closeTab`, `setActiveTab`, `renameTab`
- [ ] `clearAllTabs` — empties to `[]`/`null` (no default tab)
- [ ] `closeAllTabs` — closes all but creates one default tab
- [ ] Tab reordering
- [ ] `saveProjectTabSnapshot` / `loadProjectTabSnapshot` / `deleteProjectTabSnapshot`

### projectStore.ts
- [ ] Project CRUD: create, delete, set active
- [ ] Per-project settings: instructions, sources
- [ ] `addProjectSource` / `removeProjectSource`
- [ ] Source selection state

### currentDatasetStore.ts
- [ ] Global current dataset state (filename, rowCount, columns, rows, cleaned)
- [ ] `setCurrentDataset` / `clearCurrentDataset`

### chartStore.ts
- [ ] Chart configuration state

### chartSettingsStore.ts
- [ ] Chart settings state

### biostatStore.ts / biostatisticsStore.ts
- [ ] Biostatistics state management

### measurementTriggerStore.ts
- [ ] Measurement trigger state

### regulatoryStore.ts
- [ ] Regulatory state management

### datasetStore.ts
- [ ] Dataset management state

---

## Other Biostat Components

- [ ] Voice dictation button (`biostat/VoiceDictationButton.tsx`)
- [ ] Feedback modal (`biostat/FeedbackModal.tsx`)
- [ ] Global settings modal (`biostat/GlobalSettingsModal.tsx`)
- [ ] Data filter panel (`biostat/DataFilterPanel.tsx`)
- [ ] Data preview table (`biostat/DataPreviewTable.tsx`)
- [ ] Data management panel (`biostat/DataManagementPanel.tsx`)
- [ ] Data files modal (`biostat/DataFilesModal.tsx`)
- [ ] File selection modal (`biostat/FileSelectionModal.tsx`)
- [ ] Export modal (`biostat/ExportModal.tsx`)
- [ ] Command bar (`biostat/CommandBar.tsx`)
- [ ] Compliance mode panel (`biostat/ComplianceModePanel.tsx`)
- [ ] Chart preset manager (`biostat/ChartPresetManager.tsx`)
- [ ] Chart color picker (`biostat/ChartColorPicker.tsx`)
- [ ] Chart settings bar (`biostat/ChartSettingsBar.tsx`)
- [ ] Chart toolbar (`biostat/ChartToolbar.tsx`)
- [ ] Unified chart toolbar (`biostat/UnifiedChartToolbar.tsx`)
- [ ] Chart area (`biostat/ChartArea.tsx`)
- [ ] Dynamic chart renderer (`biostat/DynamicChartRenderer.tsx`)
- [ ] Premium chart renderer (`biostat/PremiumChartRenderer.tsx`)
- [ ] Pharma chart panel (`biostat/PharmaChartPanel.tsx`) ⚠️ File exists but no longer rendered by GraphTablePanel
- [ ] Analysis results display (`biostat/AnalysisResultsDisplay.tsx`)
- [ ] Stats results display (`biostat/StatsResultsDisplay.tsx`)
- [ ] Results table (`biostat/ResultsTable.tsx`)
- [ ] Data table (`biostat/DataTable.tsx`)
- [ ] Table data display (`biostat/TableDataDisplay.tsx`)
- [ ] Data points table (`biostat/DataPointsTable.tsx`)
- [ ] Report preview (`biostat/ReportPreview.tsx`)
- [ ] Regression model display (`biostat/RegressionModelDisplay.tsx`)
- [ ] Gene expression chart (`biostat/GeneExpressionChart.tsx`)
- [ ] Gene expression results table (`biostat/GeneExpressionResultsTable.tsx`)
- [ ] Measurement tooltip (`biostat/MeasurementTooltip.tsx`)
- [ ] Biostatistics measurements panel (`biostat/BiostatisticsMeasurementsPanel.tsx`)
- [ ] Biostatistics measurements with AI (`biostat/BiostatisticsMeasurementsWithAI.tsx`)
- [ ] Biostatistics compute (`biostat/BiostatisticsCompute.tsx`)
- [ ] Smart data upload (`biostat/SmartDataUpload.tsx`)
- [ ] Upload section (`biostat/UploadSection.tsx`)
- [ ] Data upload AI (`biostat/DataUploadAI.tsx`)
- [ ] Multi-view panel (`biostat/MultiViewPanel.tsx`)
- [ ] Async analysis UI (`biostat/AsyncAnalysisUI.tsx`)
- [ ] Unified dataset manager (`biostat/UnifiedDatasetManager.tsx`)
- [ ] Sidebar (`biostat/Sidebar.tsx`)
- [ ] Draggable tab bar (`biostat/TabBarDraggable.tsx`)
- [ ] Tab content (`biostat/TabContent.tsx`)
- [ ] AI biostatistics chat (non-integrated) (`biostat/AIBiostatisticsChat.tsx`)
- [ ] Biostatistics chat (non-integrated) (`biostat/BiostatisticsChat.tsx`)

---

## Server Infrastructure

### Storage (`server/storage.ts`)
- [ ] Local file storage to `uploads/` directory
- [ ] `storagePut` — write file to disk
- [ ] `storageGet` — read file URL from disk
- [ ] Auto-create uploads directory on startup

### Database (`server/db.ts`)
- [ ] Local JSON metadata store (`uploads/.metadata.json`) — no-DB fallback
- [ ] Drizzle ORM with MySQL support when `DATABASE_URL` is set
- [ ] `getUserUploadedFiles` — list user's files
- [ ] `logUploadedFile` — record new upload
- [ ] `deleteUploadedFile` — remove file record
- [ ] `updateStorageUsage` — track storage metrics
- [ ] Technical files JSON store (`uploads/.technical-files.json`)

### Express Server (`server/_core/index.ts`)
- [ ] tRPC middleware at `/api/trpc` with superjson transformer
- [ ] Static file serving for uploads
- [ ] Session/auth context creation

---

## Project Persistence & Isolation

- [ ] Tab snapshots saved per `projectId` in localStorage (`nuphorm-proj-tabs-{projectId}`)
- [ ] Project switch: clears all tabs → loads saved snapshot for target project
- [ ] Per-tab content isolated: chat, files, chart config, analysis results
- [ ] Per-tab attached files in localStorage (`biostat-tab-files-{tabId}`)
- [ ] Source selection per tab (`biostat-source-sel-{tabId}`)
- [ ] Project settings (instructions + sources) in localStorage (`nuphorm-project-settings`)

## Supported Data Formats

- [ ] CSV — pipe/comma/tab-delimited, auto-detected separator
- [ ] XLSX / XLS — Excel via SheetJS parsing
- [ ] PDF — server-side text extraction via pdf-parse
- [ ] JSON — direct parsing
- [ ] TSV / TXT — tab-delimited text files

## Chart Data Structures Accepted

- [ ] `{ labels: [...], datasets: [{ label, data, error_y }] }` — standard format
- [ ] `{ series: [{ name, x, y }] }` — series format
- [ ] `{ x: [...], y: [...] }` — direct XY arrays
- [ ] `{ data: [{ category, value, ci_lower, ci_upper }] }` — object array with CI
- [ ] `pharma_type` field routing: survival, box, heatmap, waterfall, forest, volcano
- [ ] `z` matrix + `x`/`y` labels for heatmaps
- [ ] `chart_mode` / `type` field fallback detection

---

## Verification Instructions

After any code change, run through every checkbox in the section(s)
affected by the modified file(s). If a feature is broken, revert
immediately.

### Quick reference: file → sections to verify

| Modified File | Verify These Sections |
|---|---|
| `PlotlyInteractiveChart.tsx` | Chart Rendering — Plotly, Chart Interactions, Error Bars, Plotly Toolbar |
| `GraphTablePanel.tsx` | Results Panel, Chart Export, Statistics Table |
| `CustomizeSidebar.tsx` | Customization Panel (all sub-sections) |
| `ControlPanel.tsx` | Customization Panel (Chart Type, Colors, Axes, Table controls) |
| `AIBiostatisticsChatTabIntegrated.tsx` | AI Chat Panel (all sub-sections), Graph Edit Mode |
| `aiPanelStore.ts` | Zustand Stores → aiPanelStore, Tab Management |
| `tabStore.ts` | Tab Management, Zustand Stores → tabStore |
| `projectStore.ts` | Biostatistics Workspace — Layout & Projects |
| `routers.ts` | Server API (all sub-sections) |
| `biostatisticsAI.ts` | AI Analysis Backend (all sub-sections) |
| `DataUploaded.tsx` | Data Library (all sub-sections) |
| `FilePreviewModal.tsx` | File Preview Modal |
| `SaveAnalysisModal.tsx` | Save & Persistence |
| `AttachmentModal.tsx` | File Attachment & Data Loading |
| `SourcesPanel.tsx` | Project Context |
| `ProjectContextPanel.tsx` | Project Context |
| `ChartHeader.tsx` | Biostatistics Workspace — Layout & Projects |
| `TabBar.tsx` | Tab Management |

### How to verify
1. Identify which file(s) were modified
2. Look up the corresponding sections in the table above
3. Manually test every checkbox in those sections
4. If any feature fails, revert the change and investigate
