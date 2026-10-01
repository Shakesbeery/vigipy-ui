/**
 * Version Management & Column Mapping Types for vigipy
 */

import { DisproportionalityMethod } from './vigipy';

export interface VigipyVersionInfo {
  version: string;
  releaseDate: string;
  isLatest: boolean;
  status: 'stable' | 'beta' | 'development';
  summary: string;
  changelog: string[];
  supportedMethods: DisproportionalityMethod[];
  pypiAvailable: boolean;
  gitRef: string;
  pipCommand: string;
}

export interface ColumnMappingConfig {
  drugCol: string;
  eventCol: string;
  countCol?: string; // Report / event count for aggregated frequency tables (vigipy count_col / use_counts)
  substanceCol?: string; // Active substance / generic molecule name
  strataCol?: string; // Stratification factor (country, center, age group for stratified models)
  caseIdCol?: string;
  roleCol?: string;
  dateCol?: string;
  socCol?: string;
  ageCol?: string;
  sexCol?: string;
  seriousCol?: string;
  outcomeCol?: string;
}

export interface RawParsedTable {
  fileName: string;
  headers: string[];
  sampleRows: string[][];
  totalRows: number;
  allRows: string[][];
}
