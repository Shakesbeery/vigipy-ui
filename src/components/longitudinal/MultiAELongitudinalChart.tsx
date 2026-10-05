import React, { useState, useMemo, useRef, useEffect } from "react";
import { Download, FileImage, TrendingUp, AlertTriangle, Eye, EyeOff, CheckSquare, Square, Layers, Sparkles, Filter, Loader2 } from "lucide-react";
import { LongitudinalSignalItem } from "../../types";
import { fetchLongitudinalTrajectory } from "../../services/api";
import { exportSvgToFile, exportSvgToPng } from "../../core/chart_export";

interface MultiAELongitudinalChartProps {
  signals: LongitudinalSignalItem[];
  activeMethod: string;
  onInspectSignal?: (product: string, adverseEvent: string) => void;
  onSelectTop?: (count: number) => void;
  onClearSelection?: () => void;
  className?: string;
}

const PALETTE = [
  "#f43f5e", // Rose
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#3b82f6", // Blue
  "#14b8a6", // Teal
  "#f97316", // Orange
  "#a855f7", // Purple
  "#6366f1", // Indigo
  "#84cc16", // Lime
];

interface TrajectorySeries {
  product: string;
  adverseEvent: string;
  color: string;
  visible: boolean;
  points: { timestamp: string; score: number | null; alert: boolean }[];
  peakScore: number;
}

export const MultiAELongitudinalChart: React.FC<MultiAELongitudinalChartProps> = ({
  signals,
  activeMethod,
  onInspectSignal,
  onSelectTop,
  onClearSelection,
  className = "",
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [seriesList, setSeriesList] = useState<TrajectorySeries[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);

  // Directly plot the user-selected signals (from table checkboxes)
  const topSignals = useMemo(() => signals, [signals]);

  // Load trajectories for the top signals
  useEffect(() => {
    let isCancelled = false;

    const loadTrajectories = async () => {
      if (topSignals.length === 0) {
        setSeriesList([]);
        return;
      }

      setLoading(true);
      try {
        const fetchedSeries: TrajectorySeries[] = [];
        for (let i = 0; i < topSignals.length; i++) {
          const sig = topSignals[i];
          try {
            const res = await fetchLongitudinalTrajectory(sig.product, sig.adverse_event, activeMethod);
            fetchedSeries.push({
              product: sig.product,
              adverseEvent: sig.adverse_event,
              color: PALETTE[i % PALETTE.length],
              visible: true,
              points: (res.trajectory || []).map((pt) => ({
                timestamp: pt.timestamp,
                score: pt.score,
                alert: pt.alert,
              })),
              peakScore: sig.peak_score ?? 0,
            });
          } catch {
            // Ignore single failure
          }
        }

        if (!isCancelled) {
          setSeriesList(fetchedSeries);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadTrajectories();

    return () => {
      isCancelled = true;
    };
  }, [topSignals, activeMethod]);

  const toggleVisibility = (idx: number) => {
    setSeriesList((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, visible: !s.visible } : s))
    );
  };

  const toggleAll = (visible: boolean) => {
    setSeriesList((prev) => prev.map((s) => ({ ...s, visible })));
  };

  // Dimensions
  const width = 850;
  const height = 440;
  const padding = { top: 30, right: 30, bottom: 65, left: 60 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Extract all timestamps
  const allTimestamps = useMemo(() => {
    const tsSet = new Set<string>();
    seriesList.forEach((s) => {
      s.points.forEach((p) => tsSet.add(p.timestamp));
    });
    return Array.from(tsSet).sort();
  }, [seriesList]);

  // Y Scale bounds
  const { minY, maxY } = useMemo(() => {
    let min = 0.0;
    let max = 2.0;
    seriesList.forEach((s) => {
      if (!s.visible) return;
      s.points.forEach((p) => {
        if (p.score !== null) {
          if (p.score < min) min = p.score;
          if (p.score > max) max = p.score;
        }
      });
    });
    const lower = min < 0 ? Math.floor(min * 1.15) : 0;
    const upper = Math.ceil(max * 1.15);
    return { minY: lower, maxY: upper };
  }, [seriesList]);

  const scaleX = (idx: number) => {
    const count = Math.max(1, allTimestamps.length - 1);
    return padding.left + (idx / count) * innerWidth;
  };

  const scaleY = (val: number) => {
    const range = maxY - minY || 1;
    return padding.top + innerHeight - ((val - minY) / range) * innerHeight;
  };

  return (
    <div className={`relative w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-5 backdrop-blur shadow-2xl flex flex-col ${className}`}>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Comparative Multi-Signal Trajectories
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {seriesList.filter((s) => s.visible).length} / {seriesList.length} Active Lines
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Compares signal evolution across time slices for top alerted pairs. Toggle individual series or click to inspect.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleAll(true)}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700"
          >
            Show All
          </button>
          <button
            onClick={() => toggleAll(false)}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700"
          >
            Hide All
          </button>

          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2">
            <button
              onClick={() => exportSvgToFile(svgRef.current, `multi_signal_longitudinal_${activeMethod.toLowerCase()}`)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
              title="Export vector SVG"
            >
              <Download className="h-3 w-3 text-emerald-400" />
              <span>SVG</span>
            </button>
            <button
              onClick={() => exportSvgToPng(svgRef.current, `multi_signal_longitudinal_${activeMethod.toLowerCase()}`)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
              title="Export PNG (300 DPI)"
            >
              <FileImage className="h-3 w-3 text-emerald-400" />
              <span>PNG</span>
            </button>
          </div>
        </div>
      </div>

      {/* Series Toggles Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
        {seriesList.map((s, idx) => {
          const key = `${s.product}__${s.adverseEvent}`;
          const isHovered = hoveredSeries === key;
          return (
            <button
              key={key}
              onClick={() => toggleVisibility(idx)}
              onMouseEnter={() => setHoveredSeries(key)}
              onMouseLeave={() => setHoveredSeries(null)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
                s.visible
                  ? "bg-slate-800/90 text-white border-slate-700 shadow-sm"
                  : "bg-slate-900/40 text-slate-500 border-slate-800/80 opacity-60"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }}></span>
              <span>{s.product} → {s.adverseEvent}</span>
              {s.visible ? <Eye className="w-3 h-3 text-slate-400 ml-1" /> : <EyeOff className="w-3 h-3 text-slate-600 ml-1" />}
            </button>
          );
        })}
      </div>

      {/* Canvas */}
      {loading ? (
        <div className="w-full h-80 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-mono">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          <span>Loading multi-signal longitudinal trajectories...</span>
        </div>
      ) : seriesList.length === 0 ? (
        <div className="w-full h-80 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs p-6 text-center border border-slate-800/80 rounded-2xl bg-slate-950/40">
          <Layers className="w-8 h-8 text-cyan-400/60 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-200">No Pairs Selected for Multi-Trajectory Plotting</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Check the boxes next to signals in the results table below to plot and compare their trajectory curves simultaneously on this chart.
            </p>
          </div>
          {onSelectTop && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => onSelectTop(3)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
              >
                Select Top 3 Pairs
              </button>
              <button
                onClick={() => onSelectTop(5)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              >
                Select Top 5 Pairs
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="relative flex justify-center w-full overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full max-h-[440px] select-none"
          >
            {/* Grid */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
              const yVal = minY + frac * (maxY - minY);
              const py = scaleY(yVal);
              return (
                <g key={`gy-${frac}`}>
                  <line
                    x1={padding.left}
                    y1={py}
                    x2={padding.left + innerWidth}
                    y2={py}
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padding.left - 10}
                    y={py + 4}
                    fill="#94a3b8"
                    fontSize="10"
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    {yVal.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Zero Baseline when negative range is present */}
            {minY < 0 && (
              <line
                x1={padding.left}
                y1={scaleY(0)}
                x2={padding.left + innerWidth}
                y2={scaleY(0)}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            )}

            {/* Axes */}
            <line
              x1={padding.left}
              y1={padding.top + innerHeight}
              x2={padding.left + innerWidth}
              y2={padding.top + innerHeight}
              stroke="#475569"
              strokeWidth="1.5"
            />
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + innerHeight}
              stroke="#475569"
              strokeWidth="1.5"
            />

            {/* X Labels (Rotated to prevent crowding) */}
            {allTimestamps.map((ts, idx) => {
              const px = scaleX(idx);
              const labelStep = Math.max(1, Math.ceil(allTimestamps.length / 10));
              if (idx % labelStep !== 0 && idx !== allTimestamps.length - 1) return null;

              return (
                <g key={`xl-${ts}`} transform={`translate(${px}, ${padding.top + innerHeight + 15})`}>
                  <text
                    transform="rotate(-35)"
                    x="0"
                    y="0"
                    fill="#94a3b8"
                    fontSize="10"
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    {ts}
                  </text>
                </g>
              );
            })}

            {/* Trajectory Polylines */}
            {seriesList.map((series) => {
              if (!series.visible) return null;
              const key = `${series.product}__${series.adverseEvent}`;
              const isHovered = hoveredSeries === key;

              const validCoords: { x: number; y: number; alert: boolean }[] = [];
              series.points.forEach((pt) => {
                const tsIdx = allTimestamps.indexOf(pt.timestamp);
                if (tsIdx >= 0 && pt.score !== null) {
                  validCoords.push({
                    x: scaleX(tsIdx),
                    y: scaleY(pt.score),
                    alert: pt.alert,
                  });
                }
              });

              if (validCoords.length === 0) return null;
              const pathData = validCoords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");

              return (
                <g
                  key={`path-${key}`}
                  className="cursor-pointer"
                  onClick={() => onInspectSignal && onInspectSignal(series.product, series.adverseEvent)}
                  onMouseEnter={() => setHoveredSeries(key)}
                  onMouseLeave={() => setHoveredSeries(null)}
                >
                  <path
                    d={pathData}
                    fill="none"
                    stroke={series.color}
                    strokeWidth={isHovered ? 3.5 : 2}
                    opacity={hoveredSeries && !isHovered ? 0.3 : 0.9}
                    className="transition-all"
                  />
                  {validCoords.map((c, ci) => (
                    <circle
                      key={`pt-${ci}`}
                      cx={c.x}
                      cy={c.y}
                      r={c.alert ? 4.5 : 3}
                      fill={c.alert ? "#ef4444" : series.color}
                      stroke="#0f172a"
                      strokeWidth="1.5"
                      opacity={hoveredSeries && !isHovered ? 0.3 : 1}
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};
