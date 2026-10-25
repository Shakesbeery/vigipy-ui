import React, { useState, useEffect } from "react";
import {
  X,
  Sliders,
  CheckCircle2,
  Settings,
  Flame,
  Layers,
  Sparkles,
  Info,
  RotateCcw,
  Play,
  Activity,
  ShieldAlert,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  RunAnalysisRequest,
  PRRConfigSchema,
  RORConfigSchema,
  RFETConfigSchema,
  BCPNNConfigSchema,
  GPSConfigSchema,
  ZIGPSConfigSchema,
  LASSOConfigSchema,
  SCOREConfigSchema,
  SCOREDDIConfigSchema,
  AEGISConfigSchema,
  MaxSPRTConfigSchema,
  CUSUMConfigSchema,
  DEFAULT_ANALYSIS_REQUEST,
  DEFAULT_PRR_CONFIG,
  DEFAULT_ROR_CONFIG,
  DEFAULT_RFET_CONFIG,
  DEFAULT_BCPNN_CONFIG,
  DEFAULT_GPS_CONFIG,
  DEFAULT_ZIGPS_CONFIG,
  DEFAULT_LASSO_CONFIG,
  DEFAULT_SCORE_CONFIG,
  DEFAULT_SCORE_DDI_CONFIG,
  DEFAULT_AEGIS_CONFIG,
  DEFAULT_MAXSPRT_CONFIG,
  DEFAULT_CUSUM_CONFIG,
  ExpectedMethod,
  DecisionMetric,
} from "../../types";

export interface MethodConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunAnalysis: (config: RunAnalysisRequest) => void;
  onSaveConfig?: (config: RunAnalysisRequest) => void;
  initialConfig?: RunAnalysisRequest;
  isAnalyzing?: boolean;
}

type MethodTab =
  | "consensus"
  | "prr"
  | "ror"
  | "rfet"
  | "bcpnn"
  | "gps"
  | "zigps"
  | "lasso"
  | "score_da"
  | "aegis"
  | "score_ddi"
  | "maxsprt"
  | "cusum";

export const MethodConfigModal: React.FC<MethodConfigModalProps> = ({
  isOpen,
  onClose,
  onRunAnalysis,
  onSaveConfig,
  initialConfig,
  isAnalyzing = false,
}) => {
  // State for each method
  const [activeTab, setActiveTab] = useState<MethodTab>("consensus");
  const [showAdvancedParams, setShowAdvancedParams] = useState<boolean>(false);
  const [consensus, setConsensus] = useState<boolean>(
    initialConfig?.consensus ?? DEFAULT_ANALYSIS_REQUEST.consensus
  );

  const [prr, setPrr] = useState<PRRConfigSchema>(
    initialConfig?.prr || { ...DEFAULT_PRR_CONFIG }
  );
  const [ror, setRor] = useState<RORConfigSchema>(
    initialConfig?.ror || { ...DEFAULT_ROR_CONFIG }
  );
  const [rfet, setRfet] = useState<RFETConfigSchema>(
    initialConfig?.rfet || { ...DEFAULT_RFET_CONFIG }
  );
  const [bcpnn, setBcpnn] = useState<BCPNNConfigSchema>(
    initialConfig?.bcpnn || { ...DEFAULT_BCPNN_CONFIG }
  );
  const [gps, setGps] = useState<GPSConfigSchema>(
    initialConfig?.gps || { ...DEFAULT_GPS_CONFIG }
  );
  const [zigps, setZigps] = useState<ZIGPSConfigSchema>(
    initialConfig?.zigps || { ...DEFAULT_ZIGPS_CONFIG }
  );
  const [lasso, setLasso] = useState<LASSOConfigSchema>(
    initialConfig?.lasso || { ...DEFAULT_LASSO_CONFIG }
  );
  const [scoreDa, setScoreDa] = useState<SCOREConfigSchema>(
    initialConfig?.score_da || initialConfig?.score || { ...DEFAULT_SCORE_CONFIG }
  );
  const [scoreDdi, setScoreDdi] = useState<SCOREDDIConfigSchema>(
    initialConfig?.score_ddi || { ...DEFAULT_SCORE_DDI_CONFIG }
  );
  const [aegis, setAegis] = useState<AEGISConfigSchema>(
    initialConfig?.aegis || { ...DEFAULT_AEGIS_CONFIG }
  );
  const [maxsprt, setMaxsprt] = useState<MaxSPRTConfigSchema>(
    initialConfig?.maxsprt || { ...DEFAULT_MAXSPRT_CONFIG }
  );
  const [cusum, setCusum] = useState<CUSUMConfigSchema>(
    initialConfig?.cusum || initialConfig?.cusum_da || { ...DEFAULT_CUSUM_CONFIG }
  );

  // Sync state if initialConfig changes
  useEffect(() => {
    if (initialConfig) {
      if (initialConfig.prr !== undefined && initialConfig.prr !== null) setPrr({ ...initialConfig.prr });
      if (initialConfig.ror !== undefined && initialConfig.ror !== null) setRor({ ...initialConfig.ror });
      if (initialConfig.rfet !== undefined && initialConfig.rfet !== null) setRfet({ ...initialConfig.rfet });
      if (initialConfig.bcpnn !== undefined && initialConfig.bcpnn !== null) setBcpnn({ ...initialConfig.bcpnn });
      if (initialConfig.gps !== undefined && initialConfig.gps !== null) setGps({ ...initialConfig.gps });
      if (initialConfig.zigps !== undefined && initialConfig.zigps !== null) setZigps({ ...initialConfig.zigps });
      if (initialConfig.lasso !== undefined && initialConfig.lasso !== null) setLasso({ ...initialConfig.lasso });
      if (initialConfig.score_da !== undefined && initialConfig.score_da !== null) setScoreDa({ ...initialConfig.score_da });
      else if (initialConfig.score !== undefined && initialConfig.score !== null) setScoreDa({ ...initialConfig.score });
      if (initialConfig.score_ddi !== undefined && initialConfig.score_ddi !== null) setScoreDdi({ ...initialConfig.score_ddi });
      if (initialConfig.aegis !== undefined && initialConfig.aegis !== null) setAegis({ ...initialConfig.aegis });
      if (initialConfig.maxsprt !== undefined && initialConfig.maxsprt !== null) setMaxsprt({ ...initialConfig.maxsprt });
      if (initialConfig.cusum !== undefined && initialConfig.cusum !== null) setCusum({ ...initialConfig.cusum });
      else if (initialConfig.cusum_da !== undefined && initialConfig.cusum_da !== null) setCusum({ ...initialConfig.cusum_da });
      if (initialConfig.consensus !== undefined && initialConfig.consensus !== null) setConsensus(initialConfig.consensus);
    }
  }, [initialConfig]);

  if (!isOpen) return null;

  // Count active methods
  const activeMethodCount = [
    prr.enabled,
    ror.enabled,
    rfet.enabled,
    bcpnn.enabled,
    gps.enabled,
    zigps.enabled,
    lasso.enabled,
    scoreDa.enabled,
    scoreDdi.enabled,
    aegis.enabled,
    maxsprt.enabled,
    cusum.enabled,
  ].filter(Boolean).length;

  // Preset Configurations
  const applyPreset = (presetName: "fda" | "ema" | "all" | "core" | "synergy" | "modern" | "sequential") => {
    switch (presetName) {
      case "fda":
        setPrr((p) => ({ ...p, enabled: true }));
        setRor((p) => ({ ...p, enabled: false }));
        setRfet((p) => ({ ...p, enabled: false }));
        setBcpnn((p) => ({ ...p, enabled: false }));
        setGps((p) => ({ ...p, enabled: true }));
        setZigps((p) => ({ ...p, enabled: false }));
        setLasso((p) => ({ ...p, enabled: false }));
        setScoreDa((p) => ({ ...p, enabled: false }));
        setScoreDdi((p) => ({ ...p, enabled: false }));
        setAegis((p) => ({ ...p, enabled: false }));
        setMaxsprt((p) => ({ ...p, enabled: false }));
        setCusum((p) => ({ ...p, enabled: false }));
        setConsensus(true);
        break;
      case "ema":
        setPrr((p) => ({ ...p, enabled: false }));
        setRor((p) => ({ ...p, enabled: true }));
        setRfet((p) => ({ ...p, enabled: false }));
        setBcpnn((p) => ({ ...p, enabled: true }));
        setGps((p) => ({ ...p, enabled: false }));
        setZigps((p) => ({ ...p, enabled: false }));
        setLasso((p) => ({ ...p, enabled: false }));
        setScoreDa((p) => ({ ...p, enabled: false }));
        setScoreDdi((p) => ({ ...p, enabled: false }));
        setAegis((p) => ({ ...p, enabled: false }));
        setMaxsprt((p) => ({ ...p, enabled: false }));
        setCusum((p) => ({ ...p, enabled: false }));
        setConsensus(true);
        break;
      case "core":
        setPrr((p) => ({ ...p, enabled: true }));
        setRor((p) => ({ ...p, enabled: true }));
        setRfet((p) => ({ ...p, enabled: true }));
        setBcpnn((p) => ({ ...p, enabled: true }));
        setGps((p) => ({ ...p, enabled: true }));
        setZigps((p) => ({ ...p, enabled: false }));
        setLasso((p) => ({ ...p, enabled: false }));
        setScoreDa((p) => ({ ...p, enabled: false }));
        setScoreDdi((p) => ({ ...p, enabled: false }));
        setAegis((p) => ({ ...p, enabled: false }));
        setMaxsprt((p) => ({ ...p, enabled: false }));
        setCusum((p) => ({ ...p, enabled: false }));
        setConsensus(true);
        break;
      case "modern":
        setPrr((p) => ({ ...p, enabled: true }));
        setRor((p) => ({ ...p, enabled: false }));
        setRfet((p) => ({ ...p, enabled: false }));
        setBcpnn((p) => ({ ...p, enabled: false }));
        setGps((p) => ({ ...p, enabled: false }));
        setZigps((p) => ({ ...p, enabled: true }));
        setLasso((p) => ({ ...p, enabled: false }));
        setScoreDa((p) => ({ ...p, enabled: true }));
        setScoreDdi((p) => ({ ...p, enabled: false }));
        setAegis((p) => ({ ...p, enabled: true }));
        setMaxsprt((p) => ({ ...p, enabled: false }));
        setCusum((p) => ({ ...p, enabled: false }));
        setConsensus(true);
        break;
      case "sequential":
        setPrr((p) => ({ ...p, enabled: false }));
        setRor((p) => ({ ...p, enabled: false }));
        setRfet((p) => ({ ...p, enabled: false }));
        setBcpnn((p) => ({ ...p, enabled: false }));
        setGps((p) => ({ ...p, enabled: false }));
        setZigps((p) => ({ ...p, enabled: false }));
        setLasso((p) => ({ ...p, enabled: false }));
        setScoreDa((p) => ({ ...p, enabled: false }));
        setScoreDdi((p) => ({ ...p, enabled: false }));
        setAegis((p) => ({ ...p, enabled: false }));
        setMaxsprt((p) => ({ ...p, enabled: true }));
        setCusum((p) => ({ ...p, enabled: true }));
        setConsensus(true);
        break;
      case "synergy":
        setPrr((p) => ({ ...p, enabled: false }));
        setRor((p) => ({ ...p, enabled: false }));
        setRfet((p) => ({ ...p, enabled: false }));
        setBcpnn((p) => ({ ...p, enabled: false }));
        setGps((p) => ({ ...p, enabled: false }));
        setZigps((p) => ({ ...p, enabled: false }));
        setLasso((p) => ({ ...p, enabled: true }));
        setScoreDa((p) => ({ ...p, enabled: true }));
        setScoreDdi((p) => ({ ...p, enabled: true }));
        setAegis((p) => ({ ...p, enabled: false }));
        setMaxsprt((p) => ({ ...p, enabled: false }));
        setCusum((p) => ({ ...p, enabled: false }));
        setConsensus(true);
        break;
      case "all":
        setPrr((p) => ({ ...p, enabled: true }));
        setRor((p) => ({ ...p, enabled: true }));
        setRfet((p) => ({ ...p, enabled: true }));
        setBcpnn((p) => ({ ...p, enabled: true }));
        setGps((p) => ({ ...p, enabled: true }));
        setZigps((p) => ({ ...p, enabled: true }));
        setLasso((p) => ({ ...p, enabled: true }));
        setScoreDa((p) => ({ ...p, enabled: true }));
        setScoreDdi((p) => ({ ...p, enabled: true }));
        setAegis((p) => ({ ...p, enabled: true }));
        setMaxsprt((p) => ({ ...p, enabled: true }));
        setCusum((p) => ({ ...p, enabled: true }));
        setConsensus(true);
        break;
    }
  };

  const handleResetDefaults = () => {
    setPrr({ ...DEFAULT_PRR_CONFIG });
    setRor({ ...DEFAULT_ROR_CONFIG });
    setRfet({ ...DEFAULT_RFET_CONFIG });
    setBcpnn({ ...DEFAULT_BCPNN_CONFIG });
    setGps({ ...DEFAULT_GPS_CONFIG });
    setZigps({ ...DEFAULT_ZIGPS_CONFIG });
    setLasso({ ...DEFAULT_LASSO_CONFIG });
    setScoreDa({ ...DEFAULT_SCORE_CONFIG });
    setScoreDdi({ ...DEFAULT_SCORE_DDI_CONFIG });
    setAegis({ ...DEFAULT_AEGIS_CONFIG });
    setMaxsprt({ ...DEFAULT_MAXSPRT_CONFIG });
    setCusum({ ...DEFAULT_CUSUM_CONFIG });
    setConsensus(true);
  };

  const buildConfigPayload = (): RunAnalysisRequest => ({
    prr: { ...prr },
    ror: { ...ror },
    rfet: { ...rfet },
    bcpnn: { ...bcpnn },
    gps: { ...gps },
    zigps: { ...zigps },
    lasso: { ...lasso },
    score_da: { ...scoreDa },
    score_ddi: { ...scoreDdi },
    aegis: { ...aegis },
    maxsprt: { ...maxsprt },
    cusum: { ...cusum },
    consensus,
  });

  const handleRun = () => {
    if (activeMethodCount === 0) {
      alert("Please enable at least one disproportionality method to execute analysis.");
      return;
    }

    const payload = buildConfigPayload();
    onRunAnalysis(payload);
  };

  const handleSave = () => {
    const payload = buildConfigPayload();
    if (onSaveConfig) {
      onSaveConfig(payload);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">
                  Disproportionality Method Configuration
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {activeMethodCount} Active Method{activeMethodCount !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Configure frequentist, Bayesian shrinkage, and regularized regression parameters.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Presets Bar */}
        <div className="px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase text-slate-500 tracking-wider">
              Presets:
            </span>
            <button
              onClick={() => applyPreset("fda")}
              className="px-2.5 py-1 rounded-md text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="PRR + GPS (Standard FDA post-marketing guidance)"
            >
              FDA Standard
            </button>
            <button
              onClick={() => applyPreset("ema")}
              className="px-2.5 py-1 rounded-md text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="ROR + BCPNN (Standard EMA & WHO Uppsala Monitoring Centre)"
            >
              EMA / WHO Standard
            </button>
            <button
              onClick={() => applyPreset("core")}
              className="px-2.5 py-1 rounded-md text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="PRR, ROR, RFET, BCPNN, GPS (Recommended robust suite)"
            >
              Core Suite (5 Methods)
            </button>
            <button
              onClick={() => applyPreset("synergy")}
              className="px-2.5 py-1 rounded-md text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="SCORE-DA, SCORE-DDI, and Relaxed LASSO for high-dimensional polypharmacy discovery"
            >
              Syndromic & Polypharmacy
            </button>
            <button
              onClick={() => applyPreset("all")}
              className="px-2.5 py-1 rounded-md text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="All 8 methods including LASSO, SCORE-DA, and SCORE-DDI"
            >
              All 8 Methods
            </button>
          </div>

          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>

        {/* Modal Body: Left Tab List + Right Parameter Editor */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Navigation Sidebar */}
          <div className="w-full md:w-56 bg-slate-950/40 border-b md:border-b-0 md:border-r border-slate-800 p-3 space-y-1 overflow-y-auto shrink-0 select-none">
            {/* Consensus Tab */}
            <div
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition border ${
                activeTab === "consensus"
                  ? "bg-indigo-600/30 text-white shadow-md shadow-indigo-600/20 border-indigo-500/40"
                  : "text-slate-300 hover:bg-slate-800/80 border-transparent"
              }`}
            >
              <div
                onClick={() => setActiveTab("consensus")}
                className="flex items-center gap-2 flex-1 cursor-pointer select-none"
                title="View consensus engine configuration"
              >
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold">Consensus Engine</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConsensus(!consensus);
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1 shrink-0 ${
                  consensus
                    ? "bg-indigo-500/30 text-indigo-200 border border-indigo-500/50 hover:bg-indigo-500/40"
                    : "bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700 hover:text-slate-400"
                }`}
                title={`Click to turn Consensus ${consensus ? "OFF" : "ON"}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${consensus ? "bg-indigo-400 animate-pulse" : "bg-slate-500"}`} />
                <span>{consensus ? "ON" : "OFF"}</span>
              </button>
            </div>

            {/* Category: Frequentist Disproportionality */}
            <div className="pt-2 pb-1 px-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              Frequentist DA
            </div>

            {/* PRR */}
            <MethodTabButton
              tabKey="prr"
              label="PRR"
              sub="Proportional Reporting"
              enabled={prr.enabled}
              active={activeTab === "prr"}
              onClick={() => setActiveTab("prr")}
              onToggle={(val) => setPrr((p) => ({ ...p, enabled: val }))}
            />

            {/* ROR */}
            <MethodTabButton
              tabKey="ror"
              label="ROR"
              sub="Reporting Odds Ratio"
              enabled={ror.enabled}
              active={activeTab === "ror"}
              onClick={() => setActiveTab("ror")}
              onToggle={(val) => setRor((p) => ({ ...p, enabled: val }))}
            />

            {/* RFET */}
            <MethodTabButton
              tabKey="rfet"
              label="RFET"
              sub="Fisher's Exact Test"
              enabled={rfet.enabled}
              active={activeTab === "rfet"}
              onClick={() => setActiveTab("rfet")}
              onToggle={(val) => setRfet((p) => ({ ...p, enabled: val }))}
            />

            {/* Category: Bayesian Shrinkage */}
            <div className="pt-3 pb-1 px-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              Bayesian Shrinkage
            </div>

            {/* BCPNN */}
            <MethodTabButton
              tabKey="bcpnn"
              label="BCPNN"
              sub="Bayesian Info Component"
              enabled={bcpnn.enabled}
              active={activeTab === "bcpnn"}
              onClick={() => setActiveTab("bcpnn")}
              onToggle={(val) => setBcpnn((p) => ({ ...p, enabled: val }))}
            />

            {/* GPS */}
            <MethodTabButton
              tabKey="gps"
              label="GPS"
              sub="Gamma Poisson Shrinker"
              enabled={gps.enabled}
              active={activeTab === "gps"}
              onClick={() => setActiveTab("gps")}
              onToggle={(val) => setGps((p) => ({ ...p, enabled: val }))}
            />

            {/* ZIGPS */}
            <MethodTabButton
              tabKey="zigps"
              label="ZIGPS"
              sub="Zero-Inflated GPS"
              enabled={zigps.enabled}
              active={activeTab === "zigps"}
              onClick={() => setActiveTab("zigps")}
              onToggle={(val) => setZigps((p) => ({ ...p, enabled: val }))}
            />

            {/* Category: Indication & Confounding Adjustment */}
            <div className="pt-3 pb-1 px-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              Indication & Unmasking
            </div>

            {/* LASSO */}
            <MethodTabButton
              tabKey="lasso"
              label="LASSO"
              sub="Penalized Regression"
              enabled={lasso.enabled}
              active={activeTab === "lasso"}
              onClick={() => setActiveTab("lasso")}
              onToggle={(val) => setLasso((p) => ({ ...p, enabled: val }))}
            />

            {/* SCORE-DA */}
            <MethodTabButton
              tabKey="score_da"
              label="SCORE-DA"
              sub="Syndromic Residuals"
              enabled={scoreDa.enabled}
              active={activeTab === "score_da"}
              onClick={() => setActiveTab("score_da")}
              onToggle={(val) => setScoreDa((p) => ({ ...p, enabled: val }))}
            />

            {/* AEGIS */}
            <MethodTabButton
              tabKey="aegis"
              label="AEGIS"
              sub="LOCO Graph Unmasking"
              enabled={aegis.enabled}
              active={activeTab === "aegis"}
              onClick={() => setActiveTab("aegis")}
              onToggle={(val) => setAegis((p) => ({ ...p, enabled: val }))}
            />

            {/* Category: Combinations & Interaction */}
            <div className="pt-3 pb-1 px-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              Combinations & DDI
            </div>

            {/* SCORE-DDI */}
            <MethodTabButton
              tabKey="score_ddi"
              label="SCORE-DDI"
              sub="Multi-Drug Synergy"
              enabled={scoreDdi.enabled}
              active={activeTab === "score_ddi"}
              onClick={() => setActiveTab("score_ddi")}
              onToggle={(val) => setScoreDdi((p) => ({ ...p, enabled: val }))}
            />

            {/* Category: Sequential Surveillance */}
            <div className="pt-3 pb-1 px-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              Sequential Surveillance
            </div>

            {/* MaxSPRT */}
            <MethodTabButton
              tabKey="maxsprt"
              label="MaxSPRT"
              sub="Sequential Ratio Test"
              enabled={maxsprt.enabled}
              active={activeTab === "maxsprt"}
              onClick={() => setActiveTab("maxsprt")}
              onToggle={(val) => setMaxsprt((p) => ({ ...p, enabled: val }))}
            />

            {/* CUSUM-DA */}
            <MethodTabButton
              tabKey="cusum"
              label="CUSUM-DA"
              sub="Change-Point Detector"
              enabled={cusum.enabled}
              active={activeTab === "cusum"}
              onClick={() => setActiveTab("cusum")}
              onToggle={(val) => setCusum((p) => ({ ...p, enabled: val }))}
            />
          </div>

          {/* Configuration Form Area */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {/* 1. Consensus Configuration */}
            {activeTab === "consensus" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                      <h4 className="text-sm font-semibold text-white">
                        Synthesize Cross-Method Consensus
                      </h4>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consensus}
                        onChange={(e) => setConsensus(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    When enabled, vigipy computes multi-method voting (1 to N methods), calculates a normalized composite rank, and partitions signals into validated clinical agreement tiers:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                    <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-emerald-500/30 text-emerald-300">
                      Unanimous: 100% Votes
                    </div>
                    <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-blue-500/30 text-blue-300">
                      Strong: ≥ 75% Votes
                    </div>
                    <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-500/30 text-amber-300">
                      Moderate: ≥ 50% Votes
                    </div>
                    <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-orange-500/30 text-orange-300">
                      Weak: ≥ 25% Votes
                    </div>
                    <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400">
                      Isolated: 1 Vote
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <h5 className="text-xs font-semibold text-slate-200">
                    Method Concordance Matrix
                  </h5>
                  <p className="text-xs text-slate-400">
                    Enabling consensus also automatically generates pairwise concordance metrics across all active disproportionality algorithms: Jaccard similarity indices, Cohen's Kappa inter-rater agreement, Spearman rank correlations, and 2x2 alert contingency tables.
                  </p>
                </div>
              </div>
            )}

            {/* 2. PRR Configuration */}
            {activeTab === "prr" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <MethodToggleHeader
                  title="PRR (Proportional Reporting Ratio)"
                  subtitle="Standard frequentist metric comparing relative proportion of AE under suspect drug vs other drugs."
                  enabled={prr.enabled}
                  onToggle={(enabled) => setPrr({ ...prr, enabled })}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField
                    label="Min Incident Events"
                    value={prr.min_events}
                    min={1}
                    step={1}
                    onChange={(val) => setPrr({ ...prr, min_events: val })}
                    help="Minimum report count required to evaluate signal."
                  />
                  <SelectField
                    label="Decision Metric"
                    value={prr.decision_metric}
                    options={[
                      { value: "fdr", label: "FDR (Benjamini-Hochberg)" },
                      { value: "rank", label: "Rank (Top N Signals)" },
                      { value: "signals", label: "Signals (CI Threshold)" },
                    ]}
                    onChange={(val) => setPrr({ ...prr, decision_metric: val as DecisionMetric })}
                  />
                  <NumberField
                    label="Decision Threshold"
                    value={prr.decision_thres}
                    step={0.01}
                    onChange={(val) => setPrr({ ...prr, decision_thres: val })}
                    help="Significance threshold for alert flagging."
                  />
                  <SelectField
                    label="Ranking Statistic"
                    value={prr.ranking_statistic}
                    options={[
                      { value: "p_value", label: "p-value" },
                      { value: "CI", label: "95% CI Lower Bound" },
                    ]}
                    onChange={(val) => setPrr({ ...prr, ranking_statistic: val as "p_value" | "CI" })}
                  />
                  <SelectField
                    label="Expected Method"
                    value={prr.expected_method}
                    options={[
                      { value: "mantel-haentzel", label: "Mantel-Haenszel (Multinomial)" },
                      { value: "poisson", label: "Poisson" },
                      { value: "negative-binomial", label: "Negative-Binomial (Overdispersed)" },
                    ]}
                    onChange={(val) => setPrr({ ...prr, expected_method: val as ExpectedMethod })}
                  />
                  <NumberField
                    label="FDR Threshold"
                    value={prr.fdr_threshold}
                    step={0.01}
                    onChange={(val) => setPrr({ ...prr, fdr_threshold: val })}
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={prr.continuity_correction}
                      onChange={(e) => setPrr({ ...prr, continuity_correction: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-slate-200">
                        Yates' Continuity Correction
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Applies 0.5 adjustment to cells to reduce small-sample bias.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* 3. ROR Configuration */}
            {activeTab === "ror" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <MethodToggleHeader
                  title="ROR (Reporting Odds Ratio)"
                  subtitle="Odds ratio analog for pharmacovigilance contingency tables (recommended by EMA)."
                  enabled={ror.enabled}
                  onToggle={(enabled) => setRor({ ...ror, enabled })}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField
                    label="Min Incident Events"
                    value={ror.min_events}
                    min={1}
                    step={1}
                    onChange={(val) => setRor({ ...ror, min_events: val })}
                  />
                  <SelectField
                    label="Decision Metric"
                    value={ror.decision_metric}
                    options={[
                      { value: "fdr", label: "FDR (Benjamini-Hochberg)" },
                      { value: "rank", label: "Rank (Top N Signals)" },
                      { value: "signals", label: "Signals (CI Threshold)" },
                    ]}
                    onChange={(val) => setRor({ ...ror, decision_metric: val as DecisionMetric })}
                  />
                  <NumberField
                    label="Decision Threshold"
                    value={ror.decision_thres}
                    step={0.01}
                    onChange={(val) => setRor({ ...ror, decision_thres: val })}
                  />
                  <SelectField
                    label="Ranking Statistic"
                    value={ror.ranking_statistic}
                    options={[
                      { value: "p_value", label: "p-value" },
                      { value: "CI", label: "95% CI Lower Bound" },
                    ]}
                    onChange={(val) => setRor({ ...ror, ranking_statistic: val as "p_value" | "CI" })}
                  />
                  <SelectField
                    label="Expected Method"
                    value={ror.expected_method}
                    options={[
                      { value: "mantel-haentzel", label: "Mantel-Haenszel (Multinomial)" },
                      { value: "poisson", label: "Poisson" },
                      { value: "negative-binomial", label: "Negative-Binomial" },
                    ]}
                    onChange={(val) => setRor({ ...ror, expected_method: val as ExpectedMethod })}
                  />
                  <NumberField
                    label="FDR Threshold"
                    value={ror.fdr_threshold}
                    step={0.01}
                    onChange={(val) => setRor({ ...ror, fdr_threshold: val })}
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={ror.continuity_correction}
                      onChange={(e) => setRor({ ...ror, continuity_correction: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-slate-200">
                        Haldane-Anscombe Correction
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Adds 0.5 to zero cells to prevent division by zero in odds ratio.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* 4. RFET Configuration */}
            {activeTab === "rfet" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <MethodToggleHeader
                  title="RFET (Reporting Fisher's Exact Test)"
                  subtitle="Exact hypergeometric non-parametric contingency test without asymptotic approximations."
                  enabled={rfet.enabled}
                  onToggle={(enabled) => setRfet({ ...rfet, enabled })}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField
                    label="Min Incident Events"
                    value={rfet.min_events}
                    min={1}
                    step={1}
                    onChange={(val) => setRfet({ ...rfet, min_events: val })}
                  />
                  <SelectField
                    label="Decision Metric"
                    value={rfet.decision_metric}
                    options={[
                      { value: "fdr", label: "FDR (Benjamini-Hochberg)" },
                      { value: "rank", label: "Rank (Top N Signals)" },
                      { value: "signals", label: "Signals (p < threshold)" },
                    ]}
                    onChange={(val) => setRfet({ ...rfet, decision_metric: val as DecisionMetric })}
                  />
                  <NumberField
                    label="Decision Threshold"
                    value={rfet.decision_thres}
                    step={0.01}
                    onChange={(val) => setRfet({ ...rfet, decision_thres: val })}
                  />
                  <SelectField
                    label="Expected Method"
                    value={rfet.expected_method}
                    options={[
                      { value: "mantel-haentzel", label: "Mantel-Haenszel (Multinomial)" },
                      { value: "poisson", label: "Poisson" },
                      { value: "negative-binomial", label: "Negative-Binomial" },
                    ]}
                    onChange={(val) => setRfet({ ...rfet, expected_method: val as ExpectedMethod })}
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rfet.mid_pval}
                      onChange={(e) => setRfet({ ...rfet, mid_pval: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-slate-200">
                        Lancaster Mid-p Correction
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Reduces extreme conservatism of standard Fisher's Exact test for discrete tables.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* 5. BCPNN Configuration */}
            {activeTab === "bcpnn" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <MethodToggleHeader
                  title="BCPNN (Information Component - IC)"
                  subtitle="Bayesian neural network estimating information component log2(P_xy / P_x * P_y) with Beta-Binomial conjugate priors."
                  enabled={bcpnn.enabled}
                  onToggle={(enabled) => setBcpnn({ ...bcpnn, enabled })}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField
                    label="Min Incident Events"
                    value={bcpnn.min_events}
                    min={1}
                    step={1}
                    onChange={(val) => setBcpnn({ ...bcpnn, min_events: val })}
                  />
                  <SelectField
                    label="Decision Metric"
                    value={bcpnn.decision_metric}
                    options={[
                      { value: "rank", label: "Rank (Top N Signals)" },
                      { value: "fdr", label: "FDR (Benjamini-Hochberg)" },
                      { value: "signals", label: "Signals (IC025 > 0)" },
                    ]}
                    onChange={(val) => setBcpnn({ ...bcpnn, decision_metric: val as "rank" | "fdr" | "signals" })}
                  />
                  <NumberField
                    label="Decision Threshold (IC025)"
                    value={bcpnn.decision_thres}
                    step={0.1}
                    onChange={(val) => setBcpnn({ ...bcpnn, decision_thres: val })}
                    help="Default 0.0 corresponds to standard WHO IC025 > 0 criterion."
                  />
                  <SelectField
                    label="Ranking Statistic"
                    value={bcpnn.ranking_statistic}
                    options={[
                      { value: "quantile", label: "IC025 (Lower 2.5% Credible Interval)" },
                      { value: "p_value", label: "Posterior Exceedance Probability" },
                    ]}
                    onChange={(val) => setBcpnn({ ...bcpnn, ranking_statistic: val as "quantile" | "p_value" })}
                  />
                  <SelectField
                    label="Expected Method"
                    value={bcpnn.expected_method}
                    options={[
                      { value: "mantel-haentzel", label: "Mantel-Haenszel (Multinomial)" },
                      { value: "poisson", label: "Poisson" },
                      { value: "negative-binomial", label: "Negative-Binomial" },
                    ]}
                    onChange={(val) => setBcpnn({ ...bcpnn, expected_method: val as ExpectedMethod })}
                  />
                  <NumberField
                    label="Method Alpha (Prior Weight)"
                    value={bcpnn.method_alpha}
                    step={0.1}
                    onChange={(val) => setBcpnn({ ...bcpnn, method_alpha: val })}
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={bcpnn.MC}
                      onChange={(e) => setBcpnn({ ...bcpnn, MC: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-slate-200">
                        Monte Carlo Credible Interval Sampling
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Simulate exact posterior distributions rather than Cornish-Fisher normal approximation.
                      </p>
                    </div>
                  </label>

                  {bcpnn.MC && (
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-slate-300">MC Sample Iterations:</span>
                      <input
                        type="number"
                        min={1000}
                        step={1000}
                        value={bcpnn.num_MC}
                        onChange={(e) => setBcpnn({ ...bcpnn, num_MC: parseInt(e.target.value, 10) || 10000 })}
                        className="w-28 px-3 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white text-center"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 6. GPS Configuration */}
            {activeTab === "gps" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <MethodToggleHeader
                  title="GPS (Gamma Poisson Shrinker - EBGM)"
                  subtitle="DuMouchel empirical Bayes mixture model estimating EBGM (Empirical Bayes Geometric Mean) and EB05."
                  enabled={gps.enabled}
                  onToggle={(enabled) => setGps({ ...gps, enabled })}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField
                    label="Min Incident Events"
                    value={gps.min_events}
                    min={1}
                    step={1}
                    onChange={(val) => setGps({ ...gps, min_events: val })}
                  />
                  <SelectField
                    label="Decision Metric"
                    value={gps.decision_metric}
                    options={[
                      { value: "rank", label: "Rank (Top N Signals)" },
                      { value: "signals", label: "Signals (EB05 Threshold)" },
                      { value: "fdr", label: "FDR" },
                    ]}
                    onChange={(val) => setGps({ ...gps, decision_metric: val as "rank" | "fdr" | "signals" })}
                  />
                  <NumberField
                    label="Decision Threshold"
                    value={gps.decision_thres}
                    step={0.05}
                    onChange={(val) => setGps({ ...gps, decision_thres: val })}
                  />
                  <SelectField
                    label="Ranking Statistic"
                    value={gps.ranking_statistic}
                    options={[
                      { value: "log2", label: "log2(EBGM)" },
                      { value: "quantile", label: "EB05 (Lower 5% Credible Bound)" },
                      { value: "p_value", label: "p-value" },
                    ]}
                    onChange={(val) => setGps({ ...gps, ranking_statistic: val as "log2" | "p_value" | "quantile" })}
                  />
                  <SelectField
                    label="Expected Method"
                    value={gps.expected_method}
                    options={[
                      { value: "mantel-haentzel", label: "Mantel-Haenszel (Multinomial)" },
                      { value: "poisson", label: "Poisson" },
                      { value: "negative-binomial", label: "Negative-Binomial" },
                    ]}
                    onChange={(val) => setGps({ ...gps, expected_method: val as ExpectedMethod })}
                  />
                  <SelectField
                    label="Optimization Algorithm"
                    value={gps.minimization_method}
                    options={[
                      { value: "Nelder-Mead", label: "Nelder-Mead (Simplex)" },
                      { value: "BFGS", label: "Quasi-Newton BFGS" },
                      { value: "Powell", label: "Powell Conjugate Direction" },
                    ]}
                    onChange={(val) => setGps({ ...gps, minimization_method: val })}
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={gps.truncate}
                      onChange={(e) => setGps({ ...gps, truncate: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-slate-200">
                        Empirical Bayes Likelihood Truncation
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Truncates small event counts in marginal likelihood estimation to accelerate hyperparameter convergence.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* 7. LASSO Configuration */}
            {activeTab === "lasso" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <MethodToggleHeader
                  title="LASSO (Penalized Logistic/Poisson Regression)"
                  subtitle="Regularized multi-variable regression with bootstrap stability selection for confounding adjustment."
                  enabled={lasso.enabled}
                  onToggle={(enabled) => setLasso({ ...lasso, enabled })}
                />

                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                  Note: LASSO utilizes iterative cross-validated optimization with bootstrap resamplings. For large datasets (&gt;100k pairs), running LASSO will increase calculation time.
                </div>

                {/* Primary Clinical Thresholds */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField
                    label="Decision Threshold (Beta Coefficient)"
                    value={lasso.lasso_thresh}
                    step={0.01}
                    onChange={(val) => setLasso({ ...lasso, lasso_thresh: val })}
                    help="Minimum beta coefficient to trigger an alerting signal."
                  />
                  <NumberField
                    label="Min Incident Events"
                    value={lasso.min_events}
                    min={1}
                    step={1}
                    onChange={(val) => setLasso({ ...lasso, min_events: val })}
                    help="Minimum report count required for inclusion in regression."
                  />
                  <SelectField
                    label="Regression Family"
                    value={lasso.family}
                    options={[
                      { value: "logistic", label: "Binomial Logistic" },
                      { value: "poisson", label: "Poisson" },
                    ]}
                    onChange={(val) => setLasso({ ...lasso, family: val as "logistic" | "poisson" })}
                  />
                  <NumberField
                    label="Confidence Interval (%)"
                    value={lasso.ci}
                    min={50}
                    max={99}
                    step={1}
                    onChange={(val) => setLasso({ ...lasso, ci: val })}
                    help="Coverage percentage for coefficient confidence intervals."
                  />
                </div>

                {/* Collapsible Advanced Parameters */}
                <div className="pt-2 border-t border-slate-800/80 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                    className="flex items-center justify-between w-full p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Advanced Solver & Regularization Parameters</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span>{showAdvancedParams ? "Hide Advanced" : "Show Advanced"}</span>
                      {showAdvancedParams ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </button>

                  {showAdvancedParams && (
                    <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <NumberField
                          label="Bootstrap Resamples"
                          value={lasso.num_bootstrap}
                          min={1}
                          step={5}
                          onChange={(val) => setLasso({ ...lasso, num_bootstrap: val })}
                          help="Number of bootstrap iterations for stability selection."
                        />
                        <NumberField
                          label="L1 Penalty (Lasso Alpha)"
                          value={lasso.lasso_alpha}
                          step={1e-9}
                          onChange={(val) => setLasso({ ...lasso, lasso_alpha: val })}
                          help="Regularization parameter controlling coefficient sparsity."
                        />
                        <NumberField
                          label="CPU Worker Threads (n_jobs)"
                          value={lasso.n_jobs}
                          min={1}
                          step={1}
                          onChange={(val) => setLasso({ ...lasso, n_jobs: val })}
                          help="Parallel multiprocessing cores for bootstrap execution."
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                          <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={lasso.relaxed}
                              onChange={(e) => setLasso({ ...lasso, relaxed: e.target.checked })}
                              className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                            />
                            <span className="text-slate-200">Relaxed LASSO (de-biasing)</span>
                          </label>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                          <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={lasso.use_lars}
                              onChange={(e) => setLasso({ ...lasso, use_lars: e.target.checked })}
                              className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                            />
                            <span className="text-slate-200">Least Angle Regression (LARS)</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 7. SCORE-DA Configuration */}
            {activeTab === "score_da" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <MethodToggleHeader
                  title="SCORE-DA (Syndromic Cellwise Outlier & Residual Estimation)"
                  subtitle="Low-rank indication absorption with Graph Laplacian syndromic borrowing and FISTA regularization."
                  enabled={scoreDa.enabled}
                  onToggle={(enabled) => setScoreDa({ ...scoreDa, enabled })}
                />

                {/* Decision Rule & Metric Clarification Card */}
                <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      Decision Rule & Significance Criterion
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 border border-indigo-700/60 font-mono">
                      Metric: SER • Decision: FDR
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    SCORE-DA evaluates signal effect size using <strong>Standardized Outlier Residuals (SER)</strong>, derived from regularized SVD residuals. Significance decisions are controlled globally across all pairs using the <strong>Benjamini-Hochberg False Discovery Rate (FDR)</strong>. A signal triggers an alert when <code>SER &gt; 0.0</code> and <code>FDR ≤ Target Threshold</code>.
                  </p>
                </div>

                {/* Primary Clinical Thresholds */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField
                    label="Target FDR Threshold (q ≤ α)"
                    value={scoreDa.fdr_threshold}
                    min={0.001}
                    max={0.25}
                    step={0.01}
                    onChange={(val) => setScoreDa({ ...scoreDa, fdr_threshold: val })}
                    help="Benjamini-Hochberg false discovery rate cutoff for qualifying signals."
                  />
                  <NumberField
                    label="Min Incident Events (N)"
                    value={scoreDa.min_events}
                    min={1}
                    max={50}
                    step={1}
                    onChange={(val) => setScoreDa({ ...scoreDa, min_events: val })}
                    help="Minimum report count required to qualify as an actionable signal."
                  />
                </div>

                {/* Collapsible Advanced Parameters */}
                <div className="pt-2 border-t border-slate-800/80 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                    className="flex items-center justify-between w-full p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Advanced Solver & Regularization Parameters</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span>{showAdvancedParams ? "Hide Advanced" : "Show Advanced"}</span>
                      {showAdvancedParams ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </button>

                  {showAdvancedParams && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 animate-in fade-in duration-150">
                      <NumberField
                        label="Latent Factor Rank (Rank)"
                        value={scoreDa.latent_rank}
                        min={1}
                        max={20}
                        step={1}
                        onChange={(val) => setScoreDa({ ...scoreDa, latent_rank: Math.max(1, val) })}
                        help="Number of latent factors absorbing indication confounding & class effects."
                      />
                      <NumberField
                        label="Syndromic Weight (λ₂)"
                        value={scoreDa.syndromic_weight}
                        min={0}
                        max={5}
                        step={0.05}
                        onChange={(val) => setScoreDa({ ...scoreDa, syndromic_weight: val })}
                        help="Graph Laplacian penalty borrowing strength across co-occurring events."
                      />
                      <NumberField
                        label="Sparsity Penalty (λ₁)"
                        value={scoreDa.sparsity_param}
                        min={0}
                        max={10}
                        step={0.1}
                        onChange={(val) => setScoreDa({ ...scoreDa, sparsity_param: val })}
                        help="L1 soft-thresholding penalty shrinking minor residual fluctuations."
                      />
                      <NumberField
                        label="Deflation Passes"
                        value={scoreDa.deflate_iterations}
                        min={1}
                        max={5}
                        step={1}
                        onChange={(val) => setScoreDa({ ...scoreDa, deflate_iterations: Math.max(1, val) })}
                        help="Iterative subtraction passes to eliminate blockbuster competition masking."
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 8. SCORE-DDI Configuration */}
            {activeTab === "score_ddi" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <MethodToggleHeader
                  title="SCORE-DDI: Drug-Drug & Multi-Drug Interaction Discovery"
                  subtitle="Identifies synergistic pharmacodynamic drug combinations using Matrix FISTA and counterfactual null models."
                  enabled={scoreDdi.enabled}
                  onToggle={(enabled) => setScoreDdi({ ...scoreDdi, enabled })}
                />

                {/* Decision Rule & Archetype Card */}
                <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-purple-400" />
                      Interaction Model & Clinical Archetypes
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/60 font-mono">
                      Null Expectation: Λ_null • Decision: FDR
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    SCORE-DDI detects multi-agent risk compounding by comparing observed co-reported counts against a counterfactual null expectation model.
                    Detected interactions are classified into validated archetypes: <strong>EMERGENT</strong> (de novo synergy), <strong>POTENTIATED</strong> (amplified baseline toxicity), or <strong>TWO-HIT</strong> (compound dual injury).
                  </p>
                  <div className="pt-2 border-t border-purple-500/20 text-[11px] text-purple-300/90 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>Requires patient-level report grouping. Ensure a Case/Report ID column was mapped during Ingestion.</span>
                  </div>
                </div>

                {/* Primary Clinical Thresholds */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Interaction Model Choice */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <span>Null Interaction Model</span>
                      <span className="text-[10px] text-purple-400 font-mono">(Counterfactual)</span>
                    </label>
                    <select
                      value={scoreDdi.interaction_model}
                      onChange={(e) =>
                        setScoreDdi({
                          ...scoreDdi,
                          interaction_model: e.target.value as "multiplicative" | "additive",
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
                    >
                      <option value="multiplicative">Multiplicative (Independent Relative Risk Compounding)</option>
                      <option value="additive">Additive (Excess Risk Difference)</option>
                    </select>
                    <p className="text-[11px] text-slate-400">
                      Multiplicative is recommended for spontaneous reporting systems to avoid false synergy on common baselines.
                    </p>
                  </div>

                  <NumberField
                    label="Target FDR Threshold (q ≤ α)"
                    value={scoreDdi.fdr_threshold}
                    min={0.001}
                    max={0.25}
                    step={0.01}
                    onChange={(val) => setScoreDdi({ ...scoreDdi, fdr_threshold: val })}
                    help="Benjamini-Hochberg false discovery rate cutoff for interaction signals."
                  />
                  <NumberField
                    label="Min Co-Occurrence Reports (N)"
                    value={scoreDdi.min_events}
                    min={1}
                    max={50}
                    step={1}
                    onChange={(val) => setScoreDdi({ ...scoreDdi, min_events: val })}
                    help="Minimum co-reported count required to evaluate a drug pair."
                  />
                </div>

                {/* Collapsible Advanced Parameters */}
                <div className="pt-2 border-t border-purple-800/40 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                    className="flex items-center justify-between w-full p-2.5 rounded-xl bg-purple-950/40 border border-purple-800/60 hover:border-purple-700 text-xs font-medium text-purple-200 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-purple-400" />
                      <span>Advanced Solver & Regularization Parameters</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-purple-300">
                      <span>{showAdvancedParams ? "Hide Advanced" : "Show Advanced"}</span>
                      {showAdvancedParams ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </button>

                  {showAdvancedParams && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 animate-in fade-in duration-150">
                      <NumberField
                        label="Syndromic Graph Weight (λ₂)"
                        value={scoreDdi.syndromic_weight}
                        min={0}
                        max={5}
                        step={0.05}
                        onChange={(val) => setScoreDdi({ ...scoreDdi, syndromic_weight: val })}
                        help="Graph Laplacian penalty coupling related adverse events in clinical syndromes."
                      />
                      <NumberField
                        label="Sparsity Penalty (λ₁)"
                        value={scoreDdi.sparsity_param}
                        min={0}
                        max={10}
                        step={0.1}
                        onChange={(val) => setScoreDdi({ ...scoreDdi, sparsity_param: val })}
                        help="L1 soft-thresholding penalty shrinking non-synergistic co-occurrence noise."
                      />
                      <NumberField
                        label="FISTA Max Iterations"
                        value={scoreDdi.max_iter}
                        min={10}
                        max={200}
                        step={10}
                        onChange={(val) => setScoreDdi({ ...scoreDdi, max_iter: Math.max(10, val) })}
                        help="Maximum Matrix FISTA optimization steps per drug combination."
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 9. ZIGPS Configuration */}
            {activeTab === "zigps" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <MethodToggleHeader
                  title="ZIGPS (Zero-Inflated Gamma Poisson Shrinker)"
                  subtitle="3-component Spike-and-Slab Empirical Bayes mixture separating structural zeros from true relative risk."
                  enabled={zigps.enabled}
                  onToggle={(enabled) => setZigps({ ...zigps, enabled })}
                />

                <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      Decision Rule & Spike-and-Slab Criterion
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-900/60 text-cyan-300 border border-cyan-700/60 font-mono">
                      Spike: π₀ (Structural Zero) • Metric: EBGM / EB05
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    ZIGPS fits a 3-component mixture model isolating biological non-occurrences (structural zeros) from sampling zeros, preventing false alarms on rare events while computing robust Empirical Bayes Geometric Mean shrinkage.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField
                    label="Relative Risk Null (RR₀)"
                    value={zigps.relative_risk}
                    step={0.1}
                    onChange={(val) => setZigps({ ...zigps, relative_risk: val })}
                    help="Null background relative risk expectation (typically 1.0)."
                  />
                  <NumberField
                    label="Min Incident Events"
                    value={zigps.min_events}
                    min={1}
                    step={1}
                    onChange={(val) => setZigps({ ...zigps, min_events: val })}
                    help="Minimum report count required to evaluate a signal."
                  />
                  <SelectField
                    label="Decision Metric"
                    value={zigps.decision_metric}
                    options={[
                      { value: "rank", label: "Rank (Percentile / Quantile Cutoff)" },
                      { value: "fdr", label: "False Discovery Rate (FDR)" },
                      { value: "signals", label: "Hard Count Threshold" },
                    ]}
                    onChange={(val) => setZigps({ ...zigps, decision_metric: val as DecisionMetric })}
                  />
                  <NumberField
                    label="Decision Threshold"
                    value={zigps.decision_thres}
                    step={0.01}
                    onChange={(val) => setZigps({ ...zigps, decision_thres: val })}
                    help="Threshold on EB05 or FDR to qualify as an active alert."
                  />
                  <SelectField
                    label="Ranking Statistic"
                    value={zigps.ranking_statistic}
                    options={[
                      { value: "log2", label: "log₂(EBGM)" },
                      { value: "quantile", label: "EB05 (5th Percentile Lower Bound)" },
                      { value: "p_value", label: "Empirical p-value" },
                    ]}
                    onChange={(val) => setZigps({ ...zigps, ranking_statistic: val as any })}
                  />
                  <SelectField
                    label="Expected Count Model"
                    value={zigps.expected_method}
                    options={[
                      { value: "mantel-haentzel", label: "Mantel-Haenszel (Standard)" },
                      { value: "poisson", label: "Poisson Background" },
                      { value: "negative-binomial", label: "Negative Binomial (Overdispersed)" },
                    ]}
                    onChange={(val) => setZigps({ ...zigps, expected_method: val as ExpectedMethod })}
                  />
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                    className="flex items-center justify-between w-full p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Advanced Solver & Mixture Optimization</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span>{showAdvancedParams ? "Hide Advanced" : "Show Advanced"}</span>
                      {showAdvancedParams ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </button>

                  {showAdvancedParams && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 animate-in fade-in duration-150">
                      <NumberField
                        label="Dispersion Alpha Parameter"
                        value={zigps.method_alpha}
                        step={0.1}
                        onChange={(val) => setZigps({ ...zigps, method_alpha: val })}
                        help="Overdispersion scale parameter for Negative Binomial null model."
                      />
                      <SelectField
                        label="Minimization Optimizer"
                        value={zigps.minimization_method}
                        options={[
                          { value: "L-BFGS-B", label: "L-BFGS-B (Profile Quasi-Newton, Recommended)" },
                          { value: "Nelder-Mead", label: "Nelder-Mead Simplex" },
                        ]}
                        onChange={(val) => setZigps({ ...zigps, minimization_method: val })}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 10. AEGIS Configuration */}
            {activeTab === "aegis" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <MethodToggleHeader
                  title="AEGIS (Anytime Empirical Graph-Informed Shrinkage)"
                  subtitle="Counterfactual LOCO baseline, Huber unmasking, NPMI syndromic borrowing, and anytime-valid e-values."
                  enabled={aegis.enabled}
                  onToggle={(enabled) => setAegis({ ...aegis, enabled })}
                />

                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Counterfactual LOCO Unmasking & Martingale e-Values
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 font-mono">
                      Metric: AEGIS_EBGM • Decision: Combined
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    AEGIS eliminates blockbuster competition masking via Leave-One-Cell-Out (LOCO) SVD baseline estimation with margin-hijacking Huber Winsorization. Incorporates top-K NPMI syndromic borrowing, Dual-EWMA surge velocity separation, and non-asymptotic martingale e-values.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectField
                    label="Decision Criterion"
                    value={aegis.decision_metric}
                    options={[
                      { value: "combined", label: "Combined (AEGIS_LB > Cutoff & FDR ≤ Target)" },
                      { value: "lb", label: "Lower Bound (AEGIS_LB > Cutoff)" },
                      { value: "fdr", label: "False Discovery Rate (FDR ≤ Target)" },
                      { value: "e_value", label: "Martingale e-FDR (Anytime Valid e-FDR ≤ Target)" },
                    ]}
                    onChange={(val) => setAegis({ ...aegis, decision_metric: val as any })}
                  />
                  <NumberField
                    label="Target FDR / e-FDR Threshold"
                    value={aegis.fdr_threshold}
                    min={0.001}
                    max={0.25}
                    step={0.01}
                    onChange={(val) => setAegis({ ...aegis, fdr_threshold: val })}
                    help="False discovery rate cutoff for signaling drug-event pairs."
                  />
                  <NumberField
                    label="Lower Bound Threshold (AEGIS_LB)"
                    value={aegis.lb_threshold}
                    step={0.1}
                    onChange={(val) => setAegis({ ...aegis, lb_threshold: val })}
                    help="Posterior credibility lower bound cutoff (typically 1.0 or 1.2)."
                  />
                  <NumberField
                    label="Min Incident Events (N)"
                    value={aegis.min_events}
                    min={1}
                    max={50}
                    step={1}
                    onChange={(val) => setAegis({ ...aegis, min_events: val })}
                    help="Minimum report count required to qualify as an active alert."
                  />
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                    className="flex items-center justify-between w-full p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Advanced LOCO, Graph & Martingale Hyperparameters</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span>{showAdvancedParams ? "Hide Advanced" : "Show Advanced"}</span>
                      {showAdvancedParams ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </button>

                  {showAdvancedParams && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 animate-in fade-in duration-150">
                      <NumberField
                        label="Huber Winsorization Delta (δ)"
                        value={aegis.huber_delta}
                        step={0.1}
                        onChange={(val) => setAegis({ ...aegis, huber_delta: val })}
                        help="Margin-hijacking outlier bound preventing blockbuster distortion."
                      />
                      <NumberField
                        label="Latent SVD Factor Rank"
                        value={aegis.latent_rank}
                        min={1}
                        max={10}
                        step={1}
                        onChange={(val) => setAegis({ ...aegis, latent_rank: Math.max(1, val) })}
                        help="Number of counterfactual low-rank components absorbing class confounding."
                      />
                      <NumberField
                        label="Syndromic Graph Gain"
                        value={aegis.syndromic_gain}
                        step={0.1}
                        onChange={(val) => setAegis({ ...aegis, syndromic_gain: val })}
                        help="NPMI graph conjugate Poisson-Gamma neighborhood pooling intensity."
                      />
                      <NumberField
                        label="Top-K Graph Neighbors"
                        value={aegis.top_k_neighbors}
                        min={1}
                        max={12}
                        step={1}
                        onChange={(val) => setAegis({ ...aegis, top_k_neighbors: val })}
                        help="Maximum connected clinical syndrome neighbors per adverse event."
                      />
                      <NumberField
                        label="Dual-EWMA Surge Velocity Gain"
                        value={aegis.velocity_gain}
                        step={0.05}
                        onChange={(val) => setAegis({ ...aegis, velocity_gain: val })}
                        help="Separates focal biological acceleration from drug-wide media surges."
                      />
                      <NumberField
                        label="Martingale Coupling"
                        value={aegis.martingale_coupling}
                        step={0.05}
                        onChange={(val) => setAegis({ ...aegis, martingale_coupling: val })}
                        help="Vovk-Wang product martingale mixture coupling for anytime e-values."
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 11. MaxSPRT Configuration */}
            {activeTab === "maxsprt" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <MethodToggleHeader
                  title="MaxSPRT (Maximized Sequential Probability Ratio Test)"
                  subtitle="Prospective real-time safety surveillance with exact Wald-Kulldorff sequential boundary control."
                  enabled={maxsprt.enabled}
                  onToggle={(enabled) => setMaxsprt({ ...maxsprt, enabled })}
                />

                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Sequential Testing & Critical Value Boundary
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 border border-amber-700/60 font-mono">
                      Sequential Likelihood Ratio • Metric: LLR ≥ CV
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    MaxSPRT monitors accumulating safety reports continuously across time slices, strictly bounding cumulative Type-I error rate (alpha) via exact numerical boundary integration. Ideal for newly launched therapies or vaccine safety monitoring.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField
                    label="Nominal Alpha (α)"
                    value={maxsprt.alpha}
                    min={0.001}
                    max={0.2}
                    step={0.01}
                    onChange={(val) => setMaxsprt({ ...maxsprt, alpha: val })}
                    help="Overall cumulative false-positive error rate bound (typically 0.05 or 0.01)."
                  />
                  <NumberField
                    label="Min Incident Events (N)"
                    value={maxsprt.min_events}
                    min={1}
                    max={50}
                    step={1}
                    onChange={(val) => setMaxsprt({ ...maxsprt, min_events: val })}
                    help="Minimum report count required before triggering sequential evaluation."
                  />
                  <SelectField
                    label="Surveillance Likelihood Model"
                    value={maxsprt.model}
                    options={[
                      { value: "poisson", label: "Poisson (Count Incidence / Spontaneous Reports)" },
                      { value: "binomial", label: "Binomial (Matched Cohorts / Binary Indicators)" },
                    ]}
                    onChange={(val) => setMaxsprt({ ...maxsprt, model: val as any })}
                  />
                  <SelectField
                    label="Expected Count Model"
                    value={maxsprt.expected_method}
                    options={[
                      { value: "mantel-haentzel", label: "Mantel-Haenszel (Standard)" },
                      { value: "poisson", label: "Poisson Background" },
                      { value: "negative-binomial", label: "Negative Binomial (Overdispersed)" },
                    ]}
                    onChange={(val) => setMaxsprt({ ...maxsprt, expected_method: val as ExpectedMethod })}
                  />
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                    className="flex items-center justify-between w-full p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      <span>Advanced Sequential Stopping Bounds & Truncation</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span>{showAdvancedParams ? "Hide Advanced" : "Show Advanced"}</span>
                      {showAdvancedParams ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </button>

                  {showAdvancedParams && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 animate-in fade-in duration-150">
                      <NumberField
                        label="Upper Surveillance Limit (T)"
                        value={maxsprt.upper_limit}
                        min={5}
                        step={5}
                        onChange={(val) => setMaxsprt({ ...maxsprt, upper_limit: val })}
                        help="Maximum expected count or surveillance sample size horizon."
                      />
                      <NumberField
                        label="Relative Risk Upper Truncation Cap"
                        value={maxsprt.upper_rr_cap}
                        min={10}
                        step={10}
                        onChange={(val) => setMaxsprt({ ...maxsprt, upper_rr_cap: val })}
                        help="Caps maximum RR estimate to prevent runaway LLR on single-event anomalies."
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 12. CUSUM-DA Configuration */}
            {activeTab === "cusum" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <MethodToggleHeader
                  title="CUSUM-DA (Cumulative Sum Control Chart)"
                  subtitle="Instantaneous change-point detector for sudden safety surges, batch defects, and emerging risks."
                  enabled={cusum.enabled}
                  onToggle={(enabled) => setCusum({ ...cusum, enabled })}
                />

                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                      Change-Point Detection & ARL₀ Boundary
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-900/60 text-rose-300 border border-rose-700/60 font-mono">
                      Page-Lucas Cumulative Sum • Metric: CUSUM ≥ h
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    CUSUM accumulates evidence of positive drift in reporting rates relative to reference parameter k = (θ₁ - 1)/ln(θ₁), triggering immediate change-point alarms calibrated via Siegmund Average Run Length (ARL₀).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberField
                    label="Target Out-of-Control Relative Risk (θ₁)"
                    value={cusum.target_rr}
                    min={1.1}
                    max={10.0}
                    step={0.1}
                    onChange={(val) => setCusum({ ...cusum, target_rr: val })}
                    help="Target out-of-control risk ratio to detect rapidly (typically 1.5 to 3.0)."
                  />
                  <NumberField
                    label="In-Control Average Run Length (ARL₀)"
                    value={cusum.arl0}
                    min={50}
                    max={5000}
                    step={50}
                    onChange={(val) => setCusum({ ...cusum, arl0: val })}
                    help="Expected run length between false alarms under the null hypothesis (typically 500)."
                  />
                  <NumberField
                    label="Min Incident Events (N)"
                    value={cusum.min_events}
                    min={1}
                    max={50}
                    step={1}
                    onChange={(val) => setCusum({ ...cusum, min_events: val })}
                    help="Minimum report count required before triggering evaluation."
                  />
                  <SelectField
                    label="Expected Count Model"
                    value={cusum.expected_method}
                    options={[
                      { value: "mantel-haentzel", label: "Mantel-Haenszel (Standard)" },
                      { value: "poisson", label: "Poisson Background" },
                      { value: "negative-binomial", label: "Negative Binomial (Overdispersed)" },
                    ]}
                    onChange={(val) => setCusum({ ...cusum, expected_method: val as ExpectedMethod })}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            {activeMethodCount} method{activeMethodCount !== 1 ? "s" : ""} selected
            {consensus && " • Consensus synthesis active"}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              disabled={isAnalyzing}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={isAnalyzing}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 hover:border-slate-600 transition"
              title="Save changes to method configuration without running analysis immediately"
            >
              Save Settings
            </button>

            <button
              onClick={handleRun}
              disabled={isAnalyzing || activeMethodCount === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition active:scale-95"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isAnalyzing ? "Executing Pipeline..." : "Save & Run Analysis"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Helper UI Components ---

interface MethodTabButtonProps {
  tabKey: MethodTab;
  label: string;
  sub: string;
  enabled: boolean;
  active: boolean;
  onClick: () => void;
  onToggle: (enabled: boolean) => void;
}

const MethodTabButton: React.FC<MethodTabButtonProps> = ({
  label,
  sub,
  enabled,
  active,
  onClick,
  onToggle,
}) => {
  return (
    <div
      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition border ${
        active
          ? "bg-slate-800 text-white font-semibold shadow-inner border-slate-700"
          : "text-slate-400 hover:bg-slate-900/80 hover:text-slate-200 border-transparent"
      }`}
    >
      {/* Clickable Method Label & Description: opens parameter options */}
      <div
        onClick={onClick}
        className="flex-1 cursor-pointer pr-2 select-none"
        title={`View & configure ${label} parameters`}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-white">{label}</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              enabled ? "bg-emerald-400" : "bg-slate-600"
            }`}
          />
        </div>
        <div className="text-[10px] text-slate-500 truncate max-w-[110px] font-normal">
          {sub}
        </div>
      </div>

      {/* One-Click On/Off Toggle Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(!enabled);
        }}
        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1 shrink-0 ${
          enabled
            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 shadow-sm"
            : "bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700 hover:text-slate-400"
        }`}
        title={`Click to turn ${label} ${enabled ? "OFF" : "ON"}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${enabled ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
        <span>{enabled ? "ON" : "OFF"}</span>
      </button>
    </div>
  );
};

interface MethodToggleHeaderProps {
  title: string;
  subtitle: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const MethodToggleHeader: React.FC<MethodToggleHeaderProps> = ({
  title,
  subtitle,
  enabled,
  onToggle,
}) => {
  return (
    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-white">{title}</h4>
          <span
            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
              enabled
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-slate-800 text-slate-500 border-slate-700"
            }`}
          >
            {enabled ? "Active in Pipeline" : "Disabled"}
          </span>
        </div>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>

      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
      </label>
    </div>
  );
};

interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
  onChange: (val: number) => void;
}

const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  help,
  onChange,
}) => {
  return (
    <div className="space-y-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800/80">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-medium">{label}</span>
      </div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-500 transition"
      />
      {help && <p className="text-[10px] text-slate-500 leading-tight">{help}</p>}
    </div>
  );
};

interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  help?: string;
  onChange: (val: string) => void;
}

const SelectField: React.FC<SelectFieldProps> = ({
  label,
  value,
  options,
  help,
  onChange,
}) => {
  return (
    <div className="space-y-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800/80">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-medium">{label}</span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-500 transition"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {help && <p className="text-[10px] text-slate-500 leading-tight">{help}</p>}
    </div>
  );
};
