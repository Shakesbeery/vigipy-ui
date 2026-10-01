/**
 * Interactive SVG Volcano Plot for Pharmacovigilance Signal Detection
 * Plots Effect Size (log2(Score) or IC) vs Statistical Significance (-log10(p-value))
 * Features threshold quadrant guidelines, hover tooltips, and click-to-inspect.
 */

import React, { useMemo, useState, useRef } from 'react';
import { Download, FileImage, ZoomIn, ZoomOut, RotateCcw, BoxSelect } from 'lucide-react';
import { SignalResult } from '../types/vigipy';
import { exportSvgToFile, exportSvgToPng } from '../core/chart_export';

interface ZoomDomain {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

interface VolcanoPlotProps {
  signals: SignalResult[];
  onSelectSignal: (signal: SignalResult) => void;
  selectedSignal?: SignalResult | null;
  method: string;
  onFilterBySelection?: (signals: SignalResult[]) => void;
  activeSelectionCount?: number;
  onClearSelection?: () => void;
  chartType?: 'volcano' | 'forest';
  onToggleChartType?: (type: 'volcano' | 'forest') => void;
}

export const VolcanoPlot: React.FC<VolcanoPlotProps> = ({
  signals,
  onSelectSignal,
  selectedSignal,
  method,
  onFilterBySelection,
  activeSelectionCount,
  onClearSelection,
  chartType = 'volcano',
  onToggleChartType,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredSignal, setHoveredSignal] = useState<SignalResult | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoomDomain, setZoomDomain] = useState<ZoomDomain | null>(null);

  // Filter signals with valid data
  const plotData = useMemo(() => {
    return signals.map((s) => {
      // Effect size: For BCPNN use IC directly; for ratios use log2(score); for LASSO use score
      let effectSize = 0;
      if (s.method === 'BCPNN') {
        effectSize = s.score;
      } else if (s.method === 'LASSO') {
        effectSize = s.score * 5; // scaled for visibility
      } else if (s.method === 'SCORE' || s.method === 'SCORE_DA') {
        // SCORE-DA: Plot log2(SRR) where SRR >= 2.0x aligns with the 1.0 cutoff line
        const o = s.contingency.n11;
        const e = Math.max(1e-6, s.contingency.expected);
        const srr = e > 0 ? (e + s.score * Math.sqrt(e)) / e : 1.0;
        effectSize = Math.log2(Math.max(0.1, srr));
      } else {
        effectSize = Math.log2(Math.max(0.1, s.score));
      }

      // -log10(p-value)
      const p = s.pValue !== undefined && s.pValue > 0 ? s.pValue : (s.isSignal ? 1e-4 : 0.5);
      const negLogP = -Math.log10(Math.max(1e-12, Math.min(1.0, p)));

      return {
        signal: s,
        effectSize,
        negLogP,
      };
    });
  }, [signals]);

  // Dimensions
  const width = 760;
  const height = 420;

  if (plotData.length === 0) {
    return (
      <div className="w-full rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center text-xs text-slate-500 font-mono">
        No signal data points to plot for {method}. Ingest or upload records to evaluate signals.
      </div>
    );
  }

  const padding = { top: 40, right: 30, bottom: 50, left: 60 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Scales
  const { minX, maxX, maxY } = useMemo(() => {
    if (plotData.length === 0) return { minX: -2, maxX: 4, maxY: 6 };
    let mx = -1;
    let Mx = 2;
    let My = 4;
    plotData.forEach((d) => {
      if (d.effectSize < mx) mx = d.effectSize;
      if (d.effectSize > Mx) Mx = d.effectSize;
      if (d.negLogP > My) My = d.negLogP;
    });
    // add padding
    return {
      minX: Math.floor(mx - 0.5),
      maxX: Math.ceil(Mx + 0.5),
      maxY: Math.max(5, Math.ceil(My + 1)),
    };
  }, [plotData]);

  const activeMinX = zoomDomain ? zoomDomain.xMin : minX;
  const activeMaxX = zoomDomain ? zoomDomain.xMax : maxX;
  const activeMinY = zoomDomain ? zoomDomain.yMin : 0;
  const activeMaxY = zoomDomain ? zoomDomain.yMax : maxY;

  const scaleX = (val: number) => {
    if (val === undefined || isNaN(val)) return padding.left;
    const range = activeMaxX - activeMinX || 1;
    return padding.left + ((val - activeMinX) / range) * innerWidth;
  };
  const scaleY = (val: number) => {
    if (val === undefined || isNaN(val)) return padding.top + innerHeight;
    const range = activeMaxY - activeMinY || 1;
    return padding.top + innerHeight - ((val - activeMinY) / range) * innerHeight;
  };

  const unscaleX = (pixelX: number) => {
    const fraction = (pixelX - padding.left) / innerWidth;
    return activeMinX + fraction * (activeMaxX - activeMinX);
  };
  const unscaleY = (pixelY: number) => {
    const fraction = (padding.top + innerHeight - pixelY) / innerHeight;
    return activeMinY + fraction * (activeMaxY - activeMinY);
  };

  const getSvgCoordinates = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const y = ((e.clientY - rect.top) / rect.height) * height;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const coords = getSvgCoordinates(e);
    if (!coords) return;
    setDragStart(coords);
    setDragCurrent(coords);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    const coords = getSvgCoordinates(e);
    if (coords) setDragCurrent(coords);
  };

  const handleMouseUp = () => {
    if (!isDragging || !dragStart || !dragCurrent) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    const x1 = Math.min(dragStart.x, dragCurrent.x);
    const x2 = Math.max(dragStart.x, dragCurrent.x);
    const y1 = Math.min(dragStart.y, dragCurrent.y);
    const y2 = Math.max(dragStart.y, dragCurrent.y);

    if (x2 - x1 > 12 && y2 - y1 > 12) {
      // Convert pixel box to data coordinates
      const dataX1 = unscaleX(x1);
      const dataX2 = unscaleX(x2);
      const dataY1 = unscaleY(y2); // bottom of box has smaller Y in data coords
      const dataY2 = unscaleY(y1); // top of box has larger Y in data coords

      const newDomain: ZoomDomain = {
        xMin: Math.min(dataX1, dataX2),
        xMax: Math.max(dataX1, dataX2),
        yMin: Math.max(0, Math.min(dataY1, dataY2)),
        yMax: Math.max(dataY1, dataY2),
      };
      setZoomDomain(newDomain);

      // Filter signals visible inside this zoom box and propagate to filter the table above!
      const visible = plotData
        .filter(
          (d) =>
            d.effectSize >= newDomain.xMin &&
            d.effectSize <= newDomain.xMax &&
            d.negLogP >= newDomain.yMin &&
            d.negLogP <= newDomain.yMax
        )
        .map((d) => d.signal);

      if (onFilterBySelection) {
        onFilterBySelection(visible);
      }
    }

    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  const handleZoomIn = () => {
    const xSpan = (activeMaxX - activeMinX) / 2 / 1.5;
    const ySpan = (activeMaxY - activeMinY) / 2 / 1.5;
    const xMid = (activeMinX + activeMaxX) / 2;
    const yMid = (activeMinY + activeMaxY) / 2;
    const newDomain: ZoomDomain = {
      xMin: xMid - xSpan,
      xMax: xMid + xSpan,
      yMin: Math.max(0, yMid - ySpan),
      yMax: yMid + ySpan,
    };
    setZoomDomain(newDomain);
    const visible = plotData
      .filter(
        (d) =>
          d.effectSize >= newDomain.xMin &&
          d.effectSize <= newDomain.xMax &&
          d.negLogP >= newDomain.yMin &&
          d.negLogP <= newDomain.yMax
      )
      .map((d) => d.signal);
    if (onFilterBySelection) {
      onFilterBySelection(visible);
    }
  };

  const handleZoomOut = () => {
    const xSpan = ((activeMaxX - activeMinX) / 2) * 1.5;
    const ySpan = ((activeMaxY - activeMinY) / 2) * 1.5;
    const xMid = (activeMinX + activeMaxX) / 2;
    const yMid = (activeMinY + activeMaxY) / 2;
    const newDomain: ZoomDomain = {
      xMin: Math.max(minX - 1, xMid - xSpan),
      xMax: Math.min(maxX + 1, xMid + xSpan),
      yMin: Math.max(0, yMid - ySpan),
      yMax: Math.min(maxY + 2, yMid + ySpan),
    };
    setZoomDomain(newDomain);
    const visible = plotData
      .filter(
        (d) =>
          d.effectSize >= newDomain.xMin &&
          d.effectSize <= newDomain.xMax &&
          d.negLogP >= newDomain.yMin &&
          d.negLogP <= newDomain.yMax
      )
      .map((d) => d.signal);
    if (onFilterBySelection) {
      onFilterBySelection(visible);
    }
  };

  const handleResetZoom = () => {
    setZoomDomain(null);
    if (onClearSelection) {
      onClearSelection();
    }
  };

  // Threshold lines
  const pThresholdY = scaleY(-Math.log10(0.05)); // -log10(0.05) ~ 1.301
  const effectThresholdX = scaleX(method === 'BCPNN' ? 0.0 : 1.0); // log2(2) = 1.0 or IC = 0

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur shadow-xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse"></span>
            Disproportionality Volcano Plot
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Effect Size vs. Statistical Significance (-log₁₀ p-value). Drag mouse to box-zoom and filter table.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs flex-wrap">
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

          {/* Interactive Zoom In / Zoom Out / Reset Controls */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 gap-0.5">
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Zoom in on plot"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            {(zoomDomain !== null || (activeSelectionCount !== undefined && activeSelectionCount > 0)) && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-amber-400 hover:text-amber-300 hover:bg-slate-800 text-[11px] transition-colors"
                title="Reset zoom and table filter"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {(zoomDomain !== null || (activeSelectionCount !== undefined && activeSelectionCount > 0)) && (
            <div className="flex items-center gap-1.5 bg-indigo-950/60 border border-indigo-500/40 px-2.5 py-1 rounded-lg text-indigo-300">
              <span className="font-mono font-semibold">
                {activeSelectionCount !== undefined && activeSelectionCount > 0
                  ? `${activeSelectionCount} visible in zoom / filtered`
                  : 'Zoomed View'}
              </span>
              <button
                type="button"
                onClick={handleResetZoom}
                className="ml-1 text-[10px] uppercase font-bold text-slate-400 hover:text-white underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
              <span>Signal</span>
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-600"></span>
              <span>Non-Signal</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
            <button
              onClick={() => exportSvgToFile(svgRef.current, `volcano_plot_${method.toLowerCase()}`)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors font-medium"
              title="Download vector graphic (.svg)"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              <span>SVG</span>
            </button>
            <button
              onClick={() => exportSvgToPng(svgRef.current, `volcano_plot_${method.toLowerCase()}`)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors font-medium"
              title="Download high-resolution image (.png)"
            >
              <FileImage className="h-3.5 w-3.5 text-emerald-400" />
              <span>PNG</span>
            </button>
          </div>
        </div>
      </div>

      <div className="relative flex justify-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-h-[440px] select-none cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Active Marquee Brushing Selection Rectangle */}
          {isDragging && dragStart && dragCurrent && (
            <rect
              x={Math.min(dragStart.x, dragCurrent.x)}
              y={Math.min(dragStart.y, dragCurrent.y)}
              width={Math.abs(dragCurrent.x - dragStart.x)}
              height={Math.abs(dragCurrent.y - dragStart.y)}
              fill="#6366f1"
              fillOpacity="0.2"
              stroke="#818cf8"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              className="pointer-events-none"
            />
          )}

          {/* Grid lines */}
          <g className="stroke-slate-800/60" strokeDasharray="3 3">
            {[0, 2, 4, 6, 8, 10].map((y) => {
              if (y > maxY) return null;
              return (
                <line
                  key={`gy-${y}`}
                  x1={padding.left}
                  y1={scaleY(y)}
                  x2={padding.left + innerWidth}
                  y2={scaleY(y)}
                />
              );
            })}
            {[-2, 0, 2, 4, 6].map((x) => {
              if (x < minX || x > maxX) return null;
              return (
                <line
                  key={`gx-${x}`}
                  x1={scaleX(x)}
                  y1={padding.top}
                  x2={scaleX(x)}
                  y2={padding.top + innerHeight}
                />
              );
            })}
          </g>

          {/* Significance Threshold (p = 0.05) */}
          <line
            x1={padding.left}
            y1={pThresholdY}
            x2={padding.left + innerWidth}
            y2={pThresholdY}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            strokeWidth="1.5"
            opacity="0.75"
          />
          <text
            x={padding.left + innerWidth - 5}
            y={pThresholdY - 6}
            fill="#f59e0b"
            fontSize="10"
            textAnchor="end"
            fontWeight="500"
          >
            p = 0.05 Threshold
          </text>

          {/* Effect Size Threshold (PRR >= 2 or IC >= 0) */}
          <line
            x1={effectThresholdX}
            y1={padding.top}
            x2={effectThresholdX}
            y2={padding.top + innerHeight}
            stroke="#3b82f6"
            strokeDasharray="4 4"
            strokeWidth="1.5"
            opacity="0.75"
          />
          <text
            x={effectThresholdX + 6}
            y={padding.top + 14}
            fill="#60a5fa"
            fontSize="10"
            fontWeight="500"
          >
            {method === 'BCPNN'
              ? 'IC = 0.0 Cutoff'
              : method === 'LASSO'
              ? 'β = 0.0 Cutoff'
              : method === 'SCORE' || method === 'SCORE_DA'
              ? 'log₂(SRR) = 1.0 (2x Cutoff)'
              : 'log₂(Score) = 1.0 (2x)'}
          </text>

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

          {/* X Axis Labels */}
          {[-2, -1, 0, 1, 2, 3, 4, 5, 6].map((tick) => {
            if (tick < minX || tick > maxX) return null;
            return (
              <g key={`xtick-${tick}`} transform={`translate(${scaleX(tick)}, ${padding.top + innerHeight})`}>
                <line y2="5" stroke="#64748b" />
                <text y="18" fill="#94a3b8" fontSize="10" textAnchor="middle">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Y Axis Labels */}
          {[0, 2, 4, 6, 8, 10].map((tick) => {
            if (tick > maxY) return null;
            return (
              <g key={`ytick-${tick}`} transform={`translate(${padding.left}, ${scaleY(tick)})`}>
                <line x2="-5" stroke="#64748b" />
                <text x="-8" y="3" fill="#94a3b8" fontSize="10" textAnchor="end">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Axis Titles */}
          <text
            x={padding.left + innerWidth / 2}
            y={height - 12}
            fill="#cbd5e1"
            fontSize="11"
            fontWeight="600"
            textAnchor="middle"
          >
            {method === 'BCPNN' ? 'Information Component (IC)' : 'Log₂ Effect Size (Disproportionality)'}
          </text>
          <text
            transform={`rotate(-90)`}
            x={-(padding.top + innerHeight / 2)}
            y="20"
            fill="#cbd5e1"
            fontSize="11"
            fontWeight="600"
            textAnchor="middle"
          >
            -Log₁₀ (p-value)
          </text>

          {/* Scatter Points */}
          {plotData.map((d, i) => {
            const cx = scaleX(d.effectSize);
            const cy = scaleY(d.negLogP);
            const isSelected = selectedSignal?.id === d.signal.id;
            const isHovered = hoveredSignal?.id === d.signal.id;
            const isSig = d.signal.isSignal;

            return (
              <g
                key={d.signal.id || i}
                className="cursor-pointer transition-transform duration-150"
                onClick={() => onSelectSignal(d.signal)}
                onMouseEnter={(e) => {
                  setHoveredSignal(d.signal);
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                }}
                onMouseLeave={() => {
                  setHoveredSignal(null);
                  setTooltipPos(null);
                }}
              >
                {/* Glow ring if selected */}
                {(isSelected || isHovered) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSig ? 11 : 8}
                    fill={isSig ? '#f43f5e' : '#38bdf8'}
                    opacity="0.3"
                    className="animate-pulse"
                  />
                )}

                <circle
                  cx={cx}
                  cy={cy}
                  r={isSig ? 6 : 4}
                  fill={isSig ? (isSelected ? '#ff0055' : '#f43f5e') : '#64748b'}
                  stroke={isSelected ? '#ffffff' : isSig ? '#fda4af' : '#334155'}
                  strokeWidth={isSelected ? 2 : 1}
                  opacity={isSig ? 0.95 : 0.6}
                />

                {/* Direct Label for Top Signals */}
                {isSig && d.signal.contingency.n11 >= 25 && (
                  <text
                    x={cx + 8}
                    y={cy + 3}
                    fill="#fecdd3"
                    fontSize="9.5"
                    fontWeight="500"
                    className="pointer-events-none drop-shadow"
                  >
                    {d.signal.drug.split(' ')[0]} - {d.signal.event.length > 16 ? d.signal.event.substring(0, 15) + '…' : d.signal.event}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredSignal && (
          <div className="pointer-events-none absolute bottom-4 right-4 z-20 max-w-sm rounded-lg border border-slate-700 bg-slate-950/95 p-3 text-xs shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <span className="font-semibold text-rose-300">{hoveredSignal.drug}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${hoveredSignal.isSignal ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-800 text-slate-400'}`}>
                {hoveredSignal.isSignal ? 'SDR Signal' : 'Background'}
              </span>
            </div>
            <p className="font-medium text-slate-200 mb-1">{hoveredSignal.event}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-400">
              <div>Method: <span className="text-slate-200 font-mono">{hoveredSignal.method}</span></div>
              <div>Score: <span className="text-slate-200 font-mono">{hoveredSignal.formattedScore}</span></div>
              <div>Interval: <span className="text-slate-200 font-mono">{hoveredSignal.formattedInterval}</span></div>
              <div>Observed (N₁₁): <span className="text-slate-200 font-mono">{hoveredSignal.contingency.n11}</span></div>
              <div>Expected (E): <span className="text-slate-200 font-mono">{hoveredSignal.contingency.expected.toFixed(1)}</span></div>
              <div>p-value: <span className="text-slate-200 font-mono">{hoveredSignal.pValue !== undefined ? (hoveredSignal.pValue < 0.001 ? hoveredSignal.pValue.toExponential(2) : hoveredSignal.pValue.toFixed(4)) : '—'}</span></div>
            </div>
            <div className="mt-2 text-[10px] text-cyan-400 italic">Click point to view 2x2 contingency matrix</div>
          </div>
        )}
      </div>
    </div>
  );
};
