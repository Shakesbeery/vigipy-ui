import React, { useState } from "react";
import { Globe, X, Search, Loader2, CheckCircle2, AlertCircle, Database, ShieldAlert, Cpu, Pill } from "lucide-react";
import { fetchOpenFDAReports, OpenFDARecord } from "../../core/faers/openfda";
import { uploadLocalFile } from "../../services/api";

interface OpenFDAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataIngested: (filePath: string) => void;
}

export const OpenFDAModal: React.FC<OpenFDAModalProps> = ({ isOpen, onClose, onDataIngested }) => {
  const [domain, setDomain] = useState<"drug" | "device">("drug");
  const [queryName, setQueryName] = useState("");
  const [reaction, setReaction] = useState("");
  const [limit, setLimit] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<{ current: number; total: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleQuery = async () => {
    if (!queryName || queryName.trim().length === 0) {
      setErrorMessage(`Please enter a ${domain === "drug" ? "drug substance/brand" : "medical device brand/model"} to search.`);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setFetchProgress(null);
    setStatusMessage(`Connecting to openFDA API (api.fda.gov/${domain}/event.json)...`);

    try {
      const { records, totalFound } = await fetchOpenFDAReports({
        mode: domain,
        drugName: queryName,
        reaction: reaction || undefined,
        limit,
        onProgress: (fetched, total) => {
          setFetchProgress({ current: fetched, total });
          setStatusMessage(`Streaming records from openFDA: ${fetched} ingested (${total.toLocaleString()} found on FDA servers)...`);
        },
      });

      if (records.length === 0) {
        setErrorMessage(`No ${domain === "drug" ? "FAERS drug" : "MAUDE device"} records found matching "${queryName}".`);
        setIsLoading(false);
        return;
      }

      setStatusMessage(`Received ${records.length.toLocaleString()} reports. Formatting CSV and uploading to backend...`);

      // Convert records to CSV format
      const headers = ["case_id", "Product", "Adverse Event", "date", "quarter", "age", "sex", "serious"];
      const rows = records.map((r) => [
        `"${r.caseId}"`,
        `"${r.drugName.replace(/"/g, '""')}"`,
        `"${r.preferredTerm.replace(/"/g, '""')}"`,
        `"${r.date}"`,
        `"${r.quarter}"`,
        r.age ?? "",
        `"${r.sex || "UNK"}"`,
        r.serious ? "1" : "0",
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const safeName = queryName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
      const file = new File([blob], `openfda_${domain}_${safeName}.csv`, { type: "text/csv" });

      const uploadRes = await uploadLocalFile(file);
      onDataIngested(uploadRes.file_path);
      setIsLoading(false);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to query openFDA API. Please check your internet connection.");
      setIsLoading(false);
    }
  };

  const sampleDrugs = ["semaglutide", "pembrolizumab", "atorvastatin", "tirzepatide", "metformin", "lisinopril"];
  const sampleDevices = ["pacemaker", "insulin pump", "coronary stent", "infusion pump", "hip prosthesis", "defibrillator"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">openFDA Live Surveillance Ingestor</h2>
              <p className="text-xs text-slate-400">Official API stream for FDA FAERS (Drugs) &amp; MAUDE (Medical Devices)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Domain Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setDomain("drug")}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition ${
                domain === "drug" ? "bg-cyan-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <Pill className="h-4 w-4" />
              <span>Pharmaceuticals (FAERS)</span>
            </button>
            <button
              type="button"
              onClick={() => setDomain("device")}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition ${
                domain === "device" ? "bg-cyan-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <Cpu className="h-4 w-4" />
              <span>Medical Devices (MAUDE)</span>
            </button>
          </div>

          {/* Search Inputs */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                {domain === "drug" ? "Drug Name / Active Substance" : "Medical Device Brand / Model"}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={queryName}
                  onChange={(e) => setQueryName(e.target.value)}
                  placeholder={domain === "drug" ? "e.g. Semaglutide, Metformin..." : "e.g. Pacemaker, Insulin Pump..."}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Sample Suggestions */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(domain === "drug" ? sampleDrugs : sampleDevices).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setQueryName(item)}
                    className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-300 transition"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Adverse Reaction / Problem Filter <span className="text-slate-500 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="text"
                value={reaction}
                onChange={(e) => setReaction(e.target.value)}
                placeholder="e.g. Pancreatitis, Thrombosis, Malfunction..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Max Records to Stream
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value={100}>100 records (Instant preview)</option>
                <option value={250}>250 records (Standard cohort)</option>
                <option value={500}>500 records (Broad surveillance)</option>
                <option value={1000}>1,000 records (Deep extraction)</option>
              </select>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-xs text-cyan-300 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/60 px-6 py-4 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">Streamed live via openFDA API</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleQuery}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition shadow-sm disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span>{isLoading ? "Streaming..." : "Fetch & Ingest"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
