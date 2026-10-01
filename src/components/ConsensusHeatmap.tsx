/**
 * Multi-Method Consensus Heatmap & Signal Matrix
 * Evaluates agreement across PRR, ROR, RFET, BCPNN, GPS, LASSO, SCORE-DA, and SCORE-DDI methods.
 * Implements vigipy 3.4.0 consensus_analysis features:
 * - Agreement Tiers (Unanimous, Strong, Moderate, Weak, Isolated)
 * - Inter-method concordance analytics (Cohen's Kappa & Jaccard matrices)
 * - Side-by-side inspect_signal drill-down
 */

import React, { useState, useMemo } from 'react';
import { AgreementTier, ConsensusSignal, DisproportionalityMethod } from '../types/vigipy';
import { useRegisteredMethods } from '../core/method_registry';

interface ConsensusHeatmapProps {
  signals: ConsensusSignal[];
  onSelectSignal: (signal: ConsensusSignal) => void;
  selectedSignal?: ConsensusSignal | null;
}

export const ConsensusHeatmap: React.FC<ConsensusHeatmapProps> = ({
  signals,
  onSelectSignal,
  selectedSignal,
}) => {
  const registeredMethods = useRegisteredMethods();
  const methods: DisproportionalityMethod[] = registeredMethods.map((m) => m.id as DisproportionalityMethod);
  const [tierFilter, setTierFilter] = useState<'ALL' | AgreementTier>('ALL');
  const [showConcordance, setShowConcordance] = useState<boolean>(false);
  const [isDiscordanceOnly, setIsDiscordanceOnly] = useState<boolean>(false);
  const [minConsensusCount, setMinConsensusCount] = useState<number>(1);
  const [inspectingSignal, setInspectingSignal] = useState<ConsensusSignal | null>(null);

  // Compute tier counts
  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: signals.length, Unanimous: 0, Strong: 0, Moderate: 0, Weak: 0, Isolated: 0 };
    signals.forEach((s) => {
      const tier = s.agreementTier || 'Weak';
      counts[tier] = (counts[tier] || 0) + 1;
    });
    return counts;
  }, [signals]);

  const discordanceCount = useMemo(() => {
    return signals.filter((s) => s.signalCount >= 1 && s.signalCount < s.totalMethods).length;
  }, [signals]);

  // Filter signals
  const filteredSignals = useMemo(() => {
    let result = signals;
    if (tierFilter !== 'ALL') {
      result = result.filter((s) => s.agreementTier === tierFilter);
    }
    if (isDiscordanceOnly) {
      result = result.filter((s) => s.signalCount >= 1 && s.signalCount < s.totalMethods);
    }
    if (minConsensusCount > 1) {
      result = result.filter((s) => s.signalCount >= minConsensusCount);
    }
    return result;
  }, [signals, tierFilter, isDiscordanceOnly, minConsensusCount]);

  const displaySignals = filteredSignals.slice(0, 30);

  // Compute pairwise Cohen's Kappa and Jaccard similarity across active methods
  const concordance = useMemo(() => {
    const jaccard: Record<string, Record<string, number>> = {};
    const kappa: Record<string, Record<string, number>> = {};
    const N = Math.max(1, signals.length);

    methods.forEach((m1) => {
      jaccard[m1] = {};
      kappa[m1] = {};

      methods.forEach((m2) => {
        if (m1 === m2) {
          jaccard[m1][m2] = 1.0;
          kappa[m1][m2] = 1.0;
          return;
        }

        let both = 0;
        let m1Only = 0;
        let m2Only = 0;
        let neither = 0;

        signals.forEach((s) => {
          const sig1 = s.methodResults[m1]?.isSignal ?? false;
          const sig2 = s.methodResults[m2]?.isSignal ?? false;

          if (sig1 && sig2) both++;
          else if (sig1 && !sig2) m1Only++;
          else if (!sig1 && sig2) m2Only++;
          else neither++;
        });

        const union = both + m1Only + m2Only;
        jaccard[m1][m2] = union > 0 ? Number((both / union).toFixed(3)) : 1.0;

        const po = (both + neither) / N;
        const pYes = ((both + m1Only) / N) * ((both + m2Only) / N);
        const pNo = ((m2Only + neither) / N) * ((m1Only + neither) / N);
        const pe = pYes + pNo;

        if (pe >= 1.0) {
          kappa[m1][m2] = 1.0;
        } else {
          const val = (po - pe) / (1.0 - pe);
          kappa[m1][m2] = Number(Math.max(-1.0, Math.min(1.0, val)).toFixed(3));
        }
      });
    });

    return { jaccard, kappa };
  }, [signals, methods]);

  const getTierBadge = (tier: AgreementTier) => {
    switch (tier) {
      case 'Unanimous':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            Unanimous
          </span>
        );
      case 'Strong':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse"></span>
            Strong
          </span>
        );
      case 'Moderate':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            Moderate
          </span>
        );
      case 'Weak':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/10 text-sky-300 border border-sky-500/30">
            Weak
          </span>
        );
      case 'Isolated':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Isolated
          </span>
        );
    }
  };

  if (signals.length === 0) {
    return (
      <div className="w-full rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center text-xs text-slate-500 font-mono">
        No disproportionality consensus signals available. Ingest or upload records to evaluate multi-method agreement.
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur shadow-xl space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-400 shadow-sm shadow-violet-400/50"></span>
            vigipy 3.4 Consensus Engine & Agreement Triangulation
          </h3>
          <p className="text-xs text-slate-400">
            Cross-method arbitration across frequentist (PRR, ROR, RFET), Bayesian (GPS, BCPNN), multivariable (Relaxed LASSO), and syndromic (SCORE-DA) models.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConcordance(!showConcordance)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              showConcordance
                ? 'bg-violet-600/30 text-violet-200 border-violet-500/40 shadow-sm shadow-violet-500/20'
                : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <span className="font-mono">κ</span>
            {showConcordance ? 'Hide Concordance Analytics' : 'View Concordance (Kappa & Jaccard)'}
          </button>
        </div>
      </div>

      {/* Agreement Tier Filter Tabs & Discordance Triage Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium mr-1">Tiers:</span>
          {(['ALL', 'Unanimous', 'Strong', 'Moderate', 'Weak', 'Isolated'] as const).map((tier) => {
            const count = tierCounts[tier] || 0;
            const isActive = tierFilter === tier && !isDiscordanceOnly;
            return (
              <button
                key={tier}
                onClick={() => {
                  setTierFilter(tier);
                  setIsDiscordanceOnly(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span>{tier === 'ALL' ? 'All Signals' : tier}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isActive ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-800 text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}

          {/* 1-Click High Discordance Triage Filter */}
          <button
            type="button"
            onClick={() => setIsDiscordanceOnly(!isDiscordanceOnly)}
            className={`ml-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
              isDiscordanceOnly
                ? 'bg-amber-500 text-slate-950 border-amber-400 ring-2 ring-amber-400/40 font-bold'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
            }`}
            title="Filter to cases where algorithms disagree (e.g. flagged by PRR but cleared by GPS/LASSO/SCORE)"
          >
            <span>⚡ High Discordance Pairs</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isDiscordanceOnly ? 'bg-slate-950 text-amber-300' : 'bg-amber-500/20 text-amber-200'}`}>
              {discordanceCount}
            </span>
          </button>
        </div>

        {/* Dynamic Consensus Threshold Slider */}
        <div className="flex items-center gap-2.5 text-xs text-slate-300 border-l border-slate-800/80 pl-3">
          <label className="text-slate-400 text-[11px] whitespace-nowrap">
            Min Consensus: <strong className="text-violet-300 font-mono">≥ {minConsensusCount}</strong> of {methods.length} methods
          </label>
          <input
            type="range"
            min={1}
            max={methods.length}
            step={1}
            value={minConsensusCount}
            onChange={(e) => setMinConsensusCount(parseInt(e.target.value, 10))}
            className="w-24 accent-violet-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>
      </div>

      {/* Concordance Analytics Matrices (Cohen's Kappa & Jaccard) */}
      {showConcordance && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-4 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-violet-500/20 pb-2">
            <div>
              <h4 className="text-sm font-semibold text-violet-200 flex items-center gap-2">
                <span>Inter-Method Concordance Analytics</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  vigipy.consensus_analysis
                </span>
              </h4>
              <p className="text-xs text-violet-300/80">
                Pairwise Cohen's Kappa (<span className="font-mono">κ</span>) concordance and Jaccard similarity (<span className="font-mono">J</span>) across evaluated drug-event pairs.
              </p>
            </div>
            <span className="text-xs text-violet-400 font-mono">
              Evaluated Pairs: {signals.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cohen's Kappa Matrix */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="text-xs font-semibold text-slate-200 mb-2 flex items-center justify-between">
                <span>Cohen's Kappa Concordance Matrix (κ)</span>
                <span className="text-[10px] text-slate-400 font-normal">κ &gt; 0.6: Substantial Agreement</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-center text-[11px] font-mono border-collapse">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800">
                      <th className="p-1 text-left font-sans text-[10px]">Method</th>
                      {methods.map((m) => (
                        <th key={m} className="p-1">{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {methods.map((m1) => (
                      <tr key={m1} className="border-b border-slate-900/60 hover:bg-slate-900/40">
                        <td className="p-1 text-left font-sans font-medium text-slate-300">{m1}</td>
                        {methods.map((m2) => {
                          const k = concordance.kappa[m1]?.[m2] ?? 0;
                          const color =
                            m1 === m2
                              ? 'text-slate-500'
                              : k >= 0.7
                              ? 'text-emerald-400 font-bold bg-emerald-500/10'
                              : k >= 0.4
                              ? 'text-amber-300 font-medium bg-amber-500/10'
                              : k >= 0
                              ? 'text-sky-300'
                              : 'text-rose-400 bg-rose-500/10';
                          return (
                            <td key={m2} className={`p-1 ${color}`}>
                              {m1 === m2 ? '1.00' : k.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Jaccard Similarity Matrix */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="text-xs font-semibold text-slate-200 mb-2 flex items-center justify-between">
                <span>Jaccard Similarity Matrix (|A ∩ B| / |A ∪ B|)</span>
                <span className="text-[10px] text-slate-400 font-normal">Range: 0.0 to 1.0</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-center text-[11px] font-mono border-collapse">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800">
                      <th className="p-1 text-left font-sans text-[10px]">Method</th>
                      {methods.map((m) => (
                        <th key={m} className="p-1">{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {methods.map((m1) => (
                      <tr key={m1} className="border-b border-slate-900/60 hover:bg-slate-900/40">
                        <td className="p-1 text-left font-sans font-medium text-slate-300">{m1}</td>
                        {methods.map((m2) => {
                          const j = concordance.jaccard[m1]?.[m2] ?? 0;
                          const color =
                            m1 === m2
                              ? 'text-slate-500'
                              : j >= 0.6
                              ? 'text-emerald-400 font-bold bg-emerald-500/10'
                              : j >= 0.3
                              ? 'text-amber-300 font-medium bg-amber-500/10'
                              : 'text-slate-400';
                          return (
                            <td key={m2} className={`p-1 ${color}`}>
                              {m1 === m2 ? '1.00' : j.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Consensus Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
              <th className="py-2.5 px-3">Product / Device Candidate</th>
              <th className="py-2.5 px-3">Event / Outcome / Malfunction</th>
              <th className="py-2.5 px-2 text-center">N₁₁</th>
              {methods.map((m) => (
                <th key={m} className="py-2.5 px-2 text-center font-mono">
                  {m}
                </th>
              ))}
              <th className="py-2.5 px-3 text-center">Agreement Tier</th>
              <th className="py-2.5 px-3 text-center">Votes</th>
              <th className="py-2.5 px-2 text-center">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {displaySignals.map((cs) => {
              const isSelected = selectedSignal?.id === cs.id;
              const agreementPercent = Math.round(cs.consensusScore * 100);

              return (
                <tr
                  key={cs.id}
                  onClick={() => onSelectSignal(cs)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-950/40 ring-1 ring-inset ring-indigo-500/40' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <td className="py-2.5 px-3 font-semibold text-rose-300 whitespace-nowrap">
                    {cs.drug}
                  </td>
                  <td className="py-2.5 px-3 text-slate-200 font-medium whitespace-nowrap">
                    {cs.event}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-slate-400">
                    {cs.contingency.n11}
                  </td>

                  {methods.map((m) => {
                    const res = cs.methodResults[m];
                    const isSig = res?.isSignal;
                    return (
                      <td key={m} className="py-2 px-1 text-center">
                        <div
                          className={`inline-flex items-center justify-center min-w-[54px] px-1.5 py-0.5 rounded text-[11px] font-mono transition-all ${
                            isSig
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                              : 'bg-slate-800/40 text-slate-500 border border-transparent'
                          }`}
                          title={`${m}: ${res?.formattedScore || '—'}`}
                        >
                          {res ? res.formattedScore : '—'}
                        </div>
                      </td>
                    );
                  })}

                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    {getTierBadge(cs.agreementTier)}
                  </td>

                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            agreementPercent >= 80
                              ? 'bg-rose-500'
                              : agreementPercent >= 50
                              ? 'bg-amber-400'
                              : 'bg-slate-600'
                          }`}
                          style={{ width: `${agreementPercent}%` }}
                        ></div>
                      </div>
                      <span className="font-mono text-[11px] text-slate-300 font-semibold">
                        {cs.signalCount}/{cs.totalMethods}
                      </span>
                    </div>
                  </td>

                  <td className="py-2.5 px-2 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectingSignal(cs);
                      }}
                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 hover:bg-violet-600 hover:text-white border border-slate-700 transition-colors"
                      title="Inspect signal drill-down across all methods"
                    >
                      Drill-down
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* inspect_signal Side-by-Side Modal */}
      {inspectingSignal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    consensus.inspect_signal()
                  </span>
                  {getTierBadge(inspectingSignal.agreementTier)}
                </div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span className="text-rose-400">{inspectingSignal.drug}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-cyan-300">{inspectingSignal.event}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Contingency: N₁₁={inspectingSignal.contingency.n11} | Expected={inspectingSignal.contingency.expected.toFixed(2)} | χ²={inspectingSignal.contingency.chiSquare.toFixed(2)} | Consensus: {inspectingSignal.votingRatio} methods flagged
                </p>
              </div>

              <button
                onClick={() => setInspectingSignal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {/* Methods Breakdown Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60">
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3 text-center">Alert Status</th>
                    <th className="py-2.5 px-3 text-right">Point Score</th>
                    <th className="py-2.5 px-3 text-center">Interval / Credibility</th>
                    <th className="py-2.5 px-3 text-right">p-value / FDR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {methods.map((m) => {
                    const res = inspectingSignal.methodResults[m];
                    const isSig = res?.isSignal;
                    return (
                      <tr key={m} className={`hover:bg-slate-900/40 ${isSig ? 'bg-rose-950/10' : ''}`}>
                        <td className="py-2.5 px-3 font-semibold text-slate-200 flex items-center gap-2">
                          <span className="font-mono">{m}</span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            ({res?.metricLabel || 'Disproportionality'})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isSig ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              SIGNAL
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                              Pass
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-200 font-semibold">
                          {res ? res.score.toFixed(3) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                          {res ? res.formattedInterval : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                          {res?.qValue !== undefined
                            ? `q=${res.qValue.toFixed(4)}`
                            : res?.pValue !== undefined
                            ? `p=${res.pValue.toFixed(4)}`
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-500 font-mono">
                Geometric fold-excess: {inspectingSignal.normalizedGeometricExcess.toFixed(2)}x
              </div>
              <button
                onClick={() => setInspectingSignal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
