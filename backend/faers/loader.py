"""Parse FAERS/AERS quarterly ASCII zips into a deduplicated SQLite warehouse.

Schema (D:\\FAERS_DATA\\faers.db):
  demo(primaryid, caseid, caseversion, fda_dt, event_dt, age_yrs, sex, country, occp_cod, serious, died, quarter)
  drug(primaryid, drug_seq, role_cod, drugname, drug_norm, drug_family, route, indi_pt, indi_area)
  reac(primaryid, pt)
  latest(primaryid)  -- one row per caseid: most recent version (FDA-recommended deduplication)

Usage:
    python -m backend.faers.loader [--root D:\\FAERS_DATA] [--finalize-only]
"""

from __future__ import annotations

import argparse
import csv
import glob
import io
import os
import re
import sqlite3
import time
import zipfile
from typing import Dict, Optional

import numpy as np
import pandas as pd

from . import DEFAULT_ROOT
from .classify import classify_drug, classify_indication, normalize_drug
from .downloader import read_status, write_status

SERIOUS_OUTCOMES = {"DE", "LT", "HO", "DS", "CA", "RI", "OT"}
AGE_FACTORS = {"YR": 1.0, "DEC": 10.0, "MON": 1 / 12, "WK": 1 / 52.18, "DY": 1 / 365.25, "HR": 1 / 8766.0}

# Legacy AERS (<=2012Q3) column names -> FAERS names
RENAMES = {
    "isr": "primaryid", "case": "caseid", "gndr_cod": "sex", "outc_code": "outc_cod",
    "indi_drug_seq": "drug_seq", "foll_seq": "caseversion_legacy",
}


def db_path(root: str = DEFAULT_ROOT) -> str:
    return os.path.join(root, "faers.db")


def connect(root: str = DEFAULT_ROOT) -> sqlite3.Connection:
    con = sqlite3.connect(db_path(root), timeout=60)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")
    con.execute("PRAGMA temp_store=MEMORY")
    con.execute("PRAGMA cache_size=-1000000")  # ~1 GB page cache
    return con


def init_schema(con: sqlite3.Connection) -> None:
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS demo(primaryid TEXT, caseid TEXT, caseversion INTEGER, fda_dt TEXT,
            event_dt TEXT, age_yrs REAL, sex TEXT, country TEXT, occp_cod TEXT, serious INTEGER,
            died INTEGER, quarter TEXT);
        CREATE TABLE IF NOT EXISTS drug(primaryid TEXT, drug_seq TEXT, role_cod TEXT, drugname TEXT,
            drug_norm TEXT, drug_family TEXT, route TEXT, indi_pt TEXT, indi_area TEXT);
        CREATE TABLE IF NOT EXISTS reac(primaryid TEXT, pt TEXT);
        CREATE TABLE IF NOT EXISTS loaded_quarters(quarter TEXT PRIMARY KEY, n_demo INTEGER,
            n_drug INTEGER, n_reac INTEGER, loaded_at TEXT);
        """
    )


def _read_member(z: zipfile.ZipFile, prefix: str) -> Optional[pd.DataFrame]:
    """Read the $-delimited table whose basename starts with prefix (demo/drug/reac/indi/outc)."""
    names = [n for n in z.namelist()
             if re.match(rf"^{prefix}\d\dq\d(_new)?\.txt$", os.path.basename(n).lower())]
    if not names:
        return None
    with z.open(names[0]) as fh:
        raw = fh.read().decode("latin-1")
    df = pd.read_csv(io.StringIO(raw), sep="$", dtype=str, quoting=csv.QUOTE_NONE,
                     on_bad_lines="skip", index_col=False, keep_default_na=False, na_values=[""])
    df.columns = [re.sub(r"^[^a-z0-9_]+", "", c.strip().lower()) for c in df.columns]
    df = df.loc[:, [c for c in df.columns if c and not c.startswith("unnamed")]]
    return df.rename(columns=RENAMES)


def _to_iso(series: pd.Series) -> pd.Series:
    s = series.fillna("").astype(str).str.strip()
    out = np.where(s.str.len() >= 8, s.str[:4] + "-" + s.str[4:6] + "-" + s.str[6:8],
                   np.where(s.str.len() == 6, s.str[:4] + "-" + s.str[4:6] + "-01",
                            np.where(s.str.len() == 4, s + "-01-01", None)))
    return pd.Series(out, index=series.index)


def load_quarter(con: sqlite3.Connection, zip_path: str, quarter: str) -> Dict[str, int]:
    legacy = os.path.basename(zip_path).lower().startswith("aers") or quarter in ("2012Q1", "2012Q2", "2012Q3")
    with zipfile.ZipFile(zip_path) as z:
        demo = _read_member(z, "demo")
        drug = _read_member(z, "drug")
        reac = _read_member(z, "reac")
        indi = _read_member(z, "indi")
        outc = _read_member(z, "outc")
    if demo is None or drug is None or reac is None:
        raise ValueError(f"{quarter}: missing DEMO/DRUG/REAC tables")

    pfx = "A" if legacy else ""
    for df in (demo, drug, reac, indi, outc):
        if df is not None:
            df["primaryid"] = pfx + df["primaryid"].astype(str).str.strip()

    # ---- DEMO ----
    if legacy:
        demo["caseversion"] = pd.to_numeric(demo.get("caseversion_legacy"), errors="coerce").fillna(0)
    else:
        demo["caseversion"] = pd.to_numeric(demo.get("caseversion"), errors="coerce").fillna(0)
    age = pd.to_numeric(demo.get("age"), errors="coerce")
    factor = demo.get("age_cod", pd.Series("", index=demo.index)).fillna("").str.upper().map(AGE_FACTORS)
    age_yrs = (age * factor).where((age * factor).between(0, 120))
    sex = demo.get("sex", pd.Series("", index=demo.index)).fillna("").str.upper().str[:1]
    country = demo.get("reporter_country", demo.get("occr_country", pd.Series("", index=demo.index)))

    serious = pd.Series(0, index=demo.index)
    died = pd.Series(0, index=demo.index)
    if outc is not None and "outc_cod" in outc.columns:
        oc = outc.assign(outc_cod=outc["outc_cod"].fillna("").str.upper().str.strip())
        ser_ids = set(oc.loc[oc["outc_cod"].isin(SERIOUS_OUTCOMES), "primaryid"])
        de_ids = set(oc.loc[oc["outc_cod"] == "DE", "primaryid"])
        serious = demo["primaryid"].isin(ser_ids).astype(int)
        died = demo["primaryid"].isin(de_ids).astype(int)

    demo_out = pd.DataFrame({
        "primaryid": demo["primaryid"],
        "caseid": demo["caseid"].astype(str).str.strip(),
        "caseversion": demo["caseversion"].astype(int),
        "fda_dt": _to_iso(demo.get("fda_dt", pd.Series(None, index=demo.index))),
        "event_dt": _to_iso(demo.get("event_dt", pd.Series(None, index=demo.index))),
        "age_yrs": age_yrs.round(1),
        "sex": sex.where(sex.isin(["M", "F"]), "U"),
        "country": country.fillna("").str.upper().str.strip(),
        "occp_cod": demo.get("occp_cod", pd.Series("", index=demo.index)).fillna(""),
        "serious": serious, "died": died, "quarter": quarter,
    }).drop_duplicates("primaryid")

    # ---- DRUG (+ indication join on primaryid/drug_seq) ----
    prod_ai = drug["prod_ai"] if "prod_ai" in drug.columns else pd.Series("", index=drug.index)
    pairs = list(zip(drug["drugname"].fillna("").astype(str), prod_ai.fillna("").astype(str)))
    norm_cache = {p: normalize_drug(p[0], p[1]) for p in set(pairs)}
    drug_norm = pd.Series([norm_cache[p] for p in pairs], index=drug.index)
    fam_cache = {n: classify_drug(n) for n in drug_norm.unique()}
    drug_out = pd.DataFrame({
        "primaryid": drug["primaryid"],
        "drug_seq": drug.get("drug_seq", pd.Series("", index=drug.index)).astype(str).str.strip(),
        "role_cod": drug.get("role_cod", pd.Series("", index=drug.index)).fillna("").str.upper().str.strip(),
        "drugname": drug["drugname"].fillna("").str.upper().str.strip(),
        "drug_norm": drug_norm,
        "drug_family": drug_norm.map(fam_cache),
        "route": drug.get("route", pd.Series("", index=drug.index)).fillna("").str.upper().str.strip(),
    })
    if indi is not None and "indi_pt" in indi.columns:
        ind = indi[["primaryid", "drug_seq", "indi_pt"]].copy()
        ind["drug_seq"] = ind["drug_seq"].astype(str).str.strip()
        ind["indi_pt"] = ind["indi_pt"].fillna("").str.upper().str.strip()
        ind = ind.drop_duplicates(["primaryid", "drug_seq"])
        drug_out = drug_out.merge(ind, on=["primaryid", "drug_seq"], how="left")
    else:
        drug_out["indi_pt"] = None
    area_cache = {p: classify_indication(p) for p in drug_out["indi_pt"].dropna().unique()}
    drug_out["indi_area"] = drug_out["indi_pt"].map(area_cache).fillna("Unknown indication")

    # ---- REAC ----
    reac_out = pd.DataFrame({
        "primaryid": reac["primaryid"],
        "pt": reac["pt"].fillna("").str.strip().str.upper(),
    }).drop_duplicates()
    reac_out = reac_out[reac_out["pt"] != ""]

    with con:
        con.execute("DELETE FROM demo WHERE quarter=?", (quarter,))
        demo_out.to_sql("demo", con, if_exists="append", index=False, chunksize=50000)
        drug_out.to_sql("drug", con, if_exists="append", index=False, chunksize=50000)
        reac_out.to_sql("reac", con, if_exists="append", index=False, chunksize=50000)
        con.execute("INSERT OR REPLACE INTO loaded_quarters VALUES (?,?,?,?,?)",
                    (quarter, len(demo_out), len(drug_out), len(reac_out), time.strftime("%Y-%m-%d %H:%M:%S")))
    return {"demo": len(demo_out), "drug": len(drug_out), "reac": len(reac_out)}


def finalize(con: sqlite3.Connection) -> None:
    """Build indexes, the deduplicated `latest` case table and summary tables."""
    print("Building indexes...", flush=True)
    con.executescript(
        """
        CREATE INDEX IF NOT EXISTS ix_demo_pid ON demo(primaryid);
        CREATE INDEX IF NOT EXISTS ix_demo_case ON demo(caseid);
        CREATE INDEX IF NOT EXISTS ix_drug_pid ON drug(primaryid);
        CREATE INDEX IF NOT EXISTS ix_drug_norm ON drug(drug_norm);
        CREATE INDEX IF NOT EXISTS ix_drug_fam ON drug(drug_family);
        CREATE INDEX IF NOT EXISTS ix_drug_area ON drug(indi_area);
        CREATE INDEX IF NOT EXISTS ix_reac_pid ON reac(primaryid);
        """
    )
    print("Harmonizing brand names to active ingredients...", flush=True)
    con.executescript(
        """
        DROP TABLE IF EXISTS brand_map;
        CREATE TABLE brand_map AS
            SELECT drugname, drug_norm, drug_family FROM (
                SELECT drugname, drug_norm, drug_family,
                       ROW_NUMBER() OVER (PARTITION BY drugname ORDER BY COUNT(*) DESC) AS rn
                FROM drug WHERE drug_norm <> '' AND drug_norm <> drugname
                GROUP BY drugname, drug_norm, drug_family)
            WHERE rn = 1 AND drugname NOT IN (SELECT DISTINCT drug_norm FROM drug WHERE drug_family <> 'Unclassified');
        CREATE INDEX ix_bm ON brand_map(drugname);
        UPDATE drug SET drug_norm = bm.drug_norm, drug_family = bm.drug_family
            FROM brand_map bm WHERE drug.drug_norm = bm.drugname;
        """
    )
    con.commit()
    print("Deduplicating cases (latest version per caseid)...", flush=True)
    con.executescript(
        """
        DROP TABLE IF EXISTS latest;
        CREATE TABLE latest(primaryid TEXT PRIMARY KEY) WITHOUT ROWID;
        INSERT OR IGNORE INTO latest
        SELECT primaryid FROM (
            SELECT primaryid, ROW_NUMBER() OVER (PARTITION BY caseid
                ORDER BY fda_dt DESC, caseversion DESC, primaryid DESC) AS rn
            FROM demo) WHERE rn = 1;
        """
    )
    print("Building summary tables...", flush=True)
    con.executescript(
        """
        DROP TABLE IF EXISTS drug_summary;
        CREATE TABLE drug_summary AS
            SELECT d.drug_norm, d.drug_family, COUNT(DISTINCT d.primaryid) AS n_cases,
                   SUM(CASE WHEN d.role_cod='PS' THEN 1 ELSE 0 END) AS n_primary_suspect
            FROM drug d JOIN latest l ON l.primaryid = d.primaryid
            WHERE d.drug_norm <> '' GROUP BY d.drug_norm, d.drug_family;
        CREATE INDEX ix_ds_fam ON drug_summary(drug_family);
        DROP TABLE IF EXISTS indication_summary;
        CREATE TABLE indication_summary AS
            SELECT d.indi_area, d.indi_pt, COUNT(DISTINCT d.primaryid) AS n_cases
            FROM drug d JOIN latest l ON l.primaryid = d.primaryid
            WHERE d.indi_pt IS NOT NULL GROUP BY d.indi_area, d.indi_pt;
        CREATE INDEX ix_is_area ON indication_summary(indi_area);
        ANALYZE;
        """
    )
    con.commit()


def build(root: str = DEFAULT_ROOT, finalize_only: bool = False) -> None:
    con = connect(root)
    init_schema(con)
    if not finalize_only:
        loaded = {r[0] for r in con.execute("SELECT quarter FROM loaded_quarters")}
        zips = sorted(glob.glob(os.path.join(root, "raw", "faers_ascii_*.zip")))
        for zp in zips:
            q = re.search(r"(20\d\dQ\d)", os.path.basename(zp)).group(1)
            if q in loaded:
                continue
            t0 = time.time()
            # Clean partial rows from an interrupted earlier attempt
            with con:
                pids = "SELECT primaryid FROM demo WHERE quarter=?"
                con.execute(f"DELETE FROM drug WHERE primaryid IN ({pids})", (q,))
                con.execute(f"DELETE FROM reac WHERE primaryid IN ({pids})", (q,))
            st = read_status(root)
            st.update({"load_state": "loading", "load_current": q})
            write_status(root, st)
            try:
                n = load_quarter(con, zp, q)
                print(f"Loaded {q}: {n} in {time.time() - t0:.0f}s", flush=True)
            except Exception as exc:
                print(f"!! Failed to load {q}: {exc}", flush=True)
    finalize(con)
    st = read_status(root)
    st.update({"load_state": "ready", "load_current": None})
    write_status(root, st)
    con.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=DEFAULT_ROOT)
    ap.add_argument("--finalize-only", action="store_true")
    a = ap.parse_args()
    build(a.root, a.finalize_only)
