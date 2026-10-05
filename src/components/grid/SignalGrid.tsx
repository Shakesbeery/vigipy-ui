import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCw,
  X,
  Filter,
  ShieldAlert,
  HelpCircle,
  Database,
  TrendingUp,
} from "lucide-react";
import { AgreementTier, SignalQueryRequest, SignalQueryResponse, SignalRow } from "../../types";
import { querySignals } from "../../services/api";
import { getTierBadgeClass } from "../inspector/SignalDrawer";

export interface SignalGridProps {
  /** Optional external callback when a row is selected */
  onSelectSignal: (signal: SignalRow) => void;
  /** Currently selected signal */
  selectedSignal?: SignalRow | null;
  /** Optional callback to jump directly to longitudinal trends */
  onOpenLongitudinal?: (signal: SignalRow) => void;
  /** Optional custom query fetcher; if not provided, uses querySignals from api service */
  fetchSignals?: (req: SignalQueryRequest) => Promise<SignalQueryResponse>;
  /** Key to trigger refresh and reset filters upon rerun */
  refreshKey?: any;
  /** Optional classname for custom wrapping */
  className?: string;
}

const TIERS: { label: string; value: AgreementTier | "All"; colorClass: string }[] = [
  { label: "All Tiers", value: "All", colorClass: "border-slate-700 text-slate-300 hover:bg-slate-800" },
  { label: "Unanimous", value: "Unanimous", colorClass: "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" },
  { label: "Strong", value: "Strong", colorClass: "border-blue-500/30 text-blue-400 hover:bg-blue-500/10" },
  { label: "Moderate", value: "Moderate", colorClass: "border-amber-500/30 text-amber-400 hover:bg-amber-500/10" },
  { label: "Weak", value: "Weak", colorClass: "border-orange-500/30 text-orange-400 hover:bg-orange-500/10" },
  { label: "Isolated", value: "Isolated", colorClass: "border-slate-500/30 text-slate-400 hover:bg-slate-500/10" },
];

export const SignalGrid: React.FC<SignalGridProps> = ({
  onSelectSignal,
  selectedSignal,
  onOpenLongitudinal,
  fetchSignals = querySignals,
  refreshKey,
  className = "",
}) => {
  // Query state
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [selectedTier, setSelectedTier] = useState<AgreementTier | "All">("All");

  // Numerical filters
  const [minCount, setMinCount] = useState<string>("");
  const [minVotes, setMinVotes] = useState<string>("");
  const [minScore, setMinScore] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Sorting
  const [sortBy, setSortBy] = useState<string>("composite_rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Pagination & Windowing
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [jumpPage, setJumpPage] = useState<string>("");

  // Data & loading state
  const [data, setData] = useState<SignalQueryResponse>({
    total_records: 0,
    filtered_records: 0,
    offset: 0,
    limit: 50,
    rows: [],
    methods: ["PRR", "ROR", "BCPNN", "GPS"],
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search query
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch slice of data when query parameters change
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * pageSize;
      const req: SignalQueryRequest = {
        offset,
        limit: pageSize,
        search: debouncedSearch.trim() || null,
        tiers: selectedTier === "All" ? null : [selectedTier],
        min_count: minCount !== "" ? Number(minCount) : null,
        min_votes: minVotes !== "" ? Number(minVotes) : null,
        min_score: minScore !== "" ? Number(minScore) : null,
        sort_by: sortBy,
        sort_dir: sortDir,
      };

      const res = await fetchSignals(req);
      setData(res);
    } catch (err: any) {
      console.error("Error fetching signals window:", err);
      setError(err?.message || "Failed to load signals.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, selectedTier, minCount, minVotes, minScore, sortBy, sortDir, fetchSignals]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset pagination and filters upon external refreshKey change (rerun / dataset swap)
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey !== null) {
      setPage(1);
      setSelectedTier("All");
      setMinVotes("");
      setMinScore("");
      setMinCount("");
      setSearch("");
      setDebouncedSearch("");
    }
  }, [refreshKey]);

  // Handle column sort toggle
  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(columnKey);
      setSortDir("asc");
    }
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(data.filtered_records / pageSize));
  const startRow = data.filtered_records === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, data.filtered_records);

  const hasActiveFilters =
    Boolean(search) ||
    selectedTier !== "All" ||
    minCount !== "" ||
    minVotes !== "" ||
    minScore !== "";

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedTier("All");
    setMinCount("");
    setMinVotes("");
    setMinScore("");
    setPage(1);
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpPage, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setPage(p);
      setJumpPage("");
    }
  };

  return (
    <div className={`flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden ${className}`}>
      {/* Top Filter & Search Bar */}
      <div className="p-4 bg-slate-900/90 border-b border-slate-800 space-y-3 shrink-0">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search drug product or adverse event name..."
              className="w-full pl-9 pr-9 py-2 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs text-white placeholder-slate-500 outline-none transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action buttons: Numerical filter toggle, Refresh */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition ${
                showFilters || minCount !== "" || minVotes !== "" || minScore !== ""
                  ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/40"
                  : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Numerical Filters</span>
              {(minCount !== "" || minVotes !== "" || minScore !== "") && (
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
              )}
            </button>

            <button
              onClick={() => loadData()}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 transition disabled:opacity-50"
              title="Refresh Grid Data"
            >
              <RotateCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Consensus Tier Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mr-1">
            Consensus Tier:
          </span>
          {TIERS.map((tier) => {
            const isActive = selectedTier === tier.value;
            return (
              <button
                key={tier.value}
                onClick={() => {
                  setSelectedTier(tier.value);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
                  isActive
                    ? tier.value === "All"
                      ? "bg-slate-700 text-white border-slate-600 shadow-sm"
                      : getTierBadgeClass(tier.value) + " shadow-sm font-semibold"
                    : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                {tier.label}
              </button>
            );
          })}

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="ml-auto text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 px-2 py-1 transition"
            >
              <X className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Expandable Numerical Filters Bar */}
        {showFilters && (
          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950/40 p-3 rounded-lg border">
            {/* Min Count */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Min Incident Count (a ≥)
              </label>
              <input
                type="number"
                min="0"
                value={minCount}
                onChange={(e) => {
                  setMinCount(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. 3"
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded text-xs text-white placeholder-slate-600 outline-none"
              />
            </div>

            {/* Min Votes */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Min Consensus Votes (≥)
              </label>
              <input
                type="number"
                min="0"
                max="6"
                value={minVotes}
                onChange={(e) => {
                  setMinVotes(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. 3 (of 6)"
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded text-xs text-white placeholder-slate-600 outline-none"
              />
            </div>

            {/* Min Score */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Min Consensus Score (≥)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={minScore}
                onChange={(e) => {
                  setMinScore(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. 0.50"
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded text-xs text-white placeholder-slate-600 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Loud Error Alert Banner */}
      {error && (
        <div className="mx-4 my-3 p-4 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-200 flex items-start justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Backend Query Error
              </h4>
              <p className="text-xs text-rose-300 mt-0.5 font-mono break-all">{error}</p>
              <p className="text-[11px] text-rose-400/80 mt-1">
                Zero mock fallback active: real backend errors are displayed loud and clear to avoid masking issues.
              </p>
            </div>
          </div>
          <button
            onClick={() => loadData()}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shrink-0 shadow transition"
          >
            Retry Query
          </button>
        </div>
      )}

      {/* Main Table Viewport */}
      <div className="flex-1 overflow-auto bg-slate-950 relative">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none shadow-sm">
            <tr>
              {/* Product */}
              <th
                onClick={() => handleSort("Product")}
                className="py-3 px-4 cursor-pointer hover:text-white transition"
              >
                <div className="flex items-center gap-1.5">
                  <span>Product / Drug</span>
                  {sortBy === "Product" ? (
                    sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  )}
                </div>
              </th>

              {/* Adverse Event */}
              <th
                onClick={() => handleSort("Adverse Event")}
                className="py-3 px-4 cursor-pointer hover:text-white transition"
              >
                <div className="flex items-center gap-1.5">
                  <span>Adverse Event</span>
                  {sortBy === "Adverse Event" ? (
                    sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  )}
                </div>
              </th>

              {/* Count */}
              <th
                onClick={() => handleSort("Count")}
                className="py-3 px-3 cursor-pointer hover:text-white transition text-right"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Count</span>
                  {sortBy === "Count" ? (
                    sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  )}
                </div>
              </th>

              {/* Expected Count */}
              <th
                onClick={() => handleSort("Expected Count")}
                className="py-3 px-3 cursor-pointer hover:text-white transition text-right"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Expected</span>
                  {sortBy === "Expected Count" ? (
                    sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  )}
                </div>
              </th>

              {/* Votes */}
              <th
                onClick={() => handleSort("votes")}
                className="py-3 px-3 cursor-pointer hover:text-white transition text-center"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Votes</span>
                  {sortBy === "votes" ? (
                    sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  )}
                </div>
              </th>

              {/* Consensus Score */}
              <th
                onClick={() => handleSort("consensus_score")}
                className="py-3 px-3 cursor-pointer hover:text-white transition text-right"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Score</span>
                  {sortBy === "consensus_score" ? (
                    sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  )}
                </div>
              </th>

              {/* Agreement Tier */}
              <th
                onClick={() => handleSort("agreement_tier")}
                className="py-3 px-3.5 cursor-pointer hover:text-white transition"
              >
                <div className="flex items-center gap-1.5">
                  <span>Tier</span>
                  {sortBy === "agreement_tier" ? (
                    sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  )}
                </div>
              </th>

              {/* Method Scores */}
              <th className="py-3 px-4">
                <span>Method Alerts</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 font-sans">
            {loading && data.rows.length === 0 ? (
              // Loading skeleton rows
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="animate-pulse">
                  <td className="py-3 px-4">
                    <div className="h-4 bg-slate-800 rounded w-28" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 bg-slate-800 rounded w-44" />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="h-4 bg-slate-800 rounded w-12 ml-auto" />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="h-4 bg-slate-800 rounded w-12 ml-auto" />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="h-4 bg-slate-800 rounded w-10 mx-auto" />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="h-4 bg-slate-800 rounded w-14 ml-auto" />
                  </td>
                  <td className="py-3 px-3.5">
                    <div className="h-4 bg-slate-800 rounded w-20" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 bg-slate-800 rounded w-36" />
                  </td>
                </tr>
              ))
            ) : data.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-slate-400">
                    <Database className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-sm font-medium text-slate-300">No signals found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      No drug-event pairs matched the specified search and threshold criteria.
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={handleClearFilters}
                        className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              data.rows.map((row) => {
                const isSelected =
                  selectedSignal?.product === row.product &&
                  selectedSignal?.adverse_event === row.adverse_event;

                return (
                  <tr
                    key={`${row.product}-${row.adverse_event}`}
                    onClick={() => onSelectSignal(row)}
                    className={`cursor-pointer transition-colors group ${
                      isSelected
                        ? "bg-indigo-950/40 border-l-4 border-indigo-500 ring-1 ring-inset ring-indigo-500/30"
                        : "hover:bg-slate-900/80 border-l-4 border-transparent"
                    }`}
                  >
                    {/* Product */}
                    <td className="py-3 px-4 font-semibold text-white tracking-tight">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[160px] sm:max-w-none">{row.product}</span>
                        {row.composite_rank && row.composite_rank <= 10 && (
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            #{row.composite_rank}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Adverse Event */}
                    <td className="py-3 px-4 text-slate-200">
                      <span className="truncate max-w-[200px] sm:max-w-none block">
                        {row.adverse_event}
                      </span>
                    </td>

                    {/* Count */}
                    <td className="py-3 px-3 text-right font-mono font-medium text-white">
                      {row.count.toLocaleString()}
                    </td>

                    {/* Expected Count */}
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      {row.expected_count !== null && row.expected_count !== undefined
                        ? row.expected_count.toFixed(1)
                        : "—"}
                    </td>

                    {/* Votes */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center font-mono text-xs px-2 py-0.5 rounded font-semibold ${
                          row.votes >= 4
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : row.votes >= 2
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {row.votes} / {row.total_methods || 6}
                      </span>
                    </td>

                    {/* Consensus Score */}
                    <td className="py-3 px-3 text-right font-mono text-slate-200 font-semibold">
                      {row.consensus_score.toFixed(3)}
                    </td>

                    {/* Agreement Tier */}
                    <td className="py-3 px-3.5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider ${getTierBadgeClass(
                          row.agreement_tier
                        )}`}
                      >
                        {row.agreement_tier}
                      </span>
                    </td>

                    {/* Method Scores / Badges */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {data.methods.map((m) => {
                            const mUp = m.toUpperCase();
                            const mLow = m.toLowerCase();
                            const alerted = Boolean(row.method_alerts[m] ?? row.method_alerts[mUp] ?? row.method_alerts[mLow]);
                            const score = row.method_scores[m] ?? row.method_scores[mUp] ?? row.method_scores[mLow];
                            return (
                              <span
                                key={m}
                                title={`${mUp}: ${score !== null && score !== undefined ? score : "N/A"}${
                                  alerted ? " (ALERT)" : ""
                                }`}
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition ${
                                  alerted
                                    ? "bg-rose-500/15 text-rose-300 border-rose-500/40 font-semibold shadow-xs"
                                    : "bg-slate-900 text-slate-500 border-slate-800"
                                }`}
                              >
                                {mUp}
                              </span>
                            );
                          })}
                        </div>
                        {onOpenLongitudinal && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenLongitudinal(row);
                            }}
                            className="p-1 rounded text-slate-500 hover:text-indigo-400 hover:bg-slate-800 transition opacity-0 group-hover:opacity-100 shrink-0 ml-1"
                            title="Analyze longitudinal time series for this pair"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Window Controls Footer */}
      <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 select-none">
        {/* Telemetry info */}
        <div className="flex items-center gap-2 text-slate-400 font-mono">
          <span>Showing</span>
          <span className="text-white font-semibold">{startRow.toLocaleString()}</span>
          <span>–</span>
          <span className="text-white font-semibold">{endRow.toLocaleString()}</span>
          <span>of</span>
          <span className="text-indigo-400 font-semibold">
            {data.filtered_records.toLocaleString()}
          </span>
          <span>candidate signals</span>
          {data.filtered_records < data.total_records && (
            <span className="text-slate-500 text-[11px]">
              (filtered from {data.total_records.toLocaleString()})
            </span>
          )}
        </div>

        {/* Navigation & Limit Controls */}
        <div className="flex items-center gap-3">
          {/* Page size window selector */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none cursor-pointer focus:border-indigo-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </div>

          {/* Jump to page form */}
          <form onSubmit={handleJumpSubmit} className="hidden sm:flex items-center gap-1.5 text-slate-400">
            <span>Jump:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              placeholder={`${page}`}
              className="w-12 px-1.5 py-1 bg-slate-950 border border-slate-700 rounded text-center text-xs text-white outline-none focus:border-indigo-500"
            />
          </form>

          {/* Stepper buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-mono text-slate-300 bg-slate-950 rounded border border-slate-800">
              {page} / {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
