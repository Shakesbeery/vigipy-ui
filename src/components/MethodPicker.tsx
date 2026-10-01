/**
 * Method Picker Component
 * Allows users to choose which disproportionality analysis methods to execute
 * when uploading files, ingesting openFDA data, or initiating a new analysis.
 */

import React from 'react';
import { Check, CheckSquare, Square, Sliders, Sparkles } from 'lucide-react';
import { DisproportionalityMethod } from '../types/vigipy';
import { useRegisteredMethods } from '../core/method_registry';

interface MethodPickerProps {
  selectedMethods: DisproportionalityMethod[];
  onChange: (methods: DisproportionalityMethod[]) => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export const MethodPicker: React.FC<MethodPickerProps> = ({
  selectedMethods,
  onChange,
  title = 'Analysis Methods to Execute',
  subtitle = 'Choose which statistical methods to evaluate for disproportionality signals.',
  compact = false,
}) => {
  const registeredMethods = useRegisteredMethods();

  const handleToggle = (id: DisproportionalityMethod) => {
    if (selectedMethods.includes(id)) {
      if (selectedMethods.length === 1) return; // Prevent deselecting all
      onChange(selectedMethods.filter((m) => m !== id));
    } else {
      onChange([...selectedMethods, id]);
    }
  };

  const handleSelectAll = () => {
    onChange(registeredMethods.map((m) => m.id as DisproportionalityMethod));
  };

  const handleSelectCore = () => {
    const core = ['PRR', 'ROR', 'RFET', 'BCPNN', 'GPS', 'LASSO'] as DisproportionalityMethod[];
    const valid = core.filter((c) => registeredMethods.some((m) => m.id === c));
    onChange(valid);
  };

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5 ${compact ? 'text-xs' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
        <div>
          <label className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5 text-indigo-400" />
            <span>{title}</span>
            <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full font-mono font-normal">
              {selectedMethods.length} of {registeredMethods.length} Active
            </span>
          </label>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={handleSelectAll}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={handleSelectCore}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
          >
            Core Standard (6)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {registeredMethods.map((m) => {
          const isSelected = selectedMethods.includes(m.id as DisproportionalityMethod);
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => handleToggle(m.id as DisproportionalityMethod)}
              className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-all ${
                isSelected
                  ? 'border-indigo-500/60 bg-indigo-950/30 ring-1 ring-indigo-500/30'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono font-bold text-xs text-white">{m.id}</span>
                <span
                  className={`h-4 w-4 rounded flex items-center justify-center text-[10px] ${
                    isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-700 bg-slate-950 text-transparent'
                  }`}
                >
                  <Check className="h-3 w-3 stroke-[3]" />
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 capitalize truncate max-w-[70px]">{m.family}</span>
                <span className="text-slate-500 font-mono text-[9px]">{m.parameters.length} params</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
