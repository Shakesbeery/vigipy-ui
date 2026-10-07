import React, { useState, useEffect, useRef } from "react";
import { AppHeader } from "./components/layout/AppHeader";
import { FileDropzone } from "./components/ingestion/FileDropzone";
import { ColumnMapper } from "./components/ingestion/ColumnMapper";
import { MethodConfigModal } from "./components/config/MethodConfigModal";
import { AnalysisProgressBar } from "./components/config/AnalysisProgressBar";
import { SignalGrid } from "./components/grid/SignalGrid";
import { SignalDrawer } from "./components/inspector/SignalDrawer";
import { ConcordanceExplorer } from "./components/consensus/ConcordanceExplorer";
import { LongitudinalViewer } from "./components/longitudinal/LongitudinalViewer";
import { VolcanoPlot } from "./components/analytics/VolcanoPlot";
import { DdiNetworkGraph } from "./components/analytics/DdiNetworkGraph";
import { OpenFDAModal } from "./components/ingestion/OpenFDAModal";
import { FaersWarehouseModal } from "./components/ingestion/FaersWarehouseModal";
import { DataQualityProfilerModal } from "./components/modals/DataQualityProfilerModal";
import { ExportAuditModal } from "./components/modals/ExportAuditModal";
import { VersionManagerModal } from "./components/modals/VersionManagerModal";
import { ProjectContainerModal } from "./components/modals/ProjectContainerModal";
import { PythonCodeViewer } from "./components/tools/PythonCodeViewer";
import { ExportModal } from "./components/common/ExportModal";
import { ImportResultsModal } from "./components/common/ImportResultsModal";
import { generateVigipyPythonCode } from "./core/code_generator";
import {
  checkBackendHealth,
  fetchFilePreview,
  ingestDataFile,
  fetchSummary,
  startAnalysisJob,
  cancelAnalysisJob,
  fetchAnalysisStatus,
  importResultsFile,
  fetchCurrentColumns,
  resetDataset,
  fetchVigipyVersion,
} from "./services/api";
import {
  ColumnMappingRequest,
  DataSummaryResponse,
  FilePreviewResponse,
  JobStatusResponse,
  RunAnalysisRequest,
  SignalRow,
  DEFAULT_ANALYSIS_REQUEST,
} from "./types";
import {
  Activity,
  Layers,
  TrendingUp,
  Sliders,
  Play,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  Columns,
  Share2,
  ScatterChart,
  Code2,
  ShieldAlert,
  Archive,
  Package,
} from "lucide-react";

export type ActiveTab = "signals" | "volcano" | "concordance" | "longitudinal" | "ddi_network";

export const App: React.FC = () => {
  // Navigation & Data State
  const [activeTab, setActiveTab] = useState<ActiveTab>("signals");
  const [filePreview, setFilePreview] = useState<FilePreviewResponse | null>(null);
  const [dataSummary, setDataSummary] = useState<DataSummaryResponse | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [analysisConfig, setAnalysisConfig] = useState<RunAnalysisRequest>(DEFAULT_ANALYSIS_REQUEST);
  const [selectedSignal, setSelectedSignal] = useState<SignalRow | null>(null);
  const [longitudinalSignal, setLongitudinalSignal] = useState<SignalRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [analysisVersion, setAnalysisVersion] = useState<number>(0);

  // Modal Visibility State
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [isIngesting, setIsIngesting] = useState<boolean>(false);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isRemappingColumns, setIsRemappingColumns] = useState<boolean>(false);
  const [isQualityModalOpen, setIsQualityModalOpen] = useState<boolean>(false);
  const [isOpenFDAModalOpen, setIsOpenFDAModalOpen] = useState<boolean>(false);
  const [isWarehouseOpen, setIsWarehouseOpen] = useState<boolean>(false);
  const [isCodeViewerOpen, setIsCodeViewerOpen] = useState<boolean>(false);
  const [isAuditDossierOpen, setIsAuditDossierOpen] = useState<boolean>(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState<boolean>(false);
  const [isProjectContainerOpen, setIsProjectContainerOpen] = useState<boolean>(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [totalSignals, setTotalSignals] = useState<number>(0);
  const [vigipyVersion, setVigipyVersion] = useState<string>("3.4.0");

  // Active polling reference for analysis progress
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Check backend health and version periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await checkBackendHealth();
        setBackendOnline(res.online);
        if (res.hasData && !dataSummary) {
          try {
            const summary = await fetchSummary();
            setDataSummary(summary);
            setTotalSignals(res.totalSignals);
          } catch {
            // Ignore if summary fetch fails
          }
        }
      } catch {
        setBackendOnline(false);
      }
    };

    const loadVersion = async () => {
      try {
        const v = await fetchVigipyVersion();
        if (v?.installed_version) {
          setVigipyVersion(v.installed_version);
        }
      } catch {
        // Ignore fallback
      }
    };

    checkHealth();
    loadVersion();
    const interval = setInterval(checkHealth, 4000);
    return () => clearInterval(interval);
  }, [dataSummary]);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Handle file selection from FileDropzone
  const handleFileSelect = async (filePath: string) => {
    setIsPreviewLoading(true);
    setErrorMessage(null);
    try {
      const preview = await fetchFilePreview(filePath);
      setFilePreview(preview);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load file preview.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Handle column mapping confirmation
  const handleConfirmMapping = async (mapping: ColumnMappingRequest) => {
    setIsIngesting(true);
    setErrorMessage(null);
    try {
      const summary = await ingestDataFile(mapping);
      setDataSummary(summary);
      setTotalSignals(0);
      setSelectedSignal(null);
      setIsDrawerOpen(false);
      setIsRemappingColumns(false);
      
      // Do not auto-run analysis: let user select which analyses to perform
      setIsConfigOpen(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to ingest dataset.");
    } finally {
      setIsIngesting(false);
    }
  };

  // Trigger analysis execution
  const handleRunAnalysis = async (configOverride?: RunAnalysisRequest) => {
    setErrorMessage(null);
    const cfg = configOverride || analysisConfig;
    try {
      const initialJob = await startAnalysisJob(cfg);
      setJobStatus(initialJob);

      // Start polling status
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(async () => {
        try {
          const status = await fetchAnalysisStatus();
          setJobStatus(status);

          if (status.status === "completed") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setTotalSignals(status.total_signals);
            setAnalysisVersion((v) => v + 1);
            // Refresh summary
            try {
              const updatedSummary = await fetchSummary();
              setDataSummary(updatedSummary);
            } catch {
              // Ignore
            }
          } else if (status.status === "failed") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setErrorMessage(status.error || "Analysis failed.");
          } else if (status.status === "cancelled") {
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        } catch (err: any) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setErrorMessage(err.message || "Lost communication with analysis job.");
        }
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to start analysis job.");
    }
  };

  const handleCancelAnalysis = async () => {
    try {
      await cancelAnalysisJob();
      if (pollingRef.current) clearInterval(pollingRef.current);
      setJobStatus((prev) =>
        prev ? { ...prev, status: "cancelled", step: "Analysis cancelled by user." } : null
      );
    } catch (err: any) {
      console.error("Cancel failed:", err);
    }
  };

  // Open longitudinal tab directly for a specific signal
  const handleOpenLongitudinal = (product: string, adverseEvent: string) => {
    setIsDrawerOpen(false);
    const matchingRow =
      selectedSignal?.product === product && selectedSignal?.adverse_event === adverseEvent
        ? selectedSignal
        : ({ product, adverse_event: adverseEvent } as SignalRow);
    setLongitudinalSignal(matchingRow);
    setActiveTab("longitudinal");
  };

  // Reset entire dataset state
  const handleResetData = async () => {
    if (confirm("Reset current dataset and return to file selection?")) {
      try {
        await resetDataset();
      } catch {
        // Ignore
      }
      setFilePreview(null);
      setDataSummary(null);
      setJobStatus(null);
      setSelectedSignal(null);
      setLongitudinalSignal(null);
      setIsDrawerOpen(false);
      setTotalSignals(0);
      setIsRemappingColumns(false);
      setActiveTab("signals");
    }
  };

  // Quick swap to a new dataset
  const handleSwapDataset = async () => {
    try {
      await resetDataset();
    } catch {
      // Ignore
    }
    setFilePreview(null);
    setDataSummary(null);
    setJobStatus(null);
    setSelectedSignal(null);
    setLongitudinalSignal(null);
    setIsDrawerOpen(false);
    setTotalSignals(0);
    setIsRemappingColumns(false);
    setActiveTab("signals");
  };

  // Open column remapping wizard for currently loaded dataset
  const handleOpenColumns = async () => {
    setIsPreviewLoading(true);
    setErrorMessage(null);
    try {
      const cols = await fetchCurrentColumns();
      setFilePreview(cols);
      setIsRemappingColumns(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load columns for re-selection.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Re-import previously exported analysis results (.xlsx, .csv, .parquet)
  const handleImportResults = async (filePath: string) => {
    setIsImporting(true);
    setErrorMessage(null);
    try {
      const summary = await importResultsFile(filePath);
      setDataSummary(summary);
      setTotalSignals(summary.total_signals || 0);
      setIsImportOpen(false);
      setActiveTab("signals");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to import previous analysis results.");
    } finally {
      setIsImporting(false);
    }
  };

  // Select signal row in grid and open drawer
  const handleSelectSignal = (signal: SignalRow) => {
    setSelectedSignal(signal);
    setIsDrawerOpen(true);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans select-none">
      {/* Top Application Header */}
      <AppHeader
        summary={dataSummary}
        onOpenConfig={() => setIsConfigOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onResetData={handleResetData}
        onSwapDataset={handleSwapDataset}
        onOpenImportResults={() => setIsImportOpen(true)}
        onOpenColumns={handleOpenColumns}
        onOpenQualityProfiler={() => setIsQualityModalOpen(true)}
        onOpenOpenFDA={() => setIsOpenFDAModalOpen(true)}
        onOpenFaersWarehouse={() => setIsWarehouseOpen(true)}
        onOpenCodeViewer={() => setIsCodeViewerOpen(true)}
        onOpenAuditDossier={() => setIsAuditDossierOpen(true)}
        onOpenVersionModal={() => setIsVersionModalOpen(true)}
        onOpenProjectContainer={() => setIsProjectContainerOpen(true)}
        backendOnline={backendOnline}
        totalSignals={totalSignals}
        vigipyVersion={vigipyVersion}
      />

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 px-6 py-2.5 flex items-center justify-between text-rose-300 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        {/* Step 1: File Selection Dropzone */}
        {!filePreview && !dataSummary && !isRemappingColumns && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start min-h-0">
            <div className="w-full max-w-3xl my-auto py-4">
              <FileDropzone
                onFileSelect={handleFileSelect}
                onImportResults={handleImportResults}
                onOpenOpenFDA={() => setIsOpenFDAModalOpen(true)}
                isLoading={isPreviewLoading}
                error={errorMessage}
              />
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping Wizard (Initial Ingestion & Post-Ingestion Remapping) */}
        {((filePreview && !dataSummary) || isRemappingColumns) && filePreview && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-5xl mx-auto">
              <ColumnMapper
                preview={filePreview}
                onConfirmMapping={handleConfirmMapping}
                isIngesting={isIngesting}
                dispersionSummary={dataSummary}
                onBack={() => {
                  if (isRemappingColumns) {
                    setIsRemappingColumns(false);
                  } else {
                    setFilePreview(null);
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Step 3: Primary Workstation (Data Ingested) */}
        {dataSummary && !isRemappingColumns && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Analysis Progress Overlay / Bar */}
            {jobStatus && jobStatus.status === "running" && (
              <div className="px-6 py-2 bg-slate-900 border-b border-slate-800">
                <AnalysisProgressBar
                  jobStatus={jobStatus}
                  onCancel={handleCancelAnalysis}
                />
              </div>
            )}

            {/* View Navigation Tab Bar */}
            <div className="h-11 border-b border-slate-800 bg-slate-900/60 px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab("signals")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeTab === "signals"
                      ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Signals & Forest Plots</span>
                </button>

                <button
                  onClick={() => setActiveTab("volcano")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeTab === "volcano"
                      ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <ScatterChart className="w-3.5 h-3.5" />
                  <span>Volcano Plot</span>
                </button>

                <button
                  onClick={() => setActiveTab("concordance")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeTab === "concordance"
                      ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Method Concordance</span>
                </button>

                <button
                  onClick={() => setActiveTab("longitudinal")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeTab === "longitudinal"
                      ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Longitudinal Trends</span>
                </button>

                <button
                  onClick={() => setActiveTab("ddi_network")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeTab === "ddi_network"
                      ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>DDI Interaction Graph</span>
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsConfigOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                  title="Select which disproportionality algorithms and thresholds to execute"
                >
                  <Sliders className="w-3 h-3 text-slate-400" />
                  <span>Configure Analyses</span>
                </button>

                <button
                  onClick={() => handleRunAnalysis()}
                  disabled={jobStatus?.status === "running"}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium transition shadow-sm"
                  title={totalSignals === 0 ? "Execute disproportionality analysis" : "Rerun analysis with active configuration"}
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{totalSignals === 0 ? "Run Analysis" : "Rerun Analysis"}</span>
                </button>
              </div>
            </div>

            {/* Ingested Pending Analysis Prompt Banner */}
            {totalSignals === 0 && (!jobStatus || jobStatus.status === "idle") && (
              <div className="bg-indigo-950/40 border-b border-indigo-500/20 px-6 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white">
                      Dataset Loaded: {dataSummary.total_raw_rows.toLocaleString()} rows ({dataSummary.unique_pairs.toLocaleString()} candidate pairs)
                    </span>
                    <span className="text-[11px] text-slate-400 ml-2">
                      Analyses have not been run automatically. Choose which methods (PRR, ROR, RFET, BCPNN, GPS, LASSO, SCORE) to execute.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleOpenColumns}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                    title="Change columns used for Product, Adverse Event, Count, or Date"
                  >
                    <Columns className="w-3 h-3 text-slate-400" />
                    <span>Change Columns</span>
                  </button>
                  <button
                    onClick={() => setIsConfigOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Select Analyses & Run</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 1: Signals Grid & Master-Detail Inspector */}
            {activeTab === "signals" && (
              <div className="flex-1 flex min-h-0 overflow-hidden relative">
                {/* Scalable High-Performance Grid */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                  <SignalGrid
                    onSelectSignal={handleSelectSignal}
                    selectedSignal={selectedSignal}
                    onOpenLongitudinal={(row) => handleOpenLongitudinal(row.product, row.adverse_event)}
                    refreshKey={analysisVersion}
                    className="flex-1"
                  />
                </div>

                {/* Master-Detail Slide-Over Drawer */}
                {isDrawerOpen && selectedSignal && (
                  <SignalDrawer
                    selectedSignal={selectedSignal}
                    onClose={() => setIsDrawerOpen(false)}
                    mode="slide-over"
                    onOpenLongitudinal={handleOpenLongitudinal}
                  />
                )}
              </div>
            )}

            {/* Tab 2: Volcano Plot (Significance vs Effect Size) */}
            {activeTab === "volcano" && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-6xl mx-auto">
                  <VolcanoPlot
                    onSelectSignal={(product, adverseEvent) => {
                      handleOpenLongitudinal(product, adverseEvent);
                    }}
                  />
                </div>
              </div>
            )}

            {/* Tab 3: Cross-Method Concordance Explorer */}
            {activeTab === "concordance" && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-6xl mx-auto">
                  <ConcordanceExplorer />
                </div>
              </div>
            )}

            {/* Tab 4: Longitudinal Time-Series Trajectory */}
            {activeTab === "longitudinal" && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-6xl mx-auto">
                  <LongitudinalViewer
                    initialSignal={longitudinalSignal}
                    onOpenConfig={() => setIsConfigOpen(true)}
                    onSignalChange={(product, adverseEvent) => {
                      if (longitudinalSignal?.product !== product || longitudinalSignal?.adverse_event !== adverseEvent) {
                        setLongitudinalSignal({ product, adverse_event: adverseEvent } as SignalRow);
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Tab 5: Drug-Drug Interaction (DDI) Network */}
            {activeTab === "ddi_network" && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-6xl mx-auto">
                  <DdiNetworkGraph
                    onSelectSignal={(product, adverseEvent) => {
                      handleOpenLongitudinal(product, adverseEvent);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Method Configuration Modal */}
      {isConfigOpen && (
        <MethodConfigModal
          isOpen={isConfigOpen}
          onClose={() => setIsConfigOpen(false)}
          initialConfig={analysisConfig}
          onSaveConfig={(newConfig: RunAnalysisRequest) => {
            setAnalysisConfig(newConfig);
            setIsConfigOpen(false);
          }}
          onRunAnalysis={(newConfig: RunAnalysisRequest) => {
            setAnalysisConfig(newConfig);
            setIsConfigOpen(false);
            handleRunAnalysis(newConfig);
          }}
        />
      )}

      {/* Export Modal */}
      {isExportOpen && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          totalSignalsCount={totalSignals}
        />
      )}

      {/* Import Results Modal */}
      <ImportResultsModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImportResults}
        isLoading={isImporting}
      />

      {/* Live openFDA Streaming Modal */}
      <OpenFDAModal
        isOpen={isOpenFDAModalOpen}
        onClose={() => setIsOpenFDAModalOpen(false)}
        onDataIngested={(filePath) => {
          setIsOpenFDAModalOpen(false);
          handleFileSelect(filePath);
        }}
      />

      {/* Local FAERS Warehouse (bulk 2012+ cohorts) */}
      <FaersWarehouseModal
        isOpen={isWarehouseOpen}
        onClose={() => setIsWarehouseOpen(false)}
        onDataIngested={(filePath) => {
          setIsWarehouseOpen(false);
          handleFileSelect(filePath);
        }}
      />

      {/* Data Quality Profiler Modal */}
      <DataQualityProfilerModal
        isOpen={isQualityModalOpen}
        onClose={() => setIsQualityModalOpen(false)}
        datasetName="Active Surveillance Dataset"
      />

      {/* GxP / 21 CFR Part 11 Audit Dossier Modal */}
      <ExportAuditModal
        isOpen={isAuditDossierOpen}
        onClose={() => setIsAuditDossierOpen(false)}
        datasetTitle="vigipy_surveillance"
        totalRecords={dataSummary?.total_raw_rows || 0}
        totalSignals={totalSignals}
        config={analysisConfig}
      />

      {/* Version & PyPI Release Manager Modal */}
      <VersionManagerModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
      />

      {/* Project Container (Export & Restore Session) Modal */}
      <ProjectContainerModal
        isOpen={isProjectContainerOpen}
        onClose={() => setIsProjectContainerOpen(false)}
        datasetTitle="vigipy_project"
        totalRecords={dataSummary?.total_raw_rows || 0}
        config={analysisConfig}
        onRestoreConfig={(restoredCfg) => {
          setAnalysisConfig(restoredCfg);
        }}
      />

      {/* Reproducible Python Code Generator Modal */}
      <PythonCodeViewer
        isOpen={isCodeViewerOpen}
        onClose={() => setIsCodeViewerOpen(false)}
        code={generateVigipyPythonCode({
          config: analysisConfig,
          datasetName: "vigipy_surveillance.csv",
          productCol: dataSummary?.product_col || "Product",
          aeCol: dataSummary?.ae_col || "Adverse Event",
          countCol: dataSummary?.count_col || undefined,
          dateCol: dataSummary?.date_col || undefined,
          targetDrug: selectedSignal?.product || "DRUG_NAME",
          targetEvent: selectedSignal?.adverse_event || "EVENT_NAME",
          vigipyVersion: vigipyVersion,
        })}
      />
    </div>
  );
};

export default App;
