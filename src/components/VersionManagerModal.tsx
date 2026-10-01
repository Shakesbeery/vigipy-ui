/**
 * PyPI Version & DA Methodology Sync Manager Modal
 * Tracks PyPI releases and GitHub tags for vigipy, enables version pinning,
 * and showcases the dynamic method container contract allowing new DA algorithms
 * to be dynamically registered and activated in real time.
 */

import React, { useState } from 'react';
import {
  Package,
  RefreshCw,
  CheckCircle2,
  GitBranch,
  ArrowRight,
  ExternalLink,
  X,
  ShieldCheck,
  Terminal,
  AlertCircle,
  PlusCircle,
  Trash2,
  RotateCcw,
  Sparkles,
  Layers,
  Code2,
} from 'lucide-react';
import { VigipyVersionInfo } from '../types/version';
import { checkPyPIForUpdates, PyPICheckResult } from '../core/pypi_service';
import {
  methodRegistry,
  useRegisteredMethods,
  UPCOMING_VIGIPY_METHODS,
  MethodContract,
} from '../core/method_registry';

interface VersionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeVersion: string;
  onSelectVersion: (version: string) => void;
  versions: VigipyVersionInfo[];
  setVersions: React.Dispatch<React.SetStateAction<VigipyVersionInfo[]>>;
}

export const VersionManagerModal: React.FC<VersionManagerModalProps> = ({
  isOpen,
  onClose,
  activeVersion,
  onSelectVersion,
  versions,
  setVersions,
}) => {
  const [activeTab, setActiveTab] = useState<'versions' | 'container'>('versions');
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<PyPICheckResult | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Dynamic reactive methods registered in registry
  const registeredMethods = useRegisteredMethods();

  if (!isOpen) return null;

  const handleCheckPyPI = async () => {
    setIsChecking(true);
    try {
      const res = await checkPyPIForUpdates(activeVersion);
      setCheckResult(res);
      setVersions(res.versions);
    } catch (e) {
      console.error('Error checking PyPI:', e);
    } finally {
      setIsChecking(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleRegisterMethod = (contract: MethodContract) => {
    methodRegistry.register(contract);
  };

  const handleUnregisterMethod = (id: string) => {
    methodRegistry.unregister(id);
  };

  const handleResetToStandard = () => {
    methodRegistry.resetToDefaults();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">vigipy Methodology & Container Registry</h2>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300 font-mono">
                  Active: v{activeVersion}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Track upstream library releases, compare DA algorithm changes, and manage dynamic method container contracts.
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

        {/* Modal Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2 gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('versions')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'versions'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="h-4 w-4" />
            <span>PyPI Version Matrix</span>
          </button>
          <button
            onClick={() => setActiveTab('container')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'container'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Dynamic Method Container Contract ({registeredMethods.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {activeTab === 'versions' && (
            <>
              {/* Check PyPI Live Banner */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                    <h4 className="font-semibold text-slate-200 text-xs">PyPI Package Registry Synchronizer</h4>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Queries <code className="font-mono text-cyan-400">pypi.org/pypi/vigipy/json</code> & GitHub release tags.
                  </p>
                </div>

                <button
                  onClick={handleCheckPyPI}
                  disabled={isChecking}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs transition-colors shadow-sm"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                  <span>{isChecking ? 'Querying PyPI...' : 'Check PyPI for Updates'}</span>
                </button>
              </div>

              {/* Status Alert if checked */}
              {checkResult && (
                <div
                  className={`rounded-xl border p-3.5 flex items-start gap-2.5 ${
                    checkResult.hasUpdate
                      ? 'border-amber-500/30 bg-amber-950/30 text-amber-200'
                      : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                  <div>
                    <div className="font-semibold text-xs">
                      {checkResult.hasUpdate
                        ? `New version available on PyPI: v${checkResult.latestVersion}`
                        : `vigipy is up-to-date with PyPI registry (v${checkResult.latestVersion})`}
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      Checked from {checkResult.source.toUpperCase()} at {new Date(checkResult.lastChecked).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Version List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Available DA Methodology Version Profiles
                </h3>

                <div className="space-y-3">
                  {versions.map((v) => {
                    const isActive = v.version === activeVersion;
                    return (
                      <div
                        key={v.version}
                        className={`rounded-xl border p-4 transition-all ${
                          isActive
                            ? 'border-emerald-500/50 bg-emerald-950/20 ring-1 ring-emerald-500/30'
                            : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold font-mono text-white">v{v.version}</span>
                            {v.isLatest && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                LATEST RELEASE
                              </span>
                            )}
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                ACTIVE IN APP
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-slate-500">{v.releaseDate}</span>
                            {!isActive && (
                              <button
                                onClick={() => onSelectVersion(v.version)}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors"
                              >
                                Switch to v{v.version}
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-slate-300 font-medium text-xs mb-2">{v.summary}</p>

                        {/* Methodology features */}
                        <div className="mb-3 space-y-1">
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                            DA Methodology Updates in this version:
                          </div>
                          {v.changelog.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                              <span className="text-emerald-400 font-bold">•</span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>

                        {/* Supported methods badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
                          <span className="text-[10px] text-slate-500">Methods:</span>
                          {v.supportedMethods.map((m) => (
                            <span
                              key={m}
                              className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-indigo-300"
                            >
                              {m}
                            </span>
                          ))}
                        </div>

                        {/* Install command */}
                        <div className="mt-3 flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800 font-mono text-[11px]">
                          <span className="text-emerald-400">{v.pipCommand}</span>
                          <button
                            onClick={() => copyToClipboard(v.pipCommand)}
                            className="text-slate-400 hover:text-white transition-colors text-[10px] ml-2 shrink-0 underline"
                          >
                            {copiedCmd === v.pipCommand ? 'Copied!' : 'Copy pip command'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeTab === 'container' && (
            <div className="space-y-5">
              {/* Architecture Banner */}
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    <h3 className="font-semibold text-white text-xs">
                      Dynamic DA Method Container Contract
                    </h3>
                  </div>
                  <button
                    onClick={handleResetToStandard}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800 border border-slate-700"
                    title="Restore default standard methods"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset to Defaults</span>
                  </button>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  Any new methodology added to <code className="text-cyan-300 font-mono">vigipy</code> adheres to the uniform <code className="text-indigo-300 font-mono">MethodContract</code> interface. When registered, the method automatically integrates across the entire app: Studio method tabs, parameter tuning drawer with Python docstrings, contingency evaluation, multi-method consensus concordance, and reproducible script generation.
                </p>
              </div>

              {/* Currently Registered Methods */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
                  <span>Currently Registered Methods ({registeredMethods.length})</span>
                  <span className="text-[10px] text-emerald-400 font-normal">Active & Reactive in App</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {registeredMethods.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-white">{m.id}</span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${m.badgeColor}`}>
                            {m.family}
                          </span>
                        </div>
                        {['PRR', 'ROR', 'RFET', 'BCPNN', 'GPS', 'LASSO'].includes(m.id) ? (
                          <span className="text-[10px] text-slate-500 font-mono">Core Standard</span>
                        ) : (
                          <button
                            onClick={() => handleUnregisterMethod(m.id)}
                            className="p-1 rounded text-rose-400 hover:bg-rose-950/50 transition-colors"
                            title="Unregister dynamic method"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="text-[11px] font-medium text-slate-200">{m.fullName}</div>
                      <p className="text-[10.5px] text-slate-400 line-clamp-2">{m.docstring}</p>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>{m.parameters.length} Parameters with Docstrings</span>
                        <span>Contract Verified</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming / Experimental vigipy Methods for Dynamic Activation */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
                  <span>Dynamic vigipy Extensions & Experimental Methods</span>
                  <span className="text-[10px] text-indigo-400 font-normal">One-Click Dynamic Activation</span>
                </h4>

                <div className="space-y-3">
                  {UPCOMING_VIGIPY_METHODS.map((ext) => {
                    const isAlreadyRegistered = registeredMethods.some((m) => m.id === ext.id);
                    return (
                      <div
                        key={ext.id}
                        className={`rounded-xl border p-4 transition-all ${
                          isAlreadyRegistered
                            ? 'border-indigo-500/40 bg-indigo-950/20'
                            : 'border-slate-800 bg-slate-950/40'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-cyan-300">{ext.id}</span>
                            <span className="text-xs font-semibold text-slate-200">{ext.fullName}</span>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${ext.badgeColor}`}>
                              {ext.family}
                            </span>
                          </div>

                          {isAlreadyRegistered ? (
                            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Active in App
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRegisterMethod(ext)}
                              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors shadow-sm"
                            >
                              <PlusCircle className="h-3.5 w-3.5" />
                              <span>Register Dynamically</span>
                            </button>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                          {ext.docstring}
                        </p>

                        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[10.5px] space-y-1">
                          <span className="font-semibold text-slate-300">Container Contract Parameters:</span>
                          <div className="flex flex-wrap gap-2 text-slate-400">
                            {ext.parameters.map((p) => (
                              <span key={p.key} className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-mono text-[10px]">
                                {p.key} ({p.type})
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/80 px-6 py-4 flex items-center justify-between">
          <a
            href="https://github.com/Shakesbeery/vigipy"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline"
          >
            <span>View PyPI & GitHub Releases (Shakesbeery/vigipy)</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
