'use client';

import { useState } from 'react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useBiostatisticsStore } from '@/stores/biostatisticsStore';
import { useBiostatStore } from '@/stores/biostatStore';
// NEW: Tab isolation imports — required for per-project tab save/restore
import { useTabStore } from '@/stores/tabStore';
import { useTabContentStore } from '@/stores/tabContentStore';
// NEW: restore AI-generated results (charts, tables, interpretations) on project switch
import { useAIPanelStore } from '@/stores/aiPanelStore';
import {
  saveProjectTabSnapshot,
  loadProjectTabSnapshot,
} from '@/utils/tabPersistence';

interface BiostatProjectsSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function BiostatProjectsSidebar({ isOpen, onToggle }: BiostatProjectsSidebarProps) {
  const { projects, activeProjectId, setActiveProject, createProject, deleteProject } = useBiostatisticsStore();
  const { sidebarOpen: isMainSidebarOpen } = useBiostatStore();
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // NEW: Tab store access for per-project isolation
  const { tabs, activeTabId, clearAllTabs } = useTabStore();
  const { tabContent } = useTabContentStore();

  // NEW: Save current project's tabs, clear state, then restore the target project's tabs.
  // Mirrors the same logic in ChartHeader.handleSwitchProject so both entry points
  // (top-bar dropdown and this sidebar) behave identically.
  const handleSwitchProject = (newProjectId: string) => {
    if (newProjectId === activeProjectId) return;

    // 1. Snapshot the tabs we're leaving
    if (activeProjectId) {
      saveProjectTabSnapshot(activeProjectId, tabs, activeTabId, tabContent);
    }

    // 2. Commit the project switch
    setActiveProject(newProjectId);

    // 3a. Restore the new project's previously-saved tabs (if any)
    const snapshot = loadProjectTabSnapshot(newProjectId);
    if (snapshot && snapshot.tabs.length > 0) {
      clearAllTabs(); // tear down old in-memory tab state in sibling stores
      useTabStore.setState({ tabs: snapshot.tabs, activeTabId: snapshot.activeTabId });
      useTabContentStore.setState({ tabContent: snapshot.tabContent });
      // NEW: restore AI-generated results so switching back shows previous outputs
      // REMOVED: was missing — panel results were always lost on project switch
      if (snapshot.aiPanelData) {
        useAIPanelStore.setState({
          resultsByTab:        snapshot.aiPanelData.resultsByTab,
          activeResultIdByTab: snapshot.aiPanelData.activeResultIdByTab,
          customizationsByTab: snapshot.aiPanelData.customizationsByTab,
        });
      }
    } else {
      // 3b. New or first-visit project — auto-create one default tab so the user can start immediately
      clearAllTabs();
      useTabStore.getState().addTab();
    }
  };

  // NEW: Save current tabs before creating the new project, then auto-create one default tab.
  // REMOVED: was calling createProject() directly, which left old tabs visible.
  const handleCreateProject = () => {
    const name = newProjectName.trim();
    if (!name) return;

    // Save current project's tabs before switching away
    if (activeProjectId) {
      saveProjectTabSnapshot(activeProjectId, tabs, activeTabId, tabContent);
    }

    // createProject internally sets activeProjectId to the new project's id
    createProject(name, 'New biostatistics project');

    // NEW: auto-create first tab for the new project so it's immediately ready
    // REMOVED: was clearAllTabs() only, leaving the tab bar empty on new project
    clearAllTabs();
    useTabStore.getState().addTab();

    setNewProjectName('');
    setShowNewProjectForm(false);
  };

  // Calculate left position based on MAIN sidebar state (not projects drawer state)
  // Main sidebar is 16rem (256px) when open, 4rem (64px) when collapsed
  // BiostatSidebar uses w-64 (256px) when open, but it's a fixed sidebar that doesn't collapse
  // For the Biostatistics page, main sidebar is always w-64 (256px) based on line 384 ml-64
  // However, we need to account for potential collapse in the future
  const mainSidebarWidth = isMainSidebarOpen ? 256 : 64;
  const leftPixels = mainSidebarWidth;
  const toggleLeftPixels = mainSidebarWidth;

  return (
    <>
      {/* Toggle Button - Fixed on sidebar's right edge, syncs with main sidebar collapse */}
      <div
        className="fixed top-20 z-50 transition-all duration-300 ease-in-out hidden lg:block"
        style={{ left: `${toggleLeftPixels}px` }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <button
          onClick={onToggle}
          className={`bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-r-lg transition-all duration-300 flex items-center gap-2 ${
            isHovering ? 'pl-4 pr-4' : 'pl-2 pr-2'
          }`}
          title={isOpen ? 'Close projects' : 'Open projects'}
        >
          <ChevronRight className={`w-5 h-5 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
          {isHovering && <span className="text-sm font-medium whitespace-nowrap">Projects</span>}
        </button>
      </div>

      {/* Projects Drawer - Slides out from behind main sidebar, syncs with main sidebar collapse */}
      <div
        className={`fixed top-0 bottom-0 w-80 bg-white border-r border-gray-200 shadow-lg z-30 transition-all duration-300 ease-in-out overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ left: `${leftPixels}px` }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
          <h2 className="text-lg font-bold text-gray-900">Projects</h2>
          <p className="text-sm text-gray-600">{projects.length} project(s)</p>
        </div>

        {/* Projects List */}
        <div className="p-4 space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              // NEW: was setActiveProject(project.id) — now saves current tabs and restores this project's tabs
              onClick={() => handleSwitchProject(project.id)}
              className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                activeProjectId === project.id
                  ? 'bg-blue-50 border-2 border-blue-500'
                  : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
              }`}
              role="button"
              aria-current={activeProjectId === project.id ? 'page' : undefined}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
                  <p className="text-xs text-gray-600 line-clamp-2">{project.description}</p>
                  {project.uploadedDataName && (
                    <p className="text-xs text-blue-600 mt-2">📊 {project.uploadedDataName}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Created: {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProject(project.id);
                  }}
                  className="ml-2 p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Delete project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* New Project Form */}
        <div className="border-t border-gray-200 p-4">
          {!showNewProjectForm ? (
            <button
              onClick={() => setShowNewProjectForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProject();
                  if (e.key === 'Escape') {
                    setShowNewProjectForm(false);
                    setNewProjectName('');
                  }
                }}
                placeholder="Project name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  // NEW: uses handleCreateProject (saves current tabs, creates, clears)
                  // REMOVED: was createProject(...) directly which left old tabs visible
                  onClick={handleCreateProject}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg transition-colors text-sm font-medium"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewProjectForm(false);
                    setNewProjectName('');
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 py-2 px-3 rounded-lg transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
