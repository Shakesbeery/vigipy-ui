/**
 * Interactive SVG Longitudinal Trajectory Chart for Pharmacovigilance
 * Displays signal trajectory over time in cumulative or disjoint mode,
 * highlighting the first emergence point and confidence corridors.
 */

import React, { useState, useMemo, useRef } from 'react';
import { Download, FileImage } from 'lucide-react';
import { TrajectorySummary } from '../types/vigipy';
import { exportSvgToFile, exportSvgToPng } from '../core/chart_export';

interface LongitudinalChartProps {
  trajectory: TrajectorySummary;
  method: string;
  mode: 'cumulative' | 'disjoint';
  expectationModel: string;
  customThreshold?: number;
  thresholdLabel?: string;
}

export const LongitudinalChart: React.FC<LongitudinalChartProps> = ({
  trajectory,
  method,
  mode,
  expectationModel,
  customThreshold,
  thresholdLabel,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const points = trajectory.points;
  const isAdditive = method === 'BCPNN' || method === 'LASSO';
  const defaultThreshold = isAdditive ? (method === 'LASSO' ? 0.05 : 0.0) : 2.0;
  const threshold = customThreshold !== undefined ? customThreshold : defaultThreshold;

  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; point: (typeof points)[0] } | null>(null);

  const width = 820;
  const height = 420;
  const padding = { top: 40, right: 40, bottom: 90, left: 60 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  if (points.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-500">
        No longitudinal data points available for this pair.
      </div>
    );
  }

  // Find min/max for scale
  let minScore = isAdditive ? -0.5 : 0;
  let maxScore = isAdditive ? 2 : 4;
  let maxVolume = 10;

  points.forEach((p) => {
    if (p.upperBound > maxScore) maxScore = p.upperBound;
    if (p.lowerBound < minScore) minScore = p.lowerBound;
    if (p.score > maxScore) maxScore = p.score;
    if (p.n11 > maxVolume) maxVolume = p.n11;
  });

  maxScore = Math.ceil(maxScore * 1.1);
  minScore = Math.floor(minScore);
  if (minScore === maxScore) maxScore = minScore + 5;

  const scaleX = (idx: number) => {
    if (points.length <= 1) return padding.left + innerWidth / 2;
    return padding.left + (idx / (points.length - 1)) * innerWidth;
  };

  const scaleY = (val: number) => {
    return padding.top + innerHeight - ((val - minScore) / (maxScore - minScore)) * innerHeight;
  };

  // Build SVG path strings for trajectory line and confidence ribbon
  let linePath = '';
  let ribbonPath = '';

  points.forEach((p, i) => {
    const x = scaleX(i);
    const y = scaleY(p.score);
    if (i === 0) {
      linePath += `M ${x} ${y}`;
    } else {
      linePath += ` L ${x} ${y}`;
    }
  });

  // Ribbon: forward across upper bounds, backward across lower bounds
  points.forEach((p, i) => {
    const x = scaleX(i);
    const yHigh = scaleY(Math.min(maxScore, Math.max(minScore, p.upperBound)));
    if (i === 0) {
      ribbonPath += `M ${x} ${yHigh}`;
    } else {
      ribbonPath += ` L ${x} ${yHigh}`;
    }
  });

  for (let i = points.length - 1; i >= 0; i--) {
    const x = scaleX(i);
    const yLow = scaleY(Math.min(maxScore, Math.max(minScore, points[i].lowerBound)));
    ribbonPath += ` L ${x} ${yLow}`;
  }
  ribbonPath += ' Z';

  const thresholdY = scaleY(threshold);

  // Guaranteed uncrowded X-axis ticks: spaced at least 70px apart
  const visibleIndices = useMemo(() => {
    if (points.length <= 1) return [0];
    const maxTicks = Math.min(10, Math.max(2, Math.floor(innerWidth / 70)));
    if (points.length <= maxTicks) {
      return points.map((_, i) => i);
    }
    const indices: number[] = [];
    const step = (points.length - 1) / (maxTicks - 1);
    for (let i = 0; i < maxTicks; i++) {
      indices.push(Math.round(i * step));
    }
    return Array.from(new Set(indices));
  }, [points.length, innerWidth]);

  const visibleIndexSet = useMemo(() => new Set(visibleIndices), [visibleIndices]);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur shadow-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-100">
              Longitudinal Surveillance Trajectory: <span className="text-rose-400">{trajectory.drug}</span>
              <span className="text-slate-500 font-normal"> → </span>
              <span className="text-cyan-300">{trajectory.event}</span>
            </h3>
            {trajectory.archetype && (
              <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                trajectory.archetype === 'Emerging Spike' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                trajectory.archetype === 'Chronic Elevation' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
                trajectory.archetype === 'Waning / Transitory' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                Archetype: {trajectory.archetype}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluating signal evolution over {points.length} temporal windows ({mode} mode, {expectationModel} expectation)
            {trajectory.timeToSignal ? ` · ${trajectory.timeToSignal.summaryText}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {trajectory.firstEmergenceSlice && (
            <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-500/30 px-3 py-1.5 rounded-lg text-xs">
              <span className="h-2 w-2 rounded-full bg-rose-400 animate-ping"></span>
              <span className="text-rose-200">
                First Alert: <strong className="text-white font-mono">{trajectory.firstEmergenceSlice}</strong>
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
            <button
              onClick={() => exportSvgToFile(svgRef.current, `trajectory_${trajectory.drug}_${trajectory.event}`.toLowerCase())}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors text-xs font-medium"
              title="Download vector graphic (.svg)"
            >
              <Download className="h-3.5 w-3.5 text-rose-400" />
              <span>SVG</span>
            </button>
            <button
              onClick={() => exportSvgToPng(svgRef.current, `trajectory_${trajectory.drug}_${trajectory.event}`.toLowerCase())}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors text-xs font-medium"
              title="Download high-resolution image (.png)"
            >
              <FileImage className="h-3.5 w-3.5 text-rose-400" />
              <span>PNG</span>
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full select-none">
          {/* Grid lines */}
          <g className="stroke-slate-800/50" strokeDasharray="3 3">
            {[minScore, (minScore + maxScore) / 2, maxScore].map((tick, i) => (
              <line
                key={`ly-${i}`}
                x1={padding.left}
                y1={scaleY(tick)}
                x2={padding.left + innerWidth}
                y2={scaleY(tick)}
              />
            ))}
          </g>

          {/* Volume histogram bars in background */}
          {points.map((p, i) => {
            const x = scaleX(i);
            const barH = (p.n11 / maxVolume) * (innerHeight * 0.35);
            return (
              <rect
                key={`vbar-${i}`}
                x={x - 8}
                y={padding.top + innerHeight - barH}
                width="16"
                height={barH}
                fill="#38bdf8"
                opacity="0.15"
                rx="2"
              />
            );
          })}

          {/* Threshold Baseline */}
          <line
            x1={padding.left}
            y1={thresholdY}
            x2={padding.left + innerWidth}
            y2={thresholdY}
            stroke="#f59e0b"
            strokeDasharray="5 5"
            strokeWidth="1.5"
            opacity="0.8"
          />
          <text
            x={padding.left + innerWidth - 5}
            y={thresholdY - 6}
            fill="#f59e0b"
            fontSize="10"
            fontWeight="bold"
            textAnchor="end"
            fontFamily="monospace"
          >
            {thresholdLabel || `${method} Signal Threshold (${threshold >= 0 ? `≥${threshold.toFixed(2)}` : threshold.toFixed(2)})`}
          </text>

          {/* Confidence corridor ribbon */}
          <path d={ribbonPath} fill="#f43f5e" opacity="0.12" />

          {/* Main Trajectory Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points */}
          {points.map((p, i) => {
            const x = scaleX(i);
            const y = scaleY(p.score);
            const isFirst = p.timeSlice === trajectory.firstEmergenceSlice;

            return (
              <g key={`pt-${i}`} className="group">
                {/* Glow if first emergence */}
                {isFirst && (
                  <circle
                    cx={x}
                    cy={y}
                    r="12"
                    fill="#f43f5e"
                    opacity="0.3"
                    className="animate-pulse"
                  />
                )}

                <circle
                  cx={x}
                  cy={y}
                  r={isFirst ? 6.5 : 4.5}
                  fill={p.isSignal ? '#f43f5e' : '#64748b'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />

                {isFirst && (
                  <g transform={`translate(${x}, ${y - 18})`}>
                    <rect
                      x="-40"
                      y="-16"
                      width="80"
                      height="16"
                      fill="#e11d48"
                      rx="3"
                    />
                    <text
                      y="-5"
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      ALERT EMERGENCE
                    </text>
                  </g>
                )}

                {/* X Axis Tick & Rotated Slice Label (Guaranteed non-overlapping) */}
                {visibleIndexSet.has(i) && (
                  <g key={`xtick-${i}`}>
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
                      {p.timeSlice}
                    </text>
                  </g>
                )}
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
            {method} Metric Value
          </text>
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2 px-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
            <span>Trajectory Estimate ({method})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-4 bg-rose-500/20 border border-rose-500/40 rounded"></span>
            <span>Credibility Interval</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 bg-cyan-400/30 rounded"></span>
            <span>Report Volume (N₁₁)</span>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-500">
          Peak Score: <strong className="text-slate-200">{trajectory.peakScore.toFixed(2)}</strong> ({trajectory.peakSlice}) | Volatility: {trajectory.volatility.toFixed(2)}
        </div>
      </div>
    </div>
  );
};
