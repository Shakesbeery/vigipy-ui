/**
 * Regulatory Export & GxP Audit Dossier Modal
 * Facilitates 1-click generation of:
 * 1. Multi-Sheet Regulatory Excel Workbook (.xlsx)
 * 2. 21 CFR Part 11 / EU GVP Signed Audit Trail JSON
 */

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileCheck,
  Download,
  X,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  exportRegulatoryExcelWorkbook,
  exportGxPAuditManifest,
  RegulatoryExportContext,
} from '../core/regulatory_export';

interface ExportAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportContext: RegulatoryExportContext;
}

export const ExportAuditModal: React.FC<ExportAuditModalProps> = ({
  isOpen,
  onClose,
  exportContext,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExcelExport = () => {
    try {
      exportRegulatoryExcelWorkbook(exportContext);
      setDownloadSuccess('Multi-sheet Excel workbook (.xlsx) generated and downloaded successfully.');
    } catch (err: any) {
      alert(`Excel export failed: ${err.message}`);
    }
  };

  const handleAuditExport = () => {
    try {
      exportGxPAuditManifest(exportContext);
      setDownloadSuccess('21 CFR Part 11 / GxP signed audit manifest (.json) generated successfully.');
    } catch (err: any) {
      alert(`Audit export failed: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Regulatory Dossier &amp; GxP Audit Hub</h2>
              <p className="text-xs text-slate-400">
                21 CFR Part 11 compliant multi-sheet workbooks &amp; cryptographic audit manifests
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto">
          {/* Metadata Overview with Zero-Pill Typography */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-300 space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Active Surveillance Cohort:</span>
              <span className="text-white font-semibold">{exportContext.datasetName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Cohort Record Count:</span>
              <span className="text-slate-200">{exportContext.filteredCount.toLocaleString()} of {exportContext.recordCount.toLocaleString()} cases</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">vigipy Engine Version:</span>
              <span className="text-emerald-400 font-bold">v{exportContext.vigipyVersion} (2026-10 Release)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Evaluated DA Algorithms:</span>
              <span className="text-indigo-300">{exportContext.activeMethods.join(' · ')}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-1.5">
              <span className="text-slate-400">Evaluated Pairs:</span>
              <span className="text-white font-bold">{exportContext.consensusSignals.length} drug-event pairs</span>
            </div>
          </div>

          {/* Action 1: Multi-Sheet Excel Dossier */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 hover:border-slate-700 transition-colors space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-slate-200">
                  Multi-Sheet Regulatory Excel Workbook (.xlsx)
                </h4>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">vg.export() compatible</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Contains 4 dedicated sheets matching health authority dossier submission standards:
              <strong className="text-slate-300"> Executive_Summary</strong>,
              <strong className="text-slate-300"> Consensus_SDRs</strong>,
              <strong className="text-slate-300"> Method_Specific_Results</strong> (PRR, ROR, RFET, BCPNN, GPS, LASSO, SCORE), and
              <strong className="text-slate-300"> Concordance_Matrix</strong> (Cohen’s Kappa &amp; Jaccard similarity).
            </p>
            <button
              type="button"
              onClick={handleExcelExport}
              className="mt-1 w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/20"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Multi-Sheet Excel Dossier (.xlsx)</span>
            </button>
          </div>

          {/* Action 2: GxP Signed Audit Manifest JSON */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 hover:border-slate-700 transition-colors space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-indigo-400" />
                <h4 className="text-xs font-bold text-slate-200">
                  Regulatory Method Audit Trail Log (21 CFR Part 11)
                </h4>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">GxP Manifest</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Cryptographically timestamped machine-readable JSON recording exact algorithm formulas,
              hyperparameter configs, cohort inclusion/exclusion filter states, and system environment checksums.
            </p>
            <button
              type="button"
              onClick={handleAuditExport}
              className="mt-1 w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-600/20"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Signed Audit Manifest (.json)</span>
            </button>
          </div>

          {downloadSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{downloadSuccess}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-950/70 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
