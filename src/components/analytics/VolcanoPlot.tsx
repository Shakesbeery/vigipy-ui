import React, { useMemo, useState, useRef, useEffect } from "react";
import { Download, FileImage, ZoomIn, ZoomOut, RotateCcw, Sparkles, Filter, Loader2, RefreshCw } from "lucide-react";
import { VolcanoPoint, VolcanoResponse } from "../../types";
import { fetchVolcanoData } from "../../services/api";
import { exportSvgToFile, exportSvgToPng } from "../../core/chart_export";

interface ZoomDomain {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

interface VolcanoPlotProps {
  activeMethod?: string;
  onSelectSignal: (product: string, adverseEvent: string) => void;
  className?: string;
}

export const VolcanoPlot: React.FC<VolcanoPlotProps> = ({
  activeMethod = "PRR",
  onSelectSignal,
  className = "",
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<VolcanoResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<VolcanoPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>(activeMethod);

  const handlePointHover = (e: React.MouseEvent, pt: VolcanoPoint) => {
    setHoveredPoint(pt);
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const isRight = relX > rect.width * 0.55 || relX > rect.width - 270;
    const posX = isRight ? Math.max(10, relX - 250) : relX + 16;
    const posY = Math.max(10, relY - 45);
    setTooltipPos({ x: posX, y: posY });
  };

  // Zooming state
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoomDomain, setZoomDomain] = useState<ZoomDomain | null>(null);

  const loadData = async (m?: string) => {
    setLoading(true);
    setError(null);
    try {
      const rawM = m || selectedMethod;
      const targetM = rawM.toUpperCase() === "SCORE" ? "score_da" : rawM;
      const res = await fetchVolcanoData(targetM);
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load Volcano plot data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedMethod);
  }, [selectedMethod]);

  const points = useMemo(() => {
    return (data?.points || []).filter(
      (p) => Number.isFinite(p.effect_size) && Number.isFinite(p.neg_log_p)
    );
  }, [data]);

  // Dimensions
  const width = 850;
  const height = 480;
  const padding = { top: 40, right: 40, bottom: 60, left: 70 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Domain computation
  const { minX, maxX, maxY } = useMemo(() => {
    if (points.length === 0) return { minX: -2, maxX: 4, maxY: 6 };
    let mx = -1;
    let Mx = 2;
    let My = 4;
    points.forEach((d) => {
      if (d.effect_size < mx) mx = d.effect_size;
      if (d.effect_size > Mx) Mx = d.effect_size;
      if (d.neg_log_p > My) My = d.neg_log_p;
    });
    return {
      minX: Math.floor(mx - 0.5),
      maxX: Math.ceil(Mx + 0.5),
      maxY: Math.max(5, Math.ceil(My + 1)),
    };
  }, [points]);

  const activeMinX = zoomDomain ? zoomDomain.xMin : minX;
  const activeMaxX = zoomDomain ? zoomDomain.xMax : maxX;
  const activeMinY = zoomDomain ? zoomDomain.yMin : 0;
  const activeMaxY = zoomDomain ? zoomDomain.yMax : maxY;

  const scaleX = (val: number) => {
    const range = activeMaxX - activeMinX || 1;
    return padding.left + ((val - activeMinX) / range) * innerWidth;
  };

  const scaleY = (val: number) => {
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

    if (x2 - x1 > 15 && y2 - y1 > 15) {
      const dataX1 = unscaleX(x1);
      const dataX2 = unscaleX(x2);
      const dataY1 = unscaleY(y2);
      const dataY2 = unscaleY(y1);

      setZoomDomain({
        xMin: Math.min(dataX1, dataX2),
        xMax: Math.max(dataX1, dataX2),
        yMin: Math.max(0, Math.min(dataY1, dataY2)),
        yMax: Math.max(dataY1, dataY2),
      });
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
    setZoomDomain({
      xMin: xMid - xSpan,
      xMax: xMid + xSpan,
      yMin: Math.max(0, yMid - ySpan),
      yMax: yMid + ySpan,
    });
  };

  const handleZoomOut = () => {
    const xSpan = ((activeMaxX - activeMinX) / 2) * 1.5;
    const ySpan = ((activeMaxY - activeMinY) / 2) * 1.5;
    const xMid = (activeMinX + activeMaxX) / 2;
    const yMid = (activeMinY + activeMaxY) / 2;
    setZoomDomain({
      xMin: Math.max(minX - 1, xMid - xSpan),
      xMax: Math.min(maxX + 1, xMid + xSpan),
      yMin: Math.max(0, yMid - ySpan),
      yMax: Math.min(maxY + 2, yMid + ySpan),
    });
  };

  // Threshold lines
  const thresholdEffect = data?.threshold_effect ?? 1.0;
  const thresholdNegLogP = data?.threshold_neg_log_p ?? 1.30103;
  const pThresholdY = scaleY(thresholdNegLogP);
  const effectThresholdX = scaleX(thresholdEffect);

  const signalCount = points.filter((p) => p.alert).length;

  return (
    <div className={`relative w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-5 backdrop-blur shadow-2xl flex flex-col ${className}`}>
      {/* Header & Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse"></span>
              Disproportionality Volcano Plot
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {signalCount} Alerting Signals
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Effect Size vs. Statistical Significance (-log₁₀ p-value). Click any point to inspect signal details. Drag to box-zoom.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Method Selector */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            {["PRR", "ROR", "RFET", "BCPNN", "GPS", "LASSO", "SCORE"].map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMethod(m)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  selectedMethod.toUpperCase() === m
                    ? "bg-indigo-600 text-white font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 gap-0.5">
            <button
              onClick={handleZoomIn}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            {zoomDomain && (
              <button
                onClick={() => setZoomDomain(null)}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-amber-400 hover:bg-slate-800 text-[11px] transition"
                title="Reset Zoom"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2">
            <button
              onClick={() => exportSvgToFile(svgRef.current, `volcano_plot_${selectedMethod.toLowerCase()}`)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
              title="Export vector SVG"
            >
              <Download className="h-3 w-3 text-emerald-400" />
              <span>SVG</span>
            </button>
            <button
              onClick={() => exportSvgToPng(svgRef.current, `volcano_plot_${selectedMethod.toLowerCase()}`)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
              title="Export PNG (300 DPI)"
            >
              <FileImage className="h-3 w-3 text-emerald-400" />
              <span>PNG</span>
            </button>
          </div>
        </div>
      </div>

      {/* Plot Canvas */}
      {loading ? (
        <div className="w-full h-80 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-mono">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span>Generating Volcano plot for {selectedMethod}...</span>
        </div>
      ) : error ? (
        <div className="w-full h-80 flex flex-col items-center justify-center gap-2 text-rose-400 text-xs font-mono">
          <span>{error}</span>
          <button
            onClick={() => loadData(selectedMethod)}
            className="flex items-center gap-1 px-3 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      ) : points.length === 0 ? (
        <div className="w-full h-80 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs font-mono">
          <span>No signals detected or dataset has not been analyzed yet.</span>
          <span className="text-[11px] text-slate-600">Run an analysis first to view the Volcano plot.</span>
        </div>
      ) : (
        <div ref={containerRef} className="relative flex justify-center w-full">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full max-h-[460px] select-none cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {/* Background Grid Lines */}
            {[-2, -1, 0, 1, 2, 3, 4, 5, 6].map((gx) => {
              if (gx < activeMinX || gx > activeMaxX) return null;
              const px = scaleX(gx);
              return (
                <line
                  key={`gx-${gx}`}
                  x1={px}
                  y1={padding.top}
                  x2={px}
                  y2={padding.top + innerHeight}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              );
            })}
            {[1, 2, 3, 4, 5, 6, 8, 10].map((gy) => {
              if (gy < activeMinY || gy > activeMaxY) return null;
              const py = scaleY(gy);
              return (
                <line
                  key={`gy-${gy}`}
                  x1={padding.left}
                  y1={py}
                  x2={padding.left + innerWidth}
                  y2={py}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              );
            })}

            {/* Threshold Lines */}
            {thresholdNegLogP >= activeMinY && thresholdNegLogP <= activeMaxY && (
              <line
                x1={padding.left}
                y1={pThresholdY}
                x2={padding.left + innerWidth}
                y2={pThresholdY}
                stroke="#6366f1"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.8"
              />
            )}
            {thresholdEffect >= activeMinX && thresholdEffect <= activeMaxX && (
              <line
                x1={effectThresholdX}
                y1={padding.top}
                x2={effectThresholdX}
                y2={padding.top + innerHeight}
                stroke="#6366f1"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.8"
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

            {/* X Axis Labels */}
            {[-2, -1, 0, 1, 2, 3, 4, 5, 6].map((val) => {
              if (val < activeMinX || val > activeMaxX) return null;
              return (
                <text
                  key={`xl-${val}`}
                  x={scaleX(val)}
                  y={padding.top + innerHeight + 20}
                  fill="#94a3b8"
                  fontSize="11"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {val}
                </text>
              );
            })}

            {/* Y Axis Labels */}
            {[0, 1, 2, 3, 4, 5, 6, 8, 10].map((val) => {
              if (val < activeMinY || val > activeMaxY) return null;
              return (
                <text
                  key={`yl-${val}`}
                  x={padding.left - 12}
                  y={scaleY(val) + 4}
                  fill="#94a3b8"
                  fontSize="11"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {val}
                </text>
              );
            })}

            {/* Axis Titles */}
            <text
              x={padding.left + innerWidth / 2}
              y={padding.top + innerHeight + 45}
              fill="#cbd5e1"
              fontSize="12"
              fontWeight="600"
              textAnchor="middle"
            >
              Effect Size ({selectedMethod === "BCPNN" ? "Information Component IC" : selectedMethod === "LASSO" ? "Beta Coefficient" : selectedMethod === "SCORE" ? "Residual SER" : "log₂ Ratio"})
            </text>
            <text
              transform={`rotate(-90 ${padding.left - 45} ${padding.top + innerHeight / 2})`}
              x={padding.left - 45}
              y={padding.top + innerHeight / 2}
              fill="#cbd5e1"
              fontSize="12"
              fontWeight="600"
              textAnchor="middle"
            >
              Significance (-log₁₀ p-value)
            </text>

            {/* Data Points */}
            {points.map((pt, i) => {
              const cx = scaleX(pt.effect_size);
              const cy = scaleY(pt.neg_log_p);
              if (cx < padding.left || cx > padding.left + innerWidth || cy < padding.top || cy > padding.top + innerHeight) {
                return null;
              }

              const isHovered = hoveredPoint === pt;
              const isSignal = pt.alert;
              const fill = isHovered
                ? (isSignal ? "#fb7185" : "#94a3b8")
                : (isSignal ? "#f43f5e" : "#475569");
              const r = isHovered
                ? (isSignal ? 7.0 : 5.0)
                : (isSignal ? 4.5 : 2.5);

              return (
                <circle
                  key={`pt-${i}-${pt.product}-${pt.adverse_event}`}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={fill}
                  stroke={isHovered ? "#ffffff" : "none"}
                  strokeWidth={isHovered ? 1.5 : 0}
                  opacity={isHovered ? 1.0 : (isSignal ? 0.9 : 0.4)}
                  className="cursor-pointer"
                  onClick={() => onSelectSignal(pt.product, pt.adverse_event)}
                  onMouseEnter={(e) => handlePointHover(e, pt)}
                  onMouseMove={(e) => handlePointHover(e, pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              );
            })}

            {/* Box Zoom Drag Overlay */}
            {isDragging && dragStart && dragCurrent && (
              <rect
                x={Math.min(dragStart.x, dragCurrent.x)}
                y={Math.min(dragStart.y, dragCurrent.y)}
                width={Math.abs(dragCurrent.x - dragStart.x)}
                height={Math.abs(dragCurrent.y - dragStart.y)}
                fill="rgba(99, 102, 241, 0.15)"
                stroke="#6366f1"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
            )}
          </svg>

          {/* Hover Tooltip */}
          {hoveredPoint && tooltipPos && (
            <div
              className="absolute z-50 pointer-events-none rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-xs text-white shadow-2xl backdrop-blur max-w-xs transition-none"
              style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
            >
              <div className="font-semibold text-slate-100 text-sm">{hoveredPoint.product}</div>
              <div className="text-slate-300 font-medium mb-1.5">{hoveredPoint.adverse_event}</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] font-mono border-t border-slate-800 pt-1.5 text-slate-300">
                <span>Score:</span>
                <span className="text-white font-bold">{hoveredPoint.score}</span>
                <span>Count:</span>
                <span className="text-white">{hoveredPoint.count}</span>
                <span>Effect Size:</span>
                <span className="text-white">{hoveredPoint.effect_size}</span>
                <span>-log₁₀(p):</span>
                <span className="text-white">{hoveredPoint.neg_log_p}</span>
                <span>Status:</span>
                <span className={hoveredPoint.alert ? "text-rose-400 font-bold" : "text-slate-400"}>
                  {hoveredPoint.alert ? "SIGNAL ALERT" : "Non-Signal"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
