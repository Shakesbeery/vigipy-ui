/**
 * LASSO (L1-penalized multivariate regression) for Pharmacovigilance
 * Adapted from vigipy LASSO implementation.
 *
 * Adjusts for polypharmacy, co-prescriptions, and confounding by indication
 * by fitting multiple drug predictors simultaneously with L1 sparsity.
 */

import { ContingencyTable, FAERSRecord, LASSOConfig, SignalResult } from '../../types/vigipy';

// Soft thresholding operator: sign(z) * max(0, |z| - lambda)
function softThreshold(z: number, lambda: number): number {
  if (z > lambda) return z - lambda;
  if (z < -lambda) return z + lambda;
  return 0;
}

/**
 * Fit coordinate descent LASSO for target adverse events across all candidate drugs.
 * Returns coefficients for each drug predicting the target event.
 */
export function runMultivariateLASSO(
  records: FAERSRecord[],
  targetEvent: string,
  config: LASSOConfig
): Map<string, number> {
  const coefficients = new Map<string, number>();

  // 1. Group by caseId
  const cases = new Map<string, { drugs: Set<string>; hasEvent: boolean }>();
  const allDrugs = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    let c = cases.get(r.caseId);
    if (!c) {
      c = { drugs: new Set<string>(), hasEvent: false };
      cases.set(r.caseId, c);
    }
    c.drugs.add(r.drugName);
    allDrugs.add(r.drugName);
    if (r.preferredTerm === targetEvent) {
      c.hasEvent = true;
    }
  }

  const nSamples = cases.size;
  const drugList = Array.from(allDrugs);
  const nFeatures = drugList.length;
  if (nSamples === 0 || nFeatures === 0) return coefficients;

  // Build binary response Y and design matrix column stats
  const Y = new Float64Array(nSamples);
  let caseIdx = 0;
  for (const [_, c] of cases.entries()) {
    Y[caseIdx++] = c.hasEvent ? 1.0 : 0.0;
  }

  // Precompute column norms and inner products
  const drugIndices = new Map<string, number>();
  drugList.forEach((d, idx) => drugIndices.set(d, idx));

  // Build sparse indicator per sample
  const sampleDrugs: number[][] = [];
  for (const [_, c] of cases.entries()) {
    const indices: number[] = [];
    for (const d of c.drugs) {
      const idx = drugIndices.get(d);
      if (idx !== undefined) indices.push(idx);
    }
    sampleDrugs.push(indices);
  }

  // Column norms: sum(X_j^2) = count of occurrences of drug j
  const colNorms = new Float64Array(nFeatures);
  for (let i = 0; i < nSamples; i++) {
    for (const dIdx of sampleDrugs[i]) {
      colNorms[dIdx] += 1.0;
    }
  }

  // Coordinate descent optimization
  const beta = new Float64Array(nFeatures);
  const residuals = new Float64Array(nSamples);
  let intercept = 0;

  // Mean of Y for intercept
  let sumY = 0;
  for (let i = 0; i < nSamples; i++) sumY += Y[i];
  intercept = sumY / nSamples;
  for (let i = 0; i < nSamples; i++) residuals[i] = Y[i] - intercept;

  const lambda = config.alpha;
  const maxIter = config.maxIter || 60;
  const tol = config.tolerance || 1e-4;

  for (let iter = 0; iter < maxIter; iter++) {
    let maxChange = 0;

    for (let j = 0; j < nFeatures; j++) {
      const normJ = colNorms[j];
      if (normJ === 0) continue;

      const oldBetaJ = beta[j];

      // Compute rho_j = sum_{i: X_ij=1} (residuals[i] + oldBetaJ)
      let rho_j = 0;
      for (let i = 0; i < nSamples; i++) {
        if (sampleDrugs[i].includes(j)) {
          rho_j += residuals[i] + oldBetaJ;
        }
      }

      // Soft thresholding update
      const newBetaJ = softThreshold(rho_j, lambda * nSamples) / normJ;
      const delta = newBetaJ - oldBetaJ;

      if (Math.abs(delta) > 1e-12) {
        beta[j] = newBetaJ;
        maxChange = Math.max(maxChange, Math.abs(delta));

        // Update residuals: r_i = r_i - delta * X_ij
        for (let i = 0; i < nSamples; i++) {
          if (sampleDrugs[i].includes(j)) {
            residuals[i] -= delta;
          }
        }
      }
    }

    if (maxChange < tol) break;
  }

  for (let j = 0; j < nFeatures; j++) {
    coefficients.set(drugList[j], beta[j]);
  }

  return coefficients;
}

/**
 * Standard single-pair representation for LASSO in vigipy analyze()
 */
export function runLASSO(
  drug: string,
  event: string,
  table: ContingencyTable,
  config: LASSOConfig,
  multivariateCoef?: number,
  soc?: string
): SignalResult {
  // If multivariate coefficient was already computed, use it; otherwise compute regularized log-odds estimate
  let coef = multivariateCoef;
  if (coef === undefined) {
    // Univariate penalization approx
    const o = table.n11;
    const e = Math.max(1e-6, table.expected);
    const rawLogOdds = Math.log(Math.max(1e-6, (o + 0.5) / (e + 0.5)));
    coef = softThreshold(rawLogOdds, config.alpha);
  }

  // vigipy signal criteria: positive non-zero coefficient above threshold and n11 >= minCount
  const isSignal = table.n11 >= config.minCount && coef > config.thresholdCoef;

  return {
    id: `${drug}__${event}__LASSO`,
    drug,
    event,
    soc,
    method: 'LASSO',
    score: coef,
    lowerBound: Math.max(0, coef - 0.1),
    upperBound: coef + 0.1,
    pValue: coef > 0 ? Math.exp(-coef * 3) : 1.0,
    isSignal,
    contingency: table,
    metricLabel: 'LASSO Coef (L1 regularized)',
    formattedScore: coef.toFixed(3),
    formattedInterval: coef > 0 ? `Beta = +${coef.toFixed(3)}` : 'Beta = 0.0 (shrunk)',
  };
}
