import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  X,
  Database,
  Loader2,
  Play,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Filter,
  Sparkles,
  Layers,
  Pill,
  Syringe,
  Activity,
  Globe,
  Check,
} from "lucide-react";

type SourceType = "ALL" | "FAERS" | "VAERS" | "MAUDE";
type FormatType = "contingency" | "binary" | "microdata";

interface CatItem {
  name: string;
  n_cases: number;
  n_products?: number;
  n_events?: number;
  category?: string;
  source?: string;
}

interface Catalog {
  source: string;
  categories_l1: CatItem[];
  categories_l2: CatItem[];
  top_products: CatItem[];
  top_events: CatItem[];
  year_range: (number | null)[];
}

interface Preview {
  estimated_cases: number;
  distinct_products: number;
  distinct_events: number;
  sample_rows: any[];
  columns: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDataIngested: (filePath: string) => void;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

const fmt = (n?: number | null) => (n == null ? "—" : n.toLocaleString());

export const VigilanceWarehouseModal: React.FC<Props> = ({ isOpen, onClose, onDataIngested }) => {
  const [source, setSource] = useState<SourceType>("ALL");
  const [status, setStatus] = useState<any>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedL1, setSelectedL1] = useState<string[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<CatItem[]>([]);
  const [yearStart, setYearStart] = useState<string>("");
  const [yearEnd, setYearEnd] = useState<string>("");
  const [seriousOnly, setSeriousOnly] = useState(false);
  const [diedOnly, setDiedOnly] = useState(false);
  const [sex, setSex] = useState<string>("");
  const [minCount, setMinCount] = useState<number>(10);
  const [format, setFormat] = useState<FormatType>("contingency");
  const [productLevel, setProductLevel] = useState<string>("normalized_name");
  const [destPath, setDestPath] = useState("");

  // Preview state
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const ready = !!status?.ready;
  const job = status?.job;

  const refreshStatus = useCallback(async () => {
    try {
      const st = await api<any>("/api/warehouse/status");
      setStatus(st);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const loadCatalog = useCallback(async (src: SourceType) => {
    setCatalogLoading(true);
    try {
      const cat = await api<Catalog>(`/api/warehouse/catalog?source=${src}`);
      setCatalog(cat);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    refreshStatus();
    loadCatalog(source);
    const t = setInterval(refreshStatus, 3000);
    return () => clearInterval(t);
  }, [isOpen, refreshStatus, loadCatalog, source]);

  // Reset selections when changing source
  const handleSourceChange = (newSrc: SourceType) => {
    setSource(newSrc);
    setSelectedL1([]);
    setPreview(null);
    setSearchQ("");
    setSearchResults([]);
    loadCatalog(newSrc);
  };

  // Search entities
  useEffect(() => {
    if (!ready || searchQ.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const h = setTimeout(async () => {
      try {
        const r = await api<{ results: CatItem[] }>(
          `/api/warehouse/search?source=${source}&q=${encodeURIComponent(searchQ.trim())}&kind=product&limit=30`
        );
        setSearchResults(r.results);
      } catch (e: any) {
        setError(e.message);
      }
    }, 300);
    return () => clearTimeout(h);
  }, [searchQ, source, ready]);

  const spec = useMemo(
    () => ({
      source: source === "ALL" ? null : source,
      category_l1: selectedL1.length > 0 ? selectedL1 : null,
      year_start: yearStart ? Number(yearStart) : null,
      year_end: yearEnd ? Number(yearEnd) : null,
      serious_only: seriousOnly,
      died_only: diedOnly,
      sex: sex || null,
      min_count: minCount,
      product_level: productLevel,
    }),
    [source, selectedL1, yearStart, yearEnd, seriousOnly, diedOnly, sex, minCount, productLevel]
  );

  const runPreview = async () => {
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await api<Preview>("/api/warehouse/preview", {
        method: "POST",
        body: JSON.stringify(spec),
      });
      setPreview(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const runExport = async (loadIntoApp: boolean) => {
    setError(null);
    const payload = {
      spec,
      format,
      product_level: productLevel,
      min_count: minCount,
      dest_path: destPath.trim() || undefined,
      load_into_app: loadIntoApp,
    };
    try {
      await api("/api/warehouse/export", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      refreshStatus();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Watch job completion for 1-click load into app
  useEffect(() => {
    if (job?.status === "completed" && job?.result?.loaded_into_app && job?.result?.file_path) {
      onDataIngested(job.result.file_path);
      onClose();
    }
  }, [job, onDataIngested, onClose]);

  const toggleL1 = (name: string) => {
    setSelectedL1((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  };

  if (!isOpen) return null;

  const l1Title =
    source === "FAERS"
      ? "Drug Families (WHO INN)"
      : source === "VAERS"
      ? "Target Pathogens / Diseases"
      : source === "MAUDE"
      ? "FDA Advisory Panels"
      : "Primary Categories (All Sources)";

  const itemsList: CatItem[] =
    searchQ.length >= 2
      ? searchResults
      : catalog?.categories_l1 || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-6xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20 ring-1 ring-white/20">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-tight">Vigilance Data Warehouse Explorer</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  safety-db v0.1.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cross-surveillance repository for FAERS (Drugs), VAERS (Vaccines), and MAUDE (Medical Devices)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Switcher Tabs */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-2">Surveillance Domain:</span>
            {[
              { id: "ALL", label: "All Sources", icon: Globe, color: "text-indigo-400" },
              { id: "FAERS", label: "FAERS (Drugs)", icon: Pill, color: "text-teal-400" },
              { id: "VAERS", label: "VAERS (Vaccines)", icon: Syringe, color: "text-amber-400" },
              { id: "MAUDE", label: "MAUDE (Devices)", icon: Activity, color: "text-sky-400" },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = source === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSourceChange(tab.id as SourceType)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    active
                      ? "bg-slate-800 text-white border-slate-600 shadow-sm"
                      : "bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800/60 hover:text-slate-300"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${tab.color}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${ready ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              <span className={ready ? "text-emerald-400 font-semibold" : "text-amber-400"}>
                {ready ? "DuckDB Core Connected" : "Connecting..."}
              </span>
            </div>
            {status?.total_cases > 0 && (
              <span className="text-slate-400 border-l border-slate-800 pl-3">
                {fmt(status.total_cases)} available records
              </span>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="px-6 py-2.5 bg-red-950/40 border-b border-red-800/60 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Main Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-12 gap-0 divide-x divide-slate-800">
          {/* Left Column: Categories & Entity Pickers (5 cols) */}
          <div className="col-span-5 p-5 flex flex-col gap-3 overflow-hidden bg-slate-950/20">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-teal-400" />
                <span>{l1Title}</span>
              </label>
              {selectedL1.length > 0 && (
                <button onClick={() => setSelectedL1([])} className="text-[11px] text-teal-400 hover:underline">
                  Clear ({selectedL1.length})
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={`Search ${source === "FAERS" ? "drugs..." : source === "VAERS" ? "vaccines..." : "products or categories..."}`}
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/80"
              />
              {searchQ && (
                <button onClick={() => setSearchQ("")} className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Entity List */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 border border-slate-800/80 rounded-xl bg-slate-950/40 p-2">
              {catalogLoading ? (
                <div className="flex items-center justify-center h-48 text-slate-500 text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                  <span>Loading catalog...</span>
                </div>
              ) : itemsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs text-center p-4">
                  <span>No matching items found.</span>
                  <span className="text-[11px] text-slate-600 mt-1">Try searching for a specific product name or term.</span>
                </div>
              ) : (
                itemsList.map((item) => {
                  const isChecked = selectedL1.includes(item.name);
                  return (
                    <button
                      key={item.name}
                      onClick={() => toggleL1(item.name)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition ${
                        isChecked
                          ? "bg-teal-500/15 border border-teal-500/40 text-teal-200"
                          : "hover:bg-slate-800/60 text-slate-300 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                            isChecked ? "bg-teal-500 border-teal-400 text-slate-950" : "border-slate-700 bg-slate-900"
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="truncate font-medium">{item.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">
                        {fmt(item.n_cases)} cases
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Parameters, Preview & Execution (7 cols) */}
          <div className="col-span-7 p-5 flex flex-col gap-4 overflow-y-auto bg-slate-900/60">
            {/* Filter Controls Grid */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-teal-400" />
                <span>Epidemiological & Analytical Filters</span>
              </label>

              <div className="grid grid-cols-3 gap-3">
                {/* Year Range */}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Start Year</label>
                  <input
                    type="number"
                    placeholder="e.g. 2020"
                    value={yearStart}
                    onChange={(e) => setYearStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">End Year</label>
                  <input
                    type="number"
                    placeholder="e.g. 2026"
                    value={yearEnd}
                    onChange={(e) => setYearEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                {/* Sex */}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Sex</label>
                  <select
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="">All / Unspecified</option>
                    <option value="F">Female (F)</option>
                    <option value="M">Male (M)</option>
                  </select>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seriousOnly}
                    onChange={(e) => setSeriousOnly(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-teal-500 focus:ring-0"
                  />
                  <span>Serious reports only</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={diedOnly}
                    onChange={(e) => setDiedOnly(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-teal-500 focus:ring-0"
                  />
                  <span>Fatal outcomes only</span>
                </label>
              </div>

              {/* Output Format and Min Count */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Analytical Target Format</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as FormatType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="contingency">Contingency Matrix ([name, AE, count]) — Fast</option>
                    <option value="binary">Binary Report Matrix (with Covariates)</option>
                    <option value="microdata">Full Microdata Records (Audit)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Min Pair Count Threshold</label>
                  <input
                    type="number"
                    min="1"
                    value={minCount}
                    onChange={(e) => setMinCount(Number(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Preview Section */}
            <div className="border border-slate-800 rounded-xl bg-slate-950/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Matched Cohort Estimation</span>
                <button
                  onClick={runPreview}
                  disabled={previewLoading}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
                >
                  {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-teal-400" />}
                  <span>Estimate Volume</span>
                </button>
              </div>

              {preview ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <div className="text-[11px] text-slate-400">Est. Reports</div>
                      <div className="text-sm font-semibold text-teal-400">{fmt(preview.estimated_cases)}</div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <div className="text-[11px] text-slate-400">Products</div>
                      <div className="text-sm font-semibold text-indigo-400">{fmt(preview.distinct_products)}</div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <div className="text-[11px] text-slate-400">Adverse Events</div>
                      <div className="text-sm font-semibold text-amber-400">{fmt(preview.distinct_events)}</div>
                    </div>
                  </div>

                  {preview.sample_rows.length > 0 && (
                    <div className="text-[11px] text-slate-400">
                      <span>Sample preview: </span>
                      <span className="text-slate-300 font-mono">
                        {preview.sample_rows.slice(0, 3).map((r) => `${r.productName || r.name} → ${r.preferredTerm || r.AE}`).join("; ")}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-500 text-center py-2">
                  Click &ldquo;Estimate Volume&rdquo; to test filters and preview cohort counts before export.
                </div>
              )}
            </div>

            {/* Execution Status / Progress */}
            {job?.status === "running" && (
              <div className="p-3 bg-teal-500/10 border border-teal-500/30 rounded-xl text-xs flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-teal-400 animate-spin shrink-0" />
                <div className="flex-1">
                  <div className="text-teal-300 font-medium">Export in progress...</div>
                  <div className="text-[11px] text-slate-400 font-mono">{job.step}</div>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="mt-auto pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={() => runExport(false)}
                disabled={job?.status === "running"}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-medium text-slate-200 border border-slate-700 transition"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Export to Disk</span>
              </button>

              <button
                onClick={() => runExport(true)}
                disabled={job?.status === "running"}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 text-xs font-semibold text-white shadow-lg shadow-teal-600/20 transition"
              >
                {job?.status === "running" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                <span>Load into Analysis Workspace (1-Click)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
