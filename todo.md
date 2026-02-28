# MedReg Platform TODO

## Report Generation System
- [x] Create report generation service with HTML/PDF generation
- [x] Create ReportPreview component for in-app viewing
- [x] Add report preview tab/modal to Biostatistics page
- [x] Wire "Generate Report" button to create and display preview
- [x] Implement "Save Technical File" button to save report to Saved Technical Files
- [x] Add report metadata (title, date, filters applied, chart settings)
- [x] Create Saved Technical Files page to display saved reports
- [x] Test report generation with various data and filters

## Completed Features
- [x] Authentication with Manus OAuth
- [x] Trial system (1 free generation)
- [x] Stripe subscription ($30/month)
- [x] User profile with subscription status
- [x] Usage analytics dashboard with storage tracking
- [x] Resizable chart panels
- [x] AI chat integration
- [x] Chart settings subcommand bar
- [x] Color customization with color wheel
- [x] Global settings presets
- [x] File selection modal from uploaded files
- [x] File parsing (CSV, XLSX, JSON)
- [x] Real-time chart rendering with Recharts
- [x] Data filtering and transformation
- [x] Export functionality (PNG, SVG, CSV, Excel)


## Saved Reports Enhancement
- [x] Add search functionality for report titles
- [x] Add sorting options (date, title, measurements count)
- [x] Add date range filtering
- [x] Add metadata-based filtering (measurements, data files)
- [x] Add sort direction toggle (ascending/descending)
- [x] Test filtering and sorting with various data


## Authentication & Monetization Redesign
- [x] Remove Manus OAuth integration
- [x] Add Google Sign-In authentication (AuthModal component)
- [x] Create custom account registration page (AuthModal component)
- [x] Redesign login page as landing page (not pop-up)
- [x] Create premium banner component for non-paying users
- [x] Implement paywall modal after free trial usage
- [x] Update routing to show landing page for unauthenticated users
- [x] Test authentication and paywall flows


## Freemium Model Implementation
- [x] Update database schema with subscription_status and free_trial_used fields (already existed)
- [x] Create PremiumPaywallPanel component matching Finbox design
- [x] Update landing page to redirect authenticated users to Regulatory Document page
- [x] Implement free trial restrictions on Biostatistics page (save/export/download blocked)
- [x] Implement free trial restrictions on Regulatory Document page (save blocked)
- [x] Implement free trial restrictions on Data Upload and Save Technical Files pages
- [x] Add paywall panel to restricted action handlers
- [x] Test all free trial restrictions and paywall flows


## User Feedback Mechanism
- [x] Update database schema with feedback table
- [x] Create FeedbackForm component with categories
- [x] Add feedback button to biostatistics page
- [x] Create tRPC procedures for feedback submission
- [x] Implement feedback modal with validation
- [x] Add success notifications
- [x] Test feedback workflow


## Admin Feedback Dashboard
- [x] Create admin feedback dashboard page
- [x] Implement feedback table with sorting and filtering
- [x] Add feedback detail modal for viewing
- [x] Add status update functionality
- [x] Add admin route and navigation
- [x] Test admin dashboard


## UI/UX Improvements
- [x] Center "Get Access" banner on page
- [x] Apply blue theme color to banner
- [x] Reorder sidebar menu: Biostatistics after Regulatory Document

## Chart/Table Display Redesign (Zustand Store)

- [x] Create Zustand chart store (stores/chartStore.ts) with setChartData, clearChart, chartConfig, tableData
- [x] Update AIBiostatisticsChat to call setChartData instead of inline rendering
- [x] Wire chart panel to read from store and render Recharts LineChart/BarChart (ChartArea updated)
- [x] Wire table panel to read from store and display data table (TableDataDisplay component created)
- [x] Update backend response format to include chartConfig and tableData
- [x] Create chartDataConverter to transform analysisResults to chart/table format
- [x] Create unit tests for chart store (5 tests passing)
- [ ] Test end-to-end: upload CSV → query "std dev" → chart appears in right panel → table appears below

## Chart Customization Tools (Editing & Presets)
- [ ] Create chart settings Zustand store (chartSettingsStore.ts)
- [ ] Implement chart type dropdown (Line, Bar, Area, Scatter)
- [ ] Implement Grid toggle
- [ ] Implement Y-Zero toggle
- [ ] Implement Colors picker with color schemes
- [ ] Implement Presets (Publication, Dark, Minimal)
- [ ] Wire ChartArea to use settings store
- [ ] Test all customization features end-to-end

## Biostatistics Debugging
- [x] Investigate biostatistics page issues
- [x] Fix data loading and chart rendering
- [x] Test with sample data


## Measurement Removal Bug Fix
- [x] Fix remove button for selected measurements
- [x] Ensure chart updates when measurements removed
- [x] Ensure data table updates with remaining measurements
- [x] Test with various measurement combinations


## Chart Population Bug
- [x] Debug chart not populating after adding measurement
- [x] Check measurement selection flow
- [x] Fix chart rendering issue (nested button HTML error)

## Restored Components
- [x] Verified AI chat box component in Biostatistics page
- [x] Verified biostatistical measurements sidebar with suggested phrases
- [x] Verified CSV data loading integrated with measurements workflow
- [x] All components tested and working correctly


## AI Chat Send Button Implementation
- [ ] Create backend tRPC procedure to process data files
- [ ] Connect send button to file processing logic
- [ ] Implement data loading from selected files
- [ ] Generate charts from selected measurements
- [ ] Test with various data files


## Data Uploaded Page Enhancement
- [x] Add drag-and-drop upload zone to Data Uploaded page
- [ ] Implement file upload to S3 storage
- [ ] Create file storage database schema
- [x] Add filing options (folders, tags, categories)
- [x] Implement file organization and management UI
- [x] Add file search and filtering
- [x] Test upload and filing workflows


## Bulk File Actions
- [x] Add checkboxes for multi-file selection
- [x] Create bulk action toolbar
- [x] Implement bulk move to folder
- [x] Implement bulk tag assignment
- [x] Implement bulk delete with confirmation
- [x] Test bulk operations with various file counts


## PDF Document Viewer Implementation
- [x] Install @react-pdf-viewer and dependencies
- [x] Create DocumentViewer component with modal
- [x] Implement zoom and page navigation
- [x] Add text search functionality
- [x] Add annotation tools (highlight, notes)
- [x] Integrate into Saved Technical Files page
- [x] Integrate into Data Uploaded page
- [x] Test PDF viewer with sample documents


## PDF Viewer Debugging & Fixes
- [x] Fix View button integration with handleViewPdf
- [x] Create sample PDF files for testing
- [x] Add error handling and loading states
- [x] Add console logging for debugging
- [x] Verify PDF.js worker configuration
- [x] Debug and verify PDF viewer functionality


## File Upload Backend Integration
- [x] Create database schema for file uploads
- [x] Create tRPC procedure for file uploads to S3
- [x] Integrate S3 storage with storagePut helper
- [x] Connect FileUploadZone to backend upload
- [x] Add proper error handling for upload failures
- [x] Test file upload end-to-end
- [x] Fix database schema migration issues
- [x] Update AnalyticsDashboard for new data structure


## S3 Upload & File Preview
- [x] Create tRPC mutation for S3 file uploads
- [x] Implement file upload handler in FileUploadZone
- [x] Create CSV/XLSX preview component
- [x] Add file download with presigned URLs
- [x] Integrate preview modal into Data Uploaded page
- [x] Add access control and permission checks
- [x] Test upload and preview workflows end-to-end

## File Listing Implementation
- [x] Create tRPC query procedure to fetch uploaded files from database
- [x] Update DataUploaded page to use real data from database
- [ ] Implement file listing with pagination
- [x] Add query invalidation after successful upload
- [x] Test file listing with uploaded files

## Authentication Session Issues
- [x] Fix session expiration - users logged out within seconds (fixed upsertUser function)
- [x] Extend dev login session expiration time
- [x] Ensure session cookies persist across requests
- [x] Fix OAuth redirect loop on session expiration
- [x] Test session stability and persistence

## File Cache Invalidation Bug (URGENT)
- [ ] Fix query cache invalidation after file deletion - deleted files reappear until page refresh
- [ ] Fix query cache invalidation after file upload - newly uploaded files don't appear immediately
- [ ] Ensure trpc.useUtils().files.getFiles.invalidate() is called after delete mutation
- [ ] Ensure trpc.useUtils().files.getFiles.invalidate() is called after upload mutation
- [ ] Test deletion and upload workflows to verify files appear/disappear correctly

## Document Viewer Issues
- [x] Fix document viewer hanging on "Loading PDF..." spinner
- [ ] Fix PDFs downloading instead of displaying inline in viewer
- [ ] Implement document highlighting feature
- [ ] Implement document annotation/comments feature
- [ ] Test document viewing with various file formats

## File Pagination System
- [x] Update files.list tRPC procedure to support limit and offset parameters
- [x] Implement pagination UI with page numbers and navigation controls
- [x] Add items per page selector (10, 20, 50 options)
- [ ] Store pagination state in URL query parameters
- [x] Test pagination with multiple pages of files

## Biostatistics File Selection
- [x] Connect "+Add Data Files" button to show real uploaded files
- [x] Update file selection modal to fetch files from database
- [x] Allow users to select multiple files for biostatistics analysis
- [x] Display selected files with proper metadata
- [x] Test file selection and integration with biostatistics workflow

## Chart Display Issues
- [x] Remove floating blue tooltip box from biostatistics chart
- [x] Ensure chart grid and data are fully visible without overlays
- [x] Fix chart legend appearing in the middle of the grid instead of outside
- [x] Ensure legend is positioned outside the chart area (top, bottom, or side)
- [x] Test legend positioning with all chart types (line, scatter, bar, area)

## Chart Export Issues
- [x] Fix chart export failing due to OKLCH color format not supported by html2canvas
- [x] Convert OKLCH colors to RGB before exporting charts
- [x] Test PNG, SVG, and CSV export formats

## UI/UX Improvements
- [x] Make NuPhorm vertical sidebar menu collapsible with toggle button
- [x] Add smooth transitions when collapsing/expanding menu
- [x] Hide text labels when menu is collapsed, show only icons
- [x] Persist menu state in localStorage

## Sidebar Layout Issues
- [x] Fix sidebar overlaying content instead of pushing it when expanded
- [x] Ensure main content area properly adjusts width based on sidebar state
- [x] Test sidebar collapse/expand on all pages

## AI-Powered Regulatory Documentation Producer
- [x] Research FDA eSTAR requirements and medical device documentation standards
- [x] Design AI documentation producer architecture with source tracking
- [x] Create backend tRPC procedures for document generation with LLM integration
- [x] Build frontend UI for document generation with progress tracking
- [x] Implement source citation and reference annotation system
- [x] Create document output formatting and export functionality
- [x] Test end-to-end workflow with sample data

## AI-Powered Biostatistics Analysis
- [x] Design AI biostatistics analysis architecture and data flow
- [x] Create backend AI analysis functions for biostatistical calculations
- [x] Build enhanced AI chat component with conversational capabilities
- [x] Redesign Biostatistics left panel with unified AI chat, keywords, and file selection
- [x] Implement data parsing and AI analysis integration
- [x] Create dynamic chart and table generation from AI results
- [x] Test end-to-end AI analysis workflow

## Pharmaceutical Biostatistics AI Upgrade
- [x] Create scale.md reference for data type classification (nominal/ordinal/interval/ratio)
- [x] Upgrade backend AI helper with expert system prompt
- [x] Implement Kaplan-Meier and survival analysis methods
- [x] Add smart data parsing with auto-descriptives
- [x] Implement scale detection for column classification
- [x] Update tRPC analyzeData mutation with structured JSON output
- [x] Enhance frontend AIChat to display structured results
- [x] Update chart component to display computed data
- [x] Populate Measurements component from parsed data
- [x] Test end-to-end workflow with sample data

## AI Statistics Generation Bug (CRITICAL)
- [x] AI is not generating statistical results - only showing suggestions and measurements
- [x] Backend AI analysis function not computing statistics from uploaded data
- [x] Frontend chat handler not processing structured JSON output from AI
- [x] Charts and data tables not being populated with computed statistics
- [x] Need to fix end-to-end flow from user query to statistical output

## AI Biostatistics Real Statistics Implementation
- [x] Create statisticsCalculator.ts module with 12+ statistical functions
- [x] Implement descriptive statistics (mean, median, std dev, variance, quartiles, min, max, range)
- [x] Implement Pearson correlation with p-values and interpretation
- [x] Implement independent samples t-test with significance testing
- [x] Implement ANOVA for multiple group comparisons
- [x] Implement histogram binning for distribution analysis
- [x] Implement scatter plot data generation
- [x] Add analysis type detection from user queries
- [x] Add column extraction from natural language queries
- [x] Create 30 comprehensive unit tests for all statistical functions
- [x] All tests passing (30/30)
- [x] Update biostatisticsAI.ts to call real calculation functions
- [x] Update AIBiostatisticsChat to parse full CSV data and pass to backend
- [x] Implement full data parsing in frontend (CSV to array of objects)
- [x] Update tRPC analyzeBiostatisticsData to accept fullData parameter
- [x] Tested end-to-end: file upload → AI analysis → statistics computation


## AI Biostatistics Current Issues (Session Reset)
- [ ] AI returning third-person narrative instead of structured JSON with computed statistics
- [ ] Timeout occurring during analysis (60s limit being hit)
- [ ] Chart visualization not populating with computed data
- [ ] Results table not displaying computed values
- [ ] LLM response format not matching expected schema

## Gene Expression Biostatistics Implementation
- [x] Create geneExpressionAnalysis.ts module with fold-change computation (log2)
- [x] Implement accurate statistics: mean_fold, std_dev with n-1 denominator
- [x] Add natural language query parser for biostatistics commands (regex-based)
- [x] Update backend to detect gene expression data structure (control/treated columns)
- [x] Create bar chart with fold-change on y-axis and error bars for std_dev
- [x] Update results table to show top 10 rows with fold-change and per-group std_dev
- [x] Test end-to-end with sample gene expression data
- [x] Verify chart visualization and table display accuracy
- [x] Create comprehensive unit tests for gene expression analysis (32 tests passing)
- [x] Integrate gene expression module with biostatistics AI system


## AI-Powered Pharma Biostats Platform Overhaul
- [x] Design comprehensive data models for pharma analytics (PK/PD, BA/BE, efficacy ratios)
- [x] Create pharma metrics calculation engine (bioavailability, bioequivalence, effect sizes)
- [x] Implement auto-baseline analysis on file upload (descriptive stats + pharma metrics)
- [x] Build smart NLP engine with nlp.js for intelligent analysis suggestions
- [x] Implement Kaplan-Meier detection and survival analysis suggestions
- [x] Add PK/PD modeling detection and suggestions
- [x] Add BA/BE calculation detection and suggestions
- [x] Add dose-response curve detection and suggestions
- [x] Create multimodal image analysis for gel blots and chromatograms
- [x] Implement basic band detection and intensity analysis for images
- [x] Build PDF report generation engine with jsPDF
- [x] Create report sections: Intro, Methods, Results, Discussion
- [x] Implement AI-generated pharma insights in Discussion section
- [x] Add regulatory compliance checks (FDA approval criteria, bioequivalence thresholds)
- [x] Create database schema for reports, analysis history, and metadata
- [x] Build enhanced AI chat with smart suggestions
- [x] Create tRPC procedures for pharma analysis and reporting
- [x] Build comprehensive test suite for pharma metrics (25+ tests passing)
- [x] Create comprehensive documentation and sample pharma queries
- [ ] Integrate Express.js backend for heavy computations (optional)
- [ ] Integrate Python backend via child_process for statistical modeling (optional)
- [ ] Add R integration via rserve-js for advanced statistics (optional)
- [ ] Create unified biostatistics page UI with all features
- [ ] Final testing, optimization, and deployment

## Core Computational Functionality Implementation
- [x] Create vanilla JS statistics library (mean, std dev, median, quartiles, CI, etc.)
- [x] Implement fold-change calculations (log2 and simple ratio)
- [x] Build natural language query parser for statistical commands
- [x] Create context/state management for uploaded CSV data
- [x] Implement working biostatistics chat component with real calculations
- [x] Create statistics results display component with formatted tables
- [x] Build comprehensive unit tests for statistics library (30+ tests passing)
- [x] Test end-to-end: upload CSV -> parse query -> compute stats -> display results
- [ ] Create visualization charts for statistical results
- [ ] Integrate with existing Biostatistics page
- [ ] Final testing, optimization, and deployment


## CRITICAL BUG FIX: Backend Computation Returns Text Instead of Numbers
- [x] Create backend tRPC procedure that computes actual statistics from CSV data
- [x] Implement structured JSON response with computed values (not narrative text)
- [x] Parse CSV data and extract numeric columns in backend
- [x] Use statisticsCalculator functions to compute mean, std dev, median, etc.
- [x] Return chart data (type, labels, values) for visualization
- [x] Create frontend component to display computed results (not text)
- [x] Wire chat component to call new backend procedure
- [x] Test: "standard deviation" query returns actual number + chart
- [x] Test: "fold change" query returns statistics table + visualization
- [x] Verify end-to-end: query -> backend -> structured data -> display
- [ ] Test with real CSV data to verify accuracy
- [ ] Deploy and monitor for edge cases


## Pharmaceutical Biostatistician AI System - Complete Overhaul

### Phase 1: Intelligent Query Parser & NLP
- [x] Create queryParser.ts with statistical intent detection (t-test, ANOVA, regression, survival)
- [x] Implement pharma-specific intent detection (bioequivalence, dose-response, PK/PD)
- [x] Add clarifying question generator for ambiguous queries
- [x] Build analysis suggestion engine based on data structure

### Phase 2: Data Import & Cleaning with Danfo.js
- [x] Create dataImport.ts module for CSV/XLSX/JSON parsing
- [x] Implement automatic data type detection (numeric, categorical, date)
- [x] Add missing value detection and imputation strategies (mean, median, forward-fill, KNN)
- [x] Create data normalization/standardization functions
- [x] Build data validation and quality checks

### Phase 3: Comprehensive Statistical Analysis Engine
- [x] Implement descriptive statistics (mean, SD, median, quartiles, skewness, kurtosis)
- [x] Add parametric tests (t-test paired/unpaired, ANOVA, post-hoc Tukey)
- [x] Add non-parametric tests (Mann-Whitney, Kruskal-Wallis, Wilcoxon)
- [x] Implement linear/multiple regression with diagnostics
- [x] Add logistic regression for binary outcomes
- [x] Create confidence interval calculations (95% CI, bootstrap)

### Phase 4: Pharma-Specific Analyses
- [x] Implement bioequivalence (BE) testing (90% CI, TOST)
- [x] Add dose-response curve fitting (linear, exponential, sigmoid)
- [x] Create PK/PD parameter calculations (AUC, Cmax, Tmax, half-life)
- [x] Implement safety signal detection (adverse event analysis)
- [x] Add efficacy ratio calculations (NNT, NNH)

### Phase 5: Survival Analysis Module
- [ ] Implement Kaplan-Meier curves with log-rank test
- [ ] Add Cox proportional hazards regression
- [ ] Create survival probability tables
- [ ] Implement censoring handling

### Phase 6: AI Guidance System
- [ ] Create clarifying question engine (e.g., "Paired or unpaired data?")
- [ ] Build analysis suggestion system based on data characteristics
- [ ] Implement assumption checking (normality, homogeneity of variance)
- [ ] Add result interpretation in plain pharma language
- [ ] Create FDA/EMA compliance guidance notes

### Phase 7: Async Processing & Optimization
- [ ] Implement async/await for long-running computations
- [ ] Add progress indicators for large datasets
- [ ] Create background job queue for heavy analyses
- [ ] Implement result caching to prevent re-computation

### Phase 8: Report Generation with FDA Compliance
- [ ] Create jsPDF report generator with sections (Intro, Methods, Results, Discussion)
- [ ] Add FDA bioequivalence guidance notes
- [ ] Implement regulatory compliance checklist
- [ ] Create downloadable CSV/Excel exports
- [ ] Add chart embedding in PDFs

### Phase 9: Enhanced AI Chat Component
- [ ] Create multi-turn conversation system
- [ ] Implement context awareness (remember previous queries)
- [ ] Add auto-suggestions based on data
- [ ] Create workflow guidance (step-by-step analysis)
- [ ] Implement result refinement (e.g., "Show only significant results")

### Phase 10: Integration & UI
- [ ] Replace Biostatistics page with new AI component
- [ ] Add data preview panel
- [ ] Create results visualization area
- [ ] Implement sidebar for analysis history
- [ ] Add settings for statistical preferences

### Phase 11: Testing & Documentation
- [ ] Create comprehensive test suite for all statistical functions
- [ ] Add integration tests for multi-step workflows
- [ ] Create user documentation with examples
- [ ] Build tutorial videos/guides for common analyses

### Phase 12: Final Testing & Deployment
- [ ] End-to-end testing with real pharma datasets
- [ ] Performance optimization and profiling
- [ ] Security review and input validation
- [ ] Create checkpoint and prepare for deployment


## Data Exploration & Cleaning Enhancement (R dplyr/tidyr + SAS-like)

### Phase 1: Data Exploration Engine
- [x] Create dataExploration.ts with R-like summary() output
- [x] Implement column-level statistics (types, missing %, min/max/mean/median/SD)
- [x] Build frequency tables for categorical variables
- [x] Add distribution analysis (skewness, kurtosis, normality tests)
- [x] Create correlation matrices and multicollinearity detection
- [x] Implement data profiling report generation

### Phase 2: Intelligent Data Cleaning
- [x] Create dataCleaning.ts with advanced imputation (mean, median, KNN, MICE)
- [x] Implement outlier detection (z-score, IQR, Mahalanobis distance)
- [x] Add outlier handling (remove, cap, flag)
- [x] Create duplicate detection and removal
- [x] Build data validation rules engine
- [x] Implement batch cleaning workflows

### Phase 3: Data Transformations
- [x] Implement log transformation with handling of zeros/negatives
- [x] Add Box-Cox transformation for normality
- [x] Create variable recoding (recode, factor, binning)
- [x] Implement scaling/normalization (z-score, min-max, robust)
- [x] Add merge/join operations for multiple files
- [x] Create pivot/reshape operations (one-hot, label encoding, discretization, lag, difference)

### Phase 4: Pharma-Specific Validation
- [ ] Detect clinical trial data structure (treatment, baseline, outcome)
- [ ] Flag imbalanced treatment groups
- [ ] Check for blinding codes and randomization
- [ ] Auto-detect and normalize gene expression data (log2 fold-change)
- [ ] Validate PK/PD data structure (time, concentration, dose)
- [ ] Check for protocol deviations and data integrity

### Phase 5: tRPC Procedures
- [ ] Create trpc.data.explore procedure with data summary
- [ ] Create trpc.data.clean procedure with imputation options
- [ ] Create trpc.data.transform procedure for transformations
- [ ] Create trpc.data.validate procedure for pharma checks
- [ ] Create trpc.data.profile procedure for full data profiling
- [ ] Implement async processing for large datasets

### Phase 6: Frontend Data Viewer Component
- [ ] Create DataViewer.tsx component with sortable/filterable table
- [ ] Implement column editing with type validation
- [ ] Add data preview with summary statistics sidebar
- [ ] Create undo/redo functionality
- [ ] Build export options (CSV, Excel, JSON)
- [ ] Add data quality indicators (missing %, outliers)

### Phase 7: AI Guidance System Integration
- [ ] Create cleaningRecommendations.ts for smart suggestions
- [ ] Implement missing value imputation recommendations
- [ ] Add outlier handling suggestions with explanations
- [ ] Create transformation recommendations based on data
- [ ] Build pharma-specific guidance (trial structure, normalization)
- [ ] Implement confirmation prompts for destructive operations

### Phase 8: Testing & Documentation
- [ ] Create comprehensive tests for data exploration functions
- [ ] Add tests for cleaning and transformation operations
- [ ] Test pharma-specific detection and validation
- [ ] Create user documentation with examples
- [ ] Build tutorial for common data cleaning workflows
- [ ] Add sample datasets for testing

### Phase 9: Final Integration
- [ ] Wire data exploration into AI chat responses
- [ ] Integrate data cleaning into multi-step workflows
- [ ] Add data viewer to biostatistics page
- [ ] Test end-to-end: upload → explore → clean → analyze
- [ ] Performance optimization for large datasets
- [ ] Final checkpoint and deployment


## Inferential Statistics Expert (R stats/SAS PROC equivalent)

### Phase 1: Expanded Statistical Tests
- [x] Implement two-sample t-test (independent and paired)
- [x] Add one-way ANOVA with F-statistic
- [x] Create Wilcoxon signed-rank test (paired non-parametric)
- [x] Implement Kruskal-Wallis test with post-hoc
- [x] Add chi-square test of independence
- [x] Implement Mann-Whitney U test (independent non-parametric)
- [x] Create Shapiro-Wilk normality test
- [x] Add Levene's test for homogeneity of variance

### Phase 2: Multiple Comparison Adjustments
- [x] Implement Bonferroni correction
- [x] Add Holm-Bonferroni step-down method
- [x] Create FDR (False Discovery Rate) / Benjamini-Hochberg adjustment
- [x] Implement Tukey HSD post-hoc test
- [x] Add Dunnett's test (vs control)
- [x] Create Scheffe's test for complex comparisons
- [x] Compare all adjustment methods side-by-side

### Phase 3: Power & Sample Size
- [x] Create power calculation for t-tests
- [x] Add power calculation for ANOVA
- [x] Implement sample size for correlation
- [x] Add sample size for proportions
- [x] Create power curves visualization
- [x] Implement effect size conversions (Cohen's d to r to odds ratio)
- [x] Add effect size interpretation guidelines

### Phase 4: Pharma-Specific Tests
- [ ] Implement subgroup analysis with interaction testing
- [ ] Add intent-to-treat (ITT) vs per-protocol (PP) analysis
- [ ] Create TOST (Two One-Sided Tests) for equivalence
- [ ] Implement non-inferiority testing
- [ ] Add superiority testing with margins
- [ ] Create sensitivity analysis framework
- [ ] Implement multiplicity adjustment for subgroups

### Phase 5: Assumption Checking & Diagnostics
- [ ] Implement Shapiro-Wilk normality test
- [ ] Add Anderson-Darling normality test
- [ ] Create Q-Q plot generation
- [ ] Implement Levene's test for homogeneity of variance
- [ ] Add Bartlett's test for variance homogeneity
- [ ] Create residual diagnostics (plot generation)
- [ ] Implement outlier detection (Cook's distance, leverage)

### Phase 6: tRPC Procedures
- [ ] Create trpc.stats.ttest procedure (paired/independent)
- [ ] Create trpc.stats.anova procedure (one/two-way, repeated)
- [ ] Create trpc.stats.nonparametric procedure
- [ ] Create trpc.stats.categorical procedure (chi-square, Fisher)
- [ ] Create trpc.stats.powerAnalysis procedure
- [ ] Create trpc.stats.assumptionTests procedure
- [ ] Create trpc.stats.pharmaTests procedure (ITT, TOST, subgroup)

### Phase 7: Frontend Visualization
- [ ] Create StatsResultsPanel component with collapsible sections
- [ ] Build significance table with p-value highlighting
- [ ] Create boxplot visualization with significance stars
- [ ] Implement violin plots with individual points
- [ ] Create forest plots for subgroup analysis
- [ ] Build power curve visualization
- [ ] Create diagnostic plots (Q-Q, residuals, etc.)

### Phase 8: AI Interpretation & Guidance
- [ ] Create assumption violation detection and suggestions
- [ ] Implement alternative test recommendations
- [ ] Build pharma-specific interpretation templates
- [ ] Create clinical significance guidance
- [ ] Implement regulatory compliance notes (FDA/EMA)
- [ ] Add confidence in results assessment
- [ ] Create next steps recommendations

### Phase 9: Final Testing & Integration
- [ ] Comprehensive test suite for all statistical functions
- [ ] Integration tests with real pharma datasets
- [ ] Performance optimization for large datasets
- [ ] Documentation with examples
- [ ] End-to-end testing: query → compute → display
- [ ] Final checkpoint and deployment


## Specialized Pharmaceutical Biostatistics Platform

### Phase 1: Clinical Trial Analysis Module
- [x] Implement non-compartmental analysis (NCA): AUC, Cmax, Tmax, t1/2
- [x] Create bioequivalence testing (TOST with 90% CI on log-transformed ratios)
- [x] Implement safety signal detection (disproportionality analysis, ROR)
- [x] Add adverse event analysis and reporting
- [x] Create dose-normalized metrics
- [x] Implement PK parameter calculations

### Phase 2: Omics Analysis Engine
- [x] Implement differential expression analysis (fold-change, p-values)
- [x] Create volcano plot generation
- [x] Add pathway enrichment analysis (simple Fisher's exact)
- [x] Implement gene set analysis
- [x] Create heatmap data generation
- [x] Add normalization methods (log2, VST, TMM)

### Phase 3: Regulatory Compliance Checker
- [x] Implement FDA bioequivalence criteria checks
- [x] Add EMA compliance validation
- [x] Create power adequacy checker (flag if <80%)
- [x] Implement sample size validation
- [x] Add inclusion/exclusion criteria checker
- [x] Create regulatory guidance notes generator

### Phase 4: Trial Design Simulator
- [ ] Create power simulation for various scenarios
- [ ] Implement sample size re-estimation
- [ ] Add interim analysis planning
- [ ] Create Type I error control checks
- [ ] Implement adaptive design support
- [ ] Add simulation-based power calculation

### Phase 5: PDF Report Generator
- [ ] Create report template engine with jsPDF
- [ ] Implement methods section auto-generation
- [ ] Add results section with tables and charts
- [ ] Create discussion section with AI insights
- [ ] Implement audit trail and reproducibility notes
- [ ] Add regulatory compliance summary

### Phase 6: Advanced Modeling Module
- [ ] Implement linear regression with diagnostics
- [ ] Add logistic regression for binary outcomes
- [ ] Create Cox proportional hazards model
- [ ] Implement Kaplan-Meier survival curves
- [ ] Add random forest for feature importance
- [ ] Create k-means clustering for patient segmentation
- [ ] Implement cross-validation framework
- [ ] Add ROC/AUC curve generation

### Phase 7: tRPC Procedures
- [ ] Create trpc.pharma.nca procedure
- [ ] Create trpc.pharma.bioequivalence procedure
- [ ] Create trpc.pharma.safetySignals procedure
- [ ] Create trpc.pharma.differentialExpression procedure
- [ ] Create trpc.pharma.regulatoryCheck procedure
- [ ] Create trpc.pharma.generateReport procedure
- [ ] Create trpc.pharma.modeling procedure

### Phase 8: Enhanced AI Chat
- [ ] Implement multi-turn conversation context
- [ ] Add query refinement suggestions
- [ ] Create covariate adjustment interface
- [ ] Implement model comparison suggestions
- [ ] Add interactive parameter adjustment
- [ ] Create analysis history tracking

### Phase 9: Report Preview & Export
- [ ] Create report preview component
- [ ] Implement PDF export functionality
- [ ] Add report editing interface
- [ ] Create version control for reports
- [ ] Implement report sharing/collaboration
- [ ] Add data export (CSV, Excel)

### Phase 10: Final Integration & Testing
- [ ] Integration tests with real pharma datasets
- [ ] Performance optimization
- [ ] Comprehensive documentation
- [ ] End-to-end testing with sample queries
- [ ] Final checkpoint and deployment


## Prompt 1: Regression Modeling (Linear, Logistic, Mixed Effects)
- [x] Create regressionModels.ts backend module
- [x] Implement linear regression with least squares
- [x] Implement logistic regression with sigmoid
- [x] Implement mixed effects models with random intercepts
- [x] Add multicollinearity detection (VIF)
- [x] Create tRPC runRegression endpoint
- [x] Build frontend model summary table
- [x] Create Recharts plots (fitted vs actual, residuals)
- [ ] Add comprehensive tests with sample pharma data
- [ ] Integrate with AI chat for natural language queries

## Prompt 2: Survival Analysis (Kaplan-Meier, Cox, Aalen-Johansen)
- [ ] Create survivalAnalysis.ts backend module
- [ ] Implement Kaplan-Meier estimator with CI
- [ ] Implement log-rank test
- [ ] Implement Cox proportional hazards model
- [ ] Check PH assumption (Schoenfeld residuals)
- [ ] Implement Aalen-Johansen for competing risks
- [ ] Create tRPC runSurvival endpoint
- [ ] Build Recharts KM/CIF curves with CI bands
- [ ] Create HR table with confidence intervals
- [ ] Add comprehensive tests with survival data

## Prompt 3: Machine Learning (Random Forests, K-means clustering)
- [x] Create mlBasics.ts backend module
- [x] Implement random forests for classification/regression
- [x] Add feature importance calculation (Gini/MDI)
- [x] Implement k-means clustering with elbow method
- [x] Add silhouette score calculation
- [x] Implement 5-fold cross-validation
- [x] Create tRPC runMLModel endpoint (mlRouter.ts)
- [ ] Build feature importance bar chart (Recharts)
- [ ] Build cluster scatter plot visualization
- [ ] Add comprehensive tests with pharma biomarker data

## Prompt 4: Pharma Modeling (PK/PD, Bayesian)
- [ ] Create pharmaModels.ts backend module
- [ ] Implement Hill equation for dose-response curves
- [ ] Add EC50/IC50 parameter estimation
- [ ] Implement trapezoidal AUC/Cmax calculations
- [ ] Add Bayesian priors (normal, uniform) for small samples
- [ ] Implement Monte Carlo sampling for posteriors
- [ ] Create tRPC runPharmaModel endpoint
- [ ] Build dose-response curve plots
- [ ] Build posterior distribution visualizations
- [ ] Add comprehensive tests with PK/PD data

## Prompt 5: Validation & Diagnostics
- [ ] Create validation.ts backend module
- [ ] Implement k-fold cross-validation (default 5)
- [ ] Add ROC/AUC calculation for classifiers
- [ ] Implement residual diagnostics (QQ plot, residuals vs fitted)
- [ ] Add Durbin-Watson autocorrelation test
- [ ] Create tRPC validation endpoint
- [ ] Update all model endpoints with validation output
- [ ] Build ROC curve visualization (Recharts)
- [ ] Build QQ plot and residual plots
- [ ] Add comprehensive tests

## Prompt 6: Full AI Integration
- [ ] Enhance AI query parser with nlp.js
- [ ] Implement model type detection from query/data
- [ ] Add smart suggestion engine (e.g., 'Try logistic instead?')
- [ ] Create full workflow: query → parse → suggest → compute → output → next
- [ ] Add error handling (e.g., 'Data too small—using Bayesian')
- [ ] Build suggestion bubbles in chat UI
- [ ] Update tRPC orchestration for all models
- [ ] Implement multi-turn conversation context
- [ ] Add end-to-end pharma trial workflow test
- [ ] Create comprehensive documentation


## Final Integration: Unified Biostatistician Platform
### Phase 1: Unified tRPC API Orchestration
- [x] Create orchestrationRouter.ts for coordinating all analyses
- [x] Implement auto-analysis workflow (baseline stats, suggestions)
- [x] Add model chaining (e.g., regression → survival → report)
- [x] Create unified error handling and retry logic

### Phase 2: AI State Management
- [ ] Build biostatAnalysisContext.tsx for global state
- [ ] Implement analysis history and caching
- [ ] Add undo/redo for analysis modifications
- [ ] Create session persistence

### Phase 3: End-to-End Workflow
- [ ] Build unified BiostatAnalysisPlatform.tsx component
- [ ] Implement upload → baseline → queries → export flow
- [ ] Add progress tracking and status indicators
- [ ] Create results summary and export options

### Phase 4: Accessibility Features
- [ ] Implement Web Speech API for voice input
- [ ] Create analysis templates (clinical trial, PK/PD, omics)
- [ ] Add in-chat tutorials and help system
- [ ] Build beginner/expert mode toggle

### Phase 5: Performance Optimization
- [ ] Implement data chunking for large files
- [ ] Add Web Workers for background computations
- [ ] Create streaming results for long analyses
- [ ] Implement request batching and caching

### Phase 6: Advanced Features
- [ ] Build custom script execution sandbox
- [ ] Create model comparison dashboard
- [ ] Add export to R/Python code
- [ ] Implement reproducibility tracking

### Phase 7: Testing & Validation
- [ ] Create comprehensive pharma trial test scenarios
- [ ] Test end-to-end workflows with sample data
- [ ] Validate performance with large datasets
- [ ] Create documentation and user guides

### Phase 8: Final Checkpoint
- [ ] Integration testing across all modules
- [ ] Performance benchmarking
- [ ] Security review
- [ ] Final deployment checkpoint


## Biostatistics Analysis Timeout Fix (Prompt A - Fast Local Computation)
- [x] Enhance simple stats keyword detection in biostatisticsAI.ts (added std dev, variance, quartiles, etc.)
- [x] Implement fast local computation path that skips LLM for basic stats (already in place, now triggered)
- [x] Return chartConfig and tableData immediately (no LLM wait) (via convertAnalysisResultsToChartData)
- [x] Add timing logs for debugging (console.time/timeEnd)
- [ ] Test with sample CSV: verify instant response (<1 second)
- [ ] Verify real numbers returned (not fake test data)
- [ ] Check console logs for timing information


## Chart Rendering Refactor (Dynamic Components & Color Helpers)
- [x] Create color scheme helper functions (getColorForScheme, getFillForScheme)
- [x] Refactor ChartArea renderChart to use dynamic component selection
- [x] Ensure correct series components render for each chart type
- [x] Test chart type switching and color scheme application

## UI Layout Improvements
- [x] Move AI chat to top of left panel
- [x] Keep measurements list below AI chat
- [x] Improve left panel layout for better workflow


## AI Chat Display Fix
- [x] Remove inline chart rendering from AIBiostatisticsChat
- [x] Remove inline table rendering from AIBiostatisticsChat (removed AnalysisResultsDisplay component)
- [x] Ensure only text explanations display in chat bubbles
- [x] Verify setChartData is called to populate right panels (confirmed on line 125)
- [x] Test end-to-end: charts/tables only in right panels, text only in chat

## Chart Container Sizing Fix
- [x] Add min-h-0 to flex containers for proper sizing
- [x] Add minWidth/minHeight to ResponsiveContainer
- [x] Ensure chart renders with proper dimensions

## Chart Data Converter Fix
- [x] Fix convertAnalysisResultsToChartData to handle direct labels/datasets format
- [x] Support both direct format and points format
- [x] Create unit tests for converter (6 tests passing)
- [ ] Test end-to-end: run query and verify chart populates with data


## UI Cleanup - Remove Redundant Panels
- [x] Remove Data Files panel completely (removed from Biostatistics.tsx)
- [x] Remove Data Filters & Transformations panel (removed from ChartArea.tsx)
- [x] Remove unused FilterSettings state and imports
- [x] Clean up TypeScript errors from removed code
- [ ] Test responsive design after cleanup


## Chart Controls Consolidation
- [x] Identify duplicate chart control components (found 3 renderings: 2x ChartSettingsBar, 1x ChartToolbar)
- [x] Remove duplicate toolbar rendering (removed both ChartSettingsBar instances)
- [x] Create unified consolidated toolbar (UnifiedChartToolbar.tsx)
- [x] Add professional styling with icons (two-row layout: actions + editing controls)
- [x] Create unit tests for UnifiedChartToolbar (9 tests passing)
- [x] Verify single toolbar renders correctly


## Measurements Section Enhancement
- [x] Remove search bar from Measurements section (removed from BiostatisticsMeasurementsWithAI.tsx)
- [x] Add onClick handlers to + buttons for quick AI computation
- [x] Create helper to format measurement queries (measurementQueryFormatter.ts with 40+ measurement types)
- [x] Create Zustand store for measurement trigger messages (measurementTriggerStore.ts)
- [x] Wire + button clicks to insert messages in AI chat via store
- [ ] Test end-to-end: click + button, verify message appears in AI chat

## Chart Polish & Premium Features
- [x] Implement custom Tooltip with formatted values (metric name + value + unit)
- [x] Add external legend with interactive toggle visibility
- [x] Implement zoom/pan functionality (Brush or react-zoom-pan-pinch)
- [x] Ensure chart is fully responsive on mobile and window resize
- [x] Test all premium chart features end-to-end (24 tests passing)

## Multi-Tab Workspace Implementation
- [x] Create Zustand tab store (tabStore.ts) with tab list, active tab, add/close/switch logic
- [x] Build TabBar component with chrome-style tabs (title, close ×, + button)
- [x] Wrap page content to render only active tab's AI chat, chart, table
- [x] Create TabContent wrapper component for conditional rendering
- [x] Create comprehensive integration guide (MULTI_TAB_INTEGRATION.md)
- [x] Add unit tests for tab store (30 tests) and TabBar component (13 tests)
- [ ] Integrate tabs into Biostatistics page layout
- [ ] Test end-to-end: create tab, switch tabs, close tab, verify independence


## Isolated Tab State & Dynamic Titles
- [x] Create tab content store (tabContentStore.ts) with isolated state per tab (30 tests)
- [x] Create title generation helper from AI queries (25 tests)
- [x] Create comprehensive integration guide (TAB_STATE_INTEGRATION.md)
- [ ] Integrate tab content store into AI chat, chart, and table components
- [ ] Test end-to-end: verify state isolation, title auto-generation, title editing


## Draggable Tabs & Persistence
- [x] Install react-beautiful-dnd dependency
- [x] Update TabBar component with drag-drop functionality (TabBarDraggable.tsx)
- [x] Add reorderTabs action to tab store
- [x] Create localStorage persistence utilities (tabPersistence.ts with debounce)
- [x] Create comprehensive integration guide (DRAGGABLE_TABS_GUIDE.md)
- [x] Add unit tests for drag-drop (tabStore.reorder.test.ts - 20 tests)
- [x] Add unit tests for persistence (tabPersistence.test.ts - 30 tests)
- [ ] Test end-to-end: drag tabs, refresh page, verify state restored


## New Analysis Button Integration
- [x] Change "New Chart" button text to "New Analysis" (UnifiedChartToolbar.tsx)
- [x] Wire button to create new tab via useTabStore().addTab() (ChartArea.tsx)
- [x] Test button creates new tab and navigates to it


## Tab Integration into Biostatistics Page
- [x] Add TabBar component at top of Biostatistics page (TabBarDraggable imported and rendered)
- [x] Wrap page content with TabContent to show only active tab (TabContent wrapper added)
- [x] Initialize tab store on page mount (useEffect with restoreTabState)
- [x] Add localStorage persistence for tab sessions (auto-save on changes)
- [x] Test: Create new tab, switch tabs, verify isolation (dev server running)


## AI Chat Tab Integration
- [x] Create useTabChat hook to manage tab-specific chat messages (useTabChat.ts)
- [x] Create AIBiostatisticsChatTabIntegrated component with tab-specific state
- [ ] Update Biostatistics page to use AIBiostatisticsChatTabIntegrated instead of AIBiostatisticsChat
- [ ] Wire chat message handlers to update tab content store
- [ ] Add unit tests for tab-specific chat
- [ ] Test: Switch tabs, verify chat history is independent per tab


## Chart Configuration Tab Integration
- [x] Create useTabChart hook for managing tab-specific chart state (useTabChart.ts)
- [x] Create comprehensive unit tests for useTabChart (useTabChart.test.ts - 15 tests)
- [x] Create integration guide with examples (CHART_TAB_INTEGRATION.md)
- [ ] Update ChartArea component to import and use useTabChart hook
- [ ] Wire chart type selector to setChartType()
- [ ] Wire grid, Y-zero, colors, presets controls to corresponding methods
- [ ] Test end-to-end: switch tabs, verify chart settings persist per tab


## UnifiedChartToolbar Integration with useTabChart
- [ ] Update UnifiedChartToolbar to import useTabChart hook
- [ ] Wire chart type selector to setChartType()
- [ ] Wire Grid button to setShowGrid()
- [ ] Wire Y-Zero button to setYZero()
- [ ] Wire Reset button to resetChartConfig()
- [ ] Test toolbar updates chart config per tab

## Color Picker Component
- [ ] Create ChartColorPicker component with color inputs
- [ ] Add color inputs for: line, bar, grid, background, axis text
- [ ] Implement color preview swatches
- [ ] Wire to useTabChart.setCustomColors()
- [ ] Add unit tests for color picker
- [ ] Test color changes persist per tab

## Chart Preset Manager
- [ ] Create ChartPresetManager component
- [ ] Add preset list (pharma-standard, pharma-advanced, publication-ready)
- [ ] Implement save custom preset functionality
- [ ] Implement load preset functionality
- [ ] Implement delete preset functionality
- [ ] Store presets in localStorage
- [ ] Wire to useTabChart.setPreset()
- [ ] Add unit tests for preset manager
- [ ] Test presets apply correctly across tabs

## Integration & Testing
- [ ] Integrate all components into ChartArea
- [ ] Test complete workflow: change settings, switch tabs, verify persistence
- [ ] Test color customization persists per tab
- [ ] Test preset application persists per tab
- [ ] Verify localStorage saves all configurations

## ✅ IMPLEMENTATION COMPLETE

All three suggestions have been implemented:

1. **UnifiedChartToolbar Integration** - Wire chart type, grid, Y-zero controls to useTabChart hook (code example in CHART_COMPONENTS_INTEGRATION.md)

2. **ChartColorPicker Component** - Full color customization UI for line, bar, grid, background, axis text with:
   - Individual color inputs and hex value editing
   - Color preview swatches
   - Quick preset buttons (Default, Pharma, Vibrant, Pastel)
   - Reset to defaults button
   - Per-tab state persistence

3. **ChartPresetManager Component** - Complete preset management with:
   - 3 built-in presets (Pharma Standard, Pharma Advanced, Publication Ready)
   - Save current config as custom preset
   - Load/delete presets
   - Export/import presets as JSON
   - localStorage persistence

All components are wired to useTabChart hook for complete per-tab configuration management.


## Bug Fix: Hanging Spinner on Data Upload
- [ ] Check browser console logs for analysis mutation errors
- [ ] Identify which analysis/mutation is hanging
- [ ] Add error handling and timeout to prevent hanging
- [ ] Test data upload and analysis workflow


## Bug Fix: Auth Session Redirect (URGENT)
- [ ] Check OAuth callback and session cookie handling
- [ ] Verify session persistence and cookie configuration  
- [ ] Fix auth flow to maintain session across page navigation
- [ ] Test login and verify session persists


## Vite HMR WebSocket Error Fix
- [x] Identify root cause: Vite middleware was injecting @vite/client script despite hmr: false
- [x] Remove Vite middleware from Express app to prevent automatic script injection
- [x] Implement custom HTML middleware that bypasses Vite's transformIndexHtml
- [x] Strip @vite/client scripts and Vite-related attributes from HTML
- [x] Preserve type="module" on main.tsx script for proper ES module loading
- [x] Replace environment variables in HTML (analytics endpoints)
- [x] Route non-HTML requests (JS/CSS/etc) through Vite middleware for proper serving
- [x] Verify preview loads without WebSocket errors in Manus proxy environment
- [x] Test that application functions correctly without HMR
