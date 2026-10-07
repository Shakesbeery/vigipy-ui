import React from "react";
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
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 flex items-center justify-between select-none shrink-0 z-30">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-white tracking-tight">vigipy-ui</h1>
            <button
              onClick={onOpenVersionModal}
              className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition cursor-pointer flex items-center gap-1"
              title="View vigipy version and PyPI release info"
            >
              <Package className="w-3 h-3 text-blue-400" />
              <span>{vigipyVersion ? `vigipy v${vigipyVersion}` : "vigipy v3.4.0"}</span>
            </button>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">
            Pharmacovigilance Signal Detection & Consensus Engine
          </p>
        </div>
      </div>

      {/* Dataset & Analysis Telemetry */}
      {summary && (
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono bg-slate-950/60 px-3.5 py-1.5 rounded-lg border border-slate-800">
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
      <div className="flex items-center gap-2.5">
        {/* Backend Heartbeat */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              backendOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
            }`}
          />
          <span className="text-[11px] text-slate-300 font-mono hidden sm:inline">
            {backendOnline ? "Engine Online" : "Offline"}
          </span>
        </div>

        {onOpenFaersWarehouse && (
          <button
            onClick={onOpenFaersWarehouse}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-teal-600/40 transition"
            title="Local FAERS warehouse (2012→present): export drug-family / indication cohorts"
          >
            <HardDrive className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden lg:inline">FAERS Warehouse</span>
          </button>
        )}

        {summary ? (
          <>
            {onOpenQualityProfiler && (
              <button
                onClick={onOpenQualityProfiler}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                title="Evaluate data hygiene and missingness"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden xl:inline">Hygiene</span>
              </button>
            )}

            {onOpenCodeViewer && (
              <button
                onClick={onOpenCodeViewer}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                title="View reproducible Python script matching active configuration"
              >
                <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden xl:inline">Python Code</span>
              </button>
            )}

            {onOpenProjectContainer && (
              <button
                onClick={onOpenProjectContainer}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                title="Backup or restore full workspace (.vigipy.json)"
              >
                <Archive className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden xl:inline">Workspace</span>
              </button>
            )}

            {onOpenAuditDossier && (
              <button
                onClick={onOpenAuditDossier}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                title="GxP 21 CFR Part 11 Regulatory Dossier & Audit Log"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xl:inline">GxP Dossier</span>
              </button>
            )}

            {onOpenColumns && (
              <button
                onClick={onOpenColumns}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                title="Select or swap columns feeding into analyses"
              >
                <Columns className="w-3.5 h-3.5 text-slate-300" />
                <span>Columns</span>
              </button>
            )}

            <button
              onClick={onOpenConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
              title="Configure Disproportionality Methods"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-300" />
              <span>Methods</span>
            </button>

            <button
              onClick={onOpenExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition"
              title="Export Results to Excel or CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            {onOpenImportResults && (
              <button
                onClick={onOpenImportResults}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                title="Re-import previously exported analysis results (.xlsx, .csv, .parquet)"
              >
                <UploadCloud className="w-3.5 h-3.5 text-slate-300" />
                <span className="hidden sm:inline">Import</span>
              </button>
            )}

            <button
              onClick={onSwapDataset || onResetData}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
              title="Quickly switch to a new dataset or upload another data file"
            >
              <FolderOpen className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline">Swap Data</span>
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
                <span>Import Previous Results</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
