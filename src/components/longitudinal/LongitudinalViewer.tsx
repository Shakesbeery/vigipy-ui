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
  Flame,
  Grid3X3,
  Layers,
  LineChart,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Table,
  TrendingUp,
  X,
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

export type LongitudinalMethod = "bcpnn" | "gps" | "prr" | "ror" | "lasso" | "score_da" | "all";
export type LongitudinalCadence = "YE" | "QE" | "ME";
export type LongitudinalCadenceLabel = "Yearly" | "Quarterly" | "Monthly";
export type LongitudinalMode = "cumulative" | "disjoint";

interface LongitudinalViewerProps {
  /** Optional initial selected signal to view */
  initialSignal?: SignalRow | { product: string; adverse_event: string } | null;
  /** Callback to notify parent of active signal change */
  onSignalChange?: (product: string, adverseEvent: string) => void;
  /** Callback to open global method configuration modal */
  onOpenConfig?: () => void;
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
  SCORE_DA: {
    name: "SCORE-DA",
    color: "#f43f5e", // Rose
    threshold: 0.0,
    thresholdLabel: "SER > 0.0",
    metricLabel: "Standardized Outlier Residual",
    normalize: (score) => (score !== null && score !== undefined ? Math.max(0, score + 1.0) : null),
  },
  SCORE: {
    name: "SCORE-DA",
    color: "#f43f5e", // Rose
    threshold: 0.0,
    thresholdLabel: "SER > 0.0",
    metricLabel: "Standardized Outlier Residual",
    normalize: (score) => (score !== null && score !== undefined ? Math.max(0, score + 1.0) : null),
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
  onOpenConfig,
}) => {
  // Configuration State
  const [method, setMethod] = useState<LongitudinalMethod>("bcpnn");
  const [cadenceLabel, setCadenceLabel] = useState<LongitudinalCadenceLabel>("Quarterly");
  const [mode, setMode] = useState<LongitudinalMode>("cumulative");
  const [viewMode, setViewMode] = useState<"single" | "compare" | "heatmap" | "multi_signals">("single");

  // Visible methods in multi-method comparative mode
  const [visibleMethods, setVisibleMethods] = useState<Record<string, boolean>>({
    PRR: true,
    ROR: true,
    RFET: true,
    BCPNN: true,
    GPS: true,
    LASSO: true,
    SCORE_DA: true,
    SCORE: true,
  });

  // Dynamic Candidate Signals from Longitudinal Time Slices
  const [candidateSignals, setCandidateSignals] = useState<LongitudinalSignalItem[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(false);
  const [hasConsensus, setHasConsensus] = useState<boolean>(false);
  const [computedMethods, setComputedMethods] = useState<string[]>([]);
  const [sortCriteria, setSortCriteria] = useState<
    "consecutive" | "avg_peak" | "peak_score" | "latest_score" | "count" | "onset" | "slices_alerted" | "consensus_score"
  >("consecutive");
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

  // Table pagination and chart ref
  const [tablePage, setTablePage] = useState<number>(1);
  const [tableRowsPerPage, setTableRowsPerPage] = useState<number>(10);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  // Multi-signal Trajectory Selection State (Explicit selection from table checkboxes)
  const [selectedMultiKeys, setSelectedMultiKeys] = useState<string[]>([]);

  const toggleMultiSelectPair = (prod: string, ae: string) => {
    const key = `${prod.toLowerCase()}__${ae.toLowerCase()}`;
    setSelectedMultiKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectPair = (prod: string, ae: string) => {
    setSelectedProduct(prod);
    setSelectedAE(ae);
    setShowPairDropdown(false);
    chartContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Longitudinal & Method Analysis Parameters
  const [showParamsPanel, setShowParamsPanel] = useState<boolean>(false);
  const [decayHalfLife, setDecayHalfLife] = useState<string>("none"); // "none", "90D", "180D", "365D", "730D", "custom"
  const [customDecay, setCustomDecay] = useState<string>("");
  const [minEvents, setMinEvents] = useState<number>(3);
  const [includeGaps, setIncludeGaps] = useState<boolean>(false);

  // Method Hyperparameters
  const [customThreshold, setCustomThreshold] = useState<string>(""); // empty = method default
  const [rankingStatistic, setRankingStatistic] = useState<string>("default"); // "default", "IC025", "IC", "EB05", "EBGM"
  const [lassoAlpha, setLassoAlpha] = useState<number>(0.01);
  const [scoreFdr, setScoreFdr] = useState<number>(0.05);
  const [continuityCorrection, setContinuityCorrection] = useState<number>(0.5);
  const [relativeRisk, setRelativeRisk] = useState<number>(1.0);

  // Execution & Progress State
  const [running, setRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(1.0);
  const [statusMessage, setStatusMessage] = useState<string>("Ready");

  // Trajectory Data State
  const [trajectoryData, setTrajectoryData] = useState<LongitudinalTrajectoryResponse | null>(null);
  const [loadingTrajectory, setLoadingTrajectory] = useState<boolean>(false);
  const [trajectoryError, setTrajectoryError] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredHeatmapCell, setHoveredHeatmapCell] = useState<{
    method: string;
    meta: MethodMeta;
    timestamp: string;
    pt: TrajectoryPoint;
    minScore: number;
    maxScore: number;
    pos?: { x: number; y: number };
  } | null>(null);

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
      const backendSortBy =
        sortCriteria === "consecutive"
          ? "consecutive_alert_slices"
          : sortCriteria === "avg_peak"
          ? "avg_peak_score"
          : sortCriteria === "onset"
          ? "first_onset"
          : sortCriteria;

      const res = await fetchLongitudinalSignals({
        method: targetM,
        sort_by: backendSortBy,
        sort_dir: "desc",
      });
      const sigs = res.signals || [];
      setCandidateSignals(sigs);
      setHasConsensus(Boolean(res.has_consensus));
      if (res.computed_methods) {
        setComputedMethods(res.computed_methods);
      }
      // If a pair was already explicitly chosen and is in results, keep it.
      // If initialSignal was passed via props with a non-empty product, honor it.
      // Do NOT arbitrarily pick sigs[0] if user has not selected one.
      if (sigs.length > 0 && initialSignal?.product && !selectedProduct) {
        const found = sigs.some(
          (c) =>
            c.product.toLowerCase() === initialSignal.product.toLowerCase() &&
            c.adverse_event.toLowerCase() === (initialSignal.adverse_event || "").toLowerCase()
        );
        if (found) {
          setSelectedProduct(initialSignal.product);
          setSelectedAE(initialSignal.adverse_event || "");
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
    if (initialSignal?.product && initialSignal?.adverse_event) {
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
      const isSameMethod = (m1: string, m2: string) => {
        const norm1 = m1.toLowerCase().replace(/[-_]/g, "");
        const norm2 = m2.toLowerCase().replace(/[-_]/g, "");
        if (norm1 === norm2) return true;
        if ((norm1 === "score" || norm1 === "scoreda") && (norm2 === "score" || norm2 === "scoreda")) return true;
        return false;
      };

      // If method is not computed or trajectory is empty, do not display stale data
      if (
        !res.trajectory ||
        res.trajectory.length === 0 ||
        (res.method && !isSameMethod(res.method, m) && m !== "all")
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
      const activeMethodToLoad = (viewMode === "compare" || viewMode === "heatmap") ? "all" : method;
      loadTrajectory(selectedProduct, selectedAE, activeMethodToLoad);
      if (onSignalChange) onSignalChange(selectedProduct, selectedAE);
    }
  }, [selectedProduct, selectedAE, method, cadenceLabel, mode, viewMode]);


  // Handle Run Longitudinal Calculation
  const handleRunLongitudinal = async (runMethod?: LongitudinalMethod) => {
    const targetM = runMethod || ((viewMode === "compare" || viewMode === "heatmap") ? "all" : method);
    setRunning(true);
    setProgress(0.05);
    setStatusMessage(
      `Initializing ${cadenceLabel} ${targetM === "all" ? "multi-method" : targetM.toUpperCase()} longitudinal model...`
    );

    const effectiveDecay =
      decayHalfLife === "custom"
        ? (customDecay.trim() || null)
        : (decayHalfLife === "none" ? null : decayHalfLife);

    const parsedThres = customThreshold.trim() !== "" ? parseFloat(customThreshold) : null;
    const parsedStat = rankingStatistic !== "default" ? rankingStatistic : null;

    const req: LongitudinalRunRequest = {
      method: targetM,
      time_unit: CADENCE_MAP[cadenceLabel],
      mode,
      include_gaps: includeGaps,
      min_events: minEvents > 0 ? minEvents : 3,
      decay_half_life: effectiveDecay,
      decision_thres: Number.isFinite(parsedThres)
        ? parsedThres
        : (targetM === "score_da" || targetM === "score" ? scoreFdr : null),
      ranking_statistic: parsedStat,
      alpha: targetM === "lasso" || targetM === "all" ? lassoAlpha : null,
      continuity_correction:
        targetM === "prr" || targetM === "ror" || targetM === "all"
          ? continuityCorrection
          : null,
      relative_risk: relativeRisk !== 1.0 ? relativeRisk : null,
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
            if (targetM === "all") {
              setViewMode("compare");
            }
            if (selectedProduct && selectedAE) {
              loadTrajectory(selectedProduct, selectedAE, targetM === "all" ? "all" : targetM);
            }
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
  const margin = { top: 40, right: 50, bottom: 50, left: 80 };
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  // Heatmap Matrix Data Math
  const heatmapData = useMemo(() => {
    const seriesByMethod: Record<string, TrajectoryPoint[]> = {};
    if (multiTrajectories && Object.keys(multiTrajectories).length > 0) {
      Object.entries(multiTrajectories).forEach(([m, pts]) => {
        if (pts && pts.length > 0) seriesByMethod[m.toUpperCase()] = pts;
      });
    } else if (trajectory && trajectory.length > 0) {
      seriesByMethod[method.toUpperCase()] = trajectory;
    }

    const methodKeys = Object.keys(seriesByMethod);
    if (methodKeys.length === 0) {
      return { timestamps: [], rows: [], methodKeys: [] };
    }

    // Collect all timestamps sorted chronologically
    const timestampSet = new Set<string>();
    methodKeys.forEach((m) => {
      seriesByMethod[m].forEach((pt) => {
        if (pt.timestamp) timestampSet.add(pt.timestamp);
      });
    });
    const sortedTimestamps = Array.from(timestampSet).sort();

    // Map each method row
    const rows = methodKeys.map((m) => {
      const pts = seriesByMethod[m];
      const ptByTime = new Map<string, TrajectoryPoint>();
      pts.forEach((p) => ptByTime.set(p.timestamp, p));

      const scores = pts
        .map((p) => p.score)
        .filter((s): s is number => s !== null && s !== undefined && !isNaN(s));
      const minScore = scores.length > 0 ? Math.min(...scores) : 0;
      const maxScore = scores.length > 0 ? Math.max(...scores) : 1;
      const peakScore = scores.length > 0 ? Math.max(...scores) : null;
      const alertPoints = pts.filter((p) => p.alert);
      const firstOnset = alertPoints.length > 0 ? alertPoints[0].timestamp : null;
      const alertCount = alertPoints.length;

      const meta = METHOD_CONFIGS[m] || METHOD_CONFIGS.PRR;

      return {
        method: m,
        meta,
        minScore,
        maxScore,
        peakScore,
        alertCount,
        firstOnset,
        pointsByTime: ptByTime,
        totalSlices: pts.length,
      };
    });

    return {
      timestamps: sortedTimestamps,
      rows,
      methodKeys,
    };
  }, [multiTrajectories, trajectory, method]);

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
      if (sortCriteria === "consecutive") {
        return (b.consecutive_alert_slices ?? 0) - (a.consecutive_alert_slices ?? 0);
      } else if (sortCriteria === "avg_peak") {
        return (b.avg_peak_score ?? -9999) - (a.avg_peak_score ?? -9999);
      } else if (sortCriteria === "peak_score") {
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
      return (b.consecutive_alert_slices ?? 0) - (a.consecutive_alert_slices ?? 0);
    });

    return list;
  }, [candidateSignals, searchQuery, tierFilter, sortCriteria, hasConsensus, viewMode]);

  const paginatedCandidates = useMemo(() => {
    const start = (tablePage - 1) * tableRowsPerPage;
    return filteredCandidates.slice(start, start + tableRowsPerPage);
  }, [filteredCandidates, tablePage, tableRowsPerPage]);

  const multiSelectedSignals = useMemo(() => {
    const keySet = new Set(selectedMultiKeys);
    return candidateSignals.filter((c) =>
      keySet.has(`${c.product.toLowerCase()}__${c.adverse_event.toLowerCase()}`)
    );
  }, [candidateSignals, selectedMultiKeys]);

  const allPageMultiSelected =
    paginatedCandidates.length > 0 &&
    paginatedCandidates.every((c) =>
      selectedMultiKeys.includes(`${c.product.toLowerCase()}__${c.adverse_event.toLowerCase()}`)
    );

  const handleToggleSelectAllPage = () => {
    const pageKeys = paginatedCandidates.map(
      (c) => `${c.product.toLowerCase()}__${c.adverse_event.toLowerCase()}`
    );
    if (allPageMultiSelected) {
      const pageSet = new Set(pageKeys);
      setSelectedMultiKeys((prev) => prev.filter((k) => !pageSet.has(k)));
    } else {
      setSelectedMultiKeys((prev) => Array.from(new Set([...prev, ...pageKeys])));
    }
  };

  const handleSelectTopMulti = (count: number) => {
    const topKeys = filteredCandidates
      .slice(0, count)
      .map((c) => `${c.product.toLowerCase()}__${c.adverse_event.toLowerCase()}`);
    setSelectedMultiKeys(topKeys);
  };

  const handleClearMultiSelection = () => {
    setSelectedMultiKeys([]);
  };

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

          {/* Quick Active Pair Indicator in Top Banner */}
          {selectedProduct && selectedAE ? (
            <div className="flex items-center gap-2 bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800 text-xs shadow-inner">
              <span className="text-slate-400 font-medium">Inspecting:</span>
              <span className="font-bold text-white">{selectedProduct}</span>
              <span className="text-slate-500">→</span>
              <span className="text-slate-200 font-medium">{selectedAE}</span>
              {activeCandidate?.consecutive_alert_slices && activeCandidate.consecutive_alert_slices > 0 ? (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-mono font-bold">
                  <Flame className="w-3 h-3 text-amber-400" />
                  {activeCandidate.consecutive_alert_slices} consecutive
                </span>
              ) : null}
              <button
                onClick={() => {
                  setSelectedProduct("");
                  setSelectedAE("");
                }}
                className="ml-2 p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                title="Deselect pair"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic bg-slate-950/40 px-3.5 py-2 rounded-xl border border-slate-800/60">
              {candidateSignals.length > 0
                ? `${candidateSignals.length} alerted candidate signals available below`
                : "No longitudinal signals computed yet (Run analysis below)"}
            </div>
          )}
        </div>

        {/* Configuration Bar */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle: Single vs Compare All vs Heatmap vs Multi Signals */}
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
                onClick={() => setViewMode("heatmap")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                  viewMode === "heatmap"
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Grid3X3 className="w-3.5 h-3.5 text-rose-400" />
                <span>Method Heatmap</span>
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
            {viewMode !== "compare" && viewMode !== "heatmap" && (
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
                  <option value="score_da" className="bg-slate-900 text-white">SCORE-DA (Residuals)</option>
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
            {/* Parameters Toggle Button */}
            <button
              onClick={() => setShowParamsPanel(!showParamsPanel)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition ${
                showParamsPanel
                  ? "bg-indigo-600/30 text-indigo-200 border-indigo-500/50 shadow-sm"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
              }`}
              title="Configure longitudinal decay half-life, minimum events, decision thresholds, and method parameters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Parameters</span>
              {(decayHalfLife !== "none" || customThreshold !== "" || rankingStatistic !== "default") && (
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => handleRunLongitudinal("all")}
              disabled={running}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition disabled:opacity-50"
              title="Compute longitudinal trajectories for all methods (PRR, ROR, RFET, BCPNN, GPS, SCORE-DA)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${running ? "animate-spin text-indigo-400" : ""}`} />
              <span>Compute All Methods</span>
            </button>

            <button
              onClick={() => handleRunLongitudinal((viewMode === "compare" || viewMode === "heatmap") ? "all" : method)}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 disabled:opacity-50 transition active:scale-95"
            >
              {running ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{running ? "Modeling..." : (viewMode === "compare" || viewMode === "heatmap") ? "Run Multi-Method" : `Run ${method.toUpperCase()}`}</span>
            </button>
          </div>
        </div>

        {/* Longitudinal & Method Analysis Parameters Panel */}
        {showParamsPanel && (
          <div className="p-4 rounded-xl bg-slate-950/95 border border-indigo-500/30 shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Longitudinal & Method Hyperparameters
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                  Applied in Single & Multi-Method Runs
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDecayHalfLife("none");
                    setCustomDecay("");
                    setMinEvents(3);
                    setIncludeGaps(false);
                    setCustomThreshold("");
                    setRankingStatistic("default");
                    setLassoAlpha(0.01);
                    setScoreFdr(0.05);
                    setContinuityCorrection(0.5);
                    setRelativeRisk(1.0);
                  }}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition"
                  title="Reset all longitudinal parameters to defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Defaults</span>
                </button>
                <button
                  onClick={() => setShowParamsPanel(false)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Global Inheritance Explanation Banner */}
            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Global Method Hyperparameter Inheritance</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed max-w-2xl">
                  Method-specific parameters (such as SCORE-DA latent rank & syndromic penalty, BCPNN/GPS prior distributions, RFET mid-p adjustments, and LASSO bootstrap settings) are automatically inherited from the global <strong>Disproportionality Method Configuration</strong>. The controls below configure time-decay dynamics (t½), slice minimums, and direct overrides for time slices.
                </p>
              </div>
              {onOpenConfig && (
                <button
                  onClick={onOpenConfig}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-sm transition"
                  title="Open the global Method Configuration modal to adjust prior distributions, regression penalties, and consensus rules"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Open Global Method Configurations</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {/* Decay Half-Life */}
              <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200">Decay Half-Life (t½)</label>
                  <span className="text-[10px] text-indigo-400 font-mono">Time Weighting</span>
                </div>
                <select
                  value={decayHalfLife}
                  onChange={(e) => setDecayHalfLife(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="none">Disabled (No decay - Equal weighting)</option>
                  <option value="90D">90 Days (~3 Months)</option>
                  <option value="180D">180 Days (~6 Months)</option>
                  <option value="365D">365 Days (1 Year)</option>
                  <option value="730D">730 Days (2 Years)</option>
                  <option value="custom">Custom string (e.g. 120D, 1.5Y)</option>
                </select>
                {decayHalfLife === "custom" && (
                  <input
                    type="text"
                    value={customDecay}
                    onChange={(e) => setCustomDecay(e.target.value)}
                    placeholder="e.g. 120D, 2Y, 6M"
                    className="w-full mt-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 font-mono"
                  />
                )}
                <p className="text-[10px] text-slate-400">
                  Attenuates historical reports as 2^(-Δt / t½) so recent cases have higher impact.
                </p>
              </div>

              {/* Minimum Events & Gaps */}
              <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200">Min Events per Slice (N)</label>
                  <span className="text-[10px] text-slate-400 font-mono">Default: 3</span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={minEvents}
                  onChange={(e) => setMinEvents(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                />
                <label className="flex items-center gap-2 mt-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={includeGaps}
                    onChange={(e) => setIncludeGaps(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                  />
                  <span className="text-[11px] text-slate-300">Include empty time slices (Gaps)</span>
                </label>
                <p className="text-[10px] text-slate-400">
                  Filters slices with sparse counts and preserves empty periods where 0 reports occurred.
                </p>
              </div>

              {/* Decision Threshold Override */}
              <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200">Decision Threshold</label>
                  <span className="text-[10px] text-amber-400 font-mono">
                    {method.toUpperCase()} default: {METHOD_CONFIGS[method.toUpperCase()]?.threshold ?? 2.0}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={customThreshold}
                  onChange={(e) => setCustomThreshold(e.target.value)}
                  placeholder={`Default (${METHOD_CONFIGS[method.toUpperCase()]?.threshold ?? 2.0})`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-400">
                  Score required in a slice to flag an alert onset. Blank uses standard method defaults.
                </p>
              </div>

              {/* Ranking Statistic (BCPNN / GPS) */}
              <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200">Ranking Metric</label>
                  <span className="text-[10px] text-blue-400 font-mono">Bayesian Bounds</span>
                </div>
                <select
                  value={rankingStatistic}
                  onChange={(e) => setRankingStatistic(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="default">Default (Conservative 5% Lower Bound: IC025 / EB05)</option>
                  <option value="IC025">BCPNN: IC025 (Lower 5% Credible Interval)</option>
                  <option value="IC">BCPNN: IC (Mean Information Component)</option>
                  <option value="EB05">GPS: EB05 (Lower 5% Empirical Bayes Bound)</option>
                  <option value="EBGM">GPS: EBGM (Geometric Mean Expected / Observed)</option>
                </select>
                <p className="text-[10px] text-slate-400">
                  Selects between conservative lower interval bounds or point estimates for signal alert detection.
                </p>
              </div>

              {/* LASSO Alpha Penalty */}
              <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200">LASSO Alpha (L1 Penalty)</label>
                  <span className="text-[10px] text-emerald-400 font-mono">Default: 0.01</span>
                </div>
                <input
                  type="number"
                  step="0.005"
                  min="0.0001"
                  max="1.0"
                  value={lassoAlpha}
                  onChange={(e) => setLassoAlpha(parseFloat(e.target.value) || 0.01)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-400">
                  L1 regularization strength when evaluating multivariate LASSO regressions over time.
                </p>
              </div>

              {/* Continuity Correction */}
              <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200">Continuity Correction</label>
                  <span className="text-[10px] text-amber-300 font-mono">PRR / ROR</span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0.0"
                  max="2.0"
                  value={continuityCorrection}
                  onChange={(e) => setContinuityCorrection(parseFloat(e.target.value) || 0.0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-400">
                  Additive pseudo-count correction applied to 2x2 contingency tables when encountering sparse counts.
                </p>
              </div>

              {/* SCORE-DA FDR Significance Threshold */}
              <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200">SCORE-DA FDR Cutoff (q)</label>
                  <span className="text-[10px] text-rose-400 font-mono">Default: 0.05</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.001"
                  max="0.25"
                  value={scoreFdr}
                  onChange={(e) => setScoreFdr(parseFloat(e.target.value) || 0.05)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-400">
                  Benjamini-Hochberg FDR threshold determining alerts when evaluating syndromic outlier residuals.
                </p>
              </div>
            </div>
          </div>
        )}

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
              {(!selectedProduct || !selectedAE) ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                  Select a drug-event pair above to evaluate temporal status
                </span>
              ) : viewMode === "single" ? (
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
              {(!selectedProduct || !selectedAE) ? (
                <span className="text-slate-500 italic font-sans">No drug-event pair selected</span>
              ) : alertNotices.length > 0 ? (
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
              {(!selectedProduct || !selectedAE) ? null : unalertedMethods.length > 0 && (
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
          signals={multiSelectedSignals}
          activeMethod={method}
          onInspectSignal={(prod, ae) => {
            setSelectedProduct(prod);
            setSelectedAE(ae);
            setViewMode("single");
          }}
          onSelectTop={handleSelectTopMulti}
          onClearSelection={handleClearMultiSelection}
        />
      ) : (
        <div ref={chartContainerRef} className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
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
                  ? "All methods normalized by detection threshold (Fold = Score / Threshold). 1.0× represents universal alert line."
                  : "Timeline with confidence bands and exact historical onset pin. Only displayed if this method crossed threshold."}
              </p>
            </div>

            {/* Drug-Event Pair Dropdown Selector (Positioned close to the chart) */}
            <div className="relative min-w-[280px] sm:min-w-[340px] md:max-w-[420px]">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Active Drug-Event Pair ({candidateSignals.length > 0 ? `${candidateSignals.length} candidates` : "0 candidates"})
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
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 hover:border-slate-500 text-xs cursor-pointer shadow-inner transition"
              >
                <div className="truncate pr-2">
                  {selectedProduct && selectedAE ? (
                    <>
                      <span className="font-bold text-white">{selectedProduct}</span>
                      <span className="text-slate-500 mx-1.5">→</span>
                      <span className="text-slate-300 font-medium">{selectedAE}</span>
                    </>
                  ) : (
                    <span className="text-slate-400 italic">
                      {candidateSignals.length > 0
                        ? "Select pair or choose from table below..."
                        : "No pair selected (Run longitudinal analysis to detect signals)"}
                    </span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              </div>

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
                        <option value="consecutive">🔥 Consecutive Periods</option>
                        <option value="avg_peak">Avg Peak Strength</option>
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
                          ? "No longitudinal signals computed yet. Click 'Run Longitudinal' above to detect signals."
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
                                {pair.consecutive_alert_slices !== null && pair.consecutive_alert_slices !== undefined && (
                                  <span className="text-amber-300 font-bold">
                                    🔥 {pair.consecutive_alert_slices} periods
                                  </span>
                                )}
                                {pair.avg_peak_score !== null && pair.avg_peak_score !== undefined && (
                                  <span className="text-rose-300">
                                    Avg: {pair.avg_peak_score.toFixed(2)}
                                  </span>
                                )}
                                <span>Peak: {pair.peak_score !== null && pair.peak_score !== undefined ? pair.peak_score.toFixed(2) : "—"}</span>
                                <span>Alerted: {pair.slices_alerted}/{pair.total_slices} slices</span>
                                {pair.first_onset && (
                                  <span>Onset: {formatTimestampTick(pair.first_onset)}</span>
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

          {/* Active Signal Telemetry Summary Strip */}
          {activeCandidate && selectedProduct && selectedAE && (
            <div className="flex items-center gap-2.5 flex-wrap text-[11px] bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
              {activeCandidate.agreement_tier && (
                <span
                  className={`px-2 py-0.5 rounded-full font-semibold border ${getTierBadgeClass(
                    activeCandidate.agreement_tier
                  )}`}
                >
                  {activeCandidate.agreement_tier}
                </span>
              )}
              {activeCandidate.consecutive_alert_slices !== null && activeCandidate.consecutive_alert_slices !== undefined && (
                <span className="px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-mono">
                  <Flame className="w-3 h-3 text-amber-400" />
                  {activeCandidate.consecutive_alert_slices} Consecutive Periods
                </span>
              )}
              {activeCandidate.avg_peak_score !== null && activeCandidate.avg_peak_score !== undefined && (
                <span className="font-mono text-slate-300">
                  Avg Peak: <strong className="text-rose-400">{activeCandidate.avg_peak_score.toFixed(2)}</strong>
                </span>
              )}
              <span className="text-slate-600">·</span>
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
            </div>
          )}

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

        {/* SVG Canvas Area */}
        {loadingTrajectory ? (
          <div className="py-32 flex flex-col items-center justify-center gap-3 text-slate-400">
            <span className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Rendering trajectory curves...</span>
          </div>
        ) : (!selectedProduct || !selectedAE) ? (
          <div className="py-24 text-center text-slate-400 text-xs space-y-3 bg-slate-950/40 rounded-xl border border-slate-800">
            <LineChart className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-300">
              No Drug-Event Pair Selected
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {candidateSignals.length > 0
                ? "Choose a drug-event pair from the selector above to visualize its longitudinal trajectory and historical onset."
                : "No longitudinal signals computed yet. Click 'Run Longitudinal' or 'Compute All Methods' to analyze time slices across your dataset."}
            </p>
            {candidateSignals.length > 0 ? (
              <button
                onClick={() => setShowPairDropdown(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow transition"
              >
                Choose Drug-Event Pair
              </button>
            ) : (
              <button
                onClick={() => handleRunLongitudinal(viewMode === "compare" ? "all" : method)}
                disabled={running}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow transition"
              >
                {running ? "Modeling..." : `Run ${viewMode === "compare" ? "Multi-Method" : method.toUpperCase()} Longitudinal`}
              </button>
            )}
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
              {/* Y-Axis Rotated Metric Label */}
              <text
                transform={`rotate(-90, ${margin.left - 52}, ${margin.top + innerHeight / 2})`}
                x={margin.left - 52}
                y={margin.top + innerHeight / 2}
                fill="#94a3b8"
                fontSize="11"
                fontWeight="600"
                letterSpacing="0.02em"
                textAnchor="middle"
              >
                Normalized Signal Strength (Fold-Change Relative to Threshold, 1.0× = Alert)
              </text>

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
        ) : viewMode === "heatmap" ? (
          /* MULTI-METHOD HEATMAP MATRIX CANVAS */
          <div className="space-y-4 select-none">
            {/* Heatmap Control & Legend Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">Method Matrix</span>
                <span className="text-slate-400">
                  ({heatmapData.rows.length} method{heatmapData.rows.length !== 1 ? "s" : ""} × {heatmapData.timestamps.length} time slices)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  Row-normalized raw signal coloring
                </span>
              </div>

              {/* Heatmap Color Scale Legend */}
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-slate-800 border border-slate-700" />
                  <span>Baseline Low</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-slate-700 border border-slate-600" />
                  <span>Baseline High</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-rose-600/70 border border-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]" />
                  <span className="text-rose-300 font-medium">Signal Alert Active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shadow-sm shadow-rose-400" />
                  <span>Threshold Exceeded</span>
                </div>
              </div>
            </div>

            {/* Scrollable Heatmap Matrix */}
            {heatmapData.timestamps.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-xs space-y-3 bg-slate-950/40 rounded-xl border border-slate-800">
                <Grid3X3 className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-medium text-slate-300">
                  No Time Slice Data Available for Heatmap
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click 'Compute All Methods' above to evaluate longitudinal trajectories across time slices for all methods.
                </p>
                <button
                  onClick={() => handleRunLongitudinal("all")}
                  disabled={running}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow transition"
                >
                  {running ? "Modeling..." : "Compute All Methods"}
                </button>
              </div>
            ) : (
              <div className="w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 shadow-inner">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/90 text-xs">
                      <th className="sticky left-0 z-20 bg-slate-900 px-4 py-3 min-w-[210px] border-r border-slate-800 font-semibold text-slate-200 shadow-sm">
                        Method & Decision Threshold
                      </th>
                      {heatmapData.timestamps.map((ts) => (
                        <th
                          key={ts}
                          className="px-3 py-2.5 text-center min-w-[76px] font-mono text-[11px] text-slate-300 whitespace-nowrap border-r border-slate-800/40"
                        >
                          <div className="font-bold text-white">{formatTimestampTick(ts)}</div>
                          <div className="text-[9px] text-slate-500 font-sans">{ts.split(" ")[0]}</div>
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-center min-w-[85px] font-semibold text-slate-300 border-r border-slate-800/40">
                        Alert Slices
                      </th>
                      <th className="px-3 py-2.5 text-center min-w-[90px] font-semibold text-slate-300">
                        Peak Raw
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {heatmapData.rows.map((row) => (
                      <tr key={row.method} className="hover:bg-slate-900/40 transition-colors">
                        {/* Sticky Method Label Header */}
                        <td className="sticky left-0 z-10 bg-slate-900/95 px-4 py-3 border-r border-slate-800">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: row.meta.color }}
                            />
                            <span className="font-bold text-white tracking-wide">{row.meta.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                              {row.meta.thresholdLabel}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[190px]">
                            {row.meta.metricLabel}
                          </div>
                        </td>

                        {/* Heatmap Time Slices */}
                        {heatmapData.timestamps.map((ts) => {
                          const pt = row.pointsByTime.get(ts);
                          const score = pt?.score;
                          const isAlert = Boolean(pt?.alert);

                          // Calculate row-based coloring using raw signal value
                          let bgStyle = "rgba(30, 41, 59, 0.4)";
                          let borderStyle = "rgba(51, 65, 85, 0.4)";
                          let textClass = "text-slate-500 font-mono";
                          let glowStyle = "";

                          if (score !== null && score !== undefined && !isNaN(score)) {
                            const span = row.maxScore - row.minScore;
                            const norm = span > 0.0001 ? Math.max(0, Math.min(1, (score - row.minScore) / span)) : 0.5;

                            if (isAlert) {
                              const alpha = 0.35 + 0.55 * norm;
                              bgStyle = `rgba(244, 63, 94, ${alpha.toFixed(2)})`;
                              borderStyle = "rgba(251, 113, 133, 0.8)";
                              textClass = "text-white font-mono font-bold";
                              glowStyle = "shadow-[0_0_8px_rgba(244,63,94,0.35)]";
                            } else {
                              const alpha = 0.2 + 0.45 * norm;
                              bgStyle = `rgba(30, 41, 59, ${alpha.toFixed(2)})`;
                              borderStyle = "rgba(51, 65, 85, 0.5)";
                              textClass = norm > 0.6 ? "text-slate-200 font-mono font-semibold" : "text-slate-400 font-mono font-medium";
                            }
                          }

                          return (
                            <td
                              key={ts}
                              className="p-1 border-r border-slate-800/30 text-center align-middle"
                            >
                              <div
                                style={{ backgroundColor: bgStyle, borderColor: borderStyle }}
                                onMouseEnter={(e) => {
                                  if (pt) {
                                    setHoveredHeatmapCell({
                                      method: row.method,
                                      meta: row.meta,
                                      timestamp: ts,
                                      pt,
                                      minScore: row.minScore,
                                      maxScore: row.maxScore,
                                    });
                                  }
                                }}
                                onMouseLeave={() => setHoveredHeatmapCell(null)}
                                className={`relative group rounded-lg p-2 min-h-[50px] flex flex-col items-center justify-center transition-all border cursor-pointer ${glowStyle} hover:scale-[1.04] hover:z-20 hover:border-white/80`}
                              >
                                {/* Alert Indicator Dot */}
                                {isAlert && (
                                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-400 shadow-sm shadow-rose-400 animate-pulse" />
                                )}

                                {/* Raw Score Text */}
                                <span className={`text-xs ${textClass}`}>
                                  {score !== null && score !== undefined
                                    ? score >= 100
                                      ? score.toFixed(1)
                                      : score >= 1
                                      ? score.toFixed(2)
                                      : score.toFixed(3)
                                    : "—"}
                                </span>

                                {/* Incident Report Count Subscript */}
                                {pt?.count !== undefined && pt?.count !== null && (
                                  <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                                    N={pt.count}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* Alert Slices Count Badge */}
                        <td className="px-3 py-3 text-center border-r border-slate-800/40">
                          <span
                            className={`inline-block font-mono text-xs font-semibold px-2 py-0.5 rounded-full border ${
                              row.alertCount > 0
                                ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {row.alertCount} / {row.totalSlices}
                          </span>
                        </td>

                        {/* Peak Raw Score */}
                        <td className="px-3 py-3 text-center font-mono text-xs font-semibold text-slate-200">
                          {row.peakScore !== null && row.peakScore !== undefined
                            ? row.peakScore >= 100
                              ? row.peakScore.toFixed(1)
                              : row.peakScore >= 1
                              ? row.peakScore.toFixed(2)
                              : row.peakScore.toFixed(3)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Hover Tooltip Card for Heatmap Cell */}
            {hoveredHeatmapCell && (
              <div className="p-3.5 rounded-xl bg-slate-950/95 border border-indigo-500/40 shadow-2xl flex flex-wrap items-center justify-between gap-4 text-xs animate-in fade-in duration-100">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: hoveredHeatmapCell.meta.color }}
                  />
                  <div>
                    <span className="font-bold text-white mr-1.5">{hoveredHeatmapCell.meta.name}</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      ({hoveredHeatmapCell.meta.metricLabel})
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Slice: {formatTimestampTick(hoveredHeatmapCell.timestamp)} ({hoveredHeatmapCell.timestamp.split(" ")[0]})
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-5 font-mono text-xs">
                  <div>
                    <span className="text-slate-400 mr-1 font-sans">Raw Score:</span>
                    <strong className="text-white">
                      {hoveredHeatmapCell.pt.score !== null && hoveredHeatmapCell.pt.score !== undefined
                        ? hoveredHeatmapCell.pt.score.toFixed(3)
                        : "—"}
                    </strong>
                  </div>

                  {(hoveredHeatmapCell.pt.ci_lower !== null || hoveredHeatmapCell.pt.ci_upper !== null) && (
                    <div>
                      <span className="text-slate-400 mr-1 font-sans">95% Interval:</span>
                      <span className="text-slate-300">
                        [{hoveredHeatmapCell.pt.ci_lower?.toFixed(2) ?? "—"},{" "}
                        {hoveredHeatmapCell.pt.ci_upper?.toFixed(2) ?? "—"}]
                      </span>
                    </div>
                  )}

                  {hoveredHeatmapCell.pt.count !== null && hoveredHeatmapCell.pt.count !== undefined && (
                    <div>
                      <span className="text-slate-400 mr-1 font-sans">Count:</span>
                      <span className="text-blue-400 font-semibold">{hoveredHeatmapCell.pt.count}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-sans">Alert Status:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        hoveredHeatmapCell.pt.alert
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {hoveredHeatmapCell.pt.alert
                        ? `ALERT ACTIVE (${hoveredHeatmapCell.meta.thresholdLabel})`
                        : `Below Threshold (${hoveredHeatmapCell.meta.thresholdLabel})`}
                    </span>
                  </div>
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

              {/* Y-Axis Rotated Metric Label */}
              <text
                transform={`rotate(-90, ${margin.left - 52}, ${margin.top + innerHeight / 2})`}
                x={margin.left - 52}
                y={margin.top + innerHeight / 2}
                fill="#94a3b8"
                fontSize="11"
                fontWeight="600"
                letterSpacing="0.02em"
                textAnchor="middle"
              >
                {METHOD_CONFIGS[method.toUpperCase()]?.metricLabel
                  ? `${method.toUpperCase()} — ${METHOD_CONFIGS[method.toUpperCase()].metricLabel}`
                  : `${method.toUpperCase()} Metric Score`}
              </text>

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

      {/* Interactive Candidate Signals Table (Underneath Chart) */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Table className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Longitudinal Signal Results Table</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700">
                  {filteredCandidates.length} {filteredCandidates.length === 1 ? "pair" : "pairs"}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Click any row to graphically inspect its temporal trajectory above. Ranked by consecutive alert streak and peak strength.
              </p>
            </div>
          </div>

          {/* Table Filters & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setTablePage(1);
                }}
                placeholder="Filter by drug or event..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setTablePage(1);
                  }}
                  className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Multi-Selection Controls */}
            {selectedMultiKeys.length > 0 && (
              <div className="flex items-center gap-2 bg-indigo-950/60 border border-indigo-500/40 px-3 py-1.5 rounded-xl text-xs">
                <span className="font-semibold text-indigo-300">
                  {selectedMultiKeys.length} {selectedMultiKeys.length === 1 ? "pair" : "pairs"} selected
                </span>
                {viewMode !== "multi_signals" ? (
                  <button
                    onClick={() => {
                      setViewMode("multi_signals");
                      chartContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] transition"
                  >
                    Plot Trajectories
                  </button>
                ) : null}
                <button
                  onClick={handleClearMultiSelection}
                  className="text-slate-400 hover:text-slate-200 text-[11px] underline"
                >
                  Clear
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleSelectTopMulti(3)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition"
                title="Select top 3 ranked pairs for multi-signal trajectory comparison"
              >
                Top 3
              </button>
              <button
                onClick={() => handleSelectTopMulti(5)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition"
                title="Select top 5 ranked pairs for multi-signal trajectory comparison"
              >
                Top 5
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400 font-medium">Sort by:</span>
              <select
                value={sortCriteria}
                onChange={(e) => {
                  setSortCriteria(e.target.value as any);
                  setTablePage(1);
                }}
                className="bg-transparent text-white font-medium outline-none cursor-pointer"
              >
                <option value="consecutive" className="bg-slate-900 text-white">🔥 Consecutive Periods (High to Low)</option>
                <option value="avg_peak" className="bg-slate-900 text-white">Avg Peak Strength (High to Low)</option>
                <option value="peak_score" className="bg-slate-900 text-white">Peak Score</option>
                <option value="latest_score" className="bg-slate-900 text-white">Latest Score</option>
                <option value="slices_alerted" className="bg-slate-900 text-white">Slices Alerted</option>
                <option value="onset" className="bg-slate-900 text-white">Earliest Onset Date</option>
                <option value="count" className="bg-slate-900 text-white">Report Count (N)</option>
                {(hasConsensus || viewMode === "compare") && (
                  <option value="consensus_score" className="bg-slate-900 text-white">Consensus Score</option>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Results Grid / Table */}
        {filteredCandidates.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <LineChart className="w-8 h-8 text-slate-700 mx-auto" />
            <p className="text-sm font-medium text-slate-400">
              {candidateSignals.length === 0
                ? "No longitudinal signals computed yet."
                : "No matching signals found."}
            </p>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              {candidateSignals.length === 0
                ? "Run a longitudinal analysis above to calculate temporal trajectories and detect alerts across time slices."
                : "Try adjusting your search filter or sort criteria."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allPageMultiSelected}
                      onChange={handleToggleSelectAllPage}
                      title="Select all pairs on this page for multi-signal comparison"
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900 cursor-pointer w-3.5 h-3.5"
                    />
                  </th>
                  <th className="py-3 px-3">Product / Device</th>
                  <th className="py-3 px-3">Adverse Event</th>
                  <th className="py-3 px-3 text-center">Consecutive Signal Periods</th>
                  <th className="py-3 px-3 text-right">Avg Signal Strength (Peaks)</th>
                  <th className="py-3 px-3 text-right">Peak Score</th>
                  <th className="py-3 px-3 text-center">Alert Slices</th>
                  <th className="py-3 px-3 text-center">First Onset</th>
                  {(hasConsensus || viewMode === "compare") && (
                    <th className="py-3 px-3 text-center">Consensus</th>
                  )}
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {paginatedCandidates.map((pair) => {
                  const pairKey = `${pair.product.toLowerCase()}__${pair.adverse_event.toLowerCase()}`;
                  const isMultiSelected = selectedMultiKeys.includes(pairKey);
                  const isSelected =
                    pair.product.toLowerCase() === selectedProduct.toLowerCase() &&
                    pair.adverse_event.toLowerCase() === selectedAE.toLowerCase();

                  const streak = pair.consecutive_alert_slices ?? 0;
                  const streakClass =
                    streak >= 4
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      : streak >= 2
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-slate-800 text-slate-400 border-slate-700";

                  const slicePct =
                    pair.total_slices > 0
                      ? Math.round((pair.slices_alerted / pair.total_slices) * 100)
                      : 0;

                  return (
                    <tr
                      key={`${pair.product}-${pair.adverse_event}`}
                      onClick={() => handleSelectPair(pair.product, pair.adverse_event)}
                      className={`cursor-pointer transition group ${
                        isSelected
                          ? "bg-indigo-600/20 hover:bg-indigo-600/30 border-l-2 border-indigo-500"
                          : isMultiSelected
                          ? "bg-indigo-950/30 hover:bg-indigo-950/40 border-l-2 border-indigo-400/60"
                          : "hover:bg-slate-800/50"
                      }`}
                    >
                      <td
                        className="py-2.5 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isMultiSelected}
                          onChange={() => toggleMultiSelectPair(pair.product, pair.adverse_event)}
                          title="Select for multi-signal trajectory comparison"
                          className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900 cursor-pointer w-3.5 h-3.5"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-white group-hover:text-indigo-300 transition">
                          {pair.product}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-medium">
                        {pair.adverse_event}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-mono ${streakClass}`}
                        >
                          <Flame className={`w-3 h-3 ${streak >= 2 ? "text-amber-400 animate-pulse" : "text-slate-500"}`} />
                          {streak} {streak === 1 ? "period" : "periods"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {pair.avg_peak_score !== null && pair.avg_peak_score !== undefined ? (
                          <span className="font-bold text-rose-400">
                            {pair.avg_peak_score.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                        {pair.peak_score !== null && pair.peak_score !== undefined ? (
                          pair.peak_score.toFixed(2)
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center gap-1 min-w-[70px]">
                          <span className="text-[11px] font-mono text-slate-300">
                            {pair.slices_alerted}/{pair.total_slices} ({slicePct}%)
                          </span>
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${slicePct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">
                        {pair.first_onset ? formatTimestampTick(pair.first_onset) : "—"}
                      </td>
                      {(hasConsensus || viewMode === "compare") && (
                        <td className="py-2.5 px-3 text-center">
                          {pair.agreement_tier ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getTierBadgeClass(
                                pair.agreement_tier
                              )}`}
                            >
                              {pair.agreement_tier}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectPair(pair.product, pair.adverse_event);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 ml-auto transition ${
                            isSelected
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                          }`}
                        >
                          <LineChart className="w-3.5 h-3.5" />
                          <span>{isSelected ? "Active" : "Inspect"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {filteredCandidates.length > tableRowsPerPage && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
            <span>
              Showing {(tablePage - 1) * tableRowsPerPage + 1} -{" "}
              {Math.min(tablePage * tableRowsPerPage, filteredCandidates.length)} of{" "}
              {filteredCandidates.length} candidate signals
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                disabled={tablePage === 1}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition"
              >
                Previous
              </button>
              <span className="font-mono text-slate-300">
                Page {tablePage} of {Math.ceil(filteredCandidates.length / tableRowsPerPage)}
              </span>
              <button
                onClick={() =>
                  setTablePage((p) =>
                    Math.min(Math.ceil(filteredCandidates.length / tableRowsPerPage), p + 1)
                  )
                }
                disabled={tablePage >= Math.ceil(filteredCandidates.length / tableRowsPerPage)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LongitudinalViewer;
