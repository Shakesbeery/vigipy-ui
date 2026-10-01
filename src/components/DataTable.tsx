/**
 * Signal Results Table, Conglomerate Multi-Method Matrix & Raw Cohort Explorer
 * Features:
 * - Single-Method view ({method})
 * - Conglomerate Multi-Method Matrix view (methods voting count, normalized geometric excess, individual voting pills)
 * - Inline expandable row details with Method Forest Plot, Breakdown Table, and 2x2 Contingency & DA Statistics
 * - Drill-down modal for full multi-analysis inspection
 * - Raw cohort case reports view
 */

import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  Download,
  Search,
  CheckCircle2,
  ShieldAlert,
  FileSpreadsheet,
  Eye,
  BarChart2,
  Layers,
  Activity,
  Sliders,
  HelpCircle,
  Maximize2,
} from 'lucide-react';
import { ConsensusSignal, DisproportionalityMethod, FAERSRecord, SignalResult } from '../types/vigipy';
import { MultiMethodDetailModal } from './MultiMethodDetailModal';

interface DataTableProps {
  signals: SignalResult[];
  consensusSignals: ConsensusSignal[];
  rawRecords: FAERSRecord[];
  onSelectSignal: (signal: SignalResult) => void;
  selectedSignal?: SignalResult | null;
  method: string;
  activeMethods?: DisproportionalityMethod[];
}

export const DataTable: React.FC<DataTableProps> = ({
  signals,
  consensusSignals,
  rawRecords,
  onSelectSignal,
  selectedSignal,
  method,
  activeMethods = ['PRR', 'ROR', 'RFET', 'BCPNN', 'GPS', 'LASSO'],
}) => {
  const [viewTab, setViewTab] = useState<'conglomerate' | 'signals' | 'raw'>('conglomerate');
  const [search, setSearch] = useState('');
  const [signalOnly, setSignalOnly] = useState(false);
  const [conglomerateFilter, setConglomerateFilter] = useState<'all' | 'consensus' | 'high_margin'>('all');

  // Sorting
  const [sortField, setSortField] = useState<
    'score' | 'n11' | 'lowerBound' | 'pValue' | 'drug' | 'event' | 'voting' | 'normGeo' | 'expected' | 'oeRatio'
  >('voting');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modal drill-down state
  const [inspectingConsensusSignal, setInspectingConsensusSignal] = useState<ConsensusSignal | null>(null);

  const singleMethodSignalCount = useMemo(() => signals.filter((s) => s.isSignal).length, [signals]);

  // Filter & sort single-method signals
  const filteredSignals = useMemo(() => {
    return signals
      .filter((s) => {
        if (signalOnly && !s.isSignal) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            s.drug.toLowerCase().includes(q) ||
            s.event.toLowerCase().includes(q) ||
            (s.soc && s.soc.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        let valA: any;
        let valB: any;
        if (sortField === 'n11') {
          valA = a.contingency.n11;
          valB = b.contingency.n11;
        } else if (sortField === 'pValue') {
          valA = a.pValue ?? 1;
          valB = b.pValue ?? 1;
        } else if (sortField === 'score') {
          valA = a.score;
          valB = b.score;
        } else if (sortField === 'lowerBound') {
          valA = a.lowerBound;
          valB = b.lowerBound;
        } else if (sortField === 'drug') {
          valA = a.drug;
          valB = b.drug;
        } else if (sortField === 'event') {
          valA = a.event;
          valB = b.event;
        }

        if (typeof valA === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
      });
  }, [signals, signalOnly, search, sortField, sortAsc]);

  // Filter & sort conglomerate consensus signals
  const filteredConsensus = useMemo(() => {
    return consensusSignals
      .filter((cs) => {
        if (conglomerateFilter === 'consensus' && !cs.isConsensusSignal) return false;
        if (conglomerateFilter === 'high_margin' && (cs.normalizedGeometricExcess || 0) < 1.5) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            cs.drug.toLowerCase().includes(q) ||
            cs.event.toLowerCase().includes(q) ||
            (cs.soc && cs.soc.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        let valA: any;
        let valB: any;
        if (sortField === 'voting') {
          valA = a.signalCount;
          valB = b.signalCount;
        } else if (sortField === 'normGeo') {
          valA = a.normalizedGeometricExcess || 0;
          valB = b.normalizedGeometricExcess || 0;
        } else if (sortField === 'n11') {
          valA = a.contingency.n11;
          valB = b.contingency.n11;
        } else if (sortField === 'expected') {
          valA = a.expected || a.contingency.expected;
          valB = b.expected || b.contingency.expected;
        } else if (sortField === 'oeRatio') {
          valA = a.oeRatio || 0;
          valB = b.oeRatio || 0;
        } else if (sortField === 'drug') {
          valA = a.drug;
          valB = b.drug;
        } else if (sortField === 'event') {
          valA = a.event;
          valB = b.event;
        } else {
          valA = a.signalCount;
          valB = b.signalCount;
        }

        if (typeof valA === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
      });
  }, [consensusSignals, conglomerateFilter, search, sortField, sortAsc]);

  // Raw records filtered
  const filteredRaw = useMemo(() => {
    if (!search) return rawRecords;
    const q = search.toLowerCase();
    return rawRecords.filter(
      (r) =>
        r.drugName.toLowerCase().includes(q) ||
        r.preferredTerm.toLowerCase().includes(q) ||
        r.caseId.toLowerCase().includes(q)
    );
  }, [rawRecords, search]);

  const activeCount =
    viewTab === 'conglomerate'
      ? filteredConsensus.length
      : viewTab === 'signals'
      ? filteredSignals.length
      : filteredRaw.length;

  const totalPages = Math.ceil(activeCount / pageSize) || 1;
  const currentConsensus = filteredConsensus.slice((page - 1) * pageSize, page * pageSize);
  const currentSignals = filteredSignals.slice((page - 1) * pageSize, page * pageSize);
  const currentRaw = filteredRaw.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const exportCSV = () => {
    if (viewTab === 'conglomerate') {
      const headers = [
        'Product',
        'Event',
        'N11_Observed',
        'Expected',
        'OE_Ratio',
        'Methods_Voting_Signal',
        'Total_Active_Methods',
        'Voting_Percentage',
        'Normalized_Geometric_Excess',
        'Consensus_SDR',
        'ChiSquare',
        'Yates_ChiSquare',
      ];
      const rows = filteredConsensus.map((cs) => [
        `"${cs.drug || ''}"`,
        `"${cs.event || ''}"`,
        cs.contingency?.n11 ?? 0,
        ((cs.expected ?? cs.contingency?.expected) ?? 0).toFixed(2),
        (cs.oeRatio ?? 0).toFixed(2),
        cs.signalCount ?? 0,
        cs.totalMethods ?? 0,
        Math.round((cs.consensusScore ?? 0) * 100),
        (cs.normalizedGeometricExcess ?? 1).toFixed(4),
        cs.isConsensusSignal ? 1 : 0,
        ((cs.chiSquare ?? cs.contingency?.chiSquare) ?? 0).toFixed(2),
        ((cs.yatesChiSquare ?? cs.contingency?.yatesChiSquare) ?? 0).toFixed(2),
      ]);
      const csvContent =
        'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `vigipy_conglomerate_matrix.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (viewTab === 'signals') {
      const headers = [
        'Drug',
        'Preferred_Term',
        'Method',
        'Score',
        'Lower_Bound',
        'Upper_Bound',
        'N11',
        'Expected',
        'p_value',
        'q_value_FDR',
        'Is_Signal',
      ];
      const rows = filteredSignals.map((s) => [
        `"${s.drug || ''}"`,
        `"${s.event || ''}"`,
        s.method || '',
        (s.score ?? 0).toFixed(4),
        (s.lowerBound ?? 0).toFixed(4),
        (s.upperBound ?? 0).toFixed(4),
        s.contingency?.n11 ?? 0,
        (s.contingency?.expected ?? 0).toFixed(2),
        s.pValue ?? '',
        s.qValue ?? '',
        s.isSignal ? 1 : 0,
      ]);
      const csvContent =
        'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `vigipy_${method}_signals.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = ['Case_ID', 'Drug_Name', 'Role', 'Preferred_Term', 'SOC', 'Date', 'Age', 'Sex', 'Serious'];
      const rows = filteredRaw.map((r) => [
        `"${r.caseId}"`,
        `"${r.drugName}"`,
        r.role,
        `"${r.preferredTerm}"`,
        `"${r.systemOrganClass}"`,
        r.date,
        r.age ?? '',
        r.sex ?? '',
        r.serious ? 1 : 0,
      ]);
      const csvContent =
        'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `faers_cohort_records.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="w-full rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur shadow-xl overflow-hidden flex flex-col">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/70 p-3.5 text-xs">
        {/* View mode toggle */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => {
              setViewTab('conglomerate');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-colors ${
              viewTab === 'conglomerate'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Conglomerate Matrix ({filteredConsensus.length})</span>
          </button>

          <button
            onClick={() => {
              setViewTab('signals');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-colors ${
              viewTab === 'signals'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>
              {method} Results ({singleMethodSignalCount} SDRs / {signals.length} pairs)
            </span>
          </button>

          <button
            onClick={() => {
              setViewTab('raw');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-colors ${
              viewTab === 'raw'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Raw Cohort ({filteredRaw.length.toLocaleString()})</span>
          </button>
        </div>

        {/* Filter, Search & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {viewTab === 'conglomerate' && (
            <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
              <button
                onClick={() => {
                  setConglomerateFilter('all');
                  setPage(1);
                }}
                className={`px-2 py-0.5 rounded transition-colors ${
                  conglomerateFilter === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Pairs
              </button>
              <button
                onClick={() => {
                  setConglomerateFilter('consensus');
                  setPage(1);
                }}
                className={`px-2 py-0.5 rounded transition-colors ${
                  conglomerateFilter === 'consensus'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Consensus SDRs
              </button>
              <button
                onClick={() => {
                  setConglomerateFilter('high_margin');
                  setPage(1);
                }}
                className={`px-2 py-0.5 rounded transition-colors ${
                  conglomerateFilter === 'high_margin'
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Excess ≥ 1.5x
              </button>
            </div>
          )}

          {viewTab === 'signals' && (
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSignalOnly(false);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  !signalOnly ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Pairs ({signals.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSignalOnly(true);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  signalOnly ? 'bg-rose-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Signals Only ({singleMethodSignalCount})
              </button>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search product, outcome, SOC..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-3 py-1 text-slate-200 placeholder-slate-500 text-xs focus:border-indigo-500 focus:outline-none min-w-[200px]"
            />
          </div>

          <button
            onClick={exportCSV}
            title="Export CSV"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto min-h-[340px]">
        {/* VIEW 1: CONGLOMERATE MULTI-METHOD MATRIX */}
        {viewTab === 'conglomerate' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60 font-semibold">
                <th
                  onClick={() => handleSort('drug')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center gap-1">
                    <span>Product / Device / Exposure</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('event')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center gap-1">
                    <span>Event / Outcome / Malfunction</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('n11')}
                  className="py-2.5 px-2.5 text-center cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Cases (N₁₁)</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('voting')}
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center justify-center gap-1 text-rose-300">
                    <span>Methods Voting Signal</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('normGeo')}
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-200"
                  title="Geometric mean of signal margins above decision thresholds (1.0x = threshold, natively handling zeroes/negatives)"
                >
                  <div className="flex items-center justify-center gap-1 text-cyan-300">
                    <span>Norm. Geometric Margin</span>
                    <HelpCircle className="h-3 w-3 text-cyan-400" />
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center">Active Method Votes</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {currentConsensus.map((cs) => {
                const votes = cs.methodVotes || [];
                const votingPercent = Math.round(cs.consensusScore * 100);
                const normMargin = cs.normalizedGeometricExcess || 1;

                return (
                  <tr
                    key={cs.id}
                    onClick={() => setInspectingConsensusSignal(cs)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    {/* Product Name */}
                    <td className="py-3 px-3 font-semibold text-rose-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{cs.drug}</span>
                      </div>
                    </td>

                    {/* Event Name */}
                    <td className="py-3 px-3 font-medium text-slate-200 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{cs.event}</span>
                        {cs.soc && (
                          <span className="text-[10px] text-slate-500 font-mono hidden lg:inline">
                            ({cs.soc})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Cases N11 & Expected */}
                    <td className="py-3 px-2.5 text-center font-mono">
                      <span className="font-bold text-white text-xs">{cs.contingency?.n11 ?? 0}</span>
                      <span className="text-[10px] text-slate-500 block">
                        E: {((cs.expected ?? cs.contingency?.expected) ?? 0).toFixed(1)}
                      </span>
                    </td>

                    {/* Conglomerate Stat 1: Methods Voting Signal */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-950 border border-slate-800">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            cs.isConsensusSignal
                              ? 'bg-rose-500 animate-pulse'
                              : (cs.signalCount ?? 0) > 0
                              ? 'bg-amber-400'
                              : 'bg-slate-600'
                          }`}
                        ></span>
                        <span className={cs.isConsensusSignal ? 'text-rose-300' : 'text-slate-300'}>
                          {cs.votingRatio || `${cs.signalCount ?? 0}/${cs.totalMethods ?? 6}`} Methods
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          ({votingPercent}%)
                        </span>
                      </div>
                    </td>

                    {/* Conglomerate Stat 2: Normalized Geometric Mean Metric (Excess above threshold) */}
                    <td className="py-3 px-3 text-center font-mono">
                      <div
                        className={`inline-flex flex-col items-center justify-center px-2.5 py-0.5 rounded-lg border ${
                          normMargin >= 2.0
                            ? 'bg-rose-950/40 text-rose-300 border-rose-500/40'
                            : normMargin >= 1.0
                            ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/40'
                            : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        <span className="font-bold text-xs">{normMargin.toFixed(2)}x</span>
                        <span className="text-[9px] uppercase tracking-tight opacity-75">
                          {normMargin >= 1.0 ? 'Above Cutoff' : 'Sub-Threshold'}
                        </span>
                      </div>
                    </td>

                    {/* Individual method voting pills */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        {votes.map((v) => (
                          <span
                            key={v.method}
                            title={`${v.method}: ${v.formattedScore || '—'} (Cutoff: ${v.threshold ?? '—'}, Margin: ${(v.foldExcess ?? 1).toFixed(2)}x)`}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all ${
                              v.isSignal
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                                : 'bg-slate-800/40 text-slate-500 border border-slate-800/60'
                            }`}
                          >
                            {v.method} {v.isSignal ? '✓' : '—'}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Action Drilldown */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectingConsensusSignal(cs);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold transition-all hover:border-indigo-400 group-hover:bg-indigo-600/30 shadow-sm"
                        title="Open comprehensive multi-method breakdown & forest plot modal"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        <span>Breakdown</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {currentConsensus.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-500 font-mono">
                    No disproportionality signals found. Ingest a dataset or stream live reports from openFDA to run analysis.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* VIEW 2: SINGLE-METHOD SIGNALS TABLE */}
        {viewTab === 'signals' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40 font-semibold">
                <th
                  onClick={() => handleSort('drug')}
                  className="py-2.5 px-3.5 cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center gap-1">
                    <span>Product / Device / Treatment</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('event')}
                  className="py-2.5 px-3.5 cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center gap-1">
                    <span>Event / Outcome / Malfunction</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('n11')}
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Observed (N₁₁)</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('score')}
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{method} Metric</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('lowerBound')}
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>95% Bounds</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('pValue')}
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>p-Value / FDR</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Contingency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {currentSignals.map((s) => {
                const isSelected = selectedSignal?.id === s.id;
                const isSig = s.isSignal;

                return (
                  <tr
                    key={s.id}
                    onClick={() => onSelectSignal(s)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-950/40 ring-1 ring-inset ring-indigo-500/40'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-2.5 px-3.5 font-semibold text-rose-300 whitespace-nowrap">
                      {s.drug}
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-slate-200 whitespace-nowrap">
                      <span>{s.event}</span>
                      {s.soc && <span className="text-[10px] text-slate-500 ml-2 font-mono">({s.soc})</span>}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                      {(s.contingency?.n11 ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-white">
                      {s.formattedScore || (s.score ?? 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                      {s.formattedInterval || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                      {s.pValue !== undefined && !isNaN(s.pValue) ? s.pValue.toExponential(2) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isSig ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          <CheckCircle2 className="h-3 w-3" />
                          SIGNAL (SDR)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400">
                          Sub-threshold
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSignal(s);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                        title="View 2x2 contingency matrix"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {currentSignals.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-500 font-mono">
                    No signals found for {method}. Ingest or upload records to run disproportionality detection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* VIEW 3: RAW COHORT RECORDS TABLE */}
        {viewTab === 'raw' && (
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40 font-semibold">
                <th className="py-2.5 px-3.5">Case ID</th>
                <th className="py-2.5 px-3.5 font-sans">Product / Treatment</th>
                <th className="py-2.5 px-2 text-center">Role</th>
                <th className="py-2.5 px-3.5 font-sans">Event / Outcome</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-2 text-center">Demographics</th>
                <th className="py-2.5 px-3 text-center">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {currentRaw.map((r, i) => (
                <tr key={`${r.caseId}-${i}`} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 px-3.5 text-slate-400">{r.caseId}</td>
                  <td className="py-2 px-3.5 font-semibold text-rose-300 font-sans">{r.drugName}</td>
                  <td className="py-2 px-2 text-center">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                      {r.role}
                    </span>
                  </td>
                  <td className="py-2 px-3.5 text-slate-200 font-sans">{r.preferredTerm}</td>
                  <td className="py-2 px-3 text-slate-400">{r.date}</td>
                  <td className="py-2 px-2 text-center text-slate-400">
                    {r.age ?? '—'}y / {r.sex ?? '—'}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {r.serious ? (
                      <span className="text-rose-400 text-[10px] font-bold">Serious</span>
                    ) : (
                      <span className="text-slate-500 text-[10px]">Non-serious</span>
                    )}
                  </td>
                </tr>
              ))}
              {currentRaw.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-500 font-mono">
                    No raw surveillance cohort records loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/70 px-4 py-2.5 text-xs text-slate-400">
        <div>
          Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, activeCount)} of{' '}
          {activeCount.toLocaleString()}{' '}
          {viewTab === 'conglomerate' ? 'conglomerate pairs' : viewTab === 'signals' ? 'signals' : 'records'}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 transition-colors"
          >
            Previous
          </button>
          <span className="font-mono text-[11px] px-2">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {/* Multi-Method Drilldown Modal */}
      {inspectingConsensusSignal && (
        <MultiMethodDetailModal
          signal={inspectingConsensusSignal}
          onClose={() => setInspectingConsensusSignal(null)}
        />
      )}
    </div>
  );
};
