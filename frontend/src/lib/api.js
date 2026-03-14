/**
 * NuvoVet API Client
 *
 * All requests go to the FastAPI backend at VITE_API_URL.
 * Callers receive null when the backend is unreachable.
 *
 * Environment variable:
 *   VITE_API_URL  (default: http://localhost:8000)
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'https://nuvovet-systems.onrender.com';

async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${text}`);
    }
    return res.json();
  } catch (err) {
    // Surface in dev, swallow in prod so the UI can fall back gracefully
    if (import.meta.env.DEV) console.warn(`[NuvoVet API] ${url}`, err.message);
    return null;
  }
}

// ── Drug search ───────────────────────────────────────────────────

/**
 * Search drugs from the backend.
 * @param {string} query
 * @param {string|null} species  'dog' | 'cat' | null
 * @param {number} limit
 * @returns {Promise<Array>}  Array of Drug objects (frontend contract)
 */
export async function searchDrugsApi(query, species = null, limit = 20) {
  if (!query || query.trim().length < 1) return [];
  const params = new URLSearchParams({ q: query.trim(), limit });
  if (species) params.set('species', species);
  const data = await apiFetch(`/api/drugs/search?${params}`);
  return data?.results ?? null;
}

/**
 * Fetch a single drug by ID.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getDrugByIdApi(id) {
  if (!id) return null;
  return apiFetch(`/api/drugs/${encodeURIComponent(id)}`);
}

/**
 * Fetch a page of drugs with optional class/source filter.
 * Default limit is 20 (initial load); call again with offset to paginate.
 * @param {object} options
 * @returns {Promise<{results: Array, total: number}>}
 */
export async function listDrugsApi({ drugClass, source, limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit, offset });
  if (drugClass) params.set('drug_class', drugClass);
  if (source) params.set('source', source);
  return apiFetch(`/api/drugs?${params}`);
}

// ── Breed / Condition / Allergy lists ────────────────────────────

/**
 * Fetch all breeds from the drug database genetic_sensitivity data.
 * @param {'dog'|'cat'|null} species
 * @returns {Promise<Array<{breed: string, mdr1: boolean}>>}
 */
export async function getBreedsApi(species = null) {
  const params = new URLSearchParams();
  if (species) params.set('species', species);
  const data = await apiFetch(`/api/breeds?${params}`);
  return data?.breeds ?? [];
}

/**
 * Fetch all condition match_terms from the drug contraindications data.
 * @returns {Promise<string[]>}
 */
export async function getConditionsApi() {
  const data = await apiFetch('/api/conditions');
  return data?.conditions ?? [];
}

/**
 * Fetch all allergy classes from the drug identity data.
 * @returns {Promise<string[]>}
 */
export async function getAllergiesApi() {
  const data = await apiFetch('/api/allergies');
  return data?.allergies ?? [];
}

/**
 * Send an EMR screenshot to the backend for patient data extraction via Claude vision.
 * @param {File} imageFile
 * @returns {Promise<object|null>}  Extracted patient data object, or null on failure
 */
export async function extractPatientFromImageApi(imageFile) {
  const url = `${BASE_URL}/api/ocr/extract-patient`;
  const formData = new FormData();
  formData.append('image', imageFile);
  try {
    const res = await fetch(url, { method: 'POST', body: formData });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${text}`);
    }
    const data = await res.json();
    return data?.data ?? null;
  } catch (err) {
    if (import.meta.env.DEV) console.warn(`[NuvoVet API] OCR extract`, err.message);
    return null;
  }
}

// ── Health check ─────────────────────────────────────────────────

/**
 * Check backend availability with a 2-second timeout.
 * @returns {Promise<boolean>}
 */
export async function isBackendAvailable() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);
  try {
    const url = `${BASE_URL}/api/health`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return false;
    const data = await res.json();
    return data?.status === 'ok';
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}
