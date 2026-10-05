"""Pydantic data schemas for vigipy-ui backend API."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field


class ColumnMappingRequest(BaseModel):
    file_path: str = Field(..., description="Absolute or relative path to the data file.")
    product_col: str = Field(..., description="Column name for Product/Brand.")
    ae_col: str = Field(..., description="Column name for Adverse Event.")
    count_col: Optional[str] = Field(None, description="Column name for incident count.")
    date_col: Optional[str] = Field(None, description="Column name for report date.")
    auto_populate_count: bool = Field(
        False,
        description="Whether to auto-populate count when column is absent or empty (1 row = 1 incident)."
    )
    default_count: int = Field(1, ge=1, description="Default integer count to populate if auto_populate_count is true.")


class FilePreviewResponse(BaseModel):
    file_path: str
    total_rows: int
    columns: List[str]
    preview_rows: List[Dict[str, Any]]
    suggested_mapping: Dict[str, Optional[str]]


class DataSummaryResponse(BaseModel):
    total_raw_rows: int
    unique_pairs: int
    unique_products: int
    unique_aes: int
    total_events: int
    dispersion: Optional[float] = None
    dispersion_alpha: Optional[float] = None
    recommended_expected_method: str = "mantel-haentzel"
    total_signals: Optional[int] = None


# --- Method Configuration Schemas ---

class PRRConfigSchema(BaseModel):
    enabled: bool = True
    relative_risk: float = 1.0
    min_events: int = 3
    decision_metric: Literal["fdr", "rank", "signals"] = "fdr"
    decision_thres: float = 0.05
    ranking_statistic: Literal["p_value", "CI"] = "p_value"
    expected_method: Literal["mantel-haentzel", "poisson", "negative-binomial"] = "mantel-haentzel"
    method_alpha: float = 1.0
    fdr_threshold: float = 0.05
    continuity_correction: bool = True


class RORConfigSchema(BaseModel):
    enabled: bool = True
    relative_risk: float = 1.0
    min_events: int = 3
    decision_metric: Literal["fdr", "rank", "signals"] = "fdr"
    decision_thres: float = 0.05
    ranking_statistic: Literal["p_value", "CI"] = "p_value"
    expected_method: Literal["mantel-haentzel", "poisson", "negative-binomial"] = "mantel-haentzel"
    method_alpha: float = 1.0
    fdr_threshold: float = 0.05
    continuity_correction: bool = True


class RFETConfigSchema(BaseModel):
    enabled: bool = True
    min_events: int = 3
    decision_metric: Literal["fdr", "rank", "signals"] = "fdr"
    decision_thres: float = 0.05
    mid_pval: bool = True
    expected_method: Literal["mantel-haentzel", "poisson", "negative-binomial"] = "mantel-haentzel"
    method_alpha: float = 1.0
    fdr_threshold: float = 0.05


class BCPNNConfigSchema(BaseModel):
    enabled: bool = True
    relative_risk: float = 1.0
    min_events: int = 3
    decision_metric: Literal["rank", "fdr", "signals"] = "rank"
    decision_thres: float = 0.0
    ranking_statistic: Literal["quantile", "p_value"] = "quantile"
    MC: bool = False
    num_MC: int = 10000
    expected_method: Literal["mantel-haentzel", "poisson", "negative-binomial"] = "mantel-haentzel"
    method_alpha: float = 1.0


class GPSConfigSchema(BaseModel):
    enabled: bool = True
    relative_risk: float = 1.0
    min_events: int = 3
    decision_metric: Literal["rank", "fdr", "signals"] = "rank"
    decision_thres: float = 0.05
    ranking_statistic: Literal["log2", "p_value", "quantile"] = "log2"
    truncate: bool = True
    truncate_thres: float = 1.0
    expected_method: Literal["mantel-haentzel", "poisson", "negative-binomial"] = "mantel-haentzel"
    method_alpha: float = 1.0
    minimization_method: str = "Nelder-Mead"


class LASSOConfigSchema(BaseModel):
    enabled: bool = False
    lasso_thresh: float = 0.0
    alpha: float = 0.5
    min_events: int = 3
    num_bootstrap: int = 10
    ci: int = 95
    use_lars: bool = False
    use_IC: bool = False
    IC_criterion: Literal["aic", "bic"] = "bic"
    use_glm: bool = False
    nb_alpha: float = 1.0
    lasso_alpha: float = 1e-9
    family: Literal["logistic", "poisson"] = "logistic"
    relaxed: bool = True
    n_jobs: int = 1


class SCOREConfigSchema(BaseModel):
    enabled: bool = False
    latent_rank: int = 5
    syndromic_weight: float = 0.5
    sparsity_param: float = 1.0
    fdr_threshold: float = 0.05
    deflate_iterations: int = 2
    min_events: int = 1
    max_iter: int = 50
    tol: float = 0.0001
    n_jobs: int = 1
    seed: int = 42


class RunAnalysisRequest(BaseModel):
    prr: Optional[PRRConfigSchema] = None
    ror: Optional[RORConfigSchema] = None
    rfet: Optional[RFETConfigSchema] = None
    bcpnn: Optional[BCPNNConfigSchema] = None
    gps: Optional[GPSConfigSchema] = None
    lasso: Optional[LASSOConfigSchema] = None
    score_da: Optional[SCOREConfigSchema] = None
    score: Optional[SCOREConfigSchema] = None
    consensus: bool = True


class JobStatusResponse(BaseModel):
    job_id: str
    status: Literal["idle", "running", "completed", "failed", "cancelled"]
    progress: float = 0.0
    step: str = ""
    error: Optional[str] = None
    total_signals: int = 0
    total_candidates: int = 0


# --- Query & Virtual Table Schemas ---

class SignalQueryRequest(BaseModel):
    offset: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=500)
    search: Optional[str] = None
    tiers: Optional[List[str]] = None
    methods: Optional[List[str]] = None
    min_count: Optional[float] = None
    min_votes: Optional[int] = None
    min_score: Optional[float] = None
    sort_by: Optional[str] = "composite_rank"
    sort_dir: Literal["asc", "desc"] = "asc"


class SignalRow(BaseModel):
    product: str
    adverse_event: str
    count: float
    expected_count: Optional[float] = None
    votes: int = 0
    total_methods: int = 0
    consensus_score: float = 0.0
    agreement_tier: str = "Isolated"
    composite_rank: Optional[float] = None
    method_scores: Dict[str, Optional[float]] = {}
    method_alerts: Dict[str, bool] = {}


class SignalQueryResponse(BaseModel):
    total_records: int
    filtered_records: int
    offset: int
    limit: int
    rows: List[SignalRow]
    methods: List[str]


class MethodSignalInspection(BaseModel):
    method: str
    alert: bool
    metric: str
    score: Optional[float]
    ci_lower: Optional[float]
    ci_upper: Optional[float]
    p_value: Optional[float]
    fdr: Optional[float]
    count: Optional[float]
    expected_count: Optional[float]
    threshold: Optional[str] = None
    threshold_metric: Optional[str] = None



class InspectSignalResponse(BaseModel):
    product: str
    adverse_event: str
    votes: int
    total_methods: int
    consensus_score: float
    agreement_tier: str
    composite_rank: Optional[float]
    count: float
    expected_count: Optional[float]
    methods: List[MethodSignalInspection]


class ConcordanceResponse(BaseModel):
    methods: List[str]
    jaccard: Dict[str, Dict[str, float]]
    cohens_kappa: Dict[str, Dict[str, float]]
    spearman_correlation: Dict[str, Dict[str, float]]
    alert_overlap: Dict[str, Dict[str, int]]


class Contingency2x2Response(BaseModel):
    method_a: str
    method_b: str
    table: Dict[str, Dict[str, int]]  # e.g. {"Alert_A": {"Alert_B": 10, "NoAlert_B": 5}, ...}


# --- Longitudinal Schemas ---

class LongitudinalRunRequest(BaseModel):
    method: Literal["prr", "ror", "rfet", "bcpnn", "gps", "lasso", "score_da", "score", "all"] = "bcpnn"
    methods: Optional[List[Literal["prr", "ror", "rfet", "bcpnn", "gps", "lasso", "score_da", "score"]]] = None
    time_unit: Literal["YE", "QE", "ME"] = "YE"
    mode: Literal["cumulative", "disjoint"] = "cumulative"
    include_gaps: bool = False
    min_events: int = 3
    decay_half_life: Optional[str] = None  # e.g. "365D", "730D", "180D", or None
    decision_thres: Optional[float] = None
    relative_risk: Optional[float] = None
    ranking_statistic: Optional[str] = None
    continuity_correction: Optional[Union[float, bool]] = None
    alpha: Optional[float] = None


class LongitudinalTrajectoryRequest(BaseModel):
    product: str
    adverse_event: str
    method: Optional[str] = None


class TrajectoryPoint(BaseModel):
    timestamp: str
    score: Optional[float]
    ci_lower: Optional[float]
    ci_upper: Optional[float]
    count: Optional[float]
    alert: bool


class LongitudinalTrajectoryResponse(BaseModel):
    product: str
    adverse_event: str
    method: str
    trajectory: List[TrajectoryPoint]
    multi_trajectories: Optional[Dict[str, List[TrajectoryPoint]]] = None
    onset_dates: Optional[Dict[str, Optional[str]]] = None
    computed_methods: List[str] = []


class LongitudinalSignalItem(BaseModel):
    product: str
    adverse_event: str
    first_onset: Optional[str] = None
    latest_timestamp: Optional[str] = None
    peak_score: Optional[float] = None
    latest_score: Optional[float] = None
    count: float = 0.0
    slices_alerted: int = 0
    total_slices: int = 0
    consecutive_alert_slices: Optional[int] = 0
    avg_peak_score: Optional[float] = None
    method: str
    consensus_score: Optional[float] = None
    agreement_tier: Optional[str] = None
    methods_alerted: List[str] = []


class LongitudinalSignalsResponse(BaseModel):
    signals: List[LongitudinalSignalItem]
    total: int
    computed_methods: List[str]
    has_consensus: bool



class ExportRequest(BaseModel):
    format: Literal["xlsx", "csv"] = "xlsx"
    destination_path: Optional[str] = None
    filtered_only: bool = False


# --- New Advanced Analytical Schemas ---

class VolcanoPoint(BaseModel):
    product: str
    adverse_event: str
    score: float
    effect_size: float
    p_value: Optional[float] = None
    neg_log_p: float
    fdr: Optional[float] = None
    alert: bool
    count: float
    votes: int = 0
    agreement_tier: str = "Isolated"
    method: str


class VolcanoResponse(BaseModel):
    points: List[VolcanoPoint]
    total: int
    method: str
    threshold_effect: float = 1.0
    threshold_neg_log_p: float = 1.30103  # -log10(0.05)


class DataProfileResponse(BaseModel):
    total_rows: int
    unique_products: int
    unique_aes: int
    unique_pairs: int
    missing_product_pct: float
    missing_ae_pct: float
    missing_count_pct: float
    missing_date_pct: float
    duplicate_cases: int
    duplicate_case_pct: float
    quality_score: float
    recommendations: List[str]


class DDIEdge(BaseModel):
    drug_a: str
    drug_b: str
    event: str
    combo_count: int
    expected_combo: float
    excess_score: float
    archetype: Literal["EMERGENT", "POTENTIATED", "TWO_HIT", "MULTI_HIT"]


class DDINetworkResponse(BaseModel):
    edges: List[DDIEdge]
    unique_events: List[str]
    top_drugs: List[str]
    total_synergies: int


class VersionResponse(BaseModel):
    installed_version: str
    latest_pypi_version: str = "3.4.0"
    is_latest: bool = True
    pypi_url: str = "https://pypi.org/project/vigipy/"
    supported_methods: List[str] = ["PRR", "ROR", "RFET", "BCPNN", "GPS", "LASSO", "SCORE", "SCORE_DDI"]
    release_date: Optional[str] = "2026-10-01"
    summary: Optional[str] = "Consensus Engine, Relaxed LASSO & Longitudinal Pipeline"
