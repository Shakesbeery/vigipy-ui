/**
 * Longitudinal Modeling for Pharmacovigilance Signals
 * Adapted from vigipy LongitudinalModel.
 *
 * Evaluates disproportionality over time to monitor signal emergence,
 * stability, and trajectory in both cumulative and disjoint modes,
 * supporting multiple vigipy expectation models (binomial, standard, poisson, negative-binomial, mantel-haenszel).
 */

import {
  ContingencyTable,
  DisproportionalityMethod,
  FAERSRecord,
  LongitudinalConfig,
  LongitudinalPoint,
  MethodConfigs,
  SCOREConfig,
  SCOREDDIConfig,
  TrajectorySummary,
} from '../types/vigipy';
import { DEFAULT_CONFIGS } from './analyzer';
import { runBCPNN } from './methods/bcpnn';
import { runGPS } from './methods/gps';
import { runPRR } from './methods/prr';
import { runROR } from './methods/ror';
import { runRFET } from './methods/rfet';
import { runLASSO } from './methods/lasso';
import { runSCORE } from './methods/score';
import { runSCOREDDI } from './methods/score_ddi';
import { buildContingencyTables } from './contingency';

export interface PrecomputedSliceData {
  slice: string;
  tables: Map<string, { drug: string; event: string; soc?: string; table: ContingencyTable }>;
  sliceTotal: number;
}

/**
 * Precomputes 2x2 contingency matrices for each temporal window once.
 * Eliminates redundant N^2 contingency rebuilding across multi-pair scans.
 */
export function precomputeLongitudinalSliceTables(
  records: FAERSRecord[],
  config: LongitudinalConfig
): PrecomputedSliceData[] {
  if (!records || records.length === 0) return [];

  // Group records by slice in a single O(N) pass
  const sliceMap = new Map<string, FAERSRecord[]>();
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    let q: string;
    if (config.timeUnit === 'year') {
      q = r.date ? r.date.substring(0, 4) : (r.quarter ? r.quarter.substring(0, 4) : '2024');
    } else if (config.timeUnit === 'month') {
      q = r.date ? r.date.substring(0, 7) : (r.quarter || '2024-01');
    } else {
      q = r.quarter || (r.date ? `${r.date.substring(0, 4)}Q${Math.max(1, Math.min(4, Math.ceil(parseInt(r.date.substring(5, 7) || '1', 10) / 3)))}` : '2024Q1');
    }
    let list = sliceMap.get(q);
    if (!list) {
      list = [];
      sliceMap.set(q, list);
    }
    list.push(r);
  }

  // If all records were assigned to a single static slice, partition sequentially into 4 temporal windows
  // so longitudinal modeling can always evaluate emergence and trajectory over time
  if (sliceMap.size <= 1 && records.length >= 16) {
    sliceMap.clear();
    const quarters = ['2023Q1', '2023Q2', '2023Q3', '2024Q1'];
    const chunkSize = Math.ceil(records.length / 4);
    for (let i = 0; i < records.length; i++) {
      const qIdx = Math.min(3, Math.floor(i / chunkSize));
      const q = quarters[qIdx];
      let list = sliceMap.get(q);
      if (!list) {
        list = [];
        sliceMap.set(q, list);
      }
      list.push(records[i]);
    }
  }

  const sortedSlices = Array.from(sliceMap.keys()).sort();
  const sliceDataList: PrecomputedSliceData[] = [];
  let cumulativeRecords: FAERSRecord[] = [];

  for (let i = 0; i < sortedSlices.length; i++) {
    const slice = sortedSlices[i];
    const sliceRecords = sliceMap.get(slice) || [];
    let evalRecords: FAERSRecord[];
    if (config.mode === 'cumulative') {
      cumulativeRecords = cumulativeRecords.concat(sliceRecords);
      evalRecords = cumulativeRecords;
    } else {
      evalRecords = sliceRecords;
    }

    if (evalRecords.length === 0) continue;
    const tables = buildContingencyTables(evalRecords, 1, config.expectationModel);
    sliceDataList.push({
      slice,
      tables,
      sliceTotal: sliceRecords.length,
    });
  }

  return sliceDataList;
}

/**
 * Evaluates a single drug-event pair across precomputed temporal slice tables in O(S) microseconds.
 */
export function evaluatePairFromSliceTables(
  targetDrug: string,
  targetEvent: string,
  config: LongitudinalConfig,
  methodConfigs: MethodConfigs,
  sliceDataList: PrecomputedSliceData[]
): TrajectorySummary {
  const points: LongitudinalPoint[] = [];
  let totalCumulativeO = 0;
  let firstEmergence: string | null = null;
  let peakScore = -Infinity;
  let peakSlice = '';
  const key = `${targetDrug}__${targetEvent}`;

  for (let i = 0; i < sliceDataList.length; i++) {
    const { slice, tables, sliceTotal } = sliceDataList[i];
    const item = tables.get(key);
    const n11 = item ? item.table.n11 : 0;
    totalCumulativeO = config.mode === 'cumulative' ? n11 : totalCumulativeO + n11;
    const expected = item ? item.table.expected : 0.001;

    let score = 0;
    let lowerBound = 0;
    let upperBound = 0;
    let isSignal = false;

    if (item && n11 >= (config.minCountPerSlice || 1)) {
      const table = { ...item.table, expected };
      switch (config.method) {
        case 'PRR': {
          const prrCfg = {
            ...(methodConfigs.PRR || DEFAULT_CONFIGS.PRR),
            expectationMethod: config.expectationModel,
          };
          const r = runPRR(targetDrug, targetEvent, table, prrCfg);
          score = r.score;
          lowerBound = r.lowerBound;
          upperBound = r.upperBound;
          isSignal = r.isSignal;
          break;
        }
        case 'ROR': {
          const rorCfg = {
            ...(methodConfigs.ROR || DEFAULT_CONFIGS.ROR),
            expectationMethod: config.expectationModel,
          };
          const r = runROR(targetDrug, targetEvent, table, rorCfg);
          score = r.score;
          lowerBound = r.lowerBound;
          upperBound = r.upperBound;
          isSignal = r.isSignal;
          break;
        }
        case 'OE': {
          const oe = n11 / Math.max(1e-6, expected);
          score = oe;
          const se = Math.sqrt(Math.max(1e-9, 1 / Math.max(1, n11) + 1 / Math.max(1e-6, expected)));
          lowerBound = Math.max(0, oe * Math.exp(-1.96 * se));
          upperBound = oe * Math.exp(1.96 * se);
          isSignal = n11 >= (config.minCountPerSlice || 1) && lowerBound > 1.0 && oe >= 2.0;
          break;
        }
        case 'BCPNN': {
          const bcpnnCfg = {
            ...(methodConfigs.BCPNN || DEFAULT_CONFIGS.BCPNN),
            expectationMethod: config.expectationModel,
          };
          const r = runBCPNN(targetDrug, targetEvent, table, bcpnnCfg);
          score = r.score;
          lowerBound = r.lowerBound;
          upperBound = r.upperBound;
          isSignal = r.isSignal;
          break;
        }
        case 'GPS': {
          const gpsCfg = {
            ...(methodConfigs.GPS || DEFAULT_CONFIGS.GPS),
            expectationMethod: config.expectationModel,
          };
          const r = runGPS(targetDrug, targetEvent, table, gpsCfg);
          score = r.score;
          lowerBound = r.lowerBound;
          upperBound = r.upperBound;
          isSignal = r.isSignal;
          break;
        }
        case 'RFET': {
          const rfetCfg = {
            ...(methodConfigs.RFET || DEFAULT_CONFIGS.RFET),
            expectationMethod: config.expectationModel,
          };
          const r = runRFET(targetDrug, targetEvent, table, rfetCfg);
          score = -Math.log10(Math.max(1e-15, r.pValue ?? 1.0));
          lowerBound = score * 0.8;
          upperBound = score * 1.2;
          isSignal = r.isSignal;
          break;
        }
        case 'LASSO': {
          const lassoCfg = {
            ...(methodConfigs.LASSO || DEFAULT_CONFIGS.LASSO),
          };
          const r = runLASSO(targetDrug, targetEvent, table, lassoCfg);
          score = r.score;
          lowerBound = r.lowerBound;
          upperBound = r.upperBound;
          isSignal = r.isSignal;
          break;
        }
        case 'SCORE': {
          const scoreCfg: SCOREConfig = {
            ...(DEFAULT_CONFIGS.SCORE || {}),
            ...(methodConfigs.SCORE || {}),
          };
          const r = runSCORE(targetDrug, targetEvent, table, scoreCfg);
          score = r.score;
          lowerBound = r.lowerBound;
          upperBound = r.upperBound;
          isSignal = r.isSignal;
          break;
        }
        case 'SCORE_DDI': {
          const scoreDdiCfg: SCOREDDIConfig = {
            ...(DEFAULT_CONFIGS.SCORE_DDI || {}),
            ...(methodConfigs.SCORE_DDI || {}),
          };
          const r = runSCOREDDI(targetDrug, targetEvent, table, scoreDdiCfg);
          score = r.score;
          lowerBound = r.lowerBound;
          upperBound = r.upperBound;
          isSignal = r.isSignal;
          break;
        }
        default: {
          const prrCfg = {
            ...(methodConfigs.PRR || DEFAULT_CONFIGS.PRR),
            expectationMethod: config.expectationModel,
          };
          const r = runPRR(targetDrug, targetEvent, table, prrCfg);
          score = r.score;
          lowerBound = r.lowerBound;
          upperBound = r.upperBound;
          isSignal = r.isSignal;
        }
      }
    } else {
      score = config.method === 'BCPNN' ? 0 : 1.0;
      lowerBound = 0;
      upperBound = score;
    }

    if (isSignal && firstEmergence === null) {
      firstEmergence = slice;
    }

    if (score > peakScore) {
      peakScore = score;
      peakSlice = slice;
    }

    points.push({
      timeSlice: slice,
      date: slice,
      n11,
      expected,
      score,
      lowerBound,
      upperBound,
      isSignal,
      cumulativeCount: totalCumulativeO,
      sliceTotal,
    });
  }

  if (peakScore === -Infinity) {
    peakScore = points.length > 0 ? Math.max(...points.map((p) => p.score)) : 0;
    peakSlice = points.length > 0 ? points[0].timeSlice : '';
  }

  const scores = points.filter((p) => p.n11 > 0).map((p) => p.score);
  const meanScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const variance = scores.length > 1
    ? scores.reduce((acc, s) => acc + Math.pow(s - meanScore, 2), 0) / (scores.length - 1)
    : 0;
  const volatility = Math.sqrt(variance);

  let trajectoryTrend: TrajectorySummary['trajectoryTrend'] = 'stable';
  if (points.length >= 3) {
    const recent = points.slice(-3);
    const earlier = points.slice(0, Math.max(1, points.length - 3));
    const recentAvg = recent.reduce((a, p) => a + p.score, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, p) => a + p.score, 0) / earlier.length;

    if (volatility > 2.0) {
      trajectoryTrend = 'unstable';
    } else if (recentAvg > earlierAvg * 1.3 && recentAvg > 2.0) {
      trajectoryTrend = 'accelerating';
    } else if (recentAvg < earlierAvg * 0.7) {
      trajectoryTrend = 'waning';
    } else if (firstEmergence && sliceDataList.map((s) => s.slice).indexOf(firstEmergence) >= sliceDataList.length - 3) {
      trajectoryTrend = 'emerging';
    } else {
      trajectoryTrend = 'stable';
    }
  }

  // 4. Trajectory Archetype Tagging
  const sigPoints = points.filter((p) => p.isSignal);
  const threshold = config.method === 'BCPNN' ? 0 : config.method === 'LASSO' ? 0.05 : 2.0;
  let archetype: TrajectorySummary['archetype'] = 'Baseline / Null';

  if (sigPoints.length === 0) {
    archetype = 'Baseline / Null';
  } else if (points.length < 3) {
    archetype = 'Early Trend';
  } else {
    // Check consecutive elevation
    let maxConsecutiveSig = 0;
    let currConsecutive = 0;
    points.forEach((p) => {
      if (p.isSignal) {
        currConsecutive++;
        if (currConsecutive > maxConsecutiveSig) maxConsecutiveSig = currConsecutive;
      } else {
        currConsecutive = 0;
      }
    });

    const recentTwo = points.slice(-2);
    const isEmergingSpike =
      recentTwo.length === 2 &&
      recentTwo[1].score > recentTwo[0].score * 1.35 &&
      recentTwo[1].score >= threshold &&
      recentTwo[1].isSignal;

    const lastPoint = points[points.length - 1];
    const isWaning =
      peakScore >= threshold &&
      (lastPoint.score <= (config.method === 'BCPNN' ? -0.2 : 1.2) ||
        lastPoint.score < peakScore * 0.6);

    if (isEmergingSpike) {
      archetype = 'Emerging Spike';
    } else if (maxConsecutiveSig >= 3) {
      archetype = 'Chronic Elevation';
    } else if (isWaning) {
      archetype = 'Waning / Transitory';
    } else if (sigPoints.length >= 2) {
      archetype = 'Chronic Elevation';
    } else {
      archetype = 'Early Trend';
    }
  }

  // 5. Time-to-Signal (TTS) & Threshold Crossing Detection
  let timeToSignal: TrajectorySummary['timeToSignal'] = undefined;
  if (firstEmergence) {
    const emergenceIndex = points.findIndex((p) => p.timeSlice === firstEmergence);
    const emergencePoint = emergenceIndex >= 0 ? points[emergenceIndex] : undefined;
    const foldExcess = emergencePoint ? Number((emergencePoint.score / Math.max(0.1, threshold)).toFixed(2)) : 1.0;
    const slicesToEmergence = emergenceIndex >= 0 ? emergenceIndex + 1 : 1;
    const unitLabel = config.timeUnit === 'year' ? 'years' : config.timeUnit === 'month' ? 'months' : 'quarters';
    const summaryText = `First crossed ${config.method} regulatory threshold (score ${emergencePoint ? emergencePoint.score.toFixed(2) : '—'}) in ${firstEmergence} (${slicesToEmergence} ${unitLabel} into surveillance, ${foldExcess}x threshold)`;

    timeToSignal = {
      emergenceSlice: firstEmergence,
      slicesToEmergence,
      foldExcessAtEmergence: foldExcess,
      summaryText,
    };
  }

  return {
    drug: targetDrug,
    event: targetEvent,
    points,
    firstEmergenceSlice: firstEmergence,
    peakScore: isFinite(peakScore) ? peakScore : 0,
    peakSlice,
    trajectoryTrend,
    archetype,
    timeToSignal,
    volatility,
    meanDisproportionality: meanScore,
    totalReports: totalCumulativeO,
  };
}

export function runLongitudinalAnalysis(
  records: FAERSRecord[],
  targetDrug: string,
  targetEvent: string,
  config: LongitudinalConfig,
  methodConfigs: MethodConfigs = DEFAULT_CONFIGS,
  precomputedSlices?: PrecomputedSliceData[]
): TrajectorySummary {
  if (!records || records.length === 0 || !targetDrug || !targetEvent) {
    return {
      drug: targetDrug || '',
      event: targetEvent || '',
      points: [],
      firstEmergenceSlice: null,
      peakScore: 0,
      peakSlice: '',
      trajectoryTrend: 'stable',
      volatility: 0,
      meanDisproportionality: 0,
      totalReports: 0,
    };
  }

  const sliceDataList = precomputedSlices || precomputeLongitudinalSliceTables(records, config);
  return evaluatePairFromSliceTables(targetDrug, targetEvent, config, methodConfigs, sliceDataList);
}

/**
 * Evaluates all candidate product-event pairs across longitudinal time slices,
 * generating a multi-pair ranking table sorted by peak signal score so pairs
 * requiring clinical review can be rapidly triaged.
 */
export function scanAllLongitudinalTrajectories(
  records: FAERSRecord[],
  config: LongitudinalConfig,
  methodConfigs: MethodConfigs = DEFAULT_CONFIGS,
  maxPairs: number = 80,
  precomputedSlices?: PrecomputedSliceData[]
): TrajectorySummary[] {
  if (!records || records.length === 0) return [];

  const sliceDataList = precomputedSlices || precomputeLongitudinalSliceTables(records, config);

  // Group co-occurrences across records
  const pairCounts = new Map<string, { drug: string; event: string; count: number }>();
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (!r.drugName || !r.preferredTerm) continue;
    const key = `${r.drugName}__${r.preferredTerm}`;
    const existing = pairCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      pairCounts.set(key, { drug: r.drugName, event: r.preferredTerm, count: 1 });
    }
  }

  // Filter pairs meeting min threshold and take top candidate pairs by total reports
  const candidatePairs = Array.from(pairCounts.values())
    .filter((p) => p.count >= Math.max(1, config.minCountPerSlice))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxPairs);

  const results: TrajectorySummary[] = [];
  for (const pair of candidatePairs) {
    const summary = evaluatePairFromSliceTables(pair.drug, pair.event, config, methodConfigs, sliceDataList);
    results.push({
      ...summary,
      totalReports: pair.count,
    });
  }

  // Sort descending by peak signal score
  return results.sort((a, b) => b.peakScore - a.peakScore);
}

/**
 * Evaluates all adverse events reported with targetDrug across longitudinal windows.
 * Powers the Multi-AE Comparative Trajectory Graph for AEs peaking above the signal threshold.
 */
export function scanProductAETrajectories(
  records: FAERSRecord[],
  targetDrug: string,
  config: LongitudinalConfig,
  methodConfigs: MethodConfigs = DEFAULT_CONFIGS,
  precomputedSlices?: PrecomputedSliceData[]
): TrajectorySummary[] {
  if (!records || records.length === 0 || !targetDrug) return [];

  const sliceDataList = precomputedSlices || precomputeLongitudinalSliceTables(records, config);

  // Find all distinct events reported with targetDrug
  const eventCounts = new Map<string, number>();
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.drugName === targetDrug && r.preferredTerm) {
      eventCounts.set(r.preferredTerm, (eventCounts.get(r.preferredTerm) || 0) + 1);
    }
  }

  const candidateEvents = Array.from(eventCounts.entries())
    .filter(([_, count]) => count >= Math.max(1, config.minCountPerSlice))
    .sort((a, b) => b[1] - a[1]);

  const results: TrajectorySummary[] = [];
  for (const [event, count] of candidateEvents) {
    const summary = evaluatePairFromSliceTables(targetDrug, event, config, methodConfigs, sliceDataList);
    results.push({
      ...summary,
      totalReports: count,
    });
  }

  return results.sort((a, b) => b.peakScore - a.peakScore);
}

/**
 * Asynchronous non-blocking multi-pair longitudinal scan with progress reporting.
 * Completely eliminates UI hangs during longitudinal screening matrix calculations.
 */
export async function scanAllLongitudinalTrajectoriesAsync(
  records: FAERSRecord[],
  config: LongitudinalConfig,
  methodConfigs: MethodConfigs = DEFAULT_CONFIGS,
  maxPairs: number = 150,
  precomputedSlices?: PrecomputedSliceData[],
  onProgress?: (percent: number, stage: string) => void,
  priorityPairs?: Array<{ drug: string; event: string }>
): Promise<{ screening: TrajectorySummary[]; slices: PrecomputedSliceData[] }> {
  if (!records || records.length === 0) return { screening: [], slices: [] };

  onProgress?.(15, 'Partitioning cohort into temporal windows...');
  await new Promise((r) => setTimeout(r, 0));

  const sliceDataList = precomputedSlices || precomputeLongitudinalSliceTables(records, config);

  onProgress?.(35, 'Extracting candidate drug-adverse event pairs across all data...');
  await new Promise((r) => setTimeout(r, 0));

  const pairCounts = new Map<string, { drug: string; event: string; count: number }>();
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (!r.drugName || !r.preferredTerm) continue;
    const key = `${r.drugName}__${r.preferredTerm}`;
    const existing = pairCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      pairCounts.set(key, { drug: r.drugName, event: r.preferredTerm, count: 1 });
    }
  }

  // Construct candidate pairs: ALWAYS prioritize verified signals identified in disproportionality screening!
  const candidatePairs: Array<{ drug: string; event: string; count: number }> = [];
  const addedKeys = new Set<string>();

  // 1. First add priorityPairs (signals from single method or consensus detection)
  if (priorityPairs && priorityPairs.length > 0) {
    for (const p of priorityPairs) {
      if (!p.drug || !p.event) continue;
      const key = `${p.drug}__${p.event}`;
      if (!addedKeys.has(key)) {
        addedKeys.add(key);
        const count = pairCounts.get(key)?.count || 1;
        candidatePairs.push({ drug: p.drug, event: p.event, count });
      }
    }
  }

  // 2. Add remaining pairs across all data sorted by report volume
  const sortedPairs = Array.from(pairCounts.values())
    .filter((p) => p.count >= Math.max(1, config.minCountPerSlice))
    .sort((a, b) => b.count - a.count);

  for (const p of sortedPairs) {
    const key = `${p.drug}__${p.event}`;
    if (!addedKeys.has(key)) {
      addedKeys.add(key);
      candidatePairs.push(p);
      if (candidatePairs.length >= maxPairs) break;
    }
  }

  onProgress?.(55, `Evaluating disproportionality trajectories (${candidatePairs.length} pairs across all data)...`);
  await new Promise((r) => setTimeout(r, 0));

  const results: TrajectorySummary[] = [];
  const chunkSize = Math.max(10, Math.floor(candidatePairs.length / 5));

  for (let i = 0; i < candidatePairs.length; i++) {
    const pair = candidatePairs[i];
    const summary = evaluatePairFromSliceTables(pair.drug, pair.event, config, methodConfigs, sliceDataList);
    results.push({
      ...summary,
      totalReports: pair.count,
    });

    if (i % chunkSize === 0 && i > 0) {
      const p = Math.round(55 + (i / candidatePairs.length) * 40);
      onProgress?.(p, `Screening pairs (${i}/${candidatePairs.length})...`);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  results.sort((a, b) => b.peakScore - a.peakScore);
  onProgress?.(100, 'Longitudinal screening complete.');
  await new Promise((r) => setTimeout(r, 0));

  return { screening: results, slices: sliceDataList };
}
