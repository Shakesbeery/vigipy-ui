"""Optimized batch exporter for Option B and Option C.

Outputs clean, compressed CSVs and lightweight summary Excel sheets to avoid Google Drive
virtual filesystem zip seek locks on massive workbooks.
"""

from __future__ import annotations

import csv
import os
import sqlite3
import time
from pathlib import Path
import pandas as pd

DB_PATH = r"D:\FAERS_DATA\faers.db"
EXP_DIR = Path(r"G:\My Drive\GitStuff\vigipy-ui\experiments")
GOLD_DIR = Path(r"D:\FAERS_DATA\gold_standard")

EXP_DIR.mkdir(parents=True, exist_ok=True)
GOLD_DIR.mkdir(parents=True, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")
    con.execute("PRAGMA temp_store=MEMORY")
    con.execute("PRAGMA cache_size=-1000000")  # ~1GB page cache
    return con


def export_indication_cohort(
    cohort_name: str,
    drug_families: list[str],
    filename_base: str,
    year_start: int = 2018,
    limit_rows: int = 800_000,
) -> None:
    csv_out = EXP_DIR / f"{filename_base}.csv"
    if csv_out.exists() and csv_out.stat().st_size > 10_000_000:
        print(f"\n[SKIP] {csv_out.name} already exists ({csv_out.stat().st_size / (1024*1024):.1f} MB)")
        return

    print(f"\n=======================================================")
    print(f"Exporting Option B Cohort: {cohort_name}")
    print(f"Families: {drug_families}")
    print(f"Year start: {year_start}")
    print(f"=======================================================")
    t0 = time.time()
    con = get_connection()
    cur = con.cursor()

    cur.execute("DROP TABLE IF EXISTS t_cohort_drugs")
    placeholders = ",".join(["?"] * len(drug_families))
    cur.execute(
        f"""
        CREATE TEMP TABLE t_cohort_drugs AS
        SELECT primaryid, drug_norm, drug_family, role_cod, indi_pt, indi_area
        FROM drug
        WHERE drug_family IN ({placeholders}) AND role_cod IN ('PS', 'SS')
        """,
        drug_families,
    )
    cur.execute("CREATE INDEX ix_tcd_pid ON t_cohort_drugs(primaryid)")

    cur.execute("DROP TABLE IF EXISTS t_cohort_latest")
    cur.execute(
        """
        CREATE TEMP TABLE t_cohort_latest AS
        SELECT cd.*
        FROM t_cohort_drugs cd
        JOIN latest l ON l.primaryid = cd.primaryid
        """
    )
    cur.execute("CREATE INDEX ix_tcl_pid ON t_cohort_latest(primaryid)")

    sql = """
        SELECT
            dm.caseid        AS caseId,
            cl.drug_norm     AS drugName,
            cl.drug_family   AS drugFamily,
            cl.role_cod      AS role,
            r.pt             AS preferredTerm,
            COALESCE(dm.event_dt, dm.fda_dt) AS date,
            dm.quarter       AS quarter,
            dm.age_yrs       AS age,
            dm.sex           AS sex,
            dm.country       AS country,
            dm.serious       AS serious,
            dm.died          AS died,
            cl.indi_pt       AS indication,
            cl.indi_area     AS indicationArea
        FROM t_cohort_latest cl
        JOIN demo dm ON dm.primaryid = cl.primaryid
        JOIN reac r ON r.primaryid = cl.primaryid
        WHERE substr(dm.quarter, 1, 4) >= ?
        LIMIT ?
    """
    df = pd.read_sql_query(sql, con, params=[str(year_start), limit_rows])
    con.close()

    elapsed = time.time() - t0
    print(f"Extracted {len(df):,} reports ({df['caseId'].nunique():,} unique cases) in {elapsed:.1f}s")

    print(f"Writing CSV: {csv_out.name}...")
    df.to_csv(csv_out, index=False)
    print(f"Saved {csv_out.name} ({csv_out.stat().st_size / (1024*1024):.1f} MB)")

    # Save lightweight analytical summary workbook (drug counts + event counts)
    summary_xlsx = EXP_DIR / f"{filename_base}_summary.xlsx"
    summary_df = (
        df.groupby(["drugName", "drugFamily"])
        .agg(cases=("caseId", "nunique"), reports=("caseId", "count"))
        .reset_index()
        .sort_values("cases", ascending=False)
    )
    top_events = (
        df.groupby(["preferredTerm"])
        .agg(cases=("caseId", "nunique"), reports=("caseId", "count"))
        .reset_index()
        .sort_values("cases", ascending=False)
        .head(100)
    )
    with pd.ExcelWriter(summary_xlsx, engine="openpyxl") as xw:
        summary_df.to_excel(xw, sheet_name="Drug_Summary", index=False)
        top_events.to_excel(xw, sheet_name="Top_Events", index=False)
    print(f"Saved summary workbook: {summary_xlsx.name}")


def export_gold_standard_matrices() -> None:
    print(f"\n=======================================================")
    print("Exporting Option C: Gold Standard Full FAERS Summary Matrix")
    print(f"=======================================================")
    t0 = time.time()
    con = get_connection()

    # 1. Full drug marginal totals
    drug_margin_csv = GOLD_DIR / "faers_full_drug_marginals_2012_2026.csv"
    if not drug_margin_csv.exists():
        print(f"Exporting drug marginals to {drug_margin_csv.name}...")
        drug_sql = "SELECT drug_norm, drug_family, n_cases, n_primary_suspect FROM drug_summary ORDER BY n_cases DESC"
        drug_df = pd.read_sql_query(drug_sql, con)
        drug_df.to_csv(drug_margin_csv, index=False)
        print(f"Saved {len(drug_df):,} drug marginals to {drug_margin_csv.name}")

    # 2. Full event marginal totals
    event_margin_csv = GOLD_DIR / "faers_full_event_marginals_2012_2026.csv"
    if not event_margin_csv.exists():
        print(f"Exporting event marginals to {event_margin_csv.name}...")
        event_sql = """
            SELECT r.pt AS preferredTerm, COUNT(DISTINCT l.primaryid) AS n_cases
            FROM reac r
            JOIN latest l ON l.primaryid = r.primaryid
            WHERE r.pt <> ''
            GROUP BY r.pt
            ORDER BY n_cases DESC
        """
        event_df = pd.read_sql_query(event_sql, con)
        event_df.to_csv(event_margin_csv, index=False)
        print(f"Saved {len(event_df):,} event marginals to {event_margin_csv.name}")

    # 3. Drug-Event count matrix (n >= 3)
    pair_matrix_csv = GOLD_DIR / "faers_full_drug_event_counts_2012_2026.csv"
    if not pair_matrix_csv.exists():
        print(f"Exporting full Drug-Event pair counts to {pair_matrix_csv.name}...")
        pair_sql = """
            SELECT
                d.drug_norm AS drugName,
                d.drug_family AS drugFamily,
                r.pt AS preferredTerm,
                COUNT(DISTINCT l.primaryid) AS n_cases,
                SUM(CASE WHEN d.role_cod='PS' THEN 1 ELSE 0 END) AS n_primary_suspect
            FROM drug d
            JOIN latest l ON l.primaryid = d.primaryid
            JOIN reac r ON r.primaryid = d.primaryid
            WHERE d.drug_norm <> '' AND r.pt <> ''
            GROUP BY d.drug_norm, r.pt
            HAVING COUNT(DISTINCT l.primaryid) >= 3
        """
        pair_df = pd.read_sql_query(pair_sql, con)
        pair_df.to_csv(pair_matrix_csv, index=False)
        print(f"Saved {len(pair_df):,} drug-event pairs to {pair_matrix_csv.name} ({pair_matrix_csv.stat().st_size / (1024*1024):.1f} MB)")

    con.close()
    print(f"Gold Standard Matrix Export Complete in {time.time() - t0:.1f}s")


def main():
    # Option B - Cohort 1: Diabetes & Cardiometabolic
    export_indication_cohort(
        cohort_name="Cardiometabolic & Type 2 Diabetes",
        drug_families=[
            "SGLT2 inhibitors",
            "GLP-1 receptor agonists",
            "Insulins",
            "Biguanides",
            "Sulfonylureas",
            "DPP-4 inhibitors",
            "Thiazolidinediones",
        ],
        filename_base="cohort_option_b_diabetes_cardiometabolic",
        year_start=2018,
        limit_rows=800_000,
    )

    # Option B - Cohort 2: Immuno-Oncology & Cancer Therapies
    export_indication_cohort(
        cohort_name="Immuno-Oncology & Cancer Therapies with Concomitant NSAIDs / PPIs",
        drug_families=[
            "Immune checkpoint inhibitors",
            "Antineoplastic cytotoxics",
            "Tyrosine/protein kinase inhibitors",
            "Monoclonal antibodies (other)",
            "Immunomodulatory imides (IMiDs)",
            "NSAIDs",
            "Proton pump inhibitors",
            "Corticosteroids (systemic)",
        ],
        filename_base="cohort_option_b_oncology_ici_nsaid_ppi",
        year_start=2018,
        limit_rows=800_000,
    )

    # Option B - Cohort 3: Cardiovascular & Antithrombotic Regimens
    export_indication_cohort(
        cohort_name="Cardiovascular & Antithrombotic Regimens with SSRIs",
        drug_families=[
            "Anticoagulants (DOACs & warfarin)",
            "Antiplatelets",
            "Statins (HMG-CoA reductase inhibitors)",
            "Beta blockers",
            "ACE inhibitors",
            "Angiotensin II receptor blockers",
            "Calcium channel blockers (dihydropyridine)",
            "SSRIs",
        ],
        filename_base="cohort_option_b_cardiovascular_doac_antiplatelet_ssri",
        year_start=2018,
        limit_rows=800_000,
    )

    # Option C - Full FAERS 2012-2026 Matrices
    export_gold_standard_matrices()


if __name__ == "__main__":
    main()
