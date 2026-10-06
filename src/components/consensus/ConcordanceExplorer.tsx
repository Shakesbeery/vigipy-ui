import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Download,
  HelpCircle,
  Info,
  Layers,
  Percent,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { ConcordanceResponse, Contingency2x2Response } from "../../types";
import { fetchConcordance, fetchContingencyTable } from "../../services/api";

export type ConcordanceMode = "jaccard" | "cohens_kappa" | "spearman_correlation" | "alert_overlap";

interface ConcordanceExplorerProps {
  /** Optional initial selected method pair */
  initialPair?: [string, string];
  /** Callback when pair selection changes */
  onSelectPair?: (methodA: string, methodB: string) => void;
  /** Optional external concordance data override */
  concordanceData?: ConcordanceResponse | null;
}

const METHODS_LIST = ["PRR", "ROR", "RFET", "BCPNN", "GPS", "LASSO", "SCORE"];

const METHOD_LABELS: Record<string, { name: string; full: string; type: string }> = {
  PRR: { name: "PRR", full: "Proportional Reporting Ratio", type: "Frequentist Rate Ratio" },
  ROR: { name: "ROR", full: "Reporting Odds Ratio", type: "Frequentist Odds Ratio" },
  RFET: { name: "RFET", full: "Reporting Fisher's Exact Test", type: "Exact Hypergeometric" },
  BCPNN: { name: "BCPNN", full: "Bayesian Confidence Propagation Neural Network", type: "Empirical Bayes (IC)" },
  GPS: { name: "GPS", full: "Gamma Poisson Shrinker", type: "Empirical Bayes (EBGM)" },
  LASSO: { name: "LASSO", full: "L1-Penalized Multi-Variable Regression", type: "High-Dimensional GLM" },
  SCORE: { name: "SCORE", full: "Syndromic Confounding & Overdispersion Removal", type: "Low-Rank Regularized Deconvolution" },
  SCORE_DA: { name: "SCORE_DA", full: "Syndromic Confounding & Overdispersion Removal", type: "Low-Rank Regularized Deconvolution" },
};

export const ConcordanceExplorer: React.FC<ConcordanceExplorerProps> = ({
  initialPair,
  onSelectPair,
  concordanceData: propData,
}) => {
  const [mode, setMode] = useState<ConcordanceMode>("jaccard");
  const [data, setData] = useState<ConcordanceResponse | null>(propData || null);
  const [loading, setLoading] = useState<boolean>(!propData);
  const [selectedPair, setSelectedPair] = useState<[string, string] | null>(
    initialPair || ["PRR", "BCPNN"]
  );
  const [contingency, setContingency] = useState<Contingency2x2Response | null>(null);
  const [loadingContingency, setLoadingContingency] = useState<boolean>(false);
  const [hoveredCell, setHoveredCell] = useState<{ a: string; b: string; val: number } | null>(null);

  // Fetch concordance matrix on mount if not provided via props
  useEffect(() => {
    if (propData) {
      setData(propData);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    fetchConcordance()
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load concordance data:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [propData]);

  // Load contingency table whenever selectedPair changes
  useEffect(() => {
    if (!selectedPair) {
      setContingency(null);
      return;
    }

    const [mA, mB] = selectedPair;
    let isMounted = true;
    setLoadingContingency(true);

    fetchContingencyTable(mA, mB)
      .then((res) => {
        if (isMounted) {
          setContingency(res);
          setLoadingContingency(false);
          if (onSelectPair) onSelectPair(mA, mB);
        }
      })
      .catch((err) => {
        console.error("Failed to load contingency table:", err);
        if (isMounted) setLoadingContingency(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPair, onSelectPair]);

  const methods = data?.methods || METHODS_LIST;

  // Active matrix based on mode
  const currentMatrix = useMemo(() => {
    if (!data) return {};
    switch (mode) {
      case "jaccard":
        return data.jaccard || {};
      case "cohens_kappa":
        return data.cohens_kappa || {};
      case "spearman_correlation":
        return data.spearman_correlation || {};
      case "alert_overlap":
        return data.alert_overlap || {};
      default:
        return data.jaccard || {};
    }
  }, [data, mode]);

  // Cell color interpolation based on mode and value
  const getCellShade = (val: number, isDiag: boolean) => {
    if (val === undefined || isNaN(val)) {
      return { bg: "bg-slate-900", text: "text-slate-500", border: "border-slate-800" };
    }

    if (isDiag) {
      return {
        bg: "bg-slate-800/80",
        text: "text-slate-300 font-semibold",
        border: "border-slate-700/80",
      };
    }

    if (mode === "alert_overlap") {
      // Numerical overlap count
      if (val >= 140) return { bg: "bg-emerald-600/80 hover:bg-emerald-600", text: "text-white font-bold", border: "border-emerald-500/50" };
      if (val >= 125) return { bg: "bg-teal-600/70 hover:bg-teal-600", text: "text-teal-50 font-semibold", border: "border-teal-500/40" };
      if (val >= 110) return { bg: "bg-sky-700/60 hover:bg-sky-700", text: "text-sky-100 font-medium", border: "border-sky-600/30" };
      if (val >= 90) return { bg: "bg-indigo-900/50 hover:bg-indigo-900/80", text: "text-indigo-200", border: "border-indigo-800/40" };
      return { bg: "bg-slate-800/60 hover:bg-slate-800", text: "text-slate-300", border: "border-slate-700/30" };
    }

    // Similarity / Correlation / Kappa [0.0 - 1.0]
    if (val >= 0.85) return { bg: "bg-emerald-500/85 hover:bg-emerald-500 text-slate-950 font-bold", text: "text-slate-950 font-bold", border: "border-emerald-400" };
    if (val >= 0.75) return { bg: "bg-teal-600/80 hover:bg-teal-600", text: "text-white font-semibold", border: "border-teal-500/50" };
    if (val >= 0.65) return { bg: "bg-cyan-700/70 hover:bg-cyan-700", text: "text-cyan-50 font-medium", border: "border-cyan-600/40" };
    if (val >= 0.50) return { bg: "bg-blue-800/60 hover:bg-blue-800/90", text: "text-blue-100", border: "border-blue-700/40" };
    if (val >= 0.35) return { bg: "bg-indigo-900/50 hover:bg-indigo-900/80", text: "text-indigo-200", border: "border-indigo-800/30" };
    return { bg: "bg-slate-800/60 hover:bg-slate-800", text: "text-slate-400", border: "border-slate-700/30" };
  };

  // Helper to format matrix cell text
  const formatCellValue = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return "—";
    if (mode === "alert_overlap") return Math.round(val).toLocaleString();
    return val.toFixed(3);
  };

  // Extract clean 2x2 contingency values
  const contingencyStats = useMemo(() => {
    if (!contingency?.table) return null;
    const tbl = contingency.table;

    // Extract counts safely matching boolean keys 'True'/'False' or 'Alert'/'No Alert'
    const getVal = (rKey: string, cKey: string) => {
      const row = tbl[rKey] || tbl[rKey.toLowerCase()] || tbl[rKey === "True" ? "Alert" : "No Alert"];
      if (!row) return 0;
      return row[cKey] ?? row[cKey.toLowerCase()] ?? row[cKey === "True" ? "Alert" : "No Alert"] ?? 0;
    };

    const n11 = getVal("True", "True"); // Alert both
    const n10 = getVal("True", "False"); // Alert A only
    const n01 = getVal("False", "True"); // Alert B only
    const n00 = getVal("False", "False"); // Neither

    const totalRowA = n11 + n10;
    const totalRowNoA = n01 + n00;
    const totalColB = n11 + n01;
    const totalColNoB = n10 + n00;
    const totalN = totalRowA + totalRowNoA;

    const observedAgreement = totalN > 0 ? (n11 + n00) / totalN : 0;
    const chanceExpected =
      totalN > 0
        ? ((totalRowA * totalColB) + (totalRowNoA * totalColNoB)) / (totalN * totalN)
        : 0;
    const kappa =
      1 - chanceExpected !== 0 ? (observedAgreement - chanceExpected) / (1 - chanceExpected) : 1;
    const jaccard =
      n11 + n10 + n01 > 0 ? n11 / (n11 + n10 + n01) : 1;
    const discordanceRate = totalN > 0 ? (n10 + n01) / totalN : 0;

    return {
      n11,
      n10,
      n01,
      n00,
      totalRowA,
      totalRowNoA,
      totalColB,
      totalColNoB,
      totalN,
      observedAgreement,
      kappa,
      jaccard,
      discordanceRate,
    };
  }, [contingency]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Cross-Method Concordance Explorer
              </h2>
              <p className="text-xs text-slate-400">
                Pairwise agreement metrics and 2×2 contingency matrix analysis across disproportionality algorithms.
              </p>
            </div>
          </div>
        </div>

        {/* Mode Switcher Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setMode("jaccard")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              mode === "jaccard"
                ? "bg-blue-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
            title="Jaccard Similarity Coefficient = Alert_Intersection / Alert_Union"
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Jaccard Similarity</span>
          </button>

          <button
            onClick={() => setMode("cohens_kappa")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              mode === "cohens_kappa"
                ? "bg-blue-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
            title="Cohen's Kappa Inter-Rater Concordance (Chance Adjusted)"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Cohen's Kappa</span>
          </button>

          <button
            onClick={() => setMode("spearman_correlation")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              mode === "spearman_correlation"
                ? "bg-blue-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
            title="Spearman Rank Correlation across continuous primary disproportionality scores"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Spearman Rank</span>
          </button>

          <button
            onClick={() => setMode("alert_overlap")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              mode === "alert_overlap"
                ? "bg-blue-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
            title="Total count of drug-event pairs concurrently flagged as alerts by both methods"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Alert Overlap Count</span>
          </button>
        </div>
      </div>

      {/* Main Layout: Heatmap on Left / Top, 2x2 Contingency on Right / Bottom */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Heatmap Section (7 cols on XL) */}
        <div className="xl:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Pairwise Concordance Matrix</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {mode === "jaccard"
                    ? "Jaccard Index [0.0 - 1.0]"
                    : mode === "cohens_kappa"
                    ? "Cohen's Kappa (κ)"
                    : mode === "spearman_correlation"
                    ? "Spearman Rho (ρ)"
                    : "Co-Alert Counts"}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Click any cell to inspect pairwise 2×2 contingency table and discordant signals.
              </p>
            </div>

            {/* Scale Bar Legend */}
            <div className="hidden sm:flex flex-col items-end gap-1 text-[10px] text-slate-400">
              <span className="font-mono">Agreement Scale</span>
              <div className="flex items-center gap-1">
                <span>Low</span>
                <div className="w-24 h-2.5 rounded bg-gradient-to-r from-slate-800 via-cyan-700 to-emerald-500 border border-slate-700" />
                <span>High</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
              <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Computing concordance matrices...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1.5 select-none">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Method
                    </th>
                    {methods.map((m) => (
                      <th
                        key={m}
                        className="p-2 text-center text-xs font-bold text-slate-300 uppercase tracking-wider min-w-[64px]"
                        title={METHOD_LABELS[m]?.full || m}
                      >
                        <div className="flex flex-col items-center">
                          <span>{m}</span>
                          <span className="text-[9px] text-slate-500 font-normal font-sans">
                            {METHOD_LABELS[m]?.name || ""}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {methods.map((rowMethod) => (
                    <tr key={rowMethod}>
                      {/* Row Header */}
                      <td className="p-2 text-xs font-bold text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor:
                                rowMethod === "PRR"
                                  ? "#3b82f6"
                                  : rowMethod === "ROR"
                                  ? "#6366f1"
                                  : rowMethod === "RFET"
                                  ? "#8b5cf6"
                                  : rowMethod === "BCPNN"
                                  ? "#10b981"
                                  : rowMethod === "GPS"
                                  ? "#06b6d4"
                                  : "#f59e0b",
                            }}
                          />
                          <span>{rowMethod}</span>
                        </div>
                      </td>

                      {/* Cells */}
                      {methods.map((colMethod) => {
                        const isDiag = rowMethod.toUpperCase() === colMethod.toUpperCase();
                        const rowObj =
                          currentMatrix[rowMethod] ||
                          currentMatrix[rowMethod.toUpperCase()] ||
                          currentMatrix[rowMethod.toLowerCase()] ||
                          {};
                        const val =
                          rowObj[colMethod] ??
                          rowObj[colMethod.toUpperCase()] ??
                          rowObj[colMethod.toLowerCase()];
                        const shade = getCellShade(val, isDiag);
                        const isSelected =
                          (selectedPair?.[0] === rowMethod && selectedPair?.[1] === colMethod) ||
                          (selectedPair?.[0] === colMethod && selectedPair?.[1] === rowMethod);

                        return (
                          <td key={colMethod} className="p-0">
                            <button
                              type="button"
                              onClick={() => setSelectedPair([rowMethod, colMethod])}
                              onMouseEnter={() =>
                                setHoveredCell({ a: rowMethod, b: colMethod, val })
                              }
                              onMouseLeave={() => setHoveredCell(null)}
                              className={`w-full h-12 rounded-xl flex flex-col items-center justify-center p-1 border transition-all duration-150 relative ${
                                shade.bg
                              } ${shade.border} ${
                                isSelected
                                  ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950 scale-[1.04] z-10 shadow-lg"
                                  : "hover:scale-[1.02]"
                              }`}
                              title={`${rowMethod} ↔ ${colMethod}: ${formatCellValue(val)} (Click to view 2×2 contingency table)`}
                            >
                              <span className={`text-xs font-mono tabular-nums ${shade.text}`}>
                                {formatCellValue(val)}
                              </span>
                              {isDiag && (
                                <span className="text-[9px] text-slate-400 font-sans leading-none">
                                  Identity
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Interactive Cell Info Footnote */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            {hoveredCell ? (
              <div className="flex items-center gap-2 text-slate-200">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  Pair: <strong className="text-white">{hoveredCell.a}</strong> ↔{" "}
                  <strong className="text-white">{hoveredCell.b}</strong> |{" "}
                  {mode.replace("_", " ")}:{" "}
                  <strong className="text-emerald-400 font-mono">
                    {formatCellValue(hoveredCell.val)}
                  </strong>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                <span>Select any cell to inspect alert overlap and discordance details.</span>
              </div>
            )}

            <div className="text-[11px] text-slate-500 font-mono">
              N = {methods.length} Disproportionality Methods
            </div>
          </div>
        </div>

        {/* 2x2 Contingency Matrix Viewer Section (5 cols on XL) */}
        <div className="xl:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  2×2 Contingency Matrix Viewer
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedPair
                    ? `${selectedPair[0]} vs. ${selectedPair[1]} Alert Agreement`
                    : "Select a cell to view matrix"}
                </p>
              </div>
            </div>

            {selectedPair && (
              <div className="flex items-center gap-1 text-xs font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-blue-400">
                <span>{selectedPair[0]}</span>
                <span className="text-slate-600">vs</span>
                <span>{selectedPair[1]}</span>
              </div>
            )}
          </div>

          {loadingContingency ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <span className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Loading contingency matrix...</span>
            </div>
          ) : !contingencyStats || !selectedPair ? (
            <div className="py-20 text-center text-slate-500 text-xs">
              Click any pair in the heatmap matrix above to view its 2×2 contingency table.
            </div>
          ) : (
            <div className="space-y-4">
              {/* 2x2 Table with Marginals */}
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <table className="w-full text-xs border-collapse text-center">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-slate-500 font-semibold uppercase text-[10px]">
                        {selectedPair[0]} \ {selectedPair[1]}
                      </th>
                      <th className="p-2 text-emerald-400 font-bold border-b border-slate-800">
                        {selectedPair[1]} Alert (Yes)
                      </th>
                      <th className="p-2 text-slate-400 font-medium border-b border-slate-800">
                        {selectedPair[1]} No Alert
                      </th>
                      <th className="p-2 text-slate-300 font-bold border-b border-slate-800 bg-slate-900/60">
                        Total {selectedPair[0]}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1: Method A Alert = True */}
                    <tr>
                      <td className="p-2.5 text-left font-bold text-emerald-400 border-r border-slate-800">
                        {selectedPair[0]} Alert (Yes)
                      </td>
                      {/* Cell (Yes, Yes) - Alert Both */}
                      <td className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono font-bold text-sm">
                        <div className="text-white text-base">
                          {contingencyStats.n11.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-emerald-400 font-sans uppercase font-medium">
                          Alert Both (n₁₁)
                        </div>
                      </td>
                      {/* Cell (Yes, No) - Alert A Only */}
                      <td className="p-2.5 bg-amber-500/5 border border-amber-500/20 text-amber-300 font-mono">
                        <div className="text-white text-base">
                          {contingencyStats.n10.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-amber-400 font-sans uppercase font-medium">
                          {selectedPair[0]} Only (n₁₀)
                        </div>
                      </td>
                      {/* Marginal Row Total 1 */}
                      <td className="p-2.5 bg-slate-900/80 font-mono font-bold text-slate-200 border-l border-slate-800">
                        {contingencyStats.totalRowA.toLocaleString()}
                      </td>
                    </tr>

                    {/* Row 2: Method A Alert = False */}
                    <tr>
                      <td className="p-2.5 text-left font-medium text-slate-400 border-r border-slate-800">
                        {selectedPair[0]} No Alert
                      </td>
                      {/* Cell (No, Yes) - Alert B Only */}
                      <td className="p-2.5 bg-amber-500/5 border border-amber-500/20 text-amber-300 font-mono">
                        <div className="text-white text-base">
                          {contingencyStats.n01.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-amber-400 font-sans uppercase font-medium">
                          {selectedPair[1]} Only (n₀₁)
                        </div>
                      </td>
                      {/* Cell (No, No) - Neither */}
                      <td className="p-2.5 bg-slate-900/60 border border-slate-800 text-slate-300 font-mono">
                        <div className="text-slate-300 text-base">
                          {contingencyStats.n00.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans uppercase font-medium">
                          Neither (n₀₀)
                        </div>
                      </td>
                      {/* Marginal Row Total 2 */}
                      <td className="p-2.5 bg-slate-900/80 font-mono text-slate-300 border-l border-slate-800">
                        {contingencyStats.totalRowNoA.toLocaleString()}
                      </td>
                    </tr>

                    {/* Column Marginals (Total) */}
                    <tr className="border-t-2 border-slate-700 bg-slate-900/80 font-bold">
                      <td className="p-2.5 text-left text-slate-300 font-bold border-r border-slate-800">
                        Total {selectedPair[1]}
                      </td>
                      <td className="p-2.5 font-mono text-slate-200">
                        {contingencyStats.totalColB.toLocaleString()}
                      </td>
                      <td className="p-2.5 font-mono text-slate-300">
                        {contingencyStats.totalColNoB.toLocaleString()}
                      </td>
                      <td className="p-2.5 font-mono text-blue-400 bg-slate-900 border-l border-slate-800 text-sm">
                        {contingencyStats.totalN.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Statistical Summary Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Observed Concordance</span>
                  <span className="text-sm font-bold font-mono text-white">
                    {(contingencyStats.observedAgreement * 100).toFixed(1)}%
                  </span>
                  <span className="text-[9px] text-slate-500 block mt-0.5">(n₁₁ + n₀₀) / N</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Cohen's Kappa (κ)</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {contingencyStats.kappa.toFixed(3)}
                  </span>
                  <span className="text-[9px] text-slate-500 block mt-0.5">Chance-corrected</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Jaccard (Alerts)</span>
                  <span className="text-sm font-bold font-mono text-cyan-400">
                    {contingencyStats.jaccard.toFixed(3)}
                  </span>
                  <span className="text-[9px] text-slate-500 block mt-0.5">n₁₁ / (n₁₁+n₁₀+n₀₁)</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Discordance Rate</span>
                  <span className="text-sm font-bold font-mono text-amber-400">
                    {(contingencyStats.discordanceRate * 100).toFixed(1)}%
                  </span>
                  <span className="text-[9px] text-slate-500 block mt-0.5">
                    {(contingencyStats.n10 + contingencyStats.n01).toLocaleString()} pairs
                  </span>
                </div>
              </div>

              {/* Clinical / Epidemiological Interpretation */}
              <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-900/40 text-xs text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-blue-300">
                  <Info className="w-3.5 h-3.5" />
                  <span>Clinical Method Guidance</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {contingencyStats.n10 > 0 || contingencyStats.n01 > 0 ? (
                    <>
                      <strong>{contingencyStats.n10}</strong> signals flagged only by{" "}
                      <span className="text-white">{selectedPair[0]}</span> and{" "}
                      <strong>{contingencyStats.n01}</strong> flagged only by{" "}
                      <span className="text-white">{selectedPair[1]}</span>. Discordance is common
                      between frequentist ratios and Bayesian shrinkage methods when spontaneous case
                      counts are small (&lt; 5).
                    </>
                  ) : (
                    <>Both methods exhibit perfect alert agreement across all evaluated pairs.</>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConcordanceExplorer;
