import React, { useState, useRef, DragEvent, ChangeEvent } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Database,
  AlertCircle,
  ArrowRight,
  Loader2,
  X,
  CheckCircle2,
} from "lucide-react";
import { uploadLocalFile } from "../../services/api";

export interface ImportResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (filePath: string) => void;
  isLoading?: boolean;
}

export const ImportResultsModal: React.FC<ImportResultsModalProps> = ({
  isOpen,
  onClose,
  onImport,
  isLoading = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [customPath, setCustomPath] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleSelectedFile(files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleSelectedFile(files[0]);
    }
  };

  const handleSelectedFile = async (file: File) => {
    setError(null);
    const electronPath = (file as any).path;
    if (electronPath && typeof electronPath === "string" && electronPath.length > 3) {
      onImport(electronPath);
    } else {
      try {
        setUploading(true);
        setUploadStatus(`Uploading ${file.name}...`);
        const res = await uploadLocalFile(file);
        setCustomPath(res.file_path);
        onImport(res.file_path);
      } catch (err: any) {
        setError(`Failed to upload results file: ${err.message}`);
      } finally {
        setUploading(false);
        setUploadStatus("");
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPath.trim()) {
      onImport(customPath.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Import Previous Analysis Results
              </h3>
              <p className="text-xs text-slate-400">
                Load exported results (.xlsx, .csv, .parquet) without re-running computations.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center flex flex-col items-center justify-center transition ${
              isDragOver
                ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
                : "border-slate-800 hover:border-slate-700 bg-slate-950/60"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.tsv,.parquet"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="w-12 h-12 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
              {uploading || isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              ) : (
                <FileSpreadsheet className="w-6 h-6" />
              )}
            </div>

            <h4 className="text-xs font-semibold text-white mb-1">
              {uploading ? uploadStatus : isLoading ? "Importing analysis results..." : "Drop exported results file here"}
            </h4>
            <p className="text-[11px] text-slate-400 mb-4 max-w-sm">
              Supports Excel workbooks (.xlsx) with comparison tables & agreement matrices, CSV, and Parquet.
            </p>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              Browse Export File
            </button>
          </div>

          {/* Manual Path Input */}
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="text-[11px] font-medium text-slate-400">
              Or paste file path:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="e.g. G:\My Drive\exports\vigipy_export.xlsx"
                className="flex-1 px-3 py-2 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!customPath.trim() || uploading || isLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition"
              >
                <span>Import</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950/60 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
