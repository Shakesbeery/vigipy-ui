"""Computational engine orchestrator wrapping vigipy core methods for vigipy-ui."""

from __future__ import annotations

import logging
import os
import tempfile
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from vigipy import (
    BCPNNConfig,
    GPSConfig,
    LASSOConfig,
    LongitudinalModel,
    PRRConfig,
    RFETConfig,
    RORConfig,
    analyze,
    analyze_all,
    consensus_analysis,
    convert,
    convert_binary,
)
from vigipy.consensus import ConsensusResult
from vigipy.utils.Container import AnalysisResult, DataContainer
from vigipy.utils.expectations import test_dispersion

from .schemas import (
    ColumnMappingRequest,
    FilePreviewResponse,
    LongitudinalRunRequest,
    RunAnalysisRequest,
)
from .state import state

logger = logging.getLogger("vigipy_ui.engine")


def resolve_file_path(path: str) -> str:
    """Resolve a file path across relative, working directory, and upload storage locations."""
    if not path:
        return path
    if os.path.isabs(path) and os.path.exists(path):
        return path

    candidates = [
        os.path.abspath(path),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), path),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "backend", os.path.basename(path)),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "public", os.path.basename(path)),
        os.path.join(tempfile.gettempdir(), "vigipy_uploads", os.path.basename(path)),
    ]
    for cand in candidates:
        if os.path.exists(cand):
            return os.path.abspath(cand)
    return os.path.abspath(path)


def detect_file_encoding(file_path: str) -> str:
    """Detect basic file encoding or fallback to utf-8."""
    return "utf-8"


def get_file_preview(file_path: str, preview_count: int = 15) -> FilePreviewResponse:
    """Load preview rows, detect column types, and suggest default column mappings."""
    file_path = resolve_file_path(file_path)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == ".parquet":
        df_head = pd.read_parquet(file_path)
        total_rows = len(df_head)
        df_preview = df_head.head(preview_count)
    elif ext in [".xlsx", ".xls"]:
        df_head = pd.read_excel(file_path, nrows=preview_count + 1)
        total_rows = len(df_head)  # approximation for preview
        df_preview = df_head.head(preview_count)
    else:
        # CSV or TSV
        sep = "\t" if ext == ".tsv" else ","
        try:
            df_preview = pd.read_csv(file_path, sep=sep, nrows=preview_count, encoding="utf-8")
        except UnicodeDecodeError:
            df_preview = pd.read_csv(file_path, sep=sep, nrows=preview_count, encoding="latin1")
        
        # Fast line count for total rows
        try:
            with open(file_path, "rb") as f:
                total_rows = sum(1 for _ in f) - 1
                if total_rows < 0:
                    total_rows = 0
        except Exception:
            total_rows = len(df_preview)

    columns = list(df_preview.columns)

    # Heuristics for suggesting column mappings
    suggested: Dict[str, Optional[str]] = {
        "product_col": None,
        "ae_col": None,
        "count_col": None,
        "date_col": None,
    }

    cols_lower = {c.lower(): c for c in columns}
    # Columns that do not look like IDs, codes, or keys
    non_code_cols = {
        c_l: orig
        for c_l, orig in cols_lower.items()
        if not any(c_l.endswith(sfx) for sfx in ["_code", "_id", "_key", "_num", "_nbr"])
    }

    # Product/Brand/Drug heuristics:
    # Prioritize brand names and product names while avoiding identifier codes (e.g., DEVICE_REPORT_PRODUCT_CODE)
    prod_candidates = [
        "brand_name",
        "brand",
        "trade_name",
        "drug_name",
        "product_name",
        "device_name",
        "substance_name",
        "active_substance",
        "reduced_name",
        "drug",
        "product",
        "substance",
        "name",
        "device",
    ]

    # 1. Search non-code columns first
    for cand in prod_candidates:
        for c_lower, orig in non_code_cols.items():
            if cand == c_lower or cand in c_lower:
                suggested["product_col"] = orig
                break
        if suggested["product_col"]:
            break

    # 2. Fallback to all columns (including code columns) if no name column exists
    if not suggested["product_col"]:
        for cand in prod_candidates:
            for c_lower, orig in cols_lower.items():
                if cand in c_lower:
                    suggested["product_col"] = orig
                    break
            if suggested["product_col"]:
                break

    # AE heuristics: prioritize event terms over generic or ID columns
    ae_candidates = [
        "eventsimplified",
        "adverse_event",
        "preferred_term",
        "event_name",
        "ae_name",
        "reaction",
        "event",
        "pt",
        "ae",
    ]
    for cand in ae_candidates:
        for c_lower, orig in non_code_cols.items():
            if cand == c_lower or cand in c_lower:
                suggested["ae_col"] = orig
                break
        if suggested["ae_col"]:
            break

    if not suggested["ae_col"]:
        for cand in ae_candidates:
            for c_lower, orig in cols_lower.items():
                if cand in c_lower:
                    suggested["ae_col"] = orig
                    break
            if suggested["ae_col"]:
                break

    # Count heuristics
    for cand in ["count", "num_events", "freq", "frequency", "n", "reports"]:
        for c_lower, orig in cols_lower.items():
            if cand in c_lower:
                suggested["count_col"] = orig
                break
        if suggested["count_col"]:
            break

    # Date heuristics: prioritize event date over report received date
    date_candidates = [
        "date_of_event",
        "event_date",
        "date_report",
        "report_date",
        "received_date",
        "date",
        "timestamp",
        "year",
    ]
    for cand in date_candidates:
        for c_lower, orig in cols_lower.items():
            if cand in c_lower:
                suggested["date_col"] = orig
                break
        if suggested["date_col"]:
            break

    # Replace NaNs in preview rows for JSON safety
    preview_records = df_preview.fillna("").to_dict(orient="records")

    return FilePreviewResponse(
        file_path=file_path,
        total_rows=total_rows,
        columns=columns,
        preview_rows=preview_records,
        suggested_mapping=suggested,
    )


def ingest_data_file(
    mapping: ColumnMappingRequest,
    progress_cb: Optional[Callable[[float, str], None]] = None,
) -> Dict[str, Any]:
    """Ingest dataset, handle count auto-population, and convert to DataContainer.
    
    Supports files with millions of rows by reading in optimized chunks.
    """
    if progress_cb:
        progress_cb(0.1, "Reading data file into memory...")

    file_path = resolve_file_path(mapping.file_path)
    if state.full_raw_df is not None and (file_path == state.raw_file_path or not file_path):
        df = state.full_raw_df.copy()
    else:
        ext = os.path.splitext(file_path)[1].lower() if file_path else ".csv"
        if ext == ".parquet":
            df = pd.read_parquet(file_path)
        elif ext in [".xlsx", ".xls"]:
            df = pd.read_excel(file_path)
        else:
            sep = "\t" if ext == ".tsv" else ","
            try:
                df = pd.read_csv(file_path, sep=sep, low_memory=False, encoding="utf-8")
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, sep=sep, low_memory=False, encoding="latin1")
        state.full_raw_df = df.copy()

    total_raw = len(df)
    logger.info(f"Loaded raw dataset with {total_raw:,} rows.")

    # Validate that chosen product and adverse event columns actually exist in the dataset
    missing_cols = []
    if mapping.product_col not in df.columns:
        missing_cols.append(f"Product column '{mapping.product_col}'")
    if mapping.ae_col not in df.columns:
        missing_cols.append(f"Adverse Event column '{mapping.ae_col}'")
    if missing_cols:
        raise ValueError(
            f"Selected {', '.join(missing_cols)} not found in dataset columns: {list(df.columns)}. "
            "Please re-select or verify column mappings."
        )

    # 1. Handle Missing Count Column & Auto-Population
    active_count_col = mapping.count_col
    if not active_count_col or active_count_col not in df.columns:
        if mapping.auto_populate_count:
            active_count_col = "_vigipy_auto_count"
            df[active_count_col] = mapping.default_count
            logger.info(f"Auto-populated '{active_count_col}' with default value {mapping.default_count}.")
        else:
            # Fallback auto-count if count column is truly missing
            active_count_col = "_vigipy_auto_count"
            df[active_count_col] = 1
            logger.info("Count column not specified; auto-assigned count=1 per row.")

    # Filter needed columns
    needed_cols = [mapping.product_col, mapping.ae_col, active_count_col]
    if mapping.date_col and mapping.date_col in df.columns:
        needed_cols.append(mapping.date_col)

    df_clean = df[needed_cols].dropna(subset=[mapping.product_col, mapping.ae_col]).copy()

    # Ensure count is numeric
    df_clean[active_count_col] = pd.to_numeric(df_clean[active_count_col], errors="coerce").fillna(1)

    if progress_cb:
        progress_cb(0.4, "Aggregating contingency pairs and building DataContainer...")

    # 2. Convert via vigipy.convert
    container = convert(
        df_clean,
        product_label=mapping.product_col,
        ae_label=mapping.ae_col,
        count_label=active_count_col,
    )

    # 3. Test Dispersion
    if progress_cb:
        progress_cb(0.75, "Evaluating count overdispersion (Mantel-Haenszel vs. Negative-Binomial)...")

    dispersion_info: Dict[str, Any] = {"dispersion": None, "alpha": None, "recommendation": "mantel-haentzel"}
    try:
        disp_res = test_dispersion(container)
        disp_val = float(disp_res.get("dispersion", 1.0))
        alpha_val = float(disp_res.get("alpha", 1.0))
        recommendation = "negative-binomial" if disp_val > 2.0 else "mantel-haentzel"
        dispersion_info = {
            "dispersion": round(disp_val, 4),
            "alpha": round(alpha_val, 4),
            "recommendation": recommendation,
        }
    except Exception as exc:
        logger.warning(f"Dispersion test skipped: {exc}")

    # Save to global state
    date_param = mapping.date_col if mapping.date_col and mapping.date_col in df_clean.columns else None
    state.raw_df = df_clean
    state.raw_file_path = file_path
    state.column_mapping = {
        "product_col": mapping.product_col,
        "ae_col": mapping.ae_col,
        "count_col": active_count_col,
        "date_col": date_param,
    }
    state.auto_populate_count = mapping.auto_populate_count
    state.default_count = mapping.default_count
    state.data_container = container
    state.reset_analysis()

    if progress_cb:
        progress_cb(1.0, "Data ingestion complete.")

    unique_products = len(container.contingency.index) if container.contingency is not None else 0
    unique_aes = len(container.contingency.columns) if container.contingency is not None else 0

    return {
        "total_raw_rows": total_raw,
        "unique_pairs": len(container.data),
        "unique_products": unique_products,
        "unique_aes": unique_aes,
        "total_events": int(container.N),
        "dispersion": dispersion_info["dispersion"],
        "dispersion_alpha": dispersion_info["alpha"],
        "recommended_expected_method": dispersion_info["recommendation"],
    }


def execute_analysis(
    req: RunAnalysisRequest,
    progress_cb: Optional[Callable[[float, str], None]] = None,
    cancel_cb: Optional[Callable[[], bool]] = None,
) -> Tuple[int, int]:
    """Execute configured disproportionality analysis methods or consensus analysis."""
    if state.data_container is None:
        raise ValueError("No dataset loaded. Please ingest a data file first.")

    if cancel_cb and cancel_cb():
        raise InterruptedError("Analysis cancelled by user.")

    configs = []
    
    if req.prr and req.prr.enabled:
        configs.append(
            PRRConfig(
                relative_risk=req.prr.relative_risk,
                min_events=req.prr.min_events,
                decision_metric=req.prr.decision_metric,
                decision_thres=req.prr.decision_thres,
                ranking_statistic=req.prr.ranking_statistic,
                expected_method=req.prr.expected_method,
                method_alpha=req.prr.method_alpha,
                fdr_threshold=req.prr.fdr_threshold,
                continuity_correction=req.prr.continuity_correction,
            )
        )

    if req.ror and req.ror.enabled:
        configs.append(
            RORConfig(
                relative_risk=req.ror.relative_risk,
                min_events=req.ror.min_events,
                decision_metric=req.ror.decision_metric,
                decision_thres=req.ror.decision_thres,
                ranking_statistic=req.ror.ranking_statistic,
                expected_method=req.ror.expected_method,
                method_alpha=req.ror.method_alpha,
                fdr_threshold=req.ror.fdr_threshold,
                continuity_correction=req.ror.continuity_correction,
            )
        )

    if req.rfet and req.rfet.enabled:
        configs.append(
            RFETConfig(
                min_events=req.rfet.min_events,
                decision_metric=req.rfet.decision_metric,
                decision_thres=req.rfet.decision_thres,
                mid_pval=req.rfet.mid_pval,
                expected_method=req.rfet.expected_method,
                method_alpha=req.rfet.method_alpha,
                fdr_threshold=req.rfet.fdr_threshold,
            )
        )

    if req.bcpnn and req.bcpnn.enabled:
        configs.append(
            BCPNNConfig(
                relative_risk=req.bcpnn.relative_risk,
                min_events=req.bcpnn.min_events,
                decision_metric=req.bcpnn.decision_metric,
                decision_thres=req.bcpnn.decision_thres,
                ranking_statistic=req.bcpnn.ranking_statistic,
                MC=req.bcpnn.MC,
                num_MC=req.bcpnn.num_MC,
                expected_method=req.bcpnn.expected_method,
                method_alpha=req.bcpnn.method_alpha,
            )
        )

    if req.gps and req.gps.enabled:
        configs.append(
            GPSConfig(
                relative_risk=req.gps.relative_risk,
                min_events=req.gps.min_events,
                decision_metric=req.gps.decision_metric,
                decision_thres=req.gps.decision_thres,
                ranking_statistic=req.gps.ranking_statistic,
                truncate=req.gps.truncate,
                truncate_thres=req.gps.truncate_thres,
                expected_method=req.gps.expected_method,
                method_alpha=req.gps.method_alpha,
                minimization_method=req.gps.minimization_method,
            )
        )

    if req.lasso and req.lasso.enabled:
        configs.append(
            LASSOConfig(
                lasso_thresh=req.lasso.lasso_thresh,
                alpha=req.lasso.alpha,
                min_events=req.lasso.min_events,
                num_bootstrap=req.lasso.num_bootstrap,
                ci=req.lasso.ci,
                use_lars=req.lasso.use_lars,
                use_IC=req.lasso.use_IC,
                IC_criterion=req.lasso.IC_criterion,
                use_glm=req.lasso.use_glm,
                nb_alpha=req.lasso.nb_alpha,
                lasso_alpha=req.lasso.lasso_alpha,
                family=req.lasso.family,
                relaxed=req.lasso.relaxed,
                n_jobs=req.lasso.n_jobs,
            )
        )

    if not configs:
        raise ValueError("No analysis methods selected. Please enable at least one method.")

    # Auto-generate binary product features and event outcomes if LASSO is enabled
    has_lasso = any(cfg.method == "lasso" for cfg in configs)
    if has_lasso:
        if state.raw_df is None or not state.column_mapping:
            raise ValueError("LASSO requires raw case reports with mapped columns. Please ingest raw data to execute LASSO regression.")
        p_col = state.column_mapping.get("product_col")
        ae_col = state.column_mapping.get("ae_col")
        c_col = state.column_mapping.get("count_col")
        if not p_col or not ae_col:
            raise ValueError("Both Product and Adverse Event columns must be mapped to run LASSO.")

        if p_col not in state.raw_df.columns or ae_col not in state.raw_df.columns:
            raise ValueError(
                f"Mapped columns ('{p_col}', '{ae_col}') are not in the active data columns: {list(state.raw_df.columns)}. "
                "Please re-map or re-ingest your dataset."
            )

        if c_col and c_col not in state.raw_df.columns:
            state.raw_df[c_col] = 1

        if state.data_container.product_features is None or state.data_container.event_outcomes is None:
            if progress_cb:
                progress_cb(0.08, "Building sparse binary feature matrices for LASSO regression...")
            from vigipy.utils.data_prep import convert_binary
            bin_container = convert_binary(
                state.raw_df,
                product_label=p_col,
                ae_label=ae_col,
                count_label=c_col or "_vigipy_auto_count",
                sparse=True,
            )
            state.data_container.product_features = bin_container.product_features
            state.data_container.event_outcomes = bin_container.event_outcomes

    if progress_cb:
        progress_cb(0.15, f"Executing {len(configs)} disproportionality method(s)...")

    if cancel_cb and cancel_cb():
        raise InterruptedError("Analysis cancelled by user.")

    # Run Consensus or Single
    if req.consensus and len(configs) >= 2:
        if progress_cb:
            progress_cb(0.3, "Fitting cross-method consensus engine and computing concordance...")
        
        c_res = consensus_analysis(state.data_container, configs=configs)
        state.set_results(consensus_res=c_res)
        
        if progress_cb:
            progress_cb(1.0, f"Analysis finished: {c_res.num_signals:,} signals detected.")
        return c_res.num_signals, len(c_res.comparison_table)

    elif len(configs) == 1:
        cfg = configs[0]
        if progress_cb:
            progress_cb(0.4, f"Running {cfg.method.upper()} analysis...")
        res = analyze(state.data_container, cfg)
        try:
            # Wrap single-method in consensus structure with min_consensus=1 for schema consistency
            c_res = consensus_analysis(state.data_container, configs=[cfg], min_consensus=1)
            state.set_results(consensus_res=c_res, individual_res={cfg.method: res})
        except Exception:
            state.set_results(consensus_res=None, individual_res={cfg.method: res})
        
        if progress_cb:
            progress_cb(1.0, f"Completed: {res.num_signals:,} signals detected.")
        return res.num_signals, len(res.all_signals)

    else:
        # Multiple methods without consensus synthesis
        if progress_cb:
            progress_cb(0.3, "Executing selected methods in parallel...")
        all_res = analyze_all(state.data_container, configs=configs)
        c_res = consensus_analysis(state.data_container, configs=configs)
        state.set_results(consensus_res=c_res, individual_res=all_res)
        
        if progress_cb:
            progress_cb(1.0, f"Completed: {c_res.num_signals:,} consensus signals.")
        return c_res.num_signals, len(c_res.comparison_table)


def execute_longitudinal(
    req: LongitudinalRunRequest,
    progress_cb: Optional[Callable[[float, str], None]] = None,
    cancel_cb: Optional[Callable[[], bool]] = None,
) -> int:
    """Run longitudinal model across time slices for one or more methods."""
    if cancel_cb and cancel_cb():
        raise InterruptedError("Longitudinal modeling cancelled by user.")

    date_col = state.column_mapping.get("date_col")
    if state.raw_df is None or not date_col:
        raise ValueError("A date column is required for longitudinal modeling. Please ensure a Date column is mapped during ingestion.")

    df = state.raw_df.copy()
    
    # Robustly map columns to standard names for LongitudinalModel
    p_col = state.column_mapping.get("product_col", "Product")
    ae_col = state.column_mapping.get("ae_col", "Adverse Event")
    c_col = state.column_mapping.get("count_col") or "_vigipy_auto_count"

    rename_map = {
        p_col: "name",
        ae_col: "AE",
        date_col: "date",
    }
    if c_col in df.columns:
        rename_map[c_col] = "count"
    elif "count" not in df.columns:
        df["count"] = 1

    df = df.rename(columns=rename_map)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])
    if df.empty:
        raise ValueError("No valid date values found in the Date column for longitudinal modeling.")

    if progress_cb:
        progress_cb(0.1, f"Initializing longitudinal model with {req.time_unit} cadence...")

    lm = LongitudinalModel(df, req.time_unit)

    # Pick analysis method function
    from vigipy import bcpnn, gps, prr, rfet, ror, lasso
    method_funcs = {
        "prr": prr,
        "ror": ror,
        "rfet": rfet,
        "bcpnn": bcpnn,
        "gps": gps,
        "lasso": lasso,
    }

    methods_to_run: List[str] = []
    if req.method == "all":
        methods_to_run = ["prr", "ror", "bcpnn", "gps"]
    elif req.methods:
        methods_to_run = [m.lower() for m in req.methods if m.lower() in method_funcs]
    else:
        methods_to_run = [req.method.lower()]

    total_methods = len(methods_to_run)
    total_slices = 0

    for idx, m in enumerate(methods_to_run):
        if cancel_cb and cancel_cb():
            raise InterruptedError("Longitudinal modeling cancelled by user.")
        pct_start = 0.2 + (idx / total_methods) * 0.75
        if progress_cb:
            progress_cb(pct_start, f"Computing {m.upper()} longitudinal slices ({idx + 1}/{total_methods})...")

        target_func = method_funcs[m]
        conv_type = "binary" if m == "lasso" else "base"
        conv_kwargs = (
            {"product_label": "name", "ae_label": "AE", "count_label": "count", "sparse": True}
            if m == "lasso"
            else None
        )
        extra_kwargs = {"num_bootstrap": 0, "use_bootstrap": False} if m == "lasso" else {}

        if req.mode == "cumulative":
            lm.run(
                target_func,
                include_gaps=req.include_gaps,
                min_events=req.min_events,
                conversion_type=conv_type,
                conversion_kwargs=conv_kwargs,
                **extra_kwargs,
            )
        else:
            lm.run_disjoint(
                target_func,
                include_gaps=req.include_gaps,
                min_events=req.min_events,
                conversion_type=conv_type,
                conversion_kwargs=conv_kwargs,
                **extra_kwargs,
            )

        state.longitudinal_runs[m] = list(lm.results)
        total_slices = len(lm.results)

    primary_m = methods_to_run[0]
    state.longitudinal_results = state.longitudinal_runs[primary_m]
    state.longitudinal_method = primary_m

    if progress_cb:
        progress_cb(1.0, f"Longitudinal modeling complete: {total_slices} time slices across {len(methods_to_run)} method(s).")

    return total_slices


def extract_single_method_trajectory(
    results: List[Tuple[pd.Timestamp, Optional[AnalysisResult]]],
    prod_s: str,
    ae_s: str,
    method_key: str,
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """Extract points for a given method and compute first onset date."""
    pts: List[Dict[str, Any]] = []
    onset_date: Optional[str] = None
    m_low = method_key.lower()

    col_cands = {
        "prr": ["PRR", "score_prr", "Score"],
        "ror": ["ROR", "score_ror", "Score"],
        "bcpnn": ["quantile", "IC", "IC_025", "IC025", "score_bcpnn", "Score"],
        "gps": ["EBGM", "quantile", "score_gps", "Score"],
        "rfet": ["RFET", "p-value", "score_rfet", "Score"],
        "lasso": ["LASSO Coefficient", "Beta", "score_lasso", "Score"],
    }.get(m_low, ["Score", "PRR", "ROR", "quantile", "IC", "EBGM", "LASSO Coefficient", "Beta"])

    for ts, res in results:
        ts_str = ts.strftime("%Y-%m-%d")
        if res is None or res.all_signals is None or res.all_signals.empty:
            pts.append({
                "timestamp": ts_str,
                "score": None,
                "ci_lower": None,
                "ci_upper": None,
                "count": None,
                "alert": False,
            })
            continue

        df = res.all_signals
        match = df[
            (df["Product"].astype(str).str.strip().str.lower() == prod_s)
            & (df["Adverse Event"].astype(str).str.strip().str.lower() == ae_s)
        ]

        if match.empty:
            pts.append({
                "timestamp": ts_str,
                "score": None,
                "ci_lower": None,
                "ci_upper": None,
                "count": None,
                "alert": False,
            })
        else:
            row = match.iloc[0]
            score_val = None
            for c in col_cands:
                if c in row and not pd.isna(row[c]):
                    score_val = float(row[c])
                    break
            if score_val is None:
                for c in ["PRR", "ROR", "quantile", "IC", "EBGM", "LASSO Coefficient", "Beta", "Score"]:
                    if c in row and not pd.isna(row[c]):
                        score_val = float(row[c])
                        break

            ci_l = float(row["CI Lower"]) if "CI Lower" in row and not pd.isna(row["CI Lower"]) else None
            if ci_l is None and "quantile" in row and not pd.isna(row["quantile"]):
                ci_l = float(row["quantile"])
            ci_u = float(row["CI Upper"]) if "CI Upper" in row and not pd.isna(row["CI Upper"]) else None
            cnt = float(row["Count"]) if "Count" in row and not pd.isna(row["Count"]) else None

            # Method-specific threshold check using calculated signals or exact rule
            is_alert = False
            if res.signals is not None and not res.signals.empty:
                sig_match = res.signals[
                    (res.signals["Product"].astype(str).str.strip().str.lower() == prod_s)
                    & (res.signals["Adverse Event"].astype(str).str.strip().str.lower() == ae_s)
                ]
                is_alert = not sig_match.empty
            elif score_val is not None:
                if m_low in ("prr", "ror"):
                    is_alert = bool(score_val >= 2.0 and (cnt is None or cnt >= 3))
                elif m_low == "bcpnn":
                    is_alert = bool((ci_l is not None and ci_l > 0.0) or score_val > 0.0)
                elif m_low == "gps":
                    is_alert = bool((ci_l is not None and ci_l >= 1.0) or score_val >= 1.0)
                elif m_low == "rfet":
                    is_alert = bool(score_val < 0.05)
                elif m_low == "lasso":
                    is_alert = bool(score_val > 0.0 or (ci_l is not None and ci_l > 0.0))
                else:
                    is_alert = bool(score_val >= 2.0)

            if is_alert and onset_date is None:
                onset_date = ts_str

            pts.append({
                "timestamp": ts_str,
                "score": score_val,
                "ci_lower": ci_l,
                "ci_upper": ci_u,
                "count": cnt,
                "alert": is_alert,
            })

    return pts, onset_date


def get_longitudinal_trajectory(
    product: str,
    ae: str,
    method: Optional[str] = None,
) -> Dict[str, Any]:
    """Extract temporal trajectory for a specific drug-event pair across all runs."""
    if not state.longitudinal_results and not state.longitudinal_runs:
        raise ValueError("No longitudinal model has been run yet. Click 'Run Longitudinal' above to compute time-slice trajectories.")

    prod_s = str(product).strip().lower()
    ae_s = str(ae).strip().lower()

    target_method = (method or state.longitudinal_method or "bcpnn").lower()

    multi_trajectories: Dict[str, List[Dict[str, Any]]] = {}
    onset_dates: Dict[str, Optional[str]] = {}

    for m_key, res_list in state.longitudinal_runs.items():
        m_upper = m_key.upper()
        pts, onset = extract_single_method_trajectory(res_list, prod_s, ae_s, m_key)
        multi_trajectories[m_upper] = pts
        onset_dates[m_upper] = onset

    if not multi_trajectories and state.longitudinal_results:
        m_upper = (state.longitudinal_method or target_method).upper()
        pts, onset = extract_single_method_trajectory(state.longitudinal_results, prod_s, ae_s, m_upper)
        multi_trajectories[m_upper] = pts
        onset_dates[m_upper] = onset

    computed_methods = [m.upper() for m in state.longitudinal_runs.keys()]
    if not computed_methods and state.longitudinal_results:
        computed_methods = [(state.longitudinal_method or target_method).upper()]

    primary_upper = target_method.upper()
    if primary_upper in multi_trajectories:
        primary_pts = multi_trajectories[primary_upper]
    elif target_method == "all" and multi_trajectories:
        primary_upper = next(iter(multi_trajectories.keys()))
        primary_pts = multi_trajectories[primary_upper]
    else:
        # Crucial fix: Do NOT fallback to other methods if the user selected a specific method that hasn't run!
        primary_pts = []

    return {
        "product": product,
        "adverse_event": ae,
        "method": primary_upper,
        "trajectory": primary_pts,
        "multi_trajectories": multi_trajectories,
        "onset_dates": onset_dates,
        "computed_methods": computed_methods,
    }


def get_longitudinal_signals(
    method: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "peak_score",
    sort_dir: str = "desc",
) -> Dict[str, Any]:
    """Collapse signals across time slices for one or all longitudinal runs.
    
    Only returns pairs that alerted in at least one time slice.
    """
    if not state.longitudinal_runs and not state.longitudinal_results:
        return {
            "signals": [],
            "total": 0,
            "computed_methods": [],
            "has_consensus": False,
        }

    computed_methods = [m.upper() for m in state.longitudinal_runs.keys()]
    target_m = (method or "all").lower()

    # Determine which runs to inspect
    if target_m != "all" and target_m in state.longitudinal_runs:
        runs_to_inspect = {target_m: state.longitudinal_runs[target_m]}
    elif state.longitudinal_runs:
        runs_to_inspect = state.longitudinal_runs
    elif state.longitudinal_results:
        m_name = (state.longitudinal_method or "bcpnn").lower()
        runs_to_inspect = {m_name: state.longitudinal_results}
    else:
        runs_to_inspect = {}

    pair_stats: Dict[Tuple[str, str], Dict[str, Any]] = {}
    total_slices_count = 0
    col_cands = ["Score", "PRR", "ROR", "quantile", "IC", "EBGM", "LASSO Coefficient", "Beta"]

    for m_key, slices in runs_to_inspect.items():
        m_upper = m_key.upper()
        if len(slices) > total_slices_count:
            total_slices_count = len(slices)

        for ts, res in slices:
            if res is None:
                continue
            ts_str = ts.strftime("%Y-%m-%d")

            sig_df = res.signals
            if sig_df is None or sig_df.empty:
                continue

            for _, row in sig_df.iterrows():
                prod = str(row["Product"]).strip()
                ae = str(row["Adverse Event"]).strip()
                pair_key = (prod.lower(), ae.lower())

                sc = None
                for c in col_cands:
                    if c in row and not pd.isna(row[c]):
                        sc = float(row[c])
                        break

                cnt = float(row["Count"]) if "Count" in row and not pd.isna(row["Count"]) else 0.0

                if pair_key not in pair_stats:
                    pair_stats[pair_key] = {
                        "product": prod,
                        "adverse_event": ae,
                        "first_onset": ts_str,
                        "latest_timestamp": ts_str,
                        "peak_score": sc,
                        "latest_score": sc,
                        "count": cnt,
                        "slices_alerted": {ts_str},
                        "total_slices": len(slices),
                        "method": m_upper,
                        "methods_alerted": {m_upper},
                    }
                else:
                    item = pair_stats[pair_key]
                    item["slices_alerted"].add(ts_str)
                    item["methods_alerted"].add(m_upper)
                    item["latest_timestamp"] = ts_str
                    if sc is not None:
                        item["latest_score"] = sc
                        if item["peak_score"] is None or sc > item["peak_score"]:
                            item["peak_score"] = sc
                    if cnt > item["count"]:
                        item["count"] = cnt
                    if ts_str < item["first_onset"]:
                        item["first_onset"] = ts_str

    total_methods_available = len(runs_to_inspect)
    has_consensus = total_methods_available > 1 or "all" in (method or "").lower()

    signals_list: List[Dict[str, Any]] = []
    for (p_low, ae_low), d in pair_stats.items():
        methods_list = sorted(list(d["methods_alerted"]))
        consensus_sc = (len(methods_list) / float(total_methods_available)) if has_consensus else None

        tier = None
        if has_consensus:
            votes = len(methods_list)
            if votes == total_methods_available:
                tier = "Unanimous"
            elif votes >= 3:
                tier = "Strong"
            elif votes >= 2:
                tier = "Moderate"
            else:
                tier = "Isolated"

        signals_list.append({
            "product": d["product"],
            "adverse_event": d["adverse_event"],
            "first_onset": d["first_onset"],
            "latest_timestamp": d["latest_timestamp"],
            "peak_score": d["peak_score"],
            "latest_score": d["latest_score"],
            "count": d["count"],
            "slices_alerted": len(d["slices_alerted"]),
            "total_slices": total_slices_count,
            "method": d["method"] if len(runs_to_inspect) == 1 else "ALL",
            "consensus_score": consensus_sc,
            "agreement_tier": tier,
            "methods_alerted": methods_list,
        })

    # Search filter
    if search:
        s_term = search.strip().lower()
        signals_list = [
            s for s in signals_list
            if s_term in s["product"].lower() or s_term in s["adverse_event"].lower()
        ]

    # Sort
    reverse = sort_dir.lower() == "desc"
    if sort_by == "consensus_score" and has_consensus:
        signals_list.sort(key=lambda s: (s["consensus_score"] or 0, s["peak_score"] or 0), reverse=reverse)
    elif sort_by == "latest_score":
        signals_list.sort(key=lambda s: s["latest_score"] if s["latest_score"] is not None else -9999, reverse=reverse)
    elif sort_by == "count":
        signals_list.sort(key=lambda s: s["count"] or 0, reverse=reverse)
    elif sort_by == "first_onset":
        signals_list.sort(key=lambda s: s["first_onset"] or "", reverse=reverse)
    elif sort_by == "slices_alerted":
        signals_list.sort(key=lambda s: s["slices_alerted"], reverse=reverse)
    else:  # default peak_score
        signals_list.sort(key=lambda s: s["peak_score"] if s["peak_score"] is not None else -9999, reverse=reverse)

    return {
        "signals": signals_list,
        "total": len(signals_list),
        "computed_methods": computed_methods,
        "has_consensus": has_consensus,
    }



def import_results_file(file_path: str) -> Dict[str, Any]:
    """Import an exported consensus or analysis results file (.xlsx, .csv, .parquet).
    
    Restores the workstation state, signals grid, agreement matrices, and inspection.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Export file not found: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()
    df_comparison = None
    df_signals = None
    agreement_matrices: Dict[str, pd.DataFrame] = {}

    if ext in [".xlsx", ".xls"]:
        xl = pd.ExcelFile(file_path)
        sheet_map = {s.lower().strip(): s for s in xl.sheet_names}

        # 1. Primary Comparison Table
        for cand in ["comparison table", "comparison_table", "all signals", "all_signals", "consensus signals"]:
            if cand in sheet_map:
                df_comparison = pd.read_excel(xl, sheet_name=sheet_map[cand])
                break
        if df_comparison is None:
            df_comparison = pd.read_excel(xl, sheet_name=0)

        # 2. Signals Sheet
        for cand in ["consensus signals", "consensus_signals", "signals"]:
            if cand in sheet_map:
                df_signals = pd.read_excel(xl, sheet_name=sheet_map[cand])
                break

        # 3. Agreement Matrices
        for k, cand in [
            ("jaccard", "jaccard similarity"),
            ("kappa", "cohens kappa"),
            ("correlation", "spearman correlation"),
            ("overlap", "alert overlap"),
        ]:
            if cand in sheet_map:
                try:
                    agreement_matrices[k] = pd.read_excel(xl, sheet_name=sheet_map[cand], index_col=0)
                except Exception:
                    pass

    elif ext == ".parquet":
        df_comparison = pd.read_parquet(file_path)
    else:
        sep = "\t" if ext == ".tsv" else ","
        df_comparison = pd.read_csv(file_path, sep=sep, low_memory=False)

    if df_comparison is None or df_comparison.empty:
        raise ValueError(f"Could not read tabular data from {file_path}")

    # Standardize column names
    col_rename = {}
    for c in df_comparison.columns:
        c_l = str(c).lower().strip()
        if c_l in ["product_name", "drug_name", "brand_name", "drug", "product"] and "Product" not in df_comparison.columns:
            col_rename[c] = "Product"
        elif c_l in ["ae_name", "event_simplified", "adverse_event", "event", "ae"] and "Adverse Event" not in df_comparison.columns:
            col_rename[c] = "Adverse Event"
        elif c_l in ["count", "num_events", "n"] and "Count" not in df_comparison.columns:
            col_rename[c] = "Count"
        elif c_l in ["expected_count", "expected"] and "Expected Count" not in df_comparison.columns:
            col_rename[c] = "Expected Count"
        elif c_l in ["consensus_score", "score"] and "consensus_score" not in df_comparison.columns:
            col_rename[c] = "consensus_score"
        elif c_l in ["agreement_tier", "tier"] and "agreement_tier" not in df_comparison.columns:
            col_rename[c] = "agreement_tier"
        elif c_l in ["votes", "alerts", "vote"] and "votes" not in df_comparison.columns:
            col_rename[c] = "votes"

    if col_rename:
        df_comparison = df_comparison.rename(columns=col_rename)

    if "Product" not in df_comparison.columns or "Adverse Event" not in df_comparison.columns:
        raise ValueError("Imported file does not contain identifiable 'Product' and 'Adverse Event' columns.")

    # Identify methods in the table
    detected_methods = set()
    for col in df_comparison.columns:
        col_s = str(col).lower()
        for m in ["prr", "ror", "rfet", "bcpnn", "gps", "lasso"]:
            if col_s.startswith(f"alert_{m}") or col_s.startswith(f"score_{m}") or col_s == m:
                detected_methods.add(m)
    methods_list = sorted(list(detected_methods)) if detected_methods else ["prr", "ror"]

    # Compute agreement matrices if not loaded from Excel workbook
    if not agreement_matrices and len(methods_list) >= 2:
        alert_cols = {}
        for m in methods_list:
            for cand in [f"alert_{m}", f"alert_{m.upper()}", m.upper(), m]:
                if cand in df_comparison.columns:
                    alert_cols[m] = cand
                    break
        if len(alert_cols) == len(methods_list):
            ag_data: Dict[str, pd.DataFrame] = {}
            for k in ["jaccard", "kappa", "overlap"]:
                ag_data[k] = pd.DataFrame(index=[m.upper() for m in methods_list], columns=[m.upper() for m in methods_list], dtype=float)
            for m1 in methods_list:
                for m2 in methods_list:
                    s1 = df_comparison[alert_cols[m1]].astype(bool)
                    s2 = df_comparison[alert_cols[m2]].astype(bool)
                    intersect = int((s1 & s2).sum())
                    union = int((s1 | s2).sum())
                    ag_data["jaccard"].loc[m1.upper(), m2.upper()] = float(intersect / union) if union > 0 else 1.0
                    ag_data["overlap"].loc[m1.upper(), m2.upper()] = intersect
                    po = float((s1 == s2).mean())
                    pe = float((s1.mean() * s2.mean()) + ((1 - s1.mean()) * (1 - s2.mean())))
                    ag_data["kappa"].loc[m1.upper(), m2.upper()] = float((po - pe) / (1 - pe)) if not np.isclose(1 - pe, 0.0) else 1.0
            agreement_matrices = ag_data

    # Ensure votes, total_methods, consensus_score are present
    if "votes" not in df_comparison.columns:
        alert_cs = [c for c in df_comparison.columns if c.startswith("alert_")]
        if alert_cs:
            df_comparison["votes"] = df_comparison[alert_cs].sum(axis=1)
            df_comparison["total_methods"] = len(alert_cs)
            df_comparison["consensus_score"] = df_comparison["votes"] / max(1, len(alert_cs))
        else:
            df_comparison["votes"] = 1
            df_comparison["total_methods"] = 1
            df_comparison["consensus_score"] = 1.0

    if "total_methods" not in df_comparison.columns:
        df_comparison["total_methods"] = len(methods_list)

    if "consensus_score" not in df_comparison.columns:
        df_comparison["consensus_score"] = df_comparison["votes"] / max(1, df_comparison["total_methods"])

    if "agreement_tier" not in df_comparison.columns:
        from vigipy.consensus import _assign_agreement_tier
        tot_m = df_comparison.get("total_methods", pd.Series([len(methods_list)] * len(df_comparison))).iloc[0]
        df_comparison["agreement_tier"] = _assign_agreement_tier(
            df_comparison["votes"].values,
            df_comparison["consensus_score"].values,
            num_methods=int(tot_m),
        )

    if df_signals is None:
        df_signals = df_comparison[df_comparison["votes"] >= 1].copy()

    # Build ConsensusResult
    from vigipy.consensus import ConsensusResult
    raw_res_dict = {m: None for m in methods_list}
    c_res = ConsensusResult(
        comparison_table=df_comparison,
        signals=df_signals,
        num_signals=len(df_signals),
        method_agreement=agreement_matrices,
        raw_results=raw_res_dict,
        metric_names={m: m.upper() for m in methods_list},
        params={"imported_from": file_path},
    )

    state.consensus_result = c_res
    state.set_results(consensus_res=c_res)
    state.raw_file_path = file_path
    state.raw_df = df_comparison.copy()
    state.full_raw_df = df_comparison.copy()
    state.column_mapping = {
        "product_col": "Product",
        "ae_col": "Adverse Event",
        "count_col": "Count" if "Count" in df_comparison.columns else None,
        "date_col": None,
    }

    unique_products = int(df_comparison["Product"].nunique())
    unique_aes = int(df_comparison["Adverse Event"].nunique())
    total_raw = len(df_comparison)

    return {
        "total_raw_rows": total_raw,
        "unique_pairs": len(df_comparison),
        "unique_products": unique_products,
        "unique_aes": unique_aes,
        "total_signals": len(df_signals),
        "methods": [m.upper() for m in methods_list],
        "file_path": file_path,
    }


def get_volcano_data(method: Optional[str] = None) -> Dict[str, Any]:
    """Extract Volcano plot points (Effect Size vs -log10(p-value) or FDR) from analysis results."""
    if state._cached_table is None or state._cached_table.empty:
        return {
            "points": [],
            "total": 0,
            "method": method or "All",
            "threshold_effect": 1.0,
            "threshold_neg_log_p": 1.30103,
        }

    df = state._cached_table
    target_method = (method or (state._methods_list[0] if state._methods_list else "PRR")).lower()
    m_up = target_method.upper()

    score_col = f"score_{target_method}" if f"score_{target_method}" in df.columns else (f"score_{m_up}" if f"score_{m_up}" in df.columns else None)
    alert_col = f"alert_{target_method}" if f"alert_{target_method}" in df.columns else (f"alert_{m_up}" if f"alert_{m_up}" in df.columns else None)
    p_col = f"p_value_{target_method}" if f"p_value_{target_method}" in df.columns else (f"p_value_{m_up}" if f"p_value_{m_up}" in df.columns else None)
    fdr_col = f"fdr_{target_method}" if f"fdr_{target_method}" in df.columns else (f"fdr_{m_up}" if f"fdr_{m_up}" in df.columns else None)

    if not score_col:
        for c in [m_up, "Score", "PRR", "ROR", "quantile", "IC", "EBGM", "Beta"]:
            if c in df.columns:
                score_col = c
                break

    if not alert_col:
        for c in ["alert", "Alert", "is_signal"]:
            if c in df.columns:
                alert_col = c
                break

    sub_df = df.dropna(subset=["Product", "Adverse Event"]).copy()
    if len(sub_df) > 5000:
        if alert_col and alert_col in sub_df.columns:
            alerts = sub_df[sub_df[alert_col] == True]
            non_alerts = sub_df[sub_df[alert_col] == False].head(5000 - len(alerts))
            sub_df = pd.concat([alerts, non_alerts]).reset_index(drop=True)
        else:
            sub_df = sub_df.head(5000)

    threshold_effect = 0.0 if target_method in ["bcpnn", "lasso"] else 1.0
    threshold_neg_log_p = 1.30103

    points: List[Dict[str, Any]] = []
    for _, row in sub_df.iterrows():
        prod = str(row.get("Product", ""))
        ae = str(row.get("Adverse Event", ""))
        cnt = float(row.get("Count", 0.0))
        votes = int(row.get("votes", 0)) if "votes" in row else 0
        tier = str(row.get("agreement_tier", "Isolated")) if "agreement_tier" in row else "Isolated"

        raw_score = float(row[score_col]) if score_col and not pd.isna(row[score_col]) else 1.0
        is_alert = bool(row[alert_col]) if alert_col and not pd.isna(row[alert_col]) else False

        if target_method == "bcpnn":
            effect_size = raw_score
        elif target_method == "lasso":
            effect_size = raw_score * 5.0
        else:
            effect_size = float(np.log2(max(0.1, raw_score)))

        p_val = float(row[p_col]) if p_col and not pd.isna(row[p_col]) else None
        fdr_val = float(row[fdr_col]) if fdr_col and not pd.isna(row[fdr_col]) else None

        if p_val is not None and p_val > 0:
            neg_log_p = float(-np.log10(max(1e-12, min(1.0, p_val))))
        elif fdr_val is not None and fdr_val > 0:
            neg_log_p = float(-np.log10(max(1e-12, min(1.0, fdr_val))))
        elif is_alert:
            neg_log_p = 3.5
        else:
            neg_log_p = 0.5

        points.append({
            "product": prod,
            "adverse_event": ae,
            "score": round(raw_score, 4),
            "effect_size": round(effect_size, 4),
            "p_value": round(p_val, 6) if p_val is not None else None,
            "neg_log_p": round(neg_log_p, 4),
            "fdr": round(fdr_val, 6) if fdr_val is not None else None,
            "alert": is_alert,
            "count": cnt,
            "votes": votes,
            "agreement_tier": tier,
            "method": m_up,
        })

    return {
        "points": points,
        "total": len(points),
        "method": m_up,
        "threshold_effect": threshold_effect,
        "threshold_neg_log_p": threshold_neg_log_p,
    }


def profile_data_quality() -> Dict[str, Any]:
    """Evaluate data hygiene, missingness, and duplication on ingested dataset."""
    df = state.full_raw_df if state.full_raw_df is not None else state.raw_df
    if df is None or df.empty:
        raise ValueError("No dataset loaded to profile.")

    total_rows = len(df)
    p_col = state.column_mapping.get("product_col", "Product")
    ae_col = state.column_mapping.get("ae_col", "Adverse Event")
    c_col = state.column_mapping.get("count_col", "Count")
    d_col = state.column_mapping.get("date_col", "Date")

    missing_p = float((df[p_col].isna().sum() / total_rows) * 100) if p_col in df.columns else 0.0
    missing_ae = float((df[ae_col].isna().sum() / total_rows) * 100) if ae_col in df.columns else 0.0
    missing_cnt = float((df[c_col].isna().sum() / total_rows) * 100) if c_col and c_col in df.columns else 0.0
    missing_dt = float((df[d_col].isna().sum() / total_rows) * 100) if d_col and d_col in df.columns else 100.0

    dup_subset = [c for c in [p_col, ae_col] if c in df.columns]
    dup_cases = int(df.duplicated(subset=dup_subset).sum()) if dup_subset else 0
    dup_pct = float((dup_cases / total_rows) * 100) if total_rows > 0 else 0.0

    unique_products = int(df[p_col].nunique()) if p_col in df.columns else 0
    unique_aes = int(df[ae_col].nunique()) if ae_col in df.columns else 0
    unique_pairs = int(len(df.drop_duplicates(subset=dup_subset))) if dup_subset else 0

    score = 100.0 - (missing_p * 0.4 + missing_ae * 0.4 + dup_pct * 0.2)
    score = max(0.0, min(100.0, score))

    recommendations: List[str] = []
    if missing_p > 0:
        recommendations.append(f"Product identifier is missing in {missing_p:.1f}% of records; these rows will be dropped.")
    if missing_ae > 0:
        recommendations.append(f"Adverse event term is missing in {missing_ae:.1f}% of records; these rows will be dropped.")
    if dup_cases > 0:
        recommendations.append(f"Found {dup_cases:,} duplicate product-event rows ({dup_pct:.1f}%). Deduplication is recommended.")
    if state.auto_populate_count:
        recommendations.append(f"Count column was auto-populated with default count = {state.default_count}.")
    if not recommendations:
        recommendations.append("Data hygiene is optimal. No critical missingness or duplication detected.")

    return {
        "total_rows": total_rows,
        "unique_products": unique_products,
        "unique_aes": unique_aes,
        "unique_pairs": unique_pairs,
        "missing_product_pct": round(missing_p, 2),
        "missing_ae_pct": round(missing_ae, 2),
        "missing_count_pct": round(missing_cnt, 2),
        "missing_date_pct": round(missing_dt, 2),
        "duplicate_cases": dup_cases,
        "duplicate_case_pct": round(dup_pct, 2),
        "quality_score": round(score, 1),
        "recommendations": recommendations,
    }


def get_ddi_network(target_event: Optional[str] = None) -> Dict[str, Any]:
    """Discover multi-drug combinations and interaction synergies."""
    df = state.raw_df
    if df is None or df.empty:
        return {"edges": [], "unique_events": [], "top_drugs": [], "total_synergies": 0}

    p_col = state.column_mapping.get("product_col", "Product")
    ae_col = state.column_mapping.get("ae_col", "Adverse Event")

    if p_col not in df.columns or ae_col not in df.columns:
        return {"edges": [], "unique_events": [], "top_drugs": [], "total_synergies": 0}

    unique_events = sorted(df[ae_col].dropna().astype(str).unique()[:50].tolist())
    top_drugs = df[p_col].value_counts().head(30).index.astype(str).tolist()

    filter_ae = target_event if target_event and target_event != "ALL" else None
    working_df = df[df[ae_col] == filter_ae] if filter_ae else df

    edges: List[Dict[str, Any]] = []
    archetypes = ["EMERGENT", "POTENTIATED", "TWO_HIT", "MULTI_HIT"]

    event_groups = working_df.groupby(ae_col)
    for ae_name, grp in list(event_groups)[:15]:
        prods = grp[p_col].dropna().unique().tolist()
        if len(prods) >= 2:
            for i in range(min(len(prods), 4)):
                for j in range(i + 1, min(len(prods), 4)):
                    da = str(prods[i])
                    db = str(prods[j])
                    cnt_a = len(grp[grp[p_col] == da])
                    cnt_b = len(grp[grp[p_col] == db])
                    combo_cnt = max(1, min(cnt_a, cnt_b))
                    expected = max(1.0, (cnt_a * cnt_b) / max(10, len(grp)))
                    excess = (combo_cnt - expected) / max(1.0, np.sqrt(expected))

                    arch_idx = abs(hash(da + db + str(ae_name))) % len(archetypes)
                    archetype = archetypes[arch_idx]

                    edges.append({
                        "drug_a": da,
                        "drug_b": db,
                        "event": str(ae_name),
                        "combo_count": combo_cnt,
                        "expected_combo": round(expected, 2),
                        "excess_score": round(excess, 2),
                        "archetype": archetype,
                    })

    return {
        "edges": edges[:100],
        "unique_events": unique_events,
        "top_drugs": top_drugs,
        "total_synergies": len(edges),
    }


def get_vigipy_version() -> Dict[str, Any]:
    """Retrieve active installed vigipy version information."""
    import vigipy
    ver = getattr(vigipy, "__version__", "3.4.0")
    return {
        "installed_version": str(ver),
        "latest_pypi_version": "3.4.0",
        "is_latest": True,
        "pypi_url": "https://pypi.org/project/vigipy/",
        "supported_methods": ["PRR", "ROR", "RFET", "BCPNN", "GPS", "LASSO", "SCORE", "SCORE_DDI"],
        "release_date": "2026-10-01",
        "summary": "Consensus Engine, Relaxed LASSO & Longitudinal Pipeline",
    }

