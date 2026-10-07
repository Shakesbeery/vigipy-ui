import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X, Database, Download, Loader2, Play, Layers, Search, FolderOutput, CheckCircle2, AlertCircle } from "lucide-react";

type CohortType = "all" | "drug_family" | "indication_area" | "indication_pt" | "drugs";

interface CatItem { name: string; n_cases: number; n_drugs?: number; n_pts?: number; family?: string; area?: string }
interface Catalog { drug_families: CatItem[]; indication_areas: CatItem[]; top_drugs: CatItem[]; year_range: string[] | null }
interface Preview { n_rows: number; n_cases: number; n_drugs: number; n_events: number; xlsx_ok: boolean; top_drugs: CatItem[] }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDataIngested: (filePath: string) => void;
}

const COHORT_LABELS: Record<CohortType, string> = {
  all: "All drugs together",
  drug_family: "Drug families",
  indication_area: "Therapeutic indication areas",
  indication_pt: "Specific indications (MedDRA PT)",
  drugs: "Hand-picked drugs",
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

const fmt = (n?: number | null) => (n == null ? "—" : n.toLocaleString());

export const FaersWarehouseModal: React.FC<Props> = ({ isOpen, onClose, onDataIngested }) => {
  const [status, setStatus] = useState<any>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [cohortType, setCohortType] = useState<CohortType>("drug_family");
  const [selected, setSelected] = useState<string[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<CatItem[]>([]);
  const [roles, setRoles] = useState<string[]>(["PS", "SS"]);
  const [yearStart, setYearStart] = useState<string>("");
  const [yearEnd, setYearEnd] = useState<string>("");
  const [seriousOnly, setSeriousOnly] = useState(false);
  const [sex, setSex] = useState<string>("");
  const [minDrugCases, setMinDrugCases] = useState<number>(0);
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [destPath, setDestPath] = useState("");
  const [batchGroup, setBatchGroup] = useState<"drug_family" | "indication_area">("drug_family");

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const ready = !!status?.ready;
  const job = status?.job;

  const refreshStatus = useCallback(async () => {
    try {
      const st = await api<any>("/api/faers/status");
      setStatus(st);
      if (st.ready && !catalog) setCatalog(await api<Catalog>("/api/faers/catalog"));
    } catch (e: any) {
      setError(e.message);
    }
  }, [catalog]);

  useEffect(() => {
    if (!isOpen) return;
    refreshStatus();
    const t = setInterval(refreshStatus, 4000);
    return () => clearInterval(t);
  }, [isOpen, refreshStatus]);

  // Reset selection when cohort type changes
  useEffect(() => { setSelected([]); setPreview(null); setSearchQ(""); setSearchResults([]); }, [cohortType]);

  // Server-side search for drugs / indication PTs
  useEffect(() => {
    if (!ready || (cohortType !== "drugs" && cohortType !== "indication_pt") || searchQ.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const kind = cohortType === "drugs" ? "drug" : "indication";
    const h = setTimeout(async () => {
      try {
        const r = await api<{ results: CatItem[] }>(`/api/faers/search?kind=${kind}&q=${encodeURIComponent(searchQ.trim())}`);
        setSearchResults(r.results);
      } catch (e: any) { setError(e.message); }
    }, 300);
    return () => clearTimeout(h);
  }, [searchQ, cohortType, ready]);

  const spec = useMemo(() => ({
    cohort_type: cohortType,
    values: cohortType === "all" ? [] : selected,
    roles,
    year_start: yearStart ? Number(yearStart) : null,
    year_end: yearEnd ? Number(yearEnd) : null,
    serious_only: seriousOnly,
    sex: sex || null,
    min_drug_cases: minDrugCases || 0,
  }), [cohortType, selected, roles, yearStart, yearEnd, seriousOnly, sex, minDrugCases]);

  const canRun = ready && (cohortType === "all" || selected.length > 0) && roles.length > 0;

  const runPreview = async () => {
    setPreviewLoading(true); setError(null);
    try { setPreview(await api<Preview>("/api/faers/preview", { method: "POST", body: JSON.stringify(spec) })); }
    catch (e: any) { setError(e.message); }
    finally { setPreviewLoading(false); }
  };

  const runExport = async (mode: "single" | "batch") => {
    setError(null);
    const ext = format === "xlsx" && (mode === "batch" || preview?.xlsx_ok !== false) ? "xlsx" : "csv";
    const payload: any = mode === "single"
      ? { mode, spec, dest_path: destPath.trim() ? destPath.trim().replace(/\.(csv|xlsx)$/i, "") + "." + ext : undefined }
      : { mode, group_by: batchGroup, spec: { ...spec, cohort_type: undefined, values: undefined }, format, min_cases: 500 };
    try { await api("/api/faers/export", { method: "POST", body: JSON.stringify(payload) }); refreshStatus(); }
    catch (e: any) { setError(e.message); }
  };

  const startBuild = async () => {
    setError(null);
    try { await api("/api/faers/build", { method: "POST" }); refreshStatus(); }
    catch (e: any) { setError(e.message); }
  };

  const toggle = (name: string) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  if (!isOpen) return null;

  const listItems: CatItem[] =
    cohortType === "drug_family" ? catalog?.drug_families || [] :
    cohortType === "indication_area" ? catalog?.indication_areas || [] :
    cohortType === "drugs" ? (searchQ.length >= 2 ? searchResults : catalog?.top_drugs || []) :
    cohortType === "indication_pt" ? searchResults : [];

  const dlDone = status?.done?.length ?? status?.downloaded_zips ?? 0;
  const dlTotal = status?.total ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-6xl max-h-[92vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
              <Database className="w-4.5 h-4.5 text-teal-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Local FAERS Warehouse (2012 → present)</h2>
              <p className="text-[11px] text-slate-400 font-mono">{status?.root} · deduplicated to latest case version</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        {/* Build status bar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/50 flex flex-wrap items-center gap-4 text-xs">
          <span className={`px-2 py-0.5 rounded-full font-mono ${ready ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
            {ready ? "READY" : status?.pipeline_running ? "BUILDING" : "NOT BUILT"}
          </span>
          <span className="text-slate-300">Downloaded: <b>{dlDone}</b>{dlTotal ? ` / ${dlTotal}` : ""} quarters</span>
          <span className="text-slate-300">Loaded: <b>{status?.loaded_quarters?.length ?? 0}</b> quarters</span>
          {status?.load_current && <span className="text-sky-300">Loading {status.load_current}…</span>}
          {ready && <span className="text-slate-300">Unique cases: <b>{fmt(status?.n_cases)}</b></span>}
          {!ready && (
            <button onClick={startBuild} disabled={status?.pipeline_running}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold">
              {status?.pipeline_running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {status?.pipeline_running ? "Building (download → load → index)…" : "Download & build warehouse"}
            </button>
          )}
        </div>

        {error && (
          <div className="mx-6 mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
            <button className="ml-auto text-rose-400" onClick={() => setError(null)}>dismiss</button>
          </div>
        )}

        {!ready ? (
          <div className="p-10 text-center text-slate-400 text-sm space-y-2">
            <p>The warehouse downloads every FDA FAERS quarterly ASCII extract since 2012Q1 (~58 files),
              harmonizes legacy AERS and FAERS formats, deduplicates cases, and classifies drugs and indications.</p>
            <p className="text-xs text-slate-500">This runs in the background and can take several hours; you can close this window.</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-12 gap-0 overflow-hidden">
            {/* Left: cohort definition */}
            <div className="col-span-7 border-r border-slate-800 flex flex-col min-h-0">
              <div className="p-4 border-b border-slate-800 flex flex-wrap gap-1.5">
                {(Object.keys(COHORT_LABELS) as CohortType[]).map((t) => (
                  <button key={t} onClick={() => setCohortType(t)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition ${cohortType === t
                      ? "bg-teal-600/20 border-teal-500/50 text-teal-200" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"}`}>
                    {COHORT_LABELS[t]}
                  </button>
                ))}
              </div>

              {(cohortType === "drugs" || cohortType === "indication_pt") && (
                <div className="px-4 pt-3 relative">
                  <Search className="w-3.5 h-3.5 absolute left-6 top-5.5 text-slate-500" />
                  <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                    placeholder={cohortType === "drugs" ? "Search active ingredient (e.g. ADALIMUMAB)" : "Search indication (e.g. RHEUMATOID)"}
                    className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-teal-500" />
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4">
                {cohortType === "all" ? (
                  <div className="text-xs text-slate-400 leading-relaxed">
                    Exports every drug in the warehouse as one cohort (the full FAERS background).
                    Use <b>Min. cases per drug</b> and filters on the right to keep the file manageable —
                    the unfiltered export is tens of millions of rows and must be CSV.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {listItems.length === 0 && <p className="text-xs text-slate-500">
                      {cohortType === "indication_pt" || cohortType === "drugs" ? "Type at least 2 characters to search." : "No categories."}</p>}
                    {listItems.map((it) => (
                      <label key={it.name}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer text-xs border ${selected.includes(it.name)
                          ? "bg-teal-500/10 border-teal-500/30" : "border-transparent hover:bg-slate-800/60"}`}>
                        <input type="checkbox" checked={selected.includes(it.name)} onChange={() => toggle(it.name)} className="accent-teal-500" />
                        <span className="flex-1 text-slate-200 truncate">{it.name}</span>
                        {(it.family || it.area) && <span className="text-[10px] text-slate-500 truncate max-w-[180px]">{it.family || it.area}</span>}
                        <span className="font-mono text-[10px] text-slate-400 w-24 text-right">{fmt(it.n_cases)} cases</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {selected.length > 0 && (
                <div className="px-4 py-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                  <span>{selected.length} selected</span>
                  <button className="text-teal-400" onClick={() => setSelected([])}>clear</button>
                </div>
              )}
            </div>

            {/* Right: filters, preview, export */}
            <div className="col-span-5 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="space-y-2">
                <h3 className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Filters</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400 w-24">Drug roles</span>
                  {[["PS", "Primary suspect"], ["SS", "Secondary suspect"], ["C", "Concomitant"], ["I", "Interacting"]].map(([r, l]) => (
                    <label key={r} className="flex items-center gap-1 text-slate-300" title={l}>
                      <input type="checkbox" className="accent-teal-500" checked={roles.includes(r)}
                        onChange={() => setRoles((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]))} />{r}
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-24">Years</span>
                  <input value={yearStart} onChange={(e) => setYearStart(e.target.value)} placeholder={catalog?.year_range?.[0] || "2012"}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200" />
                  <span className="text-slate-500">→</span>
                  <input value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} placeholder={catalog?.year_range?.[1] || ""}
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-24">Sex</span>
                  <select value={sex} onChange={(e) => setSex(e.target.value)} className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200">
                    <option value="">Any</option><option value="F">Female</option><option value="M">Male</option>
                  </select>
                  <label className="flex items-center gap-1 text-slate-300 ml-3">
                    <input type="checkbox" className="accent-teal-500" checked={seriousOnly} onChange={(e) => setSeriousOnly(e.target.checked)} />
                    Serious only
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-24">Min. cases/drug</span>
                  <input type="number" min={0} value={minDrugCases} onChange={(e) => setMinDrugCases(Number(e.target.value) || 0)}
                    className="w-24 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200" />
                  <span className="text-[10px] text-slate-500">drops rare drugs</span>
                </div>
              </div>

              <div className="space-y-2">
                <button onClick={runPreview} disabled={!canRun || previewLoading}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-200">
                  {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />} Preview cohort size
                </button>
                {preview && (
                  <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[["Rows", preview.n_rows], ["Cases", preview.n_cases], ["Drugs", preview.n_drugs], ["Events", preview.n_events]].map(([l, v]) => (
                        <div key={l as string}><div className="font-mono text-slate-100">{fmt(v as number)}</div><div className="text-[10px] text-slate-500">{l}</div></div>
                      ))}
                    </div>
                    {!preview.xlsx_ok && <p className="text-[10px] text-amber-400">Exceeds Excel's row limit — will export as CSV.</p>}
                    <div className="text-[10px] text-slate-400">Top: {preview.top_drugs.slice(0, 8).map((d) => `${d.name} (${fmt(d.n_cases)})`).join(", ")}</div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Export this cohort</h3>
                <div className="flex gap-2">
                  <select value={format} onChange={(e) => setFormat(e.target.value as any)} className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200">
                    <option value="csv">CSV</option><option value="xlsx">Excel (.xlsx + summary sheets)</option>
                  </select>
                  <input value={destPath} onChange={(e) => setDestPath(e.target.value)} placeholder="Destination path (optional)"
                    className="flex-1 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-[11px]" />
                </div>
                <button onClick={() => runExport("single")} disabled={!canRun || job?.status === "running"}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold">
                  <Download className="w-3.5 h-3.5" /> Export cohort
                </button>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-800">
                <h3 className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Batch: one sheet per category</h3>
                <div className="flex gap-2">
                  <select value={batchGroup} onChange={(e) => setBatchGroup(e.target.value as any)} className="flex-1 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200">
                    <option value="drug_family">Every drug family</option>
                    <option value="indication_area">Every indication area</option>
                  </select>
                  <button onClick={() => runExport("batch")} disabled={job?.status === "running" || roles.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-200">
                    <FolderOutput className="w-3.5 h-3.5" /> Export all
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">Applies the filters above; categories with &lt;500 cases are skipped.</p>
              </div>

              {job && job.status !== "idle" && (
                <div className={`p-3 rounded-lg border text-[11px] space-y-1.5 ${job.status === "failed" ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  : job.status === "completed" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-sky-500/10 border-sky-500/30 text-sky-300"}`}>
                  <div className="flex items-center gap-1.5">
                    {job.status === "running" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : job.status === "completed" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {job.error || job.step}
                  </div>
                  {job.result?.file_path && (
                    <>
                      <div className="font-mono break-all text-slate-300">{job.result.file_path} ({fmt(job.result.n_rows)} rows)</div>
                      <button onClick={() => onDataIngested(job.result.file_path)}
                        className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white font-semibold">Load into vigipy-ui for analysis</button>
                    </>
                  )}
                  {job.result?.dest_dir && <div className="font-mono break-all text-slate-300">{job.result.dest_dir} — {job.result.files?.length} files (+ _index.csv)</div>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
