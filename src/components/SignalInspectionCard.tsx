/**
 * Signal Inspection Card for Master-Detail Split-Pane Layout
 * Provides instant side-by-side inspection on desktop viewports (>= 1280px / 1440px)
 * Displays 2x2 contingency matrix, fold-excess gauge, multi-method voting breakdown,
 * and error metrics without requiring a full-page modal popup.
 */

import React from 'react';
import { X, TrendingUp, Layers, CheckCircle2, ShieldAlert, Sparkles, Activity, FileText } from 'lucide-react';
import { ConsensusSignal, DisproportionalityMethod, SignalResult } from '../types/vigipy';

interface SignalInspectionCardProps {
  signal: SignalResult | null;
  consensusSignal?: ConsensusSignal | null;
  onClose: () => void;
  onViewLongitudinal?: (drug: string, event: string) => void;
  onViewConsensusDetails?: (drug: string, event: string) => void;
}

export const SignalInspectionCard: React.FC<SignalInspectionCardProps> = ({
  signal,
  consensusSignal,
  onClose,
  onViewLongitudinal,
  onViewConsensusDetails,
}) => {
  if (!signal) return null;

  const table = signal.contingency;
  const n11 = table.n11;
  const n10 = table.n10;
  const n01 = table.n01;
  const n00 = table.n00;
  const expected = table.expected;
  const oe = expected > 0 ? (n11 / expected).toFixed(2) : '—';

  // Fold excess above null threshold (e.g. PRR / 2.0 or ROR / 2.0 or IC / 0)
  const isAdditive = signal.method === 'BCPNN' || signal.method === 'LASSO';
  const threshold = isAdditive ? (signal.method === 'LASSO' ? 0.05 : 0.0) : 2.0;
  const foldExcess = isAdditive
    ? signal.score - threshold
    : Number((signal.score / Math.max(0.1, threshold)).toFixed(2));

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-4 backdrop-blur shadow-2xl space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-800/80 pb-3 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider ${
              signal.isSignal
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {signal.isSignal ? 'Regulatory SDR Signal' : 'Background Reference'}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Method: {signal.method}</span>
          </div>

          <h3 className="text-sm font-bold text-white mt-1.5 leading-snug">
            <span className="text-rose-400 font-semibold">{signal.drug}</span>
            <span className="text-slate-500 font-normal"> · </span>
            <span className="text-cyan-300">{signal.event}</span>
          </h3>
          {signal.soc && (
            <p className="text-[11px] text-slate-400 mt-0.5 font-sans truncate max-w-[280px]">
              {signal.soc}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Close Inspection Panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Primary Point Estimate & Gauge */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/60">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            {signal.metricLabel || signal.method} Score
          </div>
          <div className="text-xl font-black font-mono text-white mt-0.5">
            {signal.formattedScore || signal.score.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
            95% CI: {signal.formattedInterval || `[${signal.lowerBound.toFixed(2)}, ${signal.upperBound.toFixed(2)}]`}
          </div>
        </div>

        <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/60">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Fold Excess (O/E)
          </div>
          <div className="text-xl font-black font-mono text-rose-300 mt-0.5">
            {oe}x
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {isAdditive ? `Delta: ${foldExcess > 0 ? '+' : ''}${foldExcess.toFixed(2)}` : `${foldExcess}x vs threshold`}
          </div>
        </div>
      </div>

      {/* 2x2 Contingency Matrix */}
      <div>
        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
          <span>2×2 Contingency Table</span>
          <span className="text-[10px] font-mono text-slate-500">N·· = {table.ndotdot.toLocaleString()}</span>
        </div>
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 text-[11px] font-mono">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-950/80 text-[10px] text-slate-400 border-b border-slate-800">
                <th className="py-1 px-2 text-left font-sans">Cell</th>
                <th className="py-1 px-2">{signal.event.substring(0, 10)}…</th>
                <th className="py-1 px-2 text-slate-500">Other AEs</th>
                <th className="py-1 px-2 font-bold text-slate-300">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr>
                <td className="py-1 px-2 text-left font-sans text-rose-300 font-medium">
                  {signal.drug.substring(0, 10)}…
                </td>
                <td className="py-1 px-2 font-bold text-white bg-rose-500/10">
                  {n11.toLocaleString()}
                </td>
                <td className="py-1 px-2 text-slate-300">{n10.toLocaleString()}</td>
                <td className="py-1 px-2 text-slate-400 font-semibold">{table.n1dot.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="py-1 px-2 text-left font-sans text-slate-400">Other Products</td>
                <td className="py-1 px-2 text-slate-300">{n01.toLocaleString()}</td>
                <td className="py-1 px-2 text-slate-400">{n00.toLocaleString()}</td>
                <td className="py-1 px-2 text-slate-400">{(table.ndotdot - table.n1dot).toLocaleString()}</td>
              </tr>
              <tr className="bg-slate-950/50 text-[10px] text-slate-400 border-t border-slate-800 font-bold">
                <td className="py-1 px-2 text-left font-sans">Total</td>
                <td className="py-1 px-2">{table.ndot1.toLocaleString()}</td>
                <td className="py-1 px-2">{(table.ndotdot - table.ndot1).toLocaleString()}</td>
                <td className="py-1 px-2 text-indigo-300">{table.ndotdot.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-Method Consensus Voting Breakdown (if available) */}
      {consensusSignal && (
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
            <span>Multi-Method Triangulation</span>
            <span className="font-mono text-violet-400">
              {consensusSignal.signalCount} / {consensusSignal.totalMethods} agree
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono">
            {Object.entries(consensusSignal.methodResults).map(([mName, mResult]) => {
              const declared = mResult?.isSignal;
              return (
                <div
                  key={mName}
                  className={`p-1.5 rounded-lg border text-center ${
                    declared
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-300 font-bold'
                      : 'border-slate-800 bg-slate-950/40 text-slate-500'
                  }`}
                >
                  <div className="text-[9px] uppercase">{mName}</div>
                  <div className="text-[10px] truncate">{mResult?.formattedScore || mResult?.score.toFixed(1)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error & Bayesian Diagnostics */}
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-2.5">
        <div>Expected E: <span className="text-slate-200">{expected.toFixed(1)}</span></div>
        <div>p-value: <span className="text-slate-200">{signal.pValue !== undefined ? (signal.pValue < 0.001 ? signal.pValue.toExponential(2) : signal.pValue.toFixed(4)) : '—'}</span></div>
        <div>FDR (q-value): <span className="text-slate-200">{signal.qValue !== undefined ? signal.qValue.toFixed(4) : (signal.fdr ? signal.fdr.toFixed(3) : '—')}</span></div>
        <div>Specificity: <span className="text-slate-200">{signal.specificity ? `${(signal.specificity * 100).toFixed(0)}%` : '—'}</span></div>
      </div>

      {/* Quick Action Navigation */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
        {onViewLongitudinal && (
          <button
            type="button"
            onClick={() => onViewLongitudinal(signal.drug, signal.event)}
            className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <TrendingUp className="h-3.5 w-3.5 text-rose-400" />
            <span>View Trajectory</span>
          </button>
        )}
        {onViewConsensusDetails && (
          <button
            type="button"
            onClick={() => onViewConsensusDetails(signal.drug, signal.event)}
            className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Layers className="h-3.5 w-3.5 text-violet-400" />
            <span>Full Arbitration</span>
          </button>
        )}
      </div>
    </div>
  );
};
