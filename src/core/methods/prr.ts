/**
 * Proportional Reporting Ratio (PRR) - Evans et al. (2001)
 * Adapted from vigipy PRR implementation.
 *
 * Frequentist log-normal approximation for confidence intervals,
 * Haldane-Anscombe continuity correction for zero-cells,
 * and Pearson / Yates Chi-square hypothesis testing.
 */

import { ContingencyTable, PRRConfig, SignalResult } from '../../types/vigipy';
import { chiSquarePValue, normalQuantile } from '../math_utils';

export function runPRR(
  drug: string,
  event: string,
  table: ContingencyTable,
  config: PRRConfig,
  soc?: string
): SignalResult {
  let { n11, n10, n01, n00, n1dot, ndot1, ndotdot, chiSquare, yatesChiSquare } = table;
  let corrected = false;

  // Zero-cell handling / Haldane-Anscombe continuity correction
  if (config.continuityCorrection && (n11 === 0 || n10 === 0 || n01 === 0 || n00 === 0)) {
    const cc = config.correctionValue || 0.5;
    n11 += cc;
    n10 += cc;
    n01 += cc;
    n00 += cc;
    n1dot = n11 + n10;
    ndot1 = n11 + n01;
    ndotdot = n11 + n10 + n01 + n00;
    corrected = true;
  }

  const n0dot = Math.max(1e-9, ndotdot - n1dot);

  // PRR point estimate:
  // Under 'binomial' model: (n11 / n1dot) / (n01 / n0dot) == n11 / E_binomial
  // Under other vigipy models (standard, poisson, negative-binomial, mantel-haenszel):
  // Evaluated directly against the model's conditioned expected baseline count E
  let prr: number;
  let v: number;

  if (config.expectationMethod && config.expectationMethod !== 'binomial' && table.expected > 0) {
    prr = n11 / Math.max(1e-6, table.expected);
    v = Math.max(0, 1 / Math.max(1e-9, n11) + 1 / Math.max(1e-9, table.expected) - 1 / Math.max(1e-9, n1dot));
  } else {
    const p1 = n11 / Math.max(1e-9, n1dot);
    const p0 = n01 / Math.max(1e-9, n0dot);
    prr = p0 > 0 ? p1 / p0 : 0;
    // Variance of ln(PRR) = 1/n11 - 1/n1dot + 1/n01 - 1/n0dot
    v = Math.max(0, 1 / Math.max(1e-9, n11) - 1 / Math.max(1e-9, n1dot) + 1 / Math.max(1e-9, n01) - 1 / Math.max(1e-9, n0dot));
  }
  const se = Math.sqrt(v);

  const z = normalQuantile(1 - config.alpha / 2);
  const logPRR = Math.log(Math.max(1e-9, prr));
  const lowerBound = Math.exp(logPRR - z * se);
  const upperBound = Math.exp(logPRR + z * se);

  // P-value from Chi-square statistic
  const pVal = chiSquarePValue(yatesChiSquare > 0 ? yatesChiSquare : chiSquare);

  // vigipy signal criteria for PRR:
  // n11 >= minCount, PRR >= thresholdPRR (usually 2.0), chiSquare >= thresholdChiSquare (usually 4.0)
  const isSignal = table.n11 >= config.minCount &&
                   prr >= config.thresholdPRR &&
                   (chiSquare >= config.thresholdChiSquare || yatesChiSquare >= config.thresholdChiSquare);

  return {
    id: `${drug}__${event}__PRR`,
    drug,
    event,
    soc,
    method: 'PRR',
    score: prr,
    lowerBound,
    upperBound,
    pValue: pVal,
    isSignal,
    contingency: { ...table, corrected },
    metricLabel: 'PRR (95% CI)',
    formattedScore: prr.toFixed(2),
    formattedInterval: `[${lowerBound.toFixed(2)} - ${upperBound.toFixed(2)}]`,
  };
}
