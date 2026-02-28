import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Download, Trash2, Eye, Search, ChevronDown } from 'lucide-react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ReportPreview } from '@/components/biostat/ReportPreview';
import { ReportData } from '@/services/reportGenerationService';

type SortField = 'title' | 'date' | 'measurements';
type SortDirection = 'asc' | 'desc';

interface FilterOptions {
  searchQuery: string;
  sortField: SortField;
  sortDirection: SortDirection;
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  measurementCount?: number;
}

export default function SavedTechnicalFiles() {
  const [, setLocation] = useLocation();
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState<FilterOptions>({
    searchQuery: '',
    sortField: 'date',
    sortDirection: 'desc',
  });

  // Fetch technical files
  const { data: files = [], isLoading, refetch } = trpc.technical.getFiles.useQuery();
  const deleteFileMutation = trpc.technical.deleteFile.useMutation();

  // Filter and sort files
  const filteredAndSortedFiles = useMemo(() => {
    let result = [...files];

    // Search filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter((file: any) => {
        try {
          const report: ReportData = JSON.parse(file.content);
          const title = report.title.toLowerCase();
          const measurements = report.measurements.join(' ').toLowerCase();
          const dataFiles = report.dataFiles.join(' ').toLowerCase();
          return title.includes(query) || measurements.includes(query) || dataFiles.includes(query);
        } catch {
          return file.title.toLowerCase().includes(query);
        }
      });
    }

    // Date range filter
    if (filters.dateRangeStart) {
      result = result.filter((file: any) => {
        const fileDate = new Date(file.generatedAt);
        return fileDate >= filters.dateRangeStart!;
      });
    }
    if (filters.dateRangeEnd) {
      result = result.filter((file: any) => {
        const fileDate = new Date(file.generatedAt);
        const endDate = new Date(filters.dateRangeEnd!);
        endDate.setHours(23, 59, 59, 999);
        return fileDate <= endDate;
      });
    }

    // Measurement count filter
    if (filters.measurementCount && filters.measurementCount > 0) {
      result = result.filter((file: any) => {
        try {
          const report: ReportData = JSON.parse(file.content);
          return report.measurements.length >= filters.measurementCount!;
        } catch {
          return true;
        }
      });
    }

    // Sorting
    result.sort((a: any, b: any) => {
      let aValue: any;
      let bValue: any;

      try {
        const reportA: ReportData = JSON.parse(a.content);
        const reportB: ReportData = JSON.parse(b.content);

        switch (filters.sortField) {
          case 'title':
            aValue = reportA.title.toLowerCase();
            bValue = reportB.title.toLowerCase();
            break;
          case 'measurements':
            aValue = reportA.measurements.length;
            bValue = reportB.measurements.length;
            break;
          case 'date':
          default:
            aValue = new Date(a.generatedAt).getTime();
            bValue = new Date(b.generatedAt).getTime();
        }
      } catch {
        aValue = a.title;
        bValue = b.title;
      }

      if (aValue < bValue) return filters.sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return filters.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [files, filters]);

  const handleDelete = async (fileId: number) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      await deleteFileMutation.mutateAsync({ fileId });
      toast.success('Report deleted successfully');
      refetch();
    } catch (error) {
      console.error('Failed to delete report:', error);
      toast.error('Failed to delete report');
    }
  };

  const handleViewReport = (file: any) => {
    try {
      const report: ReportData = JSON.parse(file.content);
      setSelectedReport(report);
      setShowPreview(true);
    } catch (error) {
      console.error('Failed to parse report:', error);
      toast.error('Failed to load report');
    }
  };

  const handleDownloadReport = (file: any) => {
    try {
      const report: ReportData = JSON.parse(file.content);
      const html = generateReportHTML(report);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title.replace(/\s+/g, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch (error) {
      console.error('Failed to download report:', error);
      toast.error('Failed to download report');
    }
  };

  const handleSaveReport = async (report: ReportData) => {
    setShowPreview(false);
    toast.success('Report is already saved');
  };

  const handleResetFilters = () => {
    setFilters({
      searchQuery: '',
      sortField: 'date',
      sortDirection: 'desc',
    });
  };

  const toggleSortDirection = () => {
    setFilters({
      ...filters,
      sortDirection: filters.sortDirection === 'asc' ? 'desc' : 'asc',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setLocation('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Saved Technical Files</h1>
        <p className="text-gray-600 mt-1">View and manage your generated reports</p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col gap-4">
          {/* Search and Sort Row */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title, measurements, or data files..."
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="gap-2"
            >
              <ChevronDown className="w-4 h-4" />
              Filters
            </Button>
          </div>

          {/* Sort Options Row */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Sort by:</span>
            <select
              value={filters.sortField}
              onChange={(e) => setFilters({ ...filters, sortField: e.target.value as SortField })}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Date Created</option>
              <option value="title">Title</option>
              <option value="measurements">Measurements Count</option>
            </select>
            <button
              onClick={toggleSortDirection}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition"
              title={`Sort ${filters.sortDirection === 'asc' ? 'descending' : 'ascending'}`}
            >
              {filters.sortDirection === 'asc' ? '↑ Ascending' : '↓ Descending'}
            </button>
            {(filters.searchQuery || filters.dateRangeStart || filters.dateRangeEnd || filters.measurementCount) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Clear Filters
              </Button>
            )}
          </div>

          {/* Advanced Filter Panel */}
          {showFilterPanel && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Date Range Start */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateRangeStart ? filters.dateRangeStart.toISOString().split('T')[0] : ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        dateRangeStart: e.target.value ? new Date(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Date Range End */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateRangeEnd ? filters.dateRangeEnd.toISOString().split('T')[0] : ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        dateRangeEnd: e.target.value ? new Date(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Minimum Measurements */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Measurements
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={filters.measurementCount || ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        measurementCount: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    placeholder="Any"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Results Count */}
          <div className="text-sm text-gray-600">
            Showing {filteredAndSortedFiles.length} of {files.length} report{files.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading reports...</div>
          </div>
        ) : filteredAndSortedFiles.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="text-gray-500 mb-4">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {files.length === 0 ? 'No reports yet' : 'No reports match your filters'}
            </h3>
            <p className="text-gray-600">
              {files.length === 0
                ? 'Generate your first report from the biostatistics analysis page'
                : 'Try adjusting your search or filter criteria'}
            </p>
            {files.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="mt-4"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredAndSortedFiles.map((file: any) => {
              let report: ReportData | null = null;
              try {
                report = JSON.parse(file.content);
              } catch (error) {
                console.error('Failed to parse report:', error);
              }

              return (
                <div
                  key={file.id}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {report?.title || file.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Generated: {new Date(file.generatedAt).toLocaleString()}
                      </p>

                      {report && (
                        <>
                          {report.measurements && report.measurements.length > 0 && (
                            <div className="mt-3">
                              <p className="text-sm text-gray-700 font-medium">
                                Measurements ({report.measurements.length}):
                              </p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {report.measurements.map((measurement: string, idx: number) => (
                                  <span
                                    key={idx}
                                    className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm"
                                  >
                                    {measurement}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {report.dataFiles && report.dataFiles.length > 0 && (
                            <div className="mt-3">
                              <p className="text-sm text-gray-700 font-medium">
                                Data Files ({report.dataFiles.length}):
                              </p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {report.dataFiles.map((dataFile: string, idx: number) => (
                                  <span
                                    key={idx}
                                    className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm"
                                  >
                                    {dataFile}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewReport(file)}
                        className="gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadReport(file)}
                        className="gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(file.id)}
                        className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report Preview Modal */}
      {showPreview && selectedReport && (
        <ReportPreview
          report={selectedReport}
          onClose={() => setShowPreview(false)}
          onSave={handleSaveReport}
        />
      )}
    </div>
  );
}

// Helper function to generate HTML from report
function generateReportHTML(report: ReportData): string {
  const filterSummary = report.filters
    ? Object.entries(report.filters)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => {
          if (key === 'dateRange' && value) {
            const range = value as { start: Date; end: Date };
            return `Date Range: ${new Date(range.start).toLocaleDateString()} - ${new Date(range.end).toLocaleDateString()}`;
          }
          if (key === 'categories' && value) {
            return `Categories: ${(value as string[]).join(', ')}`;
          }
          if (key === 'valueThreshold' && value) {
            const threshold = value as { min: number; max: number };
            return `Value Range: ${threshold.min} - ${threshold.max}`;
          }
          return null;
        })
        .filter(Boolean)
        .join('<br />')
    : '';

  const variableSummary = report.variables
    .map((v) => `<li><strong>${v.name}</strong>: ${v.type}</li>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${report.title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 900px;
          margin: 0 auto;
          padding: 40px;
          background: #f5f5f5;
        }
        .report-container {
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 {
          color: #1e40af;
          border-bottom: 3px solid #1e40af;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        h2 {
          color: #1e40af;
          margin-top: 30px;
          margin-bottom: 15px;
          font-size: 18px;
        }
        .metadata {
          background: #f0f4f8;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
          font-size: 14px;
        }
        .metadata-item {
          margin: 5px 0;
        }
        .chart-container {
          text-align: center;
          margin: 30px 0;
          padding: 20px;
          background: ${report.colorSettings?.backgroundColor || '#ffffff'};
          border-radius: 4px;
        }
        .chart-container img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
        }
        ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        li {
          margin: 8px 0;
        }
        .summary-box {
          background: #e0f2fe;
          border-left: 4px solid #0284c7;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="report-container">
        <h1>${report.title}</h1>
        
        <div class="metadata">
          <div class="metadata-item"><strong>Generated:</strong> ${report.generatedAt.toLocaleString()}</div>
          <div class="metadata-item"><strong>Data Files:</strong> ${report.dataFiles.join(', ')}</div>
          <div class="metadata-item"><strong>Measurements:</strong> ${report.measurements.length}</div>
        </div>

        <h2>Analysis Parameters</h2>
        <ul>
          ${variableSummary}
        </ul>

        ${filterSummary ? `<h2>Applied Filters</h2><p>${filterSummary}</p>` : ''}

        ${report.chartImage ? `<div class="chart-container"><img src="${report.chartImage}" alt="Chart" /></div>` : ''}

        ${report.aiInterpretation ? `<div class="summary-box"><h2>AI-Generated Interpretation</h2><p>${report.aiInterpretation}</p></div>` : ''}

        <div class="footer">
          <p>This report was generated by MedReg Platform. For more information, visit the platform dashboard.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
