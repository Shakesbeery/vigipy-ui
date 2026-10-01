/**
 * Longitudinal Surveillance Configuration & Parameterization Dialog
 * Provides a dedicated, professional dialog where methods (including SCORE-DA, SCORE-DDI, PRR, ROR, BCPNN, GPS, LASSO, RFET)
 * and execution parameters (time window units, cumulative/disjoint mode, expectation baselines),
 * as well as the method's own algorithm hyperparameters, can be fully configured and run.
 */

import React, { useState } from 'react';
import {
  X,
  Play,
  Sliders,
  Calendar,
  Layers,
  Sparkles,
  Search,
  CheckCircle2,
  TrendingUp,
  Activity,
  AlertCircle,
  Clock,
  HelpCircle,
} from 'lucide-react';
import {
  DisproportionalityMethod,
  ExpectationModel,
  LongitudinalConfig,
  LongitudinalMode,
  MethodConfigs,
} from '../types/vigipy';
import { DEFAULT_CONFIGS } from '../core/analyzer';

interface LongitudinalConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LongitudinalConfig;
  targetDrug: string;
  targetEvent: string;
  availableDrugs: string[];
  availableEvents: string[];
  methodConfigs?: MethodConfigs;
  onSaveAndRun: (
    config: LongitudinalConfig,
    targetDrug: string,
    targetEvent: string,
    updatedMethodConfigs?: MethodConfigs
  ) => void;
  onScanAllCandidates?: () => void;
}

export const LongitudinalConfigModal: React.FC<LongitudinalConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  targetDrug,
  targetEvent,
  availableDrugs,
  availableEvents,
  methodConfigs = DEFAULT_CONFIGS,
  onSaveAndRun,
  onScanAllCandidates,
}) => {
  const [draftDrug, setDraftDrug] = useState(targetDrug);
  const [draftEvent, setDraftEvent] = useState(targetEvent);
  const [draftMethod, setDraftMethod] = useState<DisproportionalityMethod>(config.method || 'SCORE');
  const [draftMode, setDraftMode] = useState<LongitudinalMode>(config.mode || 'cumulative');
  const [draftTimeUnit, setDraftTimeUnit] = useState<'quarter' | 'year' | 'month'>(config.timeUnit || 'quarter');
  const [draftExpectation, setDraftExpectation] = useState<ExpectationModel>(
    config.expectationModel || 'mantel-haenszel'
  );
  const [draftMinCount, setDraftMinCount] = useState<number>(config.minCountPerSlice || 2);

  // Method specific draft hyperparameters
  const [draftMethodConfigs, setDraftMethodConfigs] = useState<MethodConfigs>(
    JSON.parse(JSON.stringify(methodConfigs))
  );

  const [drugFilter, setDrugFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');

  if (!isOpen) return null;

  const filteredDrugs = availableDrugs
    .filter((d) => !drugFilter || d.toLowerCase().includes(drugFilter.toLowerCase()))
    .slice(0, 30);

  const filteredEvents = availableEvents
    .filter((e) => !eventFilter || e.toLowerCase().includes(eventFilter.toLowerCase()))
    .slice(0, 30);

  const updateMethodParam = (methodId: string, paramKey: string, value: any) => {
    setDraftMethodConfigs((prev) => ({
      ...prev,
      [methodId]: {
        ...(prev[methodId] || {}),
        [paramKey]: value,
      },
    }));
  };

  const handleRun = () => {
    const updatedConfig: LongitudinalConfig = {
      mode: draftMode,
      expectationModel: draftExpectation,
      method: draftMethod,
      timeUnit: draftTimeUnit,
      minCountPerSlice: draftMinCount,
    };
    onSaveAndRun(updatedConfig, draftDrug, draftEvent, draftMethodConfigs);
    onClose();
  };

  const activeMethodKey = draftMethod === 'SCORE_DA' ? 'SCORE' : draftMethod;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Longitudinal Surveillance Configuration</span>
                <span className="text-[11px] font-mono font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  vigipy 3.4
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Specify analytical method, temporal resolution, expectation baselines, and method-specific hyperparameters
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* 1. Method Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-amber-400" />
                <span>1. Longitudinal Analysis Metric / Method</span>
              </label>
              <span className="text-[11px] text-slate-400">Includes SCORE-DA &amp; SCORE-DDI</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'SCORE',
                  name: 'SCORE-DA',
                  desc: 'Disproportionality Analysis with syndromic clustering & shrinkage',
                  highlight: true,
                },
                {
                  id: 'SCORE_DDI',
                  name: 'SCORE-DDI',
                  desc: 'Multi-drug drug interaction & combination risk modeling',
                  highlight: true,
                },
                {
                  id: 'PRR',
                  name: 'PRR',
                  desc: 'Proportional Reporting Ratio (Evans et al. MHRA standard)',
                },
                {
                  id: 'ROR',
                  name: 'ROR',
                  desc: 'Reporting Odds Ratio with logistic lower-bound cutoff (van Puijenbroek)',
                },
                {
                  id: 'BCPNN',
                  name: 'BCPNN (IC)',
                  desc: 'Bayesian Confidence Propagation Neural Network (WHO-UMC)',
                },
                {
                  id: 'GPS',
                  name: 'GPS (EBGM)',
                  desc: 'Empirical Bayes Geometric Mean with Poisson-Gamma shrinkage',
                },
                {
                  id: 'RFET',
                  name: 'RFET',
                  desc: 'Restricted Fisher Exact Test with mid-p value exact tail probabilities',
                },
                {
                  id: 'LASSO',
                  name: 'LASSO',
                  desc: 'L1 Penalized Multi-variable logistic regression against polypharmacy',
                },
                {
                  id: 'OE',
                  name: 'O / E Ratio',
                  desc: 'Observed over Expected incidence baseline ratio',
                },
              ].map((m) => {
                const isSelected = draftMethod === m.id || (m.id === 'SCORE' && draftMethod === 'SCORE_DA');
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setDraftMethod(m.id as DisproportionalityMethod)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-amber-500/80 bg-amber-500/10 shadow-md shadow-amber-500/10'
                        : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-mono font-bold text-xs ${isSelected ? 'text-amber-300' : 'text-slate-200'}`}>
                        {m.name}
                      </span>
                      {m.highlight && (
                        <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded font-medium">
                          vigipy 3.4
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{m.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Method-Specific Hyperparameters & Options */}
          <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-xs text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="h-3.5 w-3.5 text-amber-400" />
                <span>2. Method Hyperparameters &amp; Thresholds ({draftMethod === 'SCORE' ? 'SCORE-DA' : draftMethod})</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Tuning options for {draftMethod}
              </span>
            </div>

            {/* SCORE / SCORE-DA Parameter Controls */}
            {(draftMethod === 'SCORE' || draftMethod === 'SCORE_DA') && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Indication Absorption Rank (k)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    step="1"
                    value={draftMethodConfigs.SCORE?.latentRank ?? 5}
                    onChange={(e) => updateMethodParam('SCORE', 'latentRank', parseInt(e.target.value, 10) || 5)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Truncated SVD rank damping indication confounding (default 5)
                  </span>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Syndromic Weight (λ₂)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="3"
                    step="0.1"
                    value={draftMethodConfigs.SCORE?.syndromicWeight ?? 0.5}
                    onChange={(e) => updateMethodParam('SCORE', 'syndromicWeight', parseFloat(e.target.value) || 0.5)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Graph Laplacian penalty coupling co-occurring symptoms (default 0.5)
                  </span>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    FDR Significance Cutoff
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    max="0.2"
                    step="0.01"
                    value={draftMethodConfigs.SCORE?.fdrThreshold ?? 0.05}
                    onChange={(e) => updateMethodParam('SCORE', 'fdrThreshold', parseFloat(e.target.value) || 0.05)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Benjamini-Hochberg FDR target q-value (default 0.05)
                  </span>
                </div>
              </div>
            )}

            {/* PRR Parameter Controls */}
            {draftMethod === 'PRR' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    PRR Signal Threshold (Cutoff)
                  </label>
                  <input
                    type="number"
                    min="1.0"
                    max="10.0"
                    step="0.1"
                    value={draftMethodConfigs.PRR?.thresholdPRR ?? 2.0}
                    onChange={(e) => updateMethodParam('PRR', 'thresholdPRR', parseFloat(e.target.value) || 2.0)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Minimum point estimate PRR required (default 2.0)
                  </span>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Chi-Square (χ²) Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                    value={draftMethodConfigs.PRR?.thresholdChiSquare ?? 4.0}
                    onChange={(e) => updateMethodParam('PRR', 'thresholdChiSquare', parseFloat(e.target.value) || 4.0)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Statistical significance cutoff (default 4.0 ~ p &lt; 0.05)
                  </span>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Continuity Correction (+0.5)
                  </label>
                  <select
                    value={draftMethodConfigs.PRR?.continuityCorrection ? 'true' : 'false'}
                    onChange={(e) => updateMethodParam('PRR', 'continuityCorrection', e.target.value === 'true')}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  >
                    <option value="true">Enabled (Haldane-Anscombe)</option>
                    <option value="false">Disabled</option>
                  </select>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Adds 0.5 to zero cells to prevent division by zero
                  </span>
                </div>
              </div>
            )}

            {/* ROR Parameter Controls */}
            {draftMethod === 'ROR' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Lower Bound Cutoff (ROR₀₂₅)
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    max="5.0"
                    step="0.1"
                    value={draftMethodConfigs.ROR?.thresholdLowerBound ?? 1.0}
                    onChange={(e) => updateMethodParam('ROR', 'thresholdLowerBound', parseFloat(e.target.value) || 1.0)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    van Puijenbroek signal rule: lower 95% CI &gt; 1.0
                  </span>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Significance Level (Alpha)
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    max="0.2"
                    step="0.01"
                    value={draftMethodConfigs.ROR?.alpha ?? 0.05}
                    onChange={(e) => updateMethodParam('ROR', 'alpha', parseFloat(e.target.value) || 0.05)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Two-sided confidence level (default 0.05 = 95% CI)
                  </span>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Continuity Correction
                  </label>
                  <select
                    value={draftMethodConfigs.ROR?.continuityCorrection ? 'true' : 'false'}
                    onChange={(e) => updateMethodParam('ROR', 'continuityCorrection', e.target.value === 'true')}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  >
                    <option value="true">Enabled (Haldane-Anscombe)</option>
                    <option value="false">Disabled</option>
                  </select>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Prevents zero denominators in Woolf log-odds variance
                  </span>
                </div>
              </div>
            )}

            {/* BCPNN Parameter Controls */}
            {draftMethod === 'BCPNN' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    IC Lower Bound Cutoff (IC₀₂₅)
                  </label>
                  <input
                    type="number"
                    min="-1.0"
                    max="2.0"
                    step="0.1"
                    value={draftMethodConfigs.BCPNN?.thresholdIC025 ?? 0.0}
                    onChange={(e) => updateMethodParam('BCPNN', 'thresholdIC025', parseFloat(e.target.value) || 0.0)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    WHO-UMC signal criterion: IC₀₂₅ &gt; 0.0
                  </span>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Credibility Level
                  </label>
                  <input
                    type="number"
                    min="0.8"
                    max="0.99"
                    step="0.01"
                    value={draftMethodConfigs.BCPNN?.credibilityLevel ?? 0.95}
                    onChange={(e) => updateMethodParam('BCPNN', 'credibilityLevel', parseFloat(e.target.value) || 0.95)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Posterior credible interval coverage (default 0.95)
                  </span>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Dirichlet Prior Hyperparameter
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={draftMethodConfigs.BCPNN?.priorAlpha1 ?? 1.0}
                    onChange={(e) => updateMethodParam('BCPNN', 'priorAlpha1', parseFloat(e.target.value) || 1.0)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Baseline pseudo-count regularization (default 1.0)
                  </span>
                </div>
              </div>
            )}

            {/* GPS Parameter Controls */}
            {draftMethod === 'GPS' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    EB05 Signal Threshold
                  </label>
                  <input
                    type="number"
                    min="1.0"
                    max="5.0"
                    step="0.1"
                    value={draftMethodConfigs.GPS?.thresholdEB05 ?? 2.0}
                    onChange={(e) => updateMethodParam('GPS', 'thresholdEB05', parseFloat(e.target.value) || 2.0)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    FDA MGPS criterion: lower 5th percentile EB₀₅ &ge; 2.0
                  </span>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Mixture Prior Weight (w)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    max="0.99"
                    step="0.05"
                    value={draftMethodConfigs.GPS?.weight ?? 0.1}
                    onChange={(e) => updateMethodParam('GPS', 'weight', parseFloat(e.target.value) || 0.1)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    DuMouchel 2-component prior mixture weight (default 0.1)
                  </span>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Credible Interval
                  </label>
                  <input
                    type="number"
                    min="0.8"
                    max="0.99"
                    step="0.01"
                    value={draftMethodConfigs.GPS?.credibleInterval ?? 0.9}
                    onChange={(e) => updateMethodParam('GPS', 'credibleInterval', parseFloat(e.target.value) || 0.9)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Coverage for [EB05, EB95] (default 0.90)
                  </span>
                </div>
              </div>
            )}

            {/* SCORE_DDI Parameter Controls */}
            {draftMethod === 'SCORE_DDI' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Interaction Model
                  </label>
                  <select
                    value={draftMethodConfigs.SCORE_DDI?.interactionModel ?? 'multiplicative'}
                    onChange={(e) => updateMethodParam('SCORE_DDI', 'interactionModel', e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  >
                    <option value="multiplicative">Multiplicative (Standard)</option>
                    <option value="additive">Additive Excess Risk</option>
                  </select>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Null baseline model for joint drug exposure
                  </span>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    FDR Threshold
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    max="0.2"
                    step="0.01"
                    value={draftMethodConfigs.SCORE_DDI?.fdrThreshold ?? 0.05}
                    onChange={(e) => updateMethodParam('SCORE_DDI', 'fdrThreshold', parseFloat(e.target.value) || 0.05)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Target q-value for synergistic interactions
                  </span>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Sparsity Penalty (λ₁)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={draftMethodConfigs.SCORE_DDI?.sparsityParam ?? 1.0}
                    onChange={(e) => updateMethodParam('SCORE_DDI', 'sparsityParam', parseFloat(e.target.value) || 1.0)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    L1 penalty suppressing spurious co-prescription
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 3. Temporal Window & Slicing Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
            {/* Time Window Unit */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block text-xs">Temporal Window Unit</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(['quarter', 'month', 'year'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setDraftTimeUnit(unit)}
                    className={`py-1.5 text-center rounded-lg font-medium text-xs capitalize transition-all ${
                      draftTimeUnit === unit
                        ? 'bg-amber-600 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {unit === 'quarter' ? 'Quarter' : unit === 'month' ? 'Month' : 'Year'}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-slate-500 block">
                {draftTimeUnit === 'quarter'
                  ? 'Standard pharmacovigilance surveillance quarters (e.g. 2024Q1)'
                  : draftTimeUnit === 'month'
                  ? 'Granular monthly emergence tracking'
                  : 'Annual macro-surveillance bins'}
              </span>
            </div>

            {/* Evaluation Mode */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block text-xs">Evaluation Slicing Mode</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setDraftMode('cumulative')}
                  className={`py-1.5 text-center rounded-lg font-medium text-xs transition-all ${
                    draftMode === 'cumulative'
                      ? 'bg-amber-600 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Cumulative
                </button>
                <button
                  type="button"
                  onClick={() => setDraftMode('disjoint')}
                  className={`py-1.5 text-center rounded-lg font-medium text-xs transition-all ${
                    draftMode === 'disjoint'
                      ? 'bg-amber-600 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Disjoint
                </button>
              </div>
              <span className="text-[10px] text-slate-500 block">
                {draftMode === 'cumulative'
                  ? 'Expanding historical horizon (standard regulatory trajectory)'
                  : 'Isolated window-by-window incidence spikes'}
              </span>
            </div>

            {/* Expectation Baseline Model (Strictly aligned with vigipy) */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block text-xs">
                Contingency Expectation Baseline Model (E)
              </label>
              <select
                value={draftExpectation}
                onChange={(e) => setDraftExpectation(e.target.value as ExpectationModel)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 font-mono text-xs focus:border-amber-500 focus:outline-none"
              >
                <option value="mantel-haenszel">
                  Mantel-Haenszel (vigipy default: Standard Marginal Independence E = n₁· × n·₁ / n··)
                </option>
                <option value="poisson">
                  Poisson GLM (Log-linear continuous arrival rate model)
                </option>
                <option value="negative-binomial">
                  Negative Binomial GLM (Overdispersed AE clustering with dispersion parameter α)
                </option>
                <option value="binomial">
                  Binomial Model (Unexposed Proportion p₀ = n₀₁ / n₀·)
                </option>
                <option value="standard">
                  Standard Independence (Classical cross-product)
                </option>
              </select>
              <span className="text-[10px] text-slate-500 block">
                Statistical null reference distribution E (vigipy default: Mantel-Haenszel)
              </span>
            </div>
          </div>

          {/* 4. Minimum Count Per Slice */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/60">
            <div>
              <span className="font-semibold text-slate-200 text-xs block">Minimum Count per Slice (N₁₁)</span>
              <span className="text-[11px] text-slate-400">
                Ignore temporal windows with fewer than this number of co-reported events to suppress low-count noise.
              </span>
            </div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 5].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setDraftMinCount(cnt)}
                  className={`px-3 py-1.5 rounded-lg font-mono font-bold text-xs transition-colors ${
                    draftMinCount === cnt
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  N &ge; {cnt}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Target Drug and Adverse Event Pair */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-cyan-400" />
                <span>3. Target Candidate Pair Selection</span>
              </label>
              {onScanAllCandidates && (
                <button
                  type="button"
                  onClick={() => {
                    onScanAllCandidates();
                    onClose();
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-medium underline flex items-center gap-1 cursor-pointer"
                >
                  <TrendingUp className="h-3 w-3" />
                  <span>Scan All Candidate Pairs</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Target Drug */}
              <div className="space-y-2">
                <label className="text-slate-300 font-semibold block text-xs">Target Medicinal Product / Drug</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search or enter active ingredient..."
                    value={draftDrug}
                    onChange={(e) => {
                      setDraftDrug(e.target.value);
                      setDrugFilter(e.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 placeholder-slate-500 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                {availableDrugs.length > 0 && (
                  <div className="max-h-28 overflow-y-auto rounded-lg border border-slate-800/80 bg-slate-950/90 p-1 space-y-0.5">
                    {filteredDrugs.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setDraftDrug(d);
                          setDrugFilter('');
                        }}
                        className={`w-full text-left px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                          draftDrug.toLowerCase() === d.toLowerCase()
                            ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Target Event */}
              <div className="space-y-2">
                <label className="text-slate-300 font-semibold block text-xs">Target Adverse Outcome / MedDRA PT</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search or enter MedDRA reaction..."
                    value={draftEvent}
                    onChange={(e) => {
                      setDraftEvent(e.target.value);
                      setEventFilter(e.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 placeholder-slate-500 font-mono text-xs focus:border-rose-500 focus:outline-none"
                  />
                </div>
                {availableEvents.length > 0 && (
                  <div className="max-h-28 overflow-y-auto rounded-lg border border-slate-800/80 bg-slate-950/90 p-1 space-y-0.5">
                    {filteredEvents.map((ev) => (
                      <button
                        key={ev}
                        type="button"
                        onClick={() => {
                          setDraftEvent(ev);
                          setEventFilter('');
                        }}
                        className={`w-full text-left px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                          draftEvent.toLowerCase() === ev.toLowerCase()
                            ? 'bg-rose-500/20 text-rose-300 font-bold'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {ev}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-800 bg-slate-950/80 px-6 py-4 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>Configured:</span>
            <strong className="text-amber-400 font-mono">{draftMethod === 'SCORE' ? 'SCORE-DA' : draftMethod}</strong>
            <span>·</span>
            <span className="capitalize">{draftTimeUnit}</span>
            <span>·</span>
            <span className="capitalize">{draftMode}</span>
            <span>·</span>
            <span className="font-mono text-slate-300">{draftExpectation}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRun}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs transition-all shadow-lg shadow-amber-600/20 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Run Longitudinal Surveillance</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
