/**
 * Interactive SVG Forest Plot for Healthcare Surveillance Signals
 * Displays point estimates and 95% Confidence/Credibility intervals with logarithmic scaling.
 * Completely eliminates any overlap between row labels, product names, outcomes, and the "N=" designation.
 */

import React, { useRef } from 'react';
import { Download, FileImage } from 'lucide-react';
import { SignalResult } from '../types/vigipy';
import { exportSvgToFile, exportSvgToPng } from '../core/chart_export';

interface ForestPlotProps {
  signals: SignalResult[];
  onSelectSignal: (signal: SignalResult) => void;
  selectedSignal?: SignalResult | null;
  method: string;
  chartType?: 'forest' | 'volcano';
  onToggleChartType?: (type: 'forest' | 'volcano') => void;
}

export const ForestPlot: React.FC<ForestPlotProps> = ({
  signals,
  onSelectSignal,
  selectedSignal,
  method,
  chartType = 'forest',
  onToggleChartType,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Take top 15 candidate signals
  const topSignals = signals.slice(0, 15);

  if (topSignals.length === 0) {
    return (
      <div className="w-full rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center text-xs text-slate-500 font-mono">
        No disproportionality signals available for {method}. Ingest or upload records to evaluate signals.
      </div>
    );
  }

  const isAdditive = method === 'BCPNN' || method === 'LASSO';
  const nullValue = isAdditive ? 0 : 1;

  // Determine scale range
  let minVal = isAdditive ? -1 : 0.2;
  let maxVal = isAdditive ? 3 : 10;

  topSignals.forEach((s) => {
    if (s.lowerBound < minVal) minVal = Math.max(isAdditive ? -3 : 0.05, s.lowerBound);
    if (s.upperBound > maxVal) maxVal = Math.min(isAdditive ? 8 : 40, s.upperBound);
  });

  const rowHeight = 32;
  // Generous left padding to strictly isolate N= badge, product name, and outcome columns
  const padding = { top: 40, right: 175, bottom: 44, left: 420 };
  const plotWidth = 360;
  const totalWidth = padding.left + plotWidth + padding.right;
  const totalHeight = padding.top + Math.max(1, topSignals.length) * rowHeight + padding.bottom;

  // Coordinate mapping function
  const scaleX = (val: number) => {
    if (val === undefined || isNaN(val)) return padding.left;
    if (isAdditive) {
      const clamped = Math.max(minVal, Math.min(maxVal, val));
      const range = maxVal - minVal || 1;
      return padding.left + ((clamped - minVal) / range) * plotWidth;
    } else {
      const logMin = Math.log(Math.max(0.05, minVal));
      const logMax = Math.log(Math.max(1.1, maxVal));
      const logVal = Math.log(Math.max(0.05, Math.min(maxVal, val)));
      const range = logMax - logMin || 1;
      return padding.left + ((logVal - logMin) / range) * plotWidth;
    }
  };

  const nullX = scaleX(nullValue);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur shadow-xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50"></span>
            Disproportionality Forest Plot
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Ranked candidate signals with point estimate &amp; {method === 'BCPNN' ? '95% Credible Interval' : '95% Confidence Interval'}.
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 font-mono">
            <span>Null Ref: {isAdditive ? '0.0' : '1.0'}</span>
            <span aria-hidden="true">·</span>
            <span>{topSignals.length} candidate pairs</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap">
          {/* On-Graph Forest / Volcano Switcher */}
          {onToggleChartType && (
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => onToggleChartType('forest')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  chartType === 'forest' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Forest Plot
              </button>
              <button
                type="button"
                onClick={() => onToggleChartType('volcano')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  chartType === 'volcano' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Volcano Plot
              </button>
            </div>
          )}

          <button
            onClick={() => exportSvgToFile(svgRef.current, `forest_plot_${method.toLowerCase()}`)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors font-medium"
            title="Download vector graphic (.svg)"
          >
            <Download className="h-3.5 w-3.5 text-cyan-400" />
            <span>SVG</span>
          </button>
          <button
            onClick={() => exportSvgToPng(svgRef.current, `forest_plot_${method.toLowerCase()}`)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors font-medium"
            title="Download high-resolution image (.png)"
          >
            <FileImage className="h-3.5 w-3.5 text-cyan-400" />
            <span>PNG</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="w-full select-none"
          style={{ minWidth: '880px' }}
        >
          <defs>
            {/* SVG ClipPaths to guarantee zero text spillage between lanes */}
            <clipPath id="clip-product-col">
              <rect x="82" y="0" width="144" height={totalHeight} />
            </clipPath>
            <clipPath id="clip-outcome-col">
              <rect x="246" y="0" width="162" height={totalHeight} />
            </clipPath>
          </defs>

          {/* Header Column Labels */}
          <text x="12" y={padding.top - 14} fill="#64748b" fontSize="10" fontWeight="700" textAnchor="start" letterSpacing="0.05em">
            CASES (N₁₁)
          </text>
          <text x="84" y={padding.top - 14} fill="#64748b" fontSize="10" fontWeight="700" textAnchor="start" letterSpacing="0.05em">
            PRODUCT / EXPOSURE
          </text>
          <text x="248" y={padding.top - 14} fill="#64748b" fontSize="10" fontWeight="700" textAnchor="start" letterSpacing="0.05em">
            EVENT / OUTCOME
          </text>
          <text x={padding.left + plotWidth + 14} y={padding.top - 14} fill="#64748b" fontSize="10" fontWeight="700" textAnchor="start" letterSpacing="0.05em">
            ESTIMATE [95% CI]
          </text>

          {/* Reference Null Line */}
          <line
            x1={nullX}
            y1={padding.top - 10}
            x2={nullX}
            y2={padding.top + topSignals.length * rowHeight}
            stroke="#e2e8f0"
            strokeDasharray="4 4"
            strokeWidth="1.5"
            opacity="0.35"
          />

          {/* Top Axis Ticks */}
          {(isAdditive ? [-1, 0, 1, 2, 3, 4] : [0.5, 1, 2, 4, 8, 16]).map((tick) => {
            if (tick < minVal || tick > maxVal) return null;
            const x = scaleX(tick);
            return (
              <g key={`ftick-${tick}`} transform={`translate(${x}, ${padding.top - 8})`}>
                <line y2="-4" stroke="#64748b" />
                <text y="-8" fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Rows */}
          {topSignals.map((s, idx) => {
            const y = padding.top + idx * rowHeight + rowHeight / 2;
            const xEst = scaleX(s.score);
            const xLow = scaleX(s.lowerBound);
            const xHigh = scaleX(s.upperBound);
            const isSelected = selectedSignal?.id === s.id;
            const isSig = s.isSignal;

            const drug = s.drug || 'Unknown';
            const event = s.event || 'Unspecified';
            const shortDrug = drug.length > 18 ? drug.substring(0, 17) + '…' : drug;
            const shortEvent = event.length > 20 ? event.substring(0, 19) + '…' : event;

            return (
              <g
                key={s.id || idx}
                className="cursor-pointer group"
                onClick={() => onSelectSignal(s)}
              >
                {/* Row Hover & Selection Background */}
                <rect
                  x="0"
                  y={y - rowHeight / 2}
                  width={totalWidth}
                  height={rowHeight}
                  fill={isSelected ? '#1e293b' : 'transparent'}
                  className="group-hover:fill-slate-800/40 transition-colors"
                  rx="4"
                />

                {/* 1. N11 count badge: strictly bounded in [x = 10, width = 64] */}
                <rect
                  x="10"
                  y={y - 9}
                  width="64"
                  height="18"
                  rx="4"
                  fill="#090d16"
                  stroke={isSig ? '#be123c' : '#334155'}
                  strokeWidth="1"
                />
                <text
                  x="42"
                  y={y + 3.5}
                  fill={isSig ? '#fda4af' : '#94a3b8'}
                  fontSize="9.5"
                  fontFamily="monospace"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  N={(s.contingency?.n11 ?? 0).toLocaleString()}
                </text>

                {/* 2. Product name: starts at x = 84, clipped to prevent collision with arrow */}
                <g clipPath="url(#clip-product-col)">
                  <text
                    x="84"
                    y={y + 3.5}
                    fill={isSig ? '#fb7185' : '#cbd5e1'}
                    fontSize="11"
                    fontWeight={isSig ? '600' : '400'}
                    textAnchor="start"
                  >
                    <title>{`Product/Exposure: ${s.drug}`}</title>
                    {shortDrug}
                  </text>
                </g>

                {/* Arrow separator: centered at x = 236 */}
                <text x="236" y={y + 3.5} fill="#475569" fontSize="11" textAnchor="middle">
                  →
                </text>

                {/* 3. Event / Outcome name: starts at x = 248, clipped before plot boundary */}
                <g clipPath="url(#clip-outcome-col)">
                  <text
                    x="248"
                    y={y + 3.5}
                    fill="#94a3b8"
                    fontSize="11"
                    textAnchor="start"
                  >
                    <title>{`Event/Outcome: ${s.event}`}</title>
                    {shortEvent}
                  </text>
                </g>

                {/* Error Bar Line */}
                <line
                  x1={xLow}
                  y1={y}
                  x2={xHigh}
                  y2={y}
                  stroke={isSig ? '#fb7185' : '#64748b'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity={isSig ? 0.9 : 0.6}
                />

                {/* End caps */}
                <line
                  x1={xLow}
                  y1={y - 4}
                  x2={xLow}
                  y2={y + 4}
                  stroke={isSig ? '#fb7185' : '#64748b'}
                  strokeWidth="2"
                />
                <line
                  x1={xHigh}
                  y1={y - 4}
                  x2={xHigh}
                  y2={y + 4}
                  stroke={isSig ? '#fb7185' : '#64748b'}
                  strokeWidth="2"
                />

                {/* Point Estimate Marker */}
                <rect
                  x={xEst - 4}
                  y={y - 4}
                  width="8"
                  height="8"
                  fill={isSig ? '#e11d48' : '#475569'}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? 2 : 1}
                  rx="1.5"
                />

                {/* Value text at right: starts at padding.left + plotWidth + 14 */}
                <text
                  x={padding.left + plotWidth + 14}
                  y={y + 3.5}
                  fill={isSig ? '#fda4af' : '#94a3b8'}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight={isSig ? '600' : '400'}
                >
                  {s.formattedScore} {s.formattedInterval}
                </text>
              </g>
            );
          })}

          {/* Bottom Scale Label */}
          <text
            x={padding.left + plotWidth / 2}
            y={totalHeight - 12}
            fill="#94a3b8"
            fontSize="10.5"
            fontWeight="500"
            textAnchor="middle"
          >
            {isAdditive ? 'Estimated Metric Value (Zero = Null Baseline)' : 'Relative Risk / Reporting Ratio (Log Scale, 1.0 = Null)'}
          </text>
        </svg>
      </div>
    </div>
  );
};
