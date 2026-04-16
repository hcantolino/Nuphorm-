import { useState } from "react";
import { Upload, AlertCircle, CheckCircle2, BarChart3, Send } from "lucide-react";
import Papa from "papaparse";
import AIChatInput from "@/components/AIChatInput";

interface UploadedData {
  name: string;
  data: Record<string, any>[];
  columns: string[];
}

export default function Dashboard() {
  console.log("Rendering Dashboard");
  const [uploadedFile, setUploadedFile] = useState<UploadedData | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);

  const handleChatMessage = (message: string) => {
    // Add user message to chat
    setChatMessages([...chatMessages, { role: "user", content: message }]);
    
    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `I received your message: "${message}". This is a demo response. Connect to a real AI API to enable full functionality.`,
        },
      ]);
    }, 1000);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");

    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      setError("Excel files should be uploaded via the Biostatistics panel for proper parsing. Please use CSV here.");
      setLoading(false);
      return;
    }

    if (!file.name.endsWith(".csv")) {
      setError("Please upload a CSV file.");
      setLoading(false);
      return;
    }

    try {
      const content = await file.text();
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        complete: (results: any) => {
          if (results.data && results.data.length > 0) {
            const columns = Object.keys(results.data[0] as Record<string, any>);
            setUploadedFile({
              name: file.name,
              data: results.data as Record<string, any>[],
              columns,
            });
          }
          setLoading(false);
        },
        error: (error: any) => {
          setError(`CSV parsing error: ${error.message}`);
          setLoading(false);
        },
      });
    } catch (err) {
      setError(`Error reading file: ${err instanceof Error ? err.message : "Unknown error"}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f8ff] to-[#e8f4ff] pt-20 lg:pt-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-gray-900">NuPhorm Platform</h1>
          <p className="text-gray-600 mt-2">
            Upload and analyze pharmaceutical data with advanced biostatistics
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Data Upload & Preview
              </h2>

              {/* Upload Box */}
              <label className="block">
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="hidden"
                />
                <div
                  className={`
                    border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                    transition-all duration-200
                    ${
                      uploadedFile
                        ? "border-green-300 bg-green-50"
                        : "border-blue-300 bg-blue-50 hover:border-blue-400 hover:bg-blue-100"
                    }
                    ${loading ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                >
                  {loading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                      <p className="text-sm text-gray-600">Processing...</p>
                    </div>
                  ) : uploadedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                      <p className="text-sm font-medium text-gray-900">
                        {uploadedFile.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        {uploadedFile.data.length} rows
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-blue-600" />
                      <p className="text-sm font-medium text-gray-900">
                        Click to upload
                      </p>
                      <p className="text-xs text-gray-600">CSV or XLSX files</p>
                    </div>
                  )}
                </div>
              </label>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* File Info */}
              {uploadedFile && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Columns
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {uploadedFile.columns.map((col) => (
                      <span
                        key={col}
                        className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Analysis Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Analysis Results
              </h2>

              {!uploadedFile ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <BarChart3 className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium">
                    Upload a file to begin analysis
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Supported formats: CSV, XLSX
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Data Preview */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Data Preview
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            {uploadedFile.columns.slice(0, 5).map((col) => (
                              <th
                                key={col}
                                className="px-4 py-2 text-left font-semibold text-gray-900"
                              >
                                {col}
                              </th>
                            ))}
                            {uploadedFile.columns.length > 5 && (
                              <th className="px-4 py-2 text-left font-semibold text-gray-900">
                                +{uploadedFile.columns.length - 5} more
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {uploadedFile.data.slice(0, 5).map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-100">
                              {uploadedFile.columns.slice(0, 5).map((col) => (
                                <td
                                  key={col}
                                  className="px-4 py-2 text-gray-700"
                                >
                                  {String(row[col] || "-").slice(0, 30)}
                                </td>
                              ))}
                              {uploadedFile.columns.length > 5 && (
                                <td className="px-4 py-2 text-gray-500 text-xs">
                                  ...
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Showing 1-5 of {uploadedFile.data.length} rows
                    </p>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-xs text-blue-600 font-medium">Total Rows</p>
                      <p className="text-2xl font-bold text-blue-900 mt-1">
                        {uploadedFile.data.length}
                      </p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                      <p className="text-xs text-purple-600 font-medium">
                        Total Columns
                      </p>
                      <p className="text-2xl font-bold text-purple-900 mt-1">
                        {uploadedFile.columns.length}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Chat Section */}
        <div className="mt-12">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              NuPhorm AI Assistant
            </h2>

            {/* Chat Messages */}
            {chatMessages.length > 0 && (
              <div className="mb-6 max-h-64 overflow-y-auto space-y-4 p-4 bg-gray-50 rounded-lg">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.role === "user"
                          ? "bg-blue-500 text-white rounded-br-none"
                          : "bg-gray-200 text-gray-900 rounded-bl-none"
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Chat Input */}
            <AIChatInput
              onSendMessage={handleChatMessage}
              placeholder="Ask NuPhorm AI about your data analysis..."
              isLoading={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
