/**
 * Data Quality, Missingness & Deduplication Sanity Profiler
 * Analyzes surveillance datasets (FAERS & MAUDE) prior to disproportionality modeling.
 * Identifies duplicate cases based on composite clinical demographic signatures
 * and profiles missingness across age, sex, system organ classes, and outcomes.
 */

import { FAERSRecord } from '../types/vigipy';

export interface DataQualityProfile {
  totalRecords: number;
  uniqueCaseIds: number;
  potentialDuplicateCount: number;
  duplicateGroups: {
    signature: string;
    count: number;
    sampleCases: string[];
    drug: string;
    event: string;
  }[];
  missingness: {
    missingAgeCount: number;
    missingAgePct: number;
    missingSexCount: number;
    missingSexPct: number;
    unassignedSocCount: number;
    unassignedSocPct: number;
    missingDateCount: number;
    missingDatePct: number;
    noOutcomesCount: number;
    noOutcomesPct: number;
  };
  demographics: {
    maleCount: number;
    femaleCount: number;
    unkSexCount: number;
    meanAge: number | null;
    medianAge: number | null;
  };
  overallHygieneScore: number; // 0 to 100
}

export function profileDatasetQuality(records: FAERSRecord[]): DataQualityProfile {
  const total = records.length;
  if (total === 0) {
    return {
      totalRecords: 0,
      uniqueCaseIds: 0,
      potentialDuplicateCount: 0,
      duplicateGroups: [],
      missingness: {
        missingAgeCount: 0,
        missingAgePct: 0,
        missingSexCount: 0,
        missingSexPct: 0,
        unassignedSocCount: 0,
        unassignedSocPct: 0,
        missingDateCount: 0,
        missingDatePct: 0,
        noOutcomesCount: 0,
        noOutcomesPct: 0,
      },
      demographics: {
        maleCount: 0,
        femaleCount: 0,
        unkSexCount: 0,
        meanAge: null,
        medianAge: null,
      },
      overallHygieneScore: 100,
    };
  }

  const caseIds = new Set<string>();
  let missingAge = 0;
  let missingSex = 0;
  let unassignedSoc = 0;
  let missingDate = 0;
  let noOutcomes = 0;
  let male = 0;
  let female = 0;
  let unkSex = 0;
  const ages: number[] = [];

  // Group for potential duplicates: signature = [date, age_bucket, sex, drug_normalized, pt_normalized]
  const sigMap = new Map<string, { count: number; sampleCases: string[]; drug: string; event: string }>();

  records.forEach((r) => {
    caseIds.add(r.caseId);

    if (r.age === undefined || r.age === null || isNaN(r.age)) {
      missingAge++;
    } else {
      ages.push(r.age);
    }

    if (!r.sex || r.sex === 'UNK') {
      missingSex++;
      unkSex++;
    } else if (r.sex === 'M') {
      male++;
    } else if (r.sex === 'F') {
      female++;
    }

    if (!r.systemOrganClass || r.systemOrganClass.trim().length === 0 || r.systemOrganClass === 'General Disorders' || r.systemOrganClass.toLowerCase().includes('unknown')) {
      unassignedSoc++;
    }

    if (!r.date || r.date === '2024-01-01' || r.date === '2023-01-01') {
      missingDate++;
    }

    if (!r.outcomes || r.outcomes.length === 0) {
      noOutcomes++;
    }

    // Duplicate detection signature
    const ageBucket = r.age ? Math.floor(r.age / 5) * 5 : 'UNK';
    const drugNorm = (r.drugName || '').trim().toUpperCase();
    const eventNorm = (r.preferredTerm || '').trim().toUpperCase();
    const dateStr = r.date || 'NODATE';
    const sexStr = r.sex || 'UNK';

    const sig = `${dateStr}__${ageBucket}__${sexStr}__${drugNorm}__${eventNorm}`;
    const existing = sigMap.get(sig);
    if (!existing) {
      sigMap.set(sig, {
        count: 1,
        sampleCases: [r.caseId],
        drug: r.drugName,
        event: r.preferredTerm,
      });
    } else {
      existing.count++;
      if (existing.sampleCases.length < 5 && !existing.sampleCases.includes(r.caseId)) {
        existing.sampleCases.push(r.caseId);
      }
    }
  });

  const duplicateGroups: DataQualityProfile['duplicateGroups'] = [];
  let potentialDuplicateCount = 0;

  sigMap.forEach((val, key) => {
    if (val.count > 1) {
      potentialDuplicateCount += val.count - 1;
      duplicateGroups.push({
        signature: key,
        count: val.count,
        sampleCases: val.sampleCases,
        drug: val.drug,
        event: val.event,
      });
    }
  });

  duplicateGroups.sort((a, b) => b.count - a.count);

  ages.sort((a, b) => a - b);
  const meanAge = ages.length > 0 ? Number((ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1)) : null;
  const medianAge = ages.length > 0 ? ages[Math.floor(ages.length / 2)] : null;

  // Penalize missingness and duplicates
  const dupPenalty = Math.min(30, (potentialDuplicateCount / total) * 100);
  const agePenalty = Math.min(25, (missingAge / total) * 30);
  const sexPenalty = Math.min(15, (missingSex / total) * 20);
  const socPenalty = Math.min(20, (unassignedSoc / total) * 25);
  const hygieneScore = Math.max(10, Math.round(100 - dupPenalty - agePenalty - sexPenalty - socPenalty));

  return {
    totalRecords: total,
    uniqueCaseIds: caseIds.size,
    potentialDuplicateCount,
    duplicateGroups: duplicateGroups.slice(0, 15),
    missingness: {
      missingAgeCount: missingAge,
      missingAgePct: Number(((missingAge / total) * 100).toFixed(1)),
      missingSexCount: missingSex,
      missingSexPct: Number(((missingSex / total) * 100).toFixed(1)),
      unassignedSocCount: unassignedSoc,
      unassignedSocPct: Number(((unassignedSoc / total) * 100).toFixed(1)),
      missingDateCount: missingDate,
      missingDatePct: Number(((missingDate / total) * 100).toFixed(1)),
      noOutcomesCount: noOutcomes,
      noOutcomesPct: Number(((noOutcomes / total) * 100).toFixed(1)),
    },
    demographics: {
      maleCount: male,
      femaleCount: female,
      unkSexCount: unkSex,
      meanAge,
      medianAge,
    },
    overallHygieneScore: hygieneScore,
  };
}

/**
 * Deduplicates records using identical caseId or identical clinical demographic signatures
 */
export function deduplicateRecords(records: FAERSRecord[]): {
  cleaned: FAERSRecord[];
  duplicatesRemoved: number;
} {
  const seenIds = new Set<string>();
  const seenSigs = new Set<string>();
  const cleaned: FAERSRecord[] = [];

  records.forEach((r) => {
    // Check caseId
    if (r.caseId && seenIds.has(r.caseId)) return;
    if (r.caseId) seenIds.add(r.caseId);

    // Check composite signature
    const ageBucket = r.age ? Math.floor(r.age / 5) * 5 : 'UNK';
    const drugNorm = (r.drugName || '').trim().toUpperCase();
    const eventNorm = (r.preferredTerm || '').trim().toUpperCase();
    const sig = `${r.date}__${ageBucket}__${r.sex}__${drugNorm}__${eventNorm}`;

    if (seenSigs.has(sig)) return;
    seenSigs.add(sig);

    cleaned.push(r);
  });

  return {
    cleaned,
    duplicatesRemoved: records.length - cleaned.length,
  };
}
