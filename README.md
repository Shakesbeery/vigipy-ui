# vigipy-ui

> **Modern, High-Performance Pharmacovigilance & Disproportionality Signal Detection UI**  
> Designed for [`vigipy`](https://github.com/vigipy/vigipy) — Built for spontaneous reporting databases (FDA FAERS, MAUDE, WHO VigiBase, EudraVigilance).

---

## Key Features

* **Multi-Million Row Scalability**:
  * Vectorized in-memory indexing in C/Python (pandas/NumPy).
  * Server-side virtual windowing (`offset`/`limit`) keeps client memory under **40 MB** at 60 FPS scrolling, even when evaluating $1,000,000+$ candidate drug-event pairs.
* **Intelligent File Ingestion**:
  * Drag-and-drop support for `.csv`, `.tsv`, `.xlsx`, and `.parquet`.
  * Visual column mapping with heuristic auto-detection (`Product`, `Adverse Event`, `Count`, `Date`).
  * **Auto-Populate Count**: For unaggregated incident reports (1 row = 1 case) that lack an explicit count column, a one-click toggle auto-populates counts (default: `1`).
  * **Pre-flight Overdispersion Testing**: Runs `vigipy.utils.expectations.test_dispersion()` to automatically recommend Mantel-Haenszel vs. Negative-Binomial assumptions.
* **Unified Method Configuration Studio**:
  * Full parametric configuration for:
    * **PRR** (Proportional Reporting Ratio)
    * **ROR** (Reporting Odds Ratio)
    * **RFET** (Reporting Fisher's Exact Test)
    * **BCPNN** (Bayesian Confidence Propagation Neural Network)
    * **GPS / MGPS** (Multi-item Gamma Poisson Shrinker)
    * **LASSO** (L1-penalized multivariate logistic / Poisson GLM)
  * Asynchronous background execution with live step progress telemetry.
* **Cross-Method Consensus & Concordance Explorer**:
  * Signal voting tally and normalized consensus scoring across methods.
  * Agreement tiers: 🟢 **Unanimous**, 🔵 **Strong**, 🟡 **Moderate**, 🟠 **Weak**, ⚪ **Isolated**.
  * Interactive concordance heatmaps: **Jaccard Similarity**, **Cohen's Kappa**, **Spearman Rank Correlation**, and **Alert Overlap**.
  * Pairwise $2 \times 2$ alert contingency table inspector with marginal totals.
* **Master-Detail Drill-Down & Interactive Forest Plots**:
  * Slide-over inspector drawer for deep inspection of any candidate signal.
  * Interactive SVG **Forest Plot** displaying point estimates and 95% Confidence / Credibility Intervals across all evaluated methods (with Log / Linear scale toggle).
  * Observed ($N$) vs. Expected ($E$) contingency statistics and disproportionality ratio ($N/E$).
* **Volcano Plot Visualizer**:
  * Effect Size vs. Statistical Significance ($-\log_{10}(p)$ / FDR) scatter visualization.
  * Quadrant reference guidelines, box-zoom, interactive tooltip hover, and click-to-inspect.
* **Drug-Drug Interaction (DDI) Network Graph**:
  * Discovery of multi-drug combination synergies and interaction archetypes (`EMERGENT`, `POTENTIATED`, `TWO_HIT`, `MULTI_HIT`).
  * Interactive node-link topology clustered by adverse event.
* **Longitudinal Signal Tracking & Multi-Signal Comparison**:
  * Time-series trajectory visualizer over historical time slices (yearly, quarterly, monthly; cumulative vs. disjoint).
  * Shaded confidence interval bands and alert onset indicators.
  * **Multi-Signal Comparison**: Overlay multiple candidate signals simultaneously with per-line toggles, peak score badges, and publication-ready SVG/PNG export.
* **Live openFDA Streaming**:
  * Direct querying against live U.S. FDA servers (FAERS drug reports & MAUDE medical device adverse events) with one-click streaming ingestion into vigipy.
* **Data Quality Profiler & Hygiene Diagnostics**:
  * Pre-flight missingness percentages, duplicate case reporting detection, and automated hygiene scoring.
* **GxP / 21 CFR Part 11 Regulatory Audit Dossier**:
  * Generation of complete surveillance dossiers, timestamped audit manifests, and multi-sheet Excel reports.
* **Reproducible Python Script Generator**:
  * Instant code generation translating active GUI configurations and filters into standalone, reproducible Python scripts utilizing raw `vigipy` library calls.
* **Live Pipeline Control**:
  * Background asynchronous execution with immediate cancellation support.
* **Comprehensive Export & Re-Import**:
  * Multi-sheet Excel (`.xlsx`) workbooks via `openpyxl` (`Consensus Signals`, `Comparison Table`, `Agreement Matrices`).
  * Fast filtered CSV and Parquet export.
  * Re-import previous `.xlsx`, `.csv`, or `.parquet` runs without recalculating.

---

## Architecture Overview

```
+---------------------------------------------------------------------------------------+
|                                    vigipy-ui Architecture                             |
|                                                                                       |
|  [ Presentation Layer ]                                                               |
|  - React 18 + TypeScript + Tailwind CSS                                              |
|  - TanStack Virtual Table (sub-millisecond DOM windowing)                             |
|  - Interactive SVG Forest Plots & Concordance Heatmaps                                |
|                                                                                       |
|                        ↕ HTTP / WebSocket (http://127.0.0.1:8765)                      |
|                                                                                       |
|  [ Computational Sidecar Engine ]                                                     |
|  - Python FastAPI + Uvicorn background daemon                                         |
|  - Vectorized In-Memory Query & Slicing State                                         |
|  - Core DA Engine: vigipy (PRR, ROR, RFET, BCPNN, GPS, LASSO, Consensus, Longitudinal)|
+---------------------------------------------------------------------------------------+
```

---

## Getting Started

### Prerequisites

Ensure you have Python 3.9+ with `vigipy` installed:

```bash
# In your vigipy conda or venv environment:
pip install -r backend/requirements.txt
```

### Quick Launch (1-Click Run)

To launch the full application (starts the backend engine and opens the standalone desktop app window or default browser):

```bash
python run_app.py
```

Or on Windows, simply double-click or run:

```powershell
python run_app.py
```

The application will be accessible at:
👉 **`http://127.0.0.1:8765/`**

---

## Sample Testing with Included Dataset

For rapid evaluation, `vigipy` includes a MAUDE medical device reporting extract:
`G:\My Drive\GitStuff\vigipy\examples\DYB.csv` (43,492 reports).

1. Launch `python run_app.py`.
2. In the **File Selection** screen, click **"Load Sample MAUDE DYB Dataset"** (or paste the path above).
3. The **Column Mapping Wizard** will automatically pre-select:
   - **Product**: `REDUCED_NAME`
   - **Adverse Event**: `Event`
   - **Count**: `count` (or test toggling **Auto-populate Count** with count=1)
   - **Date**: `DATE_OF_EVENT`
4. Review the **Pre-flight Overdispersion Test** badge (indicates overdispersion with $\alpha \approx 3.55$, recommending negative-binomial expected counts).
5. Click **"Confirm & Ingest Dataset"** — consensus analysis will run and display thousands of detected signals in the interactive grid!

---

## Desktop Packaging (Tauri v2)

The application includes full Tauri v2 configuration in `src-tauri/` for compiling zero-dependency standalone installers (`.msi` / `.exe` on Windows, `.AppImage` / `.deb` on Linux, `.dmg` on macOS):

```bash
# Build the production frontend assets:
cd .vigipy-ui-modules
pnpm run build

# Compile native desktop installer:
cargo tauri build
```
