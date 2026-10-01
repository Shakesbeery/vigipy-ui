/**
 * vigipy Studio - Main Application Component
 * A modern, reactive, high-performance pharmacovigilance platform
 * exposing the full capabilities of vigipy (PRR, ROR, RFET, BCPNN, GPS, LASSO, Longitudinal Modeling).
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  Layers,
  Code2,
  Database,
  Sliders,
  Filter,
  TrendingUp,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Info,
  ChevronRight,
  Archive,
  Play,
  RefreshCw,
  Search,
  Check,
  BarChart2,
  Eye,
  Sparkles,
} from 'lucide-react';

import {
  ConsensusSignal,
  DisproportionalityMethod,
  FAERSRecord,
  LongitudinalConfig,
  MethodConfigs,
  SignalResult,
  TrajectorySummary,
} from './types/vigipy';
import { RawParsedTable, VigipyVersionInfo } from './types/version';

import { DEFAULT_CONFIGS, analyze, analyze_all, analyzeAsync, analyzeAllAsync } from './core/analyzer';
import { filterFAERSData, DEFAULT_FILTER } from './core/faers/subsetting';
import {
  runLongitudinalAnalysis,
  scanAllLongitudinalTrajectories,
  scanAllLongitudinalTrajectoriesAsync,
  scanProductAETrajectories,
  PrecomputedSliceData,
} from './core/longitudinal';
import { generateVigipyPythonCode } from './core/code_generator';
import { KNOWN_VIGIPY_VERSIONS } from './core/pypi_service';
import { useRegisteredMethods, methodRegistry } from './core/method_registry';
import { VigipyProjectContainer } from './types/container';

import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { VolcanoPlot } from './components/VolcanoPlot';
import { ForestPlot } from './components/ForestPlot';
import { LongitudinalChart } from './components/LongitudinalChart';
import { MultiAELongitudinalChart } from './components/MultiAELongitudinalChart';
import { LongitudinalScreeningTable } from './components/LongitudinalScreeningTable';
import { ConsensusHeatmap } from './components/ConsensusHeatmap';
import { ContingencyModal } from './components/ContingencyModal';
import { MethodConfigDrawer } from './components/MethodConfigDrawer';
import { OpenFDAModal } from './components/OpenFDAModal';
import { FileUploadModal } from './components/FileUploadModal';
import { PythonCodeViewer } from './components/PythonCodeViewer';
import { DataTable } from './components/DataTable';
import { VersionManagerModal } from './components/VersionManagerModal';
import { ColumnMapperModal } from './components/ColumnMapperModal';
import { ProjectContainerModal } from './components/ProjectContainerModal';
import { AnalysisMethodsModal } from './components/AnalysisMethodsModal';
import { DdiNetworkGraph } from './components/DdiNetworkGraph';
import { DataQualityProfilerModal } from './components/DataQualityProfilerModal';
import { ExportAuditModal } from './components/ExportAuditModal';
import { SignalInspectionCard } from './components/SignalInspectionCard';
import { LongitudinalConfigModal } from './components/LongitudinalConfigModal';
import { RegulatoryExportContext } from './core/regulatory_export';

export default function App() {
  // 1. Raw Surveillance Records & Ingestion State (Empty by default for end-to-end user testing)
  const [records, setRecords] = useState<FAERSRecord[]>([]);
  const [datasetTitle, setDatasetTitle] = useState('');

  // 1b. vigipy PyPI Version & Methodology Sync State
  const [activeVersion, setActiveVersion] = useState<string>('3.4.0');
  const [versions, setVersions] = useState<VigipyVersionInfo[]>(KNOWN_VIGIPY_VERSIONS);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);

  // 1c. Column Mapping Modal State
  const [isColumnMapperOpen, setIsColumnMapperOpen] = useState(false);
  const [activeRawTable, setActiveRawTable] = useState<RawParsedTable | null>(null);

  // 1d. Multi-Analysis Methods Selection
  const [activeAnalysisMethods, setActiveAnalysisMethods] = useState<DisproportionalityMethod[]>([
    'PRR',
    'ROR',
    'RFET',
    'BCPNN',
    'GPS',
    'LASSO',
    'SCORE',
    'SCORE_DDI',
  ]);
  const [isAnalysisMethodsModalOpen, setIsAnalysisMethodsModalOpen] = useState(false);

  // 2. Active Tab View
  const [activeTab, setActiveTab] = useState<'studio' | 'longitudinal' | 'consensus' | 'ddi_network' | 'cohort' | 'python'>('studio');

  // 2b. Dynamic Registered DA Methods (automatically updates when methods are added to vigipy)
  const registeredMethods = useRegisteredMethods();

  // 3. Algorithm Hyperparameters & Selected Method
  const [savedMethodConfigs, setSavedMethodConfigs] = useState<MethodConfigs>(DEFAULT_CONFIGS);
  const [methodConfigs, setMethodConfigs] = useState<MethodConfigs>(DEFAULT_CONFIGS);
  const [lastRerunMethods, setLastRerunMethods] = useState<string[]>([]);
  const [configToast, setConfigToast] = useState<{ message: string; type: 'save' | 'rerun' } | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<DisproportionalityMethod>('PRR');

  // Keep selectedMethod valid if registered methods change
  useEffect(() => {
    if (registeredMethods.length > 0 && !registeredMethods.some((m) => m.id === selectedMethod)) {
      setSelectedMethod(registeredMethods[0].id as DisproportionalityMethod);
    }
  }, [registeredMethods, selectedMethod]);

  // 4. Cohort Subsetting Filters
  const [cohortFilter, setCohortFilter] = useState(DEFAULT_FILTER);

  // 5. Chart Visualization Toggle (Forest is default as requested)
  const [chartType, setChartType] = useState<'volcano' | 'forest'>('forest');

  // 6. Selected Signal for Inspection & Modals
  const [inspectedSignal, setInspectedSignal] = useState<SignalResult | null>(null);
  const [sideInspectionSignal, setSideInspectionSignal] = useState<SignalResult | null>(null);
  const [volcanoSelectedSignals, setVolcanoSelectedSignals] = useState<SignalResult[] | null>(null);

  // 7. Modals & Drawers
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false);
  const [isOpenFDAModalOpen, setIsOpenFDAModalOpen] = useState(false);
  const [isFileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);
  const [isProjectContainerOpen, setIsProjectContainerOpen] = useState(false);
  const [isDataProfilerOpen, setIsDataProfilerOpen] = useState(false);
  const [isExportAuditOpen, setIsExportAuditOpen] = useState(false);
  const [isKeyboardHelpOpen, setIsKeyboardHelpOpen] = useState(false);
  const [isLongitudinalConfigModalOpen, setIsLongitudinalConfigModalOpen] = useState(false);

  // 8. Longitudinal Modeling State (User-triggered parameterization & multi-pair screening)
  const [stagedLongTargetDrug, setStagedLongTargetDrug] = useState<string>('');
  const [stagedLongTargetEvent, setStagedLongTargetEvent] = useState<string>('');
  const [drugSearchQuery, setDrugSearchQuery] = useState('');
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [stagedLongConfig, setStagedLongConfig] = useState<LongitudinalConfig>({
    mode: 'cumulative',
    expectationModel: 'binomial',
    method: 'SCORE',
    timeUnit: 'quarter',
    minCountPerSlice: 2,
  });

  const [executedLongParams, setExecutedLongParams] = useState<{
    drug: string;
    event: string;
    config: LongitudinalConfig;
  } | null>(null);

  const [longitudinalTrajectory, setLongitudinalTrajectory] = useState<TrajectorySummary>({
    drug: '',
    event: '',
    points: [],
    firstEmergenceSlice: null,
    peakScore: 0,
    peakSlice: '',
    trajectoryTrend: 'stable',
    volatility: 0,
    meanDisproportionality: 0,
  });

  const [longitudinalScreeningTrajectories, setLongitudinalScreeningTrajectories] = useState<TrajectorySummary[]>([]);
  const [isLongitudinalRunning, setIsLongitudinalRunning] = useState(false);
  const [longitudinalViewMode, setLongitudinalViewMode] = useState<'chart' | 'matrix' | 'multi_ae'>('chart');

  // Real-time analysis progress state (prevents site freeze and tracks progress)
  const [analysisProgress, setAnalysisProgress] = useState<{
    isRunning: boolean;
    percent: number;
    stage: string;
    detail?: string;
  } | null>(null);

  // Analysis results state (computed asynchronously without blocking UI)
  const [singleMethodResults, setSingleMethodResults] = useState<SignalResult[]>([]);
  const [consensusSignals, setConsensusSignals] = useState<ConsensusSignal[]>([]);
  const [methodResults, setMethodResults] = useState<Record<DisproportionalityMethod, SignalResult[]>>({} as any);

  // Cached slices for instant longitudinal curves
  const precomputedSlicesRef = useRef<PrecomputedSliceData[] | null>(null);
  const analysisRunIdRef = useRef<number>(0);

  // Unique drugs and events in current loaded database
  const { availableDrugs, availableEvents } = useMemo(() => {
    const dSet = new Set<string>();
    const eSet = new Set<string>();
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (r && r.drugName && typeof r.drugName === 'string') {
        dSet.add(r.drugName.trim());
      }
      if (r && r.preferredTerm && typeof r.preferredTerm === 'string') {
        eSet.add(r.preferredTerm.trim());
      }
    }
    return {
      availableDrugs: Array.from(dSet).sort(),
      availableEvents: Array.from(eSet).sort(),
    };
  }, [records]);

  // Filtered drug & event search options
  const filteredDrugOptions = useMemo(() => {
    if (!drugSearchQuery) return availableDrugs;
    const q = drugSearchQuery.toLowerCase().trim();
    return availableDrugs.filter((d) => d.toLowerCase().includes(q));
  }, [availableDrugs, drugSearchQuery]);

  const filteredEventOptions = useMemo(() => {
    if (!eventSearchQuery) return availableEvents;
    const q = eventSearchQuery.toLowerCase().trim();
    return availableEvents.filter((e) => e.toLowerCase().includes(q));
  }, [availableEvents, eventSearchQuery]);

  // Determine if user has staged parameter changes that differ from the last executed run
  const hasLongitudinalStagedChanges = useMemo(() => {
    if (!executedLongParams) return false;
    if (executedLongParams.drug !== stagedLongTargetDrug) return true;
    if (executedLongParams.event !== stagedLongTargetEvent) return true;
    if (
      executedLongParams.config.mode !== stagedLongConfig.mode ||
      executedLongParams.config.expectationModel !== stagedLongConfig.expectationModel ||
      executedLongParams.config.method !== stagedLongConfig.method ||
      executedLongParams.config.minCountPerSlice !== stagedLongConfig.minCountPerSlice
    ) {
      return true;
    }
    return false;
  }, [executedLongParams, stagedLongTargetDrug, stagedLongTargetEvent, stagedLongConfig]);

  // Determine if user saved method configs that have not been rerun yet
  const hasUnappliedSavedConfigs = useMemo(() => {
    return JSON.stringify(savedMethodConfigs) !== JSON.stringify(methodConfigs);
  }, [savedMethodConfigs, methodConfigs]);

  // Keep staged targets valid if dataset changes
  useEffect(() => {
    if (availableDrugs.length > 0 && (!stagedLongTargetDrug || !availableDrugs.includes(stagedLongTargetDrug))) {
      setStagedLongTargetDrug(availableDrugs[0]);
    }
    if (availableEvents.length > 0 && (!stagedLongTargetEvent || !availableEvents.includes(stagedLongTargetEvent))) {
      setStagedLongTargetEvent(availableEvents[0]);
    }
  }, [availableDrugs, availableEvents, stagedLongTargetDrug, stagedLongTargetEvent]);

  // Sliced / Filtered FAERS Cohort
  const filteredRecords = useMemo(() => {
    try {
      return filterFAERSData(records, cohortFilter);
    } catch (e) {
      console.error('Error filtering FAERS data:', e);
      return records;
    }
  }, [records, cohortFilter]);

  // Non-blocking asynchronous analysis runner with real-time stage progress reporting
  const executeAnalyses = useCallback(
    async (
      recs: FAERSRecord[],
      configs: MethodConfigs,
      activeMethods: DisproportionalityMethod[],
      singleMethod: DisproportionalityMethod
    ) => {
      if (!recs || recs.length === 0) {
        setSingleMethodResults([]);
        setConsensusSignals([]);
        setMethodResults({} as any);
        setAnalysisProgress(null);
        return;
      }

      const runId = ++analysisRunIdRef.current;
      setAnalysisProgress({
        isRunning: true,
        percent: 8,
        stage: 'Ingesting surveillance cohort...',
        detail: `${recs.length.toLocaleString()} records`,
      });

      try {
        // 1. Run primary selected method asynchronously
        const singleRes = await analyzeAsync(
          recs,
          singleMethod,
          configs[singleMethod] || DEFAULT_CONFIGS[singleMethod],
          (pct, stage) => {
            if (analysisRunIdRef.current === runId) {
              setAnalysisProgress({
                isRunning: true,
                percent: Math.min(38, Math.max(8, Math.round(pct * 0.38))),
                stage,
                detail: `Primary method: ${singleMethod}`,
              });
            }
          }
        );

        if (analysisRunIdRef.current === runId) {
          setSingleMethodResults(singleRes);
        }

        // 2. Run multi-method ensemble consensus asynchronously
        const consensusRes = await analyzeAllAsync(
          recs,
          configs,
          activeMethods,
          (pct, stage) => {
            if (analysisRunIdRef.current === runId) {
              setAnalysisProgress({
                isRunning: true,
                percent: Math.min(99, Math.round(38 + pct * 0.6)),
                stage,
                detail: `Ensemble consensus (${activeMethods.length} algorithms)`,
              });
            }
          }
        );

        if (analysisRunIdRef.current === runId) {
          setConsensusSignals(consensusRes.consensusSignals);
          setMethodResults(consensusRes.methodResults);
          setAnalysisProgress({
            isRunning: false,
            percent: 100,
            stage: 'Analyses Synchronized',
            detail: `${consensusRes.consensusSignals.length} candidate signal pairs evaluated`,
          });
          setTimeout(() => {
            if (analysisRunIdRef.current === runId) {
              setAnalysisProgress(null);
            }
          }, 2000);
        }
      } catch (err) {
        console.error('Error during asynchronous analysis:', err);
        setAnalysisProgress(null);
      }
    },
    []
  );

  // Trigger non-blocking analysis when filtered records or active methods change
  useEffect(() => {
    executeAnalyses(filteredRecords, methodConfigs, activeAnalysisMethods, selectedMethod);
  }, [filteredRecords, activeAnalysisMethods, executeAnalyses]);

  // Update single method results when selected method changes
  useEffect(() => {
    if (filteredRecords.length > 0) {
      analyzeAsync(
        filteredRecords,
        selectedMethod,
        methodConfigs[selectedMethod] || DEFAULT_CONFIGS[selectedMethod]
      ).then((res) => {
        setSingleMethodResults(res);
      });
    }
  }, [selectedMethod, filteredRecords, methodConfigs]);

  // Fast Non-Hanging Curve Inspection Handler
  const handleInspectPair = (drug: string, event: string) => {
    setStagedLongTargetDrug(drug);
    setStagedLongTargetEvent(event);
    setLongitudinalViewMode('chart');

    // 1. Instant check: If already in screening matrix, load curve immediately with 0 delay!
    const existing = longitudinalScreeningTrajectories.find(
      (t) => t.drug === drug && t.event === event
    );
    if (existing && existing.points && existing.points.length > 0) {
      setLongitudinalTrajectory(existing);
      setExecutedLongParams({
        drug,
        event,
        config: { ...stagedLongConfig },
      });
      return;
    }

    // 2. Otherwise evaluate single pair using precomputed slices (<1ms) without rescanning all 100 pairs
    try {
      const trajectory = runLongitudinalAnalysis(
        filteredRecords,
        drug,
        event,
        stagedLongConfig,
        methodConfigs,
        precomputedSlicesRef.current || undefined
      );
      setLongitudinalTrajectory(trajectory);
      setExecutedLongParams({
        drug,
        event,
        config: { ...stagedLongConfig },
      });
    } catch (e) {
      console.error('Error inspecting pair curve:', e);
    }
  };

  // User-triggered Longitudinal Trajectory & Multi-Pair Screening Analysis (Non-blocking)
  const handleRunLongitudinalAnalysis = async (
    drug = stagedLongTargetDrug,
    event = stagedLongTargetEvent,
    config = stagedLongConfig,
    configs = methodConfigs
  ) => {
    if (!filteredRecords || filteredRecords.length === 0) return;
    const targetD = drug || stagedLongTargetDrug || (availableDrugs.length > 0 ? availableDrugs[0] : '');
    const targetE = event || stagedLongTargetEvent || (availableEvents.length > 0 ? availableEvents[0] : '');
    setIsLongitudinalRunning(true);
    setAnalysisProgress({
      isRunning: true,
      percent: 25,
      stage: `Evaluating longitudinal trajectories across all data (${config.method} model)...`,
    });

    try {
      // Collect all priority signal pairs from both single method and consensus screening
      const priorityPairs: Array<{ drug: string; event: string }> = [];
      const addedKeys = new Set<string>();

      // Target active pair first
      if (targetD && targetE) {
        priorityPairs.push({ drug: targetD, event: targetE });
        addedKeys.add(`${targetD}__${targetE}`);
      }

      // Add all signals discovered by disproportionality screening
      (singleMethodResults || []).filter((s) => s.isSignal).forEach((s) => {
        const k = `${s.drug}__${s.event}`;
        if (!addedKeys.has(k)) {
          addedKeys.add(k);
          priorityPairs.push({ drug: s.drug, event: s.event });
        }
      });

      // Add all consensus signals
      (consensusSignals || []).filter((c) => c.isConsensusSignal).forEach((c) => {
        const k = `${c.drug}__${c.event}`;
        if (!addedKeys.has(k)) {
          addedKeys.add(k);
          priorityPairs.push({ drug: c.drug, event: c.event });
        }
      });

      // 1. Evaluate single trajectory curve if pair targets are present
      if (targetD && targetE) {
        const trajectory = runLongitudinalAnalysis(
          filteredRecords,
          targetD,
          targetE,
          config,
          configs
        );
        setLongitudinalTrajectory(trajectory);
      }

      // 2. Scan ALL candidate pairs across the cohort using the specified method
      const { screening, slices } = await scanAllLongitudinalTrajectoriesAsync(
        filteredRecords,
        config,
        configs,
        150,
        undefined,
        (pct, stage) => {
          setAnalysisProgress({
            isRunning: true,
            percent: Math.round(25 + pct * 0.72),
            stage,
          });
        },
        priorityPairs
      );
      precomputedSlicesRef.current = slices;
      setLongitudinalScreeningTrajectories(screening);

      setExecutedLongParams({
        drug: targetD,
        event: targetE,
        config: { ...config },
      });
    } catch (e) {
      console.error('Error executing longitudinal trajectory analysis:', e);
    } finally {
      setIsLongitudinalRunning(false);
      setAnalysisProgress(null);
    }
  };

  // Automatically execute initial longitudinal run when filtered records or targets first load
  useEffect(() => {
    if (filteredRecords.length > 0 && availableDrugs.length > 0 && availableEvents.length > 0) {
      // Pick top detected signal if available so default selection has verified activity
      const topSignal = (singleMethodResults || []).find((s) => s.isSignal);
      const topDrug = topSignal?.drug || (singleMethodResults.length > 0 && singleMethodResults[0].drug) || availableDrugs[0];
      const topEvent = topSignal?.event || (singleMethodResults.length > 0 && singleMethodResults[0].event) || availableEvents[0];

      const targetD = stagedLongTargetDrug && availableDrugs.includes(stagedLongTargetDrug)
        ? stagedLongTargetDrug
        : topDrug;
      const targetE = stagedLongTargetEvent && availableEvents.includes(stagedLongTargetEvent)
        ? stagedLongTargetEvent
        : topEvent;

      if (targetD !== stagedLongTargetDrug) setStagedLongTargetDrug(targetD);
      if (targetE !== stagedLongTargetEvent) setStagedLongTargetEvent(targetE);

      if (!executedLongParams || longitudinalScreeningTrajectories.length === 0) {
        handleRunLongitudinalAnalysis(targetD, targetE, stagedLongConfig);
      }
    }
  }, [filteredRecords, availableDrugs, availableEvents, singleMethodResults, consensusSignals]);

  // Ensure longitudinal screening runs if user visits Longitudinal tab and trajectories are not yet populated
  useEffect(() => {
    if (activeTab === 'longitudinal' && filteredRecords.length > 0 && longitudinalScreeningTrajectories.length === 0 && !isLongitudinalRunning) {
      handleRunLongitudinalAnalysis();
    }
  }, [activeTab, filteredRecords, longitudinalScreeningTrajectories.length, isLongitudinalRunning]);

  // Method Hyperparameters: explicit Save vs Save & Rerun handlers
  const handleSaveConfigs = (newConfigs: MethodConfigs) => {
    setSavedMethodConfigs(newConfigs);
    setConfigToast({
      message: 'Method parameters saved (staged for future analyses).',
      type: 'save',
    });
    setTimeout(() => setConfigToast(null), 4000);
  };

  const handleSaveAndRerunConfigs = (newConfigs: MethodConfigs, changedMethods: string[]) => {
    setSavedMethodConfigs(newConfigs);
    setMethodConfigs(newConfigs);
    setLastRerunMethods(changedMethods);
    setConfigToast({
      message: `Hyperparameters updated & analyses rerun for: ${changedMethods.join(', ')}.`,
      type: 'rerun',
    });
    setTimeout(() => setConfigToast(null), 5000);

    // Run non-blocking analysis with smooth progress bar
    executeAnalyses(filteredRecords, newConfigs, activeAnalysisMethods, selectedMethod);

    // If longitudinal model or expectation changed, also update longitudinal trajectory
    if (changedMethods.includes('expectationMethod') || changedMethods.includes(stagedLongConfig.method)) {
      handleRunLongitudinalAnalysis(stagedLongTargetDrug, stagedLongTargetEvent, stagedLongConfig, newConfigs);
    }
  };

  // Accurate Method Signal Threshold Helper
  const getActiveThreshold = (method: string, configs: MethodConfigs): { threshold: number; label: string } => {
    switch (method) {
      case 'PRR': {
        const val = configs.PRR?.thresholdPRR ?? 2.0;
        return { threshold: val, label: `PRR ≥ ${val.toFixed(2)}` };
      }
      case 'ROR': {
        const val = configs.ROR?.thresholdROR ?? 2.0;
        return { threshold: val, label: `ROR ≥ ${val.toFixed(2)}` };
      }
      case 'BCPNN': {
        const val = configs.BCPNN?.thresholdIC ?? 0.0;
        return { threshold: val, label: `IC > ${val.toFixed(2)}` };
      }
      case 'GPS': {
        const val = configs.GPS?.thresholdEBGM ?? 2.0;
        return { threshold: val, label: `EBGM ≥ ${val.toFixed(2)}` };
      }
      case 'OE': {
        return { threshold: 2.0, label: 'O/E Ratio ≥ 2.0' };
      }
      case 'LASSO': {
        const val = configs.LASSO?.thresholdCoef ?? 0.05;
        return { threshold: val, label: `β ≥ ${val.toFixed(2)}` };
      }
      default: {
        return { threshold: 2.0, label: `Threshold ≥ 2.0` };
      }
    }
  };

  const activeMethodForLongitudinal = executedLongParams?.config.method || stagedLongConfig.method;
  const { threshold: currentThreshold, label: currentThresholdLabel } = getActiveThreshold(
    activeMethodForLongitudinal,
    methodConfigs
  );

  // High-level summary statistics
  const stats = useMemo(() => {
    const totalSignals = (singleMethodResults || []).filter((s) => s.isSignal).length;
    const consensusCount = (consensusSignals || []).filter((c) => c.isConsensusSignal).length;
    const topSignal = (singleMethodResults || []).find((s) => s.isSignal);
    return {
      totalSignals,
      consensusCount,
      topSignal,
    };
  }, [singleMethodResults, consensusSignals]);

  // vigipy Python script generated dynamically
  const pythonScript = useMemo(() => {
    try {
      return generateVigipyPythonCode(
        datasetTitle || 'surveillance_dataset',
        methodConfigs,
        selectedMethod,
        cohortFilter,
        executedLongParams?.config || stagedLongConfig,
        executedLongParams?.drug || stagedLongTargetDrug || 'PRODUCT_NAME',
        executedLongParams?.event || stagedLongTargetEvent || 'EVENT_NAME',
        activeVersion
      );
    } catch (e) {
      console.error('Error generating vigipy Python code:', e);
      return '# Error generating vigipy Python script';
    }
  }, [datasetTitle, methodConfigs, selectedMethod, cohortFilter, executedLongParams, stagedLongConfig, stagedLongTargetDrug, stagedLongTargetEvent, activeVersion]);

  // Export context for Multi-Sheet Excel and 21 CFR Part 11 Audit Trail
  const exportContext: RegulatoryExportContext = useMemo(() => {
    const jaccard: Record<string, Record<string, number>> = {};
    const kappa: Record<string, Record<string, number>> = {};
    const N = Math.max(1, consensusSignals.length);

    activeAnalysisMethods.forEach((m1) => {
      jaccard[m1] = {};
      kappa[m1] = {};
      activeAnalysisMethods.forEach((m2) => {
        if (m1 === m2) {
          jaccard[m1][m2] = 1.0;
          kappa[m1][m2] = 1.0;
          return;
        }
        let both = 0, m1Only = 0, m2Only = 0, neither = 0;
        consensusSignals.forEach((s) => {
          const s1 = s.methodResults[m1]?.isSignal ?? false;
          const s2 = s.methodResults[m2]?.isSignal ?? false;
          if (s1 && s2) both++;
          else if (s1 && !s2) m1Only++;
          else if (!s1 && s2) m2Only++;
          else neither++;
        });
        const union = both + m1Only + m2Only;
        jaccard[m1][m2] = union > 0 ? Number((both / union).toFixed(3)) : 1.0;
        const po = (both + neither) / N;
        const pYes = ((both + m1Only) / N) * ((both + m2Only) / N);
        const pNo = ((m2Only + neither) / N) * ((m1Only + neither) / N);
        const pe = pYes + pNo;
        kappa[m1][m2] = pe >= 1.0 ? 1.0 : Number(Math.max(-1.0, Math.min(1.0, (po - pe) / (1.0 - pe))).toFixed(3));
      });
    });

    return {
      datasetName: datasetTitle || 'Standard Surveillance Cohort',
      recordCount: records.length,
      filteredCount: filteredRecords.length,
      vigipyVersion: activeVersion,
      activeMethods: activeAnalysisMethods,
      methodConfigs,
      consensusSignals,
      methodResults,
      concordanceJaccard: jaccard,
      concordanceKappa: kappa,
    };
  }, [
    datasetTitle,
    records.length,
    filteredRecords.length,
    activeVersion,
    activeAnalysisMethods,
    methodConfigs,
    consensusSignals,
    methodResults,
  ]);

  // Global Keyboard Shortcuts (j/k to navigate rows, i to inspect, f to toggle forest/volcano, Esc to dismiss, ? for help)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'Escape') {
        setIsConfigDrawerOpen(false);
        setIsOpenFDAModalOpen(false);
        setIsFileUploadModalOpen(false);
        setIsProjectContainerOpen(false);
        setIsVersionModalOpen(false);
        setIsAnalysisMethodsModalOpen(false);
        setIsColumnMapperOpen(false);
        setIsDataProfilerOpen(false);
        setIsExportAuditOpen(false);
        setIsKeyboardHelpOpen(false);
        setInspectedSignal(null);
        setSideInspectionSignal(null);
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setIsKeyboardHelpOpen((prev) => !prev);
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        if (activeTab === 'studio') {
          setChartType((prev) => (prev === 'forest' ? 'volcano' : 'forest'));
        }
        return;
      }

      const activeList = volcanoSelectedSignals || singleMethodResults;
      if (activeList.length === 0) return;

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        const currId = (sideInspectionSignal || inspectedSignal)?.id;
        const currIndex = activeList.findIndex((s) => s.id === currId);
        const nextIndex = currIndex >= 0 && currIndex < activeList.length - 1 ? currIndex + 1 : 0;
        setSideInspectionSignal(activeList[nextIndex]);
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        const currId = (sideInspectionSignal || inspectedSignal)?.id;
        const currIndex = activeList.findIndex((s) => s.id === currId);
        const prevIndex = currIndex > 0 ? currIndex - 1 : activeList.length - 1;
        setSideInspectionSignal(activeList[prevIndex]);
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        const active = sideInspectionSignal || (activeList.length > 0 ? activeList[0] : null);
        if (active) {
          setInspectedSignal(active);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTab,
    volcanoSelectedSignals,
    singleMethodResults,
    sideInspectionSignal,
    inspectedSignal,
  ]);

  // Handlers
  const handleSelectSignal = (sig: SignalResult) => {
    setSideInspectionSignal(sig);
  };

  const handleSelectConsensusSignal = (cs: ConsensusSignal) => {
    const currentMethodResult = cs.methodResults[selectedMethod] || cs.methodResults.PRR;
    if (currentMethodResult) {
      setSideInspectionSignal(currentMethodResult);
    }
  };

  const handleLoadDataset = (
    newRecords: FAERSRecord[],
    title: string,
    chosenMethods?: DisproportionalityMethod[]
  ) => {
    setRecords(newRecords);
    setDatasetTitle(title);

    // Immediately set default targets from loaded records
    const drugs = Array.from(new Set(newRecords.map((r) => r.drugName).filter(Boolean))).sort();
    const events = Array.from(new Set(newRecords.map((r) => r.preferredTerm).filter(Boolean))).sort();
    if (drugs.length > 0) setStagedLongTargetDrug(drugs[0]);
    if (events.length > 0) setStagedLongTargetEvent(events[0]);
    setExecutedLongParams(null);

    if (chosenMethods && chosenMethods.length > 0) {
      setActiveAnalysisMethods(chosenMethods);
      if (!chosenMethods.includes(selectedMethod)) {
        setSelectedMethod(chosenMethods[0]);
      }
    }
  };

  // Completely restore project state from a loaded VigipyProjectContainer
  const handleRestoreProject = (container: VigipyProjectContainer) => {
    // 1. Raw Surveillance Records & Title
    setRecords(container.dataset.records);
    setDatasetTitle(container.dataset.title);

    // 2. Cohort Filtration Boundaries
    setCohortFilter(container.cohortFilter);

    // 3. Algorithm Hyperparameters
    setMethodConfigs(container.methodConfigs);

    // 4. Dynamic or Experimental vigipy Methods
    if (container.customMethods && container.customMethods.length > 0) {
      container.customMethods.forEach((m) => methodRegistry.register(m));
    }

    // 5. Active Environment & View Modes
    if (container.environment) {
      setSelectedMethod(container.environment.selectedMethod);
      setChartType(container.environment.chartType || 'forest');
      setActiveTab(container.environment.activeTab || 'studio');
      if (
        container.environment.activeAnalysisMethods &&
        container.environment.activeAnalysisMethods.length > 0
      ) {
        setActiveAnalysisMethods(container.environment.activeAnalysisMethods);
      }
    }

    // 6. Longitudinal Target & Baseline Expectation
    if (container.longitudinal) {
      setStagedLongTargetDrug(container.longitudinal.targetDrug);
      setStagedLongTargetEvent(container.longitudinal.targetEvent);
      setStagedLongConfig(container.longitudinal.config);
      handleRunLongitudinalAnalysis(
        container.longitudinal.targetDrug,
        container.longitudinal.targetEvent,
        container.longitudinal.config
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Global Navigation Header */}
      <Header
        datasetTitle={datasetTitle}
        totalRecords={records.length}
        filteredRecords={filteredRecords.length}
        signalCount={stats.totalSignals}
        consensusCount={stats.consensusCount}
        activeVersion={activeVersion}
        activeMethodCount={activeAnalysisMethods.length}
        onOpenAnalysisMethods={() => setIsAnalysisMethodsModalOpen(true)}
        onOpenOpenFDA={() => setIsOpenFDAModalOpen(true)}
        onOpenDatasetModal={() => setIsFileUploadModalOpen(true)}
        onOpenConfigDrawer={() => setIsConfigDrawerOpen(true)}
        onOpenVersionModal={() => setIsVersionModalOpen(true)}
        onOpenProjectContainer={() => setIsProjectContainerOpen(true)}
        onOpenDataProfiler={() => setIsDataProfilerOpen(true)}
        onOpenExportAudit={() => setIsExportAuditOpen(true)}
      />

      {/* Non-blocking Analysis Progress Banner (Site remains responsive during calculation) */}
      {analysisProgress && (
        <div className="sticky top-0 z-40 bg-slate-950/95 border-b border-indigo-500/30 backdrop-blur-md px-4 py-2.5 shadow-2xl transition-all duration-300">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <RefreshCw className="h-4 w-4 text-indigo-400 animate-spin" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white tracking-wide">
                    vigipy Signal Engines Processing
                  </span>
                  <span className="font-mono font-bold text-indigo-400 text-xs">
                    {analysisProgress.percent}%
                  </span>
                  <span className="rounded-full bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.2 text-[10px] text-emerald-300 font-medium">
                    UI Responsive • Other Interactions Allowed
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-md sm:max-w-xl">
                  {analysisProgress.stage} {analysisProgress.detail ? `— ${analysisProgress.detail}` : ''}
                </p>
              </div>
            </div>

            {/* Glowing animated progress bar */}
            <div className="w-full sm:w-64 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/60 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 transition-all duration-200 rounded-full shadow-lg shadow-indigo-500/50"
                style={{ width: `${analysisProgress.percent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 space-y-5">
        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('studio')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'studio'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>Disproportionality Studio</span>
            </button>

            <button
              onClick={() => setActiveTab('longitudinal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'longitudinal'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              <span>Longitudinal Modeling</span>
            </button>

            <button
              onClick={() => setActiveTab('consensus')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'consensus'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Multi-Method Consensus</span>
            </button>

            <button
              onClick={() => setActiveTab('ddi_network')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'ddi_network'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Activity className="h-4 w-4 text-amber-400" />
              <span>SCORE-DDI Network</span>
            </button>

            <button
              onClick={() => setActiveTab('cohort')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'cohort'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Surveillance Cohort Explorer</span>
            </button>

            <button
              onClick={() => setActiveTab('python')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'python'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Code2 className="h-4 w-4" />
              <span>vigipy Python Script</span>
            </button>
          </div>

          {/* Zero-Pill Typography Metadata */}
          <div className="flex items-center gap-2.5 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse"></span>
              <strong className="text-rose-300 font-bold">{stats.totalSignals}</strong> SDR Signals
            </span>
            <span className="text-slate-600">·</span>
            <span>
              <strong className="text-indigo-300 font-bold">{stats.consensusCount}</strong> Consensus
            </span>
            <span className="text-slate-600">·</span>
            <button
              type="button"
              onClick={() => setIsKeyboardHelpOpen(true)}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors font-sans underline"
              title="View Keyboard Hotkeys (?)"
            >
              Hotkeys (?)
            </button>
          </div>
        </div>

        {/* Global Cohort Slicing / Subsetting Bar */}
        <FilterBar
          filter={cohortFilter}
          onChangeFilter={setCohortFilter}
          totalRecords={records.length}
          filteredRecords={filteredRecords.length}
          availableDrugs={availableDrugs}
          availableEvents={availableEvents}
        />

        {/* Empty State Banner (No stubs or pre-populated data loaded) */}
        {records.length === 0 && (
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 p-6 md:p-8 shadow-xl text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Database className="h-7 w-7" />
            </div>
            <div className="max-w-xl mx-auto space-y-1.5">
              <h2 className="text-lg font-bold text-white font-display">
                No Surveillance Dataset Loaded
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                All synthetic stand-ins and pre-populated data have been removed. Upload your spontaneous adverse event reporting files (.csv, .tsv, .json) or query the live openFDA API to test disproportionality detection end-to-end.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsFileUploadModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Upload Surveillance Extract (.csv, .tsv, .json)</span>
              </button>
              <button
                onClick={() => setIsOpenFDAModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 text-xs font-semibold shadow-sm transition-all"
              >
                <Database className="h-4 w-4 text-cyan-400" />
                <span>Stream Live Reports from openFDA API</span>
              </button>
              <button
                onClick={() => setIsProjectContainerOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-all"
              >
                <Archive className="h-4 w-4 text-violet-400" />
                <span>Restore Project Container (.vigipy.json)</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Disproportionality Studio */}
        {activeTab === 'studio' && (
          <div className="space-y-5">
            {/* Method Selection & Parameter Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 backdrop-blur text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-400 font-semibold mr-1">Method:</span>
                {registeredMethods.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethod(m.id as DisproportionalityMethod)}
                    className={`px-3 py-1 rounded-lg font-mono font-bold transition-all ${
                      selectedMethod === m.id
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                        : 'bg-slate-950/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {m.id}
                  </button>
                ))}
              </div>

              {/* Algorithm Hyperparameter Tuning & Multi-Method Pickers */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsConfigDrawerOpen(true)}
                  className="relative flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors font-medium cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5 text-amber-400" />
                  <span>Configure {selectedMethod}</span>
                  {hasUnappliedSavedConfigs && (
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" title="Saved parameter changes pending rerun" />
                  )}
                </button>

                {hasUnappliedSavedConfigs && (
                  <button
                    onClick={() => {
                      setMethodConfigs(savedMethodConfigs);
                      setConfigToast({
                        message: 'Saved hyperparameters applied & analyses rerun.',
                        type: 'rerun',
                      });
                      setTimeout(() => setConfigToast(null), 4000);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold transition-colors animate-in fade-in cursor-pointer"
                    title="Rerun analyses with saved hyperparameters"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Rerun with Saved Configs</span>
                  </button>
                )}

                <button
                  onClick={() => setIsAnalysisMethodsModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-500/30 transition-colors font-medium cursor-pointer"
                  title="Pick which methods are evaluated in multi-method consensus and conglomerate statistics"
                >
                  <Layers className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Multi-Analysis ({activeAnalysisMethods.length} Methods)</span>
                </button>

                <button
                  onClick={() => setIsProjectContainerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-950/60 hover:bg-violet-900/60 text-violet-300 border border-violet-500/30 transition-colors font-medium cursor-pointer"
                  title="Export full project container or restore prior sessions"
                >
                  <Archive className="h-3.5 w-3.5 text-violet-400" />
                  <span>Project Container</span>
                </button>
              </div>
            </div>

            {/* Split-Pane Layout: Left Main Column + Right Detail Inspection Card */}
            <div className={`grid grid-cols-1 gap-5 ${sideInspectionSignal ? 'xl:grid-cols-12' : ''}`}>
              <div className={`space-y-5 ${sideInspectionSignal ? 'xl:col-span-8' : 'col-span-1'}`}>
                {/* Signals Data Table */}
                <DataTable
                  signals={volcanoSelectedSignals || singleMethodResults}
                  consensusSignals={consensusSignals}
                  rawRecords={filteredRecords}
                  onSelectSignal={handleSelectSignal}
                  selectedSignal={sideInspectionSignal || inspectedSignal}
                  method={selectedMethod}
                  activeMethods={activeAnalysisMethods}
                />

                {/* Active Visualization (Forest Plot by default, or Volcano Plot with brushing & zoom) */}
                {chartType === 'forest' ? (
                  <ForestPlot
                    signals={singleMethodResults}
                    onSelectSignal={handleSelectSignal}
                    selectedSignal={sideInspectionSignal || inspectedSignal}
                    method={selectedMethod}
                    chartType={chartType}
                    onToggleChartType={setChartType}
                  />
                ) : (
                  <VolcanoPlot
                    signals={singleMethodResults}
                    onSelectSignal={handleSelectSignal}
                    selectedSignal={sideInspectionSignal || inspectedSignal}
                    method={selectedMethod}
                    onFilterBySelection={(sel) => setVolcanoSelectedSignals(sel)}
                    activeSelectionCount={volcanoSelectedSignals?.length}
                    onClearSelection={() => setVolcanoSelectedSignals(null)}
                    chartType={chartType}
                    onToggleChartType={setChartType}
                  />
                )}
              </div>

              {/* Right Detail Inspection Card (Master-Detail Split Pane) */}
              {sideInspectionSignal && (
                <div className="xl:col-span-4 xl:sticky xl:top-20 xl:h-fit space-y-4">
                  <SignalInspectionCard
                    signal={sideInspectionSignal}
                    consensusSignal={consensusSignals.find((cs) => cs.id === `${sideInspectionSignal.drug}__${sideInspectionSignal.event}`)}
                    onClose={() => setSideInspectionSignal(null)}
                    onViewLongitudinal={(drug, event) => {
                      setStagedLongTargetDrug(drug);
                      setStagedLongTargetEvent(event);
                      setActiveTab('longitudinal');
                      handleRunLongitudinalAnalysis(drug, event, stagedLongConfig);
                    }}
                    onViewConsensusDetails={() => {
                      setActiveTab('consensus');
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Longitudinal Modeling */}
        {activeTab === 'longitudinal' && (
          <div className="space-y-5">
            {/* Top Bar with View Switcher & Overview */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3 backdrop-blur shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    Longitudinal Signal Surveillance &amp; Screening
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Track temporal emergence trajectories or screen all product-event pairs sorted by longitudinal score
                  </p>
                </div>
              </div>

              {/* View Switcher: Single Trajectory vs Multi-Pair Screening Table vs Multi-AE Graph */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setLongitudinalViewMode('chart')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    longitudinalViewMode === 'chart'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Trajectory Curve &amp; Breakdown</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLongitudinalViewMode('multi_ae')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    longitudinalViewMode === 'multi_ae'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>All Peaking AEs Graph</span>
                  {longitudinalScreeningTrajectories.filter((t) => t.peakScore >= currentThreshold).length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-950 text-rose-300 text-[10px] border border-rose-500/30 font-mono">
                      {longitudinalScreeningTrajectories.filter((t) => t.peakScore >= currentThreshold).length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setLongitudinalViewMode('matrix')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    longitudinalViewMode === 'matrix'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  <span>All Pairs Screening Matrix (Sorted by Score)</span>
                  {longitudinalScreeningTrajectories.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-950 text-rose-300 text-[10px] border border-rose-500/30 font-mono">
                      {longitudinalScreeningTrajectories.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Longitudinal Parameters & Trigger Panel (Clean Zero-Pill Header & Dedicated Dialog) */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur shadow-lg space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-amber-400" />
                      vigipy LongitudinalModel Surveillance
                    </h4>
                    <span className="text-[10px] text-amber-400 font-mono bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 font-semibold">
                      vigipy 3.4
                    </span>
                  </div>
                  {/* Zero-Pill Unboxed Typography for Active Longitudinal Configuration */}
                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 font-mono">
                    <span className="text-slate-300 font-semibold">
                      {executedLongParams?.drug || stagedLongTargetDrug || 'All Candidate Signals'}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-300">
                      {executedLongParams?.event || stagedLongTargetEvent || 'All Adverse Events'}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-amber-300 font-bold">
                      {executedLongParams?.config.method === 'SCORE' ? 'SCORE-DA' : executedLongParams?.config.method || stagedLongConfig.method}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="capitalize text-slate-300">
                      {executedLongParams?.config.timeUnit || stagedLongConfig.timeUnit} Slices
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="capitalize text-slate-300">
                      {executedLongParams?.config.mode || stagedLongConfig.mode} Mode
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400">
                      N₁₁ &ge; {executedLongParams?.config.minCountPerSlice || stagedLongConfig.minCountPerSlice}
                    </span>
                  </div>
                </div>

                {/* Staged Changes Indicator & Actions */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  {hasLongitudinalStagedChanges ? (
                    <span className="text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-lg font-mono flex items-center gap-1.5 animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                      Pending Rerun
                    </span>
                  ) : executedLongParams ? (
                    <span className="text-[11px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-lg font-mono flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      Synchronized
                    </span>
                  ) : null}

                  {/* Open Separate Specification & Options Dialog */}
                  <button
                    type="button"
                    onClick={() => setIsLongitudinalConfigModalOpen(true)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Sliders className="h-3.5 w-3.5 text-amber-400" />
                    <span>Configure Method &amp; Options</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRunLongitudinalAnalysis()}
                    disabled={isLongitudinalRunning || filteredRecords.length === 0}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-lg cursor-pointer ${
                      hasLongitudinalStagedChanges
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 ring-2 ring-rose-400/40'
                        : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                    }`}
                  >
                    {isLongitudinalRunning ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin text-white" />
                        <span>Evaluating Windows...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 fill-white" />
                        <span>Run Surveillance</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* View 1: Detailed Trajectory Curve & Progression Table */}
            {longitudinalViewMode === 'chart' && (
              <>
                <LongitudinalChart
                  trajectory={longitudinalTrajectory}
                  method={executedLongParams?.config.method || stagedLongConfig.method}
                  mode={executedLongParams?.config.mode || stagedLongConfig.mode}
                  expectationModel={executedLongParams?.config.expectationModel || stagedLongConfig.expectationModel}
                  customThreshold={currentThreshold}
                  thresholdLabel={currentThresholdLabel}
                />

                {/* Time Slice Table */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-slate-300">
                      Temporal Window Progression Breakdown ({executedLongParams?.config.expectationModel || stagedLongConfig.expectationModel} baseline)
                    </h4>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {longitudinalTrajectory.points.length} Temporal Windows Analyzed
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                          <th className="py-2 px-3">Time Window</th>
                          <th className="py-2 px-3 text-center">N₁₁ Observed</th>
                          <th className="py-2 px-3 text-center">Expected (E)</th>
                          <th className="py-2 px-3 text-center">O / E Ratio</th>
                          <th className="py-2 px-3 text-center">{executedLongParams?.config.method || stagedLongConfig.method} Score</th>
                          <th className="py-2 px-3 text-center">95% Interval</th>
                          <th className="py-2 px-3 text-center">Cumulative Volume</th>
                          <th className="py-2 px-3 text-center">Alert State</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {longitudinalTrajectory.points.map((p) => {
                          const isFirst = p.timeSlice === longitudinalTrajectory.firstEmergenceSlice;
                          const oe = p.expected > 0 ? (p.n11 / p.expected).toFixed(2) : '—';
                          return (
                            <tr
                              key={p.timeSlice}
                              className={isFirst ? 'bg-rose-950/30' : 'hover:bg-slate-800/30'}
                            >
                              <td className="py-2 px-3 font-bold text-slate-200">{p.timeSlice}</td>
                              <td className="py-2 px-3 text-center text-rose-300 font-bold">{p.n11}</td>
                              <td className="py-2 px-3 text-center text-slate-400">{p.expected.toFixed(1)}</td>
                              <td className="py-2 px-3 text-center text-cyan-300">{oe}x</td>
                              <td className="py-2 px-3 text-center font-bold text-slate-100">{p.score.toFixed(2)}</td>
                              <td className="py-2 px-3 text-center text-slate-400 text-[11px]">
                                [{p.lowerBound.toFixed(2)} - {p.upperBound.toFixed(2)}]
                              </td>
                              <td className="py-2 px-3 text-center text-slate-400">{p.cumulativeCount}</td>
                              <td className="py-2 px-3 text-center">
                                {isFirst ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                    EMERGENCE
                                  </span>
                                ) : p.isSignal ? (
                                  <span className="text-rose-400 text-[11px] font-semibold">Active Signal</span>
                                ) : (
                                  <span className="text-slate-500 text-[11px]">Normal</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* View 2: Multi-Pair Screening Matrix (Sorted by Score across all time slices) */}
            {longitudinalViewMode === 'matrix' && (
              <LongitudinalScreeningTable
                trajectories={longitudinalScreeningTrajectories}
                method={executedLongParams?.config.method || stagedLongConfig.method}
                expectationModel={executedLongParams?.config.expectationModel || stagedLongConfig.expectationModel}
                onSelectPair={(drug, event) => handleInspectPair(drug, event)}
                activeDrug={executedLongParams?.drug || stagedLongTargetDrug}
                activeEvent={executedLongParams?.event || stagedLongTargetEvent}
              />
            )}

            {/* View 3: Multi-AE Comparative Trajectory Graph (All AEs peaking above signal threshold line) */}
            {longitudinalViewMode === 'multi_ae' && (
              <MultiAELongitudinalChart
                targetDrug={executedLongParams?.drug || stagedLongTargetDrug}
                trajectories={longitudinalScreeningTrajectories}
                method={executedLongParams?.config.method || stagedLongConfig.method}
                mode={executedLongParams?.config.mode || stagedLongConfig.mode}
                expectationModel={executedLongParams?.config.expectationModel || stagedLongConfig.expectationModel}
                threshold={currentThreshold}
                onInspectSinglePair={(drug, event) => handleInspectPair(drug, event)}
                availableDrugs={availableDrugs}
                onSelectDrug={(d) => setStagedLongTargetDrug(d)}
              />
            )}
          </div>
        )}

        {/* Tab 3: Multi-Method Consensus */}
        {activeTab === 'consensus' && (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur flex flex-wrap items-center justify-between gap-4 text-xs">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-violet-400" />
                  Ensemble Multi-Method Signal Detection (analyze_all)
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Simultaneously executes PRR, ROR, RFET, BCPNN, GPS, and LASSO to eliminate single-method false positives.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg font-mono">
                  <span className="text-slate-400">Total Evaluated: </span>
                  <span className="text-white font-bold">{consensusSignals.length} pairs</span>
                </div>
                <div className="bg-rose-950/40 border border-rose-500/30 px-3 py-1.5 rounded-lg font-mono">
                  <span className="text-rose-300">Consensus Signals: </span>
                  <span className="text-rose-200 font-bold">{stats.consensusCount}</span>
                </div>
              </div>
            </div>

            <ConsensusHeatmap
              signals={consensusSignals}
              onSelectSignal={handleSelectConsensusSignal}
              selectedSignal={inspectedSignal ? consensusSignals.find((c) => c.id === `${inspectedSignal.drug}__${inspectedSignal.event}`) : null}
            />
          </div>
        )}

        {/* Tab 3b: SCORE-DDI Multi-Drug Interaction Network */}
        {activeTab === 'ddi_network' && (
          <div className="space-y-5">
            <DdiNetworkGraph
              records={filteredRecords}
              onSelectPair={(drug, event) => {
                setStagedLongTargetDrug(drug);
                setStagedLongTargetEvent(event);
                setActiveTab('longitudinal');
                handleRunLongitudinalAnalysis(drug, event, stagedLongConfig);
              }}
            />
          </div>
        )}

        {/* Tab 4: FAERS Cohort Explorer */}
        {activeTab === 'cohort' && (
          <div className="space-y-5">
            <DataTable
              signals={singleMethodResults}
              consensusSignals={consensusSignals}
              rawRecords={filteredRecords}
              onSelectSignal={handleSelectSignal}
              selectedSignal={sideInspectionSignal || inspectedSignal}
              method={selectedMethod}
              activeMethods={activeAnalysisMethods}
            />
          </div>
        )}

        {/* Tab 5: Python / vigipy Code */}
        {activeTab === 'python' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur text-xs flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-emerald-400" />
                  Reproducible vigipy Code Export
                </h3>
                <p className="text-slate-400 mt-0.5">
                  Synchronized with your active cohort filters, parameter configurations, and target models.
                </p>
              </div>
              <a
                href="https://github.com/Shakesbeery/vigipy"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors font-mono text-[11px]"
              >
                <span>Shakesbeery/vigipy on GitHub</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </a>
            </div>

            <PythonCodeViewer code={pythonScript} />
          </div>
        )}
      </main>

      {/* 2x2 Contingency Matrix Drilldown Modal */}
      {inspectedSignal && (
        <ContingencyModal
          drug={inspectedSignal.drug}
          event={inspectedSignal.event}
          table={inspectedSignal.contingency}
          soc={inspectedSignal.soc}
          resultsByMethod={
            consensusSignals.find((c) => c.id === `${inspectedSignal.drug}__${inspectedSignal.event}`)
              ?.methodResults || { [selectedMethod]: inspectedSignal }
          }
          onClose={() => setInspectedSignal(null)}
        />
      )}

      {/* Hyperparameters Drawer */}
      <MethodConfigDrawer
        isOpen={isConfigDrawerOpen}
        onClose={() => setIsConfigDrawerOpen(false)}
        configs={savedMethodConfigs}
        onSaveConfigs={handleSaveConfigs}
        onSaveAndRerun={handleSaveAndRerunConfigs}
        activeMethod={selectedMethod}
        setActiveMethod={setSelectedMethod}
      />

      {/* Multi-Analysis Methods Picker Modal */}
      <AnalysisMethodsModal
        isOpen={isAnalysisMethodsModalOpen}
        onClose={() => setIsAnalysisMethodsModalOpen(false)}
        activeMethods={activeAnalysisMethods}
        onSaveActiveMethods={setActiveAnalysisMethods}
      />

      {/* openFDA Live Query Modal */}
      <OpenFDAModal
        isOpen={isOpenFDAModalOpen}
        onClose={() => setIsOpenFDAModalOpen(false)}
        onIngestRecords={handleLoadDataset}
        currentMethods={activeAnalysisMethods}
      />

      {/* File & Benchmark Datasets Modal */}
      <FileUploadModal
        isOpen={isFileUploadModalOpen}
        onClose={() => setIsFileUploadModalOpen(false)}
        onLoadDataset={handleLoadDataset}
        onOpenColumnMapper={(table, chosenMethods) => {
          setActiveRawTable(table);
          if (chosenMethods && chosenMethods.length > 0) {
            setActiveAnalysisMethods(chosenMethods);
          }
          setIsColumnMapperOpen(true);
        }}
        activeDatasetId={datasetTitle}
        currentMethods={activeAnalysisMethods}
      />

      {/* Interactive Column Mapping Studio Modal */}
      <ColumnMapperModal
        isOpen={isColumnMapperOpen}
        rawTable={activeRawTable}
        onClose={() => {
          setIsColumnMapperOpen(false);
          setActiveRawTable(null);
        }}
        onConfirmMapping={handleLoadDataset}
        initialMethods={activeAnalysisMethods}
      />

      {/* vigipy PyPI Version & Methodology Sync Modal */}
      <VersionManagerModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        activeVersion={activeVersion}
        onSelectVersion={(v) => {
          setActiveVersion(v);
        }}
        versions={versions}
        setVersions={setVersions}
      />

      {/* Project Container & Session Archive Modal */}
      <ProjectContainerModal
        isOpen={isProjectContainerOpen}
        onClose={() => setIsProjectContainerOpen(false)}
        currentProjectParams={{
          datasetTitle,
          records,
          cohortFilter,
          methodConfigs,
          activeMethod: selectedMethod,
          activeTab,
          chartType,
          activeAnalysisMethods,
          longTargetDrug: executedLongParams?.drug || stagedLongTargetDrug,
          longTargetEvent: executedLongParams?.event || stagedLongTargetEvent,
          longConfig: executedLongParams?.config || stagedLongConfig,
          signals: singleMethodResults,
          consensusSignals,
          vigipyVersion: activeVersion,
        }}
        onRestoreProject={handleRestoreProject}
      />

      {/* Dataset Quality & Deduplication Profiler Modal */}
      <DataQualityProfilerModal
        isOpen={isDataProfilerOpen}
        onClose={() => setIsDataProfilerOpen(false)}
        records={records}
        datasetName={datasetTitle || 'Standard Surveillance Cohort'}
        onApplyDeduplication={(cleaned) => {
          setRecords(cleaned);
        }}
      />

      {/* Regulatory Export & GxP Audit Trail Modal */}
      <ExportAuditModal
        isOpen={isExportAuditOpen}
        onClose={() => setIsExportAuditOpen(false)}
        exportContext={exportContext}
      />

      {/* Longitudinal Surveillance Configuration & Parameterization Dialog */}
      <LongitudinalConfigModal
        isOpen={isLongitudinalConfigModalOpen}
        onClose={() => setIsLongitudinalConfigModalOpen(false)}
        config={stagedLongConfig}
        targetDrug={stagedLongTargetDrug}
        targetEvent={stagedLongTargetEvent}
        availableDrugs={availableDrugs}
        availableEvents={availableEvents}
        onSaveAndRun={(newConfig, drug, event) => {
          setStagedLongConfig(newConfig);
          setStagedLongTargetDrug(drug);
          setStagedLongTargetEvent(event);
          handleRunLongitudinalAnalysis(drug, event, newConfig);
        }}
        onScanAllCandidates={() => {
          setLongitudinalViewMode('matrix');
          handleRunLongitudinalAnalysis();
        }}
      />

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      {isKeyboardHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Keyboard Shortcuts &amp; Power Navigation</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsKeyboardHelpOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 font-mono text-[11px]">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-300">Navigate Signal Rows</span>
                <span className="text-indigo-400 font-bold bg-slate-800 px-2 py-0.5 rounded">j / k</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-300">Inspect 2×2 Contingency Table</span>
                <span className="text-indigo-400 font-bold bg-slate-800 px-2 py-0.5 rounded">i</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-300">Toggle Forest / Volcano Plot</span>
                <span className="text-indigo-400 font-bold bg-slate-800 px-2 py-0.5 rounded">f</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-300">Dismiss Drawers &amp; Modals</span>
                <span className="text-indigo-400 font-bold bg-slate-800 px-2 py-0.5 rounded">Esc</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-300">Toggle This Shortcut Menu</span>
                <span className="text-indigo-400 font-bold bg-slate-800 px-2 py-0.5 rounded">?</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 font-sans pt-1">
              Keyboard shortcuts are active anywhere outside text input fields.
            </p>
          </div>
        </div>
      )}

      {/* Method Configuration Notification Toast */}
      {configToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border border-indigo-500/40 bg-slate-900/95 shadow-2xl backdrop-blur text-xs animate-in slide-in-from-bottom duration-200">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-medium text-slate-200">{configToast.message}</span>
          <button
            onClick={() => setConfigToast(null)}
            className="ml-2 text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
