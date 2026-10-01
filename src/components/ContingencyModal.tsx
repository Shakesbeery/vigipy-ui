/**
 * 2x2 Contingency Matrix & Statistical Breakdown Modal
 * Displays observed counts, marginals, expected baseline, Chi-square contributions,
 * and comprehensive statistical metric reports.
 */

import React from 'react';
import { X, ExternalLink, Activity, Database, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ContingencyTable, DisproportionalityMethod, SignalResult } from '../types/vigipy';

interface ContingencyModalProps {
  drug: string;
  event: string;
  table: ContingencyTable;
  soc?: string;
  resultsByMethod?: Partial<Record<DisproportionalityMethod, SignalResult>>;
  onClose: () => void;
}

export const ContingencyModal: React.FC<ContingencyModalProps> = ({
  drug,
  event,
  table,
  soc,
  resultsByMethod,
  onClose,
}) => {
  const oeRatio = table.expected > 0 ? (table.n11 / table.expected).toFixed(2) : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{drug}</h2>
                <span className="text-slate-500">→</span>
                <span className="text-lg font-semibold text-cyan-300">{event}</span>
              </div>
              <p className="text-xs text-slate-400">
                {soc ? `Category / Classification: ${soc}` : 'Statistical Contingency Matrix & Signal Decomposition'}
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
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="text-[11px] text-slate-400 font-medium">Observed Reports (N₁₁)</div>
              <div className="text-2xl font-bold font-mono text-rose-400 mt-1">{table.n11}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Target Product + Outcome</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="text-[11px] text-slate-400 font-medium">Expected Baseline (E)</div>
              <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">{table.expected.toFixed(2)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">(N₁• × N•₁) / N••</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="text-[11px] text-slate-400 font-medium">Observed / Expected (O/E)</div>
              <div className="text-2xl font-bold font-mono text-amber-300 mt-1">{oeRatio}x</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Disproportionality ratio</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="text-[11px] text-slate-400 font-medium">Pearson χ² (1 df)</div>
              <div className="text-2xl font-bold font-mono text-violet-400 mt-1">{table.chiSquare.toFixed(2)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Yates χ²: {table.yatesChiSquare.toFixed(2)}</div>
            </div>
          </div>

          {/* 2x2 Contingency Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-400" />
              Standard 2×2 Contingency Matrix
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3 text-left">Exposure Classification</th>
                    <th className="py-2 px-3 text-cyan-300 font-semibold">{event} (Reported Outcome)</th>
                    <th className="py-2 px-3 text-slate-300">All Other Outcomes</th>
                    <th className="py-2 px-3 text-right text-indigo-300 font-semibold">Row Marginal (N_row)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  <tr>
                    <td className="py-3 px-3 text-left font-sans font-semibold text-rose-300">
                      {drug} (Target Exposure)
                    </td>
                    <td className="py-3 px-3 bg-rose-500/10 text-rose-200 font-bold border-r border-slate-800">
                      N₁₁ = {table.n11}
                    </td>
                    <td className="py-3 px-3 text-slate-300 border-r border-slate-800">
                      N₁₀ = {table.n10}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-indigo-200">
                      N₁• = {table.n1dot}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3 px-3 text-left font-sans text-slate-400">
                      All Other Products / Devices
                    </td>
                    <td className="py-3 px-3 text-slate-300 border-r border-slate-800">
                      N₀₁ = {table.n01}
                    </td>
                    <td className="py-3 px-3 text-slate-400 border-r border-slate-800">
                      N₀₀ = {table.n00}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      N₀• = {table.ndotdot - table.n1dot}
                    </td>
                  </tr>

                  <tr className="border-t border-slate-700 bg-slate-900/60 font-semibold">
                    <td className="py-3 px-3 text-left font-sans text-indigo-300">
                      Column Marginal (N_col)
                    </td>
                    <td className="py-3 px-3 text-cyan-200 border-r border-slate-800">
                      N•₁ = {table.ndot1}
                    </td>
                    <td className="py-3 px-3 text-slate-300 border-r border-slate-800">
                      N•₀ = {table.ndotdot - table.ndot1}
                    </td>
                    <td className="py-3 px-3 text-right text-white font-bold bg-indigo-950/40">
                      N•• = {table.ndotdot}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Method Decomposition */}
          {resultsByMethod && Object.keys(resultsByMethod).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                vigipy Multi-Method Evaluation Breakdown
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(['PRR', 'ROR', 'RFET', 'BCPNN', 'GPS', 'LASSO'] as DisproportionalityMethod[]).map((m) => {
                  const r = resultsByMethod[m];
                  if (!r) return null;
                  const isSig = r.isSignal;

                  return (
                    <div
                      key={m}
                      className={`p-3 rounded-xl border text-xs ${
                        isSig
                          ? 'border-rose-500/40 bg-rose-500/5'
                          : 'border-slate-800 bg-slate-950/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold font-mono text-slate-200">{m}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isSig
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isSig ? 'SIGNAL' : 'NO SIGNAL'}
                        </span>
                      </div>
                      <div className="text-lg font-bold font-mono text-slate-100">{r.formattedScore}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">{r.formattedInterval}</div>
                      {r.qValue !== undefined && (
                        <div className="text-[10px] text-slate-500 mt-1">
                          FDR q-val: {r.qValue < 0.001 ? r.qValue.toExponential(2) : r.qValue.toFixed(4)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/60 px-6 py-3.5 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>Continuity Correction:</span>
            <span className="text-slate-300 font-mono">
              {table.corrected ? '+0.5 (Haldane-Anscombe Applied)' : 'None (Sufficient cell counts)'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Close Matrix
          </button>
        </div>
      </div>
    </div>
  );
};
