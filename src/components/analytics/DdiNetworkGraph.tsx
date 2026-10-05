import React, { useState, useMemo, useEffect, useRef } from "react";
import { Download, FileImage, Sparkles, Filter, Activity, Layers, Info, X, Loader2, RefreshCw } from "lucide-react";
import { DDIEdge, DDINetworkResponse } from "../../types";
import { fetchDdiNetwork } from "../../services/api";
import { exportSvgToFile, exportSvgToPng } from "../../core/chart_export";

interface DdiNetworkGraphProps {
  onSelectPair?: (drug: string, event: string) => void;
  className?: string;
}

const ARCHETYPE_COLORS: Record<string, { stroke: string; badge: string }> = {
  EMERGENT: { stroke: "#ef4444", badge: "bg-red-500/20 text-red-400 border-red-500/30" },
  POTENTIATED: { stroke: "#f97316", badge: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  TWO_HIT: { stroke: "#eab308", badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  MULTI_HIT: { stroke: "#8b5cf6", badge: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
};

export const DdiNetworkGraph: React.FC<DdiNetworkGraphProps> = ({ onSelectPair, className = "" }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [data, setData] = useState<DDINetworkResponse | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string>("ALL");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<DDIEdge | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const loadData = async (ev?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDdiNetwork(ev === "ALL" ? undefined : ev);
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load DDI network data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedEvent);
  }, [selectedEvent]);

  const edges = data?.edges || [];
  const uniqueEvents = data?.unique_events || [];

  // Filter edges based on selected node if any
  const filteredEdges = useMemo(() => {
    if (!selectedNode) return edges;
    return edges.filter((e) => e.drug_a === selectedNode || e.drug_b === selectedNode);
  }, [edges, selectedNode]);

  // Derive unique nodes in filtered view
  const nodes = useMemo(() => {
    const nodeSet = new Set<string>();
    filteredEdges.forEach((e) => {
      nodeSet.add(e.drug_a);
      nodeSet.add(e.drug_b);
    });
    return Array.from(nodeSet);
  }, [filteredEdges]);

  // Layout positions on circle
  const width = 850;
  const height = 500;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.38;

  const nodePositions = useMemo(() => {
    const posMap = new Map<string, { x: number; y: number }>();
    const count = nodes.length;
    nodes.forEach((node, idx) => {
      const angle = (idx / Math.max(1, count)) * 2 * Math.PI - Math.PI / 2;
      posMap.set(node, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });
    return posMap;
  }, [nodes, cx, cy, radius]);

  return (
    <div className={`relative w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-5 backdrop-blur shadow-2xl flex flex-col ${className}`}>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              SCORE-DDI Multi-Drug Interaction Network
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              {filteredEdges.length} Interaction Edges
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Discovers multi-drug synergistic combinations. Node-link clustering color-coded by interaction archetype.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Target Event Filter */}
          {uniqueEvents.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Target Event:</span>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-purple-500"
              >
                <option value="ALL">All Adverse Events</option>
                {uniqueEvents.map((ev) => (
                  <option key={ev} value={ev}>
                    {ev}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reset Selection */}
          {selectedNode && (
            <button
              onClick={() => setSelectedNode(null)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs border border-slate-700 transition"
            >
              <X className="w-3 h-3" />
              <span>Clear Filter</span>
            </button>
          )}

          {/* Export */}
          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2">
            <button
              onClick={() => exportSvgToFile(svgRef.current, "ddi_interaction_network")}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
              title="Export vector SVG"
            >
              <Download className="h-3 w-3 text-emerald-400" />
              <span>SVG</span>
            </button>
            <button
              onClick={() => exportSvgToPng(svgRef.current, "ddi_interaction_network")}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
              title="Export PNG (300 DPI)"
            >
              <FileImage className="h-3 w-3 text-emerald-400" />
              <span>PNG</span>
            </button>
          </div>
        </div>
      </div>

      {/* Archetype Legend */}
      <div className="flex items-center gap-4 text-xs mb-3 flex-wrap bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
        <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Archetypes:</span>
        {Object.entries(ARCHETYPE_COLORS).map(([arch, info]) => (
          <div key={arch} className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full" style={{ backgroundColor: info.stroke }}></span>
            <span className="text-slate-300 text-[11px] font-mono">{arch}</span>
          </div>
        ))}
      </div>

      {/* SVG Canvas */}
      {loading ? (
        <div className="w-full h-96 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-mono">
          <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
          <span>Mining multi-drug interactions across clinical cohort...</span>
        </div>
      ) : error ? (
        <div className="w-full h-96 flex flex-col items-center justify-center gap-2 text-rose-400 text-xs font-mono">
          <span>{error}</span>
          <button
            onClick={() => loadData(selectedEvent)}
            className="flex items-center gap-1 px-3 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      ) : nodes.length === 0 ? (
        <div className="w-full h-96 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs font-mono">
          <span>No multi-drug co-prescriptions found in active dataset.</span>
          <span className="text-[11px] text-slate-600">Ensure dataset contains patient-level co-reported products or case reports.</span>
        </div>
      ) : (
        <div className="relative flex justify-center w-full overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full max-h-[500px] select-none"
          >
            {/* Background Halo */}
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />

            {/* Interaction Edges */}
            {filteredEdges.map((edge, i) => {
              const pA = nodePositions.get(edge.drug_a);
              const pB = nodePositions.get(edge.drug_b);
              if (!pA || !pB) return null;

              const isHovered = hoveredEdge === edge;
              const strokeColor = ARCHETYPE_COLORS[edge.archetype]?.stroke || "#64748b";
              const strokeWidth = Math.min(5, Math.max(1.5, Math.log2(edge.combo_count + 1)));

              return (
                <line
                  key={`edge-${i}-${edge.drug_a}-${edge.drug_b}`}
                  x1={pA.x}
                  y1={pA.y}
                  x2={pB.x}
                  y2={pB.y}
                  stroke={strokeColor}
                  strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
                  opacity={isHovered ? 1.0 : 0.6}
                  className="cursor-pointer transition-all hover:opacity-100"
                  onMouseEnter={() => setHoveredEdge(edge)}
                  onMouseLeave={() => setHoveredEdge(null)}
                  onClick={() => onSelectPair && onSelectPair(edge.drug_a, edge.event)}
                />
              );
            })}

            {/* Drug Nodes */}
            {nodes.map((node) => {
              const pos = nodePositions.get(node);
              if (!pos) return null;

              const isSelected = selectedNode === node;
              const isHoveredInEdge = hoveredEdge && (hoveredEdge.drug_a === node || hoveredEdge.drug_b === node);

              return (
                <g
                  key={`node-${node}`}
                  className="cursor-pointer"
                  onClick={() => setSelectedNode(selectedNode === node ? null : node)}
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isSelected ? 10 : isHoveredInEdge ? 8 : 6}
                    fill={isSelected ? "#a855f7" : isHoveredInEdge ? "#f43f5e" : "#3b82f6"}
                    stroke="#0f172a"
                    strokeWidth="2"
                    className="transition-all"
                  />
                  {/* Node Label */}
                  <text
                    x={pos.x + (pos.x > cx ? 12 : -12)}
                    y={pos.y + 4}
                    fill={isSelected ? "#e9d5ff" : "#cbd5e1"}
                    fontSize={isSelected ? "12" : "10"}
                    fontWeight={isSelected ? "bold" : "normal"}
                    textAnchor={pos.x > cx ? "start" : "end"}
                    fontFamily="monospace"
                  >
                    {node.length > 15 ? `${node.slice(0, 15)}…` : node}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Edge Tooltip */}
          {hoveredEdge && (
            <div className="absolute top-4 right-4 z-20 rounded-xl border border-slate-700 bg-slate-900/95 p-3.5 text-xs text-white shadow-2xl backdrop-blur max-w-sm pointer-events-none animate-in fade-in duration-100">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-bold text-white text-sm">{hoveredEdge.drug_a}</span>
                <span className="text-purple-400 font-bold">+</span>
                <span className="font-bold text-white text-sm">{hoveredEdge.drug_b}</span>
              </div>
              <div className="text-slate-300 text-xs mb-2">Target Event: <span className="font-semibold text-white">{hoveredEdge.event}</span></div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[11px] border-t border-slate-800 pt-2 text-slate-400">
                <span>Co-Reports (N):</span>
                <span className="text-white font-bold">{hoveredEdge.combo_count}</span>
                <span>Expected Rate:</span>
                <span className="text-white">{hoveredEdge.expected_combo}</span>
                <span>Excess Score:</span>
                <span className="text-amber-400 font-bold">{hoveredEdge.excess_score}x</span>
                <span>Synergy Type:</span>
                <span className="font-bold text-rose-400">{hoveredEdge.archetype}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
