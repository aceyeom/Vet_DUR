/**
 * NuvoVet API Client
 *
 * All requests go to the FastAPI backend at VITE_API_URL.
 * Callers receive null / empty arrays when the backend is unreachable.
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
