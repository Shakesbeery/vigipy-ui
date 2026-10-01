/**
 * Interactive Column Mapping Studio Modal
 * Allows users to inspect uploaded raw data and map specific file columns
 * to Disproportionality Analysis (DA) dimensions (Drug, Event/PT, Role, Date, Demographics).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Columns, CheckCircle2, AlertTriangle, X, ArrowRight, Eye, Table2 } from 'lucide-react';
import { ColumnMappingConfig, RawParsedTable } from '../types/version';
import { convertRawTableToFAERSRecords, autoDetectMapping } from '../core/faers/parser';
import { DisproportionalityMethod, FAERSRecord } from '../types/vigipy';
import { MethodPicker } from './MethodPicker';

interface ColumnMapperModalProps {
  isOpen: boolean;
  rawTable: RawParsedTable | null;
  onClose: () => void;
  onConfirmMapping: (records: FAERSRecord[], title: string, chosenMethods?: DisproportionalityMethod[]) => void;
  initialMethods?: DisproportionalityMethod[];
}

export const ColumnMapperModal: React.FC<ColumnMapperModalProps> = ({
  isOpen,
  rawTable,
  onClose,
  onConfirmMapping,
  initialMethods = ['PRR', 'ROR', 'RFET', 'BCPNN', 'GPS', 'LASSO'],
}) => {
  const [selectedMethods, setSelectedMethods] = useState<DisproportionalityMethod[]>(initialMethods || ['PRR', 'ROR', 'RFET', 'BCPNN', 'GPS', 'LASSO']);
  const [mapping, setMapping] = useState<ColumnMappingConfig>({
    drugCol: '',
    eventCol: '',
    countCol: '',
    substanceCol: '',
    strataCol: '',
    caseIdCol: '',
    roleCol: '',
    dateCol: '',
    socCol: '',
    ageCol: '',
    sexCol: '',
    seriousCol: '',
    outcomeCol: '',
  });

  const [error, setError] = useState<string | null>(null);

  // Auto-detect matching headers when a table is loaded
  useEffect(() => {
    if (!rawTable || !rawTable.headers || rawTable.headers.length === 0) return;
    const detected = autoDetectMapping(rawTable.headers);
    setMapping(detected);
    setError(null);
  }, [rawTable]);

  // Preview the first 3 mapped pairs - Must be called before any early returns to satisfy React Hook rules
  const previewMappedRows = useMemo(() => {
    if (!rawTable || !mapping.drugCol || !mapping.eventCol) return [];
    const headers = rawTable.headers || [];
    const drugIdx = headers.indexOf(mapping.drugCol);
    const eventIdx = headers.indexOf(mapping.eventCol);
    if (drugIdx === -1 || eventIdx === -1) return [];

    const sample = rawTable.sampleRows || [];
    return sample.slice(0, 3).map((r, i) => {
      if (!r || !Array.isArray(r)) return null;
      const roleIdx = mapping.roleCol ? headers.indexOf(mapping.roleCol) : -1;
      const dateIdx = mapping.dateCol ? headers.indexOf(mapping.dateCol) : -1;
      const countIdx = mapping.countCol ? headers.indexOf(mapping.countCol) : -1;
      return {
        id: i + 1,
        drug: (r[drugIdx] || '').trim() || '—',
        event: (r[eventIdx] || '').trim() || '—',
        count: countIdx >= 0 && r[countIdx] ? r[countIdx] : '1',
        role: roleIdx >= 0 && r[roleIdx] ? r[roleIdx] : 'PS',
        date: dateIdx >= 0 && r[dateIdx] ? r[dateIdx] : '2024Q1',
      };
    }).filter(Boolean) as { id: number; drug: string; event: string; count: string; role: string; date: string }[];
  }, [rawTable, mapping]);

  if (!isOpen || !rawTable) return null;

  const handleApply = () => {
    if (!mapping.drugCol) {
      setError('Please select a column for the Product / Drug / Treatment.');
      return;
    }
    if (!mapping.eventCol) {
      setError('Please select a column for the Adverse Event / Reaction / Outcome.');
      return;
    }

    try {
      const records = convertRawTableToFAERSRecords(rawTable, mapping);
      if (records.length === 0) {
        setError('No valid records could be extracted from the mapped columns. Check column selections.');
        return;
      }
      onConfirmMapping(records, `Mapped: ${rawTable.fileName} (${records.length.toLocaleString()} rows)`, selectedMethods);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error converting mapped table.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Columns className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Disproportionality Analysis Column Mapping</h2>
                <span className="rounded bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-[10px] text-indigo-300 font-mono">
                  {rawTable.totalRows.toLocaleString()} rows detected
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Map columns from <strong className="text-slate-200 font-mono">{rawTable.fileName}</strong> to vigipy analysis dimensions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Raw File Preview */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5 text-xs">
                <Table2 className="h-4 w-4 text-cyan-400" />
                Raw Data Sample Preview (First {rawTable.sampleRows.length} rows)
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {rawTable.headers.length} Columns
              </span>
            </div>
            <div className="overflow-x-auto max-h-40 border border-slate-800/80 rounded-lg">
              <table className="w-full text-left text-[11px] border-collapse font-mono">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                    {rawTable.headers.map((h, i) => (
                      <th key={i} className="py-1.5 px-3 whitespace-nowrap font-medium text-slate-300">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300">
                  {rawTable.sampleRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-900/60">
                      {row.map((val, cIdx) => (
                        <td key={cIdx} className="py-1.5 px-3 whitespace-nowrap">
                          {val || <span className="text-slate-600">null</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Mapping Form */}
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
              Configure Disproportionality Analysis Dimensions
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Product Column (Required) */}
              <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-950/20">
                <label className="block text-indigo-300 font-semibold mb-1 flex items-center justify-between">
                  <span>Product / Device / Treatment *</span>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-200 px-1.5 py-0.5 rounded">REQUIRED</span>
                </label>
                <select
                  value={mapping.drugCol}
                  onChange={(e) => setMapping({ ...mapping, drugCol: e.target.value })}
                  className="w-full rounded-lg border border-indigo-500/40 bg-slate-950 px-2.5 py-1.5 text-slate-100 font-mono"
                >
                  <option value="">-- Select Product / Exposure Column --</option>
                  {rawTable.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">e.g. device_name, medicinalproduct, treatment, drug</span>
              </div>

              {/* Event / Outcome / Malfunction Column (Required) */}
              <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/20">
                <label className="block text-rose-300 font-semibold mb-1 flex items-center justify-between">
                  <span>Event / Outcome / Malfunction *</span>
                  <span className="text-[10px] bg-rose-500/20 text-rose-200 px-1.5 py-0.5 rounded">REQUIRED</span>
                </label>
                <select
                  value={mapping.eventCol}
                  onChange={(e) => setMapping({ ...mapping, eventCol: e.target.value })}
                  className="w-full rounded-lg border border-rose-500/40 bg-slate-950 px-2.5 py-1.5 text-slate-100 font-mono"
                >
                  <option value="">-- Select Outcome / Event Column --</option>
                  {rawTable.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">e.g. malfunction_code, reaction, pt, complication</span>
              </div>

              {/* Count / Report Frequency Column (New - vigipy count_label argument) */}
              <div className="p-3 rounded-xl border border-cyan-500/30 bg-cyan-950/20">
                <label className="block text-cyan-300 font-semibold mb-1 flex items-center justify-between">
                  <span>Report Count / Weight</span>
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-200 px-1.5 py-0.5 rounded font-mono">
                    vigipy count_col
                  </span>
                </label>
                <select
                  value={mapping.countCol || ''}
                  onChange={(e) => setMapping({ ...mapping, countCol: e.target.value })}
                  className="w-full rounded-lg border border-cyan-500/40 bg-slate-950 px-2.5 py-1.5 text-slate-100 font-mono"
                >
                  <option value="">-- Individual Case Reports (1 per row) --</option>
                  {rawTable.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Aggregated tables: maps to count_label in vigipy.convert()
                </span>
              </div>

              {/* Case ID Column */}
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
                <label className="block text-slate-300 font-medium mb-1">
                  Report / Case ID (Optional)
                </label>
                <select
                  value={mapping.caseIdCol || ''}
                  onChange={(e) => setMapping({ ...mapping, caseIdCol: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-slate-200 font-mono"
                >
                  <option value="">-- Auto-generate IDs --</option>
                  {rawTable.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">Groups multiple drugs/events per case</span>
              </div>

              {/* Role Column */}
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
                <label className="block text-slate-300 font-medium mb-1">
                  Drug Suspect Role (Optional)
                </label>
                <select
                  value={mapping.roleCol || ''}
                  onChange={(e) => setMapping({ ...mapping, roleCol: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-slate-200 font-mono"
                >
                  <option value="">-- Default to Primary Suspect (PS) --</option>
                  {rawTable.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">PS, SS, C (Concomitant), I (Interacting)</span>
              </div>

              {/* Date / Quarter Column */}
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
                <label className="block text-slate-300 font-medium mb-1">
                  Date / Quarter (For Longitudinal DA)
                </label>
                <select
                  value={mapping.dateCol || ''}
                  onChange={(e) => setMapping({ ...mapping, dateCol: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-slate-200 font-mono"
                >
                  <option value="">-- None / Default 2023Q1 --</option>
                  {rawTable.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">Enables Longitudinal emergence modeling</span>
              </div>

              {/* System Organ Class (SOC) */}
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
                <label className="block text-slate-300 font-medium mb-1">
                  System Organ Class (SOC)
                </label>
                <select
                  value={mapping.socCol || ''}
                  onChange={(e) => setMapping({ ...mapping, socCol: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-slate-200 font-mono"
                >
                  <option value="">-- None / Unspecified --</option>
                  {rawTable.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">Hierarchical MedDRA grouping</span>
              </div>

              {/* Age */}
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
                <label className="block text-slate-300 font-medium mb-1">
                  Patient Age
                </label>
                <select
                  value={mapping.ageCol || ''}
                  onChange={(e) => setMapping({ ...mapping, ageCol: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-slate-200 font-mono"
                >
                  <option value="">-- None --</option>
                  {rawTable.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sex */}
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
                <label className="block text-slate-300 font-medium mb-1">
                  Patient Sex
                </label>
                <select
                  value={mapping.sexCol || ''}
                  onChange={(e) => setMapping({ ...mapping, sexCol: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-slate-200 font-mono"
                >
                  <option value="">-- None --</option>
                  {rawTable.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seriousness */}
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
                <label className="block text-slate-300 font-medium mb-1">
                  Seriousness / Outcome
                </label>
                <select
                  value={mapping.seriousCol || ''}
                  onChange={(e) => setMapping({ ...mapping, seriousCol: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-slate-200 font-mono"
                >
                  <option value="">-- None --</option>
                  {rawTable.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Substance / Generic Molecule Name */}
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
                <label className="block text-slate-300 font-medium mb-1">
                  Active Substance / Molecule (Optional)
                </label>
                <select
                  value={mapping.substanceCol || ''}
                  onChange={(e) => setMapping({ ...mapping, substanceCol: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-slate-200 font-mono"
                >
                  <option value="">-- None / Use Product Name --</option>
                  {rawTable.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">Active pharmaceutical ingredient (API)</span>
              </div>

              {/* Stratification Factor / Strata */}
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
                <label className="block text-slate-300 font-medium mb-1">
                  Stratification Factor (Strata)
                </label>
                <select
                  value={mapping.strataCol || ''}
                  onChange={(e) => setMapping({ ...mapping, strataCol: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-slate-200 font-mono"
                >
                  <option value="">-- Unstratified / Single Cohort --</option>
                  {rawTable.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">For Mantel-Haenszel stratified expectations</span>
              </div>
            </div>
          </div>

          {/* Method Picker for this Analysis */}
          <MethodPicker
            selectedMethods={selectedMethods}
            onChange={setSelectedMethods}
            title="Analysis Methods to Execute for this Dataset"
            subtitle="Pick which statistical disproportionality algorithms will be evaluated on the ingested cohort."
          />

          {/* Validation & Preview Output */}
          {previewMappedRows.length > 0 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5">
              <span className="font-semibold text-emerald-300 flex items-center gap-1.5 text-xs mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Live Validation: Extracted Signal Candidate Preview
              </span>
              <div className="space-y-1.5 font-mono text-[11px]">
                {previewMappedRows.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-slate-300 bg-slate-950/60 p-2 rounded border border-emerald-900/40">
                    <span className="text-rose-400 font-bold">{p.drug}</span>
                    <span className="text-slate-500">→</span>
                    <span className="text-cyan-300">{p.event}</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-cyan-400 text-[10px] font-bold">Count: {p.count}</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400 text-[10px]">Role: {p.role}</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400 text-[10px]">Period: {p.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/70 px-6 py-4 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Selected dimensions will feed directly into contingency calculation & DA scoring.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!mapping.drugCol || !mapping.eventCol}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-lg shadow-indigo-600/20"
            >
              <span>Confirm Mapping & Ingest</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
