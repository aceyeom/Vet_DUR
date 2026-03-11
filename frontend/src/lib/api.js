/**
 * NuvoVet API Client
 *
 * All requests go to the FastAPI backend at VITE_API_URL.
 * Falls back gracefully when the backend is unreachable — callers
 * receive null / empty arrays so the UI can degrade to local data.
 *
 * Environment variable:
 *   VITE_API_URL  (default: http://localhost:8000)
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
  return data?.results ?? [];
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
 * @param {object} options
 * @returns {Promise<{results: Array, total: number}>}
 */
export async function listDrugsApi({ drugClass, source, limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit, offset });
  if (drugClass) params.set('drug_class', drugClass);
  if (source) params.set('source', source);
  const data = await apiFetch(`/api/drugs?${params}`);
  return data ?? { results: [], total: 0 };
}

// ── DUR Analysis ─────────────────────────────────────────────────

/**
 * Run server-side DUR analysis.
 * The client-side durEngine.js is the primary path; this is a
 * secondary/validation endpoint.
 *
 * @param {Array}  drugs       Array of Drug objects
 * @param {string} species     'dog' | 'cat'
 * @param {number} weightKg
 * @param {object} patientInfo Patient context (conditions, labs, etc.)
 * @returns {Promise<object|null>}
 */
export async function analyzeDurApi(drugs, species, weightKg, patientInfo = {}) {
  return apiFetch('/api/dur/analyze', {
    method: 'POST',
    body: JSON.stringify({ drugs, species, weightKg, patientInfo }),
  });
}

// ── Health check ─────────────────────────────────────────────────

/**
 * Check backend availability.
 * @returns {Promise<boolean>}
 */
export async function isBackendAvailable() {
  const data = await apiFetch('/api/health');
  return data?.status === 'ok';
}
