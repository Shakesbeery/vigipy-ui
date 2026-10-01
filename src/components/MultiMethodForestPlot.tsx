/**
 * Multi-Method Comparative Forest Plot for a Single (Product, Event) Signal
 * Visually compares point estimates, 95% Confidence/Credibility intervals,
 * and decision thresholds across all evaluated analysis methods (PRR, ROR, RFET, BCPNN, GPS, LASSO).
 *
 * Implements strict spatial separation between method status columns, plot area,
 * axes, tick labels, and score columns to prevent visual overlaps.
 */

import React from 'react';
import { ConsensusSignal, MethodVoteDetail } from '../types/vigipy';

interface MultiMethodForestPlotProps {
  consensusSignal: ConsensusSignal;
}

export const MultiMethodForestPlot: React.FC<MultiMethodForestPlotProps> = ({
  consensusSignal,
}) => {
  const votes = consensusSignal.methodVotes || [];
  if (votes.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-slate-500 font-mono">
        No active method breakdown data available.
      </div>
    );
  }

  const rowHeight = 38;
  const padding = { top: 68, right: 260, bottom: 54, left: 220 };
  const plotWidth = 380;
  const totalWidth = padding.left + plotWidth + padding.right; // 860px
  const totalHeight = padding.top + votes.length * rowHeight + padding.bottom;

  // Determine dynamic bounds on fold-excess scale (1.0 = Threshold)
  let minFold = 0.2;
  let maxFold = 5.0;

  votes.forEach((v) => {
    if (v.foldExcess > maxFold) maxFold = Math.min(25, v.foldExcess * 1.25);
    if (v.foldExcess < minFold) minFold = Math.max(0.05, v.foldExcess * 0.75);
  });

  const logMin = Math.log(Math.max(0.05, minFold));
  const logMax = Math.log(Math.max(2.0, maxFold));

  const scaleX = (val: number) => {
    const clamped = Math.max(0.05, Math.min(maxFold, val));
    const logVal = Math.log(clamped);
    return padding.left + ((logVal - logMin) / (logMax - logMin)) * plotWidth;
  };

  const clampPlotX = (x: number) => {
    return Math.max(padding.left + 2, Math.min(padding.left + plotWidth - 2, x));
  };

  const thresholdX = scaleX(1.0); // 1.0 represents the exact decision threshold
  const ticks = [0.25, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0].filter(
    (t) => t >= minFold * 0.9 && t <= maxFold * 1.1
  );

  const plotBottom = padding.top + votes.length * rowHeight;

  return (
    <div className="w-full bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 space-y-3">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-400"></span>
          <h5 className="text-xs font-bold text-slate-100">
            Multi-Method Forest Plot: <span className="text-rose-300">{consensusSignal.drug}</span> → <span className="text-slate-200">{consensusSignal.event}</span>
          </h5>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded text-cyan-300">
            Dashed Line (1.0x) = Method Signal Cutoff
          </span>
          <span className="px-2.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
            {consensusSignal.votingRatio} Methods Voted SDR
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="w-full select-none"
          style={{ minWidth: '760px', height: 'auto' }}
        >
          {/* ============================================================ */}
          {/* ZONE 1: COLUMN HEADERS (y = 22)                              */}
          {/* ============================================================ */}
          <text
            x="16"
            y="22"
            fill="#94a3b8"
            fontSize="10"
            fontWeight="700"
            letterSpacing="0.05em"
            textAnchor="start"
          >
            METHOD
          </text>
          <text
            x="144"
            y="22"
            fill="#94a3b8"
            fontSize="10"
            fontWeight="700"
            letterSpacing="0.05em"
            textAnchor="middle"
          >
            DECISION STATUS
          </text>
          <text
            x={padding.left + plotWidth / 2}
            y="22"
            fill="#94a3b8"
            fontSize="10"
            fontWeight="700"
            letterSpacing="0.05em"
            textAnchor="middle"
          >
            MARGIN RELATIVE TO SIGNAL THRESHOLD (1.0x)
          </text>
          <text
            x={padding.left + plotWidth + 24}
            y="22"
            fill="#94a3b8"
            fontSize="10"
            fontWeight="700"
            letterSpacing="0.05em"
            textAnchor="start"
          >
            POINT ESTIMATE [95% CI] (EXCESS)
          </text>

          {/* ============================================================ */}
          {/* ZONE 2: TOP AXIS & TICKS (y = 40 to 52)                      */}
          {/* ============================================================ */}
          {/* Plot domain top line */}
          <line
            x1={padding.left}
            y1="52"
            x2={padding.left + plotWidth}
            y2="52"
            stroke="#334155"
            strokeWidth="1"
          />

          {/* Top Ticks and Labels */}
          {ticks.map((tick) => {
            const x = scaleX(tick);
            const isThreshold = Math.abs(tick - 1.0) < 0.001;

            return (
              <g key={`top-tick-${tick}`}>
                <line
                  x1={x}
                  y1={isThreshold ? 44 : 48}
                  x2={x}
                  y2="52"
                  stroke={isThreshold ? '#38bdf8' : '#475569'}
                  strokeWidth={isThreshold ? 1.5 : 1}
                />
                <text
                  x={x}
                  y="42"
                  fill={isThreshold ? '#38bdf8' : '#94a3b8'}
                  fontSize={isThreshold ? '9.5' : '9'}
                  fontWeight={isThreshold ? '700' : '500'}
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {isThreshold ? '1.0x (Cutoff)' : `${tick}x`}
                </text>
              </g>
            );
          })}

          {/* Background Reference Grid & Threshold Line */}
          {ticks.map((tick) => {
            if (Math.abs(tick - 1.0) < 0.001) return null;
            const x = scaleX(tick);
            return (
              <line
                key={`grid-${tick}`}
                x1={x}
                y1="52"
                x2={x}
                y2={plotBottom}
                stroke="#1e293b"
                strokeDasharray="2 4"
                strokeWidth="1"
                opacity="0.8"
              />
            );
          })}

          {/* Critical Threshold Reference Line (1.0x) */}
          <line
            x1={thresholdX}
            y1="52"
            x2={thresholdX}
            y2={plotBottom + 6}
            stroke="#38bdf8"
            strokeDasharray="3 3"
            strokeWidth="1.5"
            opacity="0.75"
          />

          {/* ============================================================ */}
          {/* ZONE 3: METHOD ROWS (y >= 68)                                */}
          {/* ============================================================ */}
          {votes.map((v, idx) => {
            const y = padding.top + idx * rowHeight + rowHeight / 2;
            const xEst = clampPlotX(scaleX(v.foldExcess));

            // Compute lower and upper fold excess bounds for error bar
            let lowFold = v.foldExcess;
            let highFold = v.foldExcess;
            if (v.threshold > 0) {
              lowFold = Math.max(0.01, v.lowerBound / v.threshold);
              highFold = Math.max(0.01, v.upperBound / v.threshold);
            } else {
              lowFold = Math.max(0.01, Math.pow(2, v.lowerBound - v.threshold));
              highFold = Math.max(0.01, Math.pow(2, v.upperBound - v.threshold));
            }

            const xLow = clampPlotX(scaleX(lowFold));
            const xHigh = clampPlotX(scaleX(highFold));
            const isSig = v.isSignal;

            return (
              <g key={v.method} className="group">
                {/* Row Hover Background */}
                <rect
                  x="8"
                  y={y - rowHeight / 2}
                  width={totalWidth - 16}
                  height={rowHeight}
                  fill="transparent"
                  className="group-hover:fill-slate-800/30 transition-colors"
                  rx="6"
                />

                {/* Sub-grid row separator */}
                <line
                  x1="12"
                  y1={y + rowHeight / 2}
                  x2={totalWidth - 12}
                  y2={y + rowHeight / 2}
                  stroke="#1e293b"
                  strokeWidth="0.75"
                  opacity="0.6"
                />

                {/* Method Name Badge [x = 16 to 84] */}
                <rect
                  x="16"
                  y={y - 11}
                  width="68"
                  height="22"
                  rx="5"
                  fill={isSig ? '#4c0519' : '#0f172a'}
                  stroke={isSig ? '#f43f5e' : '#334155'}
                  strokeWidth="1"
                />
                <text
                  x="50"
                  y={y + 3.5}
                  fill={isSig ? '#fda4af' : '#cbd5e1'}
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {v.method}
                </text>

                {/* Decision Status Pill [x = 92 to 197] (Leaves 23px gap before plot at x = 220) */}
                <rect
                  x="92"
                  y={y - 10}
                  width="105"
                  height="20"
                  rx="4"
                  fill={isSig ? '#881337' : '#0f172a'}
                  stroke={isSig ? '#fb7185' : '#1e293b'}
                  strokeWidth="1"
                  opacity={isSig ? 0.9 : 0.8}
                />
                <text
                  x="144.5"
                  y={y + 3.5}
                  fill={isSig ? '#fecdd3' : '#64748b'}
                  fontSize="9.5"
                  fontWeight={isSig ? '700' : '500'}
                  textAnchor="middle"
                >
                  {isSig ? 'VOTED SDR ✓' : 'Sub-threshold'}
                </text>

                {/* Error Bar Line [inside x = 220 to 600] */}
                <line
                  x1={Math.min(xLow, xHigh)}
                  y1={y}
                  x2={Math.max(xLow, xHigh)}
                  y2={y}
                  stroke={isSig ? '#fb7185' : '#64748b'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity={isSig ? 0.95 : 0.65}
                />

                {/* End caps */}
                <line
                  x1={xLow}
                  y1={y - 5}
                  x2={xLow}
                  y2={y + 5}
                  stroke={isSig ? '#fb7185' : '#64748b'}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1={xHigh}
                  y1={y - 5}
                  x2={xHigh}
                  y2={y + 5}
                  stroke={isSig ? '#fb7185' : '#64748b'}
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* Point Estimate Marker */}
                <rect
                  x={xEst - 4.5}
                  y={y - 4.5}
                  width="9"
                  height="9"
                  fill={isSig ? '#e11d48' : '#475569'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  rx="2"
                />

                {/* Value text at right [x >= 625] */}
                <text
                  x={padding.left + plotWidth + 24}
                  y={y + 3.5}
                  fill={isSig ? '#fda4af' : '#cbd5e1'}
                  fontSize="10.5"
                  fontFamily="monospace"
                  fontWeight={isSig ? '600' : '400'}
                >
                  <tspan fontWeight="bold" fill={isSig ? '#ffffff' : '#94a3b8'}>
                    {v.formattedScore}
                  </tspan>
                  <tspan fill="#64748b"> {v.formattedInterval} </tspan>
                  <tspan fill={isSig ? '#f43f5e' : '#64748b'} fontWeight="600">
                    ({v.foldExcess.toFixed(2)}x)
                  </tspan>
                </text>
              </g>
            );
          })}

          {/* ============================================================ */}
          {/* ZONE 4: BOTTOM AXIS & TICKS (y >= plotBottom + 8)             */}
          {/* ============================================================ */}
          <line
            x1={padding.left}
            y1={plotBottom + 8}
            x2={padding.left + plotWidth}
            y2={plotBottom + 8}
            stroke="#334155"
            strokeWidth="1"
          />

          {ticks.map((tick) => {
            const x = scaleX(tick);
            const isThreshold = Math.abs(tick - 1.0) < 0.001;

            return (
              <g key={`bot-tick-${tick}`}>
                <line
                  x1={x}
                  y1={plotBottom + 8}
                  x2={x}
                  y2={plotBottom + (isThreshold ? 15 : 12)}
                  stroke={isThreshold ? '#38bdf8' : '#475569'}
                  strokeWidth={isThreshold ? 1.5 : 1}
                />
                <text
                  x={x}
                  y={plotBottom + 23}
                  fill={isThreshold ? '#38bdf8' : '#94a3b8'}
                  fontSize={isThreshold ? '9.5' : '9'}
                  fontWeight={isThreshold ? '700' : '500'}
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {tick}x
                </text>
              </g>
            );
          })}

          {/* Bottom axis title */}
          <text
            x={padding.left + plotWidth / 2}
            y={totalHeight - 12}
            fill="#94a3b8"
            fontSize="10"
            fontWeight="500"
            textAnchor="middle"
          >
            Normalized Signal Margin: Values &gt; 1.0x denote signal threshold exceeded
          </text>
        </svg>
      </div>
    </div>
  );
};
