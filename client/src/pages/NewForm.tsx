import { useState, useRef } from "react";
import { Upload, FileText, ArrowRight } from "lucide-react";

export default function NewForm() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Stub — would create a new biostatistics project
    console.log("[NewForm] Create project:", { title, fileName: file?.name });
  };

  return (
    <div
      className="min-h-screen bg-[#F9FAFB] flex items-start justify-center pt-20 px-6"
      style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
    >
      <div className="w-full max-w-[560px]">
        <h1 className="text-3xl font-bold text-[#194CFF] mb-2">
          Create New Form
        </h1>
        <p className="text-[#475569] mb-10">
          Start a new biostatistics project by providing a title and uploading
          your data file.
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Project Title */}
          <div>
            <label
              htmlFor="project-title"
              className="block text-sm font-semibold text-[#0F172A] mb-2"
            >
              Project Title
            </label>
            <input
              id="project-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Phase III Clinical Trial Analysis"
              className="w-full px-4 py-3 rounded-xl border border-[#D1D5DB] text-[#0F172A] text-sm
                         placeholder:text-[#94A3B8]
                         focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE] focus:outline-none
                         transition-all duration-200"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-2">
              Upload Data File
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-3 p-10 rounded-xl
                         border-2 border-dashed border-[#3B82F6] bg-[#F8FAFC]
                         cursor-pointer hover:bg-[#EFF6FF] transition-colors duration-200"
            >
              <Upload className="w-8 h-8 text-[#3B82F6]" />
              {file ? (
                <div className="flex items-center gap-2 text-sm text-[#0F172A] font-medium">
                  <FileText className="w-4 h-4 text-[#3B82F6]" />
                  {file.name}
                  <span className="text-[#94A3B8]">
                    ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium text-[#475569]">
                    Click to select or drag a file here
                  </span>
                  <span className="text-xs text-[#94A3B8]">
                    CSV, Excel (.xlsx), or TXT — max 25 MB
                  </span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!title.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl
                       bg-[#194CFF] text-white font-semibold text-base
                       shadow-md hover:bg-[#3B82F6] hover:shadow-lg hover:scale-[1.02]
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100
                       transition-all duration-300 ease-in-out
                       focus:outline-none focus:ring-2 focus:ring-[#194CFF]/50"
            aria-label="Start new project"
          >
            Start Project <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
