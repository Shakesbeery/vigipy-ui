/**
 * In-memory Subsetting and Cohort Slicing Engine for FAERS datasets.
 * Performs fast vectorized filtration to handle entire databases or focused cohorts.
 */

import { CohortFilter, FAERSRecord } from '../../types/vigipy';

export const DEFAULT_FILTER: CohortFilter = {
  targetDrugs: [],
  targetEvents: [],
  roles: ['PS', 'SS', 'C', 'I'],
  dateStart: '',
  dateEnd: '',
  quarters: [],
  ageMin: undefined,
  ageMax: undefined,
  sex: ['M', 'F', 'UNK'],
  seriousOnly: false,
  outcomes: [],
  minReportCount: 3,
  searchQuery: '',
};

export function filterFAERSData(records: FAERSRecord[], filter: CohortFilter): FAERSRecord[] {
  if (!records || records.length === 0) return [];

  const hasTargetDrugs = filter.targetDrugs.length > 0;
  const targetDrugSet = new Set(filter.targetDrugs.map((d) => d.toLowerCase()));

  const hasTargetEvents = filter.targetEvents.length > 0;
  const targetEventSet = new Set(filter.targetEvents.map((e) => e.toLowerCase()));

  const rolesSet = new Set(filter.roles);
  const sexSet = new Set(filter.sex);
  const quartersSet = filter.quarters.length > 0 ? new Set(filter.quarters) : null;
  const outcomesSet = filter.outcomes.length > 0 ? new Set(filter.outcomes) : null;

  const query = filter.searchQuery ? filter.searchQuery.trim().toLowerCase() : '';

  return records.filter((r) => {
    // Drug filter
    if (hasTargetDrugs && !targetDrugSet.has(r.drugName.toLowerCase())) {
      return false;
    }

    // Event filter
    if (hasTargetEvents && !targetEventSet.has(r.preferredTerm.toLowerCase())) {
      return false;
    }

    // Role filter
    if (r.role && !rolesSet.has(r.role)) {
      return false;
    }

    // Sex filter
    if (r.sex && !sexSet.has(r.sex)) {
      return false;
    }

    // Age bounds
    if (filter.ageMin !== undefined && r.age !== undefined && r.age < filter.ageMin) {
      return false;
    }
    if (filter.ageMax !== undefined && r.age !== undefined && r.age > filter.ageMax) {
      return false;
    }

    // Serious only
    if (filter.seriousOnly && !r.serious) {
      return false;
    }

    // Specific outcomes (Death, Hospitalization, etc.)
    if (outcomesSet && outcomesSet.size > 0) {
      if (!r.outcomes || !r.outcomes.some((o) => outcomesSet.has(o))) {
        return false;
      }
    }

    // Quarter filter
    if (quartersSet && quartersSet.size > 0 && r.quarter && !quartersSet.has(r.quarter)) {
      return false;
    }

    // Date range
    if (filter.dateStart && r.date < filter.dateStart) {
      return false;
    }
    if (filter.dateEnd && r.date > filter.dateEnd) {
      return false;
    }

    // Search query on drug or event or SOC
    if (query) {
      const match =
        r.drugName.toLowerCase().includes(query) ||
        r.preferredTerm.toLowerCase().includes(query) ||
        r.systemOrganClass.toLowerCase().includes(query) ||
        r.caseId.toLowerCase().includes(query);
      if (!match) return false;
    }

    return true;
  });
}
