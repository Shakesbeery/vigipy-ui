/**
 * Reporting Odds Ratio (ROR) - van Puijenbroek et al. (2002)
 * Adapted from vigipy ROR implementation.
 *
 * Woolf log-odds approximation for standard error,
 * Haldane-Anscombe (+0.5) zero-cell continuity correction,
 * and Wald test for p-values.
 */

import { ContingencyTable, RORConfig, SignalResult } from '../../types/vigipy';
import { normalCdf, normalQuantile } from '../math_utils';

export function runROR(
  drug: string,
  event: string,
  table: ContingencyTable,
  config: RORConfig,
  soc?: string
): SignalResult {
  let { n11, n10, n01, n00 } = table;
  let corrected = false;

  // Haldane-Anscombe continuity correction for zero-cells or when enabled
  if (config.continuityCorrection && (n11 === 0 || n10 === 0 || n01 === 0 || n00 === 0)) {
    const cc = config.correctionValue || 0.5;
    n11 += cc;
    n10 += cc;
    n01 += cc;
    n00 += cc;
    corrected = true;
  }

  // Odds Ratio: (a * d) / (b * c)
  const num = n11 * n00;
  const denom = Math.max(1e-9, n10 * n01);
  const ror = denom > 0 ? num / denom : 0;

  // Woolf variance: 1/a + 1/b + 1/c + 1/d
  const v = (1 / Math.max(1e-9, n11)) +
            (1 / Math.max(1e-9, n10)) +
            (1 / Math.max(1e-9, n01)) +
            (1 / Math.max(1e-9, n00));
  const se = Math.sqrt(v);

  const z = normalQuantile(1 - config.alpha / 2);
  const logROR = Math.log(Math.max(1e-9, ror));
  const lowerBound = Math.exp(logROR - z * se);
  const upperBound = Math.exp(logROR + z * se);

  // Wald p-value: Z = ln(ROR) / SE
  const waldZ = se > 0 ? Math.abs(logROR) / se : 0;
  const pVal = 2 * (1 - normalCdf(waldZ));

  // vigipy signal criteria: n11 >= minCount and ROR_025 > thresholdLowerBound (typically 1.0)
  const isSignal = table.n11 >= config.minCount && lowerBound > config.thresholdLowerBound;

  return {
    id: `${drug}__${event}__ROR`,
    drug,
    event,
    soc,
    method: 'ROR',
    score: ror,
    lowerBound,
    upperBound,
    pValue: Math.min(1.0, Math.max(0.0, pVal)),
    isSignal,
    contingency: { ...table, corrected },
    metricLabel: 'ROR (95% CI)',
    formattedScore: ror.toFixed(2),
    formattedInterval: `[${lowerBound.toFixed(2)} - ${upperBound.toFixed(2)}]`,
  };
}
