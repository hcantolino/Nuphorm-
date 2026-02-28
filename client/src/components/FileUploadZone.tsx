'use client';

import { useRef, useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileItem {
  /** Stable unique ID — never use file.name for identity */
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number; // 0–100
  error?: string;
}

interface FileUploadProps {
  onFilesSelected?: (files: File[]) => void;
  maxSize?: number;
  acceptedFormats?: string[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FileUploadZone({
  onFilesSelected,
  maxSize = 100,
  acceptedFormats = ['csv', 'xlsx', 'xls', 'json', 'pdf'],
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Map of id → XHR so we can abort on remove
  const xhrsRef = useRef<Map<string, XMLHttpRequest>>(new Map());

  // ── Validation ─────────────────────────────────────────────────────────────

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (file.size > maxSize * 1024 * 1024) {
      return { valid: false, error: `Exceeds ${maxSize} MB limit` };
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!acceptedFormats.includes(ext)) {
      return {
        valid: false,
        error: `Format not supported. Accepted: ${acceptedFormats.join(', ')}`,
      };
    }
    return { valid: true };
  };

  // ── Add files to the queue ──────────────────────────────────────────────────

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    Array.from(fileList).forEach((file) => {
      const v = validateFile(file);
      if (!v.valid) {
        toast.error(`${file.name}: ${v.error}`);
        return;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setFiles((prev) => [...prev, { id, file, status: 'pending', progress: 0 }]);
    });
  };

  // ── Core upload: XHR inside FileReader.onload ───────────────────────────────
  //
  // Why XHR instead of fetch?
  //   • xhr.upload.onprogress gives real per-byte upload progress.
  //   • fetch's ReadableStream progress API is not yet universally reliable.
  //
  // Why XHR *inside* FileReader.onload?
  //   • Starting the XHR synchronously from inside onload avoids the React
  //     re-render that can occur between `await Promise.race([reader, ...])` and
  //     the next line, which was causing the fetch call to be silently skipped.

  const uploadOne = (item: FileItem): Promise<void> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => reject(new Error('Could not read file'));

      reader.onload = () => {
        // Strip "data:<mime>;base64," prefix to get raw base64
        const b64 = (reader.result as string).split(',')[1] ?? '';
        if (!b64) {
          reject(new Error('Empty file data after base64 encoding'));
          return;
        }

        const xhr = new XMLHttpRequest();
        xhrsRef.current.set(item.id, xhr);
        xhr.timeout = 60_000;
        xhr.open('POST', '/api/trpc/files.upload');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.withCredentials = true; // forward the session cookie

        // ── Upload progress ─────────────────────────────────────────────────
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
          setFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, progress: pct } : f))
          );
        };

        // ── Response handler ────────────────────────────────────────────────
        xhr.onload = () => {
          xhrsRef.current.delete(item.id);
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(`Server responded ${xhr.status}: ${xhr.statusText}`));
            return;
          }
          try {
            const res = JSON.parse(xhr.responseText);
            // tRPC wraps the return value — cover all known shapes
            const ok =
              res.result?.data?.json?.success === true ||
              res.result?.data?.success === true ||
              res.success === true;
            if (ok) {
              resolve();
            } else {
              reject(
                new Error(
                  res.error?.message ??
                    res.result?.error?.message ??
                    'Upload failed'
                )
              );
            }
          } catch {
            reject(new Error('Invalid server response'));
          }
        };

        xhr.onerror = () => {
          xhrsRef.current.delete(item.id);
          reject(new Error('Network error — is the dev server running?'));
        };

        xhr.ontimeout = () => {
          xhrsRef.current.delete(item.id);
          reject(new Error('Upload timed out (60 s)'));
        };

        // tRPC mutation body: { json: { ... } }
        xhr.send(
          JSON.stringify({
            json: {
              fileName: item.file.name,
              fileData: b64,
              mimeType: item.file.type || 'application/octet-stream',
              fileSizeBytes: item.file.size,
            },
          })
        );
      };

      // Kick off the file read — onload fires when complete
      reader.readAsDataURL(item.file);
    });

  // ── Upload handler ──────────────────────────────────────────────────────────

  const handleUpload = async () => {
    const pending = files.filter((f) => f.status === 'pending');
    if (!pending.length) {
      toast.error('No files to upload');
      return;
    }

    setIsUploading(true);

    // Flip all pending → uploading in one batch before the loop starts.
    // This prevents a "stale status" read inside uploadOne if a re-render
    // occurs between iterations.
    setFiles((prev) =>
      prev.map((f) =>
        f.status === 'pending' ? { ...f, status: 'uploading', progress: 0 } : f
      )
    );

    let anySuccess = false;

    for (const item of pending) {
      try {
        await uploadOne(item);
        anySuccess = true;
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: 'success', progress: 100 } : f
          )
        );
        toast.success(`${item.file.name} uploaded`);
        onFilesSelected?.([item.file]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: 'error', progress: 0, error: msg }
              : f
          )
        );
        toast.error(`${item.file.name}: ${msg}`);
      }
      // NOTE: isUploading is NOT reset here — only after the entire loop.
      // Resetting it inside the loop was the original bug: it triggered
      // a React re-render mid-await that could silently swallow the fetch.
    }

    setIsUploading(false);

    if (anySuccess) {
      // Fade out success entries after 2 s
      setTimeout(
        () => setFiles((prev) => prev.filter((f) => f.status !== 'success')),
        2000
      );
    }
  };

  // ── Remove a queued / failed file ───────────────────────────────────────────

  const removeFile = (id: string) => {
    xhrsRef.current.get(id)?.abort();
    xhrsRef.current.delete(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // ── Derived counts ──────────────────────────────────────────────────────────

  const pendingCount   = files.filter((f) => f.status === 'pending').length;
  const uploadingCount = files.filter((f) => f.status === 'uploading').length;
  const successCount   = files.filter((f) => f.status === 'success').length;
  const errorCount     = files.filter((f) => f.status === 'error').length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Drop zone */}
      <div
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        className={`border-2 border-dashed rounded-lg p-8 transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/30'
        }`}
      >
        <div className="flex flex-col items-center justify-center">
          <Upload
            className={`w-12 h-12 mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`}
          />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {isDragging ? 'Drop files here' : 'Drag and drop your files'}
          </h3>
          <p className="text-sm text-gray-600 mb-4">or click to browse from your computer</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={acceptedFormats.map((f) => `.${f}`).join(',')}
            onChange={(e) => addFiles(e.target.files)}
            className="hidden"
            id="file-upload-input"
          />
          <label
            htmlFor="file-upload-input"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Select Files
          </label>
          <p className="text-xs text-gray-500 mt-3">
            {acceptedFormats.join(', ').toUpperCase()} · Max {maxSize} MB
          </p>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">

          {/* List header */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">Files ({files.length})</h4>
            <button
              onClick={() => setFiles([])}
              className="text-xs text-gray-600 hover:text-gray-900 font-medium"
            >
              Clear All
            </button>
          </div>

          {/* File rows */}
          <div className="divide-y divide-gray-200">
            {files.map((item) => (
              <div key={item.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {item.status === 'success' && (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    )}
                    {item.status === 'uploading' && (
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
                    )}
                    {item.status === 'pending' && (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(item.file.size / 1024 / 1024).toFixed(2)} MB
                        {item.status === 'uploading' && ` · ${item.progress}%`}
                        {item.status === 'success' && ' · uploaded'}
                      </p>
                      {item.error && (
                        <p className="text-xs text-red-600 mt-0.5">{item.error}</p>
                      )}
                    </div>
                  </div>
                  {item.status !== 'uploading' && (
                    <button
                      onClick={() => removeFile(item.id)}
                      className="ml-3 p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
                      title="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Per-file progress bar */}
                {item.status === 'uploading' && (
                  <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-150"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === 'success' && (
                  <div className="mt-2 h-1.5 bg-green-400 rounded-full" />
                )}
              </div>
            ))}
          </div>

          {/* Footer: counts + upload button */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="flex gap-4 text-sm">
              {pendingCount > 0 && (
                <span className="text-blue-600 font-medium">{pendingCount} pending</span>
              )}
              {uploadingCount > 0 && (
                <span className="text-blue-600 font-medium">{uploadingCount} uploading</span>
              )}
              {successCount > 0 && (
                <span className="text-green-600 font-medium">{successCount} uploaded</span>
              )}
              {errorCount > 0 && (
                <span className="text-red-600 font-medium">{errorCount} failed</span>
              )}
            </div>

            {(pendingCount > 0 || uploadingCount > 0) && (
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  `Upload ${pendingCount} file${pendingCount !== 1 ? 's' : ''}`
                )}
              </button>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
