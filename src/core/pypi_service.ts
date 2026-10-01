/**
 * PyPI & GitHub Release Tracking Service for vigipy
 * Checks PyPI (pypi.org/pypi/vigipy/json) and GitHub releases to keep DA methodologies
 * in sync with the library's latest releases and allows pinning specific versions.
 */

import { VigipyVersionInfo } from '../types/version';

export const KNOWN_VIGIPY_VERSIONS: VigipyVersionInfo[] = [
  {
    version: '3.4.0',
    releaseDate: '2026-10-01',
    isLatest: true,
    status: 'stable',
    summary: 'SCORE-DA & SCORE-DDI, Consensus Engine, Relaxed LASSO & Longitudinal Pipeline',
    changelog: [
      'SCORE-DA: Truncated SVD indication absorption and Graph Laplacian syndromic borrowing to eliminate blockbuster masking',
      'SCORE-DDI: Higher-order multi-drug interaction discovery (k=2, k=3, ...) with unbiased solo baselines and epidemiological archetype classification (EMERGENT, POTENTIATED, TWO_HIT, MULTI_HIT)',
      'Cross-Method Consensus Engine (consensus_analysis) with vote tallying, agreement tiers (Unanimous, Strong, Moderate, Weak, Isolated), Jaccard similarity, and Cohen\'s Kappa concordance matrices',
      'Two-Stage Relaxed LASSO with debiased adjusted reporting odds ratios (aROR), Wald standard errors, and clinical covariate adjustment (Age, Sex)',
      '3 Typed DataContainers: convert() for counts, convert_binary() for case-level sparse reports, and convert_ddi() for drug regimens',
      'Production-Grade LongitudinalModel with Cumulative (run) and Disjoint (run_disjoint) modes, CPU parallelism, and hyperprior warm-starting',
      'Structured AnalysisResult and ConsensusResult with multi-tab Excel (.xlsx), Parquet (.parquet), and CSV export utilities',
    ],
    supportedMethods: ['PRR', 'ROR', 'RFET', 'BCPNN', 'GPS', 'LASSO', 'SCORE', 'SCORE_DDI'],
    pypiAvailable: true,
    gitRef: 'v3.4.0',
    pipCommand: 'pip install vigipy==3.4.0',
  },
  {
    version: '3.3.1',
    releaseDate: '2026-09-29',
    isLatest: false,
    status: 'stable',
    summary: 'Multi-Core Time-Slice Parallelism & Closed-Form Analytical GPS Likelihoods',
    changelog: [
      'Vectorized multi-core time-slice evaluations in LongitudinalModel',
      'Closed-form analytical GPS likelihoods for 10x faster hyperparameter optimization',
      'Sparse CSR matrix memory optimization for large-scale FAERS cohorts',
    ],
    supportedMethods: ['PRR', 'ROR', 'RFET', 'BCPNN', 'GPS', 'LASSO'],
    pypiAvailable: true,
    gitRef: 'v3.3.1',
    pipCommand: 'pip install vigipy==3.3.1',
  },
  {
    version: '0.2.1',
    releaseDate: '2024-10-15',
    isLatest: false,
    status: 'stable',
    summary: 'Decision-Theoretic Bayesian Metrics & Mid-p RFET Enhancement',
    changelog: [
      'Corrected Benjamini-Hochberg FDR step-up monotonicity for multiple testing',
      'Implemented mid-p value parameter for Reporting Fishers Exact Test (RFET)',
      'Added decision-theoretic Bayesian performance metrics (FDR, FNR, FOR, Se, Sp)',
      'Optimized SciPy C-routines for vectorized contingency matrix evaluation',
      'Enhanced Haldane-Anscombe (+0.5) zero-cell continuity corrections',
    ],
    supportedMethods: ['PRR', 'ROR', 'RFET', 'BCPNN', 'GPS', 'LASSO'],
    pypiAvailable: true,
    gitRef: 'v0.2.1',
    pipCommand: 'pip install vigipy==0.2.1',
  },
  {
    version: '0.2.0',
    releaseDate: '2024-06-20',
    isLatest: false,
    status: 'stable',
    summary: 'Longitudinal Modeling & LASSO Multivariate Confounding Control',
    changelog: [
      'Introduced LongitudinalModel class supporting Cumulative & Disjoint time windows',
      'Added multiple baseline expectation models (Standard, Poisson, Mantel-Haenszel)',
      'Implemented LASSO L1-penalized multivariate coordinate descent regression',
      'Polypharmacy and co-prescription confounding adjustment algorithms',
    ],
    supportedMethods: ['PRR', 'ROR', 'RFET', 'BCPNN', 'GPS', 'LASSO'],
    pypiAvailable: true,
    gitRef: 'v0.2.0',
    pipCommand: 'pip install vigipy==0.2.0',
  },
  {
    version: '0.1.5',
    releaseDate: '2024-01-10',
    isLatest: false,
    status: 'stable',
    summary: 'Core Disproportionality Methods & Vectorized PhViD Translation',
    changelog: [
      'Unified analyze() and analyze_all() interfaces',
      'Type-safe PRRConfig, RORConfig, RFETConfig, BCPNNConfig, GPSConfig dataclasses',
      'Vectorized NumPy and SciPy implementations replacing SymPy bottlenecks',
      'Two-component Gamma mixture Empirical Bayes Gamma Poisson Shrinker (MGPS)',
    ],
    supportedMethods: ['PRR', 'ROR', 'RFET', 'BCPNN', 'GPS'],
    pypiAvailable: true,
    gitRef: 'v0.1.5',
    pipCommand: 'pip install vigipy==0.1.5',
  },
];

export interface PyPICheckResult {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  source: 'pypi' | 'github' | 'cached';
  lastChecked: string;
  versions: VigipyVersionInfo[];
  rawInfo?: any;
}

export async function checkPyPIForUpdates(currentVersion: string = '3.4.0'): Promise<PyPICheckResult> {
  const now = new Date().toISOString();

  // 1. Try PyPI official JSON API endpoint
  try {
    const pypiResponse = await fetch('https://pypi.org/pypi/vigipy/json', {
      headers: { Accept: 'application/json' },
    });

    if (pypiResponse.ok) {
      const data = await pypiResponse.json();
      const pypiVersion = data.info?.version || currentVersion;
      const releases = Object.keys(data.releases || {});

      const updatedVersions = [...KNOWN_VIGIPY_VERSIONS];
      if (pypiVersion && !updatedVersions.some((v) => v.version === pypiVersion)) {
        updatedVersions.unshift({
          version: pypiVersion,
          releaseDate: now.substring(0, 10),
          isLatest: true,
          status: 'stable',
          summary: data.info?.summary || 'Latest release from PyPI',
          changelog: ['Official PyPI release: ' + (data.info?.summary || 'New disproportionality updates')],
          supportedMethods: ['PRR', 'ROR', 'RFET', 'BCPNN', 'GPS', 'LASSO'],
          pypiAvailable: true,
          gitRef: `v${pypiVersion}`,
          pipCommand: `pip install vigipy==${pypiVersion}`,
        });
      }

      return {
        hasUpdate: pypiVersion !== currentVersion,
        latestVersion: pypiVersion,
        currentVersion,
        source: 'pypi',
        lastChecked: now,
        versions: updatedVersions,
        rawInfo: data.info,
      };
    }
  } catch (e) {
    // Continue to GitHub fallback
  }

  // 2. Fallback to GitHub repository releases endpoint: Shakesbeery/vigipy
  try {
    const ghResponse = await fetch('https://api.github.com/repos/Shakesbeery/vigipy/releases/latest', {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (ghResponse.ok) {
      const ghData = await ghResponse.json();
      const rawTag = ghData.tag_name || '';
      const ghVersion = rawTag.replace(/^v/, '');

      return {
        hasUpdate: ghVersion !== currentVersion && ghVersion !== '',
        latestVersion: ghVersion || currentVersion,
        currentVersion,
        source: 'github',
        lastChecked: now,
        versions: KNOWN_VIGIPY_VERSIONS,
        rawInfo: ghData,
      };
    }
  } catch (e) {
    // Network or rate limit fallback
  }

  // 3. Fallback: Return verified cached version matrix
  return {
    hasUpdate: false,
    latestVersion: KNOWN_VIGIPY_VERSIONS[0].version,
    currentVersion,
    source: 'cached',
    lastChecked: now,
    versions: KNOWN_VIGIPY_VERSIONS,
  };
}
