# vigipy Studio - Architecture & vigipy Wrapper Specification

## Architecture Overview
vigipy Studio is designed as a **visual harness and execution wrapper** around the official upstream **[vigipy](https://github.com/Shakesbeery/vigipy)** Python library (PyPI: `vigipy>=3.4.0`).

### 1. Dual-Layer Architecture
1. **Interactive Client UI & Visual Explorer (Frontend)**:
   - Provides reactive exploratory data analysis, real-time filtering, interactive volcano plot box-zooming, master-detail signal inspection, and 1-click vector export (SVG/PNG).
   - Embedded client-side statistical engine mirrors vigipy 3.4.0's algorithms with identical mathematical formulations, giving immediate zero-latency feedback before launching large batch jobs.
2. **Official Python Engine Wrapper (`wrapper/vigipy_wrapper.py`)**:
   - Directly executes the upstream `vigipy` Python library on your local machine, server, or cloud data lake.
   - Converts tabular datasets (`.csv`, `.xlsx`, `.parquet`) into native vigipy `DataContainer` instances (`vg.convert()`, `vg.convert_binary()`, `vg.convert_ddi()`).
   - Calls official vigipy algorithms: `vg.prr()`, `vg.ror()`, `vg.rfet()`, `vg.bcpnn()`, `vg.gps()`, `vg.lasso()`, `vg.score_da()`, `vg.score_ddi()`, and `vg.consensus_analysis()`.
   - Generates compliant multi-sheet regulatory workbooks matching `vigipy.export()`.

### 2. Supported Methods
- **SCORE-DA**: Syndromic Clustering & Optimization for Residual Excess Disproportionality Analysis
- **SCORE-DDI**: Multi-drug Drug-Drug Interaction risk modeling
- **PRR**: Proportional Reporting Ratio (Evans et al., MHRA standard)
- **ROR**: Reporting Odds Ratio with logistic lower-bound cutoffs (van Puijenbroek)
- **BCPNN**: Bayesian Confidence Propagation Neural Network (Information Component, WHO-UMC)
- **GPS**: Gamma-Poisson Shrinker / Empirical Bayes Geometric Mean (DuMouchel, FDA)
- **RFET**: Restricted Fisher's Exact Test with mid-p exact probabilities
- **LASSO**: L1-regularized multi-variable logistic regression against polypharmacy bias

### 3. Python CLI Execution
```bash
# Install upstream vigipy
pip install "vigipy[excel]>=3.4.0"

# Run disproportionality consensus via wrapper
python wrapper/vigipy_wrapper.py --input surveillance_data.parquet --method consensus --output results.xlsx

# Run SCORE-DA disproportionality analysis
python wrapper/vigipy_wrapper.py --input surveillance_data.csv --method SCORE --output score_signals.json
```
