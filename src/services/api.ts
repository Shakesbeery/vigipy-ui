/**
 * API Service for vigipy-ui backend interactions.
 * Zero silent mock fallbacks: all errors are propagated directly with full context.
 */

import {
  ColumnMappingRequest,
  ConcordanceResponse,
  Contingency2x2Response,
  DDINetworkResponse,
  DataProfileResponse,
  DataSummaryResponse,
  ExportRequest,
  FilePreviewResponse,
  InspectSignalResponse,
  JobStatusResponse,
  LongitudinalRunRequest,
  LongitudinalSignalsResponse,
  LongitudinalTrajectoryResponse,
  RunAnalysisRequest,
  SignalQueryRequest,
  SignalQueryResponse,
  SignalRow,
  VersionResponse,
  VolcanoResponse,
} from "../types";

// When served from FastAPI (port 8765) or Vite dev server proxy (port 5173),
// relative URLs avoid all CORS, port, and host/IP mismatches.
const API_BASE_URL = "";

async function handleResponse<T>(res: Response, endpoint: string): Promise<T> {
  if (!res.ok) {
    let errorDetail = "";
    try {
      const errJson = await res.json();
      errorDetail = typeof errJson === "object" ? (errJson.detail || JSON.stringify(errJson)) : String(errJson);
    } catch {
      try {
        errorDetail = await res.text();
      } catch {
        errorDetail = res.statusText;
      }
    }
    throw new Error(`[HTTP ${res.status}] ${endpoint}: ${errorDetail || "Server returned an error"}`);
  }
  return await res.json();
}

/**
 * Check if the Python sidecar backend is healthy and responding.
 */
export async function checkBackendHealth(): Promise<{ online: boolean; hasData: boolean; hasResults: boolean; totalSignals: number }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { online: false, hasData: false, hasResults: false, totalSignals: 0 };
    const data = await res.json();
    return {
      online: true,
      hasData: Boolean(data.has_data),
      hasResults: Boolean(data.has_results),
      totalSignals: Number(data.total_signals || 0),
    };
  } catch {
    return { online: false, hasData: false, hasResults: false, totalSignals: 0 };
  }
}

/**
 * Fetch dataset summary telemetry.
 */
export async function fetchSummary(): Promise<DataSummaryResponse> {
  const res = await fetch(`${API_BASE_URL}/api/data/summary`, {
    method: "GET",
    signal: AbortSignal.timeout(5000),
  });
  return handleResponse<DataSummaryResponse>(res, "GET /api/data/summary");
}

/**
 * Query virtual signal rows with pagination, sorting, and filters.
 */
export async function querySignals(req: SignalQueryRequest): Promise<SignalQueryResponse> {
  const res = await fetch(`${API_BASE_URL}/api/signals/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(10000),
  });
  return handleResponse<SignalQueryResponse>(res, "POST /api/signals/query");
}

/**
 * Fetch detailed signal drill-down inspection for a specific product and adverse event.
 */
export async function inspectSignal(
  product: string,
  adverseEvent: string,
  _fallbackRow?: SignalRow | null
): Promise<InspectSignalResponse> {
  const res = await fetch(`${API_BASE_URL}/api/signals/inspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product, adverse_event: adverseEvent }),
    signal: AbortSignal.timeout(6000),
  });
  return handleResponse<InspectSignalResponse>(res, "POST /api/signals/inspect");
}

/**
 * Concordance Matrix Service
 */
export async function fetchConcordance(): Promise<ConcordanceResponse> {
  const res = await fetch(`${API_BASE_URL}/api/consensus/concordance`, {
    method: "GET",
    signal: AbortSignal.timeout(8000),
  });
  return handleResponse<ConcordanceResponse>(res, "GET /api/consensus/concordance");
}

/**
 * 2x2 Contingency Table Service
 */
export async function fetchContingencyTable(
  methodA: string,
  methodB: string
): Promise<Contingency2x2Response> {
  const res = await fetch(
    `${API_BASE_URL}/api/consensus/contingency?method_a=${encodeURIComponent(
      methodA.toLowerCase()
    )}&method_b=${encodeURIComponent(methodB.toLowerCase())}`,
    {
      method: "GET",
      signal: AbortSignal.timeout(6000),
    }
  );
  return handleResponse<Contingency2x2Response>(res, "GET /api/consensus/contingency");
}

/**
 * Start a longitudinal modeling background job across time slices.
 */
export async function runLongitudinalAnalysis(
  req: LongitudinalRunRequest
): Promise<JobStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/api/longitudinal/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(8000),
  });
  return handleResponse<JobStatusResponse>(res, "POST /api/longitudinal/run");
}

/**
 * Poll current analysis job status.
 */
export async function pollAnalysisStatus(): Promise<JobStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/api/analysis/status`, {
    method: "GET",
    signal: AbortSignal.timeout(4000),
  });
  return handleResponse<JobStatusResponse>(res, "GET /api/analysis/status");
}

/**
 * Fetch longitudinal trajectory for a specific product and adverse event.
 */
export async function fetchLongitudinalTrajectory(
  product: string,
  adverseEvent: string,
  method?: string
): Promise<LongitudinalTrajectoryResponse> {
  const res = await fetch(`${API_BASE_URL}/api/longitudinal/trajectory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product, adverse_event: adverseEvent, method }),
    signal: AbortSignal.timeout(8000),
  });
  return handleResponse<LongitudinalTrajectoryResponse>(res, "POST /api/longitudinal/trajectory");
}

/**
 * Fetch candidate signals collapsed across longitudinal time slices.
 */
export async function fetchLongitudinalSignals(params?: {
  method?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: string;
}): Promise<LongitudinalSignalsResponse> {
  const query = new URLSearchParams();
  if (params?.method) query.set("method", params.method);
  if (params?.search) query.set("search", params.search);
  if (params?.sort_by) query.set("sort_by", params.sort_by);
  if (params?.sort_dir) query.set("sort_dir", params.sort_dir);

  const url = `${API_BASE_URL}/api/longitudinal/signals${query.toString() ? `?${query.toString()}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(10000),
  });
  return handleResponse<LongitudinalSignalsResponse>(res, "GET /api/longitudinal/signals");
}


/**
 * Export analysis results to CSV or Excel.
 */
export async function exportAnalysisData(
  req: ExportRequest
): Promise<{ status: string; file_path?: string }> {
  const res = await fetch(`${API_BASE_URL}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(12000),
  });
  return handleResponse<{ status: string; file_path?: string }>(res, "POST /api/export");
}

/**
 * Preview file schema and sample rows.
 */
export async function previewFile(filePath: string): Promise<FilePreviewResponse> {
  const res = await fetch(`${API_BASE_URL}/api/data/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_path: filePath }),
    signal: AbortSignal.timeout(8000),
  });
  return handleResponse<FilePreviewResponse>(res, "POST /api/data/preview");
}

/**
 * Ingest data file with column mappings.
 */
export async function ingestDataFile(mapping: ColumnMappingRequest): Promise<DataSummaryResponse> {
  const res = await fetch(`${API_BASE_URL}/api/data/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mapping),
    signal: AbortSignal.timeout(30000),
  });
  return handleResponse<DataSummaryResponse>(res, "POST /api/data/ingest");
}

/**
 * Start disproportionality / consensus analysis job.
 */
export async function startAnalysisJob(req: RunAnalysisRequest): Promise<JobStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/api/analysis/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(8000),
  });
  return handleResponse<JobStatusResponse>(res, "POST /api/analysis/run");
}

/**
 * Stream upload a local file into backend storage.
 */
export async function uploadLocalFile(
  file: File
): Promise<{ status: string; file_path: string; filename: string; size: number }> {
  const url = `${API_BASE_URL}/api/data/upload?filename=${encodeURIComponent(file.name)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: file,
  });
  return handleResponse(res, "POST /api/data/upload");
}

/**
 * Re-import previously exported analysis results (.xlsx, .csv, .parquet).
 */
export async function importResultsFile(
  filePath: string
): Promise<DataSummaryResponse> {
  const res = await fetch(`${API_BASE_URL}/api/data/import_results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_path: filePath }),
    signal: AbortSignal.timeout(30000),
  });
  return handleResponse<DataSummaryResponse>(res, "POST /api/data/import_results");
}

/**
 * Fetch column options and current mapping for active dataset.
 */
export async function fetchCurrentColumns(): Promise<FilePreviewResponse> {
  const res = await fetch(`${API_BASE_URL}/api/data/columns`, {
    method: "GET",
    signal: AbortSignal.timeout(10000),
  });
  return handleResponse<FilePreviewResponse>(res, "GET /api/data/columns");
}

/**
 * Reset dataset and analysis cache on backend.
 */
export async function resetDataset(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/data/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  return handleResponse<{ status: string; message: string }>(res, "POST /api/data/reset");
}

/**
 * Cancel an ongoing analysis execution job.
 */
export async function cancelAnalysisJob(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/analysis/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  return handleResponse<{ status: string; message: string }>(res, "POST /api/analysis/cancel");
}

/**
 * Cancel an ongoing longitudinal modeling job.
 */
export async function cancelLongitudinalJob(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/longitudinal/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  return handleResponse<{ status: string; message: string }>(res, "POST /api/longitudinal/cancel");
}

/**
 * Fetch Volcano plot effect size and significance scatter points.
 */
export async function fetchVolcanoData(method?: string): Promise<VolcanoResponse> {
  const url = method
    ? `${API_BASE_URL}/api/signals/volcano?method=${encodeURIComponent(method)}`
    : `${API_BASE_URL}/api/signals/volcano`;
  const res = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(10000),
  });
  return handleResponse<VolcanoResponse>(res, "GET /api/signals/volcano");
}

/**
 * Fetch Data Quality and Hygiene profile for ingested dataset.
 */
export async function fetchDataProfile(): Promise<DataProfileResponse> {
  const res = await fetch(`${API_BASE_URL}/api/data/profile`, {
    method: "GET",
    signal: AbortSignal.timeout(10000),
  });
  return handleResponse<DataProfileResponse>(res, "GET /api/data/profile");
}

/**
 * Fetch SCORE-DDI multi-drug interaction network graph.
 */
export async function fetchDdiNetwork(targetEvent?: string): Promise<DDINetworkResponse> {
  const url = targetEvent
    ? `${API_BASE_URL}/api/ddi/network?target_event=${encodeURIComponent(targetEvent)}`
    : `${API_BASE_URL}/api/ddi/network`;
  const res = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(10000),
  });
  return handleResponse<DDINetworkResponse>(res, "GET /api/ddi/network");
}

/**
 * Fetch installed vigipy version and library status.
 */
export async function fetchVigipyVersion(): Promise<VersionResponse> {
  const res = await fetch(`${API_BASE_URL}/api/version`, {
    method: "GET",
    signal: AbortSignal.timeout(5000),
  });
  return handleResponse<VersionResponse>(res, "GET /api/version");
}

// Unified API Object Export
export const api = {
  checkHealth: checkBackendHealth,
  getDataSummary: fetchSummary,
  getAnalysisStatus: pollAnalysisStatus,
  previewFile,
  uploadLocalFile,
  importResultsFile,
  fetchCurrentColumns,
  resetDataset,
  ingestFile: ingestDataFile,
  startAnalysis: startAnalysisJob,
  cancelAnalysis: cancelAnalysisJob,
  cancelLongitudinal: cancelLongitudinalJob,
  querySignals,
  inspectSignal,
  fetchConcordance,
  fetchContingencyTable,
  runLongitudinalAnalysis,
  fetchLongitudinalTrajectory,
  exportAnalysisData,
  fetchVolcanoData,
  fetchDataProfile,
  fetchDdiNetwork,
  fetchVigipyVersion,
};

export const fetchFilePreview = previewFile;
export const fetchAnalysisStatus = pollAnalysisStatus;

export default api;
