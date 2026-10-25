# vigipy-ui

<div align="center">

[![vigipy](https://img.shields.io/badge/vigipy-v3.5.1-blue.svg?style=flat-square)](https://github.com/Shakesbeery/vigipy)
[![Python](https://img.shields.io/badge/Python-3.9%2B-blue.svg?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-FFC131.svg?style=flat-square&logo=tauri&logoColor=black)](https://tauri.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

**Enterprise-Grade Pharmacovigilance & Safety Surveillance Desktop Suite**  
*Directly powered by the [`vigipy`](https://github.com/Shakesbeery/vigipy) computational engine.*

[Key Features](#key-features) • [Statistical Paradigms](#statistical-paradigms--methods) • [Quick Start](#quick-start) • [Architecture](#architecture) • [Regulatory & GxP](#regulatory--gxp-compliance) • [Desktop Build](#desktop-packaging-tauri-v2)

</div>

---

## Overview

**`vigipy-ui`** is a high-performance pharmacovigilance and signal detection application designed for safety scientists, quantitative epidemiologists, and regulatory reviewers. It provides an intuitive, high-throughput graphical interface for spontaneous reporting databases—including **FDA FAERS**, **CDC/FDA VAERS**, **FDA MAUDE**, **WHO VigiBase**, and **EudraVigilance**.

Built on top of the **`vigipy` v3.5.1** algorithmic engine, `vigipy-ui` pairs sub-millisecond virtualized data rendering with state-of-the-art disproportionality analytics, confounding debiasing, multi-drug interaction discovery, and prospective sequential surveillance.

---

## Key Features

### ⚡ Multi-Million Row Scalability & Virtualized Grid
- **Sub-40 MB DOM Footprint**: Server-side windowed paging (`offset`/`limit`) maintains consistent 60 FPS scrolling across tables with $1,000,000+$ candidate drug-event pairs.
- **Fast Search & Multi-Tier Filtering**: Filter across consensus agreement tiers, minimum reporting counts, vote thresholds, and free-text queries with zero client latency.
- **Unified Composite Ranking**: Review candidate pairs sorted by consensus rank, signal strength, or raw reporting volume.

### 🔬 12 Disproportionality & Surveillance Methods Across 5 Paradigms
- Comprehensive coverage spanning **Frequentist**, **Empirical Bayes shrinkage**, **Indication unmasking**, **DDI synergy**, and **Sequential surveillance** algorithms.
- Full parametric tuning with clinically-guided primary sliders and collapsible advanced mathematical drawers.
- Direct invocation of native `vigipy` dataclasses (`PRRConfig`, `RORConfig`, `BCPNNConfig`, `GPSConfig`, `ZIGPSConfig`, `AEGISConfig`, `MaxSPRTConfig`, `CUSUMConfig`, `SCOREConfig`, `SCOREDDIConfig`).

### 🤝 Cross-Method Consensus & Concordance Explorer
- **Consensus Tallying**: Signal voting across all active algorithms with agreement tiering:
  - 🟢 **Unanimous** | 🔵 **Strong** | 🟡 **Moderate** | 🟠 **Weak** | ⚪ **Isolated**
- **Concordance Heatmaps**: Dynamic cross-method agreement matrices computing **Jaccard Similarity**, **Cohen’s Kappa**, **Spearman Rank Correlation**, and **Alert Overlap**.
- **Contingency Inspector**: Interactive $2 \times 2$ alert contingency table displaying concordant alerts, discordant flags, and marginal frequencies.

### 🔎 Slide-Over Signal Inspector & Forest Plots
- **Deep Signal Inspection**: Comprehensive drawer displaying observed vs. expected counts ($N$ vs. $E$), disproportionality ratio ($N/E$), and method-specific alert badges.
- **Pair Telemetry Badges**: Surface specialized metrics from `vigipy` v3.5.1:
  - **Unmasking Ratio** & **Surge Velocity** (AEGIS)
  - **$\pi_0$ Structural Zero Probability** (ZIGPS)
  - **Sequential Critical Value (CV)** (MaxSPRT)
  - **Martingale $e$-Value** (AEGIS)
- **Interactive SVG Forest Plot**: Point estimates with 95% Confidence / Credibility Intervals across all evaluated methods, complete with Log / Linear scaling and null reference lines.

### 🌋 Dynamic Volcano Plot
- **Dual-Metric Scatter Visualization**: Maps Effect Size (log-scale risk or shrinkage score) against Statistical Significance ($-\log_{10}(p)$ / FDR).
- **Quadrant Alert Boundaries**: Configurable significance and effect thresholds with interactive hover tooltips, box-zoom, and one-click signal selection.
- **Method Switcher**: Instantly switch the volcano axes between PRR, ROR, RFET, BCPNN, GPS, ZIGPS, AEGIS, MaxSPRT, and CUSUM.

### 📈 Longitudinal Surveillance & Multi-Signal Trajectories
- **Time-Series Tracking**: Track disproportionality score evolution over yearly (`YE`), quarterly (`QE`), or monthly (`ME`) intervals in cumulative or disjoint windows.
- **Sequential Alert Onset**: Pinpoint exact time periods when cumulative signals first crossed statistical decision thresholds.
- **Multi-Signal Overlay**: Compare trajectories of multiple drug-event pairs simultaneously with custom color palettes, per-series visibility toggles, and publication-ready SVG / 300-DPI PNG export.

### 🕸️ Drug-Drug Interaction (DDI) Network Graph
- **High-Order Combination Synergy**: Uncover synergistic adverse events driven by polypharmacy using regularized regression and tensor decomposition.
- **Interaction Archetypes**: Classify interaction patterns into `EMERGENT`, `POTENTIATED`, `TWO_HIT`, and `MULTI_HIT`.
- **Force-Directed Topology**: Interactive SVG network visualizing product hubs and shared adverse event clusters.

### 🗄️ Ingestion, Overdispersion & Safety Warehouse
- **Drag-and-Drop Ingestion**: Ingest `.csv`, `.tsv`, `.xlsx`, and `.parquet` files with heuristic column mapping (`Product`, `Adverse Event`, `Count`, `Date`).
- **Auto-Populate Counts**: One-click normalization for unaggregated incident-level datasets (1 row = 1 incident).
- **Pre-flight Overdispersion Testing**: Runs `vigipy.utils.expectations.test_dispersion()` to automatically evaluate Poisson vs. Negative-Binomial distribution assumptions.
- **Safety Data Warehouse**: Offline multi-database explorer for local FAERS quarterly archives (2012+), VAERS vaccine reports, and MAUDE device incidents with drug-family cohort builders.
- **Live openFDA Streaming**: Direct API streaming from U.S. FDA servers for rapid benchmarking.

### 📋 GxP / 21 CFR Part 11 Regulatory Audit Dossier
- **Reproducible Python Script Generator**: Generates standalone, typed, PEP 8 Python scripts replicating active GUI configurations and filters using the raw `vigipy` library.
- **Multi-Sheet Excel Reports**: Export audit-ready workbooks containing consensus signals, comparison tables, and agreement matrices.
- **State Serialization**: Save and reload completed analyses without recomputation.

---

## Statistical Paradigms & Methods

`vigipy-ui` structures its signal detection toolkit into 5 specialized statistical paradigms:

| Paradigm | Methods | Key Metric | Decision Rule | Clinical Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Frequentist Disproportionality** | **PRR**<br>**ROR**<br>**RFET** | PRR<br>ROR<br>$p$-value / FDR | $\text{Score} \ge 2.0$, $N \ge 3$<br>$\text{Score} \ge 2.0$, $N \ge 3$<br>$\text{FDR} < 0.05$ | Baseline screening, rapid signal triage, regulatory disproportionality standards. |
| **Bayesian Shrinkage & Zero-Inflation** | **BCPNN**<br>**GPS / MGPS**<br>**ZIGPS** | $\text{IC}_{025}$<br>$\text{EB}_{05}$ / EBGM<br>$\text{EBGM}_{\text{zi}}$ | $\text{IC}_{025} > 0.0$<br>$\text{EB}_{05} \ge 1.0$<br>$\text{EBGM}_{\text{zi}} \ge 1.0$ | Mitigates small-count volatility via Dirichlet/Gamma-Poisson shrinkage; isolates structural zeros ($\pi_0$). |
| **Indication Bias & Unmasking** | **SCORE-DA**<br>**AEGIS** | SER<br>AEGIS Score | $\text{SER} > 0.0$<br>$\text{Score} \ge 1.0$ | Corrects confounding by indication; unmasks hidden signals suppressed by high-volume adverse events. |
| **Combinations & DDI** | **LASSO**<br>**SCORE-DDI** | $\beta_{\text{penalized}}$<br>Synergy Ratio | $\beta > 0.0$<br>$\text{FDR} < 0.05$ | Multivariable confounding adjustment; detects multi-drug interaction synergies and polypharmacy risks. |
| **Sequential Surveillance** | **MaxSPRT**<br>**CUSUM-DA** | LLR<br>$S_n$ (Cumulative Sum) | $\text{LLR} \ge \text{CV}$<br>$S_n \ge h$ | Prospective surveillance; controls familywise Type-I error across time slices; detects change-points. |

---

## Architecture

```
+---------------------------------------------------------------------------------------+
|                                    vigipy-ui Architecture                             |
|                                                                                       |
|  [ Presentation Layer ]                                                               |
|  - React 18 + TypeScript + Tailwind CSS                                              |
|  - TanStack Virtual Table (sub-millisecond DOM windowing)                             |
|  - Interactive SVG Visualizers: Forest Plots, Volcano Plots, DDI Graphs, Heatmaps     |
|                                                                                       |
|                        ↕ HTTP REST / SSE (http://127.0.0.1:8765)                      |
|                                                                                       |
|  [ Computational Sidecar Engine ]                                                     |
|  - Python FastAPI + Uvicorn background daemon                                         |
|  - Vectorized In-Memory Query & Slicing State (NumPy, pandas, SciPy)                   |
|  - Core DA Engine: vigipy v3.5.1 (Direct in-memory invocation)                        |
|    * Consensus Analysis & Agreement Matrices                                          |
|    * Longitudinal Surveillance Engine (Yearly / Quarterly / Monthly)                   |
|    * Local FAERS / VAERS / MAUDE Safety Warehouse Explorer                            |
+---------------------------------------------------------------------------------------+
```

---

## Quick Start

### 1. Prerequisites

Ensure you have **Python 3.9+** and **Node.js 18+** installed:

```bash
# Clone the repository
git clone https://github.com/Shakesbeery/vigipy-ui.git
cd vigipy-ui

# Install backend dependencies (in your active virtual environment / Conda env)
pip install -r backend/requirements.txt
```

### 2. Launch the Application

Launch the full stack (backend daemon + UI) with a single command:

```bash
python run_app.py
```

The launcher will verify local port availability, boot the FastAPI computational engine, and automatically open your default browser (or standalone application window) at:

👉 **`http://127.0.0.1:8765/`**

---

## Sample Walkthrough

To quickly evaluate the platform with sample pharmacovigilance data:

1. **Launch**: Run `python run_app.py`.
2. **Ingest Data**: On the landing screen, upload any safety dataset (`.csv`, `.tsv`, `.xlsx`, or `.parquet`) or click **"Load Sample MAUDE DYB Dataset"** (bundled 43,492 incident records).
3. **Column Mapping**: The mapper will automatically infer:
   - **Product Column**: `REDUCED_NAME`
   - **Adverse Event Column**: `Event`
   - **Count Column**: `count` (or toggle *Auto-populate Count* if unaggregated)
   - **Date Column**: `DATE_OF_EVENT`
4. **Pre-flight Check**: Review the automated **Dispersion Test** badge (recommends Mantel-Haenszel vs. Negative-Binomial assumptions).
5. **Configure Methods**: Click **"Method Configuration"** to enable algorithms across the 5 statistical paradigms (e.g., BCPNN, GPS, ZIGPS, AEGIS, MaxSPRT).
6. **Execute & Analyze**: Click **"Confirm & Ingest Dataset"**. Review consensus signals, click any row to open the **Signal Inspector Drawer**, examine the **Forest Plot**, check the **Volcano Plot**, or switch to the **Longitudinal Viewer** for time-series surveillance.

---

## Regulatory & GxP Compliance

`vigipy-ui` is built with auditability and regulatory transparency at its core:

- **Mathematical Traceability**: Direct invocation of documented, peer-reviewed algorithms from `vigipy` with no hidden heuristics.
- **Reproducible Python Pipelines**: One-click generation of typed, standalone Python scripts using `vigipy` dataclasses (`Export Reproducible Python Script`).
- **Complete Audit Dossier**: Export timestamped audit manifests detailing dataset hashes, active algorithm parameters, decision boundaries, and software version stamps.
- **Multi-Tab Excel Reports**: Generates structured workbooks formatted with summary sheets, per-method comparison tables, and statistical concordance matrices.

---

## Desktop Packaging (Tauri v2)

`vigipy-ui` includes a native **Tauri v2** configuration in `src-tauri/` for compiling zero-dependency desktop installers (`.msi` / `.exe` on Windows, `.AppImage` / `.deb` on Linux, `.dmg` on macOS):

```bash
# Install frontend dependencies
pnpm install   # or npm install

# Build production web bundle
pnpm run build # or npm run build

# Compile native desktop binary via Cargo
cargo tauri build
```

The resulting binaries will be placed in `src-tauri/target/release/bundle/`.

---

## Development

To run the frontend and backend independently in development mode:

```bash
# Terminal 1: Backend API Engine
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload

# Terminal 2: Frontend Vite Dev Server
npm run dev
```

---

## Contributing & License

Contributions, feature requests, and bug reports are welcome! Please open an issue or pull request on [GitHub](https://github.com/Shakesbeery/vigipy-ui).

Distributed under the **MIT License**. See `LICENSE` for details.
