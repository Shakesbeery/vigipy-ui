#!/usr/bin/env python3
"""
vigipy Studio Python Wrapper
============================
A clean, modular Python wrapper that directly delegates all pharmacovigilance computations
to the upstream official vigipy library (https://github.com/Shakesbeery/vigipy).

Architecture:
- High-Performance UI Layer: React + TypeScript frontend providing instant client-side preview,
  interactive brush-filtering, SVG/PNG chart exports, and visual dashboards.
- Core Analytical Engine: Official Python vigipy library (PyPI: vigipy>=3.4.0) executing
  exact statistical disproportionality, longitudinal modeling, and multi-method consensus.

Usage:
    # 1. As a CLI command:
    python vigipy_wrapper.py --input cohort.csv --method PRR --output results.json

    # 2. As a Python module:
    from vigipy_wrapper import VigipyEngineWrapper
    engine = VigipyEngineWrapper(dataset_path="cohort.csv")
    signals = engine.run_all_methods()
"""

import sys
import os
import json
import argparse
from typing import Dict, Any, List, Optional
import pandas as pd

try:
    import vigipy as vg
    from vigipy import (
        analyze,
        analyze_all,
        consensus_analysis,
        LongitudinalModel,
        PRRConfig,
        RORConfig,
        RFETConfig,
        BCPNNConfig,
        GPSConfig,
        LASSOConfig,
        SCOREConfig,
        SCOREDDIConfig,
    )
    VIGIPY_INSTALLED = True
except ImportError:
    VIGIPY_INSTALLED = False


class VigipyEngineWrapper:
    """Wrapper class encapsulating vigipy 3.4.0 disproportionality & surveillance modeling."""

    def __init__(self, dataset_path: Optional[str] = None, df: Optional[pd.DataFrame] = None):
        if not VIGIPY_INSTALLED:
            raise RuntimeError(
                "The upstream 'vigipy' package is required. Install via: pip install 'vigipy[excel]>=3.4.0'"
            )
        if df is not None:
            self.df = df
        elif dataset_path and os.path.exists(dataset_path):
            if dataset_path.endswith('.parquet'):
                self.df = pd.read_parquet(dataset_path)
            elif dataset_path.endswith('.xlsx') or dataset_path.endswith('.xls'):
                self.df = pd.read_excel(dataset_path)
            else:
                self.df = pd.read_csv(dataset_path)
        else:
            self.df = pd.DataFrame()

    def get_version(self) -> str:
        """Returns the version of the underlying vigipy installation."""
        return getattr(vg, "__version__", "3.4.0")

    def run_single_method(
        self,
        method: str = "PRR",
        product_col: str = "drug_name",
        event_col: str = "pt",
        params: Optional[Dict[str, Any]] = None,
    ) -> pd.DataFrame:
        """Executes a single disproportionality analysis via vigipy."""
        params = params or {}
        # Convert raw tabular data into vigipy DataContainer
        container = vg.convert(self.df, product_label=product_col, ae_label=event_col)

        method_upper = method.upper()
        if method_upper == "PRR":
            cfg = PRRConfig(**params)
            return vg.prr(container, config=cfg)
        elif method_upper == "ROR":
            cfg = RORConfig(**params)
            return vg.ror(container, config=cfg)
        elif method_upper == "BCPNN":
            cfg = BCPNNConfig(**params)
            return vg.bcpnn(container, config=cfg)
        elif method_upper == "GPS":
            cfg = GPSConfig(**params)
            return vg.gps(container, config=cfg)
        elif method_upper == "RFET":
            cfg = RFETConfig(**params)
            return vg.rfet(container, config=cfg)
        elif method_upper == "LASSO":
            cfg = LASSOConfig(**params)
            return vg.lasso(container, config=cfg)
        elif method_upper in ("SCORE", "SCORE_DA"):
            cfg = SCOREConfig(**params)
            return vg.score_da(container, config=cfg)
        elif method_upper == "SCORE_DDI":
            cfg = SCOREDDIConfig(**params)
            return vg.score_ddi(container, config=cfg)
        else:
            return vg.analyze(container, method=method, **params)

    def run_all_methods(
        self,
        methods: Optional[List[str]] = None,
        product_col: str = "drug_name",
        event_col: str = "pt",
    ) -> Dict[str, pd.DataFrame]:
        """Runs multi-method disproportionality modeling across all active algorithms."""
        container = vg.convert(self.df, product_label=product_col, ae_label=event_col)
        active = methods or ["PRR", "ROR", "BCPNN", "GPS", "RFET", "LASSO", "SCORE"]
        return vg.analyze_all(container, methods=active)

    def run_consensus(
        self,
        methods: Optional[List[str]] = None,
        product_col: str = "drug_name",
        event_col: str = "pt",
        min_agreement_ratio: float = 0.5,
    ) -> pd.DataFrame:
        """Executes multi-method consensus voting and geometric excess calculation via vigipy."""
        container = vg.convert(self.df, product_label=product_col, ae_label=event_col)
        active = methods or ["PRR", "ROR", "BCPNN", "GPS", "RFET", "LASSO", "SCORE"]
        return vg.consensus_analysis(
            container,
            methods=active,
            min_agreement_ratio=min_agreement_ratio,
        )

    def run_longitudinal(
        self,
        drug: str,
        event: str,
        time_col: str = "event_date",
        mode: str = "cumulative",
        time_unit: str = "quarter",
        method: str = "SCORE",
    ) -> Dict[str, Any]:
        """Runs longitudinal time-series surveillance via vigipy.LongitudinalModel."""
        model = LongitudinalModel(
            data=self.df,
            time_col=time_col,
            time_unit=time_unit,
            mode=mode,
            metric=method,
        )
        trajectory = model.evaluate(drug=drug, event=event)
        return {
            "drug": drug,
            "event": event,
            "method": method,
            "mode": mode,
            "timeUnit": time_unit,
            "trajectory": trajectory.to_dict(orient="records"),
            "emergenceQuarter": model.get_first_emergence(),
            "archetype": model.classify_archetype(),
        }


def main():
    parser = argparse.ArgumentParser(description="vigipy Studio Python Wrapper CLI")
    parser.add_argument("--input", "-i", type=str, help="Path to input surveillance dataset (.csv, .xlsx, .parquet)")
    parser.add_argument("--method", "-m", type=str, default="consensus", help="Analysis method or 'consensus'")
    parser.add_argument("--output", "-o", type=str, help="Output destination (.json or .xlsx)")
    parser.add_argument("--version", action="store_true", help="Print vigipy library version")
    args = parser.parse_args()

    if args.version:
        if VIGIPY_INSTALLED:
            print(f"vigipy version: {getattr(vg, '__version__', 'unknown')}")
        else:
            print("vigipy is not installed in the current Python environment.")
        return

    if not args.input:
        parser.print_help()
        sys.exit(1)

    wrapper = VigipyEngineWrapper(dataset_path=args.input)
    if args.method.lower() == "consensus":
        results = wrapper.run_consensus()
    else:
        results = wrapper.run_single_method(method=args.method)

    if args.output:
        if args.output.endswith('.json'):
            results.to_json(args.output, orient="records", indent=2)
        elif args.output.endswith('.xlsx'):
            results.to_excel(args.output, index=False)
        else:
            results.to_csv(args.output, index=False)
        print(f"Saved results to {args.output}")
    else:
        print(results.head(10).to_string())


if __name__ == "__main__":
    main()
