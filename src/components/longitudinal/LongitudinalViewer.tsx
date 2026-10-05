import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  Filter,
  Layers,
  LineChart,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  JobStatusResponse,
  LongitudinalRunRequest,
  LongitudinalSignalItem,
  LongitudinalTrajectoryResponse,
  SignalRow,
  TrajectoryPoint,
} from "../../types";
import {
  fetchLongitudinalSignals,
  fetchLongitudinalTrajectory,
  pollAnalysisStatus,
  runLongitudinalAnalysis,
} from "../../services/api";
import { getTierBadgeClass } from "../inspector/SignalDrawer";
import { MultiAELongitudinalChart } from "./MultiAELongitudinalChart";

export type LongitudinalMethod = "bcpnn" | "gps" | "prr" | "ror" | "lasso" | "all";
export type LongitudinalCadence = "YE" | "QE" | "ME";
export type LongitudinalCadenceLabel = "Yearly" | "Quarterly" | "Monthly";
export type LongitudinalMode = "cumulative" | "disjoint";

interface LongitudinalViewerProps {
  /** Optional initial selected signal to view */
  initialSignal?: SignalRow | { product: string; adverse_event: string } | null;
  /** Callback to notify parent of active signal change */
  onSignalChange?: (product: string, adverseEvent: string) => void;
}

const CADENCE_MAP: Record<LongitudinalCadenceLabel, LongitudinalCadence> = {
  Yearly: "YE",
  Quarterly: "QE",
  Monthly: "ME",
};

interface MethodMeta {
  name: string;
  color: string;
  threshold: number;
  thresholdLabel: string;
  metricLabel: string;
  normalize: (score: number | null | undefined) => number | null;
}

const METHOD_CONFIGS: Record<string, MethodMeta> = {
  PRR: {
    name: "PRR",
    color: "#10b981", // Emerald
    threshold: 2.0,
    thresholdLabel: "PRR ≥ 2.0",
    metricLabel: "Proportional Reporting Ratio",
    normalize: (score) => (score !== null && score !== undefined ? Math.max(0, score / 2.0) : null),
  },
  ROR: {
    name: "ROR",
    color: "#06b6d4", // Cyan
    threshold: 2.0,
    thresholdLabel: "ROR ≥ 2.0",
    metricLabel: "Reporting Odds Ratio",
    normalize: (score) => (score !== null && score !== undefined ? Math.max(0, score / 2.0) : null),
  },
  BCPNN: {
    name: "BCPNN",
    color: "#818cf8", // Indigo
    threshold: 0.0,
    thresholdLabel: "IC > 0.0",
    metricLabel: "Information Component (bits)",
    // 2^IC: when IC=0 -> 1.0 (Alert Threshold), IC=1 -> 2.0, IC=-1 -> 0.5
    normalize: (score) => (score !== null && score !== undefined ? Math.pow(2, score) : null),
  },
  GPS: {
    name: "GPS",
    color: "#f59e0b", // Amber
    threshold: 1.0,
    thresholdLabel: "EBGM ≥ 1.0",
    metricLabel: "Empirical Bayes GM (EBGM)",
    normalize: (score) => (score !== null && score !== undefined ? Math.max(0, score / 1.0) : null),
  },
  RFET: {
    name: "RFET",
    color: "#ec4899", // Pink
    threshold: 0.05,
    thresholdLabel: "p < 0.05",
    metricLabel: "Fisher Exact p-value",
    normalize: (score) =>
      score !== null && score !== undefined
        ? Math.max(0, -Math.log10(Math.max(1e-12, score)) / -Math.log10(0.05))
        : null,
  },
  LASSO: {
    name: "LASSO",
    color: "#a855f7", // Purple
    threshold: 0.0,
    thresholdLabel: "Beta > 0.0",
    metricLabel: "Penalized Regression Beta",
    normalize: (score) => (score !== null && score !== undefined ? Math.max(0, score * 2.0) : null),
  },
};

function formatTimestampTick(ts: string): string {
  if (!ts) return "";
  const clean = ts.split(" ")[0];
  const m = clean.match(/^(\d{4})-(\d{2})/);
  if (m) {
    const year = m[1];
    const month = parseInt(m[2], 10);
    const quarter = Math.ceil(month / 3);
    return `${year}-Q${quarter}`;
  }
  return clean;
}

export const LongitudinalViewer: React.FC<LongitudinalViewerProps> = ({
  initialSignal,
  onSignalChange,
}) => {
  // Configuration State
  const [method, setMethod] = useState<LongitudinalMethod>("bcpnn");
  const [cadenceLabel, setCadenceLabel] = useState<LongitudinalCadenceLabel>("Quarterly");
  const [mode, setMode] = useState<LongitudinalMode>("cumulative");
  const [viewMode, setViewMode] = useState<"single" | "compare" | "multi_signals">("single");

  // Visible methods in multi-method comparative mode
  const [visibleMethods, setVisibleMethods] = useState<Record<string, boolean>>({
    PRR: true,
    ROR: true,
    BCPNN: true,
    GPS: true,
    LASSO: true,
  });

  // Dynamic Candidate Signals from Longitudinal Time Slices
  const [candidateSignals, setCandidateSignals] = useState<LongitudinalSignalItem[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(false);
  const [hasConsensus, setHasConsensus] = useState<boolean>(false);
  const [computedMethods, setComputedMethods] = useState<string[]>([]);
  const [sortCriteria, setSortCriteria] = useState<"peak_score" | "latest_score" | "count" | "onset" | "slices_alerted" | "consensus_score">("peak_score");
  const [tierFilter, setTierFilter] = useState<string>("All");

  // Drug-Event Pair Selection
  const [selectedProduct, setSelectedProduct] = useState<string>(
    initialSignal?.product || ""
  );
  const [selectedAE, setSelectedAE] = useState<string>(
    initialSignal?.adverse_event || ""
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showPairDropdown, setShowPairDropdown] = useState<boolean>(false);

  // Execution & Progress State
  const [running, setRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(1.0);
  const [statusMessage, setStatusMessage] = useState<string>("Ready");

  // Trajectory Data State
  const [trajectoryData, setTrajectoryData] = useState<LongitudinalTrajectoryResponse | null>(null);
  const [loadingTrajectory, setLoadingTrajectory] = useState<boolean>(false);
  const [trajectoryError, setTrajectoryError] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // SVG Chart reference
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pollIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Fetch collapsed candidate signals from longitudinal modeling
  const loadLongitudinalSignals = async (targetM: string) => {
    setLoadingCandidates(true);
    try {
      const res = await fetchLongitudinalSignals({
        method: targetM,
        sort_by: sortCriteria,
        sort_dir: "desc",
      });
      const sigs = res.signals || [];
      setCandidateSignals(sigs);
      setHasConsensus(Boolean(res.has_consensus));
      if (res.computed_methods) {
        setComputedMethods(res.computed_methods);
      }
      if (sigs.length > 0) {
        const found = sigs.some(
          (c) =>
            c.product.toLowerCase() === selectedProduct.toLowerCase() &&
            c.adverse_event.toLowerCase() === selectedAE.toLowerCase()
        );
        if (!found && !initialSignal) {
          setSelectedProduct(sigs[0].product);
          setSelectedAE(sigs[0].adverse_event);
        }
      }
    } catch (err: any) {
      console.warn("Could not load longitudinal candidates:", err);
      setCandidateSignals([]);
    } finally {
      setLoadingCandidates(false);
    }
  };

  // Load signals on mount and whenever method, viewMode, or sort changes
  useEffect(() => {
    const activeTarget = viewMode === "compare" ? "all" : method;
    loadLongitudinalSignals(activeTarget);
  }, [viewMode, method, sortCriteria]);

  // Update selected signal if initialSignal prop changes
  useEffect(() => {
    if (initialSignal) {
      setSelectedProduct(initialSignal.product);
      setSelectedAE(initialSignal.adverse_event);
    }
  }, [initialSignal]);

  // Current active candidate signal details
  const activeCandidate = useMemo(() => {
    return candidateSignals.find(
      (c) =>
        c.product.toLowerCase() === selectedProduct.toLowerCase() &&
        c.adverse_event.toLowerCase() === selectedAE.toLowerCase()
    );
  }, [candidateSignals, selectedProduct, selectedAE]);

  // Load trajectory whenever selected drug-event pair or method / cadence / mode changes
  const loadTrajectory = async (
    prod: string,
    ae: string,
    m: string
  ) => {
    if (!prod || !ae) return;
    setLoadingTrajectory(true);
    setTrajectoryError(null);
    try {
      const res = await fetchLongitudinalTrajectory(prod, ae, m);
      if (res.computed_methods) {
        setComputedMethods(res.computed_methods);
      }
      // If method is not computed or trajectory is empty, do not display stale data
      if (
        !res.trajectory ||
        res.trajectory.length === 0 ||
        (res.method && res.method.toLowerCase() !== m.toLowerCase() && m !== "all")
      ) {
        setTrajectoryData(null);
        setTrajectoryError(`${m.toUpperCase()} longitudinal model has not been computed yet.`);
      } else {
        setTrajectoryData(res);
      }
    } catch (err: any) {
      console.warn("Could not fetch trajectory from backend:", err);
      setTrajectoryError(err?.message || "Longitudinal model not computed yet.");
      setTrajectoryData(null);
    } finally {
      setLoadingTrajectory(false);
    }
  };

  useEffect(() => {
    if (selectedProduct && selectedAE) {
      const activeMethodToLoad = viewMode === "compare" ? "all" : method;
      loadTrajectory(selectedProduct, selectedAE, activeMethodToLoad);
      if (onSignalChange) onSignalChange(selectedProduct, selectedAE);
    }
  }, [selectedProduct, selectedAE, method, cadenceLabel, mode, viewMode]);


  // Handle Run Longitudinal Calculation
  const handleRunLongitudinal = async (runMethod?: LongitudinalMethod) => {
    const targetM = runMethod || method;
    setRunning(true);
    setProgress(0.05);
    setStatusMessage(
      `Initializing ${cadenceLabel} ${targetM === "all" ? "multi-method" : targetM.toUpperCase()} longitudinal model...`
    );

    const req: LongitudinalRunRequest = {
      method: targetM,
      time_unit: CADENCE_MAP[cadenceLabel],
      mode,
      include_gaps: false,
      min_events: 3,
    };

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    try {
      await runLongitudinalAnalysis(req);

      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await pollAnalysisStatus();
          setProgress(status.progress || 0.1);
          if (status.step) {
            setStatusMessage(status.step);
          }

          if (status.status === "completed") {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setProgress(1.0);
            setRunning(false);
            setStatusMessage("Longitudinal modeling completed.");
            const activeM = targetM === "all" ? "all" : targetM;
            loadLongitudinalSignals(activeM);
            loadTrajectory(selectedProduct, selectedAE, targetM === "all" ? method : targetM);
          } else if (status.status === "failed") {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setRunning(false);
            setStatusMessage(`Longitudinal modeling failed: ${status.error || "Unknown error"}`);
            setTrajectoryError(status.error || "Longitudinal computation failed.");
          }
        } catch (pollErr: any) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setRunning(false);
          setStatusMessage(`Status check failed: ${pollErr.message}`);
          setTrajectoryError(pollErr.message);
        }
      }, 800);
    } catch (err: any) {
      setRunning(false);
      setStatusMessage(`Longitudinal computation failed: ${err.message}`);
      setTrajectoryError(err.message);
    }
  };

  const trajectory = trajectoryData?.trajectory || [];

  // Multi-method trajectories available in memory
  const multiTrajectories = useMemo(() => {
    return trajectoryData?.multi_trajectories || {};
  }, [trajectoryData]);

  const availableMethods = useMemo(() => {
    const keys = Object.keys(multiTrajectories);
    if (keys.length > 0) return keys;
    return trajectoryData?.method ? [trajectoryData.method.toUpperCase()] : [];
  }, [multiTrajectories, trajectoryData]);

  // Accurate single-method alert onset point: relies directly on slice-level alert flag
  const onsetIndex = useMemo(() => {
    return trajectory.findIndex((pt) => Boolean(pt.alert));
  }, [trajectory]);

  const onsetPoint = onsetIndex >= 0 ? trajectory[onsetIndex] : null;

  // Multi-method alert notices: collect onset dates per method strictly from actual longitudinal run
  const { alertNotices, unalertedMethods } = useMemo(() => {
    const notices: { method: string; date: string }[] = [];
    const unalerted: string[] = [];

    // From backend onset_dates
    if (trajectoryData?.onset_dates) {
      for (const [mName, oDate] of Object.entries(trajectoryData.onset_dates)) {
        if (oDate) {
          notices.push({ method: mName.toUpperCase(), date: formatTimestampTick(oDate) });
        } else {
          unalerted.push(mName.toUpperCase());
        }
      }
    }

    return { alertNotices: notices, unalertedMethods: unalerted };
  }, [trajectoryData]);


  // Chart Dimensions
  const chartWidth = 900;
  const chartHeight = 400;
  const margin = { top: 40, right: 50, bottom: 50, left: 65 };
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  // Single-method Chart Coordinates Math
  const singleChartMath = useMemo(() => {
    if (trajectory.length === 0) {
      return {
        pointsWithCoords: [],
        thresholdY: 0,
        areaPath: "",
        linePath: "",
        yDomain: [0, 4],
      };
    }

    const mUp = method.toUpperCase();
    const meta = METHOD_CONFIGS[mUp] || METHOD_CONFIGS.PRR;
    const thresholdVal = meta.threshold;

    let minY = thresholdVal;
    let maxY = thresholdVal;

    trajectory.forEach((p) => {
      if (p.score !== null && p.score !== undefined) {
        if (p.score < minY) minY = p.score;
        if (p.score > maxY) maxY = p.score;
      }
      if (p.ci_lower !== null && p.ci_lower !== undefined) {
        if (p.ci_lower < minY) minY = p.ci_lower;
      }
      if (p.ci_upper !== null && p.ci_upper !== undefined) {
        if (p.ci_upper > maxY) maxY = p.ci_upper;
      }
    });

    minY = Math.min(minY, mUp === "BCPNN" || mUp === "LASSO" ? -1.0 : 0);
    maxY = Math.max(maxY + 0.6, thresholdVal + 1.2);


    const getX = (idx: number) => {
      if (trajectory.length <= 1) return margin.left + innerWidth / 2;
      return margin.left + (idx / (trajectory.length - 1)) * innerWidth;
    };

    const getY = (val: number | null | undefined) => {
      if (val === null || val === undefined) return margin.top + innerHeight;
      const clamped = Math.max(minY, Math.min(maxY, val));
      const pct = (clamped - minY) / (maxY - minY);
      return margin.top + (1 - pct) * innerHeight;
    };

    const thresholdYCoord = getY(thresholdVal);

    const mapped = trajectory.map((pt, idx) => ({
      ...pt,
      x: getX(idx),
      y: pt.score !== null && pt.score !== undefined ? getY(pt.score) : null,
      yLower: pt.ci_lower !== null && pt.ci_lower !== undefined ? getY(pt.ci_lower) : null,
      yUpper: pt.ci_upper !== null && pt.ci_upper !== undefined ? getY(pt.ci_upper) : null,
    }));

    const validPoints = mapped.filter((p) => p.yLower !== null && p.yUpper !== null);
    let area = "";
    if (validPoints.length > 0) {
      const upperSegments = validPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yUpper}`);
      const lowerSegments = [...validPoints].reverse().map((p) => `L ${p.x} ${p.yLower}`);
      area = `${upperSegments.join(" ")} ${lowerSegments.join(" ")} Z`;
    }

    const validScores = mapped.filter((p) => p.y !== null);
    let line = "";
    if (validScores.length > 0) {
      line = validScores.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    }

    return {
      pointsWithCoords: mapped,
      thresholdY: thresholdYCoord,
      areaPath: area,
      linePath: line,
      yDomain: [minY, maxY],
    };
  }, [trajectory, method, innerWidth, innerHeight]);

  // Multi-method Comparative Chart Coordinates Math (Normalized Threshold Scale)
  const compareChartMath = useMemo(() => {
    const methodsList = Object.keys(multiTrajectories).filter(
      (m) => visibleMethods[m] !== false && multiTrajectories[m]?.length > 0
    );

    if (methodsList.length === 0) {
      return {
        multiPoints: [],
        linesByMethod: {},
        thresholdY: 0,
        yDomain: [0, 3],
        xSlices: [],
      };
    }

    // Align on reference timestamps
    const refTrajectory = multiTrajectories[methodsList[0]] || [];
    const numSlices = refTrajectory.length;

    // Fold range: baseline threshold is 1.0x
    let minFold = 0.5;
    let maxFold = 2.0;

    methodsList.forEach((m) => {
      const meta = METHOD_CONFIGS[m] || METHOD_CONFIGS.PRR;
      const pts = multiTrajectories[m] || [];
      pts.forEach((p) => {
        const norm = meta.normalize(p.score);
        if (norm !== null) {
          if (norm < minFold) minFold = norm;
          if (norm > maxFold) maxFold = norm;
        }
      });
    });

    minFold = Math.max(0, Math.min(minFold, 0.4));
    maxFold = Math.max(maxFold + 0.5, 2.5);

    const getX = (idx: number) => {
      if (numSlices <= 1) return margin.left + innerWidth / 2;
      return margin.left + (idx / (numSlices - 1)) * innerWidth;
    };

    const getY = (foldVal: number | null | undefined) => {
      if (foldVal === null || foldVal === undefined) return margin.top + innerHeight;
      const clamped = Math.max(minFold, Math.min(maxFold, foldVal));
      const pct = (clamped - minFold) / (maxFold - minFold);
      return margin.top + (1 - pct) * innerHeight;
    };

    const thresholdYCoord = getY(1.0); // 1.0x Fold = Universal Threshold

    const linesByMethod: Record<string, string> = {};
    const multiPointsBySlice: {
      timestamp: string;
      x: number;
      scores: Record<string, number | null>;
      folds: Record<string, number | null>;
      alerts: Record<string, boolean>;
      count?: number | null;
    }[] = [];

    for (let idx = 0; idx < numSlices; idx++) {
      const ts = refTrajectory[idx]?.timestamp || "";
      const x = getX(idx);
      const scores: Record<string, number | null> = {};
      const folds: Record<string, number | null> = {};
      const alerts: Record<string, boolean> = {};
      let countVal: number | null = null;

      methodsList.forEach((m) => {
        const meta = METHOD_CONFIGS[m] || METHOD_CONFIGS.PRR;
        const pt = multiTrajectories[m]?.[idx];
        const sc = pt?.score ?? null;
        scores[m] = sc;
        folds[m] = meta.normalize(sc);
        alerts[m] = Boolean(pt?.alert);
        if (pt?.count !== undefined && pt.count !== null) {
          countVal = pt.count;
        }
      });

      multiPointsBySlice.push({
        timestamp: ts,
        x,
        scores,
        folds,
        alerts,
        count: countVal,
      });
    }

    methodsList.forEach((m) => {
      const meta = METHOD_CONFIGS[m] || METHOD_CONFIGS.PRR;
      const pts = multiTrajectories[m] || [];
      const segments: string[] = [];

      pts.forEach((p, idx) => {
        const norm = meta.normalize(p.score);
        if (norm !== null) {
          const x = getX(idx);
          const y = getY(norm);
          segments.push(`${segments.length === 0 ? "M" : "L"} ${x} ${y}`);
        }
      });

      linesByMethod[m] = segments.join(" ");
    });

    return {
      multiPoints: multiPointsBySlice,
      linesByMethod,
      thresholdY: thresholdYCoord,
      yDomain: [minFold, maxFold],
      xSlices: refTrajectory.map((p, idx) => ({ timestamp: p.timestamp, x: getX(idx) })),
    };
  }, [multiTrajectories, visibleMethods, innerWidth, innerHeight]);

  // Clean X-Axis Decimation: max 6–8 evenly spaced ticks
  const xTicks = useMemo(() => {
    const sourcePoints =
      viewMode === "compare"
        ? compareChartMath.xSlices
        : singleChartMath.pointsWithCoords;

    if (!sourcePoints || sourcePoints.length === 0) return [];
    if (sourcePoints.length <= 8) {
      return sourcePoints.map((pt, idx) => ({ pt, idx }));
    }

    const targetTicks = 7;
    const step = Math.max(1, Math.floor((sourcePoints.length - 1) / (targetTicks - 1)));
    const ticks: { pt: (typeof sourcePoints)[0]; idx: number }[] = [];

    for (let i = 0; i < sourcePoints.length; i += step) {
      ticks.push({ pt: sourcePoints[i], idx: i });
    }

    const lastIdx = sourcePoints.length - 1;
    if (ticks[ticks.length - 1].idx !== lastIdx) {
      const prevX = ticks[ticks.length - 1].pt.x;
      const lastX = sourcePoints[lastIdx].x;
      if (lastX - prevX > 65) {
        ticks.push({ pt: sourcePoints[lastIdx], idx: lastIdx });
      } else {
        ticks[ticks.length - 1] = { pt: sourcePoints[lastIdx], idx: lastIdx };
      }
    }

    return ticks;
  }, [viewMode, singleChartMath.pointsWithCoords, compareChartMath.xSlices]);

  // Chart Mouse Hover Tracking
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * chartWidth;

    const pointsList =
      viewMode === "compare"
        ? compareChartMath.multiPoints
        : singleChartMath.pointsWithCoords;

    if (!pointsList || pointsList.length === 0) return;

    let closestIdx = 0;
    let minDiff = Infinity;
    pointsList.forEach((p, idx) => {
      const diff = Math.abs(p.x - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    setHoveredIndex(closestIdx);
  };

  const activeSinglePoint =
    hoveredIndex !== null && singleChartMath.pointsWithCoords[hoveredIndex]
      ? singleChartMath.pointsWithCoords[hoveredIndex]
      : null;

  const activeComparePoint =
    hoveredIndex !== null && compareChartMath.multiPoints[hoveredIndex]
      ? compareChartMath.multiPoints[hoveredIndex]
      : null;

  // Filtered Candidates Dropdown List
  const filteredCandidates = useMemo(() => {
    let list = candidateSignals;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.product.toLowerCase().includes(q) ||
          c.adverse_event.toLowerCase().includes(q)
      );
    }
    if (tierFilter !== "All" && (hasConsensus || viewMode === "compare")) {
      list = list.filter(
        (c) => c.agreement_tier && c.agreement_tier.toLowerCase() === tierFilter.toLowerCase()
      );
    }

    list = [...list].sort((a, b) => {
      if (sortCriteria === "peak_score") {
        return (b.peak_score ?? -9999) - (a.peak_score ?? -9999);
      } else if (sortCriteria === "latest_score") {
        return (b.latest_score ?? -9999) - (a.latest_score ?? -9999);
      } else if (sortCriteria === "count") {
        return (b.count ?? 0) - (a.count ?? 0);
      } else if (sortCriteria === "onset") {
        return (a.first_onset || "").localeCompare(b.first_onset || "");
      } else if (sortCriteria === "slices_alerted") {
        return (b.slices_alerted ?? 0) - (a.slices_alerted ?? 0);
      } else if (sortCriteria === "consensus_score" && (hasConsensus || viewMode === "compare")) {
        return (b.consensus_score ?? 0) - (a.consensus_score ?? 0);
      }
      return (b.peak_score ?? -9999) - (a.peak_score ?? -9999);
    });

    return list;
  }, [candidateSignals, searchQuery, tierFilter, sortCriteria, hasConsensus, viewMode]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner & Signal Selection */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <LineChart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Longitudinal Signal Visualizer
              </h2>
              <p className="text-xs text-slate-400">
                Time-series signal evolution, historical onset detection, and comparative cross-method surveillance.
              </p>
            </div>
          </div>

          {/* Drug-Event Pair Dropdown Selector */}
          <div className="relative min-w-[320px] sm:min-w-[420px]">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Active Drug-Event Pair ({candidateSignals.length > 0 ? `${candidateSignals.length} candidates` : "0 candidates (Model not run)"})
              </label>
              {loadingCandidates && (
                <span className="text-[10px] text-indigo-400 flex items-center gap-1">
                  <span className="w-2.5 h-2.5 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  Loading...
                </span>
              )}
            </div>

            <div
              onClick={() => setShowPairDropdown(!showPairDropdown)}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 hover:border-slate-500 text-xs cursor-pointer shadow-inner transition"
            >
              <div className="truncate pr-2">
                <span className="font-bold text-white">{selectedProduct || "No Signal Selected"}</span>
                <span className="text-slate-500 mx-1.5">→</span>
                <span className="text-slate-300 font-medium">{selectedAE || "Run Longitudinal Model"}</span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </div>

            {/* Active Signal Telemetry Summary */}
            {activeCandidate && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px]">
                {activeCandidate.agreement_tier && (
                  <span
                    className={`px-2 py-0.5 rounded-full font-semibold border ${getTierBadgeClass(
                      activeCandidate.agreement_tier
                    )}`}
                  >
                    {activeCandidate.agreement_tier}
                  </span>
                )}
                <span className="font-mono text-slate-300">
                  Peak: <strong>{activeCandidate.peak_score !== null && activeCandidate.peak_score !== undefined ? activeCandidate.peak_score.toFixed(2) : "—"}</strong>
                </span>
                <span className="text-slate-600">·</span>
                <span className="font-mono text-slate-300">
                  Latest: <strong>{activeCandidate.latest_score !== null && activeCandidate.latest_score !== undefined ? activeCandidate.latest_score.toFixed(2) : "—"}</strong>
                </span>
                <span className="text-slate-600">·</span>
                <span className="font-mono text-slate-300">
                  Count: <strong>{activeCandidate.count.toLocaleString()}</strong>
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">
                  Alerted: <strong>{activeCandidate.slices_alerted}/{activeCandidate.total_slices} slices</strong>
                </span>
                {activeCandidate.first_onset && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-rose-400 font-mono">Onset: {formatTimestampTick(activeCandidate.first_onset)}</span>
                  </>
                )}
                {activeCandidate.consensus_score !== null && activeCandidate.consensus_score !== undefined && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-indigo-400 font-mono">{activeCandidate.methods_alerted.length} methods alerted</span>
                  </>
                )}
              </div>
            )}

            {showPairDropdown && (
              <div className="absolute right-0 left-0 mt-2 z-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 space-y-2.5 max-w-lg">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search candidate pairs..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <div className="flex items-center gap-1">
                    <span>Sort:</span>
                    <select
                      value={sortCriteria}
                      onChange={(e) => setSortCriteria(e.target.value as any)}
                      className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-200 outline-none"
                    >
                      <option value="peak_score">Peak Score</option>
                      <option value="latest_score">Latest Score</option>
                      <option value="count">Count (N)</option>
                      <option value="onset">First Alert Date</option>
                      <option value="slices_alerted">Times Alerted</option>
                      {(hasConsensus || viewMode === "compare") && (
                        <option value="consensus_score">Consensus Score</option>
                      )}
                    </select>
                  </div>
                  {(hasConsensus || viewMode === "compare") && (
                    <div className="flex items-center gap-1">
                      <span>Tier:</span>
                      <select
                        value={tierFilter}
                        onChange={(e) => setTierFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-200 outline-none"
                      >
                        <option value="All">All Tiers</option>
                        <option value="Unanimous">Unanimous</option>
                        <option value="Strong">Strong</option>
                        <option value="Moderate">Moderate</option>
                        <option value="Weak">Weak</option>
                        <option value="Isolated">Isolated</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-slate-800/40 text-xs pr-1">
                  {filteredCandidates.length === 0 ? (
                    <div className="py-6 text-center text-slate-500">
                      {candidateSignals.length === 0
                        ? "No longitudinal signals computed yet. Click 'Run Longitudinal' below to detect signals across time slices."
                        : "No matching drug-event pairs found."}
                    </div>
                  ) : (
                    filteredCandidates.map((pair) => {
                      const isSelected =
                        pair.product.toLowerCase() === selectedProduct.toLowerCase() &&
                        pair.adverse_event.toLowerCase() === selectedAE.toLowerCase();
                      return (
                        <div
                          key={`${pair.product}-${pair.adverse_event}`}
                          onClick={() => {
                            setSelectedProduct(pair.product);
                            setSelectedAE(pair.adverse_event);
                            setShowPairDropdown(false);
                          }}
                          className={`p-2 rounded-lg cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? "bg-indigo-600/20 text-white font-medium border border-indigo-500/30"
                              : "hover:bg-slate-800/80 text-slate-300"
                          }`}
                        >
                          <div className="truncate pr-2">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-semibold text-white">{pair.product}</span>
                              <span className="text-slate-500 shrink-0">→</span>
                              <span className="text-slate-300 truncate font-medium">{pair.adverse_event}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-mono flex-wrap">
                              {pair.agreement_tier && (
                                <span className={`px-1.5 py-0.2 rounded border ${getTierBadgeClass(pair.agreement_tier)}`}>
                                  {pair.agreement_tier}
                                </span>
                              )}
                              <span>Peak: {pair.peak_score !== null && pair.peak_score !== undefined ? pair.peak_score.toFixed(2) : "—"}</span>
                              <span>Latest: {pair.latest_score !== null && pair.latest_score !== undefined ? pair.latest_score.toFixed(2) : "—"}</span>
                              <span>Alerted: {pair.slices_alerted}/{pair.total_slices} slices</span>
                              <span>N: {pair.count.toLocaleString()}</span>
                              {pair.first_onset && (
                                <span>Onset: {formatTimestampTick(pair.first_onset)}</span>
                              )}
                              {pair.consensus_score !== null && pair.consensus_score !== undefined && (
                                <span>{pair.methods_alerted.length} methods</span>
                              )}
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Configuration Bar */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle: Single vs Compare All vs Multi Signals */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setViewMode("single")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                  viewMode === "single"
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <LineChart className="w-3.5 h-3.5" />
                <span>Single Method</span>
              </button>
              <button
                onClick={() => setViewMode("compare")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                  viewMode === "compare"
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Compare All Methods</span>
              </button>
              <button
                onClick={() => setViewMode("multi_signals")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                  viewMode === "multi_signals"
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Multi-Signal Trajectories</span>
              </button>
            </div>

            {/* Method Select (Active in Single and Multi-Signal Views) */}
            {viewMode !== "compare" && (
              <div className="flex items-center gap-1.5 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 font-medium">Method:</span>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as LongitudinalMethod)}
                  className="bg-transparent text-white font-semibold outline-none cursor-pointer"
                >
                  <option value="bcpnn" className="bg-slate-900 text-white">BCPNN (IC)</option>
                  <option value="gps" className="bg-slate-900 text-white">GPS (EBGM)</option>
                  <option value="prr" className="bg-slate-900 text-white">PRR (Rate Ratio)</option>
                  <option value="ror" className="bg-slate-900 text-white">ROR (Odds Ratio)</option>
                  <option value="lasso" className="bg-slate-900 text-white">LASSO (Penalized Beta)</option>
                </select>
              </div>
            )}

            {/* Cadence Select */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400 font-medium">Cadence:</span>
              {(["Yearly", "Quarterly", "Monthly"] as LongitudinalCadenceLabel[]).map((cad) => (
                <button
                  key={cad}
                  onClick={() => setCadenceLabel(cad)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    cadenceLabel === cad
                      ? "bg-blue-600 text-white shadow-sm font-semibold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {cad}
                </button>
              ))}
            </div>

            {/* Mode Select */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400 font-medium">Mode:</span>
              <button
                onClick={() => setMode("cumulative")}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  mode === "cumulative"
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Cumulative
              </button>
              <button
                onClick={() => setMode("disjoint")}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  mode === "disjoint"
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Disjoint
              </button>
            </div>
          </div>

          {/* Run Longitudinal Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunLongitudinal("all")}
              disabled={running}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition disabled:opacity-50"
              title="Compute longitudinal trajectories for all methods (PRR, ROR, BCPNN, GPS)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${running ? "animate-spin text-indigo-400" : ""}`} />
              <span>Compute All Methods</span>
            </button>

            <button
              onClick={() => handleRunLongitudinal(method)}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 disabled:opacity-50 transition active:scale-95"
            >
              {running ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{running ? "Modeling..." : `Run ${viewMode === "compare" ? "Multi-Method" : method.toUpperCase()}`}</span>
            </button>
          </div>
        </div>

        {/* Progress Tracker Bar */}
        {running && (
          <div className="p-3 rounded-xl bg-slate-950/90 border border-blue-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-300 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                {statusMessage}
              </span>
              <span className="font-mono text-slate-300">
                {Math.round(progress * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 rounded-full"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Multi-Method Alert Status & Detection Notice */}
      <div className="rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-900/90 border-slate-800 shadow-md">
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              onsetPoint ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
            }`}
          >
            {onsetPoint ? <AlertTriangle className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white">
                {viewMode === "compare" ? "Comparative Cross-Method Status" : `${method.toUpperCase()} Detection Status`}:
              </span>
              {viewMode === "single" ? (
                onsetPoint ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Threshold Alert Onset: {formatTimestampTick(onsetPoint.timestamp)}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                    Below Alert Threshold ({METHOD_CONFIGS[method.toUpperCase()]?.thresholdLabel || "Threshold Not Passed"}) — No Alert Marker Plotted
                  </span>
                )
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Threshold-Normalized View (1.0× Universal Alert Line)
                </span>
              )}
            </div>

            {/* Detailed Multi-Method Notice List */}
            <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-2 flex-wrap font-mono">
              <span className="text-slate-500 uppercase text-[10px] tracking-wider font-sans font-bold">
                Alert History:
              </span>
              {alertNotices.length > 0 ? (
                alertNotices.map((n) => (
                  <span
                    key={n.method}
                    className="px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-500/30 text-rose-300 font-semibold"
                  >
                    {n.method} alerted on {n.date}
                  </span>
                ))
              ) : (
                <span className="text-slate-500 italic">No methods have crossed detection threshold</span>
              )}
              {unalertedMethods.length > 0 && (
                <span className="text-slate-500 text-[11px]">
                  ({unalertedMethods.join(", ")} below threshold)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive SVG Chart Container / Multi-Signal Comparative Trajectory */}
      {viewMode === "multi_signals" ? (
        <MultiAELongitudinalChart
          signals={candidateSignals}
          activeMethod={method}
          onInspectSignal={(prod, ae) => {
            setSelectedProduct(prod);
            setSelectedAE(ae);
            setViewMode("single");
          }}
        />
      ) : (
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>
                  {viewMode === "compare"
                  ? "Multi-Method Surveillance Overlay (Threshold-Normalized)"
                  : `${method.toUpperCase()} Temporal Trajectory & Confidence Interval`}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-blue-400 border border-slate-700">
                {viewMode === "compare" ? "1.0× Universal Threshold" : `${cadenceLabel} Cadence`}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {viewMode === "compare"
                ? "All methods normalized by detection threshold (Fold = Score / Threshold). 1.0× represents the universal alert line."
                : "Timeline with confidence bands and exact historical onset pin. Only displayed if this method crossed threshold."}
            </p>
          </div>

          {/* Interactive Legend */}
          {viewMode === "compare" ? (
            <div className="flex flex-wrap items-center gap-2">
              {Object.keys(METHOD_CONFIGS).map((m) => {
                const meta = METHOD_CONFIGS[m];
                const isVisible = visibleMethods[m] !== false;
                const hasData = Boolean(multiTrajectories[m]);
                return (
                  <button
                    key={m}
                    onClick={() =>
                      setVisibleMethods((prev) => ({
                        ...prev,
                        [m]: !isVisible,
                      }))
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition ${
                      isVisible
                        ? "bg-slate-800 text-white border-slate-700"
                        : "bg-slate-950/60 text-slate-600 border-slate-900 opacity-60"
                    }`}
                    title={hasData ? `Toggle ${m} curve` : `${m} not computed yet`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="font-semibold">{m}</span>
                    {isVisible ? (
                      <Eye className="w-3 h-3 text-slate-400" />
                    ) : (
                      <EyeOff className="w-3 h-3 text-slate-600" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-blue-400 rounded-full" />
                <span className="text-slate-300 text-[11px] font-medium">Primary Score</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-blue-500/20 border border-blue-500/40 rounded" />
                <span className="text-slate-300 text-[11px] font-medium">95% CI Band</span>
              </div>
              {onsetPoint && (
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t border-dashed border-rose-400" />
                  <span className="text-rose-400 text-[11px] font-medium">Alert Onset</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dotted border-amber-400/80" />
                <span className="text-amber-400 text-[11px] font-medium">Threshold</span>
              </div>
            </div>
          )}
        </div>

        {/* SVG Canvas Area */}
        {loadingTrajectory ? (
          <div className="py-32 flex flex-col items-center justify-center gap-3 text-slate-400">
            <span className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Rendering trajectory curves...</span>
          </div>
        ) : trajectoryError || (trajectory.length === 0 && Object.keys(multiTrajectories).length === 0) ? (
          <div className="py-24 text-center text-slate-400 text-xs space-y-3 bg-slate-950/40 rounded-xl border border-slate-800">
            <LineChart className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-300">
              {viewMode === "compare" ? "Multi-Method" : method.toUpperCase()} Longitudinal Model Not Computed Yet
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {trajectoryError || `No time slices have been processed for ${viewMode === "compare" ? "multi-method" : method.toUpperCase()} yet.`} Click below to run the longitudinal model across all time slices.
            </p>
            <button
              onClick={() => handleRunLongitudinal(viewMode === "compare" ? "all" : method)}
              disabled={running}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow transition"
            >
              {running ? "Modeling..." : `Run ${viewMode === "compare" ? "Multi-Method" : method.toUpperCase()} Longitudinal`}
            </button>
          </div>
        ) : viewMode === "compare" ? (
          /* MULTI-METHOD COMPARATIVE SVG CANVAS */
          <div className="relative w-full overflow-hidden select-none">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto max-h-[460px] cursor-crosshair overflow-visible"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Horizontal Normalized Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1.0].map((pct) => {
                const yVal = margin.top + pct * innerHeight;
                const foldAtY =
                  compareChartMath.yDomain[1] -
                  pct * (compareChartMath.yDomain[1] - compareChartMath.yDomain[0]);
                return (
                  <g key={pct}>
                    <line
                      x1={margin.left}
                      y1={yVal}
                      x2={chartWidth - margin.right}
                      y2={yVal}
                      stroke="#334155"
                      strokeWidth="1"
                      strokeDasharray="2,4"
                      strokeOpacity="0.4"
                    />
                    <text
                      x={margin.left - 10}
                      y={yVal + 3}
                      fill="#64748b"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="end"
                    >
                      {foldAtY.toFixed(1)}×
                    </text>
                  </g>
                );
              })}

              {/* Universal Alert Threshold Baseline (1.0x) */}
              {compareChartMath.thresholdY >= margin.top &&
                compareChartMath.thresholdY <= margin.top + innerHeight && (
                  <g>
                    <line
                      x1={margin.left}
                      y1={compareChartMath.thresholdY}
                      x2={chartWidth - margin.right}
                      y2={compareChartMath.thresholdY}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="4,4"
                      strokeOpacity="0.9"
                    />
                    <text
                      x={chartWidth - margin.right + 6}
                      y={compareChartMath.thresholdY + 3}
                      fill="#f59e0b"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="start"
                    >
                      1.0× Alert
                    </text>
                  </g>
                )}

              {/* Multi-Method Comparative Curves */}
              {Object.entries(compareChartMath.linesByMethod).map(([mName, pathD]) => {
                const meta = METHOD_CONFIGS[mName] || METHOD_CONFIGS.PRR;
                return (
                  <path
                    key={mName}
                    d={pathD}
                    fill="none"
                    stroke={meta.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-200"
                  />
                );
              })}

              {/* Active Hover Crosshair Line */}
              {hoveredIndex !== null && compareChartMath.multiPoints[hoveredIndex] && (
                <g>
                  <line
                    x1={compareChartMath.multiPoints[hoveredIndex].x}
                    y1={margin.top}
                    x2={compareChartMath.multiPoints[hoveredIndex].x}
                    y2={margin.top + innerHeight}
                    stroke="#ffffff"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                    strokeOpacity="0.6"
                  />
                </g>
              )}

              {/* Decimated Clean X-Axis Tick Labels */}
              {xTicks.map(({ pt, idx }) => (
                <g key={idx}>
                  <line
                    x1={pt.x}
                    y1={margin.top + innerHeight}
                    x2={pt.x}
                    y2={margin.top + innerHeight + 5}
                    stroke="#475569"
                    strokeWidth="1"
                  />
                  <text
                    x={pt.x}
                    y={margin.top + innerHeight + 18}
                    fill="#94a3b8"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                  >
                    {formatTimestampTick(pt.timestamp)}
                  </text>
                </g>
              ))}
            </svg>

            {/* Compare Tooltip Box */}
            {activeComparePoint && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-950/95 border border-slate-800 shadow-2xl flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Time Slice
                    </span>
                    <strong className="text-white font-mono text-sm">
                      {formatTimestampTick(activeComparePoint.timestamp)}
                    </strong>
                    {activeComparePoint.count && (
                      <span className="text-[11px] text-slate-400 block font-mono">
                        Count: {activeComparePoint.count.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Comparative Methods Telemetry Grid */}
                <div className="flex items-center gap-4 flex-wrap">
                  {Object.keys(METHOD_CONFIGS).map((m) => {
                    if (visibleMethods[m] === false) return null;
                    const meta = METHOD_CONFIGS[m];
                    const sc = activeComparePoint.scores[m];
                    const fold = activeComparePoint.folds[m];
                    const alerted = activeComparePoint.alerts[m];

                    return (
                      <div key={m} className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                          <span className="font-bold text-white text-[11px]">{m}</span>
                          {alerted ? (
                            <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              ALERT
                            </span>
                          ) : (
                            <span className="text-[9px] px-1 py-0.2 rounded text-slate-500 bg-slate-950">
                              Below
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-xs text-slate-300">
                          Raw: <strong>{sc !== null && sc !== undefined ? sc.toFixed(2) : "—"}</strong>
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {fold !== null && fold !== undefined ? `${fold.toFixed(2)}× thres` : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* SINGLE METHOD SVG CANVAS */
          <div className="relative w-full overflow-hidden select-none">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto max-h-[460px] cursor-crosshair overflow-visible"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <defs>
                <linearGradient id="ciBandGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.08" />
                </linearGradient>

                <linearGradient id="scoreLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>

                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Horizontal Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1.0].map((pct) => {
                const yVal = margin.top + pct * innerHeight;
                const scoreAtY =
                  singleChartMath.yDomain[1] -
                  pct * (singleChartMath.yDomain[1] - singleChartMath.yDomain[0]);
                return (
                  <g key={pct}>
                    <line
                      x1={margin.left}
                      y1={yVal}
                      x2={chartWidth - margin.right}
                      y2={yVal}
                      stroke="#334155"
                      strokeWidth="1"
                      strokeDasharray="2,4"
                      strokeOpacity="0.4"
                    />
                    <text
                      x={margin.left - 10}
                      y={yVal + 3}
                      fill="#64748b"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="end"
                    >
                      {scoreAtY.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Threshold Dotted Baseline */}
              {singleChartMath.thresholdY >= margin.top &&
                singleChartMath.thresholdY <= margin.top + innerHeight && (
                  <g>
                    <line
                      x1={margin.left}
                      y1={singleChartMath.thresholdY}
                      x2={chartWidth - margin.right}
                      y2={singleChartMath.thresholdY}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="4,4"
                      strokeOpacity="0.8"
                    />
                    <text
                      x={chartWidth - margin.right + 6}
                      y={singleChartMath.thresholdY + 3}
                      fill="#f59e0b"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="start"
                    >
                      {METHOD_CONFIGS[method.toUpperCase()]?.thresholdLabel || "Threshold"}
                    </text>
                  </g>
                )}

              {/* Shaded Confidence Interval Band */}
              {singleChartMath.areaPath && (
                <path
                  d={singleChartMath.areaPath}
                  fill="url(#ciBandGradient)"
                  stroke="#3b82f6"
                  strokeWidth="0.75"
                  strokeOpacity="0.4"
                />
              )}

              {/* Primary Score Line */}
              {singleChartMath.linePath && (
                <path
                  d={singleChartMath.linePath}
                  fill="none"
                  stroke="url(#scoreLineGradient)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Historical Alert Onset Marker (ONLY shown if current method passed threshold) */}
              {onsetPoint && onsetIndex >= 0 && singleChartMath.pointsWithCoords[onsetIndex] && (
                <g>
                  <line
                    x1={singleChartMath.pointsWithCoords[onsetIndex].x}
                    y1={margin.top}
                    x2={singleChartMath.pointsWithCoords[onsetIndex].x}
                    y2={margin.top + innerHeight}
                    stroke="#f43f5e"
                    strokeWidth="2"
                    strokeDasharray="4,4"
                    filter="url(#glow)"
                  />

                  {/* Onset Pin Badge at Top */}
                  <g
                    transform={`translate(${singleChartMath.pointsWithCoords[onsetIndex].x}, ${
                      margin.top - 12
                    })`}
                  >
                    <rect
                      x="-55"
                      y="-14"
                      width="110"
                      height="20"
                      rx="10"
                      fill="#f43f5e"
                      className="shadow-lg"
                    />
                    <text
                      x="0"
                      y="0"
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="sans-serif"
                      textAnchor="middle"
                    >
                      ALERT: {formatTimestampTick(onsetPoint.timestamp)}
                    </text>
                  </g>

                  {/* Pulse circle on trajectory point */}
                  {singleChartMath.pointsWithCoords[onsetIndex].y !== null && (
                    <circle
                      cx={singleChartMath.pointsWithCoords[onsetIndex].x}
                      cy={singleChartMath.pointsWithCoords[onsetIndex].y!}
                      r="6"
                      fill="#f43f5e"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  )}
                </g>
              )}

              {/* Data Point Circles */}
              {singleChartMath.pointsWithCoords.map((pt, idx) => {
                if (pt.y === null) return null;
                const isHovered = hoveredIndex === idx;
                const isOnset = idx === onsetIndex;

                return (
                  <g key={idx}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isOnset ? 5 : isHovered ? 6 : 3.5}
                      fill={pt.alert ? "#f43f5e" : "#3b82f6"}
                      stroke="#ffffff"
                      strokeWidth={isHovered ? 2 : 1}
                      className="transition-all duration-100"
                    />
                  </g>
                );
              })}

              {/* Active Hover Crosshair Line */}
              {hoveredIndex !== null && singleChartMath.pointsWithCoords[hoveredIndex] && (
                <g>
                  <line
                    x1={singleChartMath.pointsWithCoords[hoveredIndex].x}
                    y1={margin.top}
                    x2={singleChartMath.pointsWithCoords[hoveredIndex].x}
                    y2={margin.top + innerHeight}
                    stroke="#ffffff"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                    strokeOpacity="0.6"
                  />
                </g>
              )}

              {/* Decimated Clean X-Axis Tick Labels */}
              {xTicks.map(({ pt, idx }) => (
                <g key={idx}>
                  <line
                    x1={pt.x}
                    y1={margin.top + innerHeight}
                    x2={pt.x}
                    y2={margin.top + innerHeight + 5}
                    stroke="#475569"
                    strokeWidth="1"
                  />
                  <text
                    x={pt.x}
                    y={margin.top + innerHeight + 18}
                    fill="#94a3b8"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                  >
                    {formatTimestampTick(pt.timestamp)}
                  </text>
                </g>
              ))}
            </svg>

            {/* Active Floating Single Tooltip Box */}
            {activeSinglePoint && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Time Slice
                    </span>
                    <strong className="text-white font-mono text-sm">
                      {formatTimestampTick(activeSinglePoint.timestamp)}
                    </strong>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    {method.toUpperCase()} Score
                  </span>
                  <span className="font-mono text-white text-sm font-bold">
                    {activeSinglePoint.score !== null ? activeSinglePoint.score?.toFixed(2) : "—"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    95% Credible Interval
                  </span>
                  <span className="font-mono text-slate-300">
                    [{activeSinglePoint.ci_lower?.toFixed(2) ?? "—"},{" "}
                    {activeSinglePoint.ci_upper?.toFixed(2) ?? "—"}]
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    Reports Count
                  </span>
                  <span className="font-mono text-blue-400 font-semibold">
                    {activeSinglePoint.count?.toLocaleString() ?? "—"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    Alert Status
                  </span>
                  <span
                    className={`font-semibold inline-flex items-center gap-1 ${
                      activeSinglePoint.alert ? "text-rose-400" : "text-slate-400"
                    }`}
                  >
                    {activeSinglePoint.alert ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" /> Signal Active
                      </>
                    ) : (
                      "Below Threshold"
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default LongitudinalViewer;
