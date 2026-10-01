/**
 * CSV / TSV / JSON File Parser for Pharmacovigilance & FAERS Data
 * RFC-4180 compliant, handles BOM, auto-detects delimiters (comma, tab, semicolon, pipe),
 * recognizes FAERS/MAUDE/custom column headers, and safely parses clinical records.
 */

import { FAERSRecord } from '../../types/vigipy';
import { ColumnMappingConfig, RawParsedTable } from '../../types/version';

/**
 * Fast RFC-4180 compliant CSV parser that supports:
 * - UTF-8 BOM stripping
 * - Embedded newlines inside quoted fields
 * - Escaped double quotes ("")
 * - Dynamic delimiters (comma, tab, semicolon, pipe)
 */
export function parseCSVToRows(text: string, delimiter?: string): string[][] {
  if (!text) return [];

  // 1. Strip UTF-8 Byte Order Mark (BOM)
  let clean = text.replace(/^\uFEFF/, '').trim();
  if (clean.length === 0) return [];

  // 2. Auto-detect delimiter if not explicitly provided or default comma
  let activeDelimiter = delimiter || ',';
  if (!delimiter || delimiter === ',') {
    const firstLineEnd = clean.search(/\r?\n/);
    const firstLine = firstLineEnd !== -1 ? clean.substring(0, firstLineEnd) : clean;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const pipeCount = (firstLine.match(/\|/g) || []).length;

    if (tabCount > commaCount && tabCount >= semiCount && tabCount >= pipeCount) {
      activeDelimiter = '\t';
    } else if (semiCount > commaCount && semiCount >= pipeCount) {
      activeDelimiter = ';';
    } else if (pipeCount > commaCount) {
      activeDelimiter = '|';
    } else {
      activeDelimiter = ',';
    }
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote: "" -> "
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === activeDelimiter && !inQuotes) {
      currentRow.push(currentField.trim().replace(/^["']|["']$/g, ''));
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim().replace(/^["']|["']$/g, ''));
      currentField = '';
      if (currentRow.length > 0 && currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  // Push final field / row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim().replace(/^["']|["']$/g, ''));
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Automatically inspects headers to detect pharmacovigilance dimensions
 */
export function autoDetectMapping(headers: string[]): ColumnMappingConfig {
  const cleanHeaders = headers.map((h) => (h || '').trim());

  const findHeader = (candidates: string[]): string => {
    // 1. Exact normalized match (ignoring case, spaces, and punctuation)
    const exact = cleanHeaders.find((h) => {
      const norm = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return candidates.some((c) => c.toLowerCase().replace(/[^a-z0-9]/g, '') === norm);
    });
    if (exact) return exact;

    // 2. Substring match
    const sub = cleanHeaders.find((h) => {
      const lower = h.toLowerCase();
      return candidates.some((c) => lower.includes(c.toLowerCase()));
    });
    return sub || '';
  };

  return {
    drugCol: findHeader([
      'drugname', 'drug_name', 'drug', 'medicinalproduct', 'medicinal_product',
      'substancename', 'active_substance', 'treatment', 'device_name', 'device',
      'product', 'exposure', 'brand_name', 'compound'
    ]),
    eventCol: findHeader([
      'preferred_term', 'pt', 'event', 'reaction', 'reactionmeddrapt', 'reaction_meddra_pt',
      'adverse_event', 'problem', 'malfunction', 'outcome', 'complication', 'symptom',
      'pt_name', 'meddra_pt', 'event_pt'
    ]),
    countCol: findHeader([
      'count', 'counts', 'n', 'freq', 'frequency', 'cases', 'reports', 'report_count',
      'total_cases', 'n_cases', 'num_reports', 'weight', 'n_events'
    ]),
    substanceCol: findHeader([
      'substance', 'substancename', 'active_substance', 'substance_name', 'ingredient',
      'active_ingredient', 'generic_name', 'inn'
    ]),
    strataCol: findHeader([
      'strata', 'stratum', 'cohort', 'study', 'country', 'center', 'site'
    ]),
    caseIdCol: findHeader([
      'case_id', 'caseid', 'primaryid', 'primary_id', 'id', 'isr',
      'safetyreportid', 'report_id', 'reportid', 'patient_id'
    ]),
    roleCol: findHeader([
      'role_cod', 'role', 'role_code', 'drugcharacterization', 'suspect_role', 'drug_role'
    ]),
    dateCol: findHeader([
      'fda_dt', 'date', 'receiptdate', 'event_dt', 'rept_dt', 'quarter', 'report_date', 'year'
    ]),
    socCol: findHeader([
      'soc', 'system_organ_class', 'soc_name', 'organ_class', 'body_system'
    ]),
    ageCol: findHeader([
      'age', 'patientonsetage', 'patient_age', 'age_grp', 'patientage'
    ]),
    sexCol: findHeader([
      'sex', 'gender', 'patientsex', 'patient_sex'
    ]),
    seriousCol: findHeader([
      'serious', 'seriousness', 'is_serious', 'serious_adverse_event'
    ]),
    outcomeCol: findHeader([
      'outc_cod', 'outcome', 'seriousnessdeath', 'patient_outcome', 'severity'
    ]),
  };
}

/**
 * Parses raw text into headers and row matrix for the interactive column mapping UI
 */
export function parseFileToRawTable(text: string, delimiter: string = ',', fileName: string = 'data.csv'): RawParsedTable {
  const rows = parseCSVToRows(text, delimiter);
  if (rows.length < 1) {
    return { fileName, headers: [], sampleRows: [], totalRows: 0, allRows: [] };
  }

  const rawHeaders = rows[0] || [];
  // Ensure headers are non-empty strings and deduplicate
  const seenHeaders = new Map<string, number>();
  const headers = rawHeaders.map((h, idx) => {
    let name = (h && h.trim().length > 0) ? h.trim() : `Column_${idx + 1}`;
    if (seenHeaders.has(name)) {
      const count = seenHeaders.get(name)! + 1;
      seenHeaders.set(name, count);
      name = `${name}_${count}`;
    } else {
      seenHeaders.set(name, 1);
    }
    return name;
  });

  const allRows = rows.slice(1);

  return {
    fileName,
    headers,
    sampleRows: allRows.slice(0, 8),
    totalRows: allRows.length,
    allRows,
  };
}

/**
 * Converts a raw parsed table into FAERSRecord[] using user-defined column mappings
 */
export function convertRawTableToFAERSRecords(
  table: RawParsedTable,
  mapping: ColumnMappingConfig
): FAERSRecord[] {
  const { headers, allRows } = table;
  const colIndex = (name?: string) => (name ? headers.indexOf(name) : -1);

  const drugIdx = colIndex(mapping.drugCol);
  const eventIdx = colIndex(mapping.eventCol);
  const countIdx = colIndex(mapping.countCol);
  const substanceIdx = colIndex(mapping.substanceCol);
  const strataIdx = colIndex(mapping.strataCol);
  const caseIdIdx = colIndex(mapping.caseIdCol);
  const roleIdx = colIndex(mapping.roleCol);
  const dateIdx = colIndex(mapping.dateCol);
  const socIdx = colIndex(mapping.socCol);
  const ageIdx = colIndex(mapping.ageCol);
  const sexIdx = colIndex(mapping.sexCol);
  const seriousIdx = colIndex(mapping.seriousCol);
  const outcomeIdx = colIndex(mapping.outcomeCol);

  if (drugIdx === -1 || eventIdx === -1) {
    throw new Error('Both Product/Drug and Event/Outcome columns must be mapped.');
  }

  const records: FAERSRecord[] = [];

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row || !Array.isArray(row)) continue;

    let drugName = (row[drugIdx] || '').trim();
    if (!drugName && substanceIdx >= 0 && row[substanceIdx]) {
      drugName = row[substanceIdx].trim();
    }
    const preferredTerm = (row[eventIdx] || '').trim();
    if (!drugName || !preferredTerm) continue;

    // Report weight / count for aggregate tables
    let repeatCount = 1;
    if (countIdx >= 0 && row[countIdx]) {
      const parsedCount = parseInt(row[countIdx], 10);
      if (!isNaN(parsedCount) && parsedCount > 0) {
        repeatCount = Math.min(500, parsedCount);
      }
    }

    const baseCaseId = caseIdIdx >= 0 && row[caseIdIdx] && row[caseIdIdx].trim()
      ? row[caseIdIdx].trim()
      : `REPORT_${i + 1}`;

    // Role mapping
    let role: 'PS' | 'SS' | 'C' | 'I' = 'PS';
    if (roleIdx >= 0 && row[roleIdx]) {
      const rawRole = row[roleIdx].trim().toUpperCase();
      if (['PS', 'PRIMARY', '1', 'SUSPECT'].includes(rawRole)) role = 'PS';
      else if (['SS', 'SECONDARY', '2'].includes(rawRole)) role = 'SS';
      else if (['C', 'CONCOMITANT', 'CONCOMITANT DRUG', '3'].includes(rawRole)) role = 'C';
      else if (['I', 'INTERACTING', '4'].includes(rawRole)) role = 'I';
    }

    const soc = socIdx >= 0 && row[socIdx] && row[socIdx].trim()
      ? row[socIdx].trim()
      : 'General Disorders';

    // Date & Quarter
    let formattedDate = '2024-01-01';
    let quarter = '2024Q1';
    if (dateIdx >= 0 && row[dateIdx] && row[dateIdx].trim()) {
      const rawDate = row[dateIdx].trim();
      if (rawDate.includes('-') || rawDate.includes('/')) {
        formattedDate = rawDate.replace(/\//g, '-');
        const yr = formattedDate.substring(0, 4);
        const m = parseInt(formattedDate.substring(5, 7)) || 1;
        quarter = `${yr}Q${Math.ceil(m / 3)}`;
      } else if (rawDate.length === 8 && /^\d+$/.test(rawDate)) {
        // YYYYMMDD
        formattedDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
        const m = parseInt(rawDate.substring(4, 6)) || 1;
        quarter = `${rawDate.substring(0, 4)}Q${Math.ceil(m / 3)}`;
      } else if (rawDate.toUpperCase().includes('Q')) {
        quarter = rawDate.toUpperCase();
      } else if (/^\d{4}$/.test(rawDate)) {
        quarter = rawDate;
        formattedDate = `${rawDate}-01-01`;
      }
    }

    // Age
    let age: number | undefined;
    if (ageIdx >= 0 && row[ageIdx]) {
      const parsedAge = parseFloat(row[ageIdx]);
      if (!isNaN(parsedAge) && parsedAge >= 0 && parsedAge <= 125) {
        age = parsedAge;
      }
    }

    // Sex
    let sex: 'M' | 'F' | 'UNK' = 'UNK';
    if (sexIdx >= 0 && row[sexIdx]) {
      const s = row[sexIdx].trim().toUpperCase();
      if (['M', 'MALE', '1'].includes(s)) sex = 'M';
      else if (['F', 'FEMALE', '2'].includes(s)) sex = 'F';
    }

    // Seriousness & Outcomes
    let serious = false;
    if (seriousIdx >= 0 && row[seriousIdx]) {
      const ser = row[seriousIdx].trim().toLowerCase();
      serious = ['1', 'y', 'yes', 'true', 'serious'].includes(ser);
    }

    const outcomes: ('DE' | 'HO' | 'LT' | 'DS' | 'OT')[] = [];
    if (outcomeIdx >= 0 && row[outcomeIdx]) {
      const o = row[outcomeIdx].trim().toUpperCase();
      if (['DE', 'DEATH', 'FATAL'].includes(o)) {
        outcomes.push('DE');
        serious = true;
      } else if (['HO', 'HOSPITAL', 'HOSPITALIZATION'].includes(o)) {
        outcomes.push('HO');
        serious = true;
      } else if (['LT', 'LIFE-THREATENING'].includes(o)) {
        outcomes.push('LT');
        serious = true;
      } else if (['DS', 'DISABILITY'].includes(o)) {
        outcomes.push('DS');
        serious = true;
      } else if (serious) {
        outcomes.push('OT');
      }
    }

    for (let k = 0; k < repeatCount; k++) {
      const caseId = repeatCount > 1 ? `${baseCaseId}_${k + 1}` : baseCaseId;
      records.push({
        caseId,
        drugName,
        role,
        preferredTerm,
        systemOrganClass: soc,
        date: formattedDate,
        quarter,
        age,
        sex,
        serious,
        outcomes: outcomes.length > 0 ? outcomes : undefined,
      });
    }
  }

  return records;
}

/**
 * Direct parsing of delimited text to FAERSRecord[] with automatic column recognition
 */
export function parseDelimitedData(text: string, delimiter?: string, fileName: string = 'data.csv'): FAERSRecord[] {
  const rawTable = parseFileToRawTable(text, delimiter, fileName);
  if (rawTable.headers.length < 2 || rawTable.allRows.length === 0) {
    return [];
  }
  const mapping = autoDetectMapping(rawTable.headers);
  if (!mapping.drugCol || !mapping.eventCol) {
    return [];
  }
  return convertRawTableToFAERSRecords(rawTable, mapping);
}
