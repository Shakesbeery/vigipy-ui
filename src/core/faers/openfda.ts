/**
 * openFDA Live Data Ingestion Engine
 * Queries official FDA APIs:
 * - FDA Adverse Event Reporting System (FAERS) for drugs & therapeutics: /drug/event.json
 * - Manufacturer and User Facility Device Experience (MAUDE) for medical devices: /device/event.json
 * Supports multi-page batch streaming and normalizes records into typed FAERSRecords.
 */

import { FAERSRecord } from '../../types/vigipy';

export interface OpenFDAQueryOptions {
  mode?: 'drug' | 'device';
  drugName?: string; // Drug substance or device brand name
  reaction?: string; // Reaction MedDRA PT or device problem
  limit?: number; // Total records to fetch (can paginate up to 500)
  skip?: number;
  dateStart?: string;
  dateEnd?: string;
  onProgress?: (fetched: number, total: number) => void;
}

export async function fetchOpenFDAReports(
  options: OpenFDAQueryOptions
): Promise<{ records: FAERSRecord[]; totalFound: number }> {
  const mode = options.mode || 'device';
  if (options.mode === 'device') {
    return fetchOpenFDADeviceReports(options);
  } else {
    return fetchOpenFDADrugReports(options);
  }
}

/**
 * Fetch Drug Adverse Events from FDA FAERS (/drug/event.json)
 */
async function fetchOpenFDADrugReports(
  options: OpenFDAQueryOptions
): Promise<{ records: FAERSRecord[]; totalFound: number }> {
  const { drugName, reaction, limit = 100, dateStart, dateEnd, onProgress } = options;

  const searchClauses: string[] = [];

  if (drugName && drugName.trim().length > 0) {
    const cleanedDrug = drugName.trim().replace(/["\\]/g, '');
    searchClauses.push(
      `(patient.drug.medicinalproduct:"${cleanedDrug}"+patient.drug.openfda.substancename:"${cleanedDrug}"+patient.drug.openfda.brand_name:"${cleanedDrug}")`
    );
  }

  if (reaction && reaction.trim().length > 0) {
    const cleanedReac = reaction.trim().replace(/["\\]/g, '');
    searchClauses.push(`patient.reaction.reactionmeddrapt:"${cleanedReac}"`);
  }

  if (dateStart && dateEnd) {
    const dStart = dateStart.replace(/-/g, '');
    const dEnd = dateEnd.replace(/-/g, '');
    searchClauses.push(`receivedate:[${dStart}+TO+${dEnd}]`);
  }

  const searchQuery = searchClauses.length > 0 ? `&search=${searchClauses.join('+AND+')}` : '';
  const targetTotal = Math.min(Math.max(limit, 10), 1000);
  const pageSize = Math.min(targetTotal, 100);

  let currentSkip = options.skip || 0;
  let totalFound = 0;
  const allRecords: FAERSRecord[] = [];

  while (allRecords.length < targetTotal) {
    const fetchLimit = Math.min(pageSize, targetTotal - allRecords.length);
    const url = `https://api.fda.gov/drug/event.json?limit=${fetchLimit}&skip=${currentSkip}${searchQuery}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) {
          break;
        }
        throw new Error(`openFDA Drug API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      totalFound = data.meta?.results?.total || totalFound;
      const rawResults = data.results || [];
      if (rawResults.length === 0) break;

      for (let i = 0; i < rawResults.length; i++) {
        const item = rawResults[i];
        const caseId = item.safetyreportid || `FDA_DRUG_${Date.now()}_${i}`;
        const receiveDate = item.receiptdate || item.receivedate || '20230101';
        const year = receiveDate.substring(0, 4);
        const month = receiveDate.substring(4, 6) || '01';
        const day = receiveDate.substring(6, 8) || '01';
        const formattedDate = `${year}-${month}-${day}`;
        const quarterNum = Math.max(1, Math.min(4, Math.ceil(parseInt(month, 10) / 3)));
        const quarter = `${year}Q${quarterNum}`;

        const patient = item.patient || {};
        const age = patient.patientonsetage ? Math.round(parseFloat(patient.patientonsetage)) : undefined;
        const sexNum = patient.patientsex;
        const sex = sexNum === '1' ? 'M' : sexNum === '2' ? 'F' : 'UNK';

        const isSerious = item.serious === '1';
        const outcomes: ('DE' | 'HO' | 'LT' | 'DS' | 'OT')[] = [];
        if (item.seriousnessdeath === '1') outcomes.push('DE');
        if (item.seriousnesshospitalization === '1') outcomes.push('HO');
        if (item.seriousnesslifethreatening === '1') outcomes.push('LT');
        if (item.seriousnessdisabling === '1') outcomes.push('DS');
        if (isSerious && outcomes.length === 0) outcomes.push('OT');

        const drugs = patient.drug || [];
        const reactions = patient.reaction || [];

        for (const d of drugs) {
          const dName = (
            d.medicinalproduct ||
            d.openfda?.brand_name?.[0] ||
            d.openfda?.substancename?.[0] ||
            'Unknown Drug'
          ).trim();

          let role: 'PS' | 'SS' | 'C' | 'I' = 'C';
          if (d.drugcharacterization === '1') role = 'PS';
          else if (d.drugcharacterization === '2') role = 'C';
          else if (d.drugcharacterization === '3') role = 'I';

          for (const r of reactions) {
            const pt = r.reactionmeddrapt || 'Unspecified Event';
            allRecords.push({
              caseId,
              drugName: dName.toUpperCase(),
              role,
              preferredTerm: pt,
              systemOrganClass: 'openFDA MedDRA PT',
              date: formattedDate,
              quarter,
              age,
              sex,
              country: item.reportercountry || 'US',
              serious: isSerious,
              outcomes: outcomes.length > 0 ? outcomes : undefined,
            });
          }
        }
      }

      currentSkip += rawResults.length;
      onProgress?.(allRecords.length, totalFound);

      // If fewer items returned than limit, we reached the end of the query results
      if (rawResults.length < fetchLimit) break;
    } catch (err: any) {
      if (allRecords.length > 0) {
        // Return whatever partial batch was successfully fetched
        break;
      }
      throw err;
    }
  }

  return { records: allRecords, totalFound };
}

/**
 * Fetch Medical Device Adverse Events from FDA MAUDE (/device/event.json)
 */
async function fetchOpenFDADeviceReports(
  options: OpenFDAQueryOptions
): Promise<{ records: FAERSRecord[]; totalFound: number }> {
  const { drugName: deviceQuery, reaction: problemQuery, limit = 100, dateStart, dateEnd, onProgress } = options;

  const searchClauses: string[] = [];

  if (deviceQuery && deviceQuery.trim().length > 0) {
    const cleaned = deviceQuery.trim().replace(/["\\]/g, '');
    searchClauses.push(
      `(device.brand_name:"${cleaned}"+device.generic_name:"${cleaned}"+device.manufacturer_d_name:"${cleaned}")`
    );
  }

  if (problemQuery && problemQuery.trim().length > 0) {
    const cleaned = problemQuery.trim().replace(/["\\]/g, '');
    searchClauses.push(`(event_type:"${cleaned}"+mdr_text.text:"${cleaned}")`);
  }

  if (dateStart && dateEnd) {
    const dStart = dateStart.replace(/-/g, '');
    const dEnd = dateEnd.replace(/-/g, '');
    searchClauses.push(`date_received:[${dStart}+TO+${dEnd}]`);
  }

  const searchQuery = searchClauses.length > 0 ? `&search=${searchClauses.join('+AND+')}` : '';
  const targetTotal = Math.min(Math.max(limit, 10), 1000);
  const pageSize = Math.min(targetTotal, 100);

  let currentSkip = options.skip || 0;
  let totalFound = 0;
  const allRecords: FAERSRecord[] = [];

  while (allRecords.length < targetTotal) {
    const fetchLimit = Math.min(pageSize, targetTotal - allRecords.length);
    const url = `https://api.fda.gov/device/event.json?limit=${fetchLimit}&skip=${currentSkip}${searchQuery}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) {
          break;
        }
        throw new Error(`openFDA Device API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      totalFound = data.meta?.results?.total || totalFound;
      const rawResults = data.results || [];
      if (rawResults.length === 0) break;

      for (let i = 0; i < rawResults.length; i++) {
        const item = rawResults[i];
        const caseId = item.mdr_report_key || item.report_number || `MAUDE_${Date.now()}_${i}`;
        const rawDate = item.date_received || item.date_of_event || '20230101';
        const year = rawDate.substring(0, 4) || '2023';
        const month = rawDate.substring(4, 6) || '01';
        const day = rawDate.substring(6, 8) || '01';
        const formattedDate = `${year}-${month}-${day}`;
        const quarterNum = Math.max(1, Math.min(4, Math.ceil(parseInt(month, 10) / 3)));
        const quarter = `${year}Q${quarterNum}`;

        // Patient info in device reports
        const patient = item.patient?.[0] || {};
        const age = patient.patient_age_in_years ? Math.round(parseFloat(patient.patient_age_in_years)) : undefined;
        const sex = patient.patient_sex === 'M' || patient.patient_sex === '1' ? 'M' : patient.patient_sex === 'F' || patient.patient_sex === '2' ? 'F' : 'UNK';

        // Device event type: Malfunction, Injury, Death, Other
        const eventType = item.event_type || 'Malfunction';
        const isSerious = eventType === 'Death' || eventType === 'Injury' || Boolean(item.adverse_event_flag);

        const outcomes: ('DE' | 'HO' | 'LT' | 'DS' | 'OT')[] = [];
        if (eventType === 'Death') outcomes.push('DE');
        else if (eventType === 'Injury') outcomes.push('HO');
        else outcomes.push('OT');

        const devices = item.device || [];
        for (const d of devices) {
          const deviceName = (
            d.brand_name ||
            d.generic_name ||
            d.manufacturer_d_name ||
            d.openfda?.device_name ||
            'Medical Device'
          ).trim();

          const specialty = d.openfda?.medical_specialty_description || 'Medical Device Speciality';

          // Device problem / outcome term
          const problem =
            d.device_problem_code ||
            (eventType ? `${eventType} (${d.brand_name ? 'Device Incident' : 'Failure'})` : 'Device Malfunction');

          allRecords.push({
            caseId,
            drugName: deviceName.toUpperCase(),
            role: 'PS', // Primary Suspect Device
            preferredTerm: problem,
            systemOrganClass: specialty,
            date: formattedDate,
            quarter,
            age,
            sex,
            country: 'US',
            serious: isSerious,
            outcomes,
          });
        }
      }

      currentSkip += rawResults.length;
      onProgress?.(allRecords.length, totalFound);

      if (rawResults.length < fetchLimit) break;
    } catch (err: any) {
      if (allRecords.length > 0) break;
      throw err;
    }
  }

  return { records: allRecords, totalFound };
}
