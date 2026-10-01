/**
 * Multi-Method Detailed Breakdown Modal
 * Displays:
 * 1. Comparative Forest Plot of all evaluated methods (PRR, ROR, RFET, BCPNN, GPS, LASSO)
 * 2. Detailed Method-by-Method Breakdown Results Table
 * 3. General 2x2 Contingency & Disproportionality Statistics (Observed, Expected, Chi-sq, O/E, FDR)
 */

import React from 'react';
import { X, CheckCircle2, ShieldAlert, BarChart2, Layers, ExternalLink, HelpCircle, Activity } from 'lucide-react';
import { ConsensusSignal } from '../types/vigipy';
import { MultiMethodForestPlot } from './MultiMethodForestPlot';

interface MultiMethodDetailModalProps {
  signal: ConsensusSignal | null;
  onClose: () => void;
}

export const MultiMethodDetailModal: React.FC<MultiMethodDetailModalProps> = ({
  signal,
  onClose,
}) => {
  if (!signal) return null;

  const votes = signal.methodVotes || [];
  const c = signal.contingency;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Multi-Method Conglomerate Analysis Breakdown
                </h3>
                <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-[10px] text-indigo-300 font-mono">
                  {signal.votingRatio} Voting SDR
                </span>
              </div>
              <p className="text-xs text-slate-400">
                <span className="text-rose-300 font-semibold">{signal.drug}</span>
                <span className="mx-1.5 text-slate-600">→</span>
                <span className="text-slate-200 font-semibold">{signal.event}</span>
                {signal.soc && <span className="text-slate-500 ml-2 font-mono">({signal.soc})</span>}
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
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Top Conglomerate KPI Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Voting Consensus */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Methods Voting SDR
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold font-mono text-rose-300">
                  {signal.votingRatio}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  ({Math.round(signal.consensusScore * 100)}%)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block">
                {signal.isConsensusSignal ? 'Consensus Signal Declared' : 'Divergent Signal'}
              </span>
            </div>

            {/* Normalized Geometric Excess */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-indigo-500/30 space-y-1">
              <span className="text-[10px] text-indigo-300 uppercase tracking-wider font-semibold">
                Norm. Geometric Margin
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold font-mono text-cyan-300">
                  {(signal.normalizedGeometricExcess || 1).toFixed(2)}x
                </span>
                <span className="text-[10px] text-slate-400">above cutoff</span>
              </div>
              <span className="text-[10px] text-slate-500 block">
                Dimensionless across all methods
              </span>
            </div>

            {/* Observed Cases N11 */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Observed Cases (N₁₁)
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold font-mono text-white">
                  {c.n11.toLocaleString()}
                </span>
                <span className="text-[10.5px] text-slate-400">
                  (Exp: {(signal.expected || c.expected).toFixed(1)})
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block">
                O/E Ratio: {(signal.oeRatio || (c.expected > 0 ? c.n11 / c.expected : 1)).toFixed(2)}x
              </span>
            </div>

            {/* Chi-Square */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Pearson Chi-Square
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold font-mono text-amber-300">
                  {(signal.chiSquare || c.chiSquare).toFixed(1)}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  (Yates: {(signal.yatesChiSquare || c.yatesChiSquare).toFixed(1)})
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 block font-mono">
                {signal.primaryQValue ? `FDR q: ${signal.primaryQValue.toExponential(2)}` : 'Statistically Significant'}
              </span>
            </div>
          </div>

          {/* 1. Multi-Method Forest Plot */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-cyan-400" />
              1. Multi-Method Comparative Forest Plot
            </h4>
            <MultiMethodForestPlot consensusSignal={signal} />
          </div>

          {/* 2. Detailed Method Breakdown Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-400" />
              2. Individual Method Results & Voting Breakdown
            </h4>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950">
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Primary Score</th>
                    <th className="py-2.5 px-3">95% Confidence / Credible Interval</th>
                    <th className="py-2.5 px-3">Signal Threshold</th>
                    <th className="py-2.5 px-3 text-center">Margin Above Cutoff</th>
                    <th className="py-2.5 px-3 text-center">Decision Vote</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {votes.map((v) => {
                    const isSig = v.isSignal;
                    return (
                      <tr key={v.method} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{v.method}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-200">
                          {v.formattedScore}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {v.formattedInterval}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {v.method === 'PRR' && `PRR ≥ ${v.threshold.toFixed(1)}`}
                          {v.method === 'ROR' && `ROR₀₂₅ > ${v.threshold.toFixed(1)}`}
                          {v.method === 'RFET' && `p < ${v.threshold.toFixed(3)}`}
                          {v.method === 'BCPNN' && `IC₀₂₅ > ${v.threshold.toFixed(1)}`}
                          {v.method === 'GPS' && `EB₀₅ ≥ ${v.threshold.toFixed(1)}`}
                          {v.method === 'LASSO' && `β > ${v.threshold.toFixed(2)}`}
                          {!['PRR', 'ROR', 'RFET', 'BCPNN', 'GPS', 'LASSO'].includes(v.method) && `Cutoff: ${v.threshold}`}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                              v.foldExcess >= 1.0
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {v.foldExcess.toFixed(2)}x
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isSig ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              <CheckCircle2 className="h-3 w-3" />
                              SIGNAL (SDR)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-500">
                              Sub-threshold
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. General 2x2 Contingency & Disproportionality Statistics */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-400" />
              3. General Contingency Matrix & Surveillance Statistics
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 2x2 Matrix */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
                <span className="text-[11px] font-semibold text-slate-300 block">
                  2×2 Contingency Table (Case Reports)
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-center text-xs border border-slate-800 font-mono">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                        <th className="p-2 text-left">Exposure</th>
                        <th className="p-2 text-rose-300">Target Event ({signal.event})</th>
                        <th className="p-2 text-slate-400">All Other Events</th>
                        <th className="p-2 text-slate-300">Marginal Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      <tr>
                        <td className="p-2 text-left font-semibold text-indigo-300">
                          {signal.drug}
                        </td>
                        <td className="p-2 font-bold text-rose-400 bg-rose-950/20">
                          N₁₁ = {c.n11.toLocaleString()}
                        </td>
                        <td className="p-2 text-slate-300">
                          N₁₀ = {c.n10.toLocaleString()}
                        </td>
                        <td className="p-2 font-semibold text-slate-200 bg-slate-900/60">
                          N₁₊ = {c.n1dot.toLocaleString()}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 text-left text-slate-400">All Other Products</td>
                        <td className="p-2 text-slate-300">
                          N₀₁ = {c.n01.toLocaleString()}
                        </td>
                        <td className="p-2 text-slate-400">
                          N₀₀ = {c.n00.toLocaleString()}
                        </td>
                        <td className="p-2 font-semibold text-slate-300 bg-slate-900/60">
                          N₀₊ = {(c.n01 + c.n00).toLocaleString()}
                        </td>
                      </tr>
                      <tr className="bg-slate-900/80 font-semibold text-slate-300 border-t border-slate-800">
                        <td className="p-2 text-left">Marginal Total</td>
                        <td className="p-2 text-slate-200">
                          N₊₁ = {c.ndot1.toLocaleString()}
                        </td>
                        <td className="p-2 text-slate-400">
                          N₊₀ = {(c.n10 + c.n00).toLocaleString()}
                        </td>
                        <td className="p-2 text-cyan-300 bg-slate-800/80">
                          N₊₊ = {c.ndotdot.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Statistical Summary Formulas */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2.5">
                <span className="text-[11px] font-semibold text-slate-300 block">
                  Surveillance Metric Calculations
                </span>

                <div className="space-y-2 text-[11px] font-mono text-slate-300">
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-400">Expected Baseline (E):</span>
                    <span className="font-bold text-white">
                      {(signal.expected || c.expected).toFixed(2)} cases
                    </span>
                  </div>

                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-400">Observed / Expected (O/E):</span>
                    <span className="font-bold text-cyan-300">
                      {(signal.oeRatio || (c.expected > 0 ? c.n11 / c.expected : 1)).toFixed(2)}x
                    </span>
                  </div>

                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-400">Pearson Chi-Square (χ²):</span>
                    <span className="font-bold text-amber-300">{c.chiSquare.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-400">Yates Corrected χ²:</span>
                    <span className="font-bold text-amber-400">{c.yatesChiSquare.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-400">Normalized Geometric Margin:</span>
                    <span className="font-bold text-rose-300">
                      {(signal.normalizedGeometricExcess || 1).toFixed(2)}x
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 space-y-1">
                  <span className="font-semibold text-slate-300 flex items-center gap-1">
                    <HelpCircle className="h-3 w-3 text-cyan-400" />
                    How Normalized Geometric Margin is Evaluated:
                  </span>
                  <p className="leading-relaxed">
                    Evaluates <code className="text-cyan-300 font-mono">exp(mean(ln(FoldExcess)))</code> across all active methods. Normalizes ratio-scale metrics by <code className="font-mono text-slate-300">S / T</code>, and additive log-information metrics (BCPNN) by <code className="font-mono text-slate-300">2^(S - T)</code> to natively support zero and negative thresholds.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/80 px-6 py-4 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Pair ID: {signal.id}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-indigo-600/20"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
};
