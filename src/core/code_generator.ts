/**
 * vigipy Python Code Generator
 * Produces clean, typed, reproducible Python code using the official vigipy 3.4.0 library.
 */

import { CohortFilter, DisproportionalityMethod, LongitudinalConfig, MethodConfigs } from '../types/vigipy';

export function generateVigipyPythonCode(
  datasetName: string,
  configs: MethodConfigs,
  selectedMethod: DisproportionalityMethod,
  filter: CohortFilter,
  longitudinalConfig: LongitudinalConfig,
  targetDrug: string,
  targetEvent: string,
  vigipyVersion: string = '3.4.0'
): string {
  const prr = configs.PRR;
  const ror = configs.ROR;
  const rfet = configs.RFET;
  const bcpnn = configs.BCPNN;
  const gps = configs.GPS;
  const lasso = configs.LASSO;
  const score = configs.SCORE || { latentRank: 5, syndromicWeight: 0.5, sparsityParam: 1.0, deflateIterations: 2, fdrThreshold: 0.05, minCount: 3 };
  const scoreDdi = configs.SCORE_DDI || { interactionModel: 'multiplicative', syndromicWeight: 0.5, sparsityParam: 1.0, fdrThreshold: 0.05, minCount: 3 };

  return `"""
Pharmacovigilance & Disproportionality Analysis Script
Target vigipy Version: ${vigipyVersion} (PyPI Official Release)
Install Command: pip install "vigipy[excel]==${vigipyVersion}"
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
    SCOREConfig,
    SCOREDDIConfig,
)

# Optional: configure structured diagnostic logging from vigipy
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
print(f"Executing with vigipy version: {getattr(vg, '__version__', '${vigipyVersion}')}")

# ---------------------------------------------------------
# 1. DATA INGESTION & TYPED DATACONTAINERS (vigipy 3.4.0)
# ---------------------------------------------------------
print("Loading FAERS dataset: ${datasetName || 'surveillance_dataset'}...")
df = pd.read_csv("faers_data.csv")

# Apply Cohort Subsetting Filters
cohort = df.copy()
${filter.roles.length < 4 ? `cohort = cohort[cohort['role'].isin(${JSON.stringify(filter.roles)})]` : '# All drug roles retained (PS, SS, C, I)'}
${filter.seriousOnly ? "cohort = cohort[cohort['serious'] == True]" : '# All report severity levels included'}
${filter.ageMin !== undefined ? `cohort = cohort[cohort['age'] >= ${filter.ageMin}]` : ''}
${filter.ageMax !== undefined ? `cohort = cohort[cohort['age'] <= ${filter.ageMax}]` : ''}
${filter.targetDrugs.length > 0 ? `cohort = cohort[cohort['drug_name'].isin(${JSON.stringify(filter.targetDrugs)})]` : ''}
${filter.targetEvents.length > 0 ? `cohort = cohort[cohort['pt'].isin(${JSON.stringify(filter.targetEvents)})]` : ''}

print(f"Total cohort reports available for analysis: {len(cohort)}")

# In vigipy 3.4.0, choose the DataContainer format matching your surveillance goals:
# Converter 1: Summary contingency counts table
summary_data = vg.convert(
    cohort,
    product_label="drug_name",
    ae_label="pt",
    count_label="count" if "count" in cohort.columns else None,
    margin_threshold=3,
)

# Converter 2: Binary case-level reports with clinical covariate adjustment (Age, Sex)
case_col = "case_id" if "case_id" in cohort.columns else ("caseId" if "caseId" in cohort.columns else None)
binary_data = vg.convert_binary(
    cohort,
    product_label="drug_name",
    ae_label="pt",
    report_id_label=case_col,
    covariate_labels=[c for c in ["age", "sex"] if c in cohort.columns],
    sparse=True,  # High-efficiency CSR matrix storage for large cohorts
)

# Converter 3: Drug-Drug & Multi-Drug interaction container (pairs k=2 and triplets k=3)
if case_col:
    ddi_data = vg.convert_ddi(
        cohort,
        product_label="drug_name",
        ae_label="pt",
        report_id_label=case_col,
        min_co_reports=3,
        max_order=2,
        include_singles=True,
        sparse=True,
    )

# ---------------------------------------------------------
# 2. METHOD CONFIGURATIONS (Type-Safe Dataclasses)
# ---------------------------------------------------------
prr_cfg = PRRConfig(
    alpha=${prr.alpha},
    continuity_correction=${prr.continuityCorrection ? 'True' : 'False'},
    correction_value=${prr.correctionValue},
    min_count=${prr.minCount},
    threshold_prr=${prr.thresholdPRR},
    threshold_chisq=${prr.thresholdChiSquare},
    expectation_method="${prr.expectationMethod || configs.expectationMethod || 'binomial'}",
)

ror_cfg = RORConfig(
    alpha=${ror.alpha},
    continuity_correction=${ror.continuityCorrection ? 'True' : 'False'},
    correction_value=${ror.correctionValue},
    min_count=${ror.minCount},
    threshold_lower_bound=${ror.thresholdLowerBound},
    expectation_method="${ror.expectationMethod || configs.expectationMethod || 'binomial'}",
)

rfet_cfg = RFETConfig(
    alpha=${rfet.alpha},
    alternative="${rfet.alternative}",
    mid_p=${rfet.midP ? 'True' : 'False'},
    min_count=${rfet.minCount},
    threshold_pvalue=${rfet.thresholdPValue},
    expectation_method="${rfet.expectationMethod || configs.expectationMethod || 'binomial'}",
)

bcpnn_cfg = BCPNNConfig(
    prior_alpha1=${bcpnn.priorAlpha1},
    prior_beta1=${bcpnn.priorBeta1},
    prior_alpha2=${bcpnn.priorAlpha2},
    prior_beta2=${bcpnn.priorBeta2},
    credibility_level=${bcpnn.credibilityLevel},
    threshold_ic025=${bcpnn.thresholdIC025},
    min_count=${bcpnn.minCount},
    expectation_method="${bcpnn.expectationMethod || configs.expectationMethod || 'binomial'}",
)

gps_cfg = GPSConfig(
    alpha1=${gps.alpha1},
    beta1=${gps.beta1},
    alpha2=${gps.alpha2},
    beta2=${gps.beta2},
    weight=${gps.weight},
    threshold_eb05=${gps.thresholdEB05},
    min_count=${gps.minCount},
    expectation_method="${gps.expectationMethod || configs.expectationMethod || 'binomial'}",
)

# Two-Stage Relaxed LASSO with debiased aROR refit
lasso_cfg = LASSOConfig(
    alpha=${lasso.alpha},
    max_iter=${lasso.maxIter},
    tolerance=${lasso.tolerance},
    standardize=${lasso.standardize ? 'True' : 'False'},
    fit_intercept=${lasso.fitIntercept ? 'True' : 'False'},
    threshold_coef=${lasso.thresholdCoef},
    min_count=${lasso.minCount},
    relaxed=${lasso.relaxed !== false ? 'True' : 'False'},
    decision_metric="lower_bound",
    n_jobs=-1,
)

# SCORE-DA: Syndromic Cellwise Outlier & Residual Estimation
score_cfg = SCOREConfig(
    latent_rank=${score.latentRank || 5},
    syndromic_weight=${score.syndromicWeight || 0.5},
    sparsity_param=${score.sparsityParam || 1.0},
    deflate_iterations=${score.deflateIterations || 2},
    fdr_threshold=${score.fdrThreshold || 0.05},
    min_count=${score.minCount || 3},
)

# SCORE-DDI: Multi-Drug Interaction Discovery
score_ddi_cfg = SCOREDDIConfig(
    interaction_model="${scoreDdi.interactionModel || 'multiplicative'}",
    syndromic_weight=${scoreDdi.syndromicWeight || 0.5},
    sparsity_param=${scoreDdi.sparsityParam || 1.0},
    fdr_threshold=${scoreDdi.fdrThreshold || 0.05},
    min_count=${scoreDdi.minCount || 3},
)

# ---------------------------------------------------------
# 3. DISPROPORTIONALITY ANALYSIS EXECUTION
# ---------------------------------------------------------

# Option A: Single Method Analysis via analyze()
print("Executing single-method analysis (${selectedMethod})...")
single_result = analyze(
    data=binary_data if "${selectedMethod}" in ["LASSO", "SCORE"] else summary_data,
    config=${
      selectedMethod === 'PRR' ? 'prr_cfg' :
      selectedMethod === 'ROR' ? 'ror_cfg' :
      selectedMethod === 'RFET' ? 'rfet_cfg' :
      selectedMethod === 'BCPNN' ? 'bcpnn_cfg' :
      selectedMethod === 'GPS' ? 'gps_cfg' :
      selectedMethod === 'LASSO' ? 'lasso_cfg' :
      selectedMethod === 'SCORE' ? 'score_cfg' :
      selectedMethod === 'SCORE_DDI' ? 'score_ddi_cfg' : 'prr_cfg'
    }
)
print(f"Signals flagged: {single_result.num_signals}")
print(single_result.signals.head(10))

# Export single result to Parquet or CSV
single_result.export("single_method_signals.csv")

# Option B: vigipy 3.4.0 Cross-Method Consensus Engine (consensus_analysis)
print("\\nExecuting cross-method consensus triangulation (consensus_analysis)...")
configs_list = [prr_cfg, ror_cfg, rfet_cfg, bcpnn_cfg, gps_cfg, lasso_cfg, score_cfg]
consensus = consensus_analysis(
    data=binary_data,
    configs=configs_list,
    min_consensus=3,  # Retain signals flagged by >= 3 methods
)

print("\\nTop Consensus Signals:")
print(consensus.signals[["Product", "Adverse Event", "Count", "votes", "consensus_score", "agreement_tier"]].head(15))

# Inter-method agreement matrices (Cohen's Kappa & Jaccard)
if hasattr(consensus, "method_agreement"):
    print("\\nPairwise Cohen's Kappa Concordance:")
    print(consensus.method_agreement["kappa"].round(3))

# Inspect individual target signal side-by-side across all methods
detail = consensus.inspect_signal("${targetDrug || 'PRODUCT_NAME'}", "${targetEvent || 'EVENT_NAME'}")
print(f"\\nSide-by-side inspection for ${targetDrug || 'PRODUCT'} -> ${targetEvent || 'EVENT'}:")
print(detail)

# Export consensus workbook (multi-sheet Excel)
consensus.export("consensus_surveillance_report.xlsx")

# ---------------------------------------------------------
# 4. TEMPORAL & LONGITUDINAL SURVEILLANCE (LongitudinalModel)
# ---------------------------------------------------------
time_col = "quarter" if "quarter" in cohort.columns else ("date" if "date" in cohort.columns else "date")
lm = LongitudinalModel(
    cohort,
    time_unit="${longitudinalConfig.timeUnit === 'quarter' ? 'QE' : (longitudinalConfig.timeUnit === 'year' ? 'YE' : 'ME')}",
    date_col=time_col,
    count_col="count" if "count" in cohort.columns else None,
)

# Run mode: Cumulative vs Disjoint
${longitudinalConfig.mode === 'cumulative' ? `
# Cumulative mode: accumulates evidence over calendar time, tracking exact emergence slice
lm.run(vg.${selectedMethod.toLowerCase().replace(/[^a-z0-9]/g, '_')}, warm_start=True)
` : `
# Disjoint mode: evaluates each time window independently to catch transient spikes & reporting shocks
lm.run_disjoint(vg.${selectedMethod.toLowerCase().replace(/[^a-z0-9]/g, '_')}, n_jobs=-1)
`}

print(f"\\nLongitudinal surveillance completed across {len(lm.results)} time periods.")
for timestamp, period_res in lm.results:
    if period_res is not None:
        print(f"Period ending {timestamp.date() if hasattr(timestamp, 'date') else timestamp}: {period_res.num_signals} active signals")

print("\\nvigipy 3.4.0 analysis pipeline executed successfully.")
`;
}

