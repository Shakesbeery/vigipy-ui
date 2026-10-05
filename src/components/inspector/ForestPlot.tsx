import React, { useMemo, useState } from "react";
import { MethodSignalInspection } from "../../types";
import { HelpCircle, Info, Scale } from "lucide-react";

interface ForestPlotProps {
  methods: MethodSignalInspection[];
  product?: string;
  adverseEvent?: string;
  className?: string;
}

interface PlotItem {
  method: string;
  metric: string;
  score: number;
  ciLower: number;
  ciUpper: number;
  alert: boolean;
  pValue?: number | null;
  fdr?: number | null;
  displayScore: string;
  displayCi: string;
}

export const ForestPlot: React.FC<ForestPlotProps> = ({
  methods,
  product,
  adverseEvent,
  className = "",
}) => {
  const [scaleType, setScaleType] = useState<"log" | "linear">("log");
  const [hoveredMethod, setHoveredMethod] = useState<PlotItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Filter and normalize methods that have usable numeric scores
  const validItems: PlotItem[] = useMemo(() => {
    return methods
      .filter((m) => m.score !== null && m.score !== undefined && !isNaN(m.score))
      .map((m) => {
        let score = m.score!;
        let lower = m.ci_lower ?? score * 0.8;
        let upper = m.ci_upper ?? score * 1.25;

        // Ensure lower <= upper
        if (lower > upper) {
          const tmp = lower;
          lower = upper;
          upper = tmp;
        }

        return {
          method: m.method,
          metric: m.metric,
          score,
          ciLower: lower,
          ciUpper: upper,
          alert: m.alert,
          pValue: m.p_value,
          fdr: m.fdr,
          displayScore: score >= 100 ? score.toFixed(1) : score >= 1 ? score.toFixed(2) : score.toFixed(3),
          displayCi: `[${lower >= 100 ? lower.toFixed(1) : lower >= 1 ? lower.toFixed(2) : lower.toFixed(3)}, ${
            upper >= 100 ? upper.toFixed(1) : upper >= 1 ? upper.toFixed(2) : upper.toFixed(3)
          }]`,
        };
      });
  }, [methods]);

  // Dimension setup
  const width = 640;
  const rowHeight = 36;
  const marginTop = 35;
  const marginBottom = 45;
  const height = marginTop + validItems.length * rowHeight + marginBottom;

  const leftMargin = 120; // For Method / Metric labels
  const rightMargin = 135; // For numerical interval text
  const plotWidth = width - leftMargin - rightMargin;

  // Domain calculations
  const { minDomain, maxDomain, nullValue } = useMemo(() => {
    if (validItems.length === 0) {
      return { minDomain: 0.1, maxDomain: 10, nullValue: 1.0 };
    }

    if (scaleType === "log") {
      // In log scale, null reference is at 1.0
      // Find all positive values
      const positiveVals: number[] = [];
      validItems.forEach((item) => {
        if (item.score > 0) positiveVals.push(item.score);
        if (item.ciLower > 0) positiveVals.push(item.ciLower);
        if (item.ciUpper > 0) positiveVals.push(item.ciUpper);
      });

      let minVal = positiveVals.length > 0 ? Math.min(...positiveVals, 0.5) : 0.2;
      let maxVal = positiveVals.length > 0 ? Math.max(...positiveVals, 2.0) : 10;

      // Ensure null=1 is nicely framed
      minVal = Math.max(0.1, Math.min(minVal * 0.7, 0.5));
      maxVal = Math.max(maxVal * 1.3, 2.5);

      return { minDomain: minVal, maxDomain: maxVal, nullValue: 1.0 };
    } else {
      // Linear scale
      const allVals: number[] = [];
      validItems.forEach((item) => {
        allVals.push(item.score, item.ciLower, item.ciUpper);
      });
      let minVal = Math.min(...allVals, 0);
      let maxVal = Math.max(...allVals, 2);

      const padding = (maxVal - minVal) * 0.15 || 0.5;
      return {
        minDomain: Math.max(0, minVal - padding),
        maxDomain: maxVal + padding,
        nullValue: 1.0,
      };
    }
  }, [validItems, scaleType]);

  // Scale mapper
  const getX = (val: number): number => {
    if (scaleType === "log") {
      const safeVal = Math.max(minDomain, Math.min(val, maxDomain));
      const logMin = Math.log10(minDomain);
      const logMax = Math.log10(maxDomain);
      const logVal = Math.log10(safeVal);
      const fraction = (logVal - logMin) / (logMax - logMin);
      return leftMargin + fraction * plotWidth;
    } else {
      const safeVal = Math.max(minDomain, Math.min(val, maxDomain));
      const fraction = (safeVal - minDomain) / (maxDomain - minDomain);
      return leftMargin + fraction * plotWidth;
    }
  };

  // Ticks for axis
  const ticks = useMemo(() => {
    if (scaleType === "log") {
      const tickCandidates = [0.1, 0.2, 0.5, 1.0, 2.0, 3.0, 5.0, 10.0, 20.0, 50.0, 100.0];
      return tickCandidates.filter((t) => t >= minDomain && t <= maxDomain);
    } else {
      const count = 5;
      const step = (maxDomain - minDomain) / count;
      const res: number[] = [];
      for (let i = 0; i <= count; i++) {
        res.push(+(minDomain + step * i).toFixed(2));
      }
      return res;
    }
  }, [scaleType, minDomain, maxDomain]);

  const nullX = getX(nullValue);

  return (
    <div className={`relative bg-slate-900/90 rounded-xl border border-slate-800 p-4 shadow-md ${className}`}>
      {/* Header controls & legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white tracking-wide uppercase">
              Method Disproportionality Forest Plot
            </h4>
            <p className="text-[11px] text-slate-400">
              Point estimates & 95% Confidence / Credibility Intervals
            </p>
          </div>
        </div>

        {/* Scale Toggle & Legend */}
        <div className="flex items-center gap-4 text-xs">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shadow-sm shadow-rose-500/50" />
              <span>Alert</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-400" />
              <span>Non-alert</span>
            </div>
          </div>

          {/* Scale Switch */}
          <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
            <button
              onClick={() => setScaleType("log")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                scaleType === "log"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Log Scale
            </button>
            <button
              onClick={() => setScaleType("linear")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                scaleType === "linear"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Linear
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      {validItems.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500">
          No statistical estimates available for forest plot.
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto min-w-[580px] select-none font-sans"
            style={{ shapeRendering: "geometricPrecision" }}
          >
            {/* Background Grid & Axis Lines */}
            <defs>
              <linearGradient id="alertGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="100%" stopColor="#be123c" />
              </linearGradient>
              <linearGradient id="neutralGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>
            </defs>

            {/* Vertical grid lines from ticks */}
            {ticks.map((t) => {
              const tx = getX(t);
              return (
                <g key={`tick-${t}`}>
                  <line
                    x1={tx}
                    y1={marginTop - 8}
                    x2={tx}
                    y2={height - marginBottom}
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray={t === nullValue ? "none" : "2 2"}
                  />
                  {/* Tick Label */}
                  <text
                    x={tx}
                    y={height - marginBottom + 16}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {t}
                  </text>
                </g>
              );
            })}

            {/* Horizontal baseline for X-axis */}
            <line
              x1={leftMargin}
              y1={height - marginBottom}
              x2={leftMargin + plotWidth}
              y2={height - marginBottom}
              stroke="#334155"
              strokeWidth="1"
            />

            {/* Axis description labels */}
            <text
              x={leftMargin + 4}
              y={height - marginBottom + 32}
              textAnchor="start"
              fill="#475569"
              fontSize="9"
              fontStyle="italic"
            >
              ← Favors No Association
            </text>
            <text
              x={leftMargin + plotWidth - 4}
              y={height - marginBottom + 32}
              textAnchor="end"
              fill="#475569"
              fontSize="9"
              fontStyle="italic"
            >
              Increased Reporting Risk →
            </text>

            {/* Header Titles in SVG */}
            <text
              x={leftMargin - 10}
              y={marginTop - 14}
              textAnchor="end"
              fill="#94a3b8"
              fontSize="10"
              fontWeight="600"
              letterSpacing="0.05em"
            >
              METHOD
            </text>
            <text
              x={leftMargin + plotWidth + 20}
              y={marginTop - 14}
              textAnchor="start"
              fill="#94a3b8"
              fontSize="10"
              fontWeight="600"
              letterSpacing="0.05em"
            >
              ESTIMATE [95% CI]
            </text>

            {/* Method Rows */}
            {validItems.map((item, idx) => {
              const y = marginTop + idx * rowHeight + rowHeight / 2;
              const xScore = getX(item.score);
              const xLower = getX(item.ciLower);
              const xUpper = getX(item.ciUpper);
              const isHovered = hoveredMethod?.method === item.method;

              return (
                <g
                  key={item.method}
                  className="cursor-pointer transition-opacity"
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredMethod(item);
                    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                  }}
                  onMouseLeave={() => setHoveredMethod(null)}
                >
                  {/* Row hover highlight background */}
                  <rect
                    x={8}
                    y={y - rowHeight / 2 + 2}
                    width={width - 16}
                    height={rowHeight - 4}
                    rx="6"
                    fill={isHovered ? "rgba(51, 65, 85, 0.4)" : "transparent"}
                    className="transition-colors"
                  />

                  {/* Guide line across plot */}
                  <line
                    x1={leftMargin}
                    y1={y}
                    x2={leftMargin + plotWidth}
                    y2={y}
                    stroke="#1e293b"
                    strokeWidth="0.8"
                    strokeDasharray="2 4"
                  />

                  {/* Left Label: Method Name & Metric */}
                  <text
                    x={leftMargin - 12}
                    y={y - 1}
                    textAnchor="end"
                    fill={item.alert ? "#f1f5f9" : "#cbd5e1"}
                    fontSize="11"
                    fontWeight={item.alert ? "600" : "500"}
                  >
                    {item.method}
                  </text>
                  <text
                    x={leftMargin - 12}
                    y={y + 11}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize="8.5"
                    fontFamily="monospace"
                  >
                    {item.metric}
                  </text>

                  {/* Confidence Interval Error Bar (Line) */}
                  <line
                    x1={xLower}
                    y1={y}
                    x2={xUpper}
                    y2={y}
                    stroke={item.alert ? "#f43f5e" : "#94a3b8"}
                    strokeWidth={isHovered ? "2.5" : "1.75"}
                    strokeLinecap="round"
                    className="transition-all"
                  />

                  {/* Left Cap / Whisker */}
                  <line
                    x1={xLower}
                    y1={y - 5}
                    x2={xLower}
                    y2={y + 5}
                    stroke={item.alert ? "#f43f5e" : "#94a3b8"}
                    strokeWidth="1.5"
                  />

                  {/* Right Cap / Whisker */}
                  <line
                    x1={xUpper}
                    y1={y - 5}
                    x2={xUpper}
                    y2={y + 5}
                    stroke={item.alert ? "#f43f5e" : "#94a3b8"}
                    strokeWidth="1.5"
                  />

                  {/* Point Estimate Marker */}
                  {item.alert ? (
                    /* Diamond marker for alert */
                    <polygon
                      points={`${xScore},${y - 5.5} ${xScore + 5.5},${y} ${xScore},${y + 5.5} ${xScore - 5.5},${y}`}
                      fill="url(#alertGlow)"
                      stroke="#ffe4e6"
                      strokeWidth={isHovered ? "1.5" : "1"}
                      className="filter drop-shadow-[0_0_6px_rgba(244,63,94,0.6)] transition-all"
                    />
                  ) : (
                    /* Circle marker for non-alert */
                    <circle
                      cx={xScore}
                      cy={y}
                      r={isHovered ? 4.5 : 3.5}
                      fill="url(#neutralGlow)"
                      stroke="#cbd5e1"
                      strokeWidth="1"
                    />
                  )}

                  {/* Right Label: Exact Value & Interval */}
                  <text
                    x={leftMargin + plotWidth + 18}
                    y={y + 3.5}
                    textAnchor="start"
                    fill={item.alert ? "#fda4af" : "#94a3b8"}
                    fontSize="10.5"
                    fontFamily="monospace"
                    fontWeight={item.alert ? "600" : "400"}
                  >
                    <tspan fill={item.alert ? "#f43f5e" : "#e2e8f0"} fontWeight="600">
                      {item.displayScore}
                    </tspan>{" "}
                    <tspan fill="#64748b" fontSize="9.5">
                      {item.displayCi}
                    </tspan>
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Floating Hover Tooltip */}
      {hoveredMethod && (
        <div className="mt-3 p-3 rounded-lg bg-slate-950/95 border border-slate-700/80 shadow-xl backdrop-blur text-xs flex flex-wrap items-center justify-between gap-4 transition-all">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                hoveredMethod.alert ? "bg-rose-500 shadow-sm shadow-rose-500/80 animate-pulse" : "bg-slate-500"
              }`}
            />
            <div>
              <span className="font-semibold text-white mr-1.5">{hoveredMethod.method}</span>
              <span className="text-slate-400 font-mono text-[11px]">({hoveredMethod.metric})</span>
            </div>
            <span
              className={`ml-1 text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                hoveredMethod.alert
                  ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {hoveredMethod.alert ? "ALERT THRESHOLD MET" : "NO ALERT"}
            </span>
          </div>

          <div className="flex items-center gap-4 font-mono text-[11px]">
            <div>
              <span className="text-slate-400 mr-1">Estimate:</span>
              <span className="text-white font-semibold">{hoveredMethod.displayScore}</span>
            </div>
            <div>
              <span className="text-slate-400 mr-1">95% CI:</span>
              <span className="text-slate-200">{hoveredMethod.displayCi}</span>
            </div>
            {hoveredMethod.pValue !== null && hoveredMethod.pValue !== undefined && (
              <div>
                <span className="text-slate-400 mr-1">p:</span>
                <span className="text-slate-200">
                  {hoveredMethod.pValue < 0.0001
                    ? hoveredMethod.pValue.toExponential(2)
                    : hoveredMethod.pValue.toFixed(4)}
                </span>
              </div>
            )}
            {hoveredMethod.fdr !== null && hoveredMethod.fdr !== undefined && (
              <div>
                <span className="text-slate-400 mr-1">FDR:</span>
                <span className="text-slate-200">
                  {hoveredMethod.fdr < 0.0001
                    ? hoveredMethod.fdr.toExponential(2)
                    : hoveredMethod.fdr.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
