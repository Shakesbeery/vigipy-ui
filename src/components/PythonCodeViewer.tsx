/**
 * vigipy Python Code Generator & Exporter Component
 * Displays copy-pasteable Python code matching the user's active configuration and cohort filters.
 */

import React, { useState } from 'react';
import { Copy, Check, Download, Terminal, Code2 } from 'lucide-react';

interface PythonCodeViewerProps {
  code: string;
}

export const PythonCodeViewer: React.FC<PythonCodeViewerProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vigipy_analysis_pipeline.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur shadow-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Terminal className="h-4 w-4 text-emerald-400" />
          <div>
            <h3 className="text-xs font-bold text-white font-mono flex items-center gap-2">
              vigipy Python Script Generator
              <span className="text-[10px] font-normal text-slate-500 font-sans">
                (Reproducible Pipeline)
              </span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Script</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download .py</span>
          </button>
        </div>
      </div>

      {/* Code Editor Body */}
      <div className="p-4 bg-slate-950 font-mono text-[11px] leading-relaxed text-slate-300 overflow-x-auto max-h-[480px]">
        <pre className="selection:bg-indigo-800 selection:text-white">
          <code>{code}</code>
        </pre>
      </div>

      {/* Instructions footer */}
      <div className="border-t border-slate-800/80 bg-slate-950/40 px-4 py-2.5 text-[11px] text-slate-500 flex items-center justify-between">
        <span>To install vigipy: <code className="text-indigo-400 font-mono">pip install vigipy</code></span>
        <span>Repository: <a href="https://github.com/Shakesbeery/vigipy" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">github.com/Shakesbeery/vigipy</a></span>
      </div>
    </div>
  );
};
