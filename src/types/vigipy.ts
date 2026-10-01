/**
 * Type definitions mirroring the vigipy pharmacovigilance library.
 * Supports typed configuration dataclasses, contingency metrics,
 * longitudinal modeling modes, consensus scoring, and FAERS data structures.
 */

export type DisproportionalityMethod =
  | 'PRR'
  | 'ROR'
  | 'RFET'
  | 'BCPNN'
  | 'GPS'
  | 'LASSO'
  | 'SCORE'
  | 'SCORE_DDI'
  | (string & {});

export type DrugRole = 'PS' | 'SS' | 'C' | 'I'; // Primary Suspect, Secondary Suspect, Concomitant, Interacting
export type OutcomeCode = 'DE' | 'HO' | 'LT' | 'DS' | 'CA' | 'OT'; // Death, Hospitalization, Life-Threatening, Disability, Congenital Anomaly, Other
export type SexType = 'M' | 'F' | 'UNK';

export type ExpectationModel =
  | 'mantel-haenszel' // Default in vigipy: classical marginal independence E = (n1dot * ndot1) / ndotdot
  | 'poisson'         // GLM Poisson log-linear regression
  | 'negative-binomial' // GLM Negative-Binomial overdispersion regression
  | 'binomial'        // Background unexposed rate p0 = n01 / n0dot
  | 'standard';       // Classical independence alias

export interface PRRConfig {
  alpha: number; // Significance level, e.g. 0.05
  continuityCorrection: boolean; // Apply +0.5 Haldane-Anscombe
  correctionValue: number; // Default 0.5
  minCount: number; // Minimum N11 count, e.g. 3
  thresholdPRR: number; // Threshold for signal, e.g. >= 2.0
  thresholdChiSquare: number; // Chi-square threshold, e.g. >= 4.0
  expectationMethod?: ExpectationModel; // Expectation method, e.g. 'binomial'
}

export interface RORConfig {
  alpha: number; // Significance level, e.g. 0.05
  continuityCorrection: boolean; // Apply +0.5 Haldane-Anscombe
  correctionValue: number; // Default 0.5
  minCount: number; // Minimum N11 count, e.g. 3
  thresholdLowerBound: number; // Lower bound ROR025 > 1.0
  thresholdROR?: number; // Point estimate threshold, e.g. >= 1.0 or 2.0
  expectationMethod?: ExpectationModel;
}

export interface RFETConfig {
  alpha: number; // Alpha level, default 0.05
  alternative: 'greater' | 'two-sided' | 'less';
  midP: boolean; // Mid-p value correction for discrete conservative distribution
  minCount: number; // Minimum N11 count
  thresholdPValue: number; // Threshold p-value, default 0.05
  expectationMethod?: ExpectationModel;
}

export interface BCPNNConfig {
  priorAlpha1: number; // Hyperparameter for marginal drug
  priorBeta1: number;
  priorAlpha2: number; // Hyperparameter for marginal event
  priorBeta2: number;
  priorAlpha11?: number; // Joint shape prior
  priorBeta11?: number; // Joint scale prior
  credibilityLevel: number; // E.g. 0.95 for 2.5% - 97.5% interval
  thresholdIC025: number; // IC025 > 0.0
  thresholdIC?: number; // IC > 0.0
  minCount: number;
  expectationMethod?: ExpectationModel;
}

export interface GPSConfig {
  alpha1: number; // Mixture component 1 shape (e.g. 0.2)
  beta1: number; // Mixture component 1 scale (e.g. 0.1)
  alpha2: number; // Mixture component 2 shape (e.g. 2.0)
  beta2: number; // Mixture component 2 scale (e.g. 4.0)
  weight: number; // Mixture component weight (e.g. 0.1)
  thresholdEB05: number; // EB05 >= 2.0
  thresholdEBGM?: number; // EBGM >= 2.0
  credibleInterval?: number; // Default 0.90 for [EB05, EB95]
  minCount: number;
  expectationMethod?: ExpectationModel;
}

export interface LASSOConfig {
  alpha: number; // L1 regularization lambda (e.g. 0.05)
  maxIter: number; // Coordinate descent iterations (e.g. 100)
  tolerance: number; // Convergence tolerance
  standardize: boolean;
  fitIntercept: boolean;
  thresholdCoef: number; // Threshold positive coefficient to declare signal (e.g. > 0.05)
  minCount: number;
  relaxed?: boolean; // vigipy 3.4 two-stage Relaxed LASSO with debiased aROR refit
  family?: 'logistic' | 'gaussian';
  decisionMetric?: 'lower_bound' | 'coefficient' | 'fdr';
  expectationMethod?: ExpectationModel;
}

export interface SCOREConfig {
  latentRank?: number; // Number of latent indication/class factors to absorb (default 5)
  syndromicWeight?: number; // Graph Laplacian coupling penalty (lambda_2 >= 0, default 0.5)
  sparsityParam?: number; // L1 sparsity penalty (lambda_1 >= 0, default 1.0)
  fdrThreshold?: number; // Target BH-FDR cutoff (default 0.05)
  deflateIterations?: number; // Deflation passes to remove blockbuster masking (default 2)
  minCount?: number; // Minimum observed count (default 1)
  maxIter?: number; // FISTA iterations per drug (default 50)
  tol?: number; // Convergence tolerance (default 1e-4)
}

export interface SCOREDDIConfig {
  interactionModel?: 'multiplicative' | 'additive'; // Null baseline model for interaction
  syndromicWeight?: number; // Graph Laplacian coupling penalty across adverse events
  sparsityParam?: number; // L1 sparsity penalty
  fdrThreshold?: number; // Target BH-FDR cutoff (default 0.05)
  minCount?: number; // Minimum co-occurrence count
  maxIter?: number; // FISTA iterations
  tol?: number; // Convergence tolerance
}

export type MethodConfigs = {
  PRR: PRRConfig;
  ROR: RORConfig;
  RFET: RFETConfig;
  BCPNN: BCPNNConfig;
  GPS: GPSConfig;
  LASSO: LASSOConfig;
  SCORE: SCOREConfig;
  SCORE_DDI: SCOREDDIConfig;
  expectationMethod?: ExpectationModel;
  [key: string]: any;
};

export type LongitudinalMode = 'cumulative' | 'disjoint';

export interface LongitudinalConfig {
  mode: LongitudinalMode;
  expectationModel: ExpectationModel;
  method: DisproportionalityMethod;
  timeUnit: 'quarter' | 'year' | 'month';
  minCountPerSlice: number;
}

export interface ContingencyTable {
  n11: number; // Observed drug + event
  n10: number; // Drug + other events
  n01: number; // Other drugs + event
  n00: number; // Other drugs + other events
  n1dot: number; // Total drug reports (n11 + n10)
  ndot1: number; // Total event reports (n11 + n01)
  ndotdot: number; // Grand total reports
  expected: number; // (n1dot * ndot1) / ndotdot
  chiSquare: number;
  yatesChiSquare: number;
  corrected: boolean;
}

export interface SignalResult {
  id: string; // drug__event__method
  drug: string;
  event: string;
  soc?: string;
  method: DisproportionalityMethod;
  score: number; // Main point estimate (PRR, ROR, IC, EBGM, LASSO coef, -log10 p)
  lowerBound: number; // E.g. PRR_025, ROR_025, IC_025, EB_05
  upperBound: number; // E.g. PRR_975, ROR_975, IC_975, EB_95
  pValue?: number;
  qValue?: number; // Benjamini-Hochberg FDR corrected
  isSignal: boolean;
  contingency: ContingencyTable;
  fdr?: number; // False Discovery Rate estimate
  fnr?: number; // False Negative Rate
  for_?: number; // False Omission Rate
  sensitivity?: number;
  specificity?: number;
  metricLabel: string;
  formattedScore: string;
  formattedInterval: string;
}

export interface MethodVoteDetail {
  method: DisproportionalityMethod;
  isSignal: boolean;
  score: number;
  threshold: number;
  foldExcess: number;
  lowerBound: number;
  upperBound: number;
  pValue?: number;
  qValue?: number;
  formattedScore: string;
  formattedInterval: string;
}

export type AgreementTier = 'Unanimous' | 'Strong' | 'Moderate' | 'Weak' | 'Isolated';

export interface MethodConcordanceMatrix {
  methods: DisproportionalityMethod[];
  jaccard: Record<string, Record<string, number>>; // Jaccard similarity [0..1]
  cohenKappa: Record<string, Record<string, number>>; // Cohen's Kappa [-1..1]
  overlapCounts: Record<string, Record<string, { both: number; m1Only: number; m2Only: number; neither: number }>>;
}

export interface ConsensusSignal {
  id: string; // drug__event
  drug: string;
  event: string;
  soc?: string;
  contingency: ContingencyTable;
  methodResults: Partial<Record<DisproportionalityMethod, SignalResult>>;
  signalCount: number;
  totalMethods: number;
  consensusScore: number; // Proportion of methods declaring signal (0.0 to 1.0)
  agreementTier: AgreementTier;
  isConsensusSignal: boolean;
  strongestMethod: DisproportionalityMethod;
  normalizedGeometricExcess: number; // Geometric mean of fold-excess above thresholds across active methods
  votingRatio: string; // e.g. "4/5"
  methodVotes: MethodVoteDetail[];
  expected: number;
  oeRatio: number;
  chiSquare: number;
  yatesChiSquare: number;
  primaryPRR?: number;
  primaryROR?: number;
  primaryIC?: number;
  primaryIC025?: number;
  primaryEB05?: number;
  primarySER?: number;
  primaryDDIRatio?: number;
  primaryQValue?: number;
}

export interface ConsensusAnalysisResult {
  signals: ConsensusSignal[];
  numSignals: number;
  totalEvaluated: number;
  concordance: MethodConcordanceMatrix;
  agreementTierBreakdown: Record<AgreementTier, number>;
}

export interface FAERSRecord {
  caseId: string;
  drugName: string;
  role: DrugRole;
  preferredTerm: string;
  systemOrganClass: string;
  date: string; // YYYY-MM-DD
  quarter: string; // e.g. '2023Q1'
  age?: number;
  sex?: SexType;
  country?: string;
  serious: boolean;
  outcomes?: OutcomeCode[];
}

export interface CohortFilter {
  targetDrugs: string[];
  targetEvents: string[];
  roles: DrugRole[];
  dateStart: string;
  dateEnd: string;
  quarters: string[];
  ageMin?: number;
  ageMax?: number;
  sex: SexType[];
  seriousOnly: boolean;
  outcomes: OutcomeCode[];
  minReportCount: number;
  searchQuery: string;
}

export interface LongitudinalPoint {
  timeSlice: string; // e.g. '2021Q1'
  date: string;
  n11: number;
  expected: number;
  score: number;
  lowerBound: number;
  upperBound: number;
  isSignal: boolean;
  cumulativeCount: number;
  sliceTotal: number;
}

export type TrajectoryArchetype =
  | 'Emerging Spike'
  | 'Chronic Elevation'
  | 'Waning / Transitory'
  | 'Baseline / Null'
  | 'Early Trend';

export interface TimeToSignal {
  emergenceSlice: string | null;
  slicesToEmergence: number;
  foldExcessAtEmergence: number;
  summaryText: string;
}

export interface TrajectorySummary {
  drug: string;
  event: string;
  points: LongitudinalPoint[];
  firstEmergenceSlice: string | null;
  peakScore: number;
  peakSlice: string;
  trajectoryTrend: 'emerging' | 'accelerating' | 'stable' | 'waning' | 'unstable';
  archetype?: TrajectoryArchetype;
  timeToSignal?: TimeToSignal;
  volatility: number;
  meanDisproportionality: number;
  totalReports?: number;
}

export interface DatasetMeta {
  id: string;
  name: string;
  category: string;
  description: string;
  recordCount: number;
  uniqueDrugs: number;
  uniqueEvents: number;
  timeRange: string;
  source: 'faers_curated' | 'openfda_live' | 'uploaded' | 'synthetic';
}
