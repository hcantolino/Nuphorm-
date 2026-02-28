import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Activity, HardDrive, TrendingUp, AlertCircle } from "lucide-react";

interface AnalyticsDashboardProps {
  userId: number;
}

export default function AnalyticsDashboard({ userId }: AnalyticsDashboardProps) {
  const { data: uploadedFiles, isLoading: filesLoading } = trpc.analytics.getUsageStats.useQuery();
  const { data: storageData, isLoading: storageLoading } = trpc.analytics.getStorageUsage.useQuery();

  const isLoading = filesLoading || storageLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-12 bg-gray-200 rounded"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!uploadedFiles || uploadedFiles.length === 0) {
    return <div className="text-center py-8 text-gray-500">No files uploaded yet</div>;
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  // Calculate statistics
  const totalFiles = uploadedFiles.length;
  const totalSize = uploadedFiles.reduce((sum: number, file: any) => sum + (file.fileSizeBytes || 0), 0);
  const avgFileSize = totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0;

  // Group by file type
  const fileTypeData = {} as Record<string, number>;
  uploadedFiles.forEach((file: any) => {
    const ext = file.fileName.split(".").pop()?.toUpperCase() || "OTHER";
    fileTypeData[ext] = (fileTypeData[ext] || 0) + 1;
  });

  const fileTypeChartData = Object.entries(fileTypeData).map(([type, count]: [string, number]) => ({
    name: type,
    value: count,
  }));

  // Group by size ranges
  const sizeRanges = {
    "< 1 MB": 0,
    "1-10 MB": 0,
    "10-50 MB": 0,
    "> 50 MB": 0,
  };

  uploadedFiles.forEach((file: any) => {
    const sizeMB = file.fileSizeBytes / (1024 * 1024);
    if (sizeMB < 1) sizeRanges["< 1 MB"]++;
    else if (sizeMB < 10) sizeRanges["1-10 MB"]++;
    else if (sizeMB < 50) sizeRanges["10-50 MB"]++;
    else sizeRanges["> 50 MB"]++;
  });

  const sizeRangeData = Object.entries(sizeRanges).map(([range, count]) => ({
    name: range,
    value: count,
  }));

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-6 border-l-4 border-blue-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Files</p>
              <p className="text-3xl font-bold">{totalFiles}</p>
            </div>
            <Activity className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-green-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Size</p>
              <p className="text-3xl font-bold">{formatBytes(totalSize)}</p>
            </div>
            <HardDrive className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-orange-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Avg File Size</p>
              <p className="text-3xl font-bold">{formatBytes(avgFileSize)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-purple-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Storage Used</p>
              <p className="text-3xl font-bold">{storageData ? formatBytes(storageData.totalStorageBytes || 0) : "—"}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-purple-500 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* File Types */}
        {fileTypeChartData.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Files by Type</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={fileTypeChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {fileTypeChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* File Size Distribution */}
        {sizeRangeData.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Files by Size</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sizeRangeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Recent Files */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Files</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {uploadedFiles.slice(0, 10).map((file: any) => (
            <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.fileName}</p>
                <p className="text-xs text-gray-500">{formatBytes(file.fileSizeBytes || 0)}</p>
              </div>
              <span className="text-xs text-gray-500 ml-2">
                {new Date(file.uploadedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
