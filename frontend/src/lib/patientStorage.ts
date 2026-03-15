/**
 * Patient Profile Storage
 *
 * Manages patient profiles in localStorage under the key 'nuvovet_patients'.
 * Each profile conforms to the PatientProfile interface below.
 *
 * TODO: Migrate to backend API for persistence across devices and sessions.
 *       See docs/cleanup_log.md for details.
 */

const STORAGE_KEY = 'nuvovet_patients';

export interface VisitRecord {
  date: string;         // ISO 8601
  drugs: string[];      // drug_id[]
  dur_summary: string;  // overall_risk value from DUR result
}

export interface PatientProfile {
  id: string;
  name: string;
  owner_phone: string | null;
  species: 'dog' | 'cat';
  breed: string | null;
  weight_kg: number | null;
  sex: string | null;
  age_years: number | null;
  allergies: string[];
  conditions: string[];
  creatinine_mg_dL: number | null;
  alt_u_L: number | null;
  created_at: string;   // ISO 8601
  updated_at: string;   // ISO 8601
  visit_history: VisitRecord[];
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function readAll(): PatientProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(profiles: PatientProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // localStorage quota exceeded or unavailable
  }
}

export function getAllPatients(): PatientProfile[] {
  return readAll();
}

export function searchPatients(query: string): PatientProfile[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return readAll().filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.owner_phone ?? '').toLowerCase().includes(q),
  );
}

export function getPatientById(id: string): PatientProfile | null {
  return readAll().find((p) => p.id === id) ?? null;
}

export function savePatient(
  partial: Omit<PatientProfile, 'id' | 'created_at' | 'updated_at' | 'visit_history'> & {
    id?: string;
    visit_history?: VisitRecord[];
  },
): PatientProfile {
  const all = readAll();
  const now = new Date().toISOString();

  if (partial.id) {
    // Update existing
    const idx = all.findIndex((p) => p.id === partial.id);
    if (idx >= 0) {
      const updated: PatientProfile = {
        ...all[idx],
        ...partial,
        id: all[idx].id,
        created_at: all[idx].created_at,
        updated_at: now,
        visit_history: partial.visit_history ?? all[idx].visit_history,
      };
      all[idx] = updated;
      writeAll(all);
      return updated;
    }
  }

  // Create new
  const profile: PatientProfile = {
    id: partial.id ?? generateId(),
    name: partial.name,
    owner_phone: partial.owner_phone ?? null,
    species: partial.species,
    breed: partial.breed ?? null,
    weight_kg: partial.weight_kg ?? null,
    sex: partial.sex ?? null,
    age_years: partial.age_years ?? null,
    allergies: partial.allergies ?? [],
    conditions: partial.conditions ?? [],
    creatinine_mg_dL: partial.creatinine_mg_dL ?? null,
    alt_u_L: partial.alt_u_L ?? null,
    created_at: now,
    updated_at: now,
    visit_history: partial.visit_history ?? [],
  };

  all.unshift(profile);
  writeAll(all);
  return profile;
}

export function addVisitRecord(
  patientId: string,
  visit: VisitRecord,
): PatientProfile | null {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === patientId);
  if (idx < 0) return null;

  const updated: PatientProfile = {
    ...all[idx],
    updated_at: new Date().toISOString(),
    visit_history: [visit, ...all[idx].visit_history],
  };
  all[idx] = updated;
  writeAll(all);
  return updated;
}

export function deletePatient(id: string): void {
  const all = readAll().filter((p) => p.id !== id);
  writeAll(all);
}

export function sortPatients(
  profiles: PatientProfile[],
  by: 'last_visit' | 'name' | 'species',
): PatientProfile[] {
  return [...profiles].sort((a, b) => {
    if (by === 'name') return a.name.localeCompare(b.name);
    if (by === 'species') return a.species.localeCompare(b.species);
    // last_visit (default)
    const aDate = a.visit_history[0]?.date ?? a.updated_at;
    const bDate = b.visit_history[0]?.date ?? b.updated_at;
    return bDate.localeCompare(aDate);
  });
}
