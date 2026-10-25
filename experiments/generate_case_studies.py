"""Generate benchmark cohorts for 3 SCORE-DA and SCORE-DDI case studies.

Cohorts:
1. SGLT2 Inhibitors + GLP-1 Receptor Agonists (Cardiometabolic DKA & Pancreatitis)
2. Immune Checkpoint Inhibitors + NSAIDs / PPIs (Immune-Related Colitis & Nephritis)
3. DOACs + Antiplatelets / SSRIs (Bleeding & Gastrointestinal Hemorrhage)
"""

from __future__ import annotations

import os
import sqlite3
import time
from pathlib import Path
import pandas as pd

DB_PATH = r"D:\FAERS_DATA\faers.db"
OUT_DIR = Path(r"G:\My Drive\GitStuff\vigipy-ui\experiments")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def build_cohort(
    name: str,
    drug_names: list[str],
    year_start: int,
    filename_base: str,
    limit: int = 500_000,
) -> None:
    print(f"\n==========================================")
    print(f"Building Cohort: {name}")
    print(f"Target drugs: {drug_names}")
    print(f"Start year: {year_start}")
    print(f"==========================================")
    t0 = time.time()

    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA temp_store=MEMORY")
    con.execute("PRAGMA cache_size=-1000000")  # ~1GB page cache
    cur = con.cursor()

    # Step 1: Filter target drugs with role PS or SS into a temporary indexed table
    cur.execute("DROP TABLE IF EXISTS t_matched_pids")
    placeholders = ",".join(["?"] * len(drug_names))
    cur.execute(
        f"""
        CREATE TEMP TABLE t_matched_pids AS
        SELECT primaryid, drug_norm, drug_family, role_cod, indi_pt, indi_area
        FROM drug
        WHERE drug_norm IN ({placeholders}) AND role_cod IN ('PS', 'SS')
        """,
        drug_names,
    )
    cur.execute("CREATE INDEX ix_tmp_mp ON t_matched_pids(primaryid)")

    # Step 2: Intersect with deduplicated latest table
    cur.execute("DROP TABLE IF EXISTS t_latest_pids")
    cur.execute(
        """
        CREATE TEMP TABLE t_latest_pids AS
        SELECT m.*
        FROM t_matched_pids m
        JOIN latest l ON l.primaryid = m.primaryid
        """
    )
    cur.execute("CREATE INDEX ix_tmp_lp ON t_latest_pids(primaryid)")

    # Step 3: Join demographics and adverse reactions
    sql = f"""
        SELECT
            dm.caseid        AS caseId,
            lp.drug_norm     AS drugName,
            lp.drug_family   AS drugFamily,
            lp.role_cod      AS role,
            r.pt             AS preferredTerm,
            COALESCE(dm.event_dt, dm.fda_dt) AS date,
            dm.quarter       AS quarter,
            dm.age_yrs       AS age,
            dm.sex           AS sex,
            dm.country       AS country,
            dm.serious       AS serious,
            dm.died          AS died,
            lp.indi_pt       AS indication,
            lp.indi_area     AS indicationArea
        FROM t_latest_pids lp
        JOIN demo dm ON dm.primaryid = lp.primaryid
        JOIN reac r ON r.primaryid = lp.primaryid
        WHERE substr(dm.quarter, 1, 4) >= ?
        LIMIT ?
    """
    df = pd.read_sql_query(sql, con, params=[str(year_start), limit])
    con.close()

    elapsed = time.time() - t0
    print(f"Extracted {len(df):,} reports ({df['caseId'].nunique():,} unique cases) in {elapsed:.1f}s")

    # Export to CSV and multi-sheet Excel
    csv_file = OUT_DIR / f"{filename_base}.csv"
    xlsx_file = OUT_DIR / f"{filename_base}.xlsx"

    print(f"Writing CSV: {csv_file.name}...")
    df.to_csv(csv_file, index=False)

    print(f"Writing Excel: {xlsx_file.name}...")
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
        .head(50)
    )

    with pd.ExcelWriter(xlsx_file, engine="openpyxl") as xw:
        # Excel max rows guard
        if len(df) <= 1_000_000:
            df.to_excel(xw, sheet_name="FAERS_Data", index=False)
        else:
            df.head(1_000_000).to_excel(xw, sheet_name="FAERS_Data_Sample", index=False)
        summary_df.to_excel(xw, sheet_name="Drug_Summary", index=False)
        top_events.to_excel(xw, sheet_name="Top_Events", index=False)

    print(f"Saved {xlsx_file.name} ({xlsx_file.stat().st_size / (1024*1024):.1f} MB)")


def main():
    # Cohort 1: SGLT2i + GLP-1 RAs
    build_cohort(
        name="Candidate 1: SGLT2 Inhibitors + GLP-1 Receptor Agonists",
        drug_names=[
            # SGLT2 inhibitors
            "EMPAGLIFLOZIN", "DAPAGLIFLOZIN", "CANAGLIFLOZIN", "SOTAGLIFLOZIN", "ERTUGLIFLOZIN",
            # GLP-1 receptor agonists
            "SEMAGLUTIDE", "TIRZEPATIDE", "DULAGLUTIDE", "LIRAGLUTIDE", "EXENATIDE",
        ],
        year_start=2020,
        filename_base="case_study_1_sglt2_glp1",
    )

    # Cohort 2: ICIs + NSAIDs / PPIs
    build_cohort(
        name="Candidate 2: Immune Checkpoint Inhibitors + NSAIDs & PPIs",
        drug_names=[
            # ICIs
            "PEMBROLIZUMAB", "NIVOLUMAB", "IPILIMUMAB", "ATEZOLIZUMAB", "DURVALUMAB",
            # NSAIDs
            "ASPIRIN", "IBUPROFEN", "DICLOFENAC", "NAPROXEN", "CELECOXIB", "MELOXICAM",
            # PPIs
            "OMEPRAZOLE", "PANTOPRAZOLE", "ESOMEPRAZOLE", "LANSOPRAZOLE",
        ],
        year_start=2020,
        filename_base="case_study_2_ici_nsaid_ppi",
    )

    # Cohort 3: DOACs + Antiplatelets / SSRIs
    build_cohort(
        name="Candidate 3: DOACs + Antiplatelets & SSRIs",
        drug_names=[
            # DOACs & warfarin
            "APIXABAN", "RIVAROXABAN", "DABIGATRAN ETEXILATE", "EDOXABAN", "WARFARIN",
            # Antiplatelets
            "CLOPIDOGREL", "TICAGRELOR", "PRASUGREL", "CILOSTAZOL",
            # SSRIs
            "SERTRALINE", "ESCITALOPRAM", "CITALOPRAM", "FLUOXETINE", "PAROXETINE",
        ],
        year_start=2020,
        filename_base="case_study_3_doac_antiplatelet_ssri",
    )
    print("\nAll 3 case study datasets generated successfully!")


if __name__ == "__main__":
    main()
