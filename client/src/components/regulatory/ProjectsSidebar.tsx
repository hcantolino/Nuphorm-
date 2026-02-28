'use client';

import { useState } from 'react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useRegulatoryStore } from '@/stores/regulatoryStore';

interface ProjectsSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function ProjectsSidebar({ isOpen, onToggle }: ProjectsSidebarProps) {
  const { projects, activeProjectId, setActiveProject, createProject, deleteProject } = useRegulatoryStore();
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const handleAddProject = () => {
    if (newProjectName.trim()) {
      createProject(newProjectName, 'New regulatory project');
      setNewProjectName('');
      setShowNewProjectForm(false);
    }
  };

  return (
    <>
      {/* Toggle Button with Hover Expansion - Positioned on sidebar's right edge */}
      <div
        className="fixed left-64 top-8 z-50 transition-all duration-300 hidden lg:block"
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

      {/* Sidebar Drawer - Side panel positioned from sidebar's right edge */}
      <div
        className={`fixed left-64 top-0 h-screen w-72 bg-white border-r border-gray-200 shadow-lg z-20 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } overflow-y-auto pointer-events-auto`}
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
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                      {project.regulatoryStandard === 'US' ? '🇺🇸 US FDA' : '🇪🇺 EU EMA'}
                    </span>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                      {project.paperLayout === 'eSTAR' ? 'FDA eSTAR' : 'Document Format'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {project.attachedFiles?.length || 0} file(s) • Updated: {new Date(project.updatedAt).toLocaleDateString()}
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
                  onClick={handleAddProject}
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

      {/* No overlay - drawer should not cover page content */}
    </>
  );
}
