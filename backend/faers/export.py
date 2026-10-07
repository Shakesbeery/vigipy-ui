"""Cohort catalog + export from the local FAERS warehouse.

Exports are produced in the vigipy-ui ingestion layout (one row per
case x drug x reaction), so any exported sheet can be loaded straight into the
analysis pipeline. Cohorts can be a drug family, therapeutic indication area,
specific indication PTs, an explicit drug list, or ALL drugs.
"""

from __future__ import annotations

import csv
import os
import re
import sqlite3
from typing import Any, Callable, Dict, Iterable, List, Optional

import pandas as pd

from . import DEFAULT_ROOT
from .classify import classification_rules
from .downloader import read_status
from .loader import connect, db_path

EXPORT_COLUMNS = ["caseId", "drugName", "drugFamily", "role", "preferredTerm", "date", "quarter",
                  "age", "sex", "country", "serious", "died", "indication", "indicationArea"]
XLSX_MAX_ROWS = 1_048_000
GROUP_COLUMNS = {"drug_family": "d.drug_family", "indication_area": "d.indi_area"}


def warehouse_status(root: str = DEFAULT_ROOT) -> Dict[str, Any]:
    st = read_status(root)
    out: Dict[str, Any] = {"root": root, "db_exists": os.path.exists(db_path(root)), **st}
    raw_dir = os.path.join(root, "raw")
    out["downloaded_zips"] = len([f for f in os.listdir(raw_dir) if f.endswith(".zip")]) if os.path.isdir(raw_dir) else 0
    if out["db_exists"]:
        try:
            con = connect(root)
            out["loaded_quarters"] = [r[0] for r in con.execute("SELECT quarter FROM loaded_quarters ORDER BY quarter")]
            out["ready"] = bool(con.execute(
                "SELECT 1 FROM sqlite_master WHERE name='drug_summary'").fetchone())
            if out["ready"]:
                out["n_cases"] = con.execute("SELECT COUNT(*) FROM latest").fetchone()[0]
            con.close()
        except sqlite3.Error as exc:
            out["db_error"] = str(exc)
    return out


def catalog(root: str = DEFAULT_ROOT, top_drugs: int = 40) -> Dict[str, Any]:
    """Category listing with case counts for the UI picker."""
    con = connect(root)
    fams = con.execute(
        "SELECT drug_family, COUNT(*) AS n_drugs, SUM(n_cases) AS n_cases FROM drug_summary "
        "GROUP BY drug_family ORDER BY n_cases DESC").fetchall()
    areas = con.execute(
        "SELECT indi_area, COUNT(*) AS n_pts, SUM(n_cases) AS n_cases FROM indication_summary "
        "GROUP BY indi_area ORDER BY n_cases DESC").fetchall()
    top = con.execute(
        "SELECT drug_norm, drug_family, n_cases FROM drug_summary ORDER BY n_cases DESC LIMIT ?",
        (top_drugs,)).fetchall()
    years = con.execute("SELECT MIN(substr(quarter,1,4)), MAX(substr(quarter,1,4)) FROM loaded_quarters").fetchone()
    con.close()
    return {
        "drug_families": [{"name": f, "n_drugs": nd, "n_cases": nc} for f, nd, nc in fams],
        "indication_areas": [{"name": a, "n_pts": npt, "n_cases": nc} for a, npt, nc in areas],
        "top_drugs": [{"name": d, "family": f, "n_cases": n} for d, f, n in top],
        "year_range": list(years) if years else None,
        "rules": classification_rules(),
    }


def search_drugs(q: str, limit: int = 50, root: str = DEFAULT_ROOT) -> List[Dict[str, Any]]:
    con = connect(root)
    rows = con.execute(
        "SELECT drug_norm, drug_family, n_cases FROM drug_summary WHERE drug_norm LIKE ? "
        "ORDER BY n_cases DESC LIMIT ?", (f"%{q.upper()}%", limit)).fetchall()
    con.close()
    return [{"name": d, "family": f, "n_cases": n} for d, f, n in rows]


def search_indications(q: str, limit: int = 50, root: str = DEFAULT_ROOT) -> List[Dict[str, Any]]:
    con = connect(root)
    rows = con.execute(
        "SELECT indi_pt, indi_area, n_cases FROM indication_summary WHERE indi_pt LIKE ? "
        "ORDER BY n_cases DESC LIMIT ?", (f"%{q.upper()}%", limit)).fetchall()
    con.close()
    return [{"name": p, "area": a, "n_cases": n} for p, a, n in rows]


def _build_query(spec: Dict[str, Any]) -> tuple[str, list]:
    """Translate a cohort spec into SQL.

    spec keys: cohort_type ('all'|'drug_family'|'indication_area'|'indication_pt'|'drugs'),
    values: list[str], roles: list[str] (default PS,SS), year_start, year_end,
    serious_only, sex, age_min, age_max, countries, min_drug_cases.
    """
    where = ["d.drug_norm <> ''"]
    params: list = []
    ctype = spec.get("cohort_type", "all")
    values = [v for v in (spec.get("values") or []) if v]

    def _in(col: str, vals: Iterable[str]) -> None:
        vals = list(vals)
        where.append(f"{col} IN ({','.join('?' * len(vals))})")
        params.extend(vals)

    if ctype != "all" and not values:
        raise ValueError(f"Cohort type '{ctype}' requires at least one value.")
    if ctype == "drug_family":
        _in("d.drug_family", values)
    elif ctype == "indication_area":
        _in("d.indi_area", values)
    elif ctype == "indication_pt":
        _in("d.indi_pt", [v.upper() for v in values])
    elif ctype == "drugs":
        _in("d.drug_norm", [v.upper() for v in values])

    roles = spec.get("roles") or ["PS", "SS"]
    _in("d.role_cod", roles)
    if spec.get("year_start"):
        where.append("m.quarter >= ?"); params.append(f"{int(spec['year_start'])}Q1")
    if spec.get("year_end"):
        where.append("m.quarter <= ?"); params.append(f"{int(spec['year_end'])}Q4")
    if spec.get("serious_only"):
        where.append("m.serious = 1")
    if spec.get("sex") in ("M", "F"):
        where.append("m.sex = ?"); params.append(spec["sex"])
    if spec.get("age_min") is not None:
        where.append("m.age_yrs >= ?"); params.append(float(spec["age_min"]))
    if spec.get("age_max") is not None:
        where.append("m.age_yrs <= ?"); params.append(float(spec["age_max"]))
    if spec.get("countries"):
        _in("m.country", [c.upper() for c in spec["countries"]])
    min_cases = int(spec.get("min_drug_cases") or 0)
    if min_cases > 0:
        where.append("d.drug_norm IN (SELECT drug_norm FROM drug_summary WHERE n_cases >= ?)")
        params.append(min_cases)

    sql = f"""
        SELECT DISTINCT m.caseid AS caseId, d.drug_norm AS drugName, d.drug_family AS drugFamily,
               d.role_cod AS role, r.pt AS preferredTerm, COALESCE(m.event_dt, m.fda_dt) AS date,
               m.quarter AS quarter, m.age_yrs AS age, m.sex AS sex, m.country AS country,
               m.serious AS serious, m.died AS died, d.indi_pt AS indication, d.indi_area AS indicationArea
        FROM drug d
        JOIN latest l ON l.primaryid = d.primaryid
        JOIN demo m ON m.primaryid = d.primaryid
        JOIN reac r ON r.primaryid = d.primaryid
        WHERE {' AND '.join(where)}
    """
    return sql, params


def preview(spec: Dict[str, Any], root: str = DEFAULT_ROOT) -> Dict[str, Any]:
    """Fast size estimate: cases, drugs and rows for a cohort."""
    sql, params = _build_query(spec)
    con = connect(root)
    row = con.execute(
        f"SELECT COUNT(*), COUNT(DISTINCT caseId), COUNT(DISTINCT drugName), COUNT(DISTINCT preferredTerm) "
        f"FROM ({sql})", params).fetchone()
    top = con.execute(
        f"SELECT drugName, COUNT(DISTINCT caseId) n FROM ({sql}) GROUP BY drugName ORDER BY n DESC LIMIT 15",
        params).fetchall()
    con.close()
    return {"n_rows": row[0], "n_cases": row[1], "n_drugs": row[2], "n_events": row[3],
            "xlsx_ok": row[0] <= XLSX_MAX_ROWS, "top_drugs": [{"name": d, "n_cases": n} for d, n in top]}


def _slug(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")[:60] or "cohort"


def export_cohort(spec: Dict[str, Any], dest_path: str, root: str = DEFAULT_ROOT,
                  progress_cb: Optional[Callable[[int], None]] = None) -> Dict[str, Any]:
    """Stream a cohort to CSV, or to XLSX (data + drug summary sheets) when it fits."""
    sql, params = _build_query(spec)
    os.makedirs(os.path.dirname(os.path.abspath(dest_path)) or ".", exist_ok=True)
    con = connect(root)
    n = 0
    if dest_path.lower().endswith(".xlsx"):
        df = pd.read_sql_query(sql, con, params=params)
        if len(df) > XLSX_MAX_ROWS:
            con.close()
            raise ValueError(f"Cohort has {len(df):,} rows; exceeds Excel limit. Export as .csv instead.")
        summary = (df.groupby(["drugName", "drugFamily"]).agg(cases=("caseId", "nunique"), rows=("caseId", "size"))
                   .reset_index().sort_values("cases", ascending=False))
        with pd.ExcelWriter(dest_path, engine="openpyxl") as xw:
            df.to_excel(xw, sheet_name="reports", index=False)
            summary.to_excel(xw, sheet_name="drug_summary", index=False)
            pd.DataFrame([{"key": k, "value": str(v)} for k, v in spec.items()]).to_excel(
                xw, sheet_name="cohort_definition", index=False)
        n = len(df)
    else:
        cur = con.execute(sql, params)
        with open(dest_path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(EXPORT_COLUMNS)
            while True:
                batch = cur.fetchmany(200_000)
                if not batch:
                    break
                w.writerows(batch)
                n += len(batch)
                if progress_cb:
                    progress_cb(n)
    con.close()
    return {"file_path": os.path.abspath(dest_path), "n_rows": n}


def export_batch(group_by: str, dest_dir: str, base_spec: Optional[Dict[str, Any]] = None,
                 fmt: str = "csv", min_cases: int = 500, root: str = DEFAULT_ROOT,
                 progress_cb: Optional[Callable[[str, int, int], None]] = None) -> Dict[str, Any]:
    """One file per category (drug family or indication area) plus an index sheet."""
    if group_by not in GROUP_COLUMNS:
        raise ValueError(f"group_by must be one of {list(GROUP_COLUMNS)}")
    cat = catalog(root)
    key = "drug_families" if group_by == "drug_family" else "indication_areas"
    groups = [g["name"] for g in cat[key]
              if g["n_cases"] >= min_cases and g["name"] not in ("Unclassified", "Unknown indication", "Other")]
    os.makedirs(dest_dir, exist_ok=True)
    index_rows = []
    for i, g in enumerate(groups, 1):
        spec = dict(base_spec or {}, cohort_type=group_by, values=[g])
        ext = fmt
        if fmt == "xlsx" and not preview(spec, root)["xlsx_ok"]:
            ext = "csv"
        path = os.path.join(dest_dir, f"{_slug(g)}.{ext}")
        if progress_cb:
            progress_cb(g, i, len(groups))
        res = export_cohort(spec, path, root)
        index_rows.append({"category": g, "file": os.path.basename(path), "rows": res["n_rows"]})
    pd.DataFrame(index_rows).to_csv(os.path.join(dest_dir, "_index.csv"), index=False)
    return {"dest_dir": os.path.abspath(dest_dir), "files": index_rows}
