/**
 * Multi-item Gamma Poisson Shrinker (MGPS / GPS) - DuMouchel (1999)
 * Adapted from vigipy GPS implementation.
 *
 * Empirical Bayes shrinkage estimator using a 2-component Gamma mixture prior.
 * Produces EBGM (Empirical Bayes Geometric Mean) and EB05 (lower 5th percentile).
 * FDA criterion for a safety signal: EB05 >= 2.0.
 */

import { ContingencyTable, GPSConfig, SignalResult } from '../../types/vigipy';
import { logGamma } from '../math_utils';

// Negative Binomial log marginal likelihood term for a component
function logNegBinomial(o: number, e: number, alpha: number, beta: number): number {
  return (
    logGamma(alpha + o) -
    logGamma(alpha) -
    logGamma(o + 1) +
    alpha * Math.log(beta / (beta + e)) +
    o * Math.log(e / (beta + e))
  );
}

export function runGPS(
  drug: string,
  event: string,
  table: ContingencyTable,
  config: GPSConfig,
  soc?: string
): SignalResult {
  const o = table.n11;
  const e = Math.max(1e-6, table.expected);

  const { alpha1, beta1, alpha2, beta2, weight } = config;

  // Posterior weight calculation for mixture
  // log P(O | component 1) + log(w) vs log P(O | component 2) + log(1-w)
  const logL1 = logNegBinomial(o, e, alpha1, beta1) + Math.log(Math.max(1e-9, weight));
  const logL2 = logNegBinomial(o, e, alpha2, beta2) + Math.log(Math.max(1e-9, 1 - weight));

  const maxLogL = Math.max(logL1, logL2);
  const l1Norm = Math.exp(logL1 - maxLogL);
  const l2Norm = Math.exp(logL2 - maxLogL);
  const q1 = l1Norm / (l1Norm + l2Norm); // posterior weight for component 1
  const q2 = 1.0 - q1; // posterior weight for component 2

  // Posterior Gamma parameters
  const a1Post = alpha1 + o;
  const b1Post = beta1 + e;
  const mean1 = a1Post / b1Post;
  const var1 = a1Post / (b1Post * b1Post);

  const a2Post = alpha2 + o;
  const b2Post = beta2 + e;
  const mean2 = a2Post / b2Post;
  const var2 = a2Post / (b2Post * b2Post);

  // Posterior mixture mean and variance
  const postMean = q1 * mean1 + q2 * mean2;
  const postVar = q1 * (var1 + mean1 * mean1) + q2 * (var2 + mean2 * mean2) - (postMean * postMean);
  const postSD = Math.sqrt(Math.max(1e-9, postVar));

  // EBGM (Empirical Bayes Geometric Mean):
  // Close approximation using mean and variance on log scale
  const logMean = Math.log(Math.max(1e-6, postMean));
  const logSigma = Math.sqrt(Math.log(1 + (postVar / (postMean * postMean))));

  const ebgm = Math.exp(logMean - 0.5 * logSigma * logSigma);
  // EB05 is the 5th percentile (z = 1.645)
  const eb05 = Math.exp(Math.log(Math.max(1e-6, ebgm)) - 1.645 * logSigma);
  // EB95 is the 95th percentile
  const eb95 = Math.exp(Math.log(Math.max(1e-6, ebgm)) + 1.645 * logSigma);

  // FDA MGPS Signal criterion: EB05 >= thresholdEB05 (usually 2.0) and n11 >= minCount
  const isSignal = table.n11 >= config.minCount && eb05 >= config.thresholdEB05;

  return {
    id: `${drug}__${event}__GPS`,
    drug,
    event,
    soc,
    method: 'GPS',
    score: ebgm,
    lowerBound: eb05,
    upperBound: eb95,
    pValue: 1.0 - (eb05 >= 1.0 ? 0.95 : 0.5),
    isSignal,
    contingency: table,
    metricLabel: 'EBGM [EB05 - EB95]',
    formattedScore: ebgm.toFixed(2),
    formattedInterval: `[${eb05.toFixed(2)} - ${eb95.toFixed(2)}]`,
  };
}
