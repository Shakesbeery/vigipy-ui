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
    vigipyVersion = '3.5.1',
  } = params;

  const prr = config.prr || { enabled: true, decision_metric: 'fdr', decision_thres: 0.05, min_events: 3, relative_risk: 1.0, continuity_correction: true };
  const ror = config.ror || { enabled: true, decision_metric: 'fdr', decision_thres: 0.05, min_events: 3, relative_risk: 1.0, continuity_correction: true };
  const rfet = config.rfet || { enabled: true, decision_metric: 'fdr', decision_thres: 0.05, min_events: 3, mid_pval: true };
  const bcpnn = config.bcpnn || { enabled: true, decision_metric: 'rank' as const, decision_thres: 0.0, min_events: 3, ranking_statistic: 'quantile' as const, relative_risk: 1.0 };
  const gps = config.gps || { enabled: true, decision_metric: 'rank' as const, decision_thres: 0.05, min_events: 3, ranking_statistic: 'log2' as const, relative_risk: 1.0 };
  const lasso = config.lasso || { enabled: false, lasso_thresh: 0.0, alpha: 0.5, min_events: 3, num_bootstrap: 10, relaxed: true };
  const scoreDa = config.score_da || { enabled: false, latent_rank: 5, syndromic_weight: 1.0, sparsity_param: 0.1 };
  const scoreDdi = config.score_ddi || { enabled: false, interaction_model: 'multiplicative' as const, syndromic_weight: 0.5, sparsity_param: 1.0, fdr_threshold: 0.05, min_events: 1 };
  const zigps = config.zigps || { enabled: false, decision_metric: 'rank' as const, decision_thres: 0.05, min_events: 3, ranking_statistic: 'log2' as const, relative_risk: 1.0 };
  const aegis = config.aegis || { enabled: false, decision_metric: 'combined' as const, fdr_threshold: 0.05, lb_threshold: 1.0, min_events: 3, null_rr: 1.0, huber_delta: 2.0, top_k_neighbors: 4, velocity_gain: 0.85, syndromic_gain: 1.5, syndromic_coupling: 0.6, martingale_coupling: 0.55 };
  const maxsprt = config.maxsprt || { enabled: false, alpha: 0.05, min_events: 3, upper_limit: 50.0, model: 'poisson' as const, critical_value: null };
  const cusum = config.cusum || { enabled: false, target_rr: 2.0, arl0: 500.0, min_events: 3, control_limit: null };

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
    convert,
    convert_binary,
    convert_ddi,
    PRRConfig,
    RORConfig,
    RFETConfig,
    BCPNNConfig,
    GPSConfig,
    LASSOConfig,
    SCOREConfig,
    SCOREDDIConfig,
    ZIGPSConfig,
    AEGISConfig,
    MaxSPRTConfig,
    CUSUMConfig,
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
 
${scoreDa.enabled ? `configs.append(
    SCOREConfig(
        latent_rank=${scoreDa.latent_rank || 5},
        syndromic_weight=${scoreDa.syndromic_weight || 1.0},
        sparsity_param=${scoreDa.sparsity_param || 0.1},
    )
)` : '# SCORE-DA disabled'}

${scoreDdi.enabled ? `configs.append(
    SCOREDDIConfig(
        interaction_model="${scoreDdi.interaction_model || 'multiplicative'}",
        syndromic_weight=${scoreDdi.syndromic_weight || 0.5},
        sparsity_param=${scoreDdi.sparsity_param || 1.0},
        fdr_threshold=${scoreDdi.fdr_threshold || 0.05},
        min_events=${scoreDdi.min_events || 1},
    )
)` : '# SCORE-DDI disabled'}

${zigps.enabled ? `configs.append(
    ZIGPSConfig(
        relative_risk=${zigps.relative_risk || 1.0},
        min_events=${zigps.min_events || 3},
        decision_metric="${zigps.decision_metric || 'rank'}",
        decision_thres=${zigps.decision_thres || 0.05},
        ranking_statistic="${zigps.ranking_statistic || 'log2'}",
    )
)` : '# ZIGPS disabled'}

${aegis.enabled ? `configs.append(
    AEGISConfig(
        min_events=${aegis.min_events || 3},
        fdr_threshold=${aegis.fdr_threshold || 0.05},
        lb_threshold=${aegis.lb_threshold || 1.0},
        decision_metric="${aegis.decision_metric || 'combined'}",
        null_rr=${aegis.null_rr || 1.0},
        huber_delta=${aegis.huber_delta || 2.0},
        top_k_neighbors=${aegis.top_k_neighbors || 4},
        velocity_gain=${aegis.velocity_gain || 0.85},
        syndromic_gain=${aegis.syndromic_gain || 1.5},
        syndromic_coupling=${aegis.syndromic_coupling || 0.6},
        martingale_coupling=${aegis.martingale_coupling || 0.55},
    )
)` : '# AEGIS disabled'}

${maxsprt.enabled ? `configs.append(
    MaxSPRTConfig(
        alpha=${maxsprt.alpha || 0.05},
        min_events=${maxsprt.min_events || 3},
        upper_limit=${maxsprt.upper_limit || 50.0},
        model="${maxsprt.model || 'poisson'}",
        ${maxsprt.critical_value ? `critical_value=${maxsprt.critical_value},` : ''}
    )
)` : '# MaxSPRT disabled'}

${cusum.enabled ? `configs.append(
    CUSUMConfig(
        target_rr=${cusum.target_rr || 2.0},
        arl0=${cusum.arl0 || 500.0},
        min_events=${cusum.min_events || 3},
        ${cusum.control_limit ? `control_limit=${cusum.control_limit},` : ''}
    )
)` : '# CUSUM-DA disabled'}

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
