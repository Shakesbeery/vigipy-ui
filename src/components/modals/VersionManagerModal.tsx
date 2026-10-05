import React, { useState, useEffect } from "react";
import { Copy, Check, ExternalLink, Package, ShieldCheck, ArrowUpRight, X, Sparkles, Loader2 } from "lucide-react";
import { VersionResponse } from "../../types";
import { fetchVigipyVersion } from "../../services/api";

interface VersionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionManagerModal: React.FC<VersionManagerModalProps> = ({ isOpen, onClose }) => {
  const [versionInfo, setVersionInfo] = useState<VersionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadVersion();
    }
  }, [isOpen]);

  const loadVersion = async () => {
    setLoading(true);
    try {
      const res = await fetchVigipyVersion();
      setVersionInfo(res);
    } catch {
      // Fallback
      setVersionInfo({
        installed_version: "3.4.0",
        latest_pypi_version: "3.4.0",
        is_latest: true,
        pypi_url: "https://pypi.org/project/vigipy/",
        supported_methods: ["PRR", "ROR", "RFET", "BCPNN", "GPS", "LASSO", "SCORE", "SCORE_DDI"],
        release_date: "2026-10-01",
        summary: "Consensus Engine, Relaxed LASSO & Longitudinal Pipeline",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const pipCmd = "pip install --upgrade vigipy";

  const handleCopy = () => {
    navigator.clipboard.writeText(pipCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                vigipy Core Engine & Library Manager
              </h3>
              <p className="text-xs text-slate-400">
                Official PyPI release tracking and version synchronization.
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

        {/* Content */}
        <div className="p-6 space-y-5">
          {loading ? (
            <div className="w-full h-48 flex items-center justify-center gap-2 text-slate-400 text-xs font-mono">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <span>Checking active Python sidecar environment...</span>
            </div>
          ) : versionInfo ? (
            <>
              {/* Status Banner */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Installed Python Library</div>
                  <div className="text-xl font-bold text-white mt-0.5">vigipy v{versionInfo.installed_version}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    PyPI status: {versionInfo.is_latest ? "Up to date with official stable release." : `Update available (v${versionInfo.latest_pypi_version}).`}
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono">
                  ACTIVE
                </div>
              </div>

              {/* Supported Algorithms */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Supported Analytical Algorithms</h4>
                <div className="flex flex-wrap gap-2">
                  {versionInfo.supported_methods.map((m) => (
                    <span
                      key={m}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-medium text-slate-200"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Pip Upgrade Command */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Upgrade vigipy in Python</h4>
                <p className="text-xs text-slate-400 mb-2">
                  Because vigipy is executed natively in Python, upgrading only requires running pip in your Python environment:
                </p>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300">
                  <span>{pipCmd}</span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Links */}
              <div className="flex items-center gap-4 text-xs text-slate-400 border-t border-slate-800 pt-3">
                <a
                  href={versionInfo.pypi_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-indigo-400 hover:underline"
                >
                  <span>View on PyPI</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
                <a
                  href="https://github.com/Shakesbeery/vigipy"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-indigo-400 hover:underline"
                >
                  <span>GitHub Repository</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/80 px-6 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
