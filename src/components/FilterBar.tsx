/**
 * FAERS Subsetting & Cohort Filter Bar
 * Enables real-time slicing of spontaneous reporting databases by
 * drug role, demographic strata, seriousness, outcomes, and temporal quarters.
 */

import React, { useState } from 'react';
import { Filter, Search, RotateCcw, ChevronDown, ChevronUp, AlertCircle, ShieldAlert, Check } from 'lucide-react';
import { CohortFilter, DrugRole, OutcomeCode, SexType } from '../types/vigipy';

interface FilterBarProps {
  filter: CohortFilter;
  onChangeFilter: (f: CohortFilter) => void;
  totalRecords: number;
  filteredRecords: number;
  availableDrugs: string[];
  availableEvents: string[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filter,
  onChangeFilter,
  totalRecords,
  filteredRecords,
  availableDrugs,
  availableEvents,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleRole = (r: DrugRole) => {
    const roles = filter.roles.includes(r)
      ? filter.roles.filter((x) => x !== r)
      : [...filter.roles, r];
    onChangeFilter({ ...filter, roles: roles.length > 0 ? roles : [r] });
  };

  const toggleOutcome = (o: OutcomeCode) => {
    const outcomes = filter.outcomes.includes(o)
      ? filter.outcomes.filter((x) => x !== o)
      : [...filter.outcomes, o];
    onChangeFilter({ ...filter, outcomes });
  };

  const toggleSex = (s: SexType) => {
    const sex = filter.sex.includes(s)
      ? filter.sex.filter((x) => x !== s)
      : [...filter.sex, s];
    onChangeFilter({ ...filter, sex: sex.length > 0 ? sex : [s] });
  };

  const resetFilters = () => {
    onChangeFilter({
      targetDrugs: [],
      targetEvents: [],
      roles: ['PS', 'SS', 'C', 'I'],
      dateStart: '',
      dateEnd: '',
      quarters: [],
      ageMin: undefined,
      ageMax: undefined,
      sex: ['M', 'F', 'UNK'],
      seriousOnly: false,
      outcomes: [],
      minReportCount: 3,
      searchQuery: '',
    });
  };

  const hasActiveFilters =
    filter.targetDrugs.length > 0 ||
    filter.targetEvents.length > 0 ||
    filter.roles.length < 4 ||
    filter.seriousOnly ||
    filter.outcomes.length > 0 ||
    filter.searchQuery !== '' ||
    filter.ageMin !== undefined ||
    filter.ageMax !== undefined ||
    filter.sex.length < 3 ||
    filter.minReportCount !== 3;

  const percentKept = totalRecords > 0 ? Math.round((filteredRecords / totalRecords) * 100) : 0;

  return (
    <div className="w-full rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur shadow-lg transition-all">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search product, device, drug, or complication/outcome..."
            value={filter.searchQuery}
            onChange={(e) => onChangeFilter({ ...filter, searchQuery: e.target.value })}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/80 pl-9 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Product Role Chips */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800/80">
          <span className="text-[10px] text-slate-500 font-semibold px-1.5 uppercase">Role:</span>
          {(['PS', 'SS', 'C', 'I'] as DrugRole[]).map((r) => {
            const active = filter.roles.includes(r);
            const label = r === 'PS' ? 'Primary Suspect' : r === 'SS' ? 'Secondary Suspect' : r === 'C' ? 'Concomitant' : 'Interacting';
            return (
              <button
                key={r}
                onClick={() => toggleRole(r)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={`${label} exposure role`}
              >
                {r}
              </button>
            );
          })}
        </div>

        {/* Serious Only Toggle */}
        <button
          onClick={() => onChangeFilter({ ...filter, seriousOnly: !filter.seriousOnly })}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
            filter.seriousOnly
              ? 'bg-rose-950/40 border-rose-500/40 text-rose-300 font-semibold'
              : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
          <span>Serious Only</span>
        </button>

        {/* Cohort Stats Badge */}
        <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg font-mono text-[11px]">
          <span className="text-slate-400">Cohort:</span>
          <span className="text-emerald-400 font-bold">{filteredRecords.toLocaleString()}</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">{totalRecords.toLocaleString()}</span>
          <span className="text-slate-500 text-[10px]">({percentKept}%)</span>
        </div>

        {/* Expand / Collapse & Reset Controls */}
        <div className="flex items-center gap-1.5">
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              title="Reset all filters"
              className="flex items-center gap-1 px-2 py-1 rounded text-rose-400 hover:bg-rose-500/10 text-[11px] transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <Filter className="h-3.5 w-3.5 text-indigo-400" />
            <span>Filters</span>
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Subsetting Panels */}
      {isExpanded && (
        <div className="border-t border-slate-800/80 p-4 bg-slate-950/40 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs animate-in slide-in-from-top-2 duration-150">
          {/* Target Product Filter */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Target Product / Device / Treatment</label>
            <select
              value={filter.targetDrugs[0] || ''}
              onChange={(e) => {
                const val = e.target.value;
                onChangeFilter({
                  ...filter,
                  targetDrugs: val ? [val] : [],
                });
              }}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-slate-200 font-mono"
            >
              <option value="">All Products / Devices ({availableDrugs.length})</option>
              {availableDrugs.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Outcome Filtering */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Severe Complications / Outcomes</label>
            <div className="flex flex-wrap gap-1">
              {[
                { code: 'DE' as OutcomeCode, label: 'Death (DE)' },
                { code: 'HO' as OutcomeCode, label: 'Hospitalization (HO)' },
                { code: 'LT' as OutcomeCode, label: 'Life-Threatening (LT)' },
                { code: 'DS' as OutcomeCode, label: 'Disability (DS)' },
              ].map((o) => {
                const active = filter.outcomes.includes(o.code);
                return (
                  <button
                    key={o.code}
                    onClick={() => toggleOutcome(o.code)}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                      active
                        ? 'bg-rose-600 text-white font-semibold'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Demographics: Sex & Age */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Patient Sex & Demographics</label>
            <div className="flex items-center gap-1 mb-2">
              {(['M', 'F', 'UNK'] as SexType[]).map((s) => {
                const active = filter.sex.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleSex(s)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      active
                        ? 'bg-cyan-600 text-white font-semibold'
                        : 'bg-slate-900 border border-slate-800 text-slate-400'
                    }`}
                  >
                    {s === 'M' ? 'Male' : s === 'F' ? 'Female' : 'Unknown'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minimum Report Count Threshold */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Min Disproportionality Count (N₁₁ ≥ {filter.minReportCount})
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={filter.minReportCount}
              onChange={(e) => onChangeFilter({ ...filter, minReportCount: parseInt(e.target.value) || 1 })}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
              <span>1</span>
              <span>3 (Default)</span>
              <span>10</span>
              <span>20</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
