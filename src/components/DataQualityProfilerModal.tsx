/**
 * Data Quality, Missingness & Deduplication Sanity Profiler Modal
 * Performs pre-ingestion or active-dataset clinical surveillance hygiene checks.
 * Detects suspect duplicate cases, analyzes missingness, and offers 1-click deduplication.
 */

import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Users,
  Copy,
  CheckCircle2,
  Trash2,
  X,
  FileSpreadsheet,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { FAERSRecord } from '../types/vigipy';
import { profileDatasetQuality, deduplicateRecords, DataQualityProfile } from '../core/data_profiler';

interface DataQualityProfilerModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: FAERSRecord[];
  datasetName: string;
  onApplyDeduplication: (cleanedRecords: FAERSRecord[]) => void;
}

export const DataQualityProfilerModal: React.FC<DataQualityProfilerModalProps> = ({
  isOpen,
  onClose,
  records,
  datasetName,
  onApplyDeduplication,
}) => {
  const [dedupSuccess, setDedupSuccess] = useState<number | null>(null);

  const profile: DataQualityProfile = useMemo(() => {
    return profileDatasetQuality(records);
  }, [records]);

  if (!isOpen) return null;

  const handleDeduplicate = () => {
    const { cleaned, duplicatesRemoved } = deduplicateRecords(records);
    setDedupSuccess(duplicatesRemoved);
    onApplyDeduplication(cleaned);
  };

  const scoreColor =
    profile.overallHygieneScore >= 80
      ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
      : profile.overallHygieneScore >= 60
      ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
      : 'text-rose-400 border-rose-500/40 bg-rose-500/10';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Dataset Quality &amp; Deduplication Profiler</span>
                <span className="text-xs text-slate-400 font-normal">·</span>
                <span className="text-xs text-indigo-400 font-mono truncate max-w-[200px]">{datasetName}</span>
              </h2>
              <p className="text-xs text-slate-400">
                Pre-ingestion sanity audit, clinical missingness profiling, and duplicate report mitigation
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

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs">
          {/* Top Score & Hygiene Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${scoreColor}`}>
              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Hygiene Score</span>
              <span className="text-3xl font-extrabold font-mono mt-1">{profile.overallHygieneScore}</span>
              <span className="text-[10px] mt-0.5 opacity-75">out of 100</span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
              <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-indigo-400" />
                <span>Records / Cases</span>
              </span>
              <div className="mt-1">
                <div className="text-lg font-bold text-slate-100 font-mono">
                  {profile.totalRecords.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400">
                  {profile.uniqueCaseIds.toLocaleString()} unique case IDs
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
              <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                <Copy className="h-3.5 w-3.5 text-amber-400" />
                <span>Suspect Duplicates</span>
              </span>
              <div className="mt-1">
                <div className="text-lg font-bold text-amber-300 font-mono">
                  {profile.potentialDuplicateCount.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400">
                  {profile.duplicateGroups.length} duplicate clusters detected
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
              <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-cyan-400" />
                <span>Patient Demographics</span>
              </span>
              <div className="mt-1 text-[11px] space-y-0.5 text-slate-300 font-mono">
                <div>Age: {profile.demographics.medianAge ? `${profile.demographics.medianAge}y (median)` : 'N/A'}</div>
                <div>Sex: {profile.demographics.maleCount}M · {profile.demographics.femaleCount}F · {profile.demographics.unkSexCount}Unk</div>
              </div>
            </div>
          </div>

          {/* Missingness Breakdown Cards */}
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>Field Completeness &amp; Missingness Metrics</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40">
                <div className="text-slate-400 text-[11px]">Missing Age</div>
                <div className="text-base font-bold font-mono text-slate-200 mt-0.5">
                  {profile.missingness.missingAgePct}%
                </div>
                <div className="text-[10px] text-slate-500">{profile.missingness.missingAgeCount} records</div>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40">
                <div className="text-slate-400 text-[11px]">Unspecified Sex</div>
                <div className="text-base font-bold font-mono text-slate-200 mt-0.5">
                  {profile.missingness.missingSexPct}%
                </div>
                <div className="text-[10px] text-slate-500">{profile.missingness.missingSexCount} records</div>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40">
                <div className="text-slate-400 text-[11px]">Unassigned MedDRA SOC</div>
                <div className="text-base font-bold font-mono text-slate-200 mt-0.5">
                  {profile.missingness.unassignedSocPct}%
                </div>
                <div className="text-[10px] text-slate-500">{profile.missingness.unassignedSocCount} records</div>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40">
                <div className="text-slate-400 text-[11px]">No Recorded Outcomes</div>
                <div className="text-base font-bold font-mono text-slate-200 mt-0.5">
                  {profile.missingness.noOutcomesPct}%
                </div>
                <div className="text-[10px] text-slate-500">{profile.missingness.noOutcomesCount} records</div>
              </div>
            </div>
          </div>

          {/* Duplicate Case Clusters */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>Suspect Duplicate Clusters (Matching Demographics &amp; Exposure)</span>
              </h3>
              {profile.potentialDuplicateCount > 0 && (
                <button
                  type="button"
                  onClick={handleDeduplicate}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Deduplicate Dataset ({profile.potentialDuplicateCount} cases)</span>
                </button>
              )}
            </div>

            {dedupSuccess !== null && (
              <div className="mb-3 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  Successfully removed {dedupSuccess} duplicate cases from the active surveillance dataset.
                </span>
              </div>
            )}

            {profile.duplicateGroups.length === 0 ? (
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 text-center text-slate-500">
                No duplicate cases detected based on demographic and product signature matching.
              </div>
            ) : (
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-950/80 text-[11px] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Product Exposure</th>
                      <th className="py-2 px-3">Adverse Reaction / Problem</th>
                      <th className="py-2 px-3">Duplicate Reports</th>
                      <th className="py-2 px-3">Sample Case IDs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {profile.duplicateGroups.slice(0, 8).map((g, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-semibold text-slate-200">{g.drug}</td>
                        <td className="py-2 px-3 text-slate-300">{g.event}</td>
                        <td className="py-2 px-3 text-amber-400 font-bold">{g.count} copies</td>
                        <td className="py-2 px-3 text-slate-500 text-[10px] truncate max-w-[200px]">
                          {g.sampleCases.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-950/70 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
