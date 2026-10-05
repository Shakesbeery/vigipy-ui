import React from "react";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RotateCcw,
  Square,
  Sparkles,
  Zap,
  TrendingUp,
  X,
} from "lucide-react";
import { JobStatusResponse } from "../../types";

export interface AnalysisProgressBarProps {
  jobStatus: JobStatusResponse | null;
  onCancel?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const AnalysisProgressBar: React.FC<AnalysisProgressBarProps> = ({
  jobStatus,
  onCancel,
  onRetry,
  onDismiss,
  className = "",
}) => {
  if (!jobStatus || jobStatus.status === "idle") {
    return null;
  }

  const { status, progress, step, error, total_signals, total_candidates } = jobStatus;
  const progressPercent = Math.min(100, Math.max(0, Math.round(progress * 100)));
  const isRunning = status === "running";
  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const isCancelled = status === "cancelled";

  return (
    <div
      className={`w-full rounded-2xl border p-5 shadow-xl transition-all duration-300 ${
        isCompleted
          ? "bg-slate-900/90 border-emerald-500/30 shadow-emerald-500/5"
          : isFailed
          ? "bg-slate-900/90 border-rose-500/30 shadow-rose-500/5"
          : isCancelled
          ? "bg-slate-900/90 border-slate-700 shadow-slate-900/5"
          : "bg-slate-900/95 border-blue-500/40 shadow-blue-500/10 ring-1 ring-blue-500/20"
      } ${className}`}
    >
      {/* Top Header Bar */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition ${
              isCompleted
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : isFailed
                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                : isCancelled
                ? "bg-slate-800 text-slate-400 border-slate-700"
                : "bg-blue-500/10 text-blue-400 border-blue-500/30"
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : isFailed ? (
              <AlertCircle className="w-5 h-5 text-rose-400" />
            ) : isCancelled ? (
              <XCircle className="w-5 h-5 text-slate-400" />
            ) : (
              <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                {isCompleted
                  ? "Analysis Complete"
                  : isFailed
                  ? "Pipeline Execution Failed"
                  : isCancelled
                  ? "Analysis Cancelled"
                  : "Pharmacovigilance Pipeline Executing"}
              </h4>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                  isCompleted
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : isFailed
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    : isCancelled
                    ? "bg-slate-800 text-slate-400 border-slate-700"
                    : "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"
                }`}
              >
                {status.toUpperCase()}
              </span>
            </div>

            <p className="text-xs text-slate-400 font-mono mt-0.5 max-w-xl truncate">
              {step || (isRunning ? "Processing disproportionality queries..." : "")}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {isRunning && onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-800/60 text-slate-300 text-xs font-medium border border-slate-700 transition"
              title="Cancel ongoing computation"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Cancel</span>
            </button>
          )}

          {isFailed && onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Pipeline</span>
            </button>
          )}

          {(isCompleted || isCancelled || isFailed) && onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Track & Indicator */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400 text-[11px]">
            {isRunning
              ? "Synthesizing contingency statistics..."
              : isCompleted
              ? "All mathematical models converged"
              : isFailed
              ? "Computation halted"
              : "Execution terminated"}
          </span>
          <span
            className={`font-semibold ${
              isCompleted
                ? "text-emerald-400"
                : isFailed
                ? "text-rose-400"
                : "text-blue-400"
            }`}
          >
            {progressPercent}%
          </span>
        </div>

        <div className="relative w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isCompleted
                ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                : isFailed
                ? "bg-gradient-to-r from-rose-600 to-red-500"
                : isCancelled
                ? "bg-slate-600"
                : "bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
          {isRunning && (
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
              style={{
                backgroundSize: "200% 100%",
                animation: "shimmer 2s infinite linear",
              }}
            />
          )}
        </div>
      </div>

      {/* Error Message if Failed */}
      {isFailed && error && (
        <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 font-mono break-all">
          <span className="font-semibold text-rose-200">Error trace: </span>
          {error}
        </div>
      )}

      {/* Telemetry Chips (Signals & Candidates) */}
      {(total_signals > 0 || total_candidates > 0) && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3 text-xs font-mono">
          {total_candidates > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-300">
              <span className="text-slate-500">Evaluated Pairs:</span>
              <span className="font-semibold text-slate-200">
                {total_candidates.toLocaleString()}
              </span>
            </div>
          )}

          {total_signals > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Signals Flagged:</span>
              <span className="font-semibold text-emerald-200">
                {total_signals.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
