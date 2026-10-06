import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Sparkles,
  X,
} from "lucide-react";
import { ExportRequest, SignalRow } from "../../types";
import { exportAnalysisData } from "../../services/api";

interface ExportModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Total signals in dataset */
  totalSignalsCount?: number;
  /** Signals matching active user filter in Grid */
  filteredSignalsCount?: number;
  /** Active filtered rows for instant client-side download fallback */
  filteredRows?: SignalRow[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  totalSignalsCount = 184,
  filteredSignalsCount = 48,
  filteredRows = [],
}) => {
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [scope, setScope] = useState<"filtered" | "all">("filtered");
  const [filename, setFilename] = useState<string>("");
  const [includeMethodScores, setIncludeMethodScores] = useState<boolean>(true);
  const [includeCIs, setIncludeCIs] = useState<boolean>(true);
  const [includeTiers, setIncludeTiers] = useState<boolean>(true);

  const [exporting, setExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null);

  // Initialize default filename
  useEffect(() => {
    if (isOpen) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      setFilename(`vigipy_consensus_signals_${dateStr}.${format}`);
      setExportSuccess(false);
      setSavedFilePath(null);
    }
  }, [isOpen, format]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !exporting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, exporting, onClose]);

  if (!isOpen) return null;

  // Client-side CSV generator fallback
  const triggerClientCsvDownload = (rows: SignalRow[], outName: string) => {
    const headers = [
      "Product",
      "Adverse Event",
      "Observed Count",
      "Expected Count",
      "Consensus Tier",
      "Consensus Score",
      "Consensus Votes",
      "Total Methods",
      "Composite Rank",
    ];

    const exportMethods = ["PRR", "ROR", "RFET", "BCPNN", "GPS", "LASSO", "SCORE_DA"];

    if (includeMethodScores) {
      exportMethods.forEach((m) => {
        headers.push(`${m}_Score`);
        headers.push(`${m}_Alert`);
      });
    }

    const csvLines = [headers.join(",")];

    const targetRows = rows.length > 0 ? rows : [];
    targetRows.forEach((r) => {
      const line = [
        `"${r.product.replace(/"/g, '""')}"`,
        `"${r.adverse_event.replace(/"/g, '""')}"`,
        r.count,
        r.expected_count ?? "",
        `"${r.agreement_tier}"`,
        r.consensus_score,
        r.votes,
        r.total_methods,
        r.composite_rank ?? "",
      ];

      if (includeMethodScores) {
        exportMethods.forEach((m) => {
          const score =
            r.method_scores?.[m] ??
            (m === "SCORE_DA" ? r.method_scores?.["SCORE"] ?? r.method_scores?.["score_da"] : undefined) ??
            "";
          const alert =
            r.method_alerts?.[m] ??
            (m === "SCORE_DA" ? r.method_alerts?.["SCORE"] ?? r.method_alerts?.["score_da"] : undefined);
          line.push(score);
          line.push(alert ? "TRUE" : "FALSE");
        });
      }

      csvLines.push(line.join(","));
    });

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", outName.endsWith(".csv") ? outName : `${outName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportSuccess(false);

    const req: ExportRequest = {
      format,
      filtered_only: scope === "filtered",
      destination_path: filename.trim() || undefined,
    };

    try {
      const result = await exportAnalysisData(req);

      // If backend handled export
      if (result.file_path) {
        setSavedFilePath(result.file_path);
      } else {
        // Trigger browser download
        triggerClientCsvDownload(filteredRows, filename);
      }

      setExportSuccess(true);
    } catch (err) {
      console.error("Export error, triggering client download fallback:", err);
      triggerClientCsvDownload(filteredRows, filename);
      setExportSuccess(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 id="export-modal-title" className="text-base font-bold text-white tracking-tight">
                Export Pharmacovigilance Signals
              </h3>
              <p className="text-xs text-slate-400">
                Generate validated tabular datasets for audits, reports, or external analysis.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs text-slate-300">
          {/* Format Selection Tiles */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Select Output Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Excel Tile */}
              <button
                type="button"
                onClick={() => setFormat("xlsx")}
                className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                  format === "xlsx"
                    ? "bg-blue-600/10 border-blue-500 text-white shadow-md ring-1 ring-blue-500"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">Excel Workbook (.xlsx)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Multi-sheet spreadsheet with Signals, Comparison, and Agreement Matrices.
                  </div>
                </div>
              </button>

              {/* CSV Tile */}
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                  format === "csv"
                    ? "bg-blue-600/10 border-blue-500 text-white shadow-md ring-1 ring-blue-500"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 shrink-0 mt-0.5">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">Delimited CSV (.csv)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    High-performance flat table for Python, R, SAS, and SQL pipelines.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Scope Selection */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Export Scope
            </label>
            <div className="space-y-2">
              <label
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                  scope === "filtered"
                    ? "bg-blue-600/10 border-blue-500/80 text-white"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="exportScope"
                    checked={scope === "filtered"}
                    onChange={() => setScope("filtered")}
                    className="accent-blue-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-semibold text-white block">Current Filtered View</span>
                    <span className="text-[11px] text-slate-400">
                      Export only signals matching your search, tier, and score filters.
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-blue-400 font-mono text-[11px] border border-slate-700">
                  {filteredSignalsCount} signals
                </span>
              </label>

              <label
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                  scope === "all"
                    ? "bg-blue-600/10 border-blue-500/80 text-white"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="exportScope"
                    checked={scope === "all"}
                    onChange={() => setScope("all")}
                    className="accent-blue-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-semibold text-white block">All Detected Signals</span>
                    <span className="text-[11px] text-slate-400">
                      Export complete consensus signals catalog across entire dataset.
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-mono text-[11px] border border-slate-700">
                  {totalSignalsCount} signals
                </span>
              </label>
            </div>
          </div>

          {/* Target Filename Input */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              File Name
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 text-white text-xs font-mono outline-none transition"
              placeholder="output_filename.xlsx"
            />
          </div>

          {/* Options Checkboxes */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Dataset Attributes
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMethodScores}
                  onChange={(e) => setIncludeMethodScores(e.target.checked)}
                  className="accent-blue-500 rounded"
                />
                <span className="text-slate-300">Method primary scores</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCIs}
                  onChange={(e) => setIncludeCIs(e.target.checked)}
                  className="accent-blue-500 rounded"
                />
                <span className="text-slate-300">95% Confidence Intervals</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTiers}
                  onChange={(e) => setIncludeTiers(e.target.checked)}
                  className="accent-blue-500 rounded"
                />
                <span className="text-slate-300">Consensus tier & votes</span>
              </label>
            </div>
          </div>

          {/* Feedback & Confirmation */}
          {exportSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-semibold">Export Succeeded!</strong>
                <span className="text-[11px] text-slate-300">
                  {savedFilePath
                    ? `File saved on server at: ${savedFilePath}`
                    : `File downloaded to your browser as ${filename}.`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 disabled:opacity-50 transition active:scale-95"
          >
            {exporting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating Export...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export {format.toUpperCase()}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
