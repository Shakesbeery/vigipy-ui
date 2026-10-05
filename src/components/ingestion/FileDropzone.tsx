import React, { useState, useRef, DragEvent, ChangeEvent } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Database,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  ArrowRight,
  Globe,
  Loader2,
  X,
} from "lucide-react";
import { uploadLocalFile } from "../../services/api";

export interface FileDropzoneProps {
  onFileSelect: (filePath: string) => void;
  onImportResults?: (filePath: string) => void;
  onOpenOpenFDA?: () => void;
  isLoading?: boolean;
  selectedFilePath?: string | null;
  error?: string | null;
  onReset?: () => void;
}

const SUPPORTED_FORMATS = [
  { ext: ".csv", label: "CSV", desc: "Comma-separated values" },
  { ext: ".tsv", label: "TSV", desc: "Tab-separated values" },
  { ext: ".xlsx", label: "Excel", desc: "Microsoft Excel (.xlsx, .xls)" },
  { ext: ".parquet", label: "Parquet", desc: "Apache Parquet (fast binary)" },
];

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFileSelect,
  onImportResults,
  onOpenOpenFDA,
  isLoading = false,
  selectedFilePath,
  error,
  onReset,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [customPath, setCustomPath] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsFileInputRef = useRef<HTMLInputElement>(null);

  // Common default sample path
  const samplePath = "backend/DYB.csv";

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
    setUploadError(null);
    // In Electron or local desktop webview environments, file.path is populated with absolute path
    const electronPath = (file as any).path;
    if (electronPath && typeof electronPath === "string" && electronPath.length > 3) {
      onFileSelect(electronPath);
    } else {
      // In browser sandbox, stream upload the file to backend
      try {
        setIsUploading(true);
        setUploadMessage(`Uploading ${file.name} to server...`);
        const res = await uploadLocalFile(file);
        setCustomPath(res.file_path);
        onFileSelect(res.file_path);
      } catch (err: any) {
        setUploadError(`Failed to upload local file: ${err.message}`);
      } finally {
        setIsUploading(false);
        setUploadMessage("");
      }
    }
  };

  const handleResultsFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !onImportResults) return;
    const file = files[0];
    setUploadError(null);
    const electronPath = (file as any).path;
    if (electronPath && typeof electronPath === "string" && electronPath.length > 3) {
      onImportResults(electronPath);
    } else {
      try {
        setIsUploading(true);
        setUploadMessage(`Uploading ${file.name} for import...`);
        const res = await uploadLocalFile(file);
        onImportResults(res.file_path);
      } catch (err: any) {
        setUploadError(`Failed to upload results file: ${err.message}`);
      } finally {
        setIsUploading(false);
        setUploadMessage("");
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPath.trim()) {
      onFileSelect(customPath.trim());
    }
  };

  const handleSampleClick = () => {
    setCustomPath(samplePath);
    onFileSelect(samplePath);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-5">
      {/* Primary Dropzone Card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 transition-all duration-200 text-center flex flex-col items-center justify-center ${
          isDragOver
            ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10 scale-[1.005]"
            : selectedFilePath
            ? "border-emerald-500/40 bg-slate-900/60"
            : "border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/70"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.xlsx,.xls,.parquet"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={isLoading}
        />

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700/80 border border-slate-700 flex items-center justify-center mb-4 shadow-md shadow-black/40 group-hover:scale-105 transition-transform">
          {isLoading || isUploading ? (
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          ) : selectedFilePath ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          ) : (
            <UploadCloud className="w-8 h-8 text-blue-400" />
          )}
        </div>

        {/* Headline */}
        {isUploading ? (
          <div className="space-y-2 mb-4">
            <span className="text-xs uppercase tracking-wider font-mono font-semibold text-blue-400 animate-pulse">
              Uploading File
            </span>
            <p className="text-sm font-mono text-slate-200">{uploadMessage}</p>
          </div>
        ) : selectedFilePath ? (
          <div className="space-y-2 mb-4">
            <span className="text-xs uppercase tracking-wider font-mono font-semibold text-emerald-400">
              Dataset Selected
            </span>
            <div className="flex items-center gap-2 max-w-xl mx-auto justify-center">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="font-mono text-sm text-slate-200 truncate bg-slate-950/80 px-3 py-1 rounded-md border border-slate-800">
                {selectedFilePath}
              </p>
              {onReset && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReset();
                    setCustomPath("");
                  }}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                  title="Remove selected file"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Drag another file or click below to replace
            </p>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            <h3 className="text-lg font-semibold text-white tracking-tight">
              Drag & Drop Pharmacovigilance Dataset
            </h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Upload spontaneous adverse event reports or longitudinal safety surveillance logs to initiate disproportionality analysis.
            </p>
          </div>
        )}

        {/* Actions Button Group */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition active:scale-95"
          >
            <FolderOpen className="w-4 h-4" />
            <span>{selectedFilePath ? "Change File..." : "Browse Local Files"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowManualInput(!showManualInput)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>{showManualInput ? "Hide File Path" : "Specify Disk Path"}</span>
          </button>
        </div>

        {/* Format Badges */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 w-full flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mr-1">
            Supported Formats:
          </span>
          {SUPPORTED_FORMATS.map((fmt) => (
            <div
              key={fmt.ext}
              title={fmt.desc}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/70 border border-slate-800 text-slate-300 text-[11px] font-mono hover:border-slate-700 transition"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="font-semibold text-slate-200">{fmt.label}</span>
              <span className="text-slate-500 text-[10px]">({fmt.ext})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Manual File Path Bar (Collapsible / Toggleable) */}
      {showManualInput && (
        <form
          onSubmit={handleManualSubmit}
          className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-inner flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center"
        >
          <div className="flex-1 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">
              Path:
            </span>
            <input
              type="text"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="e.g. backend/DYB.csv or G:\data\faers.parquet"
              className="w-full pl-14 pr-4 py-2 bg-slate-950 rounded-lg border border-slate-800 text-slate-200 text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={!customPath.trim() || isLoading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 shrink-0 transition"
          >
            <span>Load Path</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {/* Error Message */}
      {(error || uploadError) && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-rose-200">Unable to load dataset</p>
            <p className="text-rose-300/90 font-mono text-[11px] break-all">{error || uploadError}</p>
          </div>
        </div>
      )}

      {/* Quick Test Sample Dataset Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-blue-950/30 to-slate-900 border border-indigo-500/20 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-white">
                Quick Test Benchmark: FDA MAUDE (DYB.csv)
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                43,493 Reports
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              Standard benchmark dataset of medical device adverse events (coronary catheters, trocars, PICC lines, and Lotus edge valves).
              Pre-configured for zero-setup disproportionality testing.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSampleClick}
          disabled={isLoading || isUploading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition shrink-0 active:scale-95"
        >
          <Database className="w-3.5 h-3.5" />
          <span>Load DYB Sample</span>
        </button>
      </div>

      {/* Re-Import Previous Analysis Export Card */}
      {onImportResults && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-purple-950/20 to-slate-900 border border-purple-500/20 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <input
            ref={resultsFileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.tsv,.parquet"
            className="hidden"
            onChange={handleResultsFileChange}
            disabled={isLoading || isUploading}
          />
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <UploadCloud className="w-5 h-5 text-purple-400" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-white">
                  Re-Import Previous Analysis Export
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                  .xlsx / .csv / .parquet
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                Already ran an analysis? Upload or choose an exported workbook (.xlsx), CSV, or Parquet file to instantly restore consensus signals, concordance matrices, and forest plots without recalculating.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => resultsFileInputRef.current?.click()}
            disabled={isLoading || isUploading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition shrink-0 active:scale-95"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Select Exported File</span>
          </button>
        </div>
      )}

      {/* Stream Directly from openFDA Card */}
      {onOpenOpenFDA && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950/20 to-slate-900 border border-sky-500/20 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Globe className="w-5 h-5 text-sky-400" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-white">
                  Stream Live FDA Adverse Events
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                  FAERS & MAUDE (openFDA)
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                Query the live U.S. FDA adverse event database directly. Pull real clinical reports for any drug substance or medical device model and stream them directly into vigipy for surveillance.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenOpenFDA}
            disabled={isLoading || isUploading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-sky-600/30 transition shrink-0 active:scale-95"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Stream from openFDA</span>
          </button>
        </div>
      )}
    </div>
  );
};
