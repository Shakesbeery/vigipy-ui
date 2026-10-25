import React, { useState, useRef, useEffect } from "react";
import {
  Activity,
  Database,
  Download,
  Sliders,
  FolderOpen,
  UploadCloud,
  Columns,
  Code2,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Archive,
  Package,
  HardDrive,
  ChevronDown,
  Wrench,
} from "lucide-react";
import { DataSummaryResponse } from "../../types";

interface AppHeaderProps {
  summary: DataSummaryResponse | null;
  onOpenConfig: () => void;
  onOpenExport: () => void;
  onResetData: () => void;
  onSwapDataset?: () => void;
  onOpenImportResults?: () => void;
  onOpenColumns?: () => void;
  onOpenQualityProfiler?: () => void;
  onOpenOpenFDA?: () => void;
  onOpenFaersWarehouse?: () => void;
  onOpenCodeViewer?: () => void;
  onOpenAuditDossier?: () => void;
  onOpenVersionModal?: () => void;
  onOpenProjectContainer?: () => void;
  backendOnline: boolean;
  totalSignals: number;
  vigipyVersion?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  summary,
  onOpenConfig,
  onOpenExport,
  onResetData,
  onSwapDataset,
  onOpenImportResults,
  onOpenColumns,
  onOpenQualityProfiler,
  onOpenOpenFDA,
  onOpenFaersWarehouse,
  onOpenCodeViewer,
  onOpenAuditDossier,
  onOpenVersionModal,
  onOpenProjectContainer,
  backendOnline,
  totalSignals,
  vigipyVersion,
}) => {
  const [toolsOpen, setToolsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-14 sm:h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 sm:px-6 flex items-center justify-between select-none shrink-0 z-30">
      {/* Brand & Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20 shrink-0">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight truncate">
              vigipy-ui
            </h1>
            <button
              onClick={onOpenVersionModal}
              className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition cursor-pointer flex items-center gap-1 shrink-0"
              title="View vigipy version and PyPI release info"
            >
              <Package className="w-3 h-3 text-blue-400" />
              <span>{vigipyVersion ? `v${vigipyVersion}` : "v3.4.2"}</span>
            </button>
          </div>
          <p className="text-xs text-slate-400 hidden md:block truncate">
            Pharmacovigilance Signal Detection & Consensus Workbench
          </p>
        </div>
      </div>

      {/* Dataset & Analysis Telemetry */}
      {summary && (
        <div className="hidden xl:flex items-center gap-3.5 text-xs font-mono bg-slate-950/70 px-3.5 py-1.5 rounded-lg border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>{summary.total_raw_rows.toLocaleString()} reports</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="text-slate-300">
            <span>{summary.unique_pairs.toLocaleString()} pairs</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="text-emerald-400 font-semibold">
            <span>{totalSignals.toLocaleString()} signals</span>
          </div>
        </div>
      )}

      {/* Action Controls */}
      <div className="flex items-center gap-2">
        {/* Backend Heartbeat */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-xs"
          title={backendOnline ? "Python computational engine is connected" : "Backend engine is offline"}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              backendOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
            }`}
          />
          <span className="text-[11px] text-slate-300 font-mono hidden sm:inline">
            {backendOnline ? "Online" : "Offline"}
          </span>
        </div>

        {onOpenFaersWarehouse && (
          <button
            onClick={onOpenFaersWarehouse}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-teal-600/40 transition"
            title="Unified Vigilance Warehouse: FAERS (Drugs), VAERS (Vaccines), and MAUDE (Devices)"
          >
            <HardDrive className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden md:inline">Warehouse</span>
          </button>
        )}

        {summary ? (
          <>
            {onOpenColumns && (
              <button
                onClick={onOpenColumns}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                title="Map or modify Product, Adverse Event, Count, Case ID, and Covariate columns"
              >
                <Columns className="w-3.5 h-3.5 text-slate-300" />
                <span className="hidden sm:inline">Columns</span>
              </button>
            )}

            <button
              onClick={onOpenConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
              title="Configure Disproportionality Methods & Presets"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>Methods</span>
            </button>

            {/* Unified Tools & Compliance Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setToolsOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                  toolsOpen
                    ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/40"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                }`}
                title="Data Hygiene, Reproducible Python Code, GxP Audit Dossier, and Workspace Management"
              >
                <Wrench className="w-3.5 h-3.5 text-slate-300" />
                <span className="hidden sm:inline">Tools & GxP</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {toolsOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-1.5 z-50 divide-y divide-slate-800/80 animate-in fade-in duration-100">
                  <div className="py-1">
                    {onOpenQualityProfiler && (
                      <button
                        onClick={() => {
                          setToolsOpen(false);
                          onOpenQualityProfiler();
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-slate-800/80 flex items-start gap-3 transition"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-white">Data Hygiene & Quality</div>
                          <div className="text-[11px] text-slate-400">
                            Inspect missingness, duplicates & overdispersion
                          </div>
                        </div>
                      </button>
                    )}

                    {onOpenCodeViewer && (
                      <button
                        onClick={() => {
                          setToolsOpen(false);
                          onOpenCodeViewer();
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-slate-800/80 flex items-start gap-3 transition"
                      >
                        <Code2 className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-white">Reproducible Python Script</div>
                          <div className="text-[11px] text-slate-400">
                            Export standalone vigipy code for this run
                          </div>
                        </div>
                      </button>
                    )}

                    {onOpenAuditDossier && (
                      <button
                        onClick={() => {
                          setToolsOpen(false);
                          onOpenAuditDossier();
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-slate-800/80 flex items-start gap-3 transition"
                      >
                        <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-white">GxP Regulatory Dossier</div>
                          <div className="text-[11px] text-slate-400">
                            21 CFR Part 11 audit log & validation summary
                          </div>
                        </div>
                      </button>
                    )}
                  </div>

                  <div className="py-1">
                    {onOpenProjectContainer && (
                      <button
                        onClick={() => {
                          setToolsOpen(false);
                          onOpenProjectContainer();
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-slate-800/80 flex items-start gap-3 transition"
                      >
                        <Archive className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-white">Workspace Snapshot</div>
                          <div className="text-[11px] text-slate-400">
                            Save or restore session state (.vigipy.json)
                          </div>
                        </div>
                      </button>
                    )}

                    {onOpenImportResults && (
                      <button
                        onClick={() => {
                          setToolsOpen(false);
                          onOpenImportResults();
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-slate-800/80 flex items-start gap-3 transition"
                      >
                        <UploadCloud className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-white">Import Saved Results</div>
                          <div className="text-[11px] text-slate-400">
                            Load a previous .xlsx, .csv, or .parquet export
                          </div>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onOpenExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition"
              title="Export Results to Excel or CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            <button
              onClick={onSwapDataset || onResetData}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
              title="Switch to a new dataset or upload another data file"
            >
              <FolderOpen className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden lg:inline">Swap Data</span>
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            {onOpenOpenFDA && (
              <button
                onClick={onOpenOpenFDA}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition"
                title="Stream live adverse events directly from openFDA (FAERS / MAUDE)"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Stream openFDA</span>
              </button>
            )}

            {onOpenImportResults && (
              <button
                onClick={onOpenImportResults}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                title="Re-import previously exported analysis results (.xlsx, .csv, .parquet)"
              >
                <UploadCloud className="w-3.5 h-3.5 text-slate-300" />
                <span className="hidden sm:inline">Import Results</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

