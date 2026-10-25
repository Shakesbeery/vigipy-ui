import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Download,
  FileImage,
  Sparkles,
  Filter,
  Activity,
  Layers,
  Info,
  X,
  Loader2,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  BookOpen,
  Zap,
} from "lucide-react";
import { DDIEdge, DDINetworkResponse } from "../../types";
import { fetchDdiNetwork } from "../../services/api";
import { exportSvgToFile, exportSvgToPng } from "../../core/chart_export";

interface DdiNetworkGraphProps {
  onSelectPair?: (drug: string, event: string) => void;
  onSelectSignal?: (drug: string, event: string) => void;
  className?: string;
}

const ARCHETYPE_COLORS: Record<string, { stroke: string; badge: string }> = {
  EMERGENT: { stroke: "#ef4444", badge: "bg-red-500/20 text-red-400 border-red-500/30" },
  POTENTIATED: { stroke: "#f97316", badge: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  TWO_HIT: { stroke: "#eab308", badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  MULTI_HIT: { stroke: "#8b5cf6", badge: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
};

export const DdiNetworkGraph: React.FC<DdiNetworkGraphProps> = ({
  onSelectPair,
  onSelectSignal,
  className = "",
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [data, setData] = useState<DDINetworkResponse | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string>("ALL");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<DDIEdge | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedArchetype, setSelectedArchetype] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"excess_score" | "combo_count" | "expected_combo">("excess_score");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [showMethodology, setShowMethodology] = useState<boolean>(false);

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

  // Compute degree centrality (number of connected interaction edges)
  const nodeDegrees = useMemo(() => {
    const degMap = new Map<string, number>();
    filteredEdges.forEach((e) => {
      degMap.set(e.drug_a, (degMap.get(e.drug_a) || 0) + 1);
      degMap.set(e.drug_b, (degMap.get(e.drug_b) || 0) + 1);
    });
    return degMap;
  }, [filteredEdges]);

  // Derive unique nodes in filtered view, sorted by interaction degree
  const nodes = useMemo(() => {
    const nodeSet = new Set<string>();
    filteredEdges.forEach((e) => {
      nodeSet.add(e.drug_a);
      nodeSet.add(e.drug_b);
    });
    return Array.from(nodeSet).sort((a, b) => (nodeDegrees.get(b) || 0) - (nodeDegrees.get(a) || 0));
  }, [filteredEdges, nodeDegrees]);

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

  // Derive filtered, searched, and sorted edges for the interaction table
  const tableEdges = useMemo(() => {
    let result = [...filteredEdges];
    if (selectedArchetype !== "ALL") {
      result = result.filter((e) => e.archetype === selectedArchetype);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.drug_a.toLowerCase().includes(q) ||
          e.drug_b.toLowerCase().includes(q) ||
          e.event.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      return sortDir === "desc" ? valB - valA : valA - valB;
    });
    return result;
  }, [filteredEdges, selectedArchetype, searchQuery, sortBy, sortDir]);

  const toggleSort = (col: "excess_score" | "combo_count" | "expected_combo") => {
    if (sortBy === col) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

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
              const isEdgeDimmed =
                (hoveredEdge && !isHovered) ||
                (selectedNode && edge.drug_a !== selectedNode && edge.drug_b !== selectedNode);

              const strokeColor = ARCHETYPE_COLORS[edge.archetype]?.stroke || "#64748b";
              const strokeWidth = Math.min(5, Math.max(1.5, Math.log2(edge.combo_count + 1)));

              return (
                <g key={`edge-g-${i}-${edge.drug_a}-${edge.drug_b}`}>
                  {/* Invisible wide hit target for effortless trackpad / mouse hovering (Fitts's Law) */}
                  <line
                    x1={pA.x}
                    y1={pA.y}
                    x2={pB.x}
                    y2={pB.y}
                    stroke="transparent"
                    strokeWidth={14}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredEdge(edge)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    onClick={() => {
                      if (onSelectSignal) onSelectSignal(edge.drug_a, edge.event);
                      else if (onSelectPair) onSelectPair(edge.drug_a, edge.event);
                    }}
                  />
                  {/* Visible styled edge with dimming */}
                  <line
                    x1={pA.x}
                    y1={pA.y}
                    x2={pB.x}
                    y2={pB.y}
                    stroke={strokeColor}
                    strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
                    opacity={isEdgeDimmed ? 0.12 : isHovered ? 1.0 : 0.65}
                    className="pointer-events-none transition-opacity duration-150"
                  />
                </g>
              );
            })}

            {/* Drug Nodes */}
            {nodes.map((node) => {
              const pos = nodePositions.get(node);
              if (!pos) return null;

              const isSelected = selectedNode === node;
              const isHoveredInEdge = hoveredEdge && (hoveredEdge.drug_a === node || hoveredEdge.drug_b === node);
              const isConnectedToSelected =
                selectedNode &&
                (selectedNode === node ||
                  filteredEdges.some(
                    (e) =>
                      (e.drug_a === selectedNode && e.drug_b === node) ||
                      (e.drug_b === selectedNode && e.drug_a === node)
                  ));

              const isNodeDimmed =
                (hoveredEdge && !isHoveredInEdge) || (selectedNode && !isConnectedToSelected);

              const deg = nodeDegrees.get(node) || 1;
              const baseRadius = Math.min(13, Math.max(6, 6 + Math.log2(deg + 1) * 2.2));
              const nodeRadius = isSelected ? baseRadius + 4 : isHoveredInEdge ? baseRadius + 2.5 : baseRadius;

              return (
                <g
                  key={`node-${node}`}
                  className="cursor-pointer transition-opacity duration-150"
                  opacity={isNodeDimmed ? 0.25 : 1.0}
                  onClick={() => setSelectedNode(selectedNode === node ? null : node)}
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={nodeRadius}
                    fill={isSelected ? "#a855f7" : isHoveredInEdge ? "#f43f5e" : "#3b82f6"}
                    stroke="#0f172a"
                    strokeWidth="2"
                    className="transition-all"
                  />
                  {/* Node Label */}
                  <text
                    x={pos.x + (pos.x > cx ? nodeRadius + 6 : -nodeRadius - 6)}
                    y={pos.y + 4}
                    fill={isSelected ? "#e9d5ff" : isHoveredInEdge ? "#fecdd3" : "#cbd5e1"}
                    fontSize={isSelected || isHoveredInEdge ? "12" : "10"}
                    fontWeight={isSelected || isHoveredInEdge ? "bold" : "normal"}
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

      {/* Interactions Table & Methodology Below Graph */}
      {!loading && !error && filteredEdges.length > 0 && (
        <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-4">
          {/* Table Header & Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  Detected Drug-Drug Interactions ({tableEdges.length})
                </h4>
                {selectedNode && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                    Node: {selectedNode}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click any row to drill down into the signal inspector or highlight combinations.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter drug or event..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-7 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 w-44"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Archetype Filter Tabs */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                {["ALL", "EMERGENT", "POTENTIATED", "TWO_HIT"].map((arch) => (
                  <button
                    key={arch}
                    onClick={() => setSelectedArchetype(arch)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                      selectedArchetype === arch
                        ? "bg-purple-600 text-white font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {arch}
                  </button>
                ))}
              </div>

              {/* Methodology Guide Toggle */}
              <button
                onClick={() => setShowMethodology(!showMethodology)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                  showMethodology
                    ? "bg-purple-950/60 border-purple-500/50 text-purple-300"
                    : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
                }`}
                title="Toggle SCORE-DDI mathematical formulation & archetype derivation"
              >
                <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                <span>Methodology</span>
                {showMethodology ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Mathematical Derivation & Archetype Accordion */}
          {showMethodology && (
            <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-slate-300 space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                <span className="font-bold text-white text-xs flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  SCORE-DDI Mathematical Formulation & Clinical Synergy Archetypes
                </span>
                <span className="text-[10px] font-mono text-purple-300 bg-purple-900/40 px-2 py-0.5 rounded-full border border-purple-700/50">
                  Matrix FISTA • Counterfactual Null
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px]">
                {/* Panel 1 */}
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                  <span className="font-semibold text-purple-300 block">1. Counterfactual Null (Λ_null)</span>
                  <div className="font-mono text-[10px] text-amber-300 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    Λ_null = E_combo · RR_A · RR_B
                  </div>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    Evaluates expected co-reporting under no interaction. Multiplying single-drug relative risks prevents false synergy from common baseline drugs.
                  </p>
                </div>

                {/* Panel 2 */}
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                  <span className="font-semibold text-purple-300 block">2. Standardized Excess (SER)</span>
                  <div className="font-mono text-[10px] text-amber-300 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    Θ = (C_combo - Λ_null) / √(Λ_null)
                  </div>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    Standardizes excess observed combinations over expected variance, quantifying true synergistic pharmacodynamic compounding.
                  </p>
                </div>

                {/* Panel 3 */}
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                  <span className="font-semibold text-purple-300 block">3. Clinical Synergy Archetypes</span>
                  <div className="space-y-1 text-[10px]">
                    <div><span className="text-red-400 font-bold">EMERGENT:</span> RR_A &lt; 2 and RR_B &lt; 2 (De novo synergy)</div>
                    <div><span className="text-orange-400 font-bold">POTENTIATED:</span> One drug baseline RR ≥ 2</div>
                    <div><span className="text-yellow-400 font-bold">TWO-HIT:</span> Both drugs baseline RR ≥ 2</div>
                  </div>
                </div>

                {/* Panel 4 */}
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                  <span className="font-semibold text-purple-300 block">4. Syndromic FISTA Regularization</span>
                  <div className="font-mono text-[10px] text-purple-300 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    min ||X - UVᵀ - S||² + λ₁||S||₁ + λ₂ Tr(Sᵀ L S)
                  </div>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    Matrix decomposition with Graph Laplacian (L) borrows strength across related syndrome events while shrinking spurious co-occurrence noise.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-slate-400 font-medium z-10">
                <tr>
                  <th className="py-2.5 px-3">Drug A</th>
                  <th className="py-2.5 px-3">Drug B</th>
                  <th className="py-2.5 px-3">Target Adverse Event</th>
                  <th
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-white select-none"
                    onClick={() => toggleSort("combo_count")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Co-Reports (N)</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-white select-none"
                    onClick={() => toggleSort("expected_combo")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Expected (Λ_null)</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-white select-none"
                    onClick={() => toggleSort("excess_score")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Excess Score (SER)</span>
                      <ArrowUpDown className="w-3 h-3 text-purple-400" />
                    </div>
                  </th>
                  <th className="py-2.5 px-3">Synergy Archetype</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {tableEdges.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-mono text-xs">
                      No interactions match the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  tableEdges.map((edge, idx) => {
                    const badge = ARCHETYPE_COLORS[edge.archetype]?.badge || "bg-slate-800 text-slate-400";
                    const isHovered = hoveredEdge === edge;

                    return (
                      <tr
                        key={`row-${idx}-${edge.drug_a}-${edge.drug_b}-${edge.event}`}
                        className={`hover:bg-purple-900/20 cursor-pointer transition ${
                          isHovered ? "bg-purple-950/40" : ""
                        }`}
                        onMouseEnter={() => setHoveredEdge(edge)}
                        onMouseLeave={() => setHoveredEdge(null)}
                        onClick={() => {
                          if (onSelectSignal) onSelectSignal(edge.drug_a, edge.event);
                          else if (onSelectPair) onSelectPair(edge.drug_a, edge.event);
                        }}
                      >
                        <td className="py-2 px-3 font-semibold text-white">{edge.drug_a}</td>
                        <td className="py-2 px-3 font-semibold text-white">{edge.drug_b}</td>
                        <td className="py-2 px-3 text-slate-200">{edge.event}</td>
                        <td className="py-2 px-3 text-right font-mono text-purple-300">{edge.combo_count.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-400">{edge.expected_combo.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-400">{edge.excess_score.toFixed(2)}x</td>
                        <td className="py-2 px-3">
                          <span className={`inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${badge}`}>
                            {edge.archetype}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
