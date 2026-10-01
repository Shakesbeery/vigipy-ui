/**
 * Mathematical & Statistical routines for vigipy implementations:
 * - Special functions: lnGamma, erf, normal CDF & quantiles
 * - Exact hypergeometric calculations & mid-p value for Fisher's test (RFET)
 * - Chi-square 1-df p-values & Yates continuity correction
 * - Benjamini-Hochberg step-up procedure for FDR control
 * - Numerical stability & continuity corrections (Haldane-Anscombe)
 */

// Error function approximation (Abramowitz and Stegun 7.1.26)
export function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const a = Math.abs(x);
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const t = 1.0 / (1.0 + p * a);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-a * a);
  return sign * y;
}

// Standard Normal CDF: Phi(z)
export function normalCdf(z: number): number {
  return 0.5 * (1.0 + erf(z / Math.SQRT2));
}

// Standard Normal Quantile (Inverse Normal CDF) using rational approximation (Acklam)
export function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) {
    if (p <= 0) return -Infinity;
    return Infinity;
  }

  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];

  const q = p < 0.5 ? p : 1 - p;
  let r: number;

  if (q > 0.02425) {
    // Central region
    const u = q - 0.5;
    const t = u * u;
    r = u * (((((a[0] * t + a[1]) * t + a[2]) * t + a[3]) * t + a[4]) * t + a[5]) /
      (((((b[0] * t + b[1]) * t + b[2]) * t + b[3]) * t + b[4]) * t + 1);
  } else {
    // Tail region
    const t = Math.sqrt(-2 * Math.log(q));
    r = (((((c[0] * t + c[1]) * t + c[2]) * t + c[3]) * t + c[4]) * t + c[5]) /
      ((((d[0] * t + d[1]) * t + d[2]) * t + d[3]) * t + 1);
    if (p < 0.5) r = -r;
  }

  return r;
}

// Log Gamma function (Lanczos approximation)
export function logGamma(z: number): number {
  const g = 7;
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.138571095836524,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  }

  z -= 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) {
    x += p[i] / (z + i);
  }

  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

// Log combination log(n choose k)
export function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  if (k === 0 || k === n) return 0;
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

// Chi-square p-value for 1 degree of freedom: P(ChiSq_1 >= x) = 2 * (1 - Phi(sqrt(x)))
export function chiSquarePValue(chiSq: number): number {
  if (chiSq <= 0) return 1.0;
  const z = Math.sqrt(chiSq);
  const p = 2.0 * (1.0 - normalCdf(z));
  return Math.min(Math.max(p, 0.0), 1.0);
}

/**
 * Fisher's exact test for 2x2 contingency table:
 * [[a, b], [c, d]] where
 * a = n11, b = n10
 * c = n01, d = n00
 *
 * Supports mid-p correction (midP=true), which vigipy advocates to correct
 * for over-conservatism of Fisher's exact test on discrete tables.
 */
export function fishersExactTest(
  a: number,
  b: number,
  c: number,
  d: number,
  midP: boolean = true,
  alternative: 'greater' | 'two-sided' | 'less' = 'greater'
): number {
  const row1 = a + b;
  const row2 = c + d;
  const col1 = a + c;
  const n = row1 + row2;

  // Range of possible values for cell 'a'
  const minA = Math.max(0, col1 - row2);
  const maxA = Math.min(row1, col1);

  // Hypergeometric PMF: P(X = x) = (row1 choose x) * (row2 choose (col1 - x)) / (n choose col1)
  const logDenominator = logChoose(n, col1);
  const getPmf = (x: number): number => {
    const logP = logChoose(row1, x) + logChoose(row2, col1 - x) - logDenominator;
    return Math.exp(logP);
  };

  const observedProb = getPmf(a);

  if (alternative === 'greater') {
    let pSum = 0;
    for (let x = a + 1; x <= maxA; x++) {
      pSum += getPmf(x);
    }
    if (midP) {
      return pSum + 0.5 * observedProb;
    }
    return pSum + observedProb;
  } else if (alternative === 'less') {
    let pSum = 0;
    for (let x = minA; x < a; x++) {
      pSum += getPmf(x);
    }
    if (midP) {
      return pSum + 0.5 * observedProb;
    }
    return pSum + observedProb;
  } else {
    // Two-sided test
    let pSum = 0;
    const eps = 1e-12;
    for (let x = minA; x <= maxA; x++) {
      const px = getPmf(x);
      if (px <= observedProb + eps) {
        if (midP && Math.abs(x - a) < 1e-6) {
          pSum += 0.5 * px;
        } else {
          pSum += px;
        }
      }
    }
    return Math.min(1.0, pSum);
  }
}

/**
 * Benjamini-Hochberg False Discovery Rate (FDR) step-up procedure
 * Ensures step-up monotonicity: q_i <= q_{i+1}
 */
export function computeBenjaminiHochbergFDR(pValues: number[]): number[] {
  const m = pValues.length;
  if (m === 0) return [];

  // Indices sorted by p-value ascending
  const indices = Array.from({ length: m }, (_, i) => i);
  indices.sort((i1, i2) => pValues[i1] - pValues[i2]);

  const qValues = new Array<number>(m);
  let minQ = 1.0;

  // Step backward from largest p-value to smallest to enforce monotonicity
  for (let rank = m; rank >= 1; rank--) {
    const idx = indices[rank - 1];
    const p = pValues[idx];
    const rawQ = (p * m) / rank;
    minQ = Math.min(minQ, rawQ);
    qValues[idx] = Math.min(1.0, Math.max(0.0, minQ));
  }

  return qValues;
}

/**
 * Format scientific or decimal numbers cleanly for medical analytics UI
 */
export function formatFloat(val: number | undefined, decimals: number = 2): string {
  if (val === undefined || isNaN(val)) return '—';
  if (Math.abs(val) < 0.001 && val !== 0) {
    return val.toExponential(2);
  }
  return val.toFixed(decimals);
}
