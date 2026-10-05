import React, { useEffect, useState } from "react";
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  ExternalLink,
  Copy,
  Check,
  BarChart2,
  Layers,
  ArrowRight,
  TrendingUp,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { AgreementTier, InspectSignalResponse, MethodSignalInspection, SignalRow } from "../../types";
import { inspectSignal } from "../../services/api";
import { ForestPlot } from "./ForestPlot";

interface SignalDrawerProps {
  /** The signal to inspect (can be a basic row from the grid, or a full inspection response) */
  selectedSignal: SignalRow | InspectSignalResponse | null;
  /** Callback when closing the inspector drawer */
  onClose: () => void;
  /** Presentation mode: slide-over drawer (fixed overlay) or split-pane view */
  mode?: "slide-over" | "split-pane";
  /** Optional callback to navigate to longitudinal trend view for this pair */
  onOpenLongitudinal?: (product: string, adverseEvent: string) => void;
}

export const getTierBadgeClass = (tier: string) => {
  switch (tier?.toLowerCase()) {
    case "unanimous":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    case "strong":
      return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    case "moderate":
      return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "weak":
      return "bg-orange-500/10 text-orange-400 border-orange-500/30";
    case "isolated":
    default:
      return "bg-slate-500/10 text-slate-400 border-slate-500/30";
  }
};

const METHOD_DESCRIPTIONS: Record<string, string> = {
  PRR: "Proportional Reporting Ratio (Evans et al., 2001) - Frequency-based disproportionate reporting metric with chi-square or normal CI.",
  ROR: "Reporting Odds Ratio (van Puijenbroek et al., 2002) - Standard epidemiological odds ratio with log-transformed CI.",
  RFET: "Reporting Fisher's Exact Test - Exact hypergeometric test with mid-p value adjustment for small sample protection.",
  BCPNN: "Bayesian Confidence Propagation Neural Network (Bate et al., 1998) - Information Component (IC) with Dirichlet/Beta prior.",
  GPS: "Gamma Poisson Shrinker (DuMouchel, 1999) - Empirical Bayes Geometric Mean (EBGM) and 5th percentile lower bound (EB05).",
  LASSO: "L1-Penalized Multi-Variable Regression - High-dimensional confounding and masking control via relaxed penalized GLM.",
};

export const SignalDrawer: React.FC<SignalDrawerProps> = ({
  selectedSignal,
  onClose,
  mode = "slide-over",
  onOpenLongitudinal,
}) => {
  const [inspection, setInspection] = useState<InspectSignalResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(false);

  // Fetch detailed inspection if needed
  useEffect(() => {
    if (!selectedSignal) {
      setInspection(null);
      return;
    }

    // Check if selectedSignal is already full inspection response
    if ("methods" in selectedSignal && Array.isArray((selectedSignal as any).methods)) {
      setInspection(selectedSignal as InspectSignalResponse);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const fallbackRow = "method_scores" in selectedSignal ? (selectedSignal as SignalRow) : null;

    inspectSignal(selectedSignal.product, selectedSignal.adverse_event, fallbackRow)
      .then((res) => {
        if (isMounted) {
          setInspection(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load signal inspection:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSignal]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!selectedSignal) return null;

  const currentProduct = inspection?.product || selectedSignal.product;
  const currentAE = inspection?.adverse_event || selectedSignal.adverse_event;
  const currentVotes = inspection?.votes ?? selectedSignal.votes ?? 0;
  const currentTotalMethods = inspection?.total_methods ?? selectedSignal.total_methods ?? 6;
  const currentScore = inspection?.consensus_score ?? selectedSignal.consensus_score ?? 0;
  const currentTier = inspection?.agreement_tier ?? selectedSignal.agreement_tier ?? "Isolated";
  const currentRank = inspection?.composite_rank ?? selectedSignal.composite_rank;
  const currentCount = inspection?.count ?? selectedSignal.count ?? 0;
  const currentExpected = inspection?.expected_count ?? selectedSignal.expected_count ?? null;

  const disproportionalityRatio =
    currentExpected && currentExpected > 0 ? (currentCount / currentExpected).toFixed(2) : null;

  const handleCopySummary = () => {
    const text = `vigipy Signal Inspection:
Product: ${currentProduct}
Adverse Event: ${currentAE}
Consensus Tier: ${currentTier}
Consensus Score: ${currentScore.toFixed(3)} (${currentVotes}/${currentTotalMethods} methods alerted)
Composite Rank: #${currentRank ?? "N/A"}
Observed Count: ${currentCount.toLocaleString()}
Expected Count: ${currentExpected ? currentExpected.toFixed(2) : "N/A"}
O/E Ratio: ${disproportionalityRatio ?? "N/A"}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const containerClasses =
    mode === "slide-over"
      ? `fixed inset-y-0 right-0 z-50 flex flex-col bg-slate-900 border-l border-slate-800 shadow-2xl transition-all duration-300 ease-in-out ${
          expanded ? "w-full max-w-5xl" : "w-full sm:w-[580px] lg:w-[680px]"
        }`
      : "flex flex-col bg-slate-900 border-l border-slate-800 h-full w-full overflow-hidden";

  return (
    <>
      {/* Backdrop for slide-over mode */}
      {mode === "slide-over" && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Main Drawer Panel */}
      <aside className={containerClasses} role="dialog" aria-modal="true" aria-label="Signal Inspector">
        {/* Top Header & Actions Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
              Signal Drill-Down Inspector
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenLongitudinal && (
              <button
                onClick={() => onOpenLongitudinal(currentProduct, currentAE)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white text-xs font-medium border border-indigo-500/30 transition shadow-sm"
                title="View Longitudinal Trend for this signal"
              >
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                <span>View Trend</span>
              </button>
            )}

            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition"
              title="Copy Signal Summary"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>

            {mode === "slide-over" && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition hidden sm:inline-flex"
                title={expanded ? "Restore Width" : "Expand Drawer"}
              >
                {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close Drawer (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Top Summary Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900 border border-slate-700/80 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-medium uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Product / Brand
                  </span>
                  {currentRank && (
                    <span className="text-[11px] font-mono text-slate-400">
                      Rank #{currentRank}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight break-words">
                  {currentProduct}
                </h3>
                <div className="pt-1 flex items-center gap-2 text-slate-300">
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-200 break-words">
                    {currentAE}
                  </span>
                </div>
              </div>

              {/* Consensus Tier Badge & Votes Pill */}
              <div className="flex flex-row sm:flex-col items-start sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                <div
                  className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide border uppercase flex items-center gap-1.5 ${getTierBadgeClass(
                    currentTier
                  )}`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{currentTier} Tier</span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-slate-400">Consensus Votes:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-950 text-white font-semibold border border-slate-800">
                    {currentVotes} / {currentTotalMethods}
                  </span>
                </div>
              </div>
            </div>

            {/* Score & Telemetry Mini Bar */}
            <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Consensus Score</span>
                <span className="text-base font-bold text-white font-mono">
                  {currentScore.toFixed(3)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Signal Strength</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-700/60 max-w-[80px]">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(5, currentScore * 100))}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-slate-300">
                    {(currentScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Agreement Level</span>
                <span className="font-semibold text-slate-200">
                  {currentVotes >= 5
                    ? "Full Consensus"
                    : currentVotes >= 3
                    ? "Substantial"
                    : "Discordant"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Overall Alert</span>
                <span
                  className={`font-semibold inline-flex items-center gap-1 ${
                    currentVotes >= 1 ? "text-rose-400" : "text-slate-400"
                  }`}
                >
                  {currentVotes >= 1 ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" /> Active Signal
                    </>
                  ) : (
                    "No Alert"
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Contingency Stats Card */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Contingency & Disproportionality Statistics
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Mantel-Haenszel / Marginal Model
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Observed Count */}
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <div className="text-[11px] text-slate-400 mb-0.5">Observed Count (a)</div>
                <div className="text-xl font-bold font-mono text-white">
                  {currentCount.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Total spontaneous safety reports
                </div>
              </div>

              {/* Expected Count */}
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <div className="text-[11px] text-slate-400 mb-0.5">Expected Count (E)</div>
                <div className="text-xl font-bold font-mono text-slate-200">
                  {currentExpected !== null && currentExpected !== undefined
                    ? currentExpected.toFixed(2)
                    : "—"}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Expected under independence null
                </div>
              </div>

              {/* Disproportionality Ratio */}
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <div className="text-[11px] text-slate-400 mb-0.5">Disproportionality (O / E)</div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`text-xl font-bold font-mono ${
                      disproportionalityRatio && +disproportionalityRatio > 2
                        ? "text-rose-400"
                        : disproportionalityRatio && +disproportionalityRatio > 1
                        ? "text-amber-400"
                        : "text-slate-300"
                    }`}
                  >
                    {disproportionalityRatio ? `${disproportionalityRatio}×` : "—"}
                  </span>
                  {disproportionalityRatio && +disproportionalityRatio > 1 && (
                    <TrendingUp className="w-3.5 h-3.5 text-rose-400 self-center" />
                  )}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {disproportionalityRatio && +disproportionalityRatio > 2
                    ? "Elevated disproportionality"
                    : "Near baseline expectations"}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive SVG Forest Plot */}
          {inspection && inspection.methods && inspection.methods.length > 0 && (
            <ForestPlot
              methods={inspection.methods}
              product={currentProduct}
              adverseEvent={currentAE}
            />
          )}

          {/* Method Breakdown Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-md">
            <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-950/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Disproportionality Method Breakdown
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">
                {inspection?.methods.length || 0} Algorithms Evaluated
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 tracking-wider uppercase select-none">
                    <th className="py-2.5 px-3.5">Method</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Primary Metric</th>
                    <th className="py-2.5 px-3">Decision Threshold</th>
                    <th className="py-2.5 px-3 text-right">Score</th>
                    <th className="py-2.5 px-3 text-center">95% CI / Credibility</th>
                    <th className="py-2.5 px-3 text-right">p-value</th>
                    <th className="py-2.5 px-3.5 text-right">FDR (q)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          <span>Calculating algorithm statistics...</span>
                        </div>
                      </td>
                    </tr>
                  ) : !inspection?.methods || inspection.methods.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No method details available.
                      </td>
                    </tr>
                  ) : (
                    inspection.methods.map((m) => {
                      const desc = METHOD_DESCRIPTIONS[m.method] || "";
                      return (
                        <tr
                          key={m.method}
                          className="hover:bg-slate-800/40 transition-colors group"
                        >
                          {/* Method name with tooltip */}
                          <td className="py-3 px-3.5 font-medium text-white">
                            <div className="flex items-center gap-1.5" title={desc}>
                              <span>{m.method}</span>
                              {desc && (
                                <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-help opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </div>
                          </td>

                          {/* Alert Status */}
                          <td className="py-3 px-3">
                            {m.alert ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                ALERT
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                No Signal
                              </span>
                            )}
                          </td>

                          {/* Primary Metric Name */}
                          <td className="py-3 px-3 text-slate-300 font-mono text-[11px]">
                            {m.metric}
                          </td>

                          {/* Method Decision Threshold */}
                          <td className="py-3 px-3">
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-950/80 text-[11px] font-mono text-slate-300 border border-slate-800 shadow-sm">
                              {m.threshold || "—"}
                            </span>
                          </td>

                          {/* Score */}
                          <td className="py-3 px-3 text-right font-mono font-medium text-white">

                            {m.score !== null && m.score !== undefined
                              ? m.score >= 100
                                ? m.score.toFixed(1)
                                : m.score >= 1
                                ? m.score.toFixed(2)
                                : m.score.toFixed(3)
                              : "—"}
                          </td>

                          {/* 95% CI Bounds */}
                          <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-300">
                            {m.ci_lower !== null &&
                            m.ci_lower !== undefined &&
                            m.ci_upper !== null &&
                            m.ci_upper !== undefined ? (
                              <span>
                                [{m.ci_lower.toFixed(2)}, {m.ci_upper.toFixed(2)}]
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          {/* p-value */}
                          <td className="py-3 px-3 text-right font-mono text-[11px] text-slate-300">
                            {m.p_value !== null && m.p_value !== undefined ? (
                              m.p_value < 0.0001 ? (
                                <span title={m.p_value.toString()}>{m.p_value.toExponential(2)}</span>
                              ) : (
                                m.p_value.toFixed(4)
                              )
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          {/* FDR */}
                          <td className="py-3 px-3.5 text-right font-mono text-[11px] text-slate-300">
                            {m.fdr !== null && m.fdr !== undefined ? (
                              m.fdr < 0.0001 ? (
                                <span title={m.fdr.toString()}>{m.fdr.toExponential(2)}</span>
                              ) : (
                                m.fdr.toFixed(4)
                              )
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
