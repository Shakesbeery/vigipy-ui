/**
 * vigipy Method Configuration & Hyperparameter Tuning Drawer
 * Dynamically discovers all registered DA methods adhering to the MethodContract.
 * Exposes every parameter with comprehensive docstring explanations and mathematical/clinical tooltips.
 * Supports staging draft parameter changes with explicit 'Save' and 'Save & Rerun' controls.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Sliders, RotateCcw, X, Info, HelpCircle, Eye, EyeOff, BookOpen, Save, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { DisproportionalityMethod, ExpectationModel, MethodConfigs } from '../types/vigipy';
import { methodRegistry, ParameterSpec, useRegisteredMethods } from '../core/method_registry';

interface MethodConfigDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  configs: MethodConfigs;
  onSaveConfigs: (newConfigs: MethodConfigs) => void;
  onSaveAndRerun: (newConfigs: MethodConfigs, changedMethods: string[]) => void;
  activeMethod: DisproportionalityMethod;
  setActiveMethod: (m: DisproportionalityMethod) => void;
}

export const MethodConfigDrawer: React.FC<MethodConfigDrawerProps> = ({
  isOpen,
  onClose,
  configs,
  onSaveConfigs,
  onSaveAndRerun,
  activeMethod,
  setActiveMethod,
}) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [showAllDocstrings, setShowAllDocstrings] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Staging draft configuration state
  const [draftConfigs, setDraftConfigs] = useState<MethodConfigs>(configs);

  // Re-sync draft whenever drawer is opened or parent configs change
  useEffect(() => {
    if (isOpen) {
      setDraftConfigs(JSON.parse(JSON.stringify(configs)));
      setSaveSuccessMsg(null);
    }
  }, [isOpen, configs]);

  // Dynamically consume all registered methods via reactive hook
  const allMethods = useRegisteredMethods();

  // Identify which methods have modified draft parameters compared to current configs
  const modifiedMethods = useMemo(() => {
    const changed: string[] = [];
    allMethods.forEach((m) => {
      const orig = JSON.stringify(configs[m.id] || m.defaultConfig || {});
      const draft = JSON.stringify(draftConfigs[m.id] || m.defaultConfig || {});
      if (orig !== draft) {
        changed.push(m.id);
      }
    });
    // Check if global expectation method changed
    if (configs.expectationMethod !== draftConfigs.expectationMethod) {
      if (!changed.includes('expectationMethod')) {
        changed.push('expectationMethod');
      }
    }
    return changed;
  }, [configs, draftConfigs, allMethods]);

  if (!isOpen) return null;

  const currentContract = allMethods.find((m) => m.id === activeMethod) || allMethods[0];

  const updateDraftConfig = (methodId: string, field: string, value: any) => {
    setDraftConfigs((prev) => ({
      ...prev,
      [methodId]: {
        ...(prev[methodId] || {}),
        [field]: value,
      },
    }));
  };

  const handleResetToDefaults = () => {
    const def = methodRegistry.getDefaultConfigs() as MethodConfigs;
    setDraftConfigs(def);
  };

  const handleSaveOnly = () => {
    onSaveConfigs(draftConfigs);
    setSaveSuccessMsg('Parameters saved successfully!');
    setTimeout(() => {
      setSaveSuccessMsg(null);
      onClose();
    }, 900);
  };

  const handleSaveAndRerun = () => {
    const methodsToRerun = modifiedMethods.length > 0 ? modifiedMethods : [activeMethod];
    onSaveAndRerun(draftConfigs, methodsToRerun);
    onClose();
  };

  const currentMethodDraft = draftConfigs[activeMethod] || currentContract?.defaultConfig || {};
  const globalExpectation: ExpectationModel =
    draftConfigs.expectationMethod || currentMethodDraft.expectationMethod || 'binomial';

  const handleSetGlobalExpectation = (newModel: ExpectationModel) => {
    const updated: any = {
      ...draftConfigs,
      expectationMethod: newModel,
    };
    allMethods.forEach((m) => {
      updated[m.id] = {
        ...(draftConfigs[m.id] || m.defaultConfig || {}),
        expectationMethod: newModel,
      };
    });
    setDraftConfigs(updated as MethodConfigs);
  };

  const hasUnsavedChanges = modifiedMethods.length > 0;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Sliders className="h-5 w-5 text-indigo-400" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Algorithm Hyperparameters</h3>
              {hasUnsavedChanges ? (
                <span className="text-[10px] bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  {modifiedMethods.length} {modifiedMethods.length === 1 ? 'Method' : 'Methods'} Modified
                </span>
              ) : (
                <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                  vigipy Contract
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Type-safe dataclass parameters & docstring explanations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetToDefaults}
            title="Reset all methods to vigipy defaults"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Dynamic Method Selector Tabs */}
      <div className="flex flex-wrap border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1 text-xs overflow-x-auto">
        {allMethods.map((m) => {
          const isModified = modifiedMethods.includes(m.id);
          return (
            <button
              key={m.id}
              onClick={() => {
                setActiveMethod(m.id as DisproportionalityMethod);
                setActiveTooltip(null);
              }}
              className={`relative flex-1 min-w-[62px] py-1.5 px-2 rounded-lg font-mono font-medium text-center transition-all ${
                activeMethod === m.id
                  ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>{m.id}</span>
              {isModified && (
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Method Overview Banner */}
      <div className="p-4 bg-slate-950/60 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${currentContract.badgeColor}`}>
              {currentContract.family}
            </span>
            <span>{currentContract.fullName}</span>
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">
            {currentContract.parameters.length} Parameters
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-300">
          {currentContract.docstring}
        </p>

        {/* Global Docstring Toggle */}
        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px]">
          <span className="text-slate-400 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
            Parameter Documentation
          </span>
          <button
            onClick={() => setShowAllDocstrings(!showAllDocstrings)}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2 py-0.5 rounded bg-indigo-950/40 border border-indigo-500/20"
          >
            {showAllDocstrings ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                <span>Collapse All Docstrings</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" />
                <span>Expand All Docstrings</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Dynamic Parameter Form */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
        {/* vigipy Contingency Expectation Model (E) */}
        <div className="p-3.5 rounded-xl border border-indigo-500/40 bg-gradient-to-br from-indigo-950/40 to-slate-950/70 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
              <span className="font-bold text-slate-100 text-xs">
                Contingency Expectation Baseline Model (E)
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Active: {globalExpectation.toUpperCase()}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Sets the statistical expectation model for computing expected background co-occurrence (<code className="text-cyan-300 font-mono">E</code>).
            Supported vigipy options mirror official pharmacovigilance methods:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
            {[
              {
                id: 'binomial' as const,
                label: 'Binomial Model',
                formula: 'p₀ = n₀₁ / n₀·, E = n₁· × p₀',
                desc: 'Conditions on non-target report proportions to prevent index product self-inflation.',
              },
              {
                id: 'standard' as const,
                label: 'Standard Marginal',
                formula: 'E = (n₁· × n·₁) / n··',
                desc: 'Product of marginal reporting frequencies under cross-table independence.',
              },
              {
                id: 'poisson' as const,
                label: 'Poisson Baseline',
                formula: 'λ₀ = n·₁ / n··, E = n₁· × λ₀',
                desc: 'Continuous Poisson arrival baseline rate across background reporting.',
              },
              {
                id: 'negative-binomial' as const,
                label: 'Negative Binomial',
                formula: 'E_nb = E_std × (1 + α)',
                desc: 'Overdispersed variance adjustment for clustered adverse event reports.',
              },
              {
                id: 'mantel-haenszel' as const,
                label: 'Mantel-Haenszel',
                formula: 'E_mh = Σ_k (n₁·k × n·1k / n··k)',
                desc: 'Stratified hypergeometric non-replacement expectation adjusting for confounders.',
              },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSetGlobalExpectation(m.id)}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  globalExpectation === m.id
                    ? 'border-cyan-500/70 bg-cyan-950/60 text-cyan-200 shadow-sm ring-1 ring-cyan-500/40'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="font-semibold text-[11px] flex items-center justify-between">
                  <span>{m.label}</span>
                  {globalExpectation === m.id && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>}
                </div>
                <div className="text-[9px] font-mono text-cyan-300/80 mt-0.5">{m.formula}</div>
                <div className="text-[10px] text-slate-400 mt-1 leading-snug">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Parameter Fields */}
        {currentContract.parameters.map((param: ParameterSpec) => {
          const val = currentMethodDraft[param.key] !== undefined ? currentMethodDraft[param.key] : param.default;
          const isTooltipOpen = showAllDocstrings || activeTooltip === param.key;
          const isFieldModified =
            configs[activeMethod]?.[param.key] !== undefined &&
            configs[activeMethod]?.[param.key] !== currentMethodDraft[param.key];

          return (
            <div
              key={param.key}
              className={`p-3.5 rounded-xl border transition-all ${
                isFieldModified
                  ? 'border-amber-500/50 bg-amber-950/10 ring-1 ring-amber-500/20'
                  : isTooltipOpen
                  ? 'border-indigo-500/50 bg-indigo-950/20 ring-1 ring-indigo-500/20'
                  : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
              }`}
            >
              {/* Header with docstring toggle */}
              <div className="flex items-center justify-between mb-2">
                <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <span>{param.label}</span>
                  <code className="text-[10px] font-mono text-indigo-400 font-normal">
                    ({param.key})
                  </code>
                  {isFieldModified && (
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono font-normal">
                      Modified
                    </span>
                  )}
                </label>

                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === param.key ? null : param.key)}
                  className={`p-1 rounded transition-colors ${
                    isTooltipOpen
                      ? 'text-cyan-300 bg-cyan-950/80 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title="Toggle parameter explanation & docstring"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </div>

              {/* Input Control */}
              {param.type === 'number' && (
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step={param.step || 0.1}
                    min={param.min}
                    max={param.max}
                    value={val}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value);
                      updateDraftConfig(activeMethod, param.key, isNaN(num) ? param.default : num);
                    }}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-100 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                  {param.default !== undefined && (
                    <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                      Default: {param.default}
                    </span>
                  )}
                </div>
              )}

              {param.type === 'boolean' && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-slate-400">
                    {val ? 'Enabled (Active in calculations)' : 'Disabled'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(val)}
                      onChange={(e) => updateDraftConfig(activeMethod, param.key, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              )}

              {param.type === 'select' && param.options && (
                <select
                  value={val}
                  onChange={(e) => updateDraftConfig(activeMethod, param.key, e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-100 font-mono focus:border-indigo-500 focus:outline-none"
                >
                  {param.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {/* Docstring & Methodology Tooltip Explanation */}
              {isTooltipOpen && (
                <div className="mt-2.5 rounded-lg bg-slate-900/95 border border-indigo-500/30 p-3 text-[11px] space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-start gap-1.5 text-cyan-300">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-cyan-400" />
                    <div className="w-full">
                      <span className="font-semibold text-slate-200">vigipy Docstring:</span>
                      <p className="font-mono text-[10.5px] text-cyan-200/90 mt-1 leading-relaxed bg-slate-950 p-2.5 rounded-md border border-slate-800 whitespace-pre-wrap">
                        {param.docstring}
                      </p>
                    </div>
                  </div>

                  <div className="text-slate-300 border-t border-slate-800/80 pt-1.5">
                    <span className="font-semibold text-slate-200">Surveillance Impact: </span>
                    <span className="text-slate-300">{param.clinicalImpact}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save Success Banner */}
      {saveSuccessMsg && (
        <div className="px-5 py-2 bg-emerald-950/70 border-t border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-400" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Footer with Explicit 'Save' and 'Save & Rerun Analyses' Buttons */}
      <div className="border-t border-slate-800 bg-slate-950/90 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] text-slate-400">
          {hasUnsavedChanges ? (
            <span className="text-amber-300 font-medium">
              ● Unsaved changes in {modifiedMethods.join(', ')}
            </span>
          ) : (
            <span className="text-slate-500">All parameters synced</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>

          {/* Button 1: Save Parameters */}
          <button
            type="button"
            onClick={handleSaveOnly}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs transition-colors"
            title="Save hyperparameter configurations without immediately recalculating existing results"
          >
            <Save className="h-3.5 w-3.5 text-indigo-400" />
            <span>Save Parameters</span>
          </button>

          {/* Button 2: Save & Rerun Analyses */}
          <button
            type="button"
            onClick={handleSaveAndRerun}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-indigo-600/30"
            title="Save hyperparameter changes and immediately re-evaluate all affected disproportionality signals"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Save & Rerun Analyses</span>
          </button>
        </div>
      </div>
    </div>
  );
};
