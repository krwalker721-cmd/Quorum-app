// Shared data shapes for the cinematic-scroll onboarding (v2). The orchestrator
// prefetches the user's cohort once and hands it down to the chapters that need
// it, so there is no loading flicker mid-scroll.

export interface CohortMember {
  id: string;
  full_name: string | null;
  stage: string | null;
  building: string | null;
}

export interface CohortData {
  members: CohortMember[];
  memberCount: number;
  cohortName: string | null;
}
