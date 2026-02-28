import { useState, useEffect } from "react";
import {
  Search,
  Grid3x3,
  List,
  Download,
  Trash2,
  Eye,
  Upload,
  Filter,
  ChevronDown,
  File,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  Folder,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { loadProjectsFromStorage, loadChartsFromStorage, deleteChartFromStorage, deleteChartSetFromStorage, deleteProjectFromStorage, exportChartAsJSON, exportChartAsCSV } from "@/services/filePersistence";
import type { ProjectFolder, ChartSet, SavedChart } from "@/services/biostatFileManager";
import DocumentViewer from "@/components/DocumentViewer";

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: Date;
  category: "regulatory" | "biostatistics" | "general";
  preview?: string;
  url?: string;
}

type ViewMode = "grid" | "list" | "projects";
type SortBy = "date" | "name" | "size";

const mockFiles: FileItem[] = [
  {
    id: "1",
    name: "Clinical_Trial_Protocol_v2.pdf",
    type: "pdf",
    size: 2.4,
    uploadDate: new Date(2026, 0, 20),
    category: "regulatory",
    url: "/sample-documents/protocol.pdf",
  },
  {
    id: "2",
    name: "Patient_Demographics.csv",
    type: "csv",
    size: 0.45,
    uploadDate: new Date(2026, 0, 19),
    category: "biostatistics",
  },
  {
    id: "3",
    name: "Safety_Analysis_Data.xlsx",
    type: "xlsx",
    size: 1.8,
    uploadDate: new Date(2026, 0, 18),
    category: "biostatistics",
  },
  {
    id: "4",
    name: "Device_Specifications.docx",
    type: "docx",
    size: 0.92,
    uploadDate: new Date(2026, 0, 17),
    category: "regulatory",
  },
  {
    id: "5",
    name: "Statistical_Report.pdf",
    type: "pdf",
    size: 3.2,
    uploadDate: new Date(2026, 0, 16),
    category: "biostatistics",
    url: "/sample-documents/report.pdf",
  },
  {
    id: "6",
    name: "Regulatory_Submission.pdf",
    type: "pdf",
    size: 5.1,
    uploadDate: new Date(2026, 0, 15),
    category: "regulatory",
    url: "/sample-documents/submission.pdf",
  },
];

export default function SavedFiles() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>(mockFiles);
  const [dragActive, setDragActive] = useState(false);
  const [projects, setProjects] = useState<ProjectFolder[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedChartSets, setExpandedChartSets] = useState<Set<string>>(new Set());

  // Load biostatistics projects on mount
  useEffect(() => {
    loadProjectsFromStorage();
    const loadedProjects = loadProjectsFromStorage();
    setProjects(loadedProjects);
  }, []);

  // Filter and sort files
  const filteredFiles = files
    .filter((file) => {
      const matchesSearch = file.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || file.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "size":
          return b.size - a.size;
        case "date":
        default:
          return b.uploadDate.getTime() - a.uploadDate.getTime();
      }
    });

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this file?")) {
      setFiles(files.filter((f) => f.id !== id));
    }
  };

  const handleDeleteChart = (chartId: string) => {
    if (confirm("Are you sure you want to delete this chart?")) {
      deleteChartFromStorage(chartId);
      const loadedProjects = loadProjectsFromStorage();
      setProjects(loadedProjects);
    }
  };

  const handleDeleteChartSet = (projectId: string, chartSetId: string) => {
    if (confirm("Are you sure you want to delete this chart set and all its charts?")) {
      deleteChartSetFromStorage(projectId, chartSetId);
      const loadedProjects = loadProjectsFromStorage();
      setProjects(loadedProjects);
    }
  };

  const handleDeleteProject = (projectId: string) => {
    if (confirm("Are you sure you want to delete this entire project and all its charts?")) {
      deleteProjectFromStorage(projectId);
      const loadedProjects = loadProjectsFromStorage();
      setProjects(loadedProjects);
    }
  };

  const handlePreview = (file: FileItem) => {
    setSelectedFile(file);
    setShowPreview(true);
  };

  const handleViewPdf = (file: FileItem) => {
    if (file.url) {
      setViewerUrl(file.url);
    }
  };

  const handleExportChart = (chart: SavedChart, format: 'json' | 'csv') => {
    let content = '';
    let filename = `${chart.chartTitle}.${format}`;

    if (format === 'json') {
      content = exportChartAsJSON(chart.id) || '';
    } else {
      content = exportChartAsCSV(chart.id) || '';
    }

    if (content) {
      const element = document.createElement('a');
      element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`);
      element.setAttribute('download', filename);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  const toggleProjectExpand = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const toggleChartSetExpand = (chartSetId: string) => {
    const newExpanded = new Set(expandedChartSets);
    if (newExpanded.has(chartSetId)) {
      newExpanded.delete(chartSetId);
    } else {
      newExpanded.add(chartSetId);
    }
    setExpandedChartSets(newExpanded);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      // Handle file upload
      console.log("Files dropped:", droppedFiles);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return <FileText className="w-8 h-8 text-red-500" />;
      case "csv":
      case "xlsx":
        return <FileSpreadsheet className="w-8 h-8 text-green-500" />;
      default:
        return <File className="w-8 h-8 text-gray-500" />;
    }
  };

  const isPdfFile = (type: string) => type === "pdf";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Saved Technical Files</h1>
          <p className="text-gray-600">Browse and manage your previously uploaded documents and biostatistics projects</p>
        </div>

        {/* Upload Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`mb-8 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-white hover:border-gray-400"
          }`}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 mb-2">Drag files here to upload</p>
          <p className="text-sm text-gray-500">or click to select from your computer</p>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              <option value="regulatory">Regulatory</option>
              <option value="biostatistics">Biostatistics</option>
              <option value="general">General</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="size">Sort by Size</option>
            </select>

            <div className="flex gap-2 border border-gray-300 rounded-lg p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded ${viewMode === "grid" ? "bg-blue-500 text-white" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <Grid3x3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded ${viewMode === "list" ? "bg-blue-500 text-white" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <List className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("projects")}
                className={`p-2 rounded ${viewMode === "projects" ? "bg-blue-500 text-white" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <BarChart3 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Files Grid View */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className="p-6 flex flex-col items-center text-center">
                  {getFileIcon(file.type)}
                  <h3 className="mt-4 font-semibold text-gray-900 line-clamp-2">
                    {file.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {file.size} MB • {file.uploadDate.toLocaleDateString()}
                  </p>
                  <span className="mt-2 inline-block px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                    {file.category}
                  </span>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 flex gap-2">
                  {isPdfFile(file.type) && file.url ? (
                    <button
                      onClick={() => handleViewPdf(file)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePreview(file)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </button>
                  )}
                  <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors">
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    onClick={() => handleDelete(file.id)}
                    className="flex items-center justify-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Files List View */}
        {viewMode === "list" && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Size</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{file.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{file.type.toUpperCase()}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{file.size} MB</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-block px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                        {file.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {file.uploadDate.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm flex gap-2">
                      {isPdfFile(file.type) && file.url ? (
                        <button
                          onClick={() => handleViewPdf(file)}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePreview(file)}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button className="text-gray-600 hover:text-gray-800 transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(file.id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Projects View */}
        {viewMode === "projects" && (
          <div className="space-y-4 mb-8">
            {projects.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No biostatistics projects found</p>
              </div>
            ) : (
              projects.map((project, idx) => (
                <div key={idx} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <button
                    onClick={() => toggleProjectExpand(project.projectId)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Folder className="w-5 h-5 text-blue-500" />
                      <h3 className="font-semibold text-gray-900">{project.projectName}</h3>
                      <span className="text-sm text-gray-600">({project.chartSets.length} sets)</span>
                    </div>
                    <ChevronRight
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedProjects.has(project.projectId) ? "rotate-90" : ""
                      }`}
                    />
                  </button>

                  {expandedProjects.has(project.projectId) && (
                    <div className="border-t border-gray-200 px-6 py-4 space-y-3">
                      {project.chartSets.map((chartSet, cidx) => (
                        <div key={cidx} className="bg-gray-50 rounded-lg p-4">
                          <button
                            onClick={() => toggleChartSetExpand(chartSet.name)}
                            className="w-full flex items-center justify-between mb-2"
                          >
                            <span className="font-medium text-gray-900">{chartSet.name}</span>
                            <ChevronRight
                              className={`w-4 h-4 text-gray-400 transition-transform ${
                                expandedChartSets.has(chartSet.name) ? "rotate-90" : ""
                              }`}
                            />
                          </button>

                          {expandedChartSets.has(chartSet.name) && (
                            <div className="mt-3 space-y-2 text-sm">
                              {chartSet.charts.map((chart) => (
                                <div
                                  key={chart.id}
                                  className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
                                >
                                  <span className="text-gray-700">{chart.chartTitle}</span>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleExportChart(chart, 'json')}
                                      className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                      JSON
                                    </button>
                                    <button
                                      onClick={() => handleExportChart(chart, 'csv')}
                                      className="text-xs text-green-600 hover:text-green-800"
                                    >
                                      CSV
                                    </button>
                                    <button
                                      onClick={() => handleDeleteChart(chart.id)}
                                      className="text-xs text-red-600 hover:text-red-800"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="mt-3 flex gap-2 text-xs">
                            <button
                              onClick={() => handleDeleteChartSet(project.projectId, chartSet.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Delete Set
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex gap-2">
                    <button
                      onClick={() => handleDeleteProject(project.projectId)}
                      className="text-sm text-red-600 hover:text-red-800 font-medium"
                    >
                      Delete Project
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Empty State */}
        {filteredFiles.length === 0 && viewMode !== "projects" && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No files found matching your criteria</p>
          </div>
        )}
      </div>

      {/* PDF Document Viewer Modal */}
      {viewerUrl && (
        <DocumentViewer
          url={viewerUrl}
          title={selectedFile?.name}
          onClose={() => setViewerUrl(null)}
        />
      )}
    </div>
  );
}
