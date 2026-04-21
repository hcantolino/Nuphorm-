# FEATURES.md — Living Feature Checklist
# NuPhorm Biostatistics Platform
#
# VERIFY AFTER EVERY CODE CHANGE
#
# Before modifying any file, check which features that file implements.
# After your changes, confirm every affected feature still works.
# If a feature breaks, REVERT and try again.
#
# CRITICAL PROTECTED FEATURES (never remove):
# - Bar click popover with significance buttons (*, **, ***, ns)
# - Error bar local computation from raw data (computeErrorBarsFromRawData)
# - Plotly routing for error-bar-enabled bar charts (isPlotlyChartData)
# - All customization panel controls (colors, axes, data labels, legend, grid)
# - Figure numbering and legend generation
# - Inline editable chart title, subtitle, and axis labels

---

## Pages & Navigation

- [ ] Landing page renders (`pages/LandingPage.tsx`)
- [ ] Login page with auth form (`pages/Login.tsx`)
- [ ] Sign-up page (`pages/SignUp.tsx`)
- [ ] Dashboard page (`pages/Dashboard.tsx`)
- [ ] Biostatistics main workspace (`pages/Biostatistics.tsx`)
- [ ] Data Library / uploaded files page (`pages/DataUploaded.tsx`)
- [ ] Saved Technical Files page (`pages/SavedTechnicalFiles.tsx`)
- [ ] Technical Files: Project → Tab → Files hierarchy with breadcrumbs (`SavedTechnicalFiles.tsx → parseTitleParts`)
- [ ] Technical Files: breadcrumb navigation "Technical Files > ProjectName" with clickable segments
- [ ] Technical Files: tab subfolders inside each project with expand/collapse
- [ ] Technical Files: delete tab folder with warning "Delete [TabName] and all [N] files?"
- [ ] Technical Files: empty state "No saved files yet..." for projects view
- [ ] Technical Files: "All Files" view shows path subtitle "ProjectName / TabName" below filename
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
- [ ] Auto-rename tab using AI's `graphTitle` after first response — never raw user query (`AIBiostatisticsChatTabIntegrated.tsx ~line 2534`)
- [ ] `shortenChartTitle()` strips "Figure/Table N." prefixes, removes filler words, replaces long terms (Kaplan-Meier→KM, confidence intervals→CI), caps at 35 chars (`AIBiostatisticsChatTabIntegrated.tsx`)
- [ ] Only renames once — on first result when tab has default "Analysis ..." name
- [ ] 4-strategy tab naming: (1) AI chart title, (2) first heading/bold from analysis, (3) filename title-cased, (4) `generateTitleFromQuery()` with ≥2 word validation
- [ ] Single-word tab names rejected — must be ≥5 chars and ≥2 words to pass validation
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
- [ ] Upload XLSX/XLS from computer with robust SheetJS parsing: auto-detect header row, unmerge cells, handle title rows, fill empty headers (`AIBiostatisticsChatTabIntegrated.tsx → parseXLSXFile`)
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
- [x] Per-message attachment scoping: after sending, only most recent tab file stays selected (`handleSendMessage → finally` block)
- [x] New upload auto-selects ONLY that file, deselects all project sources + previous tab files (`handleComputerUpload → setSourceSelection`)
- [x] Project sources deselected by default on new tabs (`sourceSelection` restore effect)
- [x] Raw JSON never shown in chat — `extractMessage()` guard on all response paths (`AIBiostatisticsChatTabIntegrated.tsx`)

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

### Follow-up Query Merging (`AIBiostatisticsChatTabIntegrated.tsx`)
- [x] Two-layer detection: AI null-signals (chart_data/results_table = null) + client keyword regex
- [x] Table-only edits preserve existing chart_data via `updatePanelResult` merge (`AIBiostatisticsChatTabIntegrated.tsx`)
- [x] Chart-only edits preserve existing results_table via `updatePanelResult` merge
- [x] Mixed or new-analysis queries create fresh result via `setPanelResult`
- [x] AI follow-up reasoning framework: 4-step process (identify artifact → set null for preserved → announce) (`biostatisticsAI.ts → buildSystemPrompt`)
- [x] Signal keywords in prompt: table-edit, chart-edit, re-analysis categories

---

## Results Panel (GraphTablePanel)

### Layout & Navigation
- [ ] Single-panel design — title, stats table, chart, interpretation in one scroll (query caption removed — redundant with chat history)
- [ ] "Results — N/M" header with inline prev/next when >1 result
- [ ] Navigate between multiple results (prev/next arrows)
- [ ] Blank state with BarChart2 icon when no results
- [ ] Header buttons: Customize · Save · Export · Clear

### Statistics Table
- [ ] 2-column metric/value table rendering (`GraphTablePanel.tsx`)
- [ ] Multi-column dataset table rendering (headers + rows)
- [ ] Object cell value formatting: `typeof cellValue === 'object'` → "mean (lower, upper)" display (`DataPointsTable.tsx`)
- [ ] Publication-style Statistics Summary title: "Table. [variable] by [group]" — auto-generated from chart metadata (`GraphTablePanel.tsx`)
- [x] DataPointsTable (editable chart data mini table) HIDDEN — redundant with AI statistics table; per-bar editing via click popup (`GraphTablePanel.tsx`)
- [ ] "Source data" label for auto-generated chart data tables — fallback only when `isNoteOnlyTable` (replaces "Chart Source Data")
- [ ] Table zebra striping toggle
- [ ] Table filter input
- [ ] Table sort: Default / A→Z / Z→A / 0→9 / 9→0

### Chart Rendering — Recharts
- [ ] Bar chart (`GraphTablePanel.tsx → ChartRenderer`)
- [ ] Line chart
- [ ] Area chart
- [x] Scatter chart — auto-normalizes all AI formats (points, datasets[{x,y}], labels+datasets) to `{points:[{x,y}]}` (`GraphTablePanel.tsx → ChartRenderer`)
- [x] Scatter chart — wider margins (left: 60+, bottom: 50+), YAxis width: 65px, clean tick formatting (integers vs 2dp), padding on XAxis (`GraphTablePanel.tsx → scatterMargin`)
- [x] Scatter chart guardrail — forces sensible margin defaults if AI omits them (`GraphTablePanel.tsx → ChartRenderer`)
- [ ] Pie chart
- [ ] Custom colors from palette/overrides
- [ ] Axis labels, legend position, grid lines, data labels (LabelList)
- [x] Single-dataset bar chart legend hidden — redundant when X-axis labels show groups (`GraphTablePanel.tsx → ChartRenderer`, `datasetKeys.length > 1`)
- [x] Chart title centered: `text-align: center`, `font-size: 14px`, `font-weight: 600` (`GraphTablePanel.tsx → h3 style`)
- [x] Note caption restyled: 11px, gray-500, italic, 8px/16px padding, word-wrap (`GraphTablePanel.tsx → isNoteOnlyTable`)
- [x] Publication-quality bar sizing: `barSize` 80px for ≤4 bars, 60px for ≤8, `barCategoryGap="30%"` (`GraphTablePanel.tsx → ChartRenderer`)
- [x] Extra top margin (24px) when data labels shown to prevent clipping (`GraphTablePanel.tsx → ChartRenderer → barMargin`)
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
- [ ] Violin plot (`PlotlyInteractiveChart.tsx → buildViolinTraces`) — box inside, mean line, outlier points
- [ ] Dot plot / strip chart (`PlotlyInteractiveChart.tsx → buildDotPlotTraces`) — jittered individual points per group
- [ ] Dose-response curve (`PlotlyInteractiveChart.tsx → buildDoseResponseTraces`) — fitted curve + raw data + EC50 annotation
- [ ] ROC curve (`PlotlyInteractiveChart.tsx → buildROCTraces`) — diagonal reference, AUC label, optimal threshold point
- [ ] Bland-Altman plot (`PlotlyInteractiveChart.tsx → buildBlandAltmanTraces`) — bias line, ±1.96 SD limits of agreement
- [ ] Before-After / paired line plot (`PlotlyInteractiveChart.tsx → buildPairedLineTraces`) — individual subject lines + mean
- [ ] Histogram
- [ ] Bubble chart
- [ ] QQ plot
- [ ] Pareto chart
- [ ] Swimmer plot
- [ ] Funnel chart
- [ ] Auto-detection of Plotly vs Recharts (`isPlotlyChartData()` + `shouldUsePlotly()`)
- [x] Scatter plots always routed to Plotly via `shouldUsePlotly()` (`GraphTablePanel.tsx`)
- [x] `libraryPreference: "plotly"` field in chart_data forces Plotly routing
- [x] `mergeFollowUpResult()` preserves existing chart/table when follow-up only modifies one section (`GraphTablePanel.tsx`)
- [x] `sanitizeChartLabels()` suppresses misleading charts with summary-stat labels (Mean, SD, etc.) (`GraphTablePanel.tsx`)
- [x] Framework 10 system prompt strengthened: Plotly default for scatter/analytical, automargin, clean tickformat, self-check mandatory
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
- [x] Bar click popover — clicking any bar opens inline editor with: Y value input, color picker with hex, significance buttons (*, **, ***, ns), delete point, trace name and x-axis category display (`PlotlyInteractiveChart.tsx → handlePlotlyClick + editPopover`)
- [x] Click data point to highlight trace (`PlotlyInteractiveChart.tsx → handlePlotlyClick`)
- [x] Click-to-edit popover — edit Y value via draft state (persisted on Apply/close)
- [x] Click-to-edit popover — per-bar color picker (persisted via barCustomizations layer)
- [x] Click-to-edit popover — significance toggle (*, **, ***, ns) stored in barCustomizations, rendered as Plotly annotations
- [x] Click-to-edit popover — delete individual data point (sets `hidden: true` in barCustomizations)
- [x] Click-to-edit popover — "Apply Changes" button persists draft edits to store (`PlotlyInteractiveChart.tsx → applyPopoverEdits`)
- [x] Bar customizations persistence — `barCustomizations` layer in `aiPanelStore.ts → TabCustomizations` merged at render time in `plotData` useMemo, never mutates original AI chart_data (`PlotlyInteractiveChart.tsx ~line 2853`)
- [x] Bar customizations survive re-renders — stored in Zustand per-result customization key (`GraphTablePanel.tsx → onBarCustomizationsChange`)
- [x] "Reset chart edits" link — clears barCustomizations to restore original AI output (`GraphTablePanel.tsx`)
- [x] Popover loads existing customizations on open — pre-fills value/color/significance from stored barCustomizations
- [x] Enter key in value input applies and closes popover
- [x] Trace highlight: other series fade to 0.35 opacity; reset on close
- [x] Right-click context menu on chart (`handleContextMenu`)
- [x] Escape key closes edit popover (applies pending edits) and resets highlight
- [x] Outside click closes edit popover (applies pending edits)
- [x] Data labels on hover — hovering a bar shows value and trace name (`PlotlyInteractiveChart.tsx → hovertemplate`)
- [x] Bottom action buttons removed — chart edit via chat input only (green "Graph selected" bar). Dead `ActionButton` component cleaned up.

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
- [x] Error bars render on bar charts via Plotly routing (`PlotlyInteractiveChart.tsx → isPlotlyChartData` returns true when `show_error_bars` is set)
- [x] Error bars computed locally from raw uploaded data using ±SD (`PlotlyInteractiveChart.tsx → computeErrorBarsFromRawData`)
- [x] `computeErrorBarsFromRawData()` — computes SD/SE/95%CI from raw uploaded CSV rows (`PlotlyInteractiveChart.tsx`)
- [x] `tCritical025()` — proper t-distribution critical values for small-sample 95% CI, lookup table df 1-120 (`PlotlyInteractiveChart.tsx`)
- [x] Local computation OVERWRITES AI-returned error_y — AI signals intent only via `show_error_bars: true`
- [x] Auto-detect group column by matching xLabels against unique values in each column (70% threshold)
- [x] Auto-detect value column by matching trace series name to column names
- [x] Fallback: first categorical column as group, first numeric column as value
- [x] Error bar type selector in ControlPanel: ±SD / ±SEM / 95% CI (`ControlPanel.tsx → errorBarType`)
- [x] Changing error bar type recomputes locally — no AI call needed
- [x] Auto-enable `showErrorBars` when AI sets `show_error_bars: true` or returns error data (`GraphTablePanel.tsx` seeding effect)
- [x] Auto-seed `errorBarType` from AI's `error_type` field (ci/confidence → ci95, se → se, else sd)
- [x] AI system prompt updated: "Do NOT compute or return error_y arrays" (`biostatisticsAI.ts`)
- [x] Publication-quality error bar styling: gray-400 (#9ca3af), 1.5px thickness, 4px whisker caps (`resolveErrorBars → mkResult`)
- [x] Y-axis 20% headroom above tallest error bar tip — auto-computed in `plotData/layout` useMemo (`PlotlyInteractiveChart.tsx`)
- [x] AI prompt: error bar proportion guidance — CI crossing zero note, max 50% of bar height warning (`biostatisticsAI.ts`)
- [x] 10% approximation REMOVED — replaced by local computation from raw data
- [x] Customization toggle forces error bars on/off
- [x] Fallback: if local computation fails, keep AI-provided error bars if present
- [x] `coerceErrorArray()` — handles plain arrays, Plotly objects `{ array: [...] }`, single numbers, case variants
- [x] Case-insensitive property normalization in `normalizeChartData()` — `SD`/`SEM`/`Error_Y`/`CI_Lower` mapped to canonical names
- [x] Warning toast when error bars requested but cannot be computed (`onValidationWarning`)
- [x] Runtime error bar validation in debug useEffect — logs `[ERROR BAR VALIDATION FAILED]` if mismatch
- [x] Server-side error bar computation: `computeErrorBars()` with Bessel's correction and t-distribution CI (`server/computeErrorBars.ts`)
- [x] Server endpoint: `POST /api/compute-error-bars` via tRPC (`server/routers.ts → computeErrorBars`)
- [x] ControlPanel error bar description updated: "Computed locally from raw data (SD, SEM, or 95% CI)" (`ControlPanel.tsx`)

### Box Plot Enforcement
- [ ] User query keyword detection forces `pharma_type: "box"` even if AI omits it (`biostatisticsAI.ts → forcePharmaMap`)
- [ ] Same enforcement for survival, forest, volcano, heatmap, waterfall chart types
- [ ] Box plot response template in system prompt requiring raw individual values (not summary stats)
- [ ] Raw data fallback: if AI returns summary stats (≤5 values per group), server rebuilds datasets from raw CSV (`biostatisticsAI.ts ~line 4422`)
- [ ] Fallback detects group column (categorical) and value columns (numeric) from raw data
- [ ] Multiple value columns → separate box per group×column combination

### Plotly Rerouting for Error Bars
- [x] `isPlotlyChartData()` returns `true` when `show_error_bars` or `showErrorBars` is set (`PlotlyInteractiveChart.tsx`)
- [x] Standard bar/line charts reroute from Recharts to Plotly when error bars enabled
- [x] Bar intent detection from `chart_data.type`, mode, and categorical x-axis fallback (`buildGenericPlotlyTraces → isBarIntent` at line 1855)
- [x] Rerouted bar charts render as `type: 'bar'` with `barmode: 'group'`, not scatter
- [x] All customization controls work for both Recharts and Plotly-routed charts (colors, data labels, axes, legend, grid, etc.)

### Graph Edit Modification Validation
- [ ] Modification-specific validators: error bars, legend, trendline, annotations (`AIBiostatisticsChatTabIntegrated.tsx`)
- [ ] Warning toast when AI claims success but specific modification not detected in chart_data diff
- [ ] Validators check before/after chart_data structure for expected changes
- [ ] Non-blocking: AI response still applied, warning is informational

### Chart Type Enforcement — New Types
- [ ] Violin plot: `forcePharmaMap` keyword detection + `pharma_type: "violin"` enforcement (`biostatisticsAI.ts`)
- [ ] Dot plot / strip chart: keyword detection for "dot plot", "strip chart" (`biostatisticsAI.ts`)
- [ ] Dose-response: keyword detection for "dose-response", "ec50", "ic50" (`biostatisticsAI.ts`)
- [ ] ROC curve: keyword detection for "roc curve", "receiver operating" (`biostatisticsAI.ts`)
- [ ] Bland-Altman: keyword detection for "bland-altman", "method comparison" (`biostatisticsAI.ts`)
- [ ] Paired line: keyword detection for "before-after", "paired line" (`biostatisticsAI.ts`)

### Chart Display
- [x] Figure numbering: "Figure 1." auto-incremented in conversation (`biostatisticsAI.ts → GRAPHTITLE RULES`)
- [x] Figure title in sentence case, no chart type in title
- [x] Figure legend auto-generated below chart with error bar type, sample sizes, and statistical notes (`chart_data.reference`)
- [x] Proper axis labels with units auto-populated from AI response (x_axis, xLabel, xAxisLabel, x_label all supported in seeding)

### Chart Export
- [x] Export PNG via Plotly.toImage for Plotly charts (`GraphTablePanel.tsx → handleImageExport`)
- [x] Export JPEG
- [x] Export JPEG-2000
- [x] Export TIFF (custom uncompressed TIFF builder `createTiffBlob`)
- [x] Export PDF via jsPDF
- [x] Export SVG
- [x] Export CSV (chart source data as CSV `downloadChartDataAsCSV`)
- [x] Export statistics table as CSV (`downloadTableAsCSV`)
- [x] Export statistics table as TXT (`downloadTableAsTxt`)
- [x] Copy chart to clipboard (`handleCopy → Plotly.toImage` for Plotly, `html-to-image` fallback)
- [ ] Fallback: html-to-image for Recharts charts
- [ ] Clean export ref — hidden off-screen render for publication-quality (Recharts only)
- [ ] `data-export-btn` exclusion filter during capture
- [ ] Chart error boundary with fallback UI + "Retry" / "View as table" buttons (`ChartErrorBoundary`)
- [ ] Auto-chart from table: when no LLM chart_data but ≥2 numeric rows, synthesize bar chart with "Live" badge
- [x] Chart fallback warning: amber alert with actionable message — suggests removing unrelated files or rephrasing (`GraphTablePanel.tsx`)
- [ ] Blocked analysis alert: red warning when subject mismatch detected (no fabricated data)

### Plotly Toolbar
- [ ] `displayModeBar: false` — entire Plotly toolbar hidden (custom export/controls used instead)
- [ ] `displaylogo: false` — Plotly logo hidden
- [x] Significance star annotations (*, **, ***) stripped from chart — p-values in caption only (`plotLayout` useMemo)
- [x] Chart title centered via HTML overlay, Plotly internal title suppressed (`plotLayout` sets `title.text = ''`)
- [x] Single title: outer `<h3>` title in GraphTablePanel removed — only chart-internal title renders
- [x] Single caption: Note row suppressed when `chart_data.reference` exists (avoids duplicate captions)
- [x] Caption word-wrap enforced: `word-wrap`, `overflow-wrap`, `white-space: normal`
- [x] Chart fills panel: `autosize: true`, min 300px / max 500px height, default `bargap: 0.3`
- [x] Redundant axis labels (X: / Y:) below chart removed — axis labels are already on the chart
- [x] Action buttons below chart removed — chart edit via chat input only
- [x] Reference/caption renders directly below chart, no floating buttons between
- [x] AI system prompt: CHART RENDERING RULES — single title, single caption, no stars, legend rules, proportional sizing, caption format

---

## Customization Panel (CustomizeSidebar + ControlPanel)

### Chart Type Section
- [x] Chart type buttons: bar, line, area, scatter, pie (`ControlPanel.tsx`)
- [x] Corner Radius slider (`onSet("barBorderRadius", v)` → `marker.cornerradius`)
- [x] Bar Gap slider (`onSet("barGap", v)` → `layout.bargap`)

### Colors Section
- [x] 5 preset palettes: Finbox Default, Viridis, Pastel, High Contrast, Publication (`ControlPanel.tsx`)
- [x] Per-series color picker overrides with hex codes (`<input type="color">`)

### Axes Section
- [x] X-Axis Min / Max inputs → `layout.xaxis.range`
- [x] Y-Axis Min / Max inputs → `layout.yaxis.range`
- [x] X-Axis Step Size → `layout.xaxis.dtick`
- [x] Y-Axis Step Size → `layout.yaxis.dtick`
- [x] X-Axis Label Rotation → `layout.xaxis.tickangle`
- [x] X-Axis Unit/Label → `layout.xaxis.title.text`
- [x] Y-Axis Unit/Label → `layout.yaxis.title.text`
- [x] Y-Axis Log Scale toggle → `layout.yaxis.type: 'log'`
- [x] X-Axis Log Scale toggle → `layout.xaxis.type: 'log'`
- [x] Proper axis labels with units auto-populated from AI response

### Titles & Labels Section
- [x] Chart Title input → `layout.title.text`
- [x] Subtitle input → annotation at top

### Grid & Background Section
- [x] Background Color picker → `plot_bgcolor` + `paper_bgcolor`
- [x] Show Grid Lines toggle → `xaxis.showgrid` + `yaxis.showgrid`
- [x] Grid Color picker → `xaxis.gridcolor` + `yaxis.gridcolor`
- [x] Grid Style buttons: Solid/Dashed/Dotted → `xaxis.griddash` + `yaxis.griddash`
- [x] Show Chart Border toggle → `xaxis.showline` + `yaxis.showline` + `mirror`
- [x] Border Color picker → `xaxis.linecolor` + `yaxis.linecolor`
- [x] Show Minor Ticks toggle → `xaxis.minor.ticks`

### Legend Section
- [x] Legend Position selector (Top/Bottom/Left/Right/None + corners)
- [x] Legend Anchor (fine-grained: top-right, outside-right, etc.)
- [x] Show Legend Border toggle → `legend.borderwidth`
- [x] Legend Background color → `legend.bgcolor`
- [x] Legend Font Size → `legend.font.size`

### Series / Lines / Bars Section (CustomizeSidebar)
- [x] Per-series color picker
- [x] Per-series line style dropdown (solid, dashed, dotted, dashdot)
- [x] Per-series line width slider
- [x] Per-series marker shape dropdown
- [x] Per-series marker size slider
- [x] Per-series show error bars toggle
- [x] Per-series visible toggle

### Data Values Section
- [x] Show Values / Data labels toggle → `trace.text` + `trace.textposition`
- [x] Value position (above/below/inside)
- [x] Value font size
- [x] Data label format
- [x] Data label decimal places

### Other Controls
- [x] Stroke Width slider (global line width)
- [x] Marker Size slider (global marker size)
- [x] Fill Opacity slider (area charts)
- [x] Chart Theme: Light/Dark
- [x] Trendlines toggle
- [x] Show Data Labels toggle (`ControlPanel.tsx`)
- [x] Table filter input (`ControlPanel.tsx`)
- [x] Table sort options: Default/A→Z/Z→A/0→9/9→0 (`ControlPanel.tsx`)
- [x] Zebra Striping toggle for tables (`ControlPanel.tsx`)

---

## Save & Persistence

### Save Analysis Modal (`SaveAnalysisModal.tsx`)
- [ ] Auto-generated filename from tab name + graph title + date
- [ ] Editable filename input
- [ ] Format selector: CSV, XLSX, PDF, PNG, JSON, SAS, DTA
- [ ] CSV export — metrics + values, AI interpretation as comments
- [ ] XLSX export — multi-sheet workbook (metadata sheet + one per result)
- [ ] PDF export — one PDF per query bundling selected artifacts: chart image + table + interpretation (`buildQueryBundlePDF`)
- [ ] Per-query filename: "[TabName] – Q[N] – [ShortTitle] – [MM-DD-YYYY].pdf"
- [ ] Filename deduplication with "(2)", "(3)" suffix for duplicates
- [ ] JSON export — structured with title, folder, tags, results array
- [ ] SAS/DTA export — uppercase column names, alphanumeric-safe metric names
- [ ] PNG export — captures chart from DOM at 2x retina resolution
- [ ] Tag management — dropdown with existing tags, add new tags, remove tags
- [ ] Auto-determined save location: Project / Tab (no manual folder selector)
- [ ] Save path format: `[ProjectName] / [TabName] / [filename].pdf` (`SaveAnalysisModal.tsx`)
- [ ] Tab selection — expand/collapse tabs, horizontal table with Graph/Table/Query columns per query row (`SaveAnalysisModal.tsx`)
- [ ] Query-grouped layout: each result row shows Q1/Q2/Q3 label with Graph, Table, Query pill buttons
- [ ] Disabled cells: dashed gray circle when a query has no graph or no table
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
- [ ] `computeErrorBars` — server-side SD/SEM/CI computation from raw data (`server/computeErrorBars.ts`)
- [ ] `runStats` — execute statistical tests via Python scipy/statsmodels (`server/statsEngine.ts`)

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

### Visualization Intelligence Framework (`biostatisticsAI.ts → buildSystemPrompt`)
- [x] 3-layer reasoning: PURPOSE (why this chart?) → STRUCTURE (how to encode?) → QUALITY (pre-output checklist)
- [x] Purpose → chart type mapping (groups→bar, time→line, correlation→scatter, distribution→box, survival→KM)
- [x] Legend rules: hide for single-series when X-axis identifies groups; label = group name, never metric name
- [x] Caption in "reference" field only — never as annotation inside chart area
- [x] Scatter MUST use points format: `{ type: "scatter", points: [{x, y}] }` — one point per observation, never aggregated
- [x] Quality checklist: data visibility, Y-axis headroom, label space, error bar proportions, no fabricated values
- [x] Explicit prohibitions: no pie charts, no significance stars on chart, no truncated bar Y-axes, no zero-point charts

### Pre-Analysis Reasoning Pipeline (`biostatisticsAI.ts → buildSystemPrompt`)
- [x] Data quality assessment: completeness (>20% missing → warn), type validation, range plausibility, sample size adequacy, outlier screening, duplicate detection
- [x] Multi-file reasoning: inventory → relevance → conflict resolution → single-file focus; merge only when explicitly requested with shared key
- [x] Study design recognition: RCT, observational cohort, cross-sectional, case-control, repeated measures, PK — each with appropriate methods and warnings
- [x] Statistical method selection: 6-step decision process (question → variables → assumptions → non-parametric fallback → multiple comparisons → report)
- [x] Assumption checking table: t-test, ANOVA, chi-square, Pearson, regression, Cox — with specific tests (Shapiro-Wilk, Levene's, Schoenfeld)
- [x] Assumption violation reasoning: 3-tier severity (mild/moderate/severe) with robustness arguments per test type
- [x] Data transformation reasoning: decision process (characterize → choose transform → verify → report both scales), never transform just to reduce p
- [x] Missing data reasoning: MCAR/MAR/MNAR characterization, strategy by rate+mechanism, never silent drops or mean-imputation without caveat
- [x] Multiplicity control: proactive tracking after 3+ tests, Bonferroni/Tukey/Dunnett/BH selection, unadjusted + adjusted p-values
- [x] Confounding reasoning: baseline balance check, covariate adjustment methods (ANCOVA, propensity), report unadjusted vs adjusted
- [x] Longitudinal/repeated measures: detection (duplicate IDs, time columns), method selection (MMRM, GEE, RM-ANOVA), correlation structures, why standard methods fail
- [x] Categorical data reasoning: binary (RD, RR, OR, NNT), ordinal (when to treat as continuous), sparse data (Fisher's exact, separation), multiple categories
- [x] Survival analysis reasoning: censoring assessment, KM (median + CI), Cox (PH check, HR), competing risks (CIF, Fine-Gray), landmark analysis (immortal time bias)
- [x] Regression diagnostics: linear (residuals, QQ, Cook's D, VIF, Breusch-Pagan) + logistic (AUC, Hosmer-Lemeshow, separation, EPV)
- [x] Power/sample size reasoning: required inputs (never guess), calculation methods per design, sensitivity tables, post-hoc power avoidance
- [x] Graphical data assessment: pre-analysis visualization checklist, auto-diagnostic plots, chart-vs-test contradiction resolution
- [x] Effect size reporting: Cohen's d, η², r², Cramér's V, OR/HR with interpretation benchmarks and clinical context
- [x] Clinical vs statistical significance: always report both; flag large-n trivial effects and underpowered moderate effects

### Output Quality Frameworks (`biostatisticsAI.ts → buildSystemPrompt`)
- [x] Result interpretation standards: 6-part structure (what was tested → key finding → statistical evidence → assumptions → clinical interpretation → limitations)
- [x] Table generation: traceability principle — Table A (derived statistics, always) + Table B (source data verification, when needed)
- [x] Uncertainty communication: 3 confidence levels (high/moderate/low) with refuse vs proceed-with-caveats decision rules
- [x] Reproducibility documentation: data reference, filtering, variables, method, software in every result
- [x] Adaptive response complexity: simple/intermediate/advanced signals adjust detail level automatically
- [x] Regulatory awareness: detection of FDA/EMA/ICH signals → precision, multiplicity, missing-data handling, regulatory language
- [x] Subgroup and sensitivity analysis: interaction testing, forest plots, robustness checks with conclusion comparison
- [x] Error recovery: 6-level hierarchy with actionable alternatives, never raw errors, always a next step
- [x] Domain-specific knowledge: clinical endpoints by therapeutic area, PK parameters, BE criteria, common pitfalls (Simpson's, regression to mean, immortal time bias)
- [x] Follow-up query reasoning: 4-step process (identify artifact → set null for preserved → merge → announce) with keyword signals

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

### Statistical Test Engine (`server/statsEngine.ts`)
- [ ] Python-backed test execution via `executePython()` subprocess
- [ ] Two-group tests: unpaired t-test (Student's/Welch's), paired t-test, Mann-Whitney U, Wilcoxon signed-rank
- [ ] Multi-group tests: one-way ANOVA, Kruskal-Wallis, Friedman, two-way ANOVA, repeated-measures ANOVA
- [ ] Post-hoc tests: Tukey HSD, Bonferroni, Dunnett, Dunn (auto-run when ANOVA significant)
- [ ] Correlation: Pearson, Spearman, Kendall
- [ ] Regression: linear (OLS), logistic
- [ ] Categorical: chi-squared, Fisher's exact
- [ ] Survival: Kaplan-Meier, log-rank, Cox proportional hazards
- [ ] Normality checks: Shapiro-Wilk, D'Agostino-Pearson, Levene's test
- [ ] Effect size computation: Cohen's d, eta-squared, Cramér's V, rank-biserial r
- [ ] Confidence intervals for all test statistics
- [ ] Significance stars: * p<0.05, ** p<0.01, *** p<0.001, **** p<0.0001

### Statistical Test Selection (AI prompt in `biostatisticsAI.ts`)
- [ ] Decision tree in system prompt: 2-group vs 3+-group, paired vs independent, parametric vs non-parametric
- [ ] AI returns `statistical_test: { test, params, reasoning }` JSON key
- [ ] AI never computes statistics — selects test only, Python runs it
- [ ] Reasoning field explains test choice for transparency

### Stats Engine Integration (`AIBiostatisticsChatTabIntegrated.tsx`)
- [ ] Detects `statistical_test` key in AI response after parsing (`~line 2187`)
- [ ] Calls `runStats` tRPC endpoint with test name, raw data, and AI params
- [ ] Merges `assumptions`, `post_hoc`, and test results into `analysisResults`
- [ ] Test results prepended to `results_table` with formatted rows (test statistic, p-value, CI, effect size)
- [ ] Group descriptive stats (n, mean±SD, median) added to results table
- [ ] AI reasoning shown as a row in results table
- [ ] Non-fatal: if stats engine fails, AI's own results still display

### Assumptions Panel (`biostat/AssumptionsPanel.tsx`)
- [ ] Expandable panel above Statistics Summary table when `analysisResults.assumptions` present
- [ ] Normality check per group: Shapiro-Wilk W and p-value, pass/fail indicator
- [ ] Equal variance check: Levene's test statistic and p-value
- [ ] Warning banner when assumptions violated + suggested non-parametric alternative
- [ ] "Run [alternative] instead" button (calls `onRunAlternative` callback)
- [ ] Sample sizes display per group and total
- [ ] Color-coded: green border for all-pass, amber for warnings

### Post-Hoc Comparisons Table (`GraphTablePanel.tsx`)
- [ ] Rendered when `analysisResults.post_hoc.comparisons` present
- [ ] Columns: Comparison, Mean Diff, P (adj), Significance stars
- [ ] Method label header (Tukey HSD, Dunn, etc.)
- [ ] Hover highlight on rows

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
- [x] Table decision framework: Table A (derived statistics, always) + Table B (source data verification, when traceability demands it) — AI reasons about when to produce one vs two tables (`biostatisticsAI.ts → Table Generation`)

### Stage 2: Analysis-Specific Data Validation (`analysisValidator.ts`)
- [ ] `validateDataForAnalysis()` — checks data suitability before analysis runs
- [ ] Descriptive: requires ≥1 numeric column
- [ ] T-test: requires numeric outcome + 2-group categorical, warns on n<30
- [ ] ANOVA: requires numeric outcome + 3+ group categorical
- [ ] Survival: requires time column + event/censor column (pattern-matched)
- [ ] Correlation: requires ≥2 numeric columns
- [ ] Chi-square: requires ≥2 categorical columns
- [ ] Logistic: requires numeric predictors + binary outcome
- [ ] Bioequivalence: checks for PK parameter columns + period/sequence
- [ ] NCA: requires time + concentration columns
- [ ] Returns actionable errors with suggestions when validation fails
- [ ] Rich refusal messages: title, reason, detected data table, required data, suggested actions, clickable query suggestions
- [ ] Summary/pivot table detection: rejects t-test on aggregated counts and suggests chi-square instead
- [ ] Refusal includes `detectedData` with per-column type + notes (e.g., "looks like summary counts")
- [ ] `suggestedQueries` array for auto-fill chips in chat (e.g., "Run a chi-square test on these counts")
- [ ] Blocks analysis with clear error card instead of hallucinated results

### Stage 3: Autonomous Test Selection (`testSelector.ts`, `server/src/llm/router.ts`)
- [ ] `profileData()` — auto-detects group columns, numeric/categorical split, pairing, time/event columns
- [ ] `selectTest()` — decision tree: analysis type + data profile → specific test + assumptions
- [ ] Two-group: paired → paired t-test/Wilcoxon; unpaired n<30 → Mann-Whitney; unpaired n≥30 → unpaired t-test
- [ ] Multi-group: one-way ANOVA + Tukey HSD; repeated → repeated-measures ANOVA + Bonferroni
- [ ] Correlation: n≥30 → Pearson; n<30 → Spearman
- [ ] Categorical: n<40 → Fisher's exact; n≥40 → Chi-squared
- [ ] Survival: no covariates → KM + log-rank; covariates → Cox PH
- [ ] Returns `primaryTest`, `alternativeTest`, `postHocTest`, `assumptionChecks`, `reasoning`
- [ ] `selectMethod()` in `server/src/llm/router.ts` — alternative router with method_id, compute_function, rationale

### Stage 7: Auto-Citation of Computed Results (`resultsCiter.ts`)
- [ ] `extractNumericClaims()` — regex extraction of p-values, CIs, means, effect sizes, test statistics from LLM text
- [ ] `findSource()` — fuzzy matches claims against results_table and stats engine output
- [ ] `citeResults()` — returns verified citations + list of unverified claims
- [ ] Unverified claims logged as warnings (non-blocking)
- [ ] Citations attached to response as `_citations` array for frontend display
- [ ] Tolerance-based matching: 0.1% for large numbers, 1% for small

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
- [ ] `BarPointCustomization` / `BarCustomizations` types — per-bar color, value, significance, hidden overrides
- [ ] `barCustomizations` field in `TabCustomizations` — persists click-to-edit popup changes per result

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

## Statistical Validation Framework

### Simulation Engine (`server/validation/`)
- [ ] `base.py` — simulation framework: Scenario, ScenarioResult, MethodResult dataclasses
- [ ] `run_scenario()` — runs N replications, computes Type I error, coverage, bias, MSE, power
- [ ] `validate_method()` — runs all scenarios for a method, hashes compute file
- [ ] `save_results()` — writes to `results/latest.json` + `results/history/`
- [ ] `cache.py` — skips re-running if compute file hash unchanged and last run passed
- [ ] `run_all.py` — orchestrator, runs changed methods only (or `--force` for all)
- [ ] Pass criteria: Type I within 3 SE of nominal alpha; coverage within 3 SE of 95%

### Simulation Modules
- [ ] `descriptive.py` — mean CI coverage for normal (n=30, n=100), skewed data, power for shifted mean
- [ ] `t_tests.py` — Welch t-test (null equal/unequal variance, power d=0.5/0.8, coverage), paired t-test (null, power), Mann-Whitney (null, power)
- [ ] `anova.py` — one-way ANOVA (null 3/5 groups, power with shifted group), Kruskal-Wallis
- [ ] `chi_square.py` — chi-squared (null 2x2/3x3, power with dependence), Fisher's exact

### CI / GitHub Actions
- [ ] `.github/workflows/validation.yml` — runs on push to main/develop when stats code changes
- [ ] Commits results back to repo on success
- [ ] Uploads `latest.json` as artifact on every run
- [ ] Fails build if any validation check fails

### Admin Dashboard (`/admin/validation`)
- [ ] Route: `/admin/validation` (`pages/admin/ValidationDashboard.tsx`)
- [ ] tRPC endpoint: `admin.validationResults` reads `latest.json`
- [ ] Overview: pass/fail summary with method count and scenario count
- [ ] Per-method cards: expandable with scenario table (Type I, Coverage, Bias, MSE, Power, Status)
- [ ] Status icons: green=pass, red=fail, amber=warning
- [ ] Timestamp + git SHA display
- [ ] Empty state when no results exist

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
- [ ] PDF — server-side text extraction via pdf-parse, OCR fallback via tesseract.js for scanned PDFs (`server/routers.ts → ocrPdfBuffer`)
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
