/**
 * Project Container & Session Archive Modal
 * Enables exporting the entire project (records, hyperparameters, filters,
 * dynamic method contracts, longitudinal targets, snapshots) into a portable
 * .vigipy.json container, and deterministically restoring prior project states.
 */

import React, { useState, useRef } from 'react';
import {
  Archive,
  Download,
  Upload,
  Copy,
  Check,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  Database,
  Sliders,
  Filter,
  TrendingUp,
  Sparkles,
  Layers,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { VigipyProjectContainer } from '../types/container';
import {
  createProjectContainer,
  downloadProjectContainer,
  validateProjectContainer,
  CreateContainerParams,
} from '../core/container_service';

interface ProjectContainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectParams: CreateContainerParams;
  onRestoreProject: (container: VigipyProjectContainer) => void;
}

export const ProjectContainerModal: React.FC<ProjectContainerModalProps> = ({
  isOpen,
  onClose,
  currentProjectParams,
  onRestoreProject,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'restore'>('export');

  // Export Form State
  const [projectTitle, setProjectTitle] = useState(currentProjectParams.datasetTitle);
  const [projectDesc, setProjectDesc] = useState('');
  const [investigator, setInvestigator] = useState('Safety Surveillance Analyst');
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Restore State
  const [restoreText, setRestoreText] = useState('');
  const [selectedFileContainer, setSelectedFileContainer] = useState<VigipyProjectContainer | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Active generated container for export
  const exportContainer = createProjectContainer({
    ...currentProjectParams,
    title: projectTitle,
    description: projectDesc || undefined,
    investigator: investigator || undefined,
  });

  const handleDownload = () => {
    downloadProjectContainer(exportContainer);
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(exportContainer, null, 2));
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const result = validateProjectContainer(parsed);
        if (result.isValid && result.container) {
          setSelectedFileContainer(result.container);
          setValidationError(null);
        } else {
          setValidationError(result.errors.join(' '));
          setSelectedFileContainer(null);
        }
      } catch (err) {
        setValidationError('Failed to parse file: Invalid JSON syntax.');
        setSelectedFileContainer(null);
      }
    };
    reader.readAsText(file);
  };

  const handleParsePastedJSON = () => {
    if (!restoreText.trim()) return;
    try {
      const parsed = JSON.parse(restoreText);
      const result = validateProjectContainer(parsed);
      if (result.isValid && result.container) {
        setSelectedFileContainer(result.container);
        setValidationError(null);
      } else {
        setValidationError(result.errors.join(' '));
        setSelectedFileContainer(null);
      }
    } catch (e) {
      setValidationError('Invalid JSON syntax in pasted text.');
      setSelectedFileContainer(null);
    }
  };

  const handleExecuteRestore = (containerToRestore: VigipyProjectContainer) => {
    onRestoreProject(containerToRestore);
    setRestoreSuccessMsg(`Successfully restored project: "${containerToRestore.metadata.title}"`);
    setTimeout(() => {
      setRestoreSuccessMsg(null);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Archive className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Project Container & Session Archive</h2>
                <span className="rounded-full bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 text-[10px] text-violet-300 font-mono">
                  .vigipy.json
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Export the complete project state into a portable container or deterministically restore prior study sessions.
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

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2 gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('export')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'export'
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="h-4 w-4" />
            <span>Export Container</span>
          </button>

          <button
            onClick={() => setActiveTab('restore')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'restore'
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>Restore from Container</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {restoreSuccessMsg && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-4 flex items-center gap-3 text-emerald-200 animate-in fade-in">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div className="font-semibold">{restoreSuccessMsg}</div>
            </div>
          )}

          {/* TAB 1: EXPORT CONTAINER */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Container Metadata
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Project Title
                    </label>
                    <input
                      type="text"
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      placeholder="e.g. FDA MAUDE Coronary Stent Surveillance Protocol"
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-200 focus:border-violet-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Investigator / Organization
                    </label>
                    <input
                      type="text"
                      value={investigator}
                      onChange={(e) => setInvestigator(e.target.value)}
                      placeholder="e.g. Pharmacovigilance Risk Committee"
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-200 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Study Notes / Protocol Description
                  </label>
                  <textarea
                    rows={2}
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    placeholder="Provide context, analytical objectives, or study hypothesis to be packaged with this container..."
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-200 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* What is packaged in container */}
              <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 p-4 space-y-3">
                <h4 className="text-xs font-bold text-violet-300 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-400" />
                  What is Packaged Inside This Container
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-mono">Surveillance Records</span>
                    <div className="text-sm font-bold text-white font-mono">
                      {currentProjectParams.records.length.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-emerald-400">Full Raw Records</span>
                  </div>

                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-mono">Method Parameters</span>
                    <div className="text-sm font-bold text-white font-mono">
                      {Object.keys(currentProjectParams.methodConfigs).length} Methods
                    </div>
                    <span className="text-[10px] text-cyan-400">PRR, ROR, RFET, etc.</span>
                  </div>

                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-mono">Signals Snapshot</span>
                    <div className="text-sm font-bold text-rose-300 font-mono">
                      {(currentProjectParams.signals || []).filter((s) => s.isSignal).length} SDRs
                    </div>
                    <span className="text-[10px] text-slate-400">Analytical Results</span>
                  </div>

                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-mono">Longitudinal Target</span>
                    <div className="text-sm font-bold text-amber-300 font-mono truncate">
                      {currentProjectParams.longTargetDrug}
                    </div>
                    <span className="text-[10px] text-slate-400">{currentProjectParams.longConfig.mode} mode</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-[11px] text-slate-500 font-mono">
                  Container specification: <span className="text-slate-400">vigipy-studio v1.0.0</span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyJSON}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors"
                  >
                    {copiedSuccess ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-slate-400" />}
                    <span>{copiedSuccess ? 'Container Copied!' : 'Copy Container JSON'}</span>
                  </button>

                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-violet-600/30"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Project Container (.vigipy.json)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RESTORE CONTAINER */}
          {activeTab === 'restore' && (
            <div className="space-y-4">
              {/* File Upload Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-slate-700 hover:border-violet-500 bg-slate-950/50 p-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-colors group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.vigipy"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="h-10 w-10 rounded-full bg-violet-500/10 group-hover:bg-violet-500/20 flex items-center justify-center text-violet-400 transition-colors">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200">
                    Click to browse or drag and drop your <code className="text-violet-300 font-mono">.vigipy.json</code> container file
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Restores surveillance records, hyperparameters, cohort filters, and longitudinal models.
                  </p>
                </div>
              </div>

              {/* Paste JSON option */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-slate-400">
                    Or paste container JSON code directly:
                  </label>
                  {restoreText.trim() && (
                    <button
                      onClick={handleParsePastedJSON}
                      className="text-xs text-violet-400 hover:underline"
                    >
                      Inspect Pasted Container
                    </button>
                  )}
                </div>
                <textarea
                  rows={4}
                  value={restoreText}
                  onChange={(e) => setRestoreText(e.target.value)}
                  placeholder='{"formatVersion": "1.0.0", "app": "vigipy-studio", "metadata": ...}'
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200 font-mono text-[10.5px] focus:border-violet-500 focus:outline-none"
                />
              </div>

              {/* Validation Error Message */}
              {validationError && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3.5 flex items-start gap-2.5 text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                  <div>
                    <span className="font-semibold text-xs">Container Validation Failed: </span>
                    <span className="text-[11px]">{validationError}</span>
                  </div>
                </div>
              )}

              {/* Pre-Flight Container Summary */}
              {selectedFileContainer && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="font-bold text-slate-100 text-xs">
                        Valid Container Detected: {selectedFileContainer.metadata.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
                      vigipy v{selectedFileContainer.vigipyVersion}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {selectedFileContainer.metadata.description}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px]">
                    <div className="bg-slate-950/80 p-2 rounded border border-slate-800">
                      <span className="text-slate-500 block">Surveillance Records</span>
                      <span className="font-bold font-mono text-slate-100">
                        {selectedFileContainer.dataset.totalRecords.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-slate-950/80 p-2 rounded border border-slate-800">
                      <span className="text-slate-500 block">Primary Method</span>
                      <span className="font-bold font-mono text-indigo-300">
                        {selectedFileContainer.environment.selectedMethod}
                      </span>
                    </div>

                    <div className="bg-slate-950/80 p-2 rounded border border-slate-800">
                      <span className="text-slate-500 block">Pre-saved Signals</span>
                      <span className="font-bold font-mono text-rose-300">
                        {selectedFileContainer.resultsSnapshot?.totalSignalsFound ?? 'Computed'}
                      </span>
                    </div>

                    <div className="bg-slate-950/80 p-2 rounded border border-slate-800">
                      <span className="text-slate-500 block">Export Timestamp</span>
                      <span className="font-mono text-slate-300">
                        {selectedFileContainer.exportedAt.substring(0, 10)}
                      </span>
                    </div>
                  </div>

                  {/* Execute Button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleExecuteRestore(selectedFileContainer)}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-emerald-600/30"
                    >
                      <ArrowRight className="h-4 w-4" />
                      <span>Restore This Project to Prior State</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/80 px-6 py-4 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Containers are 100% self-contained JSON bundles compatible with vigipy Python analysis.
          </span>
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
