/**
 * Analysis Methods Configuration Modal
 * Allows users to choose which disproportionality methods (PRR, ROR, RFET, BCPNN, GPS, LASSO, dynamic)
 * are executed across multi-method consensus and conglomerate statistics.
 */

import React, { useState } from 'react';
import { X, Sliders, CheckCircle2, Layers, Sparkles } from 'lucide-react';
import { DisproportionalityMethod } from '../types/vigipy';
import { MethodPicker } from './MethodPicker';

interface AnalysisMethodsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMethods: DisproportionalityMethod[];
  onSaveActiveMethods: (methods: DisproportionalityMethod[]) => void;
}

export const AnalysisMethodsModal: React.FC<AnalysisMethodsModalProps> = ({
  isOpen,
  onClose,
  activeMethods,
  onSaveActiveMethods,
}) => {
  const [selectedMethods, setSelectedMethods] = useState<DisproportionalityMethod[]>(activeMethods);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveActiveMethods(selectedMethods);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Active Multi-Analysis Methods</h2>
              <p className="text-xs text-slate-400">
                Choose which statistical methods to execute for conglomerate metrics and voting consensus
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          <MethodPicker
            selectedMethods={selectedMethods}
            onChange={setSelectedMethods}
            title="Analysis Algorithms to Include"
            subtitle="The conglomerate results table and forest plots will calculate voting ratios and normalized geometric margins based on these methods."
          />

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5 space-y-1.5 text-slate-300">
            <span className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              How Multi-Analysis Conglomerate Stats Work:
            </span>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
              <li>
                <strong className="text-slate-200">Methods Voting Signal:</strong> Counts how many active methods flag a Safety Signal (SDR) meeting their decision cutoff.
              </li>
              <li>
                <strong className="text-slate-200">Normalized Geometric Margin:</strong> Computes the geometric mean of fold-excess across all chosen methods relative to decision thresholds. Natively handles ratio cutoffs (PRR, ROR), zero cutoffs (IC₀₂₅ &gt; 0, LASSO &gt; 0), and negative thresholds.
              </li>
              <li>
                <strong className="text-slate-200">Multi-Method Forest Plot:</strong> Renders each method&apos;s point estimate, 95% interval, and distance from cutoff on an aligned threshold axis.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/70 px-6 py-4 flex items-center justify-between">
          <span className="text-[11px] text-indigo-300 font-mono">
            {selectedMethods.length} Methods Selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-indigo-600/20"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Apply &amp; Recalculate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
