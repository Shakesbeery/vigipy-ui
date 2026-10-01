/**
 * openFDA Live Data Ingestor Modal
 * Streams real adverse event records directly from the FDA APIs:
 * - FAERS: Pharmaceuticals & Biologicals
 * - MAUDE: Medical Devices & Surgical Instruments
 */

import React, { useState } from 'react';
import { Globe, X, Search, Loader2, CheckCircle2, AlertCircle, Database, ShieldAlert, Cpu, Pill } from 'lucide-react';
import { fetchOpenFDAReports } from '../core/faers/openfda';
import { DisproportionalityMethod, FAERSRecord } from '../types/vigipy';
import { MethodPicker } from './MethodPicker';

interface OpenFDAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngestRecords: (records: FAERSRecord[], sourceTitle: string, chosenMethods?: DisproportionalityMethod[]) => void;
  currentMethods?: DisproportionalityMethod[];
}

export const OpenFDAModal: React.FC<OpenFDAModalProps> = ({
  isOpen,
  onClose,
  onIngestRecords,
  currentMethods = ['PRR', 'ROR', 'RFET', 'BCPNN', 'GPS', 'LASSO', 'SCORE'],
}) => {
  const [domain, setDomain] = useState<'drug' | 'device'>('drug');
  const [queryName, setQueryName] = useState('');
  const [reaction, setReaction] = useState('');
  const [limit, setLimit] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<{ current: number; total: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedMethods, setSelectedMethods] = useState<DisproportionalityMethod[]>(currentMethods);

  if (!isOpen) return null;

  const handleQuery = async () => {
    if (!queryName || queryName.trim().length === 0) {
      setErrorMessage(`Please enter a ${domain === 'drug' ? 'drug substance/brand' : 'medical device brand/model'} to search.`);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setFetchProgress(null);
    setStatusMessage(`Connecting to openFDA API (api.fda.gov/${domain}/event.json)...`);

    try {
      const { records, totalFound } = await fetchOpenFDAReports({
        mode: domain,
        drugName: queryName,
        reaction: reaction || undefined,
        limit,
        onProgress: (fetched, total) => {
          setFetchProgress({ current: fetched, total });
          setStatusMessage(`Streaming records from openFDA: ${fetched} ingested (${total.toLocaleString()} found on FDA servers)...`);
        },
      });

      if (records.length === 0) {
        setErrorMessage(
          `No ${domain === 'drug' ? 'FAERS drug' : 'MAUDE device'} records found matching "${queryName}". Try another search term (e.g. ${
            domain === 'drug' ? 'semaglutide, metformin, pembrolizumab' : 'pacemaker, insulin pump, stent'
          }).`
        );
        setIsLoading(false);
        return;
      }

      setStatusMessage(`Successfully ingested ${records.length.toLocaleString()} reports from FDA servers.`);
      const titlePrefix = domain === 'drug' ? 'openFDA FAERS' : 'openFDA MAUDE';
      onIngestRecords(records, `${titlePrefix}: ${queryName.toUpperCase()}`, selectedMethods);

      setTimeout(() => {
        setIsLoading(false);
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to query openFDA API. Please check internet connection.');
      setIsLoading(false);
    }
  };

  const sampleDrugs = ['semaglutide', 'pembrolizumab', 'atorvastatin', 'tirzepatide', 'metformin', 'lisinopril'];
  const sampleDevices = ['pacemaker', 'insulin pump', 'coronary stent', 'infusion pump', 'hip prosthesis', 'defibrillator'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">openFDA Live Surveillance Ingestor</h2>
              <p className="text-xs text-slate-400">Official API stream for FDA FAERS (Drugs) &amp; MAUDE (Medical Devices)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto">
          {/* Domain Segmented Control */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Surveillance Domain Target
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setDomain('drug');
                  setQueryName('');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  domain === 'drug'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Pill className="h-4 w-4" />
                <span>Pharmaceuticals (FAERS)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDomain('device');
                  setQueryName('');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  domain === 'device'
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="h-4 w-4" />
                <span>Medical Devices (MAUDE)</span>
              </button>
            </div>
          </div>

          {/* Search Term Input */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              {domain === 'drug' ? 'Active Substance or Medicinal Product Name' : 'Device Brand Name, Generic Name, or Model'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                placeholder={domain === 'drug' ? 'e.g. semaglutide, nivolumab, rosuvastatin' : 'e.g. pacemaker, insulin pump, coronary stent'}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none font-mono"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Quick suggestions:</span>
              {(domain === 'drug' ? sampleDrugs : sampleDevices).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQueryName(s)}
                  className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[10px] font-mono transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Event / Problem Filter */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              {domain === 'drug' ? 'Optional MedDRA Preferred Term (Reaction Filter)' : 'Optional Device Problem Code or Event Type'}
            </label>
            <input
              type="text"
              value={reaction}
              onChange={(e) => setReaction(e.target.value)}
              placeholder={domain === 'drug' ? 'Leave blank for all adverse events, or e.g. pancreatitis' : 'Leave blank for all, or e.g. Malfunction, Injury, Breakage'}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none font-mono"
            />
          </div>

          {/* Records Limit Dropdown */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Reports to Ingest (Deep Multi-Batch Stream)
            </label>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 font-mono"
            >
              <option value="25">25 reports (Quick preview)</option>
              <option value="50">50 reports</option>
              <option value="100">100 reports (Standard batch)</option>
              <option value="250">250 reports (Deep statistical surveillance)</option>
              <option value="500">500 reports (Full cohort evaluation)</option>
              <option value="1000">1,000 reports (High-power surveillance)</option>
            </select>
          </div>

          {/* Analysis Methods Picker */}
          <MethodPicker
            selectedMethods={selectedMethods}
            onChange={setSelectedMethods}
            title="Analysis Methods to Execute"
            subtitle="Pick which disproportionality algorithms to evaluate on the streamed FDA records."
          />

          {statusMessage && (
            <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/30 p-3 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-lg bg-rose-950/40 border border-rose-500/30 p-3 text-rose-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-800 bg-slate-950/60 px-6 py-4 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            api.fda.gov/{domain}/event.json
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleQuery}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-cyan-600/20 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Streaming FDA Records...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>Query &amp; Ingest</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
