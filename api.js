/**
 * api.js – Komunikacja z backendem (Google Apps Script)
 * Fallback: localStorage gdy API niedostępne
 */

// ── Konfiguracja ──────────────────────────────────────────────
// Ustaw poniższy URL na Twój endpoint Google Apps Script
const API_BASE = '';  // np. 'https://script.google.com/macros/s/YOUR_ID/exec'

const USE_API = API_BASE !== '';

// ── Klucze localStorage ────────────────────────────────────────
const LS_JOBS    = 'taskly_jobs';
const LS_WORKERS = 'taskly_workers';
const LS_CLIENTS = 'taskly_clients';

// ── Pomocnicze: generuj ID ─────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── localStorage helpers ───────────────────────────────────────
function lsGet(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}
function lsSet(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ══════════════════════════════════════════════════════════════
// JOBS API
// ══════════════════════════════════════════════════════════════

/**
 * Pobierz wszystkie zlecenia
 * @returns {Promise<Array>}
 */
async function apiGetJobs() {
  if (!USE_API) return lsGet(LS_JOBS);
  try {
    const res = await fetch(`${API_BASE}?action=getJobs`);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return Array.isArray(data) ? data : data.jobs || [];
  } catch (err) {
    console.warn('API niedostępne, używam localStorage:', err.message);
    return lsGet(LS_JOBS);
  }
}

/**
 * Dodaj lub zaktualizuj zlecenie
 * @param {Object} job
 * @returns {Promise<Object>}
 */
async function apiSaveJob(job) {
  if (!job.id) job.id = generateId();
  if (!job.createdAt) job.createdAt = new Date().toISOString();

  if (!USE_API) {
    const jobs = lsGet(LS_JOBS);
    const idx  = jobs.findIndex(j => j.id === job.id);
    if (idx >= 0) jobs[idx] = job; else jobs.unshift(job);
    lsSet(LS_JOBS, jobs);
    return job;
  }
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveJob', job }),
    });
    if (!res.ok) throw new Error('API error');
    return await res.json();
  } catch (err) {
    console.warn('API niedostępne, używam localStorage:', err.message);
    const jobs = lsGet(LS_JOBS);
    const idx  = jobs.findIndex(j => j.id === job.id);
    if (idx >= 0) jobs[idx] = job; else jobs.unshift(job);
    lsSet(LS_JOBS, jobs);
    return job;
  }
}

/**
 * Usuń zlecenie po ID
 * @param {string} id
 */
async function apiDeleteJob(id) {
  if (!USE_API) {
    lsSet(LS_JOBS, lsGet(LS_JOBS).filter(j => j.id !== id));
    return;
  }
  try {
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteJob', id }),
    });
  } catch {
    lsSet(LS_JOBS, lsGet(LS_JOBS).filter(j => j.id !== id));
  }
}

// ══════════════════════════════════════════════════════════════
// WORKERS API
// ══════════════════════════════════════════════════════════════

async function apiGetWorkers() {
  return lsGet(LS_WORKERS);
}

async function apiSaveWorker(worker) {
  if (!worker.id) worker.id = generateId();
  const workers = lsGet(LS_WORKERS);
  const idx = workers.findIndex(w => w.id === worker.id);
  if (idx >= 0) workers[idx] = worker; else workers.push(worker);
  lsSet(LS_WORKERS, workers);
  return worker;
}

async function apiDeleteWorker(id) {
  lsSet(LS_WORKERS, lsGet(LS_WORKERS).filter(w => w.id !== id));
}

// ══════════════════════════════════════════════════════════════
// CLIENTS API
// ══════════════════════════════════════════════════════════════

async function apiGetClients() {
  return lsGet(LS_CLIENTS);
}

async function apiSaveClient(client) {
  if (!client.id) client.id = generateId();
  const clients = lsGet(LS_CLIENTS);
  const idx = clients.findIndex(c => c.id === client.id);
  if (idx >= 0) clients[idx] = client; else clients.push(client);
  lsSet(LS_CLIENTS, clients);
  return client;
}

async function apiDeleteClient(id) {
  lsSet(LS_CLIENTS, lsGet(LS_CLIENTS).filter(c => c.id !== id));
}

// ══════════════════════════════════════════════════════════════
// PROFILE API
// ══════════════════════════════════════════════════════════════

const LS_PROFILE = 'taskly_profile';

const DEFAULT_PROFILE = { username: 'admin', displayName: 'Administrator', email: '', password: 'admin123' };

function apiGetProfile() {
  try {
    const raw = localStorage.getItem(LS_PROFILE);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch { /* */ }
  return { ...DEFAULT_PROFILE };
}

function apiSaveProfile(profile) {
  lsSet(LS_PROFILE, profile);
  return profile;
}
