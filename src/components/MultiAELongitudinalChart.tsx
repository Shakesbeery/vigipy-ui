/**
 * Multi-Adverse Event Longitudinal Comparative Trajectory Chart
 * Displays adverse events / drug-event signals that peak above the disproportionality signal threshold line.
 * Supports viewing All Peaking Signals across the entire dataset or filtering to a specific product.
 * Features interactive per-line select/unselect toggles, distinctive color coding,
 * emergence markers, uncrowded rotated time-slice axes, and hover inspection.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  Sparkles,
  ChevronRight,
  Info,
  Layers,
  Filter,
  Globe,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  CheckCheck,
  X,
  Download,
  FileImage,
} from 'lucide-react';
import { TrajectorySummary, LongitudinalPoint } from '../types/vigipy';
import { exportSvgToFile, exportSvgToPng } from '../core/chart_export';

interface MultiAELongitudinalChartProps {
  targetDrug?: string;
  trajectories: TrajectorySummary[];
  method: string;
  mode: 'cumulative' | 'disjoint';
  expectationModel: string;
  threshold: number;
  onInspectSinglePair?: (drug: string, event: string) => void;
  availableDrugs?: string[];
  onSelectDrug?: (drug: string) => void;
}

const PALETTE = [
  '#f43f5e', // Rose
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#a855f7', // Purple
  '#6366f1', // Indigo
  '#84cc16', // Lime
];

const getPairKey = (t: TrajectorySummary) => `${t.drug}__${t.event}`;

export const MultiAELongitudinalChart: React.FC<MultiAELongitudinalChartProps> = ({
  targetDrug = '',
  trajectories,
  method,
  mode,
  expectationModel,
  threshold,
  onInspectSinglePair,
  availableDrugs = [],
  onSelectDrug,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const isAdditive = method === 'BCPNN' || method === 'LASSO';

  // Scope: 'all' = All signals across dataset; 'drug' = Filtered to targetDrug
  const [scope, setScope] = useState<'all' | 'drug'>('all');
  const [selectedDrug, setSelectedDrug] = useState<string>(targetDrug);

  // Sync selectedDrug when targetDrug prop changes
  useEffect(() => {
    if (targetDrug) {
      setSelectedDrug(targetDrug);
    }
  }, [targetDrug]);

  // 1. Filter trajectories based on active scope
  const scopedTrajectories = useMemo(() => {
    if (scope === 'drug' && selectedDrug) {
      return trajectories.filter(
        (t) => t.drug && t.drug.toLowerCase() === selectedDrug.toLowerCase()
      );
    }
    return trajectories;
  }, [trajectories, scope, selectedDrug]);

  // 2. Identify signals that peak above the signal threshold line
  const { peakingTrajectories, isUsingFallback } = useMemo(() => {
    const above = scopedTrajectories
      .filter((t) => (isAdditive ? t.peakScore > threshold : t.peakScore >= threshold))
      .sort((a, b) => b.peakScore - a.peakScore);

    if (above.length > 0) {
      return { peakingTrajectories: above, isUsingFallback: false };
    }

    // Fallback: If no trajectories strictly breach threshold, take the highest ranking candidate signals
    // so the graph is NEVER empty
    const sorted = [...scopedTrajectories].sort((a, b) => b.peakScore - a.peakScore);
    return { peakingTrajectories: sorted.slice(0, 10), isUsingFallback: sorted.length > 0 };
  }, [scopedTrajectories, threshold, isAdditive]);

  // 3. Search, filter & sorting states
  const [searchQuery, setSearchQuery] = useState('');
  const [trendFilter, setTrendFilter] = useState<'all' | 'emerging' | 'accelerating' | 'stable'>('all');
  const [sortBy, setSortBy] = useState<'peakScore' | 'volume' | 'firstEmergence' | 'name'>('peakScore');
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);

  // Filtered & sorted peaking trajectories for display and interactive pill toggles
  const displayTrajectories = useMemo(() => {
    let list = [...peakingTrajectories];

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          (t.event && t.event.toLowerCase().includes(q)) ||
          (t.drug && t.drug.toLowerCase().includes(q)) ||
          (t.firstEmergenceSlice && t.firstEmergenceSlice.toLowerCase().includes(q))
      );
    }

    if (trendFilter !== 'all') {
      list = list.filter((t) => t.trajectoryTrend === trendFilter);
    }

    if (minScoreFilter > 0) {
      list = list.filter((t) => t.peakScore >= minScoreFilter);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'peakScore') return b.peakScore - a.peakScore;
      if (sortBy === 'volume') return (b.totalReports || 0) - (a.totalReports || 0);
      if (sortBy === 'firstEmergence') {
        if (!a.firstEmergenceSlice) return 1;
        if (!b.firstEmergenceSlice) return -1;
        return a.firstEmergenceSlice.localeCompare(b.firstEmergenceSlice);
      }
      return `${a.drug}_${a.event}`.localeCompare(`${b.drug}_${b.event}`);
    });

    return list;
  }, [peakingTrajectories, searchQuery, trendFilter, minScoreFilter, sortBy]);

  // 4. Interactive selection state: which pairs are selected/visible
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{
    x: number;
    y: number;
    drug: string;
    event: string;
    point: LongitudinalPoint;
    color: string;
  } | null>(null);

  // Re-initialize selection when peaking trajectories change
  useEffect(() => {
    if (peakingTrajectories.length > 0) {
      // By default select top 6 peaking events to keep visualization pristine and readable
      const initial = new Set(peakingTrajectories.slice(0, 6).map(getPairKey));
      setSelectedKeys(initial);
    } else {
      setSelectedKeys(new Set());
    }
  }, [peakingTrajectories]);

  // Color mapping per unique pair key
  const keyColorMap = useMemo(() => {
    const map = new Map<string, string>();
    peakingTrajectories.forEach((t, i) => {
      map.set(getPairKey(t), PALETTE[i % PALETTE.length]);
    });
    return map;
  }, [peakingTrajectories]);

  // Extract all unified sorted time slices across selected trajectories
  const allTimeSlices = useMemo(() => {
    const sliceSet = new Set<string>();
    trajectories.forEach((t) => {
      t.points.forEach((p) => sliceSet.add(p.timeSlice));
    });
    return Array.from(sliceSet).sort();
  }, [trajectories]);

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedKeys(new Set(peakingTrajectories.map(getPairKey)));
  };

  const handleDeselectAll = () => {
    setSelectedKeys(new Set());
  };

  const handleSelectTop5 = () => {
    setSelectedKeys(new Set(peakingTrajectories.slice(0, 5).map(getPairKey)));
  };

  const handleSelectFiltered = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      displayTrajectories.forEach((t) => next.add(getPairKey(t)));
      return next;
    });
  };

  const handleDeselectFiltered = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      displayTrajectories.forEach((t) => next.delete(getPairKey(t)));
      return next;
    });
  };

  // Dimensions: 420 height and 90 bottom padding for completely uncrowded rotated axis
  const width = 820;
  const height = 420;
  const padding = { top: 40, right: 40, bottom: 90, left: 60 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Smart non-overlapping tick spacing: guaranteed at least 75px between ticks
  const visibleSliceIndices = useMemo(() => {
    if (allTimeSlices.length <= 1) return [0];
    const maxTicks = Math.min(10, Math.max(2, Math.floor(innerWidth / 75)));
    if (allTimeSlices.length <= maxTicks) {
      return allTimeSlices.map((_, i) => i);
    }
    const indices: number[] = [];
    const step = (allTimeSlices.length - 1) / (maxTicks - 1);
    for (let i = 0; i < maxTicks; i++) {
      indices.push(Math.round(i * step));
    }
    return Array.from(new Set(indices));
  }, [allTimeSlices.length, innerWidth]);

  const visibleSliceSet = useMemo(() => new Set(visibleSliceIndices), [visibleSliceIndices]);

  // Selected trajectories to draw
  const activeTrajectories = useMemo(() => {
    return peakingTrajectories.filter((t) => selectedKeys.has(getPairKey(t)));
  }, [peakingTrajectories, selectedKeys]);

  // Scale calculations
  let minScore = isAdditive ? -0.5 : 0;
  let maxScore = Math.max(threshold * 1.5, 4.0);

  activeTrajectories.forEach((t) => {
    t.points.forEach((p) => {
      if (p.score > maxScore) maxScore = p.score;
      if (p.score < minScore) minScore = p.score;
    });
  });

  maxScore = Math.ceil(maxScore * 1.15);
  minScore = Math.floor(minScore);
  if (minScore === maxScore) maxScore = minScore + 5;

  const scaleX = (idx: number) => {
    if (allTimeSlices.length <= 1) return padding.left + innerWidth / 2;
    return padding.left + (idx / (allTimeSlices.length - 1)) * innerWidth;
  };

  const scaleY = (val: number) => {
    return padding.top + innerHeight - ((val - minScore) / (maxScore - minScore)) * innerHeight;
  };

  const thresholdY = scaleY(threshold);

  // Hovered trajectory object
  const hoveredTrajectory = useMemo(() => {
    if (!hoveredKey) return null;
    return peakingTrajectories.find((t) => getPairKey(t) === hoveredKey) || null;
  }, [hoveredKey, peakingTrajectories]);

  // Total dataset-wide peaking count
  const allDatasetPeakingCount = useMemo(() => {
    return trajectories.filter((t) => (isAdditive ? t.peakScore > threshold : t.peakScore >= threshold)).length;
  }, [trajectories, threshold, isAdditive]);

  if (trajectories.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-8 backdrop-blur text-center space-y-3 shadow-xl">
        <div className="mx-auto w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
          <Info className="h-6 w-6 text-indigo-400 animate-pulse" />
        </div>
        <h4 className="text-sm font-semibold text-slate-200">
          Longitudinal Modeling Slices Being Evaluated
        </h4>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Longitudinal analysis applies the selected method ({method}) across all temporal slices in the cohort.
          Click <strong className="text-white">Run Longitudinal Analysis</strong> above to trigger multi-window scanning.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur shadow-xl space-y-4">
      {/* Header Banner & Scope Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <span>All Peaking Signals Graph:</span>
              <span className="text-rose-400 font-bold font-mono">
                {scope === 'all' ? 'Entire Dataset' : selectedDrug || targetDrug}
              </span>
            </h3>
            <span className="rounded-full bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 text-xs text-rose-300 font-mono font-bold">
              {peakingTrajectories.length} {isUsingFallback ? 'Top Candidates' : `Signals Breaching ${method} Threshold`}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {isUsingFallback
              ? `None of the pairs strictly breached ${method} cutoff (${threshold.toFixed(2)}); showing top ranking trajectories.`
              : `Comparative trajectories for pairs reaching signal cutoff (${method} ${isAdditive ? '>' : '≥'} ${threshold.toFixed(2)}, ${mode} mode, ${expectationModel} baseline).`}
          </p>
        </div>

        {/* Scope Switcher: All Data vs Specific Drug */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                scope === 'all'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>All Data ({allDatasetPeakingCount} Signals)</span>
            </button>
            <button
              type="button"
              onClick={() => setScope('drug')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                scope === 'drug'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Target Product Only</span>
            </button>
          </div>

          {scope === 'drug' && availableDrugs.length > 0 && (
            <select
              value={selectedDrug}
              onChange={(e) => {
                setSelectedDrug(e.target.value);
                onSelectDrug?.(e.target.value);
              }}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
            >
              {availableDrugs.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}

          {/* Quick Selection Buttons */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={handleSelectTop5}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
            >
              Top 5
            </button>
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              Clear
            </button>
            <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2">
              <button
                type="button"
                onClick={() => exportSvgToFile(svgRef.current, `peaking_signals_${scope}_${method.toLowerCase()}`)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors text-xs font-medium"
                title="Download vector graphic (.svg)"
              >
                <Download className="h-3 w-3 text-rose-400" />
                <span>SVG</span>
              </button>
              <button
                type="button"
                onClick={() => exportSvgToPng(svgRef.current, `peaking_signals_${scope}_${method.toLowerCase()}`)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors text-xs font-medium"
                title="Download high-resolution image (.png)"
              >
                <FileImage className="h-3 w-3 text-rose-400" />
                <span>PNG</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search, Filter & Quick-Action Toolbar */}
      <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Live Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by Adverse Event or Product (e.g. Infarction, Rash, Aspirin)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/90 pl-8 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Controls: Trend & Sort */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Trend Filter */}
            <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
              <SlidersHorizontal className="h-3 w-3 text-slate-400" />
              <select
                value={trendFilter}
                onChange={(e) => setTrendFilter(e.target.value as any)}
                className="bg-transparent text-slate-200 text-xs font-mono focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Trajectory Trends</option>
                <option value="emerging" className="bg-slate-900">Emerging Signals</option>
                <option value="accelerating" className="bg-slate-900">Accelerating / Rising</option>
                <option value="stable" className="bg-slate-900">Stable Signals</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
              <ArrowUpDown className="h-3 w-3 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-slate-200 text-xs font-mono focus:outline-none cursor-pointer"
              >
                <option value="peakScore" className="bg-slate-900">Peak Score (Highest)</option>
                <option value="volume" className="bg-slate-900">Report Volume (Most)</option>
                <option value="firstEmergence" className="bg-slate-900">First Emergence</option>
                <option value="name" className="bg-slate-900">Alphabetical (A-Z)</option>
              </select>
            </div>

            {/* Batch Select / Deselect Filtered */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSelectFiltered}
                title="Select all currently searched/filtered signals"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors"
              >
                <CheckCheck className="h-3 w-3" />
                <span>Select Filtered ({displayTrajectories.length})</span>
              </button>
              <button
                type="button"
                onClick={handleDeselectFiltered}
                title="Deselect currently filtered signals"
                className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs transition-colors"
              >
                Deselect
              </button>
            </div>
          </div>
        </div>

        {/* Live Filter Summary & Pill Toggle Header */}
        <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span>
                Toggle Signals to Visualize ({activeTrajectories.length} active in graph):
              </span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px]">
              Showing {displayTrajectories.length} of {peakingTrajectories.length} signals
              {searchQuery && ` (matching "${searchQuery}")`}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Cutoff Line: {threshold.toFixed(2)}
          </span>
        </div>

        {/* Interactive Signal Trajectory Pills */}
        {displayTrajectories.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-500 space-y-1">
            <p>No peaking signals matched your current search or filter criteria.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTrendFilter('all');
                setMinScoreFilter(0);
              }}
              className="text-indigo-400 hover:underline font-semibold"
            >
              Reset Search &amp; Filters
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
            {displayTrajectories.map((t) => {
              const key = getPairKey(t);
              const color = keyColorMap.get(key) || '#f43f5e';
              const isSelected = selectedKeys.has(key);
              const isHovered = hoveredKey === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleKey(key)}
                  onMouseEnter={() => setHoveredKey(key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                    isSelected
                      ? isHovered
                        ? 'border-white bg-slate-800 text-white shadow-md ring-1 ring-white/30'
                        : 'border-slate-700 bg-slate-900/90 text-slate-200 hover:bg-slate-800/80'
                      : 'border-slate-800/60 bg-slate-950/40 text-slate-500 hover:text-slate-400 opacity-60'
                  }`}
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: isSelected ? color : '#475569',
                      boxShadow: isSelected ? `0 0 6px ${color}80` : 'none',
                    }}
                  />
                  <span className="font-medium truncate max-w-[210px]">
                    {scope === 'all' ? (
                      <>
                        <span className="text-slate-400 font-mono text-[11px]">{t.drug}: </span>
                        <span>{t.event}</span>
                      </>
                    ) : (
                      t.event
                    )}
                  </span>
                  <span
                    className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold"
                    style={{
                      backgroundColor: isSelected ? `${color}20` : '#1e293b',
                      color: isSelected ? color : '#64748b',
                    }}
                  >
                    {t.peakScore.toFixed(1)}
                  </span>
                  {isSelected ? (
                    <Eye className="h-3 w-3 text-slate-400" />
                  ) : (
                    <EyeOff className="h-3 w-3 text-slate-600" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/90 p-2">
        <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full select-none">
          {/* Horizontal Grid lines */}
          <g className="stroke-slate-800/50" strokeDasharray="3 3">
            {[minScore, threshold, maxScore].map((tick, i) => (
              <line
                key={`ly-${i}`}
                x1={padding.left}
                y1={scaleY(tick)}
                x2={padding.left + innerWidth}
                y2={scaleY(tick)}
              />
            ))}
          </g>

          {/* Threshold Baseline */}
          <line
            x1={padding.left}
            y1={thresholdY}
            x2={padding.left + innerWidth}
            y2={thresholdY}
            stroke="#f59e0b"
            strokeDasharray="6 4"
            strokeWidth="1.8"
            opacity="0.9"
          />
          <text
            x={padding.left + innerWidth - 6}
            y={thresholdY - 6}
            fill="#f59e0b"
            fontSize="10"
            fontWeight="bold"
            textAnchor="end"
            fontFamily="monospace"
          >
            {method} Signal Threshold ({threshold >= 0 ? `≥${threshold.toFixed(2)}` : threshold.toFixed(2)})
          </text>

          {/* Trajectory Lines */}
          {activeTrajectories.map((t) => {
            const key = getPairKey(t);
            const color = keyColorMap.get(key) || '#f43f5e';
            const isHovered = hoveredKey === key;
            const hasHover = hoveredKey !== null;
            const opacity = hasHover ? (isHovered ? 1.0 : 0.25) : 0.85;
            const strokeWidth = isHovered ? 3.5 : 2.0;

            // Build path across sorted time slices
            const slicePointMap = new Map(t.points.map((p) => [p.timeSlice, p]));
            let pathStr = '';
            let isFirstPoint = true;

            allTimeSlices.forEach((slice, i) => {
              const p = slicePointMap.get(slice);
              if (p) {
                const x = scaleX(i);
                const y = scaleY(p.score);
                if (isFirstPoint) {
                  pathStr += `M ${x} ${y}`;
                  isFirstPoint = false;
                } else {
                  pathStr += ` L ${x} ${y}`;
                }
              }
            });

            return (
              <g key={`traj-${key}`} opacity={opacity} className="transition-opacity duration-150">
                {/* Background glow when hovered */}
                {isHovered && (
                  <path
                    d={pathStr}
                    fill="none"
                    stroke={color}
                    strokeWidth="7"
                    strokeLinecap="round"
                    opacity="0.25"
                  />
                )}

                {/* Main trajectory line */}
                <path
                  d={pathStr}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Point nodes */}
                {allTimeSlices.map((slice, i) => {
                  const p = slicePointMap.get(slice);
                  if (!p) return null;
                  const x = scaleX(i);
                  const y = scaleY(p.score);
                  const isFirst = p.timeSlice === t.firstEmergenceSlice;

                  return (
                    <g key={`pt-${key}-${slice}`} className="cursor-pointer">
                      {isFirst && (
                        <circle
                          cx={x}
                          cy={y}
                          r={isHovered ? 8 : 6}
                          fill={color}
                          opacity="0.3"
                          className="animate-pulse"
                        />
                      )}
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? 5 : 3.5}
                        fill={color}
                        stroke="#0f172a"
                        strokeWidth="1.5"
                        onMouseEnter={() => {
                          setHoveredKey(key);
                          setActiveTooltip({
                            x,
                            y,
                            drug: t.drug,
                            event: t.event,
                            point: p,
                            color,
                          });
                        }}
                        onMouseLeave={() => {
                          setActiveTooltip(null);
                        }}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* X Axis rotated ticks & slice labels - Guaranteed non-overlapping */}
          {allTimeSlices.map((slice, i) => {
            if (!visibleSliceSet.has(i)) return null;
            const x = scaleX(i);

            return (
              <g key={`xtick-${slice}`}>
                <line
                  x1={x}
                  y1={padding.top + innerHeight}
                  x2={x}
                  y2={padding.top + innerHeight + 6}
                  stroke="#64748b"
                  strokeWidth="1.2"
                />
                <text
                  x={x}
                  y={padding.top + innerHeight + 16}
                  transform={`rotate(-40, ${x}, ${padding.top + innerHeight + 16})`}
                  fill="#94a3b8"
                  fontSize="9.5"
                  fontWeight="500"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {slice}
                </text>
              </g>
            );
          })}

          {/* X Axis Label */}
          <text
            x={padding.left + innerWidth / 2}
            y={height - 12}
            fill="#cbd5e1"
            fontSize="10.5"
            fontWeight="600"
            textAnchor="middle"
          >
            Temporal Window (Slice)
          </text>

          {/* Y Axis ticks */}
          {[minScore, threshold, maxScore].map((tick, i) => (
            <text
              key={`yt-${i}`}
              x={padding.left - 8}
              y={scaleY(tick) + 3}
              fill="#94a3b8"
              fontSize="10"
              textAnchor="end"
              fontFamily="monospace"
            >
              {tick.toFixed(1)}
            </text>
          ))}

          {/* Axis Labels */}
          <text
            transform="rotate(-90)"
            x={-(padding.top + innerHeight / 2)}
            y="20"
            fill="#cbd5e1"
            fontSize="10.5"
            fontWeight="600"
            textAnchor="middle"
          >
            {method} Disproportionality Score
          </text>
        </svg>

        {/* Hover Tooltip Overlay */}
        {activeTooltip && (
          <div
            className="pointer-events-none absolute z-20 rounded-xl bg-slate-900/95 border border-slate-700 p-2.5 shadow-2xl text-xs backdrop-blur font-mono space-y-1"
            style={{
              left: Math.min(width - 240, Math.max(padding.left, activeTooltip.x - 80)),
              top: Math.max(10, activeTooltip.y - 95),
            }}
          >
            <div className="flex items-center gap-1.5 font-sans font-bold text-white text-xs border-b border-slate-800 pb-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: activeTooltip.color }}
              />
              <span className="truncate max-w-[200px]">
                {activeTooltip.drug} → {activeTooltip.event}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[11px] text-slate-300">
              <span className="text-slate-400">Time Window:</span>
              <span className="text-cyan-300 font-bold">{activeTooltip.point.timeSlice}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[11px] text-slate-300">
              <span className="text-slate-400">{method} Score:</span>
              <span className="text-rose-300 font-bold">{activeTooltip.point.score.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400 text-[10px]">
              <span>Observed (N₁₁): {activeTooltip.point.n11}</span>
              <span>Expected: {activeTooltip.point.expected.toFixed(1)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer & Inspect Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-xs">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-6 bg-amber-400 border border-amber-400 rounded-full" />
            <span>Threshold Baseline ({threshold.toFixed(2)})</span>
          </span>
          <span>•</span>
          <span>Hover lines to isolate individual curves</span>
        </div>

        {onInspectSinglePair && hoveredTrajectory && (
          <button
            type="button"
            onClick={() => onInspectSinglePair(hoveredTrajectory.drug, hoveredTrajectory.event)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-md"
          >
            <span>Inspect Detailed Curve for {hoveredTrajectory.drug} → {hoveredTrajectory.event}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
