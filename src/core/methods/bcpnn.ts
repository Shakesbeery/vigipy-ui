/**
 * Bayesian Confidence Propagation Neural Network (BCPNN)
 * Adapted from vigipy BCPNN implementation.
 *
 * Computes the Information Component (IC) and its 95% Credible Interval
 * [IC025, IC975]. WHO-UMC signal criterion requires IC025 > 0.
 */

import { BCPNNConfig, ContingencyTable, SignalResult } from '../../types/vigipy';
import { normalCdf, normalQuantile } from '../math_utils';

export function runBCPNN(
  drug: string,
  event: string,
  table: ContingencyTable,
  config: BCPNNConfig,
  soc?: string
): SignalResult {
  const { n11, n1dot, ndot1, ndotdot, expected } = table;

  // Informative prior parameters (defaults to 1.0 or user specified)
  const a1 = config.priorAlpha1 || 1.0;
  const b1 = config.priorBeta1 || 1.0;
  const a2 = config.priorAlpha2 || 1.0;
  const b2 = config.priorBeta2 || 1.0;

  // Information Component point estimate
  // IC = log2( (n11 + 0.5) / (expected + 0.5) )
  const observedAdj = n11 + 0.5;
  const expectedAdj = expected + 0.5;
  const ic = Math.log2(observedAdj / expectedAdj);

  // Variance approximation for IC according to Bate et al. & WHO UMC
  const ln2Sq = Math.pow(Math.LN2, 2);
  const term1 = 1.0 / (n11 + a1);
  const term2 = 1.0 / (n1dot + a1 + b1);
  const term3 = 1.0 / (ndot1 + a2 + b2);
  const v = (term1 + term2 + term3) / ln2Sq;
  const se = Math.sqrt(Math.max(1e-9, v));

  const z = normalQuantile(1 - (1 - config.credibilityLevel) / 2); // e.g. 1.96 for 95%
  const ic025 = ic - z * se;
  const ic975 = ic + z * se;

  // Approximate posterior probability of IC > 0: P(IC > 0)
  const postProbSignal = 1 - normalCdf(-ic / se);
  const pVal = 1 - postProbSignal;

  // WHO UMC Signal criterion: n11 >= minCount and IC025 > 0.0
  const isSignal = table.n11 >= config.minCount && ic025 > config.thresholdIC025;

  return {
    id: `${drug}__${event}__BCPNN`,
    drug,
    event,
    soc,
    method: 'BCPNN',
    score: ic,
    lowerBound: ic025,
    upperBound: ic975,
    pValue: pVal,
    isSignal,
    contingency: table,
    metricLabel: 'IC (95% Credible Interval)',
    formattedScore: ic.toFixed(2),
    formattedInterval: `[${ic025.toFixed(2)} - ${ic975.toFixed(2)}]`,
  };
}
