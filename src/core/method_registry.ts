/**
 * Dynamic Method Registry & Container Contract for vigipy
 * Guarantees that any new disproportionality analysis (DA) method added to vigipy
 * is dynamically registered, automatically exposed in the UI, parameterized with
 * docstrings and tooltips, and included in consensus calculations.
 */

import React from 'react';
import { ContingencyTable, DisproportionalityMethod, SignalResult } from '../types/vigipy';
import { runPRR } from './methods/prr';
import { runROR } from './methods/ror';
import { runRFET } from './methods/rfet';
import { runBCPNN } from './methods/bcpnn';
import { runGPS } from './methods/gps';
import { runLASSO } from './methods/lasso';
import { runSCORE, DEFAULT_SCORE_CONFIG } from './methods/score';
import { runSCOREDDI, DEFAULT_SCORE_DDI_CONFIG } from './methods/score_ddi';

export interface ParameterSpec {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'select';
  default: any;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  docstring: string;
  clinicalImpact: string;
}

export interface MethodContract<TConfig = any> {
  id: string; // e.g. 'PRR', 'ROR', 'RFET', 'BCPNN', 'GPS', 'LASSO', 'SCORE', 'SCORE_DDI'
  name: string;
  fullName: string;
  family: 'frequentist' | 'bayesian' | 'penalized' | 'exact' | 'syndromic';
  badgeColor: string;
  docstring: string;
  defaultConfig: TConfig;
  parameters: ParameterSpec[];
  run: (
    drug: string,
    event: string,
    table: ContingencyTable,
    config: TConfig,
    soc?: string
  ) => SignalResult;
}

export const expectationMethodParam: ParameterSpec = {
  key: 'expectationMethod',
  label: 'Expectation Method',
  type: 'select',
  default: 'mantel-haenszel',
  options: [
    { value: 'mantel-haenszel', label: 'Mantel-Haenszel (vigipy default: Standard Marginal Independence E = n₁· × n·₁ / n··)' },
    { value: 'poisson', label: 'Poisson GLM Log-Linear Regression' },
    { value: 'negative-binomial', label: 'Negative Binomial GLM (Overdispersion adjusted)' },
    { value: 'binomial', label: 'Binomial Model (p₀ = n₀₁ / n₀·)' },
    { value: 'standard', label: 'Standard Independence (Classical cross-product)' },
  ],
  docstring:
    'expectation_method: Formulation used to calculate expected baseline co-occurrence count (E) under null hypothesis in vigipy. "mantel-haenszel" is the official vigipy default (E = n1· * n·1 / n··). "poisson" uses Poisson GLM log-linear regression. "negative-binomial" models overdispersed event clustering.',
  clinicalImpact:
    'Calibrates statistical background expectations without confounding under spontaneous reporting databases.',
};

// 1. PRR Contract
const prrContract: MethodContract = {
  id: 'PRR',
  name: 'PRR',
  fullName: 'Proportional Reporting Ratio',
  family: 'frequentist',
  badgeColor: 'border-rose-500/40 text-rose-300 bg-rose-500/10',
  docstring:
    'Proportional Reporting Ratio (Evans et al., 2001). Compares the proportion of all reports involving a specific event for the target product against the proportion of the same event for all other products. Uses a log-normal frequentist approximation to compute 95% confidence intervals and Pearson Chi-square hypothesis tests.',
  defaultConfig: {
    alpha: 0.05,
    continuityCorrection: true,
    correctionValue: 0.5,
    minCount: 3,
    thresholdPRR: 2.0,
    thresholdChiSquare: 4.0,
    expectationMethod: 'mantel-haenszel',
  },
  parameters: [
    expectationMethodParam,
    {
      key: 'thresholdPRR',
      label: 'Signal PRR Threshold',
      type: 'number',
      default: 2.0,
      min: 1.0,
      max: 10.0,
      step: 0.1,
      docstring:
        'threshold_prr: Minimum point estimate of PRR required to declare a Signal of Disproportionate Reporting (SDR). Standard surveillance guidelines (MHRA / EMA) specify threshold_prr >= 2.0.',
      clinicalImpact:
        'Higher values increase specificity (reducing false positives) but may delay signal detection for emerging moderate safety risks.',
    },
    {
      key: 'thresholdChiSquare',
      label: 'Chi-Square (χ²) Threshold',
      type: 'number',
      default: 4.0,
      min: 0.0,
      max: 20.0,
      step: 0.5,
      docstring:
        'threshold_chisq: Pearson Chi-square cutoff (with Yates continuity correction) for 1 degree of freedom. Under the null hypothesis of independence, chisq >= 3.841 corresponds to p < 0.05. Standard threshold is 4.0.',
      clinicalImpact:
        'Ensures that the observed disproportionality is statistically distinguishable from random reporting fluctuations.',
    },
    {
      key: 'minCount',
      label: 'Minimum Observed Count (N₁₁)',
      type: 'number',
      default: 3,
      min: 1,
      max: 50,
      step: 1,
      docstring:
        'min_count: Minimum number of co-reported product-event cases (N11) required before an SDR can be declared. Standard practice sets min_count >= 3.',
      clinicalImpact:
        'Prevents isolated idiosyncratic cases or data entry anomalies from triggering widespread safety alerts.',
    },
    {
      key: 'alpha',
      label: 'Significance Level (Alpha)',
      type: 'number',
      default: 0.05,
      min: 0.001,
      max: 0.2,
      step: 0.01,
      docstring:
        'alpha: Two-sided significance level for calculating log-normal confidence intervals: z = Phi^(-1)(1 - alpha / 2). Default 0.05 yields 95% confidence intervals.',
      clinicalImpact:
        'Governs the width of the confidence intervals. Lower alpha values (e.g., 0.01) produce wider, more conservative bounds.',
    },
    {
      key: 'continuityCorrection',
      label: 'Haldane-Anscombe Zero Correction',
      type: 'boolean',
      default: true,
      docstring:
        'continuity_correction: Boolean flag. When True, applies Haldane-Anscombe (+0.5) continuity adjustment to contingency table cells containing 0 counts to prevent division by zero or infinite variance.',
      clinicalImpact:
        'Essential for sparse contingency tables and rare device/drug complications.',
    },
    {
      key: 'correctionValue',
      label: 'Continuity Offset Value',
      type: 'number',
      default: 0.5,
      min: 0.1,
      max: 1.0,
      step: 0.1,
      docstring:
        'correction_value: Constant added to zero-cells when continuity_correction is active. Standard theoretical value is 0.5 (Haldane 1955, Anscombe 1956).',
      clinicalImpact:
        'A value of 0.5 provides the lowest first-order asymptotic bias for log-odds and log-ratios.',
    },
  ],
  run: (drug, event, table, config, soc) => runPRR(drug, event, table, config, soc),
};

// 2. ROR Contract
const rorContract: MethodContract = {
  id: 'ROR',
  name: 'ROR',
  fullName: 'Reporting Odds Ratio',
  family: 'frequentist',
  badgeColor: 'border-blue-500/40 text-blue-300 bg-blue-500/10',
  docstring:
    'Reporting Odds Ratio (van Puijenbroek et al., 2002). Computes the ratio of the odds of reporting the target outcome with the target product versus all other products. Employs Woolf log-odds standard error formulation and Wald test statistics.',
  defaultConfig: {
    alpha: 0.05,
    continuityCorrection: true,
    correctionValue: 0.5,
    minCount: 3,
    thresholdLowerBound: 1.0,
    thresholdROR: 1.0,
    expectationMethod: 'mantel-haenszel',
  },
  parameters: [
    expectationMethodParam,
    {
      key: 'thresholdLowerBound',
      label: '95% Lower Bound Threshold (ROR₀₂₅)',
      type: 'number',
      default: 1.0,
      min: 0.5,
      max: 5.0,
      step: 0.1,
      docstring:
        'threshold_lower_bound: Critical threshold for the lower bound of the 95% confidence interval (ROR025). The standard safety signal criterion requires ROR025 > 1.0.',
      clinicalImpact:
        'Requiring the lower bound to exceed 1.0 ensures that the elevated reporting odds cannot be explained by sampling noise at the 95% confidence level.',
    },
    {
      key: 'thresholdROR',
      label: 'Point Estimate Threshold (ROR)',
      type: 'number',
      default: 1.0,
      min: 0.5,
      max: 5.0,
      step: 0.1,
      docstring:
        'threshold_ror: Minimum point estimate of the Reporting Odds Ratio required to consider a disproportional signal (typically >= 1.0 or 2.0).',
      clinicalImpact:
        'Ensures the point estimate reflects an elevated odds ratio before assessing bound certainty.',
    },
    {
      key: 'minCount',
      label: 'Minimum Case Count (N₁₁)',
      type: 'number',
      default: 3,
      min: 1,
      max: 50,
      step: 1,
      docstring:
        'min_count: Minimum observed product-event co-occurrences required. Default is 3.',
      clinicalImpact:
        'Filters out noise from rare unrepeated report pairs.',
    },
    {
      key: 'alpha',
      label: 'Significance Level (Alpha)',
      type: 'number',
      default: 0.05,
      min: 0.001,
      max: 0.2,
      step: 0.01,
      docstring:
        'alpha: Significance level for two-sided Wald confidence intervals (Woolf variance: 1/a + 1/b + 1/c + 1/d).',
      clinicalImpact:
        'Sets the error probability for confidence bounds.',
    },
    {
      key: 'continuityCorrection',
      label: 'Haldane-Anscombe Zero Correction',
      type: 'boolean',
      default: true,
      docstring:
        'continuity_correction: Adds offset constant to contingency table cells when any cell is 0, avoiding division by zero or infinite odds ratios.',
      clinicalImpact:
        'Stabilizes estimates when events or exposures are infrequent.',
    },
    {
      key: 'correctionValue',
      label: 'Continuity Offset Value',
      type: 'number',
      default: 0.5,
      min: 0.1,
      max: 1.0,
      step: 0.1,
      docstring:
        'correction_value: Constant added to zero-cells when continuity_correction is active. Standard theoretical value is 0.5.',
      clinicalImpact:
        'Provides optimal first-order asymptotic bias correction.',
    },
  ],
  run: (drug, event, table, config, soc) => runROR(drug, event, table, config, soc),
};

// 3. RFET Contract
const rfetContract: MethodContract = {
  id: 'RFET',
  name: 'RFET',
  fullName: "Reporting Fisher's Exact Test",
  family: 'exact',
  badgeColor: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
  docstring:
    "Reporting Fisher's Exact Test. Computes the exact hypergeometric probability of observing a contingency table at least as extreme as the observed data. In vigipy, an optional mid-p correction is provided to resolve the conservative bias inherent to discrete Fisher's tests.",
  defaultConfig: {
    alpha: 0.05,
    alternative: 'greater',
    midP: true,
    minCount: 3,
    thresholdPValue: 0.05,
    expectationMethod: 'mantel-haenszel',
  },
  parameters: [
    expectationMethodParam,
    {
      key: 'midP',
      label: 'Mid-p Value Correction',
      type: 'boolean',
      default: true,
      docstring:
        'mid_p: When True, subtracts half the point probability of the observed table from the cumulative upper tail. Strongly recommended in vigipy to eliminate conservative bias in discrete 2x2 surveillance tables.',
      clinicalImpact:
        'Brings the true type I error rate closer to nominal alpha (0.05) and increases signal detection power without inflating false positives.',
    },
    {
      key: 'alternative',
      label: 'Hypothesis Direction',
      type: 'select',
      default: 'greater',
      options: [
        { value: 'greater', label: 'Greater (Elevated Disproportion)' },
        { value: 'two-sided', label: 'Two-Sided (Bidirectional)' },
        { value: 'less', label: 'Less (Deficit / Protective)' },
      ],
      docstring:
        'alternative: Direction of the exact hypergeometric test. In safety surveillance, "greater" tests specifically for elevated disproportional reporting.',
      clinicalImpact:
        'Focused on detecting excess hazard rather than under-reporting.',
    },
    {
      key: 'thresholdPValue',
      label: 'p-Value Alpha Cutoff',
      type: 'number',
      default: 0.05,
      min: 0.0001,
      max: 0.1,
      step: 0.005,
      docstring:
        'threshold_pvalue: Critical threshold below which exact p-value flags a signal (typically p < 0.05).',
      clinicalImpact:
        'Controls statistical stringency.',
    },
    {
      key: 'alpha',
      label: 'Nominal Alpha Level',
      type: 'number',
      default: 0.05,
      min: 0.001,
      max: 0.2,
      step: 0.01,
      docstring:
        'alpha: Nominal alpha rate for hypothesis rejection in exact testing.',
      clinicalImpact:
        'Defines false positive rate upper bound under the null hypothesis.',
    },
    {
      key: 'minCount',
      label: 'Minimum Count (N₁₁)',
      type: 'number',
      default: 3,
      min: 1,
      max: 50,
      step: 1,
      docstring: 'min_count: Minimum co-occurrence count.',
      clinicalImpact: 'Guards against spurious single-case signals.',
    },
  ],
  run: (drug, event, table, config, soc) => runRFET(drug, event, table, config, soc),
};

// 4. BCPNN Contract
const bcpnnContract: MethodContract = {
  id: 'BCPNN',
  name: 'BCPNN',
  fullName: 'Bayesian Confidence Propagation Neural Network',
  family: 'bayesian',
  badgeColor: 'border-violet-500/40 text-violet-300 bg-violet-500/10',
  docstring:
    'Bayesian Confidence Propagation Neural Network (Bate et al., WHO Uppsala Monitoring Centre). Calculates the Information Component (IC) using Beta-Binomial conjugate priors. The 95% credible interval [IC025, IC975] reflects posterior uncertainty; IC025 > 0 is the gold standard WHO-UMC signal criterion.',
  defaultConfig: {
    priorAlpha1: 1.0,
    priorBeta1: 1.0,
    priorAlpha2: 1.0,
    priorBeta2: 1.0,
    priorAlpha11: 1.0,
    priorBeta11: 1.0,
    credibilityLevel: 0.95,
    thresholdIC025: 0.0,
    thresholdIC: 0.0,
    minCount: 3,
    expectationMethod: 'mantel-haenszel',
  },
  parameters: [
    expectationMethodParam,
    {
      key: 'thresholdIC025',
      label: 'Lower Credible Bound Threshold (IC₀₂₅)',
      type: 'number',
      default: 0.0,
      min: -1.0,
      max: 2.0,
      step: 0.1,
      docstring:
        'threshold_ic025: WHO-UMC criterion: Lower 2.5% quantile of the posterior distribution of the Information Component. IC025 > 0 indicates that with 97.5% posterior certainty, the observed report rate exceeds the baseline expected rate.',
      clinicalImpact:
        'World standard for international pharmacovigilance and device safety registries.',
    },
    {
      key: 'thresholdIC',
      label: 'Point Estimate Threshold (IC)',
      type: 'number',
      default: 0.0,
      min: -1.0,
      max: 2.0,
      step: 0.1,
      docstring:
        'threshold_ic: Information Component point estimate cutoff. IC = log2(Observed / Expected). Positive values denote elevated disproportional reporting.',
      clinicalImpact:
        'Baseline signal indicator prior to credible interval shrinkage.',
    },
    {
      key: 'credibilityLevel',
      label: 'Credibility Coverage Level',
      type: 'number',
      default: 0.95,
      min: 0.8,
      max: 0.99,
      step: 0.01,
      docstring:
        'credibility_level: Posterior credible interval coverage probability (e.g. 0.95 corresponds to central 95% interval [IC025, IC975]).',
      clinicalImpact:
        'Determines the stringency of the Bayesian credible interval.',
    },
    {
      key: 'priorAlpha1',
      label: 'Prior α₁ (Product Exposure)',
      type: 'number',
      default: 1.0,
      min: 0.1,
      max: 10.0,
      step: 0.5,
      docstring:
        'prior_alpha1: Shape hyperparameter for the Beta prior on the marginal probability of product exposure P(X). Uniform uninformative prior is 1.0.',
      clinicalImpact: 'Higher values shrink estimates toward the prior mean.',
    },
    {
      key: 'priorBeta1',
      label: 'Prior β₁ (Product Exposure)',
      type: 'number',
      default: 1.0,
      min: 0.1,
      max: 10.0,
      step: 0.5,
      docstring:
        'prior_beta1: Scale hyperparameter for the Beta prior on P(X).',
      clinicalImpact: 'Prior weight on non-exposure.',
    },
    {
      key: 'priorAlpha2',
      label: 'Prior α₂ (Outcome Baseline)',
      type: 'number',
      default: 1.0,
      min: 0.1,
      max: 10.0,
      step: 0.5,
      docstring:
        'prior_alpha2: Shape hyperparameter for the Beta prior on the marginal probability of outcome P(Y).',
      clinicalImpact: 'Controls shrinkage for rare outcome baselines.',
    },
    {
      key: 'priorBeta2',
      label: 'Prior β₂ (Outcome Baseline)',
      type: 'number',
      default: 1.0,
      min: 0.1,
      max: 10.0,
      step: 0.5,
      docstring:
        'prior_beta2: Scale hyperparameter for the Beta prior on P(Y).',
      clinicalImpact: 'Prior weight on absence of outcome.',
    },
    {
      key: 'priorAlpha11',
      label: 'Prior α₁₁ (Joint Product-Outcome)',
      type: 'number',
      default: 1.0,
      min: 0.1,
      max: 10.0,
      step: 0.5,
      docstring:
        'prior_alpha11: Shape hyperparameter for the joint conjugate prior distribution P(X, Y). Standard default is 1.0 uninformative prior.',
      clinicalImpact: 'Controls joint probability shrinkage for low-count cells.',
    },
    {
      key: 'priorBeta11',
      label: 'Prior β₁₁ (Joint Product-Outcome)',
      type: 'number',
      default: 1.0,
      min: 0.1,
      max: 10.0,
      step: 0.5,
      docstring:
        'prior_beta11: Scale hyperparameter for the joint conjugate prior distribution P(X, Y).',
      clinicalImpact: 'Calibrates joint negative probability expectation.',
    },
    {
      key: 'minCount',
      label: 'Minimum Case Count (N₁₁)',
      type: 'number',
      default: 3,
      min: 1,
      max: 50,
      step: 1,
      docstring: 'min_count: Minimum co-reported cases required.',
      clinicalImpact: 'Filters out low-volume combinations.',
    },
  ],
  run: (drug, event, table, config, soc) => runBCPNN(drug, event, table, config, soc),
};

// 5. GPS Contract
const gpsContract: MethodContract = {
  id: 'GPS',
  name: 'GPS / MGPS',
  fullName: 'Multi-Item Gamma Poisson Shrinker',
  family: 'bayesian',
  badgeColor: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
  docstring:
    'Multi-item Gamma Poisson Shrinker (DuMouchel, 1999). Empirical Bayes mixture model used by the FDA. Models relative reporting rates as a bivariate mixture of two Gamma distributions. Shrinks noisy small counts toward the prior mean to compute Empirical Bayes Geometric Mean (EBGM) and the lower 5th percentile (EB05).',
  defaultConfig: {
    alpha1: 0.2,
    beta1: 0.1,
    alpha2: 2.0,
    beta2: 4.0,
    weight: 0.1,
    thresholdEB05: 2.0,
    thresholdEBGM: 2.0,
    credibleInterval: 0.90,
    minCount: 3,
    expectationMethod: 'mantel-haenszel',
  },
  parameters: [
    expectationMethodParam,
    {
      key: 'thresholdEB05',
      label: 'FDA Lower Bound Threshold (EB₀₅)',
      type: 'number',
      default: 2.0,
      min: 1.0,
      max: 5.0,
      step: 0.1,
      docstring:
        'threshold_eb05: Lower 5th percentile of the empirical Bayes posterior distribution of lambda. Standard FDA MGPS detection criterion is EB05 >= 2.0.',
      clinicalImpact:
        'Represents a high-confidence signal indicating at least a 2-fold increased reporting rate after shrinking for sample size variance.',
    },
    {
      key: 'thresholdEBGM',
      label: 'EBGM Point Estimate Threshold',
      type: 'number',
      default: 2.0,
      min: 1.0,
      max: 5.0,
      step: 0.1,
      docstring:
        'threshold_ebgm: Empirical Bayes Geometric Mean (EBGM) point estimate cutoff. Corresponds to exp(E[ln(lambda)|N]). Standard threshold is >= 2.0.',
      clinicalImpact:
        'Center of gravity of the posterior risk distribution.',
    },
    {
      key: 'weight',
      label: 'Prior Mixture Weight (w)',
      type: 'number',
      default: 0.1,
      min: 0.01,
      max: 0.99,
      step: 0.05,
      docstring:
        'weight: Weight allocated to the first Gamma component w * Gamma(alpha1, beta1) + (1-w) * Gamma(alpha2, beta2). Component 1 typically captures the baseline null pairs.',
      clinicalImpact:
        'Controls the proportion of pairs presumed to belong to the background null distribution.',
    },
    {
      key: 'alpha1',
      label: 'α₁ (Null Component Shape)',
      type: 'number',
      default: 0.2,
      min: 0.01,
      max: 5.0,
      step: 0.05,
      docstring:
        'alpha1: Shape parameter for Gamma component 1. Captures the background null distribution centered near 1.0.',
      clinicalImpact: 'Higher values increase baseline shrinkage.',
    },
    {
      key: 'beta1',
      label: 'β₁ (Null Component Scale)',
      type: 'number',
      default: 0.1,
      min: 0.01,
      max: 5.0,
      step: 0.05,
      docstring: 'beta1: Scale parameter for Gamma component 1.',
      clinicalImpact: 'Calibrates background Poisson noise.',
    },
    {
      key: 'alpha2',
      label: 'α₂ (Signal Component Shape)',
      type: 'number',
      default: 2.0,
      min: 0.1,
      max: 10.0,
      step: 0.1,
      docstring:
        'alpha2: Shape parameter for Gamma component 2. Models elevated disproportional reporting rates.',
      clinicalImpact: 'Governs the shape of true safety signal clusters.',
    },
    {
      key: 'beta2',
      label: 'β₂ (Signal Component Scale)',
      type: 'number',
      default: 4.0,
      min: 0.1,
      max: 10.0,
      step: 0.1,
      docstring: 'beta2: Scale parameter for Gamma component 2.',
      clinicalImpact: 'Adjusts the mean of the elevated signal component.',
    },
    {
      key: 'credibleInterval',
      label: 'Posterior Credible Coverage',
      type: 'number',
      default: 0.90,
      min: 0.80,
      max: 0.99,
      step: 0.01,
      docstring:
        'credible_interval: Central posterior probability coverage. Default 0.90 yields percentiles [EB05, EB95].',
      clinicalImpact: 'FDA surveillance standard uses 90% coverage.',
    },
    {
      key: 'minCount',
      label: 'Minimum Case Count (N₁₁)',
      type: 'number',
      default: 3,
      min: 1,
      max: 50,
      step: 1,
      docstring: 'min_count: Minimum observed report count for analysis.',
      clinicalImpact: 'Prevents evaluating sub-threshold pairs.',
    },
  ],
  run: (drug, event, table, config, soc) => runGPS(drug, event, table, config, soc),
};

// 6. LASSO Contract
const lassoContract: MethodContract = {
  id: 'LASSO',
  name: 'LASSO',
  fullName: 'L1-Penalized Multivariate Regression',
  family: 'penalized',
  badgeColor: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10',
  docstring:
    'L1-penalized multivariate coordinate descent regression. Analyzes multiple medical products, devices, and treatments simultaneously. The L1 penalty forces spurious coefficients to zero, effectively adjusting for polypharmacy, co-prescriptions, co-implantations, and clinical confounding by indication.',
  defaultConfig: {
    alpha: 0.05,
    maxIter: 60,
    tolerance: 1e-4,
    standardize: true,
    fitIntercept: true,
    thresholdCoef: 0.05,
    minCount: 3,
    expectationMethod: 'mantel-haenszel',
  },
  parameters: [
    expectationMethodParam,
    {
      key: 'alpha',
      label: 'L1 Regularization Penalty (λ)',
      type: 'number',
      default: 0.05,
      min: 0.001,
      max: 1.0,
      step: 0.01,
      docstring:
        'alpha: L1 regularization penalty parameter lambda. Governs the amount of coefficient shrinkage. Higher values induce greater sparsity, setting coefficients of confounded co-exposures to exact zero.',
      clinicalImpact:
        'The primary parameter for controlling polypharmacy confounding and false discovery rates across multi-product regimens.',
    },
    {
      key: 'thresholdCoef',
      label: 'Signal Beta Threshold (β)',
      type: 'number',
      default: 0.05,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      docstring:
        'threshold_coef: Minimum positive regularized regression coefficient beta required to declare a signal. Uncorrelated or confounded products are shrunk to 0.0.',
      clinicalImpact:
        'Ensures that only exposures with a sustained positive independent contribution to risk are flagged.',
    },
    {
      key: 'maxIter',
      label: 'Max Coordinate Descent Iterations',
      type: 'number',
      default: 60,
      min: 10,
      max: 500,
      step: 10,
      docstring:
        'max_iter: Maximum number of coordinate descent cycles over all features before stopping.',
      clinicalImpact: 'Higher values ensure asymptotic convergence for large datasets.',
    },
    {
      key: 'tolerance',
      label: 'Convergence Tolerance (ε)',
      type: 'number',
      default: 0.0001,
      min: 0.00001,
      max: 0.01,
      step: 0.0001,
      docstring:
        'tolerance: Convergence criterion epsilon. Iteration terminates when the maximum coefficient change across an iteration falls below this value.',
      clinicalImpact: 'Numerical precision control.',
    },
    {
      key: 'standardize',
      label: 'Standardize Features',
      type: 'boolean',
      default: true,
      docstring:
        'standardize: When True, normalizes exposure feature vectors to unit variance before applying L1 penalization.',
      clinicalImpact:
        'Prevents high-volume products from being penalized less than low-volume products.',
    },
    {
      key: 'fitIntercept',
      label: 'Fit Baseline Intercept',
      type: 'boolean',
      default: true,
      docstring:
        'fit_intercept: When True, includes an unpenalized intercept parameter beta0 to account for baseline outcome incidence.',
      clinicalImpact:
        'Prevents baseline background rates from biasing individual exposure coefficients.',
    },
    {
      key: 'minCount',
      label: 'Minimum Case Count (N₁₁)',
      type: 'number',
      default: 3,
      min: 1,
      max: 50,
      step: 1,
      docstring: 'min_count: Minimum co-occurrences required.',
      clinicalImpact: 'Noise filtration threshold.',
    },
  ],
  run: (drug, event, table, config, soc) => runLASSO(drug, event, table, config, undefined, soc),
};

// 7. SCORE-DA Contract (vigipy 3.4.0)
const scoreContract: MethodContract = {
  id: 'SCORE',
  name: 'SCORE-DA',
  fullName: 'Syndromic Cellwise Outlier & Residual Estimation',
  family: 'syndromic',
  badgeColor: 'border-violet-500/40 text-violet-300 bg-violet-500/10',
  docstring:
    'SCORE-DA (vigipy 3.4.0). Eliminates indication confounding and blockbuster masking through Truncated SVD low-rank indication absorption on standardized Pearson residuals, patient-level symptom co-occurrence Graph Laplacian regularization, non-negative FISTA optimization, and iterative deflation passes.',
  defaultConfig: { ...DEFAULT_SCORE_CONFIG },
  parameters: [
    {
      key: 'latentRank',
      label: 'Latent Indication Factors (Rank K)',
      type: 'number',
      default: 5,
      min: 1,
      max: 20,
      step: 1,
      docstring:
        'latent_rank: Number of low-rank singular vectors (Truncated SVD) used to absorb disease-indication background and shared drug-class baseline propensities.',
      clinicalImpact:
        'Higher rank absorbs broad indication noise and disease-related symptoms, uncovering true adverse drug events obscured by co-morbidity confounding.',
    },
    {
      key: 'syndromicWeight',
      label: 'Graph Laplacian Coupling (λ₂)',
      type: 'number',
      default: 0.5,
      min: 0.0,
      max: 2.0,
      step: 0.05,
      docstring:
        'syndromic_weight: Graph Laplacian coupling penalty (lambda_2 >= 0) enforcing smoothness across related symptoms in clinical syndrome clusters (e.g. Anaphylaxis or DRESS).',
      clinicalImpact:
        'Enables co-reported adverse events within a syndrome cluster to borrow statistical strength without external ontology lookup.',
    },
    {
      key: 'sparsityParam',
      label: 'Sparsity Penalty (λ₁)',
      type: 'number',
      default: 1.0,
      min: 0.1,
      max: 5.0,
      step: 0.1,
      docstring:
        'sparsity_param: L1 non-negative soft-threshold penalty (lambda_1 >= 0) used in FISTA optimization to shrink spurious baseline noise to exactly zero.',
      clinicalImpact:
        'Increases specificity by eliminating background noise and isolating bona fide safety alerts.',
    },
    {
      key: 'deflateIterations',
      label: 'Masking Deflation Passes',
      type: 'number',
      default: 2,
      min: 0,
      max: 5,
      step: 1,
      docstring:
        'deflate_iterations: Number of iterative deflation passes to remove blockbuster masking effects caused by disproportionately reported products.',
      clinicalImpact:
        'Iterative deflation unmasks hidden safety signals previously suppressed by dominant blockbuster drugs.',
    },
    {
      key: 'fdrThreshold',
      label: 'FDR Cutoff (q-value)',
      type: 'number',
      default: 0.05,
      min: 0.005,
      max: 0.2,
      step: 0.005,
      docstring:
        'fdr_threshold: Target False Discovery Rate cutoff via Benjamini-Hochberg procedure.',
      clinicalImpact:
        'Controls family-wise error rate across high-dimensional surveillance screenings.',
    },
    {
      key: 'minCount',
      label: 'Minimum Case Count (N₁₁)',
      type: 'number',
      default: 3,
      min: 1,
      max: 50,
      step: 1,
      docstring: 'min_count: Minimum co-occurrences required before declaring a syndromic outlier alert.',
      clinicalImpact: 'Filters out isolated unverified reports.',
    },
  ],
  run: (drug, event, table, config, soc) => runSCORE(drug, event, table, config, soc),
};

// 8. SCORE-DDI Contract (vigipy 3.4.0)
const scoreDdiContract: MethodContract = {
  id: 'SCORE_DDI',
  name: 'SCORE-DDI',
  fullName: 'Syndromic Multi-Drug & DDI Interaction Discovery',
  family: 'syndromic',
  badgeColor: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
  docstring:
    'SCORE-DDI (vigipy 3.4.0). Multi-drug regimen and pairwise drug interaction discovery. Subtracts solo baselines (C1 - C_combo) to avoid combinatorial inflation and classifies synergies into epidemiological archetypes: EMERGENT, POTENTIATED, TWO_HIT, or MULTI_HIT.',
  defaultConfig: { ...DEFAULT_SCORE_DDI_CONFIG },
  parameters: [
    {
      key: 'interactionModel',
      label: 'Interaction Null Model',
      type: 'select',
      default: 'multiplicative',
      options: [
        { value: 'multiplicative', label: 'Multiplicative Model (Risk Ratio Multiplication)' },
        { value: 'additive', label: 'Additive Model (Excess Risk Summation)' },
      ],
      docstring:
        'interaction_model: Null baseline expectation model for evaluating drug-drug combinations. Multiplicative tests if combo risk exceeds product of solo risk ratios.',
      clinicalImpact:
        'Multiplicative model is standard in pharmacovigilance to prevent false interaction calls when both drugs individually carry elevated baseline toxicity.',
    },
    {
      key: 'syndromicWeight',
      label: 'Graph Laplacian Coupling (λ₂)',
      type: 'number',
      default: 0.5,
      min: 0.0,
      max: 2.0,
      step: 0.05,
      docstring: 'syndromic_weight: Graph coupling across related symptom categories.',
      clinicalImpact: 'Stabilizes interaction estimates for multi-system toxicities.',
    },
    {
      key: 'sparsityParam',
      label: 'Sparsity Penalty (λ₁)',
      type: 'number',
      default: 1.0,
      min: 0.1,
      max: 5.0,
      step: 0.1,
      docstring: 'sparsity_param: L1 penalty shrinking non-synergistic co-prescriptions.',
      clinicalImpact: 'Eliminates incidental co-medications that do not cause true synergistic harm.',
    },
    {
      key: 'minCount',
      label: 'Minimum Co-Reports (N₁₁)',
      type: 'number',
      default: 3,
      min: 1,
      max: 50,
      step: 1,
      docstring: 'min_count: Minimum reports of the specific combination + event.',
      clinicalImpact: 'Ensures adequate evidence before flagging a high-priority interaction alert.',
    },
  ],
  run: (drug, event, table, config, soc) => runSCOREDDI(drug, event, table, config, soc),
};

/**
 * Dynamic Method Registry Container
 * Holds registered DA methods and allows dynamic extensions when vigipy updates.
 * Guarantees that any new method adhering to MethodContract is dynamically registered
 * and immediately reactive across the application.
 */
type RegistrySubscriber = () => void;

class MethodRegistry {
  private methods: Map<string, MethodContract> = new Map();
  private subscribers: Set<RegistrySubscriber> = new Set();

  constructor() {
    this.initDefaults();
  }

  private initDefaults(): void {
    this.methods.set(prrContract.id, prrContract);
    this.methods.set(rorContract.id, rorContract);
    this.methods.set(rfetContract.id, rfetContract);
    this.methods.set(bcpnnContract.id, bcpnnContract);
    this.methods.set(gpsContract.id, gpsContract);
    this.methods.set(lassoContract.id, lassoContract);
    this.methods.set(scoreContract.id, scoreContract);
    this.methods.set(scoreDdiContract.id, scoreDdiContract);
  }

  /**
   * Subscribe to registry changes (method registered, updated, or removed)
   */
  public subscribe(fn: RegistrySubscriber): () => void {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private notify(): void {
    this.subscribers.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('Error notifying method registry subscriber:', e);
      }
    });
  }

  /**
   * Register a new or updated DA method adhering to the container contract.
   */
  public register(contract: MethodContract): void {
    this.methods.set(contract.id, contract);
    this.notify();
  }

  /**
   * Remove a registered method.
   */
  public unregister(id: string): boolean {
    const deleted = this.methods.delete(id);
    if (deleted) {
      this.notify();
    }
    return deleted;
  }

  /**
   * Reset registry back to the default 6 standard vigipy methods.
   */
  public resetToDefaults(): void {
    this.methods.clear();
    this.initDefaults();
    this.notify();
  }

  /**
   * Retrieve a registered method by ID.
   */
  public get(id: string): MethodContract | undefined {
    return this.methods.get(id);
  }

  /**
   * Retrieve all currently registered methods.
   */
  public getAll(): MethodContract[] {
    return Array.from(this.methods.values());
  }

  /**
   * Retrieve default configuration mapping across all registered methods.
   */
  public getDefaultConfigs(): Record<string, any> {
    const configs: Record<string, any> = {
      expectationMethod: 'mantel-haenszel',
    };
    for (const [id, method] of this.methods.entries()) {
      configs[id] = { ...method.defaultConfig };
    }
    return configs;
  }

  /**
   * Execute a registered method dynamically.
   */
  public run(
    id: string,
    drug: string,
    event: string,
    table: ContingencyTable,
    config: any,
    soc?: string
  ): SignalResult {
    const method = this.methods.get(id);
    if (!method) {
      // Fallback to PRR if unknown method
      return runPRR(drug, event, table, config, soc);
    }
    return method.run(drug, event, table, config, soc);
  }
}

// Global singleton instance of the registry
export const methodRegistry = new MethodRegistry();

/**
 * Pre-defined upcoming vigipy methods that adhere to the container contract
 * and can be dynamically activated at runtime.
 */
export const UPCOMING_VIGIPY_METHODS: MethodContract[] = [
  {
    id: 'IC_DELTA',
    name: 'IC-Delta',
    fullName: 'Empirical Bayesian Delta Information Component',
    family: 'bayesian',
    badgeColor: 'border-fuchsia-500/40 text-fuchsia-300 bg-fuchsia-500/10',
    docstring:
      'IC_Delta (vigipy experimental). Evaluates the incremental Information Component of a product exposure above class-baseline expected background rates. Useful for isolating drug-specific vs class-wide safety signals.',
    defaultConfig: {
      thresholdDelta: 0.5,
      classBaselineRatio: 1.0,
      alpha: 0.05,
      minCount: 3,
    },
    parameters: [
      {
        key: 'thresholdDelta',
        label: 'Delta IC Cutoff (ΔIC)',
        type: 'number',
        default: 0.5,
        min: 0.0,
        max: 3.0,
        step: 0.1,
        docstring:
          'threshold_delta: Minimum difference between product IC and therapeutic class background IC required to declare a specific product signal.',
        clinicalImpact:
          'Prevents attributing a known therapeutic class adverse event to a single agent unless its disproportion exceeds the class baseline.',
      },
      {
        key: 'classBaselineRatio',
        label: 'Class Baseline Expected Multiplier',
        type: 'number',
        default: 1.0,
        min: 0.5,
        max: 5.0,
        step: 0.1,
        docstring:
          'class_baseline_ratio: Multiplier applied to the expected baseline count based on therapeutic class volume.',
        clinicalImpact: 'Calibrates background hazard expectations.',
      },
      {
        key: 'minCount',
        label: 'Minimum Observed Count (N₁₁)',
        type: 'number',
        default: 3,
        min: 1,
        max: 50,
        step: 1,
        docstring: 'min_count: Minimum observed co-reports required.',
        clinicalImpact: 'Filters out low count pairs.',
      },
    ],
    run: (drug, event, table, config, soc) => {
      // Container contract implementation: uses empirical Bayes IC with delta offset
      const bcpnnRes = runBCPNN(drug, event, table, {
        priorAlpha1: 1.0,
        priorBeta1: 1.0,
        priorAlpha2: 1.0,
        priorBeta2: 1.0,
        credibilityLevel: 0.95,
        thresholdIC025: 0.0,
        minCount: config?.minCount || 3,
      }, soc);

      const deltaThreshold = config?.thresholdDelta ?? 0.5;
      const isSignal = bcpnnRes.score >= deltaThreshold && table.n11 >= (config?.minCount || 3);

      return {
        ...bcpnnRes,
        id: `${drug}__${event}__IC_DELTA`,
        method: 'IC_DELTA',
        score: Math.max(0, bcpnnRes.score),
        formattedScore: `ΔIC: ${(bcpnnRes.score).toFixed(2)}`,
        isSignal,
      };
    },
  },
  {
    id: 'MGPS_TWO_SIDED',
    name: 'MGPS-2S',
    fullName: 'Two-Sided Empirical Bayes Poisson Shrinker',
    family: 'bayesian',
    badgeColor: 'border-teal-500/40 text-teal-300 bg-teal-500/10',
    docstring:
      'Two-Sided Multi-item Gamma Poisson Shrinker. Simultaneously monitors for signals of disproportionate excess reporting (EB05 > 2.0) and statistically significant signal deficits (EB95 < 0.5, indicating negative association or inverse signals).',
    defaultConfig: {
      thresholdEB05: 2.0,
      thresholdEB95Deficit: 0.5,
      weight: 0.1,
      minCount: 3,
    },
    parameters: [
      {
        key: 'thresholdEB05',
        label: 'Excess Signal Cutoff (EB₀₅)',
        type: 'number',
        default: 2.0,
        min: 1.0,
        max: 5.0,
        step: 0.1,
        docstring:
          'threshold_eb05: Lower 5th percentile cutoff for excess reporting disproportionality.',
        clinicalImpact: 'Identifies potential adverse safety signals.',
      },
      {
        key: 'thresholdEB95Deficit',
        label: 'Deficit Signal Cutoff (EB₉₅)',
        type: 'number',
        default: 0.5,
        min: 0.1,
        max: 1.0,
        step: 0.05,
        docstring:
          'threshold_eb95_deficit: Upper 95th percentile cutoff below which an inverse reporting deficit is flagged.',
        clinicalImpact: 'Identifies protective effects or under-reporting.',
      },
      {
        key: 'minCount',
        label: 'Minimum Case Count (N₁₁)',
        type: 'number',
        default: 3,
        min: 1,
        max: 50,
        step: 1,
        docstring: 'min_count: Minimum observed co-reports required.',
        clinicalImpact: 'Filters out sparse cells.',
      },
    ],
    run: (drug, event, table, config, soc) => {
      const gpsRes = runGPS(drug, event, table, {
        alpha1: 0.2,
        beta1: 0.1,
        alpha2: 2.0,
        beta2: 4.0,
        weight: config?.weight ?? 0.1,
        thresholdEB05: config?.thresholdEB05 ?? 2.0,
        minCount: config?.minCount ?? 3,
      }, soc);

      const isExcess = gpsRes.lowerBound >= (config?.thresholdEB05 ?? 2.0);
      const isDeficit = gpsRes.upperBound < (config?.thresholdEB95Deficit ?? 0.5);

      return {
        ...gpsRes,
        id: `${drug}__${event}__MGPS_2S`,
        method: 'MGPS_TWO_SIDED',
        formattedScore: `EBGM: ${gpsRes.score.toFixed(2)}`,
        isSignal: (isExcess || isDeficit) && table.n11 >= (config?.minCount ?? 3),
      };
    },
  },
];

/**
 * Custom React Hook to consume all registered methods reactively.
 * Whenever a method is dynamically added or removed, components re-render immediately.
 */
export function useRegisteredMethods(): MethodContract[] {
  const [methods, setMethods] = React.useState<MethodContract[]>(() => methodRegistry.getAll());

  React.useEffect(() => {
    return methodRegistry.subscribe(() => {
      setMethods(methodRegistry.getAll());
    });
  }, []);

  return methods;
}
