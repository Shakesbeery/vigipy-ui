/**
 * Reporting Fisher's Exact Test (RFET)
 * Adapted from vigipy RFET implementation.
 *
 * Provides exact hypergeometric p-values with mid-p adjustment
 * to alleviate conservative bias of discrete Fisher's test in pharmacovigilance.
 */

import { ContingencyTable, RFETConfig, SignalResult } from '../../types/vigipy';
import { fishersExactTest } from '../math_utils';

export function runRFET(
  drug: string,
  event: string,
  table: ContingencyTable,
  config: RFETConfig,
  soc?: string
): SignalResult {
  const { n11, n10, n01, n00 } = table;

  // Hypergeometric p-value with mid-p option
  const pVal = fishersExactTest(
    n11,
    n10,
    n01,
    n00,
    config.midP,
    config.alternative
  );

  // Exact odds ratio
  const denom = Math.max(1e-9, n10 * n01);
  const oddsRatio = denom > 0 ? (n11 * n00) / denom : 0;

  // Score represents the test significance (-log10 p-value or Odds Ratio)
  const isSignal = table.n11 >= config.minCount && pVal < config.thresholdPValue;

  return {
    id: `${drug}__${event}__RFET`,
    drug,
    event,
    soc,
    method: 'RFET',
    score: oddsRatio,
    lowerBound: pVal, // stores p-value in lowerBound for display
    upperBound: config.thresholdPValue,
    pValue: pVal,
    isSignal,
    contingency: table,
    metricLabel: `p-value (${config.midP ? 'Mid-p' : 'Standard'})`,
    formattedScore: oddsRatio.toFixed(2),
    formattedInterval: `p = ${pVal < 0.0001 ? pVal.toExponential(2) : pVal.toFixed(4)}`,
  };
}
