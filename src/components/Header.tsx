/**
 * vigipy Studio Header Component
 * Consolidated into two clear functional groupings:
 * 1. Data Ingestion (Surveillance Data Upload, openFDA Live API, Project Container, Data Quality Profiler)
 * 2. Surveillance Configuration (Algorithm Parameters, Multi-Method Picker, PyPI Version Manager, Regulatory Dossier)
 * Follows strict Zero-Pill discipline on static metadata.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Activity,
  Database,
  Globe,
  Sliders,
  Layers,
  Archive,
  ChevronDown,
  ShieldCheck,
  FileSpreadsheet,
  Check,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  datasetTitle: string;
  totalRecords: number;
  filteredRecords: number;
  signalCount: number;
  consensusCount: number;
  activeVersion: string;
  activeMethodCount?: number;
  onOpenAnalysisMethods?: () => void;
  onOpenOpenFDA: () => void;
  onOpenDatasetModal: () => void;
  onOpenConfigDrawer: () => void;
  onOpenVersionModal: () => void;
  onOpenProjectContainer: () => void;
  onOpenDataProfiler?: () => void;
  onOpenExportAudit?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  datasetTitle,
  totalRecords,
  filteredRecords,
  signalCount,
  consensusCount,
  activeVersion,
  activeMethodCount = 8,
  onOpenAnalysisMethods,
  onOpenOpenFDA,
  onOpenDatasetModal,
  onOpenConfigDrawer,
  onOpenVersionModal,
  onOpenProjectContainer,
  onOpenDataProfiler,
  onOpenExportAudit,
}) => {
  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);
  const [isConfigMenuOpen, setIsConfigMenuOpen] = useState(false);
  const dataMenuRef = useRef<HTMLDivElement | null>(null);
  const configMenuRef = useRef<HTMLDivElement | null>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dataMenuRef.current && !dataMenuRef.current.contains(e.target as Node)) {
        setIsDataMenuOpen(false);
      }
      if (configMenuRef.current && !configMenuRef.current.contains(e.target as Node)) {
        setIsConfigMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand & Zero-Pill Metadata */}
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 via-rose-500 to-amber-500 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
              <Activity className="h-5 w-5 text-rose-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1 font-display">
                <span>vigipy</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-indigo-300 to-cyan-300">
                  Studio
                </span>
              </h1>
              {/* Subtle hairline unboxed version indicator */}
              <button
                type="button"
                onClick={onOpenVersionModal}
                title="Click to check PyPI for updates & manage vigipy DA algorithms"
                className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-mono transition-colors ml-1"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>v{activeVersion}</span>
              </button>
            </div>
            {/* Zero-Pill Static Metadata with Hairline Separators */}
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>Safety Surveillance &amp; Signal Detection</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400 font-mono truncate max-w-[180px] sm:max-w-[240px]">
                {datasetTitle || 'Standard FAERS Cohort'}
              </span>
              <span className="text-slate-600 hidden md:inline">·</span>
              <span className="text-slate-500 hidden md:inline">
                {filteredRecords.toLocaleString()} cases
              </span>
            </div>
          </div>
        </div>

        {/* Two Consolidated Navigation Header Groupings */}
        <div className="flex items-center gap-2.5">
          {/* GROUP 1: DATA INGESTION MENU */}
          <div className="relative" ref={dataMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsDataMenuOpen(!isDataMenuOpen);
                setIsConfigMenuOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors shadow-sm"
            >
              <Database className="h-3.5 w-3.5 text-indigo-400" />
              <span>Data Ingestion</span>
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isDataMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDataMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-800 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-md z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-xs">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80 mb-1">
                  Surveillance Data Sources
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsDataMenuOpen(false);
                    onOpenDatasetModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white text-left transition-colors"
                >
                  <Database className="h-4 w-4 text-indigo-400 shrink-0" />
                  <div>
                    <div className="font-semibold">Upload Dataset Extract</div>
                    <div className="text-[10px] text-slate-400">.xlsx, .parquet, .csv, .tsv, .json</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsDataMenuOpen(false);
                    onOpenOpenFDA();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white text-left transition-colors"
                >
                  <Globe className="h-4 w-4 text-cyan-400 shrink-0" />
                  <div>
                    <div className="font-semibold">openFDA Live Stream</div>
                    <div className="text-[10px] text-slate-400">FAERS (Drugs) &amp; MAUDE (Devices)</div>
                  </div>
                </button>

                {onOpenDataProfiler && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDataMenuOpen(false);
                      onOpenDataProfiler();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white text-left transition-colors"
                  >
                    <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-semibold">Data Quality &amp; Deduplication</div>
                      <div className="text-[10px] text-slate-400">Profile missingness &amp; duplicate cases</div>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsDataMenuOpen(false);
                    onOpenProjectContainer();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white text-left transition-colors border-t border-slate-800/80 mt-1 pt-1.5"
                >
                  <Archive className="h-4 w-4 text-violet-400 shrink-0" />
                  <div>
                    <div className="font-semibold">Project Container Archive</div>
                    <div className="text-[10px] text-slate-400">Export/import complete workspace</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* GROUP 2: SURVEILLANCE CONFIGURATION MENU */}
          <div className="relative" ref={configMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsConfigMenuOpen(!isConfigMenuOpen);
                setIsDataMenuOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors shadow-sm"
            >
              <Sliders className="h-3.5 w-3.5 text-amber-400" />
              <span>Surveillance Configuration</span>
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isConfigMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isConfigMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-800 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-md z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-xs">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80 mb-1">
                  Parameters &amp; Methodologies
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsConfigMenuOpen(false);
                    onOpenConfigDrawer();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white text-left transition-colors"
                >
                  <Sliders className="h-4 w-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="font-semibold">Algorithm Hyperparameters</div>
                    <div className="text-[10px] text-slate-400">Thresholds, priors, FDR, FISTA tol</div>
                  </div>
                </button>

                {onOpenAnalysisMethods && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsConfigMenuOpen(false);
                      onOpenAnalysisMethods();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white text-left transition-colors"
                  >
                    <Layers className="h-4 w-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="font-semibold flex items-center gap-1.5">
                        <span>Multi-Method Picker</span>
                        <span className="text-[10px] font-mono text-indigo-300">({activeMethodCount} Active)</span>
                      </div>
                      <div className="text-[10px] text-slate-400">PRR, ROR, RFET, BCPNN, GPS, LASSO, SCORE</div>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsConfigMenuOpen(false);
                    onOpenVersionModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white text-left transition-colors"
                >
                  <Activity className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-semibold">PyPI Version Tracker</div>
                    <div className="text-[10px] text-slate-400">vigipy 3.4.0 sync &amp; changelog</div>
                  </div>
                </button>

                {onOpenExportAudit && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsConfigMenuOpen(false);
                      onOpenExportAudit();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white text-left transition-colors border-t border-slate-800/80 mt-1 pt-1.5"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-semibold">Regulatory Dossier &amp; GxP Audit</div>
                      <div className="text-[10px] text-slate-400">Multi-sheet .xlsx &amp; Part 11 manifest</div>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
