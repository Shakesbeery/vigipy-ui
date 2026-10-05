/**
 * vigipy Python Code Generator
 * Produces clean, typed, reproducible Python code using the official vigipy library.
 */

import { RunAnalysisRequest } from '../types';

export interface CodeGenParams {
  datasetName?: string;
  productCol?: string;
  aeCol?: string;
  countCol?: string;
  dateCol?: string;
  config: RunAnalysisRequest;
  targetDrug?: string;
  targetEvent?: string;
  timeUnit?: string;
  mode?: string;
  vigipyVersion?: string;
}

export function generateVigipyPythonCode(params: CodeGenParams): string {
  const {
    datasetName = 'dataset.csv',
    productCol = 'Product',
    aeCol = 'Adverse Event',
    countCol = 'Count',
    dateCol = 'Date',
    config,
    targetDrug = 'DRUG_NAME',
    targetEvent = 'EVENT_NAME',
    timeUnit = 'YE',
    mode = 'cumulative',
    vigipyVersion = '3.4.0',
  } = params;

  const prr = config.prr || { enabled: true, decision_metric: 'fdr', decision_thres: 0.05, min_events: 3, relative_risk: 1.0, continuity_correction: true };
  const ror = config.ror || { enabled: true, decision_metric: 'fdr', decision_thres: 0.05, min_events: 3, relative_risk: 1.0, continuity_correction: true };
  const rfet = config.rfet || { enabled: true, decision_metric: 'fdr', decision_thres: 0.05, min_events: 3, mid_pval: true };
  const bcpnn = config.bcpnn || { enabled: true, decision_metric: 'rank', decision_thres: 0.0, min_events: 3, ranking_statistic: 'quantile' };
  const gps = config.gps || { enabled: true, decision_metric: 'rank', decision_thres: 0.05, min_events: 3, ranking_statistic: 'log2' };
  const lasso = config.lasso || { enabled: false, lasso_thresh: 0.0, alpha: 0.5, min_events: 3, num_bootstrap: 10, relaxed: true };

  return `"""
Pharmacovigilance Disproportionality & Surveillance Pipeline
Target vigipy Version: ${vigipyVersion} (PyPI Official Release)
Install Command: pip install "vigipy[excel]>=${vigipyVersion}"
Repository: https://github.com/Shakesbeery/vigipy
"""

import pandas as pd
import numpy as np
import logging
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
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
print(f"Executing with vigipy version: {getattr(vg, '__version__', '${vigipyVersion}')}")

# ---------------------------------------------------------
# 1. DATA INGESTION & TYPED DATACONTAINERS
# ---------------------------------------------------------
print("Loading surveillance dataset: ${datasetName}...")
df = pd.read_csv("${datasetName}")

# Ingest via vigipy typed DataContainer
data = vg.convert(
    df,
    product_label="${productCol}",
    ae_label="${aeCol}",
    count_label="${countCol}",
)
print(f"Ingested {len(data.data):,} unique drug-event pairs across N={int(data.N):,} total reports.")

# ---------------------------------------------------------
# 2. METHOD CONFIGURATIONS (Type-Safe Dataclasses)
# ---------------------------------------------------------
configs = []

${prr.enabled ? `configs.append(
    PRRConfig(
        relative_risk=${prr.relative_risk || 1.0},
        min_events=${prr.min_events || 3},
        decision_metric="${prr.decision_metric || 'fdr'}",
        decision_thres=${prr.decision_thres || 0.05},
        continuity_correction=${prr.continuity_correction !== false ? 'True' : 'False'},
    )
)` : '# PRR disabled'}

${ror.enabled ? `configs.append(
    RORConfig(
        relative_risk=${ror.relative_risk || 1.0},
        min_events=${ror.min_events || 3},
        decision_metric="${ror.decision_metric || 'fdr'}",
        decision_thres=${ror.decision_thres || 0.05},
        continuity_correction=${ror.continuity_correction !== false ? 'True' : 'False'},
    )
)` : '# ROR disabled'}

${rfet.enabled ? `configs.append(
    RFETConfig(
        min_events=${rfet.min_events || 3},
        decision_metric="${rfet.decision_metric || 'fdr'}",
        decision_thres=${rfet.decision_thres || 0.05},
        mid_pval=${rfet.mid_pval !== false ? 'True' : 'False'},
    )
)` : '# RFET disabled'}

${bcpnn.enabled ? `configs.append(
    BCPNNConfig(
        relative_risk=${bcpnn.relative_risk || 1.0},
        min_events=${bcpnn.min_events || 3},
        decision_metric="${bcpnn.decision_metric || 'rank'}",
        decision_thres=${bcpnn.decision_thres || 0.0},
        ranking_statistic="${bcpnn.ranking_statistic || 'quantile'}",
    )
)` : '# BCPNN disabled'}

${gps.enabled ? `configs.append(
    GPSConfig(
        relative_risk=${gps.relative_risk || 1.0},
        min_events=${gps.min_events || 3},
        decision_metric="${gps.decision_metric || 'rank'}",
        decision_thres=${gps.decision_thres || 0.05},
        ranking_statistic="${gps.ranking_statistic || 'log2'}",
    )
)` : '# GPS disabled'}

${lasso.enabled ? `configs.append(
    LASSOConfig(
        lasso_thresh=${lasso.lasso_thresh || 0.0},
        alpha=${lasso.alpha || 0.5},
        min_events=${lasso.min_events || 3},
        num_bootstrap=${lasso.num_bootstrap || 10},
        relaxed=${lasso.relaxed !== false ? 'True' : 'False'},
    )
)` : '# LASSO disabled'}

# ---------------------------------------------------------
# 3. DISPROPORTIONALITY ANALYSIS EXECUTION
# ---------------------------------------------------------
print("\\nFitting cross-method consensus engine...")
consensus = consensus_analysis(
    data=data,
    configs=configs,
    min_consensus=2,  # Retain signals flagged by >= 2 methods
)

print(f"\\nDiscovered {consensus.num_signals:,} consensus safety signals.")
print(consensus.signals[["Product", "Adverse Event", "Count", "votes", "consensus_score", "agreement_tier"]].head(15))

# Export results to multi-tab Excel
consensus.export("vigipy_surveillance_report.xlsx")
print("Saved surveillance report to 'vigipy_surveillance_report.xlsx'.")

# Detail inspection for target pair
try:
    detail = consensus.inspect_signal("${targetDrug}", "${targetEvent}")
    print(f"\\nDetailed inspection for '${targetDrug}' -> '${targetEvent}':")
    print(detail)
except Exception:
    pass

# ---------------------------------------------------------
# 4. TEMPORAL & LONGITUDINAL SURVEILLANCE
# ---------------------------------------------------------
if "${dateCol}" in df.columns:
    print("\\nRunning longitudinal surveillance modeling...")
    long_df = df.rename(columns={
        "${productCol}": "name",
        "${aeCol}": "AE",
        "${countCol}": "count",
        "${dateCol}": "date",
    })
    lm = LongitudinalModel(long_df, "${timeUnit}")
    ${mode === 'cumulative' ? 'lm.run(vg.bcpnn, min_events=3)' : 'lm.run_disjoint(vg.bcpnn, min_events=3)'}
    print(f"Longitudinal modeling finished across {len(lm.results)} time periods.")

print("\\nvigipy pipeline execution complete.")
`;
}
