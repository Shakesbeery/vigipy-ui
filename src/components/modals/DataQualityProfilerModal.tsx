import React, { useState, useEffect } from "react";
import { ShieldCheck, AlertTriangle, Users, Copy, CheckCircle2, Trash2, X, FileSpreadsheet, Activity, Layers, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { DataProfileResponse } from "../../types";
import { fetchDataProfile } from "../../services/api";

interface DataQualityProfilerModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetName?: string;
}

export const DataQualityProfilerModal: React.FC<DataQualityProfilerModalProps> = ({
  isOpen,
  onClose,
  datasetName = "Ingested Dataset",
}) => {
  const [profile, setProfile] = useState<DataProfileResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProfile();
    }
  }, [isOpen]);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDataProfile();
      setProfile(res);
    } catch (err: any) {
      setError(err?.message || "Failed to profile dataset.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                Data Quality & Missingness Profiler
              </h3>
              <p className="text-xs text-slate-400">
                Clinical surveillance pre-ingestion hygiene diagnostics for {datasetName}.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {loading ? (
            <div className="w-full h-64 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-mono">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span>Analyzing missingness, duplicates, and cardinality...</span>
            </div>
          ) : error ? (
            <div className="w-full h-64 flex flex-col items-center justify-center gap-2 text-rose-400 text-xs font-mono">
              <span>{error}</span>
              <button
                onClick={loadProfile}
                className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Profiling</span>
              </button>
            </div>
          ) : profile ? (
            <>
              {/* Hygiene Score Card */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Overall Hygiene Health Score</div>
                  <div className="text-2xl font-bold text-white mt-0.5">{profile.quality_score} / 100</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Evaluated across {profile.total_rows.toLocaleString()} records ({profile.unique_pairs.toLocaleString()} distinct contingency pairs).
                  </div>
                </div>
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500 flex items-center justify-center text-emerald-400 font-bold text-lg">
                  {profile.quality_score}%
                </div>
              </div>

              {/* Missingness Breakdown */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Field Missingness Diagnostics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                    <div className="text-xs text-slate-400">Missing Product</div>
                    <div className="text-lg font-bold text-white mt-1">{profile.missing_product_pct}%</div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-rose-500 h-full" style={{ width: `${Math.min(100, profile.missing_product_pct)}%` }}></div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                    <div className="text-xs text-slate-400">Missing Event (AE)</div>
                    <div className="text-lg font-bold text-white mt-1">{profile.missing_ae_pct}%</div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-rose-500 h-full" style={{ width: `${Math.min(100, profile.missing_ae_pct)}%` }}></div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                    <div className="text-xs text-slate-400">Missing Count</div>
                    <div className="text-lg font-bold text-white mt-1">{profile.missing_count_pct}%</div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-amber-500 h-full" style={{ width: `${Math.min(100, profile.missing_count_pct)}%` }}></div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                    <div className="text-xs text-slate-400">Missing Date</div>
                    <div className="text-lg font-bold text-white mt-1">{profile.missing_date_pct}%</div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-blue-500 h-full" style={{ width: `${Math.min(100, profile.missing_date_pct)}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cardinality & Duplicates */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60">
                  <div className="text-xs text-slate-400">Unique Products</div>
                  <div className="text-xl font-bold text-white mt-1">{profile.unique_products.toLocaleString()}</div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60">
                  <div className="text-xs text-slate-400">Unique Adverse Events</div>
                  <div className="text-xl font-bold text-white mt-1">{profile.unique_aes.toLocaleString()}</div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60">
                  <div className="text-xs text-slate-400">Duplicate Pair Reports</div>
                  <div className="text-xl font-bold text-amber-400 mt-1">{profile.duplicate_cases.toLocaleString()} ({profile.duplicate_case_pct}%)</div>
                </div>
              </div>

              {/* Recommendations */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">Automated Hygiene Recommendations</h4>
                <div className="space-y-2">
                  {profile.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/80 px-6 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
