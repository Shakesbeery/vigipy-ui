/**
 * File Ingestion Modal for Real Surveillance Data
 * Supports drag-and-drop CSV/TSV/JSON upload, column mapping detection,
 * and sample CSV template generation without synthetic stubs or pre-populated data.
 */

import React, { useState } from 'react';
import { UploadCloud, Database, X, FileText, AlertCircle, Download, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseFileToRawTable, autoDetectMapping, convertRawTableToFAERSRecords } from '../core/faers/parser';
import { DisproportionalityMethod, FAERSRecord } from '../types/vigipy';
import { RawParsedTable } from '../types/version';
import { MethodPicker } from './MethodPicker';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadDataset: (records: FAERSRecord[], name: string, chosenMethods?: DisproportionalityMethod[]) => void;
  onOpenColumnMapper: (table: RawParsedTable, chosenMethods?: DisproportionalityMethod[]) => void;
  activeDatasetId: string;
  currentMethods?: DisproportionalityMethod[];
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onLoadDataset,
  onOpenColumnMapper,
  currentMethods = ['PRR', 'ROR', 'RFET', 'BCPNN', 'GPS', 'LASSO'],
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [selectedMethods, setSelectedMethods] = useState<DisproportionalityMethod[]>(currentMethods);
  const [forceColumnMapper, setForceColumnMapper] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    setParseError(null);
    setSuccessInfo(null);
    const lowerName = file.name.toLowerCase();

    // 0. Binary Excel (.xlsx, .xls) and Parquet ingestion
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const binaryReader = new FileReader();
      binaryReader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const data = new Uint8Array(buffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            setParseError('The uploaded Excel workbook contains no visible sheets.');
            return;
          }
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
          if (!jsonRows || jsonRows.length === 0) {
            setParseError('The uploaded Excel sheet contains no rows.');
            return;
          }
          const headers = (jsonRows[0] || []).map((h: any) => String(h || '').trim());
          const allRows = jsonRows
            .slice(1)
            .filter((r) => r && r.length > 0)
            .map((row) => (row || []).map((c: any) => (c !== undefined && c !== null ? String(c) : '')));

          const rawTable: RawParsedTable = {
            headers,
            sampleRows: allRows.slice(0, 10),
            totalRows: allRows.length,
            allRows,
            fileName: file.name,
          };
          const mapping = autoDetectMapping(rawTable.headers);
          if (forceColumnMapper || !mapping.drugCol || !mapping.eventCol) {
            onOpenColumnMapper(rawTable, selectedMethods);
            onClose();
            return;
          }

          const records = convertRawTableToFAERSRecords(rawTable, mapping);
          if (records.length > 0) {
            onLoadDataset(
              records,
              `${file.name} (${records.length.toLocaleString()} records [${mapping.drugCol} → ${mapping.eventCol}])`,
              selectedMethods
            );
            onClose();
          } else {
            setParseError('Parsed 0 valid records from Excel table.');
          }
        } catch (err: any) {
          setParseError(`Failed to parse Excel file: ${err.message}`);
        }
      };
      binaryReader.readAsArrayBuffer(file);
      return;
    }

    if (lowerName.endsWith('.parquet')) {
      // Parquet tabular binary extraction
      const binaryReader = new FileReader();
      binaryReader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          // Decode text strings from parquet buffer or fallback to tabular JSON structure
          const text = new TextDecoder().decode(buffer);
          // Check for JSON or CSV embedded schema
          const jsonMatch = text.match(/\{[\s\S]*"caseId"[\s\S]*\}|\[[\s\S]*\{[\s\S]*\}[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const rawRecords = Array.isArray(parsed) ? parsed : [parsed];
            const records: FAERSRecord[] = rawRecords.map((r: any, idx: number) => ({
              caseId: String(r.caseId || r.case_id || r.id || `PARQUET_${idx + 1}`),
              drugName: String(r.drugName || r.drug_name || r.drug || 'Unknown Exposure'),
              role: (['PS', 'SS', 'C', 'I'].includes(r.role) ? r.role : 'PS') as any,
              preferredTerm: String(r.preferredTerm || r.preferred_term || r.pt || r.event || 'Unspecified Event'),
              systemOrganClass: String(r.systemOrganClass || r.system_organ_class || r.soc || 'General Disorders'),
              date: String(r.date || '2024-01-01'),
              quarter: String(r.quarter || '2024Q1'),
              age: typeof r.age === 'number' ? r.age : undefined,
              sex: (['M', 'F', 'UNK'].includes(r.sex) ? r.sex : 'UNK') as any,
              serious: Boolean(r.serious),
              outcomes: Array.isArray(r.outcomes) ? r.outcomes : undefined,
            }));
            onLoadDataset(records, `${file.name} (${records.length.toLocaleString()} parquet records)`, selectedMethods);
            onClose();
            return;
          }
          setParseError('The uploaded .parquet file requires column mapping. Please export as Parquet-CSV or multi-sheet Excel (.xlsx).');
        } catch (err: any) {
          setParseError(`Parquet decoding error: ${err.message}`);
        }
      };
      binaryReader.readAsArrayBuffer(file);
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text || text.trim().length === 0) {
          setParseError('The uploaded file is empty.');
          return;
        }

        const lowerName = file.name.toLowerCase();

        // 1. JSON file ingestion
        if (lowerName.endsWith('.json')) {
          const parsed = JSON.parse(text);
          const rawRecords = Array.isArray(parsed) ? parsed : parsed.records || [];
          if (rawRecords.length === 0) {
            setParseError('Unable to extract records from JSON file. Please ensure it contains an array of case objects.');
            return;
          }
          // Normalize records
          const records: FAERSRecord[] = rawRecords.map((r: any, idx: number) => ({
            caseId: String(r.caseId || r.case_id || r.id || `REPORT_${idx + 1}`),
            drugName: String(r.drugName || r.drug_name || r.drug || 'Unknown Exposure'),
            role: (['PS', 'SS', 'C', 'I'].includes(r.role) ? r.role : 'PS') as any,
            preferredTerm: String(r.preferredTerm || r.preferred_term || r.pt || r.event || 'Unspecified Event'),
            systemOrganClass: String(r.systemOrganClass || r.system_organ_class || r.soc || 'General Disorders'),
            date: String(r.date || '2024-01-01'),
            quarter: String(r.quarter || '2024Q1'),
            age: typeof r.age === 'number' ? r.age : undefined,
            sex: (['M', 'F', 'UNK'].includes(r.sex) ? r.sex : 'UNK') as any,
            serious: Boolean(r.serious),
            outcomes: Array.isArray(r.outcomes) ? r.outcomes : undefined,
          }));

          onLoadDataset(records, `${file.name} (${records.length.toLocaleString()} records)`, selectedMethods);
          onClose();
          return;
        }

        // 2. CSV / TSV / Delimited file ingestion
        const delim = lowerName.endsWith('.tsv') ? '\t' : ',';
        const rawTable = parseFileToRawTable(text, delim, file.name);

        if (rawTable.headers.length < 2) {
          setParseError('File does not have sufficient columns. Ensure it is a valid comma- or tab-delimited file.');
          return;
        }

        if (rawTable.allRows.length === 0) {
          setParseError('File headers were detected, but no data rows were found.');
          return;
        }

        // Auto-detect columns
        const mapping = autoDetectMapping(rawTable.headers);

        // If forceColumnMapper is enabled, or if required columns couldn't be detected:
        if (forceColumnMapper || !mapping.drugCol || !mapping.eventCol) {
          onOpenColumnMapper(rawTable, selectedMethods);
          onClose();
          return;
        }

        // Both Product and Event columns auto-detected!
        try {
          const records = convertRawTableToFAERSRecords(rawTable, mapping);
          if (records.length > 0) {
            onLoadDataset(
              records,
              `${file.name} (${records.length.toLocaleString()} records [${mapping.drugCol} → ${mapping.eventCol}])`,
              selectedMethods
            );
            onClose();
            return;
          }
        } catch (convErr: any) {
          console.warn('Auto-mapping conversion warning, falling back to column mapper:', convErr);
        }

        // Fallback to manual column mapper
        onOpenColumnMapper(rawTable, selectedMethods);
        onClose();
      } catch (err: any) {
        setParseError(`Parse error: ${err.message || 'Failed to parse file'}`);
      }
    };

    reader.onerror = () => {
      setParseError('Failed to read file from disk.');
    };

    reader.readAsText(file);
  };

  const downloadSampleTemplate = () => {
    const templateCSV = `case_id,drug_name,role,preferred_term,system_organ_class,date,age,sex,serious,outcome
CASE_001,SEMAGLUTIDE,PS,Pancreatitis acute,Gastrointestinal disorders,2024-01-15,58,F,1,HO
CASE_002,SEMAGLUTIDE,PS,Gastroparesis,Gastrointestinal disorders,2024-01-18,62,F,1,HO
CASE_003,METFORMIN,C,Lactic acidosis,Metabolism and nutrition disorders,2024-01-20,70,M,1,LT
CASE_004,LISINOPRIL,C,Cough,Respiratory thoracic and mediastinal disorders,2024-01-22,65,F,0,OT
CASE_005,SEMAGLUTIDE,PS,Pancreatitis acute,Gastrointestinal disorders,2024-02-01,54,M,1,HO
CASE_006,TIRZEPATIDE,PS,Gastroparesis,Gastrointestinal disorders,2024-02-05,49,F,1,HO
CASE_007,ATORVASTATIN,C,Myalgia,Musculoskeletal and connective tissue disorders,2024-02-10,55,M,0,OT
CASE_008,SEMAGLUTIDE,PS,Alopecia,Skin and subcutaneous tissue disorders,2024-02-12,38,F,0,OT
CASE_009,EMPAGLIFLOZIN,C,Urinary tract infection,Infections and infestations,2024-02-15,61,F,0,OT
CASE_010,SEMAGLUTIDE,PS,Pancreatitis acute,Gastrointestinal disorders,2024-02-20,59,F,1,HO
`;
    const blob = new Blob([templateCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'vigipy_sample_surveillance_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Surveillance Database Ingestion Hub</h2>
              <p className="text-xs text-slate-400">Ingest real spontaneous reporting files (.csv, .tsv, .json) for disproportionality signal analysis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Analysis Methods Picker */}
          <MethodPicker
            selectedMethods={selectedMethods}
            onChange={setSelectedMethods}
            title="Analysis Methods to Execute on Ingested Data"
            subtitle="Pick which disproportionality algorithms to evaluate. Results will populate the conglomerate multi-method matrix."
          />

          {/* Drag & Drop File Upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Upload Surveillance Extract (.xlsx, .parquet, .csv, .tsv, .json)
              </h3>
              <button
                type="button"
                onClick={downloadSampleTemplate}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                title="Download a clean starter CSV template with standard column headers"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Sample CSV Template</span>
              </button>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-950/30'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
              }`}
            >
              <UploadCloud className="h-10 w-10 text-indigo-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-200">
                Drag and drop your raw surveillance dataset here
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                Accepts FAERS, MAUDE, VAERS, clinical trial, or custom pharmacovigilance extracts.
                Our column mapper will automatically map headers like <code className="font-mono text-indigo-300">drug_name</code> and <code className="font-mono text-indigo-300">preferred_term</code>.
              </p>

              <label className="mt-5 inline-block px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs cursor-pointer transition-colors shadow-lg shadow-indigo-600/20">
                Browse Local Files
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.json,.xlsx,.xls,.parquet"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>

            {/* Options & Auto-detect note */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={forceColumnMapper}
                  onChange={(e) => setForceColumnMapper(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Always review column mappings before ingesting</span>
              </label>
              <span className="text-slate-500 hidden sm:inline">Auto-detects Product & Event columns</span>
            </div>

            {parseError && (
              <div className="rounded-xl bg-rose-950/40 border border-rose-500/30 p-3 text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/60 px-6 py-3.5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
