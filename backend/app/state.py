"""In-memory dataset, analysis cache, and vectorized query engine for vigipy-ui."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from vigipy.consensus import ConsensusResult
from vigipy.utils.Container import AnalysisResult, DataContainer

logger = logging.getLogger("vigipy_ui.state")


class AppState:
    """Singleton-like application state container."""

    def __init__(self) -> None:
        self.raw_df: Optional[pd.DataFrame] = None
        self.full_raw_df: Optional[pd.DataFrame] = None
        self.raw_file_path: Optional[str] = None
        self.column_mapping: Dict[str, Optional[str]] = {}
        self.auto_populate_count: bool = False
        self.default_count: int = 1
        
        self.data_container: Optional[DataContainer] = None
        self.consensus_result: Optional[ConsensusResult] = None
        self.individual_results: Dict[str, AnalysisResult] = {}
        self.longitudinal_results: Optional[List[Tuple[pd.Timestamp, Optional[AnalysisResult]]]] = None
        self.longitudinal_runs: Dict[str, List[Tuple[pd.Timestamp, Optional[AnalysisResult]]]] = {}
        self.longitudinal_method: Optional[str] = None
        
        # Fast query cache: flattened unified signals DataFrame
        self._cached_table: Optional[pd.DataFrame] = None
        self._methods_list: List[str] = []

    def reset_analysis(self) -> None:
        """Clear cached results while retaining ingested raw data."""
        self.consensus_result = None
        self.individual_results.clear()
        self.longitudinal_results = None
        self.longitudinal_runs.clear()
        self.longitudinal_method = None
        self._cached_table = None
        self._methods_list.clear()

    def reset_all(self) -> None:
        """Completely reset all dataset and analysis state."""
        self.raw_df = None
        self.full_raw_df = None
        self.raw_file_path = None
        self.column_mapping = {}
        self.auto_populate_count = False
        self.default_count = 1
        self.data_container = None
        self.reset_analysis()

    def set_results(
        self,
        consensus_res: Optional[ConsensusResult],
        individual_res: Optional[Dict[str, AnalysisResult]] = None,
    ) -> None:
        """Store analysis results and build the fast indexed query table."""
        self.consensus_result = consensus_res
        if individual_res:
            self.individual_results = individual_res
        elif consensus_res:
            self.individual_results = consensus_res.raw_results

        if consensus_res is not None:
            self._cached_table = consensus_res.comparison_table.copy()
            self._methods_list = [str(m).upper() for m in consensus_res.methods]
        elif self.individual_results:
            # Fallback if only single method ran
            m_name, m_res = next(iter(self.individual_results.items()))
            self._cached_table = m_res.signals.copy()
            self._methods_list = [str(m_name).upper()]
        else:
            self._cached_table = None
            self._methods_list = []

    def query_signals(
        self,
        offset: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
        tiers: Optional[List[str]] = None,
        methods: Optional[List[str]] = None,
        min_count: Optional[float] = None,
        min_votes: Optional[int] = None,
        min_score: Optional[float] = None,
        sort_by: Optional[str] = "composite_rank",
        sort_dir: str = "asc",
    ) -> Tuple[int, int, List[Dict[str, Any]], List[str]]:
        """Vectorized in-memory filtering and windowing.
        
        Handles up to multi-million rows in tens of milliseconds.
        Returns: (total_records, filtered_records, row_dicts, methods_list)
        """
        if self._cached_table is None or self._cached_table.empty:
            return 0, 0, [], []

        df = self._cached_table
        total_records = len(df)

        # 1. Vectorized Boolean Mask
        mask = np.ones(total_records, dtype=bool)

        if search and search.strip():
            s = search.strip().lower()
            prod_match = (
                df["Product"]
                .astype(str)
                .str.lower()
                .str.contains(s, regex=False, na=False)
            )
            ae_match = (
                df["Adverse Event"]
                .astype(str)
                .str.lower()
                .str.contains(s, regex=False, na=False)
            )
            mask &= (prod_match | ae_match).to_numpy()

        if tiers and "agreement_tier" in df.columns:
            mask &= df["agreement_tier"].isin(tiers).to_numpy()

        if min_count is not None and "Count" in df.columns:
            mask &= (df["Count"].fillna(0) >= min_count).to_numpy()

        if min_votes is not None and "votes" in df.columns:
            mask &= (df["votes"].fillna(0) >= min_votes).to_numpy()

        if min_score is not None and "consensus_score" in df.columns:
            mask &= (df["consensus_score"].fillna(0) >= min_score).to_numpy()

        # Method-specific alert filtering if requested
        if methods:
            method_mask = np.zeros(total_records, dtype=bool)
            for m in methods:
                m_low = m.lower().strip()
                cands = [f"alert_{m_low}", f"alert_{m.upper().strip()}"]
                if m_low in ("score", "score_da"):
                    cands += ["alert_score", "alert_score_da"]
                for c in cands:
                    if c in df.columns:
                        method_mask |= df[c].fillna(False).to_numpy()
                        break
            mask &= method_mask

        filtered_count = int(np.sum(mask))
        if filtered_count == 0:
            return total_records, 0, [], self._methods_list

        filtered_df = df[mask]

        # 2. Vectorized Sorting
        ascending = sort_dir.lower() == "asc"
        valid_sort_col = None

        if sort_by:
            # Case-insensitive resolution against available columns
            col_map = {c.lower(): c for c in filtered_df.columns}
            valid_sort_col = col_map.get(sort_by.lower().strip())

        if not valid_sort_col:
            for fallback in ["composite_rank", "consensus_score", "votes", "Count", "Product"]:
                if fallback in filtered_df.columns:
                    valid_sort_col = fallback
                    break

        if valid_sort_col:
            # Handle clinical consensus tier semantic sorting
            if valid_sort_col.lower() == "agreement_tier":
                tier_order = {"unanimous": 5, "strong": 4, "moderate": 3, "weak": 2, "isolated": 1}
                temp_tier_series = filtered_df[valid_sort_col].astype(str).str.lower().map(tier_order).fillna(0)
                filtered_df = filtered_df.assign(_tier_rank=temp_tier_series).sort_values(
                    by="_tier_rank",
                    ascending=ascending,
                    na_position="last",
                    kind="quicksort",
                ).drop(columns=["_tier_rank"])
            else:
                filtered_df = filtered_df.sort_values(
                    by=valid_sort_col,
                    ascending=ascending,
                    na_position="last",
                    kind="quicksort",
                )

        # 3. Slicing active viewport window
        slice_df = filtered_df.iloc[offset : offset + limit]

        # 4. Transform slice to structured rows
        rows: List[Dict[str, Any]] = []
        for _, row in slice_df.iterrows():
            prod = str(row.get("Product", ""))
            ae = str(row.get("Adverse Event", ""))
            cnt = float(row.get("Count", 0.0))
            exp_cnt = float(row.get("Expected Count", np.nan)) if "Expected Count" in row else None
            votes = int(row.get("votes", 0))
            total_m = int(row.get("total_methods", len(self._methods_list)))
            c_score = float(row.get("consensus_score", 0.0))
            tier = str(row.get("agreement_tier", "Isolated"))
            comp_rank = float(row.get("composite_rank", np.nan)) if "composite_rank" in row else None

            # Collect per-method scores and alerts (checking both upper and lowercase columns and aliases)
            m_scores: Dict[str, Optional[float]] = {}
            m_alerts: Dict[str, bool] = {}
            for m in self._methods_list:
                m_up = m.upper()
                m_low = m.lower()
                is_score = m_low in ("score", "score_da")

                s_cands = [f"score_{m_low}", f"score_{m_up}"] + ([f"score_score", f"score_score_da", "SER", "SRR"] if is_score else [])
                a_cands = [f"alert_{m_low}", f"alert_{m_up}"] + ([f"alert_score", f"alert_score_da"] if is_score else [])

                val = None
                for c in s_cands:
                    if c in row and not pd.isna(row[c]):
                        val = float(row[c])
                        break

                alert_val = False
                for c in a_cands:
                    if c in row and bool(row[c]):
                        alert_val = True
                        break

                m_scores[m_up] = val
                m_scores[m_low] = val
                m_alerts[m_up] = alert_val
                m_alerts[m_low] = alert_val

                # Cross-populate SCORE / SCORE_DA aliases
                if is_score:
                    m_scores["SCORE"] = val
                    m_scores["score"] = val
                    m_scores["SCORE_DA"] = val
                    m_scores["score_da"] = val
                    m_alerts["SCORE"] = alert_val
                    m_alerts["score"] = alert_val
                    m_alerts["SCORE_DA"] = alert_val
                    m_alerts["score_da"] = alert_val

            rows.append(
                {
                    "product": prod,
                    "adverse_event": ae,
                    "count": cnt,
                    "expected_count": exp_cnt if exp_cnt is not None and not np.isnan(exp_cnt) else None,
                    "votes": votes,
                    "total_methods": total_m,
                    "consensus_score": c_score,
                    "agreement_tier": tier,
                    "composite_rank": comp_rank if comp_rank is not None and not np.isnan(comp_rank) else None,
                    "method_scores": m_scores,
                    "method_alerts": m_alerts,
                }
            )

        return total_records, filtered_count, rows, self._methods_list


state = AppState()
