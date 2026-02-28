import { useState } from "react";
import { X, Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportData, generateReportHTML } from "@/services/reportGenerationService";
import { toast } from "sonner";

interface ReportPreviewProps {
  report: ReportData;
  onClose: () => void;
  onSave: (report: ReportData) => Promise<void>;
}

export const ReportPreview = ({ report, onClose, onSave }: ReportPreviewProps) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(report);
      toast.success("Report saved to Technical Files");
    } catch (error) {
      console.error("Failed to save report:", error);
      toast.error("Failed to save report");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadHTML = () => {
    const html = generateReportHTML(report);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/\s+/g, "_")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const html = generateReportHTML(report);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">{report.title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <iframe
            srcDoc={html}
            className="w-full h-full border-0"
            title="Report Preview"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            Generated: {report.generatedAt.toLocaleString()}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadHTML}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download HTML
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save to Technical Files"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
