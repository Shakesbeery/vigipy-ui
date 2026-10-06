"""FastAPI application for vigipy-ui Python sidecar engine."""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
import threading
import uuid
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .engine import (
    execute_analysis,
    execute_longitudinal,
    get_ddi_network,
    get_file_preview,
    get_longitudinal_signals,
    get_longitudinal_trajectory,
    get_vigipy_version,
    get_volcano_data,
    import_results_file,
    ingest_data_file,
    profile_data_quality,
)
from .schemas import (
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
    LongitudinalSignalItem,
    LongitudinalSignalsResponse,
    LongitudinalTrajectoryRequest,
    LongitudinalTrajectoryResponse,
    MethodSignalInspection,
    RunAnalysisRequest,
    SignalQueryRequest,
    SignalQueryResponse,
    SignalRow,
    VersionResponse,
    VolcanoResponse,
)
from .state import state

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("vigipy_ui.main")

app = FastAPI(
    title="vigipy-ui Core Engine",
    description="Asynchronous computational backend for vigipy disproportionality analysis UI.",
    version="1.0.0",
)

# Enable CORS for desktop webview and local dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Background job tracking
active_job: Dict[str, Any] = {
    "job_id": "idle",
    "status": "idle",
    "progress": 0.0,
    "step": "",
    "error": None,
    "total_signals": 0,
    "total_candidates": 0,
}


@app.get("/api/health")
def health() -> Dict[str, Any]:
    """Health check for sidecar lifecycle management."""
    return {
        "status": "ok",
        "has_data": state.data_container is not None,
        "has_results": state.consensus_result is not None or bool(state.individual_results),
        "total_signals": state.consensus_result.num_signals if state.consensus_result else 0,
    }


# --- Ingestion Endpoints ---

@app.post("/api/data/upload")
async def upload_file(
    request: Request,
    filename: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """Stream upload a local file into backend temporary storage."""
    upload_dir = os.path.join(tempfile.gettempdir(), "vigipy_uploads")
    os.makedirs(upload_dir, exist_ok=True)

    raw_name = os.path.basename(filename or "uploaded_data.csv")
    base, ext = os.path.splitext(raw_name)
    clean_name = f"{base}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = os.path.join(upload_dir, clean_name)

    total_bytes = 0
    with open(dest_path, "wb") as f:
        async for chunk in request.stream():
            if chunk:
                f.write(chunk)
                total_bytes += len(chunk)

    if total_bytes == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    logger.info(f"Streamed upload of {clean_name} complete: {total_bytes:,} bytes saved to {dest_path}")
    return {
        "status": "success",
        "file_path": os.path.abspath(dest_path),
        "filename": clean_name,
        "size": total_bytes,
    }


@app.post("/api/data/preview", response_model=FilePreviewResponse)
def preview_file(payload: Dict[str, str]) -> FilePreviewResponse:
    file_path = payload.get("file_path")
    if not file_path:
        raise HTTPException(status_code=400, detail="file_path is required.")
    try:
        return get_file_preview(file_path)
    except Exception as exc:
        logger.error(f"Error previewing file: {exc}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/data/ingest", response_model=DataSummaryResponse)
def ingest_file(mapping: ColumnMappingRequest) -> DataSummaryResponse:
    try:
        summary = ingest_data_file(mapping)
        return DataSummaryResponse(**summary)
    except Exception as exc:
        logger.error(f"Error ingesting data: {exc}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/data/import_results", response_model=DataSummaryResponse)
def import_results(payload: Dict[str, str]) -> DataSummaryResponse:
    """Import previous analysis results from an exported .xlsx, .csv, or .parquet file."""
    file_path = payload.get("file_path")
    if not file_path:
        raise HTTPException(status_code=400, detail="file_path is required.")
    try:
        res = import_results_file(file_path)
        return DataSummaryResponse(
            total_raw_rows=res["total_raw_rows"],
            unique_pairs=res["unique_pairs"],
            unique_products=res["unique_products"],
            unique_aes=res["unique_aes"],
            total_events=res["total_raw_rows"],
            dispersion=None,
            dispersion_alpha=None,
            recommended_expected_method="imported",
            total_signals=res.get("total_signals", 0),
        )
    except Exception as exc:
        logger.error(f"Error importing results: {exc}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/data/columns", response_model=FilePreviewResponse)
def get_dataset_columns() -> FilePreviewResponse:
    """Get column options and current mapping for active dataset to support remapping."""
    if state.full_raw_df is None and state.raw_df is None:
        if not state.raw_file_path:
            raise HTTPException(status_code=404, detail="No dataset loaded to inspect columns.")
        return get_file_preview(state.raw_file_path)

    df = state.full_raw_df if state.full_raw_df is not None else state.raw_df
    preview_records = df.head(15).fillna("").to_dict(orient="records")
    return FilePreviewResponse(
        file_path=state.raw_file_path or "",
        total_rows=len(df),
        columns=list(df.columns),
        preview_rows=preview_records,
        suggested_mapping=state.column_mapping or {},
    )


@app.post("/api/data/reset")
def reset_dataset() -> Dict[str, str]:
    """Completely reset active dataset and analysis cache."""
    state.reset_all()
    global active_job
    active_job = {
        "job_id": "idle",
        "status": "idle",
        "progress": 0.0,
        "step": "",
        "error": None,
        "total_signals": 0,
        "total_candidates": 0,
    }
    return {"status": "success", "message": "Dataset and analysis cache cleared."}


@app.get("/api/data/summary", response_model=DataSummaryResponse)
def get_data_summary() -> DataSummaryResponse:
    if state.data_container is None:
        if state.consensus_result is not None:
            df = state.consensus_result.comparison_table
            return DataSummaryResponse(
                total_raw_rows=len(df),
                unique_pairs=len(df),
                unique_products=int(df["Product"].nunique()) if "Product" in df.columns else 0,
                unique_aes=int(df["Adverse Event"].nunique()) if "Adverse Event" in df.columns else 0,
                total_events=int(df["Count"].sum()) if "Count" in df.columns else len(df),
                dispersion=None,
                dispersion_alpha=None,
                recommended_expected_method="imported",
                total_signals=state.consensus_result.num_signals,
            )
        raise HTTPException(status_code=404, detail="No dataset loaded.")
    c = state.data_container
    unique_products = len(c.contingency.index) if c.contingency is not None else 0
    unique_aes = len(c.contingency.columns) if c.contingency is not None else 0
    total_sig = state.consensus_result.num_signals if state.consensus_result is not None else 0
    return DataSummaryResponse(
        total_raw_rows=len(state.raw_df) if state.raw_df is not None else 0,
        unique_pairs=len(c.data),
        unique_products=unique_products,
        unique_aes=unique_aes,
        total_events=int(c.N),
        total_signals=total_sig,
    )


# --- Analysis Execution ---

cancel_analysis_event = threading.Event()
cancel_longitudinal_event = threading.Event()


def _run_analysis_worker(job_id: str, req: RunAnalysisRequest) -> None:
    global active_job
    try:
        def update_progress(pct: float, msg: str) -> None:
            active_job["progress"] = pct
            active_job["step"] = msg

        num_sig, total_c = execute_analysis(
            req,
            progress_cb=update_progress,
            cancel_cb=lambda: cancel_analysis_event.is_set(),
        )
        active_job["status"] = "completed"
        active_job["progress"] = 1.0
        active_job["step"] = "Analysis finished successfully."
        active_job["total_signals"] = num_sig
        active_job["total_candidates"] = total_c
    except InterruptedError:
        logger.info(f"Analysis job {job_id} cancelled by user.")
        active_job["status"] = "cancelled"
        active_job["progress"] = 0.0
        active_job["step"] = "Analysis cancelled by user."
    except Exception as exc:
        logger.error(f"Analysis job {job_id} failed: {exc}", exc_info=True)
        active_job["status"] = "failed"
        active_job["error"] = str(exc)
        active_job["step"] = "Analysis failed."


@app.post("/api/analysis/run", response_model=JobStatusResponse)
def start_analysis(req: RunAnalysisRequest, background_tasks: BackgroundTasks) -> JobStatusResponse:
    global active_job
    if state.data_container is None:
        raise HTTPException(status_code=400, detail="Cannot run analysis: No dataset ingested.")

    # Immediately clear stale results from previous runs and clear cancellation flag
    state.reset_analysis()
    cancel_analysis_event.clear()

    job_id = str(uuid.uuid4())
    active_job = {
        "job_id": job_id,
        "status": "running",
        "progress": 0.05,
        "step": "Initializing analysis pipeline...",
        "error": None,
        "total_signals": 0,
        "total_candidates": 0,
    }

    threading.Thread(target=_run_analysis_worker, args=(job_id, req), daemon=True).start()
    return JobStatusResponse(**active_job)


@app.post("/api/analysis/cancel")
def cancel_analysis() -> Dict[str, str]:
    cancel_analysis_event.set()
    active_job["status"] = "cancelled"
    active_job["step"] = "Cancelling analysis pipeline..."
    return {"status": "cancelling", "message": "Signal sent to abort analysis pipeline."}


@app.get("/api/analysis/status", response_model=JobStatusResponse)
def get_analysis_status() -> JobStatusResponse:
    return JobStatusResponse(**active_job)


# --- Query & Table Endpoints ---

@app.post("/api/signals/query", response_model=SignalQueryResponse)
def query_signals(req: SignalQueryRequest) -> SignalQueryResponse:
    total, filtered, rows, methods = state.query_signals(
        offset=req.offset,
        limit=req.limit,
        search=req.search,
        tiers=req.tiers,
        methods=req.methods,
        min_count=req.min_count,
        min_votes=req.min_votes,
        min_score=req.min_score,
        sort_by=req.sort_by,
        sort_dir=req.sort_dir,
    )
    return SignalQueryResponse(
        total_records=total,
        filtered_records=filtered,
        offset=req.offset,
        limit=req.limit,
        rows=[SignalRow(**r) for r in rows],
        methods=methods,
    )


def _get_method_threshold_str(method_name: str, res_or_params: Any = None) -> tuple[str, str]:
    """Extract descriptive per-method decision threshold and metric."""
    m_low = method_name.lower().strip()
    input_params: dict = {}
    if hasattr(res_or_params, "params") and isinstance(res_or_params.params, dict):
        input_params = res_or_params.params.get("input_params", {})
    elif isinstance(res_or_params, dict):
        input_params = res_or_params.get("input_params", res_or_params)

    if m_low in ("prr", "ror"):
        dec_metric = input_params.get("decision_metric", "fdr")
        thres = input_params.get("decision_thres", 0.05)
        if dec_metric == "fdr":
            return f"FDR ≤ {thres}", "FDR"
        elif dec_metric == "rank":
            stat = input_params.get("ranking_statistic", "p_value")
            op = "≤" if stat == "p_value" else "≥"
            return f"{stat} {op} {thres}", stat
        else:
            return f"N ≥ {int(thres)}", "Signals"

    elif m_low == "rfet":
        dec_metric = input_params.get("decision_metric", "fdr")
        thres = input_params.get("decision_thres", 0.05)
        if dec_metric == "fdr":
            return f"FDR ≤ {thres}", "FDR"
        else:
            return f"p ≤ {thres}", "p-value"

    elif m_low == "bcpnn":
        dec_metric = input_params.get("decision_metric", "rank")
        thres = input_params.get("decision_thres", 0.0)
        stat = input_params.get("ranking_statistic", "quantile")
        if dec_metric == "rank":
            if stat == "quantile":
                return f"IC₀₂₅ > {thres}", "IC025"
            else:
                return f"p ≤ {thres}", "p-value"
        elif dec_metric == "fdr":
            return f"FDR ≤ {thres}", "FDR"
        else:
            return f"IC₀₂₅ > {thres}", "IC025"

    elif m_low == "gps":
        dec_metric = input_params.get("decision_metric", "rank")
        thres = input_params.get("decision_thres", 0.05)
        stat = input_params.get("ranking_statistic", "log2")
        if dec_metric == "rank":
            if stat == "quantile":
                return f"EB₀₅ ≥ {thres if thres > 0.1 else 2.0}", "EB05"
            elif stat == "log2":
                return f"log₂(EBGM) ≥ {thres}", "log2"
            else:
                return f"p ≤ {thres}", "p-value"
        elif dec_metric == "fdr":
            return f"FDR ≤ {thres}", "FDR"
        else:
            return f"EB₀₅ ≥ 2.0", "EB05"

    elif m_low == "lasso":
        l_thresh = input_params.get("lasso_thresh", 0.0)
        return f"Beta > {l_thresh}", "Beta"

    elif m_low in ("score_da", "score"):
        fdr = input_params.get("fdr_threshold", 0.05)
        return f"FDR ≤ {fdr}", "FDR"

    return "Pass Threshold", "Score"


@app.post("/api/signals/inspect", response_model=InspectSignalResponse)
def inspect_signal_detail(payload: Dict[str, Any]) -> InspectSignalResponse:
    prod = payload.get("product")
    ae = payload.get("adverse_event")
    if not prod or not ae:
        raise HTTPException(status_code=400, detail="Both 'product' and 'adverse_event' are required.")

    prod_str = str(prod).strip()
    ae_str = str(ae).strip()

    if state.consensus_result is not None:
        try:
            df_inspect = state.consensus_result.inspect_signal(prod_str, ae_str)
        except KeyError:
            # Fallback to case-insensitive match on comparison_table
            ct = state.consensus_result.comparison_table
            match = ct[
                (ct["Product"].astype(str).str.strip().str.lower() == prod_str.lower())
                & (ct["Adverse Event"].astype(str).str.strip().str.lower() == ae_str.lower())
            ]
            if match.empty:
                raise HTTPException(status_code=404, detail=f"Signal pair ({prod!r}, {ae!r}) not found in consensus analysis.")
            actual_prod = str(match.iloc[0]["Product"])
            actual_ae = str(match.iloc[0]["Adverse Event"])
            df_inspect = state.consensus_result.inspect_signal(actual_prod, actual_ae)

        method_inspections: list[MethodSignalInspection] = []
        for _, r in df_inspect.iterrows():
            m_name_str = str(r["Method"])
            raw_res = state.consensus_result.raw_results.get(m_name_str.lower()) if state.consensus_result.raw_results else None
            thres_str, thres_metric = _get_method_threshold_str(m_name_str, raw_res)
            method_inspections.append(
                MethodSignalInspection(
                    method=m_name_str,
                    alert=bool(r["Alert"]),
                    metric=str(r["Metric"]),
                    score=float(r["Score"]) if not pd.isna(r["Score"]) else None,
                    ci_lower=float(r["CI Lower"]) if not pd.isna(r["CI Lower"]) else None,
                    ci_upper=float(r["CI Upper"]) if not pd.isna(r["CI Upper"]) else None,
                    p_value=float(r["p-value"]) if not pd.isna(r["p-value"]) else None,
                    fdr=float(r["FDR"]) if not pd.isna(r["FDR"]) else None,
                    count=float(r["Count"]) if not pd.isna(r["Count"]) else None,
                    expected_count=float(r["Expected Count"]) if not pd.isna(r["Expected Count"]) else None,
                    threshold=thres_str,
                    threshold_metric=thres_metric,
                )
            )

        return InspectSignalResponse(
            product=prod_str,
            adverse_event=ae_str,
            votes=int(df_inspect.attrs.get("votes", 0)),
            total_methods=int(df_inspect.attrs.get("total_methods", len(method_inspections))),
            consensus_score=float(df_inspect.attrs.get("consensus_score", 0.0)),
            agreement_tier=str(df_inspect.attrs.get("agreement_tier", "Isolated")),
            composite_rank=float(df_inspect.attrs.get("composite_rank", 0.0)) if not pd.isna(df_inspect.attrs.get("composite_rank")) else None,
            count=float(method_inspections[0].count) if method_inspections and method_inspections[0].count is not None else 0.0,
            expected_count=float(method_inspections[0].expected_count) if method_inspections and method_inspections[0].expected_count is not None else None,
            methods=method_inspections,
        )

    elif state.individual_results:
        # Fallback when consensus was disabled or single method ran
        method_inspections = []
        votes = 0
        pair_count = 0.0
        exp_count = None
        for m_name, m_res in state.individual_results.items():
            df_all = m_res.all_signals
            match = df_all[
                (df_all["Product"].astype(str).str.strip().str.lower() == prod_str.lower())
                & (df_all["Adverse Event"].astype(str).str.strip().str.lower() == ae_str.lower())
            ]
            if not match.empty:
                r = match.iloc[0]
                score_col = None
                for col in ["Score", "PRR", "ROR", "RFET", "IC", "quantile", "EBGM", "LASSO Coefficient", "Beta", "SER", "SRR", m_name.upper()]:
                    if col in r and not pd.isna(r[col]):
                        score_col = col
                        break
                score_val = float(r[score_col]) if score_col else None
                ci_l = float(r["CI Lower"]) if "CI Lower" in r and not pd.isna(r["CI Lower"]) else None
                ci_u = float(r["CI Upper"]) if "CI Upper" in r and not pd.isna(r["CI Upper"]) else None
                pv = float(r["p-value"]) if "p-value" in r and not pd.isna(r["p-value"]) else None
                fdr_val = float(r["FDR"]) if "FDR" in r and not pd.isna(r["FDR"]) else None
                cnt = float(r["Count"]) if "Count" in r and not pd.isna(r["Count"]) else None
                exp_cnt = float(r["Expected Count"]) if "Expected Count" in r and not pd.isna(r["Expected Count"]) else None

                is_alert = not m_res.signals[
                    (m_res.signals["Product"].astype(str).str.strip().str.lower() == prod_str.lower())
                    & (m_res.signals["Adverse Event"].astype(str).str.strip().str.lower() == ae_str.lower())
                ].empty
                if is_alert:
                    votes += 1

                if cnt is not None:
                    pair_count = cnt

                thres_str, thres_metric = _get_method_threshold_str(m_name, m_res)

                method_inspections.append(
                    MethodSignalInspection(
                        method=m_name.upper(),
                        alert=is_alert,
                        metric=score_col or "Score",
                        score=score_val,
                        ci_lower=ci_l,
                        ci_upper=ci_u,
                        p_value=pv,
                        fdr=fdr_val,
                        count=cnt,
                        expected_count=exp_cnt,
                        threshold=thres_str,
                        threshold_metric=thres_metric,
                    )
                )

        if not method_inspections:
            raise HTTPException(status_code=404, detail=f"Signal pair ({prod!r}, {ae!r}) not found in analysis results.")

        return InspectSignalResponse(
            product=prod_str,
            adverse_event=ae_str,
            votes=votes,
            total_methods=len(state.individual_results),
            consensus_score=votes / max(1, len(state.individual_results)),
            agreement_tier="Strong" if votes == len(state.individual_results) else ("Moderate" if votes >= len(state.individual_results)/2 else "Weak"),
            composite_rank=None,
            count=pair_count,
            expected_count=exp_count,
            methods=method_inspections,
        )

    else:
        raise HTTPException(status_code=400, detail="No analysis results available.")



# --- Concordance Endpoints ---

@app.get("/api/consensus/concordance", response_model=ConcordanceResponse)
def get_concordance() -> ConcordanceResponse:
    if state.consensus_result is None:
        raise HTTPException(status_code=400, detail="No consensus analysis available.")
    
    c_res = state.consensus_result
    ag = c_res.method_agreement

    def df_to_dict(df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
        clean_df = df.copy().fillna(0.0)
        return clean_df.to_dict(orient="index")

    concordance_methods = c_res.methods
    if not concordance_methods:
        if "jaccard" in ag and not ag["jaccard"].empty:
            concordance_methods = [str(c) for c in ag["jaccard"].columns]
        elif c_res.metric_names:
            concordance_methods = list(c_res.metric_names.keys())

    return ConcordanceResponse(
        methods=concordance_methods,
        jaccard=df_to_dict(ag.get("jaccard", pd.DataFrame())),
        cohens_kappa=df_to_dict(ag.get("kappa", pd.DataFrame())),
        spearman_correlation=df_to_dict(ag.get("correlation", pd.DataFrame())),
        alert_overlap=df_to_dict(ag.get("overlap", pd.DataFrame())),
    )


@app.get("/api/consensus/contingency", response_model=Contingency2x2Response)
def get_contingency_table(
    method_a: str = Query(...),
    method_b: str = Query(...),
) -> Contingency2x2Response:
    if state.consensus_result is None:
        raise HTTPException(status_code=400, detail="No consensus analysis available.")

    try:
        ct = state.consensus_result.contingency_table(method_a, method_b)
        return Contingency2x2Response(
            method_a=method_a,
            method_b=method_b,
            table=ct.to_dict(orient="index"),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# --- Longitudinal Endpoints ---

def _run_longitudinal_worker(job_id: str, req: LongitudinalRunRequest) -> None:
    global active_job
    try:
        def update_progress(pct: float, msg: str) -> None:
            active_job["progress"] = pct
            active_job["step"] = msg

        num_slices = execute_longitudinal(
            req,
            progress_cb=update_progress,
            cancel_cb=lambda: cancel_longitudinal_event.is_set(),
        )
        active_job["status"] = "completed"
        active_job["progress"] = 1.0
        active_job["step"] = f"Longitudinal modeling completed: {num_slices} time slices."
    except InterruptedError:
        logger.info(f"Longitudinal job {job_id} cancelled by user.")
        active_job["status"] = "cancelled"
        active_job["progress"] = 0.0
        active_job["step"] = "Longitudinal modeling cancelled by user."
    except Exception as exc:
        logger.error(f"Longitudinal run failed: {exc}", exc_info=True)
        active_job["status"] = "failed"
        active_job["error"] = str(exc)
        active_job["step"] = "Longitudinal run failed."


@app.post("/api/longitudinal/run", response_model=JobStatusResponse)
def start_longitudinal(req: LongitudinalRunRequest) -> JobStatusResponse:
    global active_job
    if state.raw_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded.")

    cancel_longitudinal_event.clear()
    job_id = str(uuid.uuid4())
    active_job = {
        "job_id": job_id,
        "status": "running",
        "progress": 0.05,
        "step": "Setting up longitudinal slices...",
        "error": None,
        "total_signals": 0,
        "total_candidates": 0,
    }

    threading.Thread(target=_run_longitudinal_worker, args=(job_id, req), daemon=True).start()
    return JobStatusResponse(**active_job)


@app.post("/api/longitudinal/cancel")
def cancel_longitudinal() -> Dict[str, str]:
    cancel_longitudinal_event.set()
    active_job["status"] = "cancelled"
    active_job["step"] = "Cancelling longitudinal modeling..."
    return {"status": "cancelling", "message": "Signal sent to abort longitudinal run."}


@app.post("/api/longitudinal/trajectory", response_model=LongitudinalTrajectoryResponse)
def trajectory(req: LongitudinalTrajectoryRequest) -> LongitudinalTrajectoryResponse:
    try:
        traj_res = get_longitudinal_trajectory(req.product, req.adverse_event, method=req.method)
        return LongitudinalTrajectoryResponse(**traj_res)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/longitudinal/signals", response_model=LongitudinalSignalsResponse)
def get_longitudinal_signals_endpoint(
    method: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("peak_score"),
    sort_dir: str = Query("desc"),
) -> LongitudinalSignalsResponse:
    """Retrieve candidate drug-event pairs that signaled across longitudinal time slices."""
    try:
        res = get_longitudinal_signals(method=method, search=search, sort_by=sort_by, sort_dir=sort_dir)
        return LongitudinalSignalsResponse(**res)
    except Exception as exc:
        logger.error(f"Error fetching longitudinal signals: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))



# --- Advanced Analytics Endpoints ---

@app.get("/api/signals/volcano", response_model=VolcanoResponse)
def get_volcano_endpoint(method: Optional[str] = Query(None)) -> VolcanoResponse:
    """Retrieve statistical effect size and significance points for Volcano plot."""
    try:
        res = get_volcano_data(method=method)
        return VolcanoResponse(**res)
    except Exception as exc:
        logger.error(f"Error fetching volcano data: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/data/profile", response_model=DataProfileResponse)
def get_data_profile_endpoint() -> DataProfileResponse:
    """Evaluate data hygiene, missingness, and duplication on active ingested dataset."""
    try:
        res = profile_data_quality()
        return DataProfileResponse(**res)
    except Exception as exc:
        logger.error(f"Error profiling dataset: {exc}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/ddi/network", response_model=DDINetworkResponse)
def get_ddi_network_endpoint(target_event: Optional[str] = Query(None)) -> DDINetworkResponse:
    """Discover multi-drug combinations and synergy interactions."""
    try:
        res = get_ddi_network(target_event=target_event)
        return DDINetworkResponse(**res)
    except Exception as exc:
        logger.error(f"Error extracting DDI network: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/version", response_model=VersionResponse)
def get_version_endpoint() -> VersionResponse:
    """Check installed vigipy version and library capabilities."""
    try:
        res = get_vigipy_version()
        return VersionResponse(**res)
    except Exception as exc:
        logger.error(f"Error checking version: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# --- Export Endpoints ---

@app.post("/api/export")
def export_file(req: ExportRequest) -> Dict[str, str]:
    if state.consensus_result is None and not state.individual_results:
        raise HTTPException(status_code=400, detail="No analysis results available to export.")

    dest = req.destination_path or f"vigipy_analysis_export.{req.format}"
    try:
        if state.consensus_result is not None:
            state.consensus_result.export(dest)
        else:
            m_res = next(iter(state.individual_results.values()))
            m_res.export(dest)
        return {"status": "success", "file_path": os.path.abspath(dest)}
    except Exception as exc:
        logger.error(f"Export failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# --- Static Frontend Serving ---
_dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "dist"))
if os.path.exists(_dist_dir):
    _assets_dir = os.path.join(_dist_dir, "assets")
    if os.path.exists(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/")
    def serve_frontend_root():
        index_file = os.path.join(_dist_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"message": "vigipy-ui Core API running. Build frontend into dist/ to view GUI."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8765, reload=True)

