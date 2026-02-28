/**
 * ChartHeader — minimal, modern project top bar
 *
 * Layout:  [Project Name ▾]  ·  · · ·  [⚙]  [Feedback]
 *
 * CHANGES from the previous multi-row design:
 *  • Project name appears ONCE — as a large clickable title + chevron
 *  • The dropdown contains: current project (rename inline), other projects
 *    (rename / delete on hover), "Edit Project Context" action, New Project
 *  • "Edit Project Context" opens the ProjectContextPanel right-drawer instead
 *    of the old always-visible Row 2 instructions/sources section (removed)
 *  • ⚙ icon button is a secondary shortcut to open the same drawer, with an
 *    active dot when instructions or sources are configured
 *  • No standalone pencil icons in the main header — all editing is in dropdown
 *  • Keyboard: Radix DropdownMenu handles ↑↓ / Enter / Escape natively
 *  • Mobile: title truncates at max-w-[55%], dropdown is right-aligned on narrow
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  ChevronDown,
  Check,
  MessageSquare,
  Trash2,
  Settings2,
  Pencil,
  BookOpen,
  Shield,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useBiostatStore } from '@/stores/biostatStore';
import { useBiostatisticsStore } from '@/stores/biostatisticsStore';
import { useProjectStore } from '@/stores/projectStore';
import { useTabStore } from '@/stores/tabStore';
import { useTabContentStore } from '@/stores/tabContentStore';
import {
  saveProjectTabSnapshot,
  loadProjectTabSnapshot,
  deleteProjectTabSnapshot,
} from '@/utils/tabPersistence';
import { generateSimpleReport, getAIInterpretation } from '@/services/simpleReportGenerator';
import { addChartToStorage, addProjectToStorage, getProjectFromStorage } from '@/services/filePersistence';
import type { SavedChart, ChartSet } from '@/services/biostatFileManager';
import FeedbackModal, { FeedbackData } from './FeedbackModal';
import ProjectContextPanel from './ProjectContextPanel';
import ComplianceModePanel from './ComplianceModePanel';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ChartHeader() {
  const { chartTitle, setChartTitle, data, selectedVariables } = useBiostatStore();
  const {
    projects,
    activeProjectId,
    setActiveProject,
    createProject,
    deleteProject,
    renameProject,
  } = useBiostatisticsStore();
  const { getSettings } = useProjectStore();

  // ADDED: Tab store access for per-project isolation
  const { tabs, activeTabId: tabActiveId, clearAllTabs } = useTabStore();
  const { tabContent } = useTabContentStore();

  // ── Dropdown state ─────────────────────────────────────────────────────────
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');

  // ── Panels ─────────────────────────────────────────────────────────────────
  /** Controls the "Edit Project Context" right-drawer */
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  /** Controls the Compliance Mode right-drawer */
  const [compliancePanelOpen, setCompliancePanelOpen] = useState(false);
  const [complianceModeActive, setComplianceModeActive] = useState(false);

  // ── Report / feedback ──────────────────────────────────────────────────────
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const submitFeedbackMutation = trpc.feedback.submitFeedback.useMutation();

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const otherProjects = projects.filter((p) => p.id !== activeProjectId);
  const projectSettings = activeProjectId
    ? getSettings(activeProjectId)
    : { instructions: '', sources: [] };
  const hasContext =
    projectSettings.instructions.trim().length > 0 ||
    projectSettings.sources.length > 0;

  // Keep chartTitle in sync (used by report/save)
  useEffect(() => {
    if (activeProject?.name) setChartTitle(activeProject.name);
  }, [activeProject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Project switching helpers ───────────────────────────────────────────────

  /**
   * ADDED: Save the current project's tab state, then switch to a new project
   * and restore its previously-saved tabs (or start empty).
   */
  const handleSwitchProject = (newProjectId: string) => {
    if (newProjectId === activeProjectId) return;

    // 1. Snapshot the current project's tabs before leaving
    if (activeProjectId) {
      saveProjectTabSnapshot(activeProjectId, tabs, tabActiveId, tabContent);
    }

    // 2. Switch the active project in the store
    setActiveProject(newProjectId);

    // 3a. Restore the new project's saved tabs (if any)
    const snapshot = loadProjectTabSnapshot(newProjectId);
    if (snapshot && snapshot.tabs.length > 0) {
      clearAllTabs(); // clean up old tab state in sibling stores
      useTabStore.setState({ tabs: snapshot.tabs, activeTabId: snapshot.activeTabId });
      useTabContentStore.setState({ tabContent: snapshot.tabContent });
    } else {
      // 3b. No saved tabs → empty slate; user clicks "+" to open their first tab
      clearAllTabs();
    }
  };

  // ── Project rename ─────────────────────────────────────────────────────────

  /**
   * UPDATED: Save current project tabs before creating & switching to new project.
   */
  const handleCreateProject = () => {
    const name = newProjectName.trim() || `Project ${projects.length + 1}`;

    // Save current project's tabs before switching away
    if (activeProjectId) {
      saveProjectTabSnapshot(activeProjectId, tabs, tabActiveId, tabContent);
    }

    // createProject internally sets activeProjectId to the new project's id
    createProject(name, 'New biostatistics project');

    // New project has no tabs — start with empty slate
    clearAllTabs();

    setNewProjectName('');
    setShowNewProjectInput(false);
    toast.success(`Project "${name}" created`);
  };

  /**
   * ADDED: Delete the active project, clean up its snapshot, and restore the
   * next-in-line project's saved tabs (or start empty).
   */
  const handleDeleteActiveProject = () => {
    if (!activeProjectId || projects.length <= 1) return;

    const remaining = projects.filter((p) => p.id !== activeProjectId);
    const nextProjectId = remaining[0]?.id;

    // Remove the deleted project's tab snapshot from localStorage
    deleteProjectTabSnapshot(activeProjectId);

    // biostatisticsStore auto-switches activeProjectId to remaining[0]
    deleteProject(activeProjectId);

    if (nextProjectId) {
      const snapshot = loadProjectTabSnapshot(nextProjectId);
      if (snapshot && snapshot.tabs.length > 0) {
        clearAllTabs();
        useTabStore.setState({ tabs: snapshot.tabs, activeTabId: snapshot.activeTabId });
        useTabContentStore.setState({ tabContent: snapshot.tabContent });
      } else {
        clearAllTabs();
      }
    } else {
      clearAllTabs();
    }
  };

  const handleSaveProjectRename = useCallback(
    (projectId: string) => {
      const trimmed = editingProjectName.trim();
      if (trimmed) {
        renameProject(projectId, trimmed);
        if (projectId === activeProjectId) setChartTitle(trimmed);
      }
      setEditingProjectId(null);
      setEditingProjectName('');
    },
    [editingProjectName, activeProjectId, renameProject, setChartTitle]
  );

  // ── Report / save / feedback ───────────────────────────────────────────────
  const handleSaveAsFile = async () => {
    if (!activeProjectId) { alert('Please select or create a project first.'); return; }
    if (selectedVariables.length === 0) { alert('Please select at least one measurement before saving.'); return; }
    setIsSavingFile(true);
    try {
      const allProjects = useBiostatisticsStore.getState().projects;
      const proj = allProjects.find((p) => p.id === activeProjectId);
      if (!proj) { alert('Project not found.'); return; }
      const projectFolder = getProjectFromStorage(activeProjectId) || { projectId: activeProjectId, projectName: proj.name, createdAt: new Date().toISOString(), chartSets: [] };
      const chartSetId = `chartset-${Date.now()}`;
      const chartSetName = `Chart Set - ${new Date().toLocaleDateString()}`;
      const chartSet: ChartSet = { id: chartSetId, name: chartSetName, charts: [], createdAt: new Date().toISOString() };
      const savedChart: SavedChart = { id: `chart-${Date.now()}`, projectId: activeProjectId, projectName: proj.name, chartSetId, chartSetName, chartTitle, chartType: 'line', data, selectedVariables, dataFiles: proj.uploadedDataName ? [proj.uploadedDataName] : [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      chartSet.charts.push(savedChart);
      projectFolder.chartSets.push(chartSet);
      addProjectToStorage(projectFolder);
      addChartToStorage(savedChart);
      alert(`Chart saved successfully!\n\nProject: ${proj.name}\nChart: ${chartTitle}`);
    } catch (error) {
      console.error('Failed to save file:', error);
      alert('Failed to save file. Please try again.');
    } finally {
      setIsSavingFile(false);
    }
  };

  const handleFeedbackSubmit = async (feedback: FeedbackData) => {
    try {
      await submitFeedbackMutation.mutateAsync({ ...feedback, page: 'biostatistics' });
      toast.success('Thank you for your feedback!');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Failed to submit feedback');
      throw error;
    }
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const measurementNames = selectedVariables.map((v) => v.name);
      const statistics: Record<string, number> = {};
      selectedVariables.forEach((variable) => {
        const values = data.map((row) => row[variable.name]).filter((val) => typeof val === 'number') as number[];
        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          const mean = sum / values.length;
          const variance = values.reduce((s, val) => s + Math.pow(val - mean, 2), 0) / values.length;
          statistics[`${variable.name}_mean`] = mean;
          statistics[`${variable.name}_stdDev`] = Math.sqrt(variance);
          statistics[`${variable.name}_min`] = Math.min(...values);
          statistics[`${variable.name}_max`] = Math.max(...values);
        }
      });
      const aiInterpretation = getAIInterpretation(measurementNames, statistics);
      generateSimpleReport({ title: chartTitle, measurements: measurementNames, dataFiles: ['Clinical_Trial_Data.csv'], statistics, aiInterpretation });
      alert('Report generated successfully! Check your downloads folder.');
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Single header row ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-5 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-2">

          {/* ── Project title + dropdown trigger ─────────────────────────── */}
          <DropdownMenu
            onOpenChange={(open) => {
              if (!open) {
                // Reset ephemeral state when dropdown closes
                setShowNewProjectInput(false);
                setEditingProjectId(null);
                setEditingProjectName('');
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <button
                className="group flex items-center gap-1 -ml-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-left min-w-0 max-w-[55%] sm:max-w-sm"
                title="Switch or manage project"
              >
                <h1 className="text-lg font-semibold text-gray-900 truncate leading-tight">
                  {activeProject?.name ?? 'Select Project'}
                </h1>
                <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0 transition-colors" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className="w-80 max-h-[520px] overflow-y-auto shadow-xl rounded-xl border border-gray-200"
              align="start"
              sideOffset={6}
            >
              {/* ── Current project ── */}
              <div className="px-2 pt-2.5 pb-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
                  Current Project
                </p>

                {editingProjectId === activeProjectId ? (
                  // Inline rename for active project
                  <div
                    className="flex items-center gap-1.5 px-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      type="text"
                      value={editingProjectName}
                      onChange={(e) => setEditingProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') handleSaveProjectRename(activeProjectId!);
                        if (e.key === 'Escape') {
                          setEditingProjectId(null);
                          setEditingProjectName('');
                        }
                      }}
                      onBlur={() => handleSaveProjectRename(activeProjectId!)}
                      className="flex-1 text-sm font-medium border border-blue-400 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 bg-white"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSaveProjectRename(activeProjectId!); }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="group/active flex items-center gap-1 px-2.5 py-2 rounded-lg bg-blue-50 border border-blue-100">
                    <span className="text-sm font-semibold text-blue-800 truncate flex-1 mr-1">
                      {activeProject?.name ?? '—'}
                    </span>
                    {activeProjectId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProjectId(activeProjectId);
                          setEditingProjectName(activeProject?.name ?? '');
                        }}
                        className="p-1 text-blue-300 hover:text-blue-600 hover:bg-blue-100 rounded opacity-0 group-hover/active:opacity-100 transition-all flex-shrink-0"
                        title="Rename project"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {projects.length > 1 && activeProjectId && (
                      <button
                        // CHANGED: was deleteProject(activeProjectId) — now also clears tabs and restores next project's tabs
                        onClick={(e) => { e.stopPropagation(); handleDeleteActiveProject(); }}
                        className="p-1 text-blue-200 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover/active:opacity-100 transition-all flex-shrink-0"
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ── Edit Project Context ── */}
              <div className="px-2 pb-1.5">
                <button
                  onClick={() => setContextPanelOpen(true)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-left"
                >
                  <BookOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="flex-1">Edit Project Context</span>
                  <span className="text-[10px] text-gray-400">AI rules & sources</span>
                  {hasContext && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                </button>

                {/* Compliance Mode toggle */}
                <button
                  onClick={() => {
                    setComplianceModeActive((v) => !v);
                    setCompliancePanelOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-left"
                >
                  <Shield className="w-4 h-4 text-[#1E3A5F] flex-shrink-0" />
                  <span className="flex-1">Compliance Mode</span>
                  <span className="text-[10px] text-gray-400">GLP/GCP · eCTD</span>
                  {complianceModeActive && (
                    <span className="w-2 h-2 rounded-full bg-[#1E3A5F] flex-shrink-0" />
                  )}
                </button>
              </div>

              {/* ── Switch to another project ── */}
              {otherProjects.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-3 pt-1.5 pb-0.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Switch Project
                    </p>
                  </div>
                  {otherProjects.map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      // CHANGED: was setActiveProject — now saves+clears current tabs and restores new project's tabs
                      onSelect={() => handleSwitchProject(project.id)}
                      className="group/item mx-1 rounded-lg flex items-center gap-2 py-2 cursor-pointer"
                    >
                      {editingProjectId === project.id ? (
                        <div
                          className="flex items-center gap-1 flex-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            autoFocus
                            type="text"
                            value={editingProjectName}
                            onChange={(e) => setEditingProjectName(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') handleSaveProjectRename(project.id);
                              if (e.key === 'Escape') {
                                setEditingProjectId(null);
                                setEditingProjectName('');
                              }
                            }}
                            onBlur={() => handleSaveProjectRename(project.id)}
                            className="flex-1 text-sm border border-blue-400 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0"
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSaveProjectRename(project.id); }}
                            className="p-0.5 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{project.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(project.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingProjectId(project.id);
                                setEditingProjectName(project.name);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                              title="Rename"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              // CHANGED: also remove that project's localStorage snapshot
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteProjectTabSnapshot(project.id);
                                deleteProject(project.id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </DropdownMenuItem>
                  ))}
                </>
              )}

              {/* ── New Project ── */}
              <DropdownMenuSeparator />
              {showNewProjectInput ? (
                <div
                  className="px-2 py-2 space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateProject();
                      if (e.key === 'Escape') setShowNewProjectInput(false);
                    }}
                    placeholder="Project name…"
                    autoFocus
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateProject}
                      className="flex-1 text-xs bg-blue-600 text-white py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setShowNewProjectInput(false)}
                      className="flex-1 text-xs bg-gray-100 text-gray-700 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <DropdownMenuItem
                  onSelect={(e) => { e.preventDefault(); setShowNewProjectInput(true); }}
                  className="mx-1 rounded-lg text-blue-600 font-medium cursor-pointer"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Spacer */}
          <div className="flex-1" />

          {/* ── Shield — Compliance Mode shortcut ──────────────────────── */}
          <button
            onClick={() => setCompliancePanelOpen(true)}
            className={cn(
              'relative p-2 rounded-lg transition-colors flex-shrink-0',
              compliancePanelOpen
                ? 'bg-[#1E3A5F]/10 text-[#1E3A5F]'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            )}
            title="Compliance Mode (GLP/GCP audit trail, validation, reports)"
          >
            <Shield className="w-4 h-4" />
            {complianceModeActive && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#1E3A5F] pointer-events-none" />
            )}
          </button>

          {/* ── ⚙ Project context shortcut ──────────────────────────────── */}
          {/* Secondary way to open the context drawer; shows active dot when
              instructions or sources are set for the current project. */}
          <button
            onClick={() => setContextPanelOpen(true)}
            className={cn(
              'relative p-2 rounded-lg transition-colors flex-shrink-0',
              contextPanelOpen
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            )}
            title="Edit project context (AI instructions & shared sources)"
          >
            <Settings2 className="w-4 h-4" />
            {hasContext && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-500 pointer-events-none" />
            )}
          </button>

          {/* ── Feedback ──────────────────────────────────────────────────── */}
          <button
            onClick={() => setShowFeedbackModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            title="Send feedback"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Feedback</span>
          </button>
        </div>
      </div>

      {/* ── Project Context Drawer ──────────────────────────────────────────── */}
      <ProjectContextPanel
        open={contextPanelOpen}
        onClose={() => setContextPanelOpen(false)}
        projectId={activeProjectId}
        projectName={activeProject?.name}
      />

      {/* ── Compliance Mode Drawer ──────────────────────────────────────────── */}
      <ComplianceModePanel
        open={compliancePanelOpen}
        onClose={() => setCompliancePanelOpen(false)}
        studyId={activeProjectId}
        projectName={activeProject?.name}
      />

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSubmit={handleFeedbackSubmit}
        isLoading={submitFeedbackMutation.isPending}
      />
    </>
  );
}
