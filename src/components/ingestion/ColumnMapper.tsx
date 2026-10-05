import React, { useState, useEffect, useMemo } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Table,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Activity,
  Layers,
  Calendar,
  Hash,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  ColumnMappingRequest,
  DataSummaryResponse,
  FilePreviewResponse,
} from "../../types";

export interface ColumnMapperProps {
  preview: FilePreviewResponse;
  onConfirmMapping: (mapping: ColumnMappingRequest) => Promise<void> | void;
  isIngesting?: boolean;
  dispersionSummary?: DataSummaryResponse | null;
  onBack?: () => void;
}

export const ColumnMapper: React.FC<ColumnMapperProps> = ({
  preview,
  onConfirmMapping,
  isIngesting = false,
  dispersionSummary = null,
  onBack,
}) => {
  // Initialize mapping from backend suggestions or first matching columns
  const [productCol, setProductCol] = useState<string>(
    preview.suggested_mapping?.product_col || ""
  );
  const [aeCol, setAeCol] = useState<string>(
    preview.suggested_mapping?.ae_col || ""
  );
  const [countCol, setCountCol] = useState<string>(
    preview.suggested_mapping?.count_col || ""
  );
  const [dateCol, setDateCol] = useState<string>(
    preview.suggested_mapping?.date_col || ""
  );

  // If no count column was suggested, default auto_populate_count to true
  const [autoPopulateCount, setAutoPopulateCount] = useState<boolean>(
    !preview.suggested_mapping?.count_col
  );
  const [defaultCount, setDefaultCount] = useState<number>(1);
  const [showTablePreview, setShowTablePreview] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-select fallback if suggested was not found
  useEffect(() => {
    if (!productCol && preview.columns.length > 0) {
      const match = preview.columns.find((c) =>
        /product|brand|drug|device|substance/i.test(c)
      );
      if (match) setProductCol(match);
    }
    if (!aeCol && preview.columns.length > 0) {
      const match = preview.columns.find((c) =>
        /event|ae|reaction|pt|term/i.test(c)
      );
      if (match) setAeCol(match);
    }
  }, [preview.columns]);

  // Extract distinct sample values for a column
  const getSampleValues = (colName: string): string[] => {
    if (!colName || !preview.preview_rows) return [];
    const samples: string[] = [];
    for (const row of preview.preview_rows) {
      const val = row[colName];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        const strVal = String(val);
        if (!samples.includes(strVal)) {
          samples.push(strVal);
        }
      }
      if (samples.length >= 3) break;
    }
    return samples;
  };

  const productSamples = useMemo(() => getSampleValues(productCol), [productCol, preview]);
  const aeSamples = useMemo(() => getSampleValues(aeCol), [aeCol, preview]);
  const countSamples = useMemo(() => getSampleValues(countCol), [countCol, preview]);
  const dateSamples = useMemo(() => getSampleValues(dateCol), [dateCol, preview]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!productCol) {
      setErrorMessage("Please select a Product / Brand column.");
      return;
    }
    if (!aeCol) {
      setErrorMessage("Please select an Adverse Event column.");
      return;
    }
    if (productCol === aeCol) {
      setErrorMessage("Product and Adverse Event columns must be different.");
      return;
    }
    if (!autoPopulateCount && !countCol) {
      setErrorMessage(
        "Please select a Count column, or enable 'Auto-populate Count' for unaggregated case reports."
      );
      return;
    }

    const payload: ColumnMappingRequest = {
      file_path: preview.file_path,
      product_col: productCol,
      ae_col: aeCol,
      count_col: autoPopulateCount ? null : countCol || null,
      date_col: dateCol ? dateCol : null,
      auto_populate_count: autoPopulateCount,
      default_count: defaultCount > 0 ? defaultCount : 1,
    };

    onConfirmMapping(payload);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <h2 className="text-base font-semibold text-white tracking-tight">
              Schema & Contingency Column Alignment
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono truncate max-w-xl">
            Source: <span className="text-slate-300">{preview.file_path}</span> (
            {preview.total_rows.toLocaleString()} detected rows, {preview.columns.length} columns)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={isIngesting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{dispersionSummary ? "Cancel" : "Back"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowTablePreview(!showTablePreview)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              showTablePreview
                ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>{showTablePreview ? "Hide Data Table" : "Inspect Raw Rows"}</span>
          </button>
        </div>
      </div>

      {/* Pre-Flight Diagnostic Badge */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">
                  Pre-Flight Statistical Diagnostics:
                </span>
                {dispersionSummary?.dispersion !== undefined && dispersionSummary?.dispersion !== null ? (
                  dispersionSummary.dispersion > 2.0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Overdispersed (Φ = {dispersionSummary.dispersion.toFixed(2)})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Equidispersed (Φ = {dispersionSummary.dispersion.toFixed(2)})
                    </span>
                  )
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Auto-Calibration Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {dispersionSummary?.recommended_expected_method === "negative-binomial" ? (
                  <>
                    Variance exceeds mean (Φ &gt; 2.0). Recommended expectation:{" "}
                    <span className="text-amber-300 font-medium">Negative-Binomial</span> to protect against false positives.
                  </>
                ) : dispersionSummary?.recommended_expected_method === "mantel-haentzel" ? (
                  <>
                    Standard variance (Φ ≤ 2.0). Recommended expectation:{" "}
                    <span className="text-emerald-300 font-medium">Mantel-Haenszel (Multinomial)</span> for optimal statistical power.
                  </>
                ) : (
                  <>
                    During ingestion, vigipy calculates dispersion index Φ = Var(O)/E(O) and recommends Mantel-Haenszel vs. Negative-Binomial expectations.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-slate-500">Expectation Engine:</span>
            <span
              className={`font-semibold ${
                dispersionSummary?.recommended_expected_method === "negative-binomial"
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {dispersionSummary?.recommended_expected_method === "negative-binomial"
                ? "Negative-Binomial"
                : "Mantel-Haenszel"}
            </span>
          </div>
        </div>
      </div>

      {/* Raw Data Preview Table (Expandable) */}
      {showTablePreview && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              <span>Previewing First {preview.preview_rows.length} Raw Records</span>
            </div>
            <span className="font-mono text-[11px]">Sticky Table View</span>
          </div>
          <div className="overflow-x-auto max-h-64 border border-slate-800/80 rounded-lg">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead className="bg-slate-900 sticky top-0 border-b border-slate-800 text-slate-300 select-none">
                <tr>
                  <th className="px-3 py-2 text-slate-500 w-12 text-center">#</th>
                  {preview.columns.map((col) => {
                    const isProd = col === productCol;
                    const isAe = col === aeCol;
                    const isCount = !autoPopulateCount && col === countCol;
                    const isDate = col === dateCol;
                    return (
                      <th
                        key={col}
                        className={`px-3 py-2 whitespace-nowrap ${
                          isProd
                            ? "bg-blue-950/60 text-blue-300 border-b-2 border-blue-500"
                            : isAe
                            ? "bg-purple-950/60 text-purple-300 border-b-2 border-purple-500"
                            : isCount
                            ? "bg-emerald-950/60 text-emerald-300 border-b-2 border-emerald-500"
                            : isDate
                            ? "bg-amber-950/60 text-amber-300 border-b-2 border-amber-500"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{col}</span>
                          {isProd && <span className="text-[10px] text-blue-400 font-bold">(Product)</span>}
                          {isAe && <span className="text-[10px] text-purple-400 font-bold">(AE)</span>}
                          {isCount && <span className="text-[10px] text-emerald-400 font-bold">(Count)</span>}
                          {isDate && <span className="text-[10px] text-amber-400 font-bold">(Date)</span>}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                {preview.preview_rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/50 transition">
                    <td className="px-3 py-1.5 text-slate-600 text-center">{idx + 1}</td>
                    {preview.columns.map((col) => {
                      const isProd = col === productCol;
                      const isAe = col === aeCol;
                      const isCount = !autoPopulateCount && col === countCol;
                      const isDate = col === dateCol;
                      return (
                        <td
                          key={col}
                          className={`px-3 py-1.5 whitespace-nowrap truncate max-w-xs ${
                            isProd
                              ? "bg-blue-950/20 text-blue-200"
                              : isAe
                              ? "bg-purple-950/20 text-purple-200"
                              : isCount
                              ? "bg-emerald-950/20 text-emerald-200"
                              : isDate
                              ? "bg-amber-950/20 text-amber-200"
                              : "text-slate-400"
                          }`}
                        >
                          {row[col] !== undefined && row[col] !== null ? String(row[col]) : "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Mapping Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 1. Product / Brand Column */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Product / Substance / Medical Device</span>
                <span className="text-rose-400">*</span>
              </label>
              <span className="text-[10px] font-mono uppercase text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                Mandatory
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Identifies the drug, vaccine, or medical device brand/substance name.
            </p>

            <select
              value={productCol}
              onChange={(e) => setProductCol(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500 transition"
              required
            >
              <option value="" disabled>
                -- Select Product Column --
              </option>
              {preview.columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Sample Values Chips */}
            {productSamples.length > 0 && (
              <div className="pt-2">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
                  Sample values:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {productSamples.map((s, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-blue-950/40 border border-blue-800/40 text-[11px] text-blue-300 font-mono truncate max-w-xs"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Adverse Event Column */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <span>Adverse Event / MedDRA Reaction</span>
                <span className="text-rose-400">*</span>
              </label>
              <span className="text-[10px] font-mono uppercase text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                Mandatory
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Preferred Term (PT) or standardized concept for the clinical incident.
            </p>

            <select
              value={aeCol}
              onChange={(e) => setAeCol(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-purple-500 transition"
              required
            >
              <option value="" disabled>
                -- Select Adverse Event Column --
              </option>
              {preview.columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Sample Values Chips */}
            {aeSamples.length > 0 && (
              <div className="pt-2">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
                  Sample values:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {aeSamples.map((s, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-purple-950/40 border border-purple-800/40 text-[11px] text-purple-300 font-mono truncate max-w-xs"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Incident Count Column & Auto-Populate Section */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Hash className="w-3.5 h-3.5 text-emerald-400" />
                <span>Incident Count Column</span>
              </label>
              <span className="text-[10px] font-mono uppercase text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                Conditional
              </span>
            </div>

            {/* Prominent Auto-Populate Toggle */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoPopulateCount}
                  onChange={(e) => setAutoPopulateCount(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-slate-200 block">
                    Auto-populate Count (for unaggregated case reports without count)
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Enable for raw FAERS/MAUDE/VAERS individual case safety reports (1 row = 1 incident).
                  </p>
                </div>
              </label>

              {autoPopulateCount && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-300">Default count per report:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={defaultCount}
                      onChange={(e) => setDefaultCount(parseInt(e.target.value, 10) || 1)}
                      className="w-20 px-2.5 py-1 text-center bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs font-mono text-slate-500">incident(s)</span>
                  </div>
                </div>
              )}
            </div>

            {!autoPopulateCount && (
              <div className="space-y-2">
                <select
                  value={countCol}
                  onChange={(e) => setCountCol(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500 transition"
                  required={!autoPopulateCount}
                >
                  <option value="">-- Select Numeric Count Column --</option>
                  {preview.columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {countSamples.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {countSamples.map((s, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-[11px] text-emerald-300 font-mono"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Report / Event Date Column */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Date Column (Longitudinal Surveillance)</span>
              </label>
              <span className="text-[10px] font-mono uppercase text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                Optional
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Required if you wish to run time-sliced dynamic longitudinal trajectory tracking.
            </p>

            <select
              value={dateCol}
              onChange={(e) => setDateCol(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500 transition"
            >
              <option value="">-- None / Do not track longitudinal trajectory --</option>
              {preview.columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Sample Values Chips */}
            {dateSamples.length > 0 && (
              <div className="pt-2">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
                  Sample values:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {dateSamples.map((s, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/40 text-[11px] text-amber-300 font-mono truncate max-w-xs"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Validation Error Banner */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Confirmation Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 space-y-0.5 text-center sm:text-left">
            <p className="font-semibold text-slate-300">
              Ready to construct Contingency Table & DataContainer
            </p>
            <p className="text-[11px]">
              vigipy will aggregate {preview.total_rows.toLocaleString()} reports into unique Product-AE pairs.
            </p>
          </div>

          <button
            type="submit"
            disabled={isIngesting || !productCol || !aeCol}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-emerald-600/25 transition active:scale-95"
          >
            {isIngesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Ingesting Dataset & Computing Expectations...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{dispersionSummary ? "Apply Columns & Re-ingest" : "Confirm & Ingest Dataset"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
