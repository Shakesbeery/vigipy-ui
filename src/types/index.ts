/**
 * TypeScript definitions matching vigipy-ui backend schemas (backend/app/schemas.py).
 * Computational and consensus pharmacovigilance types.
 */

export type AgreementTier = "Unanimous" | "Strong" | "Moderate" | "Weak" | "Isolated";

// --- Ingestion Schemas ---

export interface ColumnMappingRequest {
  file_path: string;
  product_col: string;
  ae_col: string;
  count_col?: string | null;
  date_col?: string | null;
  auto_populate_count: boolean;
  default_count: number;
}

export interface SuggestedMapping {
  product_col?: string | null;
  ae_col?: string | null;
  count_col?: string | null;
  date_col?: string | null;
  [key: string]: string | null | undefined;
}

export interface FilePreviewResponse {
  file_path: string;
  total_rows: number;
  columns: string[];
  preview_rows: Record<string, any>[];
  suggested_mapping: SuggestedMapping;
}

export interface DataSummaryResponse {
  total_raw_rows: number;
  unique_pairs: number;
  unique_products: number;
  unique_aes: number;
  total_events: number;
  dispersion?: number | null;
  dispersion_alpha?: number | null;
  recommended_expected_method: "mantel-haentzel" | "negative-binomial" | "poisson" | string;
  total_signals?: number | null;
}

// --- Method Configuration Schemas ---

export type ExpectedMethod = "mantel-haentzel" | "poisson" | "negative-binomial";
export type DecisionMetric = "fdr" | "rank" | "signals";
export type RankingStatistic = "p_value" | "CI" | "quantile" | "log2";

export interface PRRConfigSchema {
  enabled: boolean;
  relative_risk: number;
  min_events: number;
  decision_metric: "fdr" | "rank" | "signals";
  decision_thres: number;
  ranking_statistic: "p_value" | "CI";
  expected_method: ExpectedMethod;
  method_alpha: number;
  fdr_threshold: number;
  continuity_correction: boolean;
}

export interface RORConfigSchema {
  enabled: boolean;
  relative_risk: number;
  min_events: number;
  decision_metric: "fdr" | "rank" | "signals";
  decision_thres: number;
  ranking_statistic: "p_value" | "CI";
  expected_method: ExpectedMethod;
  method_alpha: number;
  fdr_threshold: number;
  continuity_correction: boolean;
}

export interface RFETConfigSchema {
  enabled: boolean;
  min_events: number;
  decision_metric: "fdr" | "rank" | "signals";
  decision_thres: number;
  mid_pval: boolean;
  expected_method: ExpectedMethod;
  method_alpha: number;
  fdr_threshold: number;
}

export interface BCPNNConfigSchema {
  enabled: boolean;
  relative_risk: number;
  min_events: number;
  decision_metric: "rank" | "fdr" | "signals";
  decision_thres: number;
  ranking_statistic: "quantile" | "p_value";
  MC: boolean;
  num_MC: number;
  expected_method: ExpectedMethod;
  method_alpha: number;
}

export interface GPSConfigSchema {
  enabled: boolean;
  relative_risk: number;
  min_events: number;
  decision_metric: "rank" | "fdr" | "signals";
  decision_thres: number;
  ranking_statistic: "log2" | "p_value" | "quantile";
  truncate: boolean;
  truncate_thres: number;
  expected_method: ExpectedMethod;
  method_alpha: number;
  minimization_method: string;
}

export interface LASSOConfigSchema {
  enabled: boolean;
  lasso_thresh: number;
  alpha: number;
  min_events: number;
  num_bootstrap: number;
  ci: number;
  use_lars: boolean;
  use_IC: boolean;
  IC_criterion: "aic" | "bic";
  use_glm: boolean;
  nb_alpha: number;
  lasso_alpha: number;
  family: "logistic" | "poisson";
  relaxed: boolean;
  n_jobs: number;
}

export interface SCOREConfigSchema {
  enabled: boolean;
  latent_rank: number;
  syndromic_weight: number;
  sparsity_param: number;
  fdr_threshold: number;
  deflate_iterations: number;
  min_events: number;
  max_iter: number;
  tol: number;
  n_jobs: number;
  seed: number;
}

export interface RunAnalysisRequest {
  prr?: PRRConfigSchema | null;
  ror?: RORConfigSchema | null;
  rfet?: RFETConfigSchema | null;
  bcpnn?: BCPNNConfigSchema | null;
  gps?: GPSConfigSchema | null;
  lasso?: LASSOConfigSchema | null;
  score_da?: SCOREConfigSchema | null;
  score?: SCOREConfigSchema | null;
  consensus: boolean;
}

export type JobStatus = "idle" | "running" | "completed" | "failed" | "cancelled";

export interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  progress: number;
  step: string;
  error?: string | null;
  total_signals: number;
  total_candidates: number;
}

// --- Query & Virtual Table Schemas ---

export interface SignalQueryRequest {
  offset: number;
  limit: number;
  search?: string | null;
  tiers?: string[] | null;
  methods?: string[] | null;
  min_count?: number | null;
  min_votes?: number | null;
  min_score?: number | null;
  sort_by?: string | null;
  sort_dir: "asc" | "desc";
}

export interface SignalRow {
  product: string;
  adverse_event: string;
  count: number;
  expected_count?: number | null;
  votes: number;
  total_methods: number;
  consensus_score: number;
  agreement_tier: "Unanimous" | "Strong" | "Moderate" | "Weak" | "Isolated" | string;
  composite_rank?: number | null;
  method_scores: Record<string, number | null>;
  method_alerts: Record<string, boolean>;
}

export interface SignalQueryResponse {
  total_records: number;
  filtered_records: number;
  offset: number;
  limit: number;
  rows: SignalRow[];
  methods: string[];
}

export interface MethodSignalInspection {
  method: string;
  alert: boolean;
  metric: string;
  score?: number | null;
  ci_lower?: number | null;
  ci_upper?: number | null;
  p_value?: number | null;
  fdr?: number | null;
  count?: number | null;
  expected_count?: number | null;
  threshold?: string | null;
  threshold_metric?: string | null;
}

export interface InspectSignalResponse {
  product: string;
  adverse_event: string;
  votes: number;
  total_methods: number;
  consensus_score: number;
  agreement_tier: string;
  composite_rank?: number | null;
  count: number;
  expected_count?: number | null;
  methods: MethodSignalInspection[];
}

export interface ConcordanceResponse {
  methods: string[];
  jaccard: Record<string, Record<string, number>>;
  cohens_kappa: Record<string, Record<string, number>>;
  spearman_correlation: Record<string, Record<string, number>>;
  alert_overlap: Record<string, Record<string, number>>;
}

export interface Contingency2x2Response {
  method_a: string;
  method_b: string;
  table: Record<string, Record<string, number>>;
}

// --- Longitudinal Schemas ---

export interface LongitudinalRunRequest {
  method: "prr" | "ror" | "rfet" | "bcpnn" | "gps" | "lasso" | "score_da" | "all";
  methods?: ("prr" | "ror" | "rfet" | "bcpnn" | "gps" | "lasso" | "score_da")[];
  time_unit: "YE" | "QE" | "ME";
  mode: "cumulative" | "disjoint";
  include_gaps: boolean;
  min_events: number;
  decay_half_life?: string | null;
  decision_thres?: number | null;
  relative_risk?: number | null;
  ranking_statistic?: string | null;
  continuity_correction?: number | boolean | null;
  alpha?: number | null;
}

export interface LongitudinalTrajectoryRequest {
  product: string;
  adverse_event: string;
  method?: string;
}

export interface TrajectoryPoint {
  timestamp: string;
  score?: number | null;
  ci_lower?: number | null;
  ci_upper?: number | null;
  count?: number | null;
  alert: boolean;
}

export interface LongitudinalTrajectoryResponse {
  product: string;
  adverse_event: string;
  method: string;
  trajectory: TrajectoryPoint[];
  multi_trajectories?: Record<string, TrajectoryPoint[]>;
  onset_dates?: Record<string, string | null>;
  computed_methods?: string[];
}

export interface LongitudinalSignalItem {
  product: string;
  adverse_event: string;
  first_onset?: string | null;
  latest_timestamp?: string | null;
  peak_score?: number | null;
  latest_score?: number | null;
  count: number;
  slices_alerted: number;
  total_slices: number;
  consecutive_alert_slices?: number | null;
  avg_peak_score?: number | null;
  method: string;
  consensus_score?: number | null;
  agreement_tier?: string | null;
  methods_alerted: string[];
}

export interface LongitudinalSignalsResponse {
  signals: LongitudinalSignalItem[];
  total: number;
  computed_methods: string[];
  has_consensus: boolean;
}


export interface ExportRequest {
  format: "xlsx" | "csv";
  destination_path?: string | null;
  filtered_only: boolean;
}

export interface HealthResponse {
  status: string;
  has_data: boolean;
  has_results: boolean;
  total_signals: number;
}

// --- Default Configurations ---

export const DEFAULT_PRR_CONFIG: PRRConfigSchema = {
  enabled: true,
  relative_risk: 1.0,
  min_events: 3,
  decision_metric: "fdr",
  decision_thres: 0.05,
  ranking_statistic: "p_value",
  expected_method: "mantel-haentzel",
  method_alpha: 1.0,
  fdr_threshold: 0.05,
  continuity_correction: true,
};

export const DEFAULT_ROR_CONFIG: RORConfigSchema = {
  enabled: true,
  relative_risk: 1.0,
  min_events: 3,
  decision_metric: "fdr",
  decision_thres: 0.05,
  ranking_statistic: "p_value",
  expected_method: "mantel-haentzel",
  method_alpha: 1.0,
  fdr_threshold: 0.05,
  continuity_correction: true,
};

export const DEFAULT_RFET_CONFIG: RFETConfigSchema = {
  enabled: true,
  min_events: 3,
  decision_metric: "fdr",
  decision_thres: 0.05,
  mid_pval: true,
  expected_method: "mantel-haentzel",
  method_alpha: 1.0,
  fdr_threshold: 0.05,
};

export const DEFAULT_BCPNN_CONFIG: BCPNNConfigSchema = {
  enabled: true,
  relative_risk: 1.0,
  min_events: 3,
  decision_metric: "rank",
  decision_thres: 0.0,
  ranking_statistic: "quantile",
  MC: false,
  num_MC: 10000,
  expected_method: "mantel-haentzel",
  method_alpha: 1.0,
};

export const DEFAULT_GPS_CONFIG: GPSConfigSchema = {
  enabled: true,
  relative_risk: 1.0,
  min_events: 3,
  decision_metric: "rank",
  decision_thres: 0.05,
  ranking_statistic: "log2",
  truncate: true,
  truncate_thres: 1.0,
  expected_method: "mantel-haentzel",
  method_alpha: 1.0,
  minimization_method: "Nelder-Mead",
};

export const DEFAULT_LASSO_CONFIG: LASSOConfigSchema = {
  enabled: false,
  lasso_thresh: 0.0,
  alpha: 0.5,
  min_events: 3,
  num_bootstrap: 10,
  ci: 95,
  use_lars: false,
  use_IC: false,
  IC_criterion: "bic",
  use_glm: false,
  nb_alpha: 1.0,
  lasso_alpha: 1e-9,
  family: "logistic",
  relaxed: true,
  n_jobs: 1,
};

export const DEFAULT_SCORE_CONFIG: SCOREConfigSchema = {
  enabled: false,
  latent_rank: 5,
  syndromic_weight: 0.5,
  sparsity_param: 1.0,
  fdr_threshold: 0.05,
  deflate_iterations: 2,
  min_events: 1,
  max_iter: 50,
  tol: 0.0001,
  n_jobs: 1,
  seed: 42,
};

export const DEFAULT_ANALYSIS_REQUEST: RunAnalysisRequest = {
  prr: DEFAULT_PRR_CONFIG,
  ror: DEFAULT_ROR_CONFIG,
  rfet: DEFAULT_RFET_CONFIG,
  bcpnn: DEFAULT_BCPNN_CONFIG,
  gps: DEFAULT_GPS_CONFIG,
  lasso: DEFAULT_LASSO_CONFIG,
  score_da: DEFAULT_SCORE_CONFIG,
  consensus: true,
};

// --- Advanced Analytical Interfaces ---

export interface VolcanoPoint {
  product: string;
  adverse_event: string;
  score: number;
  effect_size: number;
  p_value?: number | null;
  neg_log_p: number;
  fdr?: number | null;
  alert: boolean;
  count: number;
  votes: number;
  agreement_tier: string;
  method: string;
}

export interface VolcanoResponse {
  points: VolcanoPoint[];
  total: number;
  method: string;
  threshold_effect: number;
  threshold_neg_log_p: number;
}

export interface DataProfileResponse {
  total_rows: number;
  unique_products: number;
  unique_aes: number;
  unique_pairs: number;
  missing_product_pct: number;
  missing_ae_pct: number;
  missing_count_pct: number;
  missing_date_pct: number;
  duplicate_cases: number;
  duplicate_case_pct: number;
  quality_score: number;
  recommendations: string[];
}

export interface DDIEdge {
  drug_a: string;
  drug_b: string;
  event: string;
  combo_count: number;
  expected_combo: number;
  excess_score: number;
  archetype: "EMERGENT" | "POTENTIATED" | "TWO_HIT" | "MULTI_HIT";
}

export interface DDINetworkResponse {
  edges: DDIEdge[];
  unique_events: string[];
  top_drugs: string[];
  total_synergies: number;
}

export interface VersionResponse {
  installed_version: string;
  latest_pypi_version: string;
  is_latest: boolean;
  pypi_url: string;
  supported_methods: string[];
  release_date?: string | null;
  summary?: string | null;
}
