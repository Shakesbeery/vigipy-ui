/**
 * vigipy Project Container Serialization & Restoration Service
 * Bundles raw surveillance records, method hyperparameters, cohort filters,
 * dynamic method contracts, longitudinal modeling targets, and analytical snapshots
 * into a single portable, reproducible project archive (.vigipy.json).
 */

import {
  CohortFilter,
  ConsensusSignal,
  DisproportionalityMethod,
  FAERSRecord,
  LongitudinalConfig,
  MethodConfigs,
  SignalResult,
} from '../types/vigipy';
import { ContainerValidationResult, VigipyProjectContainer } from '../types/container';
import { MethodContract, methodRegistry } from './method_registry';

export interface CreateContainerParams {
  title?: string;
  description?: string;
  investigator?: string;
  tags?: string[];
  datasetTitle: string;
  records: FAERSRecord[];
  cohortFilter: CohortFilter;
  methodConfigs: MethodConfigs;
  activeMethod: DisproportionalityMethod;
  activeTab: 'studio' | 'longitudinal' | 'consensus' | 'ddi_network' | 'cohort' | 'python';
  chartType: 'forest' | 'volcano';
  activeAnalysisMethods?: DisproportionalityMethod[];
  longTargetDrug: string;
  longTargetEvent: string;
  longConfig: LongitudinalConfig;
  signals?: SignalResult[];
  consensusSignals?: ConsensusSignal[];
  vigipyVersion?: string;
}

/**
 * Constructs a comprehensive VigipyProjectContainer snapshot from current application state.
 */
export function createProjectContainer(params: CreateContainerParams): VigipyProjectContainer {
  const now = new Date().toISOString();

  // Extract any dynamic/custom registered methods not in core 6
  const coreIds = new Set(['PRR', 'ROR', 'RFET', 'BCPNN', 'GPS', 'LASSO']);
  const customMethods: MethodContract[] = methodRegistry
    .getAll()
    .filter((m) => !coreIds.has(m.id));

  // Build top signals snapshot for fast pre-flight preview
  const topSignals = (params.signals || [])
    .slice(0, 10)
    .map((s) => ({
      drug: s.drug,
      event: s.event,
      score: s.score,
      lowerBound: s.lowerBound,
      upperBound: s.upperBound,
      n11: s.contingency.n11,
      method: s.method,
      isSignal: s.isSignal,
    }));

  return {
    formatVersion: '1.0.0',
    app: 'vigipy-studio',
    exportedAt: now,
    vigipyVersion: params.vigipyVersion || '0.2.1',
    metadata: {
      title: params.title || params.datasetTitle,
      description:
        params.description ||
        `Surveillance study container containing ${params.records.length} records evaluated with ${params.activeMethod}.`,
      investigator: params.investigator || 'Surveillance Analyst',
      tags: params.tags || ['vigipy', 'disproportionality', 'surveillance'],
    },
    environment: {
      activeTab: params.activeTab,
      chartType: params.chartType,
      selectedMethod: params.activeMethod,
      activeAnalysisMethods: params.activeAnalysisMethods,
    },
    dataset: {
      title: params.datasetTitle,
      totalRecords: params.records.length,
      records: params.records,
    },
    cohortFilter: { ...params.cohortFilter },
    methodConfigs: JSON.parse(JSON.stringify(params.methodConfigs)),
    customMethods: customMethods.length > 0 ? customMethods : undefined,
    longitudinal: {
      targetDrug: params.longTargetDrug,
      targetEvent: params.longTargetEvent,
      config: { ...params.longConfig },
    },
    resultsSnapshot: {
      totalSignalsFound: (params.signals || []).filter((s) => s.isSignal).length,
      consensusSignalsFound: (params.consensusSignals || []).filter((c) => c.isConsensusSignal).length,
      topSignals,
    },
  };
}

/**
 * Triggers a browser download of the VigipyProjectContainer as a JSON file.
 */
export function downloadProjectContainer(container: VigipyProjectContainer, customFilename?: string): void {
  const safeTitle = (container.metadata.title || 'vigipy_project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const dateStr = container.exportedAt.substring(0, 10);
  const filename = customFilename || `${safeTitle}_${dateStr}.vigipy.json`;

  const jsonString = JSON.stringify(container, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validates any JSON input to ensure it meets the VigipyProjectContainer specification.
 */
export function validateProjectContainer(data: any): ContainerValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Input data is not a valid JSON object.'] };
  }

  if (data.app !== 'vigipy-studio') {
    errors.push('Unrecognized application signature. Expected app="vigipy-studio".');
  }

  if (!data.dataset || !Array.isArray(data.dataset.records)) {
    errors.push('Missing or invalid dataset records array.');
  } else if (data.dataset.records.length === 0) {
    errors.push('Container dataset contains 0 records.');
  }

  if (!data.methodConfigs || typeof data.methodConfigs !== 'object') {
    errors.push('Missing method configuration parameters in container.');
  }

  if (!data.cohortFilter || typeof data.cohortFilter !== 'object') {
    errors.push('Missing cohort filter settings.');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    container: data as VigipyProjectContainer,
  };
}
