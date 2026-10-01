/**
 * Unified vigipy Analyzer interface:
 * Provides `analyze()` and `analyze_all()` matching vigipy's API.
 * Supports typed execution through configuration dataclasses,
 * multi-method consensus scoring, and False Discovery Rate adjustment.
 */

import {
  AgreementTier,
  ConsensusSignal,
  ContingencyTable,
  DisproportionalityMethod,
  FAERSRecord,
  MethodConfigs,
  MethodConcordanceMatrix,
  SignalResult,
} from '../types/vigipy';
import { enrichSignalResultsWithErrorMetrics } from './methods/bayesian_decision';
import { buildContingencyTables } from './contingency';
import { methodRegistry } from './method_registry';

export const DEFAULT_CONFIGS: MethodConfigs = methodRegistry.getDefaultConfigs() as MethodConfigs;

/**
 * Compute pairwise concordance analytics across active disproportionality methods:
 * - Jaccard similarity coefficient: |A ∩ B| / |A ∪ B|
 * - Cohen's Kappa inter-rater agreement: (p_o - p_e) / (1 - p_e)
 * - 2x2 contingency matrix of signal declaration overlaps
 */
export function computeConcordanceMatrix(
  methods: DisproportionalityMethod[],
  methodResults: Record<DisproportionalityMethod, SignalResult[]>,
  totalEvaluatedPairs: number
): MethodConcordanceMatrix {
  const jaccard: Record<string, Record<string, number>> = {};
  const cohenKappa: Record<string, Record<string, number>> = {};
  const overlapCounts: Record<string, Record<string, { both: number; m1Only: number; m2Only: number; neither: number }>> = {};

  // Build quick map of signal flags per pair per method
  const signalMapByMethod: Record<string, Set<string>> = {};
  methods.forEach((m) => {
    signalMapByMethod[m] = new Set<string>();
    const results = methodResults[m] || [];
    results.forEach((r) => {
      if (r.isSignal) {
        signalMapByMethod[m].add(`${r.drug}__${r.event}`);
      }
    });
  });

  const N = Math.max(1, totalEvaluatedPairs);

  for (const m1 of methods) {
    jaccard[m1] = {};
    cohenKappa[m1] = {};
    overlapCounts[m1] = {};

    for (const m2 of methods) {
      if (m1 === m2) {
        jaccard[m1][m2] = 1.0;
        cohenKappa[m1][m2] = 1.0;
        const count = signalMapByMethod[m1].size;
        overlapCounts[m1][m2] = { both: count, m1Only: 0, m2Only: 0, neither: N - count };
        continue;
      }

      const s1 = signalMapByMethod[m1];
      const s2 = signalMapByMethod[m2];

      let both = 0;
      let m1Only = 0;
      let m2Only = 0;

      s1.forEach((pairKey) => {
        if (s2.has(pairKey)) {
          both++;
        } else {
          m1Only++;
        }
      });

      s2.forEach((pairKey) => {
        if (!s1.has(pairKey)) {
          m2Only++;
        }
      });

      const neither = Math.max(0, N - (both + m1Only + m2Only));
      overlapCounts[m1][m2] = { both, m1Only, m2Only, neither };

      // Jaccard similarity
      const unionCount = both + m1Only + m2Only;
      jaccard[m1][m2] = unionCount > 0 ? Number((both / unionCount).toFixed(3)) : 1.0;

      // Cohen's Kappa
      const po = (both + neither) / N;
      const pYes = ((both + m1Only) / N) * ((both + m2Only) / N);
      const pNo = ((m2Only + neither) / N) * ((m1Only + neither) / N);
      const pe = pYes + pNo;

      if (pe >= 1.0) {
        cohenKappa[m1][m2] = 1.0;
      } else {
        const kappa = (po - pe) / (1.0 - pe);
        cohenKappa[m1][m2] = Number(Math.max(-1.0, Math.min(1.0, kappa)).toFixed(3));
      }
    }
  }

  return {
    methods,
    jaccard,
    cohenKappa,
    overlapCounts,
  };
}

/**
 * Run a single disproportionality method dynamically via the MethodRegistry
 */
export function analyze(
  records: FAERSRecord[],
  method: DisproportionalityMethod,
  config: any = DEFAULT_CONFIGS[method] || methodRegistry.get(method)?.defaultConfig
): SignalResult[] {
  const minCount = config?.minCount || 1;
  const expMethod = config?.expectationMethod || DEFAULT_CONFIGS.expectationMethod || 'binomial';
  const tables = buildContingencyTables(records, minCount, expMethod);
  const rawResults: SignalResult[] = [];

  for (const [_, item] of tables.entries()) {
    const { drug, event, soc, table } = item;
    const res = methodRegistry.run(method, drug, event, table, config, soc);
    rawResults.push(res);
  }

  // Sort by score descending
  rawResults.sort((a, b) => b.score - a.score);

  // Enrich with False Discovery Rate and decision error metrics
  return enrichSignalResultsWithErrorMetrics(rawResults);
}

/**
 * Run all disproportionality methods simultaneously: analyze_all(data, configs)
 * Matches vigipy's multi-method analysis and calculates consensus scoring dynamically.
 */
export function analyze_all(
  records: FAERSRecord[],
  configs: MethodConfigs = DEFAULT_CONFIGS,
  activeMethods?: DisproportionalityMethod[]
): {
  consensusSignals: ConsensusSignal[];
  methodResults: Record<DisproportionalityMethod, SignalResult[]>;
  tables: Map<string, { drug: string; event: string; soc?: string; table: ContingencyTable }>;
  concordance: MethodConcordanceMatrix;
  agreementTierBreakdown: Record<AgreementTier, number>;
} {
  const methods = activeMethods || methodRegistry.getAll().map((m) => m.id as DisproportionalityMethod);
  const minCount = Math.min(...methods.map((m) => configs[m]?.minCount || 3));
  const expMethod = configs.expectationMethod || configs.PRR?.expectationMethod || configs.BCPNN?.expectationMethod || 'binomial';
  const tables = buildContingencyTables(records, minCount, expMethod);

  const methodResults = {} as Record<DisproportionalityMethod, SignalResult[]>;
  methods.forEach((m) => {
    methodResults[m] = [];
  });

  const consensusMap = new Map<string, ConsensusSignal>();

  for (const [key, item] of tables.entries()) {
    const { drug, event, soc, table } = item;

    const cSignal: ConsensusSignal = {
      id: key,
      drug,
      event,
      soc,
      contingency: table,
      methodResults: {},
      signalCount: 0,
      totalMethods: methods.length,
      consensusScore: 0,
      agreementTier: 'Weak',
      isConsensusSignal: false,
      strongestMethod: methods[0] || 'PRR',
      normalizedGeometricExcess: 1.0,
      votingRatio: `0/${methods.length}`,
      methodVotes: [],
      expected: table.expected,
      oeRatio: table.expected > 0 ? table.n11 / table.expected : 0,
      chiSquare: table.chiSquare,
      yatesChiSquare: table.yatesChiSquare,
    };

    const methodVotes: any[] = [];
    let logFoldExcessSum = 0;

    methods.forEach((m) => {
      const cfg = configs[m] || methodRegistry.get(m)?.defaultConfig;
      const r = methodRegistry.run(m, drug, event, table, cfg, soc);

      // Determine threshold and fold excess above threshold
      let threshold = 1.0;
      let foldExcess = 1.0;

      if (m === 'PRR') {
        threshold = cfg?.thresholdPRR ?? 2.0;
        foldExcess = Math.max(0.01, r.score / Math.max(0.001, threshold));
        cSignal.primaryPRR = r.score;
      } else if (m === 'ROR') {
        threshold = cfg?.thresholdLowerBound ?? 1.0;
        foldExcess = Math.max(0.01, r.lowerBound / Math.max(0.001, threshold));
        cSignal.primaryROR = r.score;
      } else if (m === 'RFET') {
        threshold = cfg?.thresholdPValue ?? 0.05;
        const negLogP = -Math.log10(Math.max(1e-15, r.pValue ?? 1.0));
        const negLogAlpha = -Math.log10(Math.max(1e-15, threshold));
        foldExcess = Math.max(0.01, negLogP / Math.max(0.001, negLogAlpha));
      } else if (m === 'BCPNN') {
        threshold = cfg?.thresholdIC025 ?? 0.0;
        // On log2 Information Component scale, threshold can be 0 or negative; fold-excess is 2^(IC025 - threshold)
        foldExcess = Math.max(0.01, Math.pow(2, r.lowerBound - threshold));
        cSignal.primaryIC = r.score;
        cSignal.primaryIC025 = r.lowerBound;
      } else if (m === 'GPS') {
        threshold = cfg?.thresholdEB05 ?? 2.0;
        foldExcess = Math.max(0.01, r.lowerBound / Math.max(0.001, threshold));
        cSignal.primaryEB05 = r.lowerBound;
      } else if (m === 'LASSO') {
        threshold = cfg?.thresholdCoef ?? 0.05;
        if (threshold > 0) {
          foldExcess = Math.max(0.01, r.score / threshold);
        } else {
          foldExcess = Math.max(0.01, Math.pow(2, r.score - threshold));
        }
      } else if (m === 'SCORE') {
        threshold = 0.5;
        foldExcess = Math.max(0.01, r.score / Math.max(0.001, threshold));
        cSignal.primarySER = r.score;
      } else if (m === 'SCORE_DDI') {
        threshold = 1.0;
        foldExcess = Math.max(0.01, r.score / Math.max(0.001, threshold));
        cSignal.primaryDDIRatio = r.score;
      } else {
        // Generic dynamic method
        threshold = cfg?.threshold ?? 1.0;
        if (threshold > 0) {
          foldExcess = Math.max(0.01, r.score / threshold);
        } else {
          foldExcess = Math.max(0.01, Math.pow(2, r.score - threshold));
        }
      }

      logFoldExcessSum += Math.log(foldExcess);

      methodVotes.push({
        method: m,
        isSignal: r.isSignal,
        score: r.score,
        threshold,
        foldExcess,
        lowerBound: r.lowerBound,
        upperBound: r.upperBound,
        pValue: r.pValue,
        formattedScore: r.formattedScore,
        formattedInterval: r.formattedInterval,
      });

      cSignal.methodResults[m] = r;
      methodResults[m].push(r);
      if (r.isSignal) {
        cSignal.signalCount++;
      }
    });

    const normalizedGeometricExcess = methods.length > 0 ? Math.exp(logFoldExcessSum / methods.length) : 1.0;

    cSignal.consensusScore = cSignal.signalCount / methods.length;
    cSignal.normalizedGeometricExcess = normalizedGeometricExcess;
    cSignal.votingRatio = `${cSignal.signalCount}/${methods.length}`;
    cSignal.methodVotes = methodVotes;
    cSignal.expected = table.expected;
    cSignal.oeRatio = table.expected > 0 ? table.n11 / table.expected : 0;
    cSignal.chiSquare = table.chiSquare;
    cSignal.yatesChiSquare = table.yatesChiSquare;

    // Consensus agreement tier classification (vigipy 3.4 consensus_analysis)
    let tier: AgreementTier = 'Weak';
    if (cSignal.consensusScore === 1.0) {
      tier = 'Unanimous';
    } else if (cSignal.consensusScore >= 0.75) {
      tier = 'Strong';
    } else if (cSignal.consensusScore >= 0.5) {
      tier = 'Moderate';
    } else if (cSignal.signalCount >= 2) {
      tier = 'Weak';
    } else if (cSignal.signalCount === 1) {
      tier = 'Isolated';
    }
    cSignal.agreementTier = tier;

    // Consensus signal if flagged by >= 50% of evaluated methods or at least 2 methods
    cSignal.isConsensusSignal = cSignal.signalCount >= Math.max(2, Math.ceil(methods.length * 0.5));

    consensusMap.set(key, cSignal);
  }

  // Enrich each method with FDR adjustments
  methods.forEach((m) => {
    methodResults[m] = enrichSignalResultsWithErrorMetrics(methodResults[m]);
    // update primaryQValue on consensus signals
    methodResults[m].forEach((r) => {
      const c = consensusMap.get(`${r.drug}__${r.event}`);
      if (c && m === 'PRR') {
        c.primaryQValue = r.qValue;
      }
    });
  });

  const consensusSignals = Array.from(consensusMap.values());
  // Sort consensus signals by signal count descending, then by primary score
  consensusSignals.sort((a, b) => {
    if (b.signalCount !== a.signalCount) return b.signalCount - a.signalCount;
    return (b.normalizedGeometricExcess || 0) - (a.normalizedGeometricExcess || 0);
  });

  const agreementTierBreakdown: Record<AgreementTier, number> = {
    Unanimous: 0,
    Strong: 0,
    Moderate: 0,
    Weak: 0,
    Isolated: 0,
  };
  consensusSignals.forEach((cs) => {
    agreementTierBreakdown[cs.agreementTier] = (agreementTierBreakdown[cs.agreementTier] || 0) + 1;
  });

  const concordance = computeConcordanceMatrix(methods, methodResults, tables.size);

  return {
    consensusSignals,
    methodResults,
    tables,
    concordance,
    agreementTierBreakdown,
  };
}

export type ProgressCallback = (percent: number, stage: string, detail?: string) => void;

const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Non-blocking asynchronous version of analyze() with progress tracking.
 * Prevents UI freezes when running disproportionality tests on large cohorts.
 */
export async function analyzeAsync(
  records: FAERSRecord[],
  method: DisproportionalityMethod,
  config: any = DEFAULT_CONFIGS[method] || methodRegistry.get(method)?.defaultConfig,
  onProgress?: ProgressCallback
): Promise<SignalResult[]> {
  onProgress?.(10, `Building 2x2 contingency tables for ${method}...`);
  await yieldToBrowser();

  const minCount = config?.minCount || 1;
  const expMethod = config?.expectationMethod || DEFAULT_CONFIGS.expectationMethod || 'binomial';
  const tables = buildContingencyTables(records, minCount, expMethod);

  onProgress?.(35, `Evaluating ${method} point estimates and intervals...`);
  await yieldToBrowser();

  const rawResults: SignalResult[] = [];
  const entries = Array.from(tables.values());
  const chunkSize = Math.max(15, Math.floor(entries.length / 6));

  for (let i = 0; i < entries.length; i++) {
    const { drug, event, soc, table } = entries[i];
    const res = methodRegistry.run(method, drug, event, table, config, soc);
    rawResults.push(res);

    if (i % chunkSize === 0 && i > 0) {
      const p = Math.round(35 + (i / entries.length) * 50);
      onProgress?.(p, `Computing ${method} signals (${i}/${entries.length} pairs)...`);
      await yieldToBrowser();
    }
  }

  onProgress?.(88, `Computing False Discovery Rate (Benjamini-Hochberg)...`);
  await yieldToBrowser();

  rawResults.sort((a, b) => b.score - a.score);
  const enriched = enrichSignalResultsWithErrorMetrics(rawResults);
  onProgress?.(100, `${method} complete`);
  await yieldToBrowser();
  return enriched;
}

/**
 * Non-blocking asynchronous version of analyze_all() with real-time stage progress reporting.
 * Prevents main thread freeze when running multi-method consensus and FDR shrinkage.
 */
export async function analyzeAllAsync(
  records: FAERSRecord[],
  configs: MethodConfigs = DEFAULT_CONFIGS,
  activeMethods?: DisproportionalityMethod[],
  onProgress?: ProgressCallback
): Promise<{
  consensusSignals: ConsensusSignal[];
  methodResults: Record<DisproportionalityMethod, SignalResult[]>;
  tables: Map<string, { drug: string; event: string; soc?: string; table: ContingencyTable }>;
  concordance: MethodConcordanceMatrix;
  agreementTierBreakdown: Record<AgreementTier, number>;
}> {
  onProgress?.(10, 'Building 2x2 Contingency Matrices across FAERS co-occurrences...');
  await yieldToBrowser();

  const methods = activeMethods || methodRegistry.getAll().map((m) => m.id as DisproportionalityMethod);
  const minCount = Math.min(...methods.map((m) => configs[m]?.minCount || 3));
  const expMethod = configs.expectationMethod || configs.PRR?.expectationMethod || configs.BCPNN?.expectationMethod || 'binomial';
  const tables = buildContingencyTables(records, minCount, expMethod);

  const methodResults = {} as Record<DisproportionalityMethod, SignalResult[]>;
  methods.forEach((m) => {
    methodResults[m] = [];
  });

  const consensusMap = new Map<string, ConsensusSignal>();
  const tableEntries = Array.from(tables.entries());

  onProgress?.(25, `Evaluating signals across ${methods.length} pharmacovigilance methods...`);
  await yieldToBrowser();

  const chunkSize = Math.max(12, Math.floor(tableEntries.length / 8));

  for (let i = 0; i < tableEntries.length; i++) {
    const [key, item] = tableEntries[i];
    const { drug, event, soc, table } = item;

    const cSignal: ConsensusSignal = {
      id: key,
      drug,
      event,
      soc,
      contingency: table,
      methodResults: {},
      signalCount: 0,
      totalMethods: methods.length,
      consensusScore: 0,
      agreementTier: 'Weak',
      isConsensusSignal: false,
      strongestMethod: methods[0] || 'PRR',
      normalizedGeometricExcess: 1.0,
      votingRatio: `0/${methods.length}`,
      methodVotes: [],
      expected: table.expected,
      oeRatio: table.expected > 0 ? table.n11 / table.expected : 0,
      chiSquare: table.chiSquare,
      yatesChiSquare: table.yatesChiSquare,
    };

    const methodVotes: any[] = [];
    let logFoldExcessSum = 0;

    methods.forEach((m) => {
      const cfg = configs[m] || methodRegistry.get(m)?.defaultConfig;
      const r = methodRegistry.run(m, drug, event, table, cfg, soc);

      let threshold = 1.0;
      let foldExcess = 1.0;

      if (m === 'PRR') {
        threshold = cfg?.thresholdPRR ?? 2.0;
        foldExcess = Math.max(0.01, r.score / Math.max(0.001, threshold));
        cSignal.primaryPRR = r.score;
      } else if (m === 'ROR') {
        threshold = cfg?.thresholdLowerBound ?? 1.0;
        foldExcess = Math.max(0.01, r.lowerBound / Math.max(0.001, threshold));
        cSignal.primaryROR = r.score;
      } else if (m === 'RFET') {
        threshold = cfg?.thresholdPValue ?? 0.05;
        const negLogP = -Math.log10(Math.max(1e-15, r.pValue ?? 1.0));
        const negLogAlpha = -Math.log10(Math.max(1e-15, threshold));
        foldExcess = Math.max(0.01, negLogP / Math.max(0.001, negLogAlpha));
      } else if (m === 'BCPNN') {
        threshold = cfg?.thresholdIC025 ?? 0.0;
        foldExcess = Math.max(0.01, Math.pow(2, r.lowerBound - threshold));
        cSignal.primaryIC = r.score;
        cSignal.primaryIC025 = r.lowerBound;
      } else if (m === 'GPS') {
        threshold = cfg?.thresholdEB05 ?? 2.0;
        foldExcess = Math.max(0.01, r.lowerBound / Math.max(0.001, threshold));
        cSignal.primaryEB05 = r.lowerBound;
      } else if (m === 'LASSO') {
        threshold = cfg?.thresholdCoef ?? 0.05;
        if (threshold > 0) {
          foldExcess = Math.max(0.01, r.score / threshold);
        } else {
          foldExcess = Math.max(0.01, Math.pow(2, r.score - threshold));
        }
      } else if (m === 'SCORE') {
        threshold = 0.5;
        foldExcess = Math.max(0.01, r.score / Math.max(0.001, threshold));
        cSignal.primarySER = r.score;
      } else if (m === 'SCORE_DDI') {
        threshold = 1.0;
        foldExcess = Math.max(0.01, r.score / Math.max(0.001, threshold));
        cSignal.primaryDDIRatio = r.score;
      } else {
        threshold = cfg?.threshold ?? 1.0;
        if (threshold > 0) {
          foldExcess = Math.max(0.01, r.score / threshold);
        } else {
          foldExcess = Math.max(0.01, Math.pow(2, r.score - threshold));
        }
      }

      logFoldExcessSum += Math.log(foldExcess);

      methodVotes.push({
        method: m,
        isSignal: r.isSignal,
        score: r.score,
        threshold,
        foldExcess,
        lowerBound: r.lowerBound,
        upperBound: r.upperBound,
        pValue: r.pValue,
        formattedScore: r.formattedScore,
        formattedInterval: r.formattedInterval,
      });

      cSignal.methodResults[m] = r;
      methodResults[m].push(r);
      if (r.isSignal) {
        cSignal.signalCount++;
      }
    });

    const normalizedGeometricExcess = methods.length > 0 ? Math.exp(logFoldExcessSum / methods.length) : 1.0;

    cSignal.consensusScore = cSignal.signalCount / methods.length;
    cSignal.normalizedGeometricExcess = normalizedGeometricExcess;
    cSignal.votingRatio = `${cSignal.signalCount}/${methods.length}`;
    cSignal.methodVotes = methodVotes;
    cSignal.expected = table.expected;
    cSignal.oeRatio = table.expected > 0 ? table.n11 / table.expected : 0;
    cSignal.chiSquare = table.chiSquare;
    cSignal.yatesChiSquare = table.yatesChiSquare;

    // Consensus agreement tier classification (vigipy 3.4 consensus_analysis)
    let tier: AgreementTier = 'Weak';
    if (cSignal.consensusScore === 1.0) {
      tier = 'Unanimous';
    } else if (cSignal.consensusScore >= 0.75) {
      tier = 'Strong';
    } else if (cSignal.consensusScore >= 0.5) {
      tier = 'Moderate';
    } else if (cSignal.signalCount >= 2) {
      tier = 'Weak';
    } else if (cSignal.signalCount === 1) {
      tier = 'Isolated';
    }
    cSignal.agreementTier = tier;

    cSignal.isConsensusSignal = cSignal.signalCount >= Math.max(2, Math.ceil(methods.length * 0.5));
    consensusMap.set(key, cSignal);

    if (i % chunkSize === 0 && i > 0) {
      const p = Math.round(25 + (i / tableEntries.length) * 60);
      onProgress?.(p, `Computing multi-method consensus (${i}/${tableEntries.length} pairs)...`);
      await yieldToBrowser();
    }
  }

  onProgress?.(88, 'Calculating FDR adjustments and Benjamini-Hochberg q-values...');
  await yieldToBrowser();

  methods.forEach((m) => {
    methodResults[m] = enrichSignalResultsWithErrorMetrics(methodResults[m]);
    methodResults[m].forEach((r) => {
      const c = consensusMap.get(`${r.drug}__${r.event}`);
      if (c && m === 'PRR') {
        c.primaryQValue = r.qValue;
      }
    });
  });

  const consensusSignals = Array.from(consensusMap.values());
  consensusSignals.sort((a, b) => {
    if (b.signalCount !== a.signalCount) return b.signalCount - a.signalCount;
    return (b.normalizedGeometricExcess || 0) - (a.normalizedGeometricExcess || 0);
  });

  const agreementTierBreakdown: Record<AgreementTier, number> = {
    Unanimous: 0,
    Strong: 0,
    Moderate: 0,
    Weak: 0,
    Isolated: 0,
  };
  consensusSignals.forEach((cs) => {
    agreementTierBreakdown[cs.agreementTier] = (agreementTierBreakdown[cs.agreementTier] || 0) + 1;
  });

  const concordance = computeConcordanceMatrix(methods, methodResults, tables.size);

  onProgress?.(100, 'Consensus analysis complete.');
  await yieldToBrowser();

  return {
    consensusSignals,
    methodResults,
    tables,
    concordance,
    agreementTierBreakdown,
  };
}
