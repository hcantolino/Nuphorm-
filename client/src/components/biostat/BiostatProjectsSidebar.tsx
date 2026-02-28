'use client';

import { useState } from 'react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useBiostatisticsStore } from '@/stores/biostatisticsStore';
import { useBiostatStore } from '@/stores/biostatStore';

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
              onClick={() => setActiveProject(project.id)}
              className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                activeProjectId === project.id
                  ? 'bg-blue-50 border-2 border-blue-500'
                  : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
              }`}
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
                placeholder="Project name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (newProjectName.trim()) {
                      createProject(newProjectName, 'New biostatistics project');
                      setNewProjectName('');
                      setShowNewProjectForm(false);
                    }
                  }}
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
