/**
 * openFDA Live Data Ingestion Engine
 * Queries official FDA APIs:
 * - FDA Adverse Event Reporting System (FAERS) for drugs & therapeutics: /drug/event.json
 * - Manufacturer and User Facility Device Experience (MAUDE) for medical devices: /device/event.json
 * Supports multi-page batch streaming and normalizes records into structured pharmacovigilance rows.
 */

export interface OpenFDARecord {
  caseId: string;
  drugName: string;
  role: string;
  preferredTerm: string;
  systemOrganClass?: string;
  date: string;
  quarter: string;
  age?: number;
  sex?: string;
  country?: string;
  serious: boolean;
}

export interface OpenFDAQueryOptions {
  mode?: "drug" | "device";
  drugName?: string;
  reaction?: string;
  limit?: number;
  skip?: number;
  dateStart?: string;
  dateEnd?: string;
  onProgress?: (fetched: number, total: number) => void;
}

export async function fetchOpenFDAReports(
  options: OpenFDAQueryOptions
): Promise<{ records: OpenFDARecord[]; totalFound: number }> {
  const mode = options.mode || "device";
  if (mode === "device") {
    return fetchOpenFDADeviceReports(options);
  } else {
    return fetchOpenFDADrugReports(options);
  }
}

async function fetchOpenFDADrugReports(
  options: OpenFDAQueryOptions
): Promise<{ records: OpenFDARecord[]; totalFound: number }> {
  const { drugName, reaction, limit = 100, dateStart, dateEnd, onProgress } = options;

  const searchClauses: string[] = [];

  if (drugName && drugName.trim().length > 0) {
    const cleanedDrug = drugName.trim().replace(/["\\]/g, "");
    searchClauses.push(
      `(patient.drug.medicinalproduct:"${cleanedDrug}"+patient.drug.openfda.substancename:"${cleanedDrug}"+patient.drug.openfda.brand_name:"${cleanedDrug}")`
    );
  }

  if (reaction && reaction.trim().length > 0) {
    const cleanedReac = reaction.trim().replace(/["\\]/g, "");
    searchClauses.push(`patient.reaction.reactionmeddrapt:"${cleanedReac}"`);
  }

  if (dateStart && dateEnd) {
    const dStart = dateStart.replace(/-/g, "");
    const dEnd = dateEnd.replace(/-/g, "");
    searchClauses.push(`receivedate:[${dStart}+TO+${dEnd}]`);
  }

  const searchQuery = searchClauses.length > 0 ? `&search=${searchClauses.join("+AND+")}` : "";
  const targetTotal = Math.min(Math.max(limit, 10), 1000);
  const pageSize = Math.min(targetTotal, 100);

  let currentSkip = options.skip || 0;
  let totalFound = 0;
  const allRecords: OpenFDARecord[] = [];

  while (allRecords.length < targetTotal) {
    const fetchLimit = Math.min(pageSize, targetTotal - allRecords.length);
    const url = `https://api.fda.gov/drug/event.json?limit=${fetchLimit}&skip=${currentSkip}${searchQuery}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) break;
        throw new Error(`openFDA Drug API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      totalFound = data.meta?.results?.total || totalFound;
      const rawResults = data.results || [];
      if (rawResults.length === 0) break;

      for (let i = 0; i < rawResults.length; i++) {
        const item = rawResults[i];
        const caseId = item.safetyreportid || `FDA_DRUG_${Date.now()}_${i}`;
        const receiveDate = item.receiptdate || item.receivedate || "20230101";
        const year = receiveDate.substring(0, 4);
        const month = receiveDate.substring(4, 6) || "01";
        const day = receiveDate.substring(6, 8) || "01";
        const formattedDate = `${year}-${month}-${day}`;
        const quarterNum = Math.max(1, Math.min(4, Math.ceil(parseInt(month, 10) / 3)));
        const quarter = `${year}Q${quarterNum}`;

        const patient = item.patient || {};
        const age = patient.patientonsetage ? Math.round(parseFloat(patient.patientonsetage)) : undefined;
        const sexNum = patient.patientsex;
        const sex = sexNum === "1" ? "M" : sexNum === "2" ? "F" : "UNK";
        const isSerious = item.serious === "1";

        const drugs = patient.drug || [];
        const reactions = patient.reaction || [];

        for (const d of drugs) {
          const dName = (
            d.medicinalproduct ||
            d.openfda?.brand_name?.[0] ||
            d.openfda?.substancename?.[0] ||
            "Unknown Drug"
          ).trim();

          let role = "C";
          if (d.drugcharacterization === "1") role = "PS";
          else if (d.drugcharacterization === "2") role = "SS";

          for (const r of reactions) {
            const pt = r.reactionmeddrapt || "Unspecified Event";
            allRecords.push({
              caseId,
              drugName: dName.toUpperCase(),
              role,
              preferredTerm: pt,
              systemOrganClass: "openFDA MedDRA PT",
              date: formattedDate,
              quarter,
              age,
              sex,
              country: item.reportercountry || "US",
              serious: isSerious,
            });
          }
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

async function fetchOpenFDADeviceReports(
  options: OpenFDAQueryOptions
): Promise<{ records: OpenFDARecord[]; totalFound: number }> {
  const { drugName: deviceQuery, reaction: problemQuery, limit = 100, dateStart, dateEnd, onProgress } = options;

  const searchClauses: string[] = [];

  if (deviceQuery && deviceQuery.trim().length > 0) {
    const cleaned = deviceQuery.trim().replace(/["\\]/g, "");
    searchClauses.push(
      `(device.brand_name:"${cleaned}"+device.generic_name:"${cleaned}"+device.manufacturer_d_name:"${cleaned}")`
    );
  }

  if (problemQuery && problemQuery.trim().length > 0) {
    const cleaned = problemQuery.trim().replace(/["\\]/g, "");
    searchClauses.push(`(event_type:"${cleaned}"+mdr_text.text:"${cleaned}")`);
  }

  if (dateStart && dateEnd) {
    const dStart = dateStart.replace(/-/g, "");
    const dEnd = dateEnd.replace(/-/g, "");
    searchClauses.push(`date_received:[${dStart}+TO+${dEnd}]`);
  }

  const searchQuery = searchClauses.length > 0 ? `&search=${searchClauses.join("+AND+")}` : "";
  const targetTotal = Math.min(Math.max(limit, 10), 1000);
  const pageSize = Math.min(targetTotal, 100);

  let currentSkip = options.skip || 0;
  let totalFound = 0;
  const allRecords: OpenFDARecord[] = [];

  while (allRecords.length < targetTotal) {
    const fetchLimit = Math.min(pageSize, targetTotal - allRecords.length);
    const url = `https://api.fda.gov/device/event.json?limit=${fetchLimit}&skip=${currentSkip}${searchQuery}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) break;
        throw new Error(`openFDA Device API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      totalFound = data.meta?.results?.total || totalFound;
      const rawResults = data.results || [];
      if (rawResults.length === 0) break;

      for (let i = 0; i < rawResults.length; i++) {
        const item = rawResults[i];
        const caseId = item.mdr_report_key || item.report_number || `MAUDE_${Date.now()}_${i}`;
        const rawDate = item.date_received || item.date_of_event || "20230101";
        const year = rawDate.substring(0, 4) || "2023";
        const month = rawDate.substring(4, 6) || "01";
        const day = rawDate.substring(6, 8) || "01";
        const formattedDate = `${year}-${month}-${day}`;
        const quarterNum = Math.max(1, Math.min(4, Math.ceil(parseInt(month, 10) / 3)));
        const quarter = `${year}Q${quarterNum}`;

        const patient = item.patient?.[0] || {};
        const age = patient.patient_age_in_years ? Math.round(parseFloat(patient.patient_age_in_years)) : undefined;
        const sex = patient.patient_sex === "M" || patient.patient_sex === "1" ? "M" : patient.patient_sex === "F" || patient.patient_sex === "2" ? "F" : "UNK";

        const eventType = item.event_type || "Malfunction";
        const isSerious = eventType === "Death" || eventType === "Injury";

        const devices = item.device || [];
        for (const d of devices) {
          const deviceName = (
            d.brand_name ||
            d.generic_name ||
            d.manufacturer_d_name ||
            d.openfda?.device_name ||
            "Medical Device"
          ).trim();

          const specialty = d.openfda?.medical_specialty_description || "Medical Device Specialty";
          const problem = d.device_problem_code || (eventType ? `${eventType} Incident` : "Device Malfunction");

          allRecords.push({
            caseId,
            drugName: deviceName.toUpperCase(),
            role: "PS",
            preferredTerm: problem,
            systemOrganClass: specialty,
            date: formattedDate,
            quarter,
            age,
            sex,
            country: "US",
            serious: isSerious,
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
