"""Warehouse integration service connecting vigipy-ui with safety-db (FAERS, VAERS, MAUDE)."""

from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union

import pandas as pd

logger = logging.getLogger("vigipy_warehouse")

try:
    import safety_db
    from safety_db import SafetyDB
    from safety_db.schemas import ExportFormat, QuerySpec, SourceType
    HAS_SAFETY_DB = True
except ImportError:
    HAS_SAFETY_DB = False
    SafetyDB = None
    QuerySpec = None
    ExportFormat = None
    SourceType = None

# Default data roots
DEFAULT_SAFETY_DIR = os.environ.get("SAFETY_DATA_DIR", r"D:\FAERS_DATA")
DEFAULT_VAERS_DB = os.environ.get("VAERS_DB_PATH", r"D:\vigipyData\vaers.duckdb")
DEFAULT_FAERS_DB = os.environ.get("FAERS_DB_PATH", r"D:\FAERS_DATA\faers.db")
DEFAULT_MAUDE_DB = os.environ.get("MAUDE_DB_PATH", r"G:\My Drive\GitStuff\spotlight\data\maude.db")

_warehouse_instance: Optional[SafetyDB] = None
_lock = threading.Lock()
warehouse_job_state: Dict[str, Any] = {
    "status": "idle",
    "step": "",
    "error": None,
    "result": None,
    "source": None,
}


def get_warehouse() -> Optional[SafetyDB]:
    """Retrieve or initialize global SafetyDB instance."""
    global _warehouse_instance
    if not HAS_SAFETY_DB:
        return None

    with _lock:
        if _warehouse_instance is None:
            try:
                db = SafetyDB(data_dir=DEFAULT_SAFETY_DIR, backend="duckdb")
                # Attach available existing production databases
                db.attach_existing_warehouses(
                    faers_path=DEFAULT_FAERS_DB,
                    vaers_path=DEFAULT_VAERS_DB,
                    maude_path=DEFAULT_MAUDE_DB,
                )
                _warehouse_instance = db
            except Exception as e:
                logger.error(f"Failed initializing SafetyDB warehouse: {e}", exc_info=True)
                return None
    return _warehouse_instance


def get_warehouse_status() -> Dict[str, Any]:
    """Return unified status for all vigilance sources."""
    global warehouse_job_state
    db = get_warehouse()
    if db is None:
        return {
            "ready": False,
            "has_safety_db": False,
            "message": "safety-db is not initialized",
            "job": warehouse_job_state,
        }

    status = db.status()
    # Check attached databases
    attached = {
        "faers": os.path.exists(DEFAULT_FAERS_DB),
        "vaers": os.path.exists(DEFAULT_VAERS_DB),
        "maude": os.path.exists(DEFAULT_MAUDE_DB),
    }

    # Total estimated cases across sources
    total_cases = 0
    try:
        cur = db.engine.query("SELECT COUNT(DISTINCT report_id) FROM v_vigilance_records")
        total_cases = cur[0][0] if cur else 0
    except Exception:
        pass

    return {
        "ready": True,
        "has_safety_db": True,
        "backend": db.backend,
        "data_dir": str(db.data_dir),
        "total_cases": total_cases,
        "attached_warehouses": attached,
        "adapters": status.get("adapters", {}),
        "job": warehouse_job_state,
    }


def get_catalog(source: str = "ALL") -> Dict[str, Any]:
    """Return taxonomy categories and top entities for the specified source."""
    db = get_warehouse()
    if db is None:
        return {"source": source, "categories_l1": [], "categories_l2": [], "top_products": [], "top_events": [], "year_range": [None, None]}
    return db.catalog(source=source)


def search_entities(source: str, query: str, kind: str = "product", limit: int = 50) -> List[Dict[str, Any]]:
    """Search products, drug families, indications, or device problem terms."""
    db = get_warehouse()
    if db is None:
        return []

    q_upper = f"%{query.upper().strip()}%"
    src_filter = "AND source = ?" if source and source.upper() != "ALL" else ""
    src_params = [source.upper()] if src_filter else []

    if kind in ("product", "drug", "vaccine", "device"):
        sql = f"""
            SELECT normalized_name, category_l1, source, COUNT(DISTINCT report_id) AS n_cases
            FROM v_vigilance_records
            WHERE normalized_name LIKE ? {src_filter}
            GROUP BY normalized_name, category_l1, source
            ORDER BY n_cases DESC LIMIT ?
        """
        rows = db.engine.query(sql, [q_upper] + src_params + [limit])
        return [{"name": r[0], "category": r[1], "source": r[2], "n_cases": r[3]} for r in rows]
    else:
        sql = f"""
            SELECT preferred_term, category_l1, source, COUNT(DISTINCT report_id) AS n_cases
            FROM v_vigilance_records
            WHERE preferred_term LIKE ? {src_filter}
            GROUP BY preferred_term, category_l1, source
            ORDER BY n_cases DESC LIMIT ?
        """
        rows = db.engine.query(sql, [q_upper] + src_params + [limit])
        return [{"name": r[0], "category": r[1], "source": r[2], "n_cases": r[3]} for r in rows]


def preview_cohort(spec: Dict[str, Any], limit: int = 50) -> Dict[str, Any]:
    """Preview matched cohort records and estimated volume."""
    db = get_warehouse()
    if db is None:
        return {"estimated_cases": 0, "sample_rows": [], "columns": []}
    return db.preview(spec=spec, limit=limit)


def export_cohort_job(
    spec: Dict[str, Any],
    format: str = "contingency",
    dest_path: Optional[str] = None,
    product_level: str = "normalized_name",
    min_count: int = 1,
    load_into_app: bool = False,
    ingest_callback: Optional[Callable[[Any], None]] = None,
) -> Dict[str, Any]:
    """Execute background cohort export and optionally load directly into analysis workspace."""
    global warehouse_job_state
    db = get_warehouse()
    if db is None:
        raise RuntimeError("SafetyDB warehouse not available.")

    warehouse_job_state.update({
        "status": "running",
        "step": "Executing analytical query across warehouse...",
        "error": None,
        "result": None,
    })

    try:
        exports_dir = os.path.join(str(db.data_dir), "exports")
        os.makedirs(exports_dir, exist_ok=True)
        if not dest_path:
            ext = "csv" if format != "xlsx" else "xlsx"
            dest_path = os.path.join(exports_dir, f"cohort_{uuid.uuid4().hex[:6]}.{ext}")

        res = db.export(
            spec=spec,
            format=format,
            output_file=dest_path,
            product_level=product_level,
            min_count=min_count,
        )

        file_path = res["path"] if isinstance(res, dict) and "path" in res else dest_path
        row_count = res["rows"] if isinstance(res, dict) and "rows" in res else len(res)

        loaded_in_app = False
        if load_into_app and ingest_callback:
            warehouse_job_state["step"] = "Loading generated cohort into analysis workspace..."
            from .schemas import ColumnMappingRequest
            # Determine mapping columns
            if format == "contingency":
                mapping = ColumnMappingRequest(
                    file_path=file_path,
                    product_col="name",
                    ae_col="AE",
                    count_col="count",
                    date_col=None,
                    auto_populate_count=False,
                )
            else:
                mapping = ColumnMappingRequest(
                    file_path=file_path,
                    product_col="name",
                    ae_col="AE",
                    count_col=None,
                    date_col="receipt_date",
                    auto_populate_count=True,
                    default_count=1,
                )
            ingest_callback(mapping)
            loaded_in_app = True

        result_info = {
            "file_path": file_path,
            "row_count": row_count,
            "format": format,
            "loaded_into_app": loaded_in_app,
        }
        warehouse_job_state.update({
            "status": "completed",
            "step": f"Export finished: {row_count:,} records generated.",
            "result": result_info,
        })
        return result_info
    except Exception as exc:
        logger.error(f"Warehouse export failed: {exc}", exc_info=True)
        warehouse_job_state.update({
            "status": "failed",
            "step": "Export failed.",
            "error": str(exc),
        })
        raise
