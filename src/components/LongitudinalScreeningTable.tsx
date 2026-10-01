/**
 * Longitudinal Surveillance Screening Table
 * Evaluates candidate product-event pairs across longitudinal time slices,
 * ranked by peak disproportionality signal score.
 * Allows pharmacovigilance reviewers to rapidly triage emerging, accelerating,
 * and high-disproportionality signals and click to inspect their detailed trajectory.
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Search,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  ChevronRight,
  Sparkles,
  BarChart2,
} from 'lucide-react';
import { TrajectorySummary } from '../types/vigipy';

interface LongitudinalScreeningTableProps {
  trajectories: TrajectorySummary[];
  method: string;
  expectationModel: string;
  onSelectPair: (drug: string, event: string) => void;
  activeDrug: string;
  activeEvent: string;
}

export const LongitudinalScreeningTable: React.FC<LongitudinalScreeningTableProps> = ({
  trajectories,
  method,
  expectationModel,
  onSelectPair,
  activeDrug,
  activeEvent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [trendFilter, setTrendFilter] = useState<'all' | 'emerging' | 'accelerating' | 'stable' | 'waning'>('all');
  const [sortField, setSortField] = useState<'peakScore' | 'totalReports' | 'firstEmergence' | 'drug' | 'event'>('peakScore');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Filter & Search
  const filtered = useMemo(() => {
    return trajectories.filter((t) => {
      if (trendFilter !== 'all' && t.trajectoryTrend !== trendFilter) {
        return false;
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        const matchDrug = (t.drug || '').toLowerCase().includes(q);
        const matchEvent = (t.event || '').toLowerCase().includes(q);
        return matchDrug || matchEvent;
      }
      return true;
    });
  }, [trajectories, trendFilter, searchTerm]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortField === 'peakScore') {
        valA = a.peakScore ?? 0;
        valB = b.peakScore ?? 0;
      } else if (sortField === 'totalReports') {
        valA = a.totalReports ?? 0;
        valB = b.totalReports ?? 0;
      } else if (sortField === 'firstEmergence') {
        valA = a.firstEmergenceSlice || 'ZZZ';
        valB = b.firstEmergenceSlice || 'ZZZ';
      } else if (sortField === 'drug') {
        valA = a.drug || '';
        valB = b.drug || '';
      } else if (sortField === 'event') {
        valA = a.event || '';
        valB = b.event || '';
      }

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [filtered, sortField, sortAsc]);

  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const isAdditive = method === 'BCPNN' || method === 'LASSO';
  const threshold = isAdditive ? 0.0 : 2.0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur overflow-hidden shadow-xl space-y-3 p-4">
      {/* Table Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-cyan-400" />
            Longitudinal Signal Matrix Across Time Windows
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Ranked candidate pairs evaluated over temporal progression ({method} metric, {expectationModel} baseline).
          </p>
        </div>

        {/* Trend Pills Filter */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-[11px]">
          {(['all', 'emerging', 'accelerating', 'stable', 'waning'] as const).map((trend) => (
            <button
              key={trend}
              onClick={() => {
                setTrendFilter(trend);
                setPage(1);
              }}
              className={`px-2.5 py-0.5 rounded capitalize transition-colors ${
                trendFilter === trend
                  ? trend === 'emerging'
                    ? 'bg-rose-600 text-white font-bold'
                    : trend === 'accelerating'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {trend}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input & Total Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by product/drug or reaction/outcome..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/90 pl-9 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none font-mono text-xs"
          />
        </div>

        <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
          <span>
            Showing <strong className="text-slate-200">{sorted.length}</strong> of{' '}
            <strong className="text-slate-200">{trajectories.length}</strong> candidate pairs
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-cyan-300">
            Signal Threshold: ≥{threshold.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-800/80 rounded-lg">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60 font-semibold font-mono text-[11px]">
              <th className="py-2.5 px-3 text-center w-12">#</th>
              <th
                onClick={() => handleSort('drug')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-200"
              >
                <div className="flex items-center gap-1 font-sans">
                  <span>Product / Device / Treatment</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('event')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-200"
              >
                <div className="flex items-center gap-1 font-sans">
                  <span>Adverse Event / Malfunction</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('peakScore')}
                className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-200 text-rose-300"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Peak {method} Score</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-center">Peak Time Slice</th>
              <th
                onClick={() => handleSort('firstEmergence')}
                className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-200 text-amber-300"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>First Emergence</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-center">Trajectory Trend</th>
              <th
                onClick={() => handleSort('totalReports')}
                className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-200"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Total Reports (N₁₁)</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {paginated.map((t, idx) => {
              const globalIndex = (page - 1) * pageSize + idx + 1;
              const isActive = t.drug === activeDrug && t.event === activeEvent;
              const isSignificant = t.peakScore >= threshold;

              return (
                <tr
                  key={`${t.drug}__${t.event}`}
                  className={`transition-colors ${
                    isActive
                      ? 'bg-indigo-950/40 ring-1 ring-inset ring-indigo-500/40'
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  <td className="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px]">
                    {globalIndex}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-rose-300 whitespace-nowrap">
                    {t.drug}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-200 whitespace-nowrap">
                    {t.event}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold">
                    <span
                      className={`inline-block px-2 py-0.5 rounded ${
                        isSignificant
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {t.peakScore.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                    {t.peakSlice || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-xs">
                    {t.firstEmergenceSlice ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold">
                        <Clock className="h-3 w-3 text-amber-400" />
                        {t.firstEmergenceSlice}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">Sub-threshold</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                        t.trajectoryTrend === 'emerging'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : t.trajectoryTrend === 'accelerating'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : t.trajectoryTrend === 'stable'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {t.trajectoryTrend === 'emerging' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping"></span>
                      )}
                      {t.trajectoryTrend}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                    {(t.totalReports ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => onSelectPair(t.drug, t.event)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600'
                      }`}
                      title={`Plot detailed temporal trajectory for ${t.drug} → ${t.event}`}
                    >
                      <span>{isActive ? 'Active Curve' : 'Inspect Curve'}</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {paginated.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-xs text-slate-500 font-mono">
                  No candidate pairs found matching your filters. Try clearing the search or changing the trend filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60 px-1 font-mono">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
