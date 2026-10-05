import React, { useState, useRef } from "react";
import { Archive, Download, Upload, Check, X, FileText, CheckCircle2, Database, Sliders, Filter, Sparkles } from "lucide-react";
import { RunAnalysisRequest } from "../../types";

interface ProjectContainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetTitle?: string;
  totalRecords?: number;
  config?: RunAnalysisRequest;
  onRestoreConfig?: (config: RunAnalysisRequest) => void;
}

export const ProjectContainerModal: React.FC<ProjectContainerModalProps> = ({
  isOpen,
  onClose,
  datasetTitle = "vigipy_project",
  totalRecords = 0,
  config,
  onRestoreConfig,
}) => {
  const [activeTab, setActiveTab] = useState<"export" | "restore">("export");
  const [projectTitle, setProjectTitle] = useState(datasetTitle);
  const [investigator, setInvestigator] = useState("Surveillance Analyst");
  const [restoredSuccess, setRestoredSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleExport = () => {
    const container = {
      formatVersion: "1.0.0",
      app: "vigipy-studio",
      exportedAt: new Date().toISOString(),
      metadata: {
        title: projectTitle,
        investigator,
        datasetTitle,
        totalRecords,
      },
      configuration: config || {},
    };

    const blob = new Blob([JSON.stringify(container, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectTitle.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.vigipy.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if ((parsed.app === "vigipy-studio" || parsed.app === "vigipy-ui") && parsed.configuration) {
          if (onRestoreConfig) {
            onRestoreConfig(parsed.configuration);
          }
          setRestoredSuccess(true);
          setTimeout(() => {
            setRestoredSuccess(false);
            onClose();
          }, 1500);
        } else {
          alert("Invalid .vigipy.json container file format.");
        }
      } catch {
        alert("Failed to parse project container JSON file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Project Container & Workspace Backup
              </h3>
              <p className="text-xs text-slate-400">
                Serialize, export, or restore your complete surveillance workspace (.vigipy.json).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6">
          <button
            onClick={() => setActiveTab("export")}
            className={`py-3 text-xs font-semibold border-b-2 mr-6 transition ${
              activeTab === "export"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Export Project (.vigipy.json)
          </button>
          <button
            onClick={() => setActiveTab("restore")}
            className={`py-3 text-xs font-semibold border-b-2 transition ${
              activeTab === "restore"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Restore Project Container
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === "export" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Project Title</label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Principal Investigator / Analyst</label>
                <input
                  type="text"
                  value={investigator}
                  onChange={(e) => setInvestigator(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 text-xs text-slate-400">
                Exports all algorithm selections, hyperparameters, and dataset metadata into a single portable container.
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .vigipy.json</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.vigipy.json"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-slate-950/40"
              >
                <Upload className="w-8 h-8 text-purple-400" />
                <span className="text-xs font-semibold text-slate-200">Click to upload .vigipy.json container</span>
                <span className="text-[11px] text-slate-500">Restores full configuration and parameters automatically</span>
              </div>

              {restoredSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Workspace restored successfully!</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
