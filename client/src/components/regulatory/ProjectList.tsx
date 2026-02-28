import { useRegulatoryStore } from '@/stores/regulatoryStore';
import { Plus, Trash2, FileText } from 'lucide-react';
import { useState } from 'react';

export default function ProjectList() {
  const projects = useRegulatoryStore((state) => state.projects);
  const activeProjectId = useRegulatoryStore((state) => state.activeProjectId);
  const setActiveProject = useRegulatoryStore((state) => state.setActiveProject);
  const createProject = useRegulatoryStore((state) => state.createProject);
  const deleteProject = useRegulatoryStore((state) => state.deleteProject);

  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      createProject(newProjectName, newProjectDesc);
      setNewProjectName('');
      setNewProjectDesc('');
      setShowNewProject(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
            <p className="text-sm text-gray-600 mt-1">{projects.length} regulatory document project(s)</p>
          </div>
          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* New Project Form */}
        {showNewProject && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-3">Create New Project</h3>
            <input
              type="text"
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <textarea
              placeholder="Project description (optional)"
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 h-20 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateProject}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowNewProject(false);
                  setNewProjectName('');
                  setNewProjectDesc('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Projects List */}
        <div className="space-y-2">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => setActiveProject(project.id)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                activeProjectId === project.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">{project.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span>
                      {project.regulatoryStandard === 'US' ? '🇺🇸 US FDA' : '🇪🇺 EU EMA'}
                    </span>
                    <span>
                      {project.paperLayout === 'eSTAR' ? 'FDA eSTAR' : 'Document Format'}
                    </span>
                    <span>{project.attachedFiles.length} file(s)</span>
                    <span>Updated: {project.updatedAt.toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProject(project.id);
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {projects.length === 0 && !showNewProject && (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No projects yet. Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
