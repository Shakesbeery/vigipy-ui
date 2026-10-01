/**
 * Type definitions for vigipy Project Container
 * Enables full serialization, export, and complete deterministic restoration
 * of all project surveillance data, configurations, filters, dynamic methods, and results.
 */

import {
  CohortFilter,
  DisproportionalityMethod,
  FAERSRecord,
  LongitudinalConfig,
  MethodConfigs,
} from './vigipy';
import { MethodContract } from '../core/method_registry';

export interface VigipyProjectContainer {
  formatVersion: '1.0.0';
  app: 'vigipy-studio';
  exportedAt: string; // ISO 8601 string
  vigipyVersion: string; // e.g. '0.2.1'
  metadata: {
    title: string;
    description: string;
    investigator?: string;
    tags?: string[];
  };
  environment: {
    activeTab: 'studio' | 'longitudinal' | 'consensus' | 'ddi_network' | 'cohort' | 'python';
    chartType: 'forest' | 'volcano';
    selectedMethod: DisproportionalityMethod;
    activeAnalysisMethods?: DisproportionalityMethod[];
  };
  dataset: {
    title: string;
    totalRecords: number;
    records: FAERSRecord[];
  };
  cohortFilter: CohortFilter;
  methodConfigs: MethodConfigs;
  customMethods?: MethodContract[];
  longitudinal: {
    targetDrug: string;
    targetEvent: string;
    config: LongitudinalConfig;
  };
  resultsSnapshot?: {
    totalSignalsFound: number;
    consensusSignalsFound: number;
    topSignals: {
      drug: string;
      event: string;
      score: number;
      lowerBound: number;
      upperBound: number;
      n11: number;
      method: string;
      isSignal: boolean;
    }[];
  };
}

export interface ContainerValidationResult {
  isValid: boolean;
  errors: string[];
  container?: VigipyProjectContainer;
}
