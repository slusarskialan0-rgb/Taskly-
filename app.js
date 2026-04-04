/**
 * app.js – Główna logika aplikacji TASKLY PRO
 * Sekcje: Dashboard, Zlecenia, Pracownicy, Klienci, Statystyki
 */

// ══════════════════════════════════════════════════════════════
// STAN APLIKACJI
// ══════════════════════════════════════════════════════════════
let state = {
  jobs:    [],   // Array<Job>
  workers: [],   // Array<Worker>
  clients: [],   // Array<Client>
  leads:   [],   // Array<Lead>
  profile: null, // Object
};

// ══════════════════════════════════════════════════════════════
// INICJALIZACJA
// ══════════════════════════════════════════════════════════════

/** Sprawdź sesję – przekieruj do logowania jeśli brak */
function checkSession() {
  if (localStorage.getItem('taskly_session') !== 'active') {
    window.location.href = 'index.html';
  }
  const profile = apiGetProfile();
  document.getElementById('sidebarUser').textContent = profile.displayName || profile.username || 'admin';
}

/** Ładuj dane i renderuj aplikację */
async function init() {
  checkSession();

  const [jobs, workers, clients, leads] = await Promise.all([
    apiGetJobs(),
    apiGetWorkers(),
    apiGetClients(),
    apiGetLeads(),
  ]);
  state.jobs    = jobs;
  state.workers = workers;
  state.clients = clients;
  state.leads   = leads;
  state.profile = apiGetProfile();

  renderAll();
  renderProfile();
  bindEvents();
}

/** Renderuj wszystkie sekcje */
function renderAll() {
  renderDashboard();
  renderJobs();
  renderWorkers();
  renderClients();
  renderStats();
}

// ══════════════════════════════════════════════════════════════
// NAWIGACJA
// ══════════════════════════════════════════════════════════════
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  document.querySelector(`.nav-item[data-section="${name}"]`).classList.add('active');
  closeSidebar();
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

// ══════════════════════════════════════════════════════════════
// OBLICZANIE ZYSKU
// ══════════════════════════════════════════════════════════════

/**
 * Oblicz zysk dla zlecenia
 * Wzór: (stawkaKlienta - stawkaPracownika) × godziny × liczbaOsób
 * @param {Object} job
 * @returns {number}
 */
function calculateProfit(job) {
  const margin = (parseFloat(job.clientRate) || 0) - (parseFloat(job.workerRate) || 0);
  return margin * (parseFloat(job.hours) || 0) * (parseInt(job.people) || 0);
}

/** Zsumuj zyski za dzisiaj */
function getDailyProfit() {
  const today = new Date().toISOString().slice(0, 10);
  return state.jobs
    .filter(j => (j.date || '').slice(0, 10) === today)
    .reduce((sum, j) => sum + calculateProfit(j), 0);
}

/** Zsumuj zyski za bieżący miesiąc */
function getMonthlyProfit() {
  const prefix = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  return state.jobs
    .filter(j => (j.date || '').startsWith(prefix))
    .reduce((sum, j) => sum + calculateProfit(j), 0);
}

/** Formatuj liczbę jako złotówki */
function fmtPLN(value) {
  return value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
}

/** Formatuj datę */
function fmtDate(isoStr) {
  if (!isoStr) return '–';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pl-PL');
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════
function renderDashboard() {
  const total      = state.jobs.length;
  const done       = state.jobs.filter(j => j.status === 'ZROBIONE').length;
  const inProgress = state.jobs.filter(j => j.status === 'W TRAKCIE').length;
  const daily      = getDailyProfit();
  const monthly    = getMonthlyProfit();
  const workers    = state.workers.length;

  document.getElementById('statTotal').textContent        = total;
  document.getElementById('statDone').textContent         = done;
  document.getElementById('statInProgress').textContent   = inProgress;
  document.getElementById('statDailyProfit').textContent  = fmtPLN(daily);
  document.getElementById('statMonthlyProfit').textContent= fmtPLN(monthly);
  document.getElementById('statWorkers').textContent      = workers;

  // Ostatnie 5 zleceń – posortuj od najnowszych
  const recent = [...state.jobs]
    .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
    .slice(0, 5);
  const list   = document.getElementById('recentJobsList');
  if (recent.length === 0) {
    list.innerHTML = `<p class="job-list-empty">Brak zleceń. Dodaj pierwsze zlecenie!</p>`;
    return;
  }
  list.innerHTML = recent.map(j => {
    const profit   = calculateProfit(j);
    const badge    = statusBadge(j.status);
    return `<div class="job-list-row">
      <span class="job-list-city">${escHtml(j.city || '–')}</span>
      ${badge}
      <span class="job-list-profit">${fmtPLN(profit)}</span>
      <span class="text-muted" style="font-size:.8rem">${fmtDate(j.date)}</span>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// ZLECENIA
// ══════════════════════════════════════════════════════════════

/**
 * Renderuj listę zleceń z uwzględnieniem filtrów i sortowania
 */
function renderJobs() {
  const filterStatus = document.getElementById('filterStatus')?.value || 'all';
  const sortBy       = document.getElementById('sortBy')?.value || 'date-desc';
  const filterCity   = (document.getElementById('filterCity')?.value || '').toLowerCase().trim();

  let jobs = [...state.jobs];

  // Filtr statusu
  if (filterStatus !== 'all') {
    jobs = jobs.filter(j => j.status === filterStatus);
  }

  // Filtr miasta
  if (filterCity) {
    jobs = jobs.filter(j => (j.city || '').toLowerCase().includes(filterCity));
  }

  // Sortowanie
  const sortKey = (j) => {
    if (sortBy === 'profit-desc' || sortBy === 'profit-asc') return calculateProfit(j);
    // Użyj createdAt jeśli dostępne, inaczej date
    return new Date(j.createdAt || j.date || 0).getTime();
  };

  jobs.sort((a, b) => {
    if (sortBy === 'date-desc')    return sortKey(b) - sortKey(a);
    if (sortBy === 'date-asc')     return sortKey(a) - sortKey(b);
    if (sortBy === 'profit-desc')  return sortKey(b) - sortKey(a);
    if (sortBy === 'profit-asc')   return sortKey(a) - sortKey(b);
    return 0;
  });

  const container = document.getElementById('jobsList');
  if (jobs.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <p>Brak zleceń spełniających kryteria.</p>
    </div>`;
    return;
  }

  container.innerHTML = jobs.map(j => jobCard(j)).join('');
}

/** Wygeneruj HTML karty zlecenia */
function jobCard(job) {
  const profit     = calculateProfit(job);
  const profitCls  = profit < 0 ? 'negative' : '';
  const clientName = getClientName(job.clientId);
  const badge      = statusBadge(job.status);

  return `<div class="job-card" data-id="${job.id}">
    <div class="job-card-top">
      <div>
        <div class="job-city">${escHtml(job.city || 'Nieznane miasto')}</div>
        ${job.date ? `<div class="job-date">${fmtDate(job.date)}</div>` : ''}
      </div>
      ${badge}
    </div>

    <div class="job-meta">
      <span>👥 ${job.people || 1} os.</span>
      <span>⏱ ${job.hours || 0} h</span>
      <span>💼 ${fmtPLN(parseFloat(job.clientRate) || 0)}/h</span>
      <span>👷 ${fmtPLN(parseFloat(job.workerRate) || 0)}/h</span>
      ${clientName ? `<span>🏢 ${escHtml(clientName)}</span>` : ''}
    </div>

    ${job.notes ? `<div class="text-muted" style="font-size:.82rem">${escHtml(job.notes)}</div>` : ''}

    <div class="job-profit ${profitCls}">
      💰 Zysk: ${fmtPLN(profit)}
    </div>

    <div class="job-actions">
      <select class="btn btn-ghost btn-sm status-select" data-id="${job.id}" title="Zmień status">
        <option value="NOWE"      ${job.status === 'NOWE'      ? 'selected' : ''}>NOWE</option>
        <option value="W TRAKCIE" ${job.status === 'W TRAKCIE' ? 'selected' : ''}>W TRAKCIE</option>
        <option value="ZROBIONE"  ${job.status === 'ZROBIONE'  ? 'selected' : ''}>ZROBIONE</option>
      </select>
      <button class="btn btn-ghost btn-sm btn-icon edit-job-btn" data-id="${job.id}" title="Edytuj">✏️</button>
      <button class="btn btn-danger btn-sm btn-icon delete-job-btn" data-id="${job.id}" title="Usuń">🗑️</button>
    </div>
  </div>`;
}

/** Renderuj badge statusu */
function statusBadge(status) {
  const cls = status === 'W TRAKCIE' ? 'status-W_TRAKCIE' : `status-${status}`;
  return `<span class="status-badge ${cls}">${escHtml(status || 'NOWE')}</span>`;
}

/** Pobierz nazwę klienta po ID */
function getClientName(clientId) {
  if (!clientId) return null;
  const c = state.clients.find(c => c.id === clientId);
  return c ? c.name : null;
}

// ══════════════════════════════════════════════════════════════
// MODAL: ZLECENIE
// ══════════════════════════════════════════════════════════════
function openJobModal(job = null) {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('jobId').value         = job?.id || '';
  document.getElementById('jobCity').value        = job?.city || '';
  document.getElementById('jobPeople').value      = job?.people || 1;
  document.getElementById('jobHours').value       = job?.hours || 8;
  document.getElementById('jobClientRate').value  = job?.clientRate || 0;
  document.getElementById('jobWorkerRate').value  = job?.workerRate || 0;
  document.getElementById('jobDate').value        = job?.date || today;
  document.getElementById('jobStatus').value      = job?.status || 'NOWE';
  document.getElementById('jobNotes').value       = job?.notes || '';
  document.getElementById('jobModalTitle').textContent = job ? 'Edytuj zlecenie' : 'Nowe zlecenie';

  // Wypełnij dropdown klientów
  const sel = document.getElementById('jobClient');
  sel.innerHTML = '<option value="">– wybierz klienta –</option>' +
    state.clients.map(c =>
      `<option value="${c.id}" ${job?.clientId === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`
    ).join('');

  updateProfitPreview();
  document.getElementById('jobModal').classList.remove('hidden');
  document.getElementById('jobCity').focus();
}

function closeJobModal() {
  document.getElementById('jobModal').classList.add('hidden');
  document.getElementById('jobForm').reset();
}

/** Zaktualizuj podgląd zysku w modalu */
function updateProfitPreview() {
  const cRate  = parseFloat(document.getElementById('jobClientRate').value) || 0;
  const wRate  = parseFloat(document.getElementById('jobWorkerRate').value) || 0;
  const hours  = parseFloat(document.getElementById('jobHours').value) || 0;
  const people = parseInt(document.getElementById('jobPeople').value) || 0;
  const profit = (cRate - wRate) * hours * people;

  const el = document.getElementById('profitPreview');
  el.textContent = fmtPLN(profit);
  el.className   = 'profit-value' + (profit < 0 ? ' negative' : '');
}

/**
 * Dodaj lub zaktualizuj zlecenie
 */
async function addJob() {
  const city       = document.getElementById('jobCity').value.trim();
  const people     = parseInt(document.getElementById('jobPeople').value);
  const hours      = parseFloat(document.getElementById('jobHours').value);
  const clientRate = parseFloat(document.getElementById('jobClientRate').value);
  const workerRate = parseFloat(document.getElementById('jobWorkerRate').value);
  const date       = document.getElementById('jobDate').value;
  const status     = document.getElementById('jobStatus').value;
  const notes      = document.getElementById('jobNotes').value.trim();
  const clientId   = document.getElementById('jobClient').value;
  const jobId      = document.getElementById('jobId').value;

  if (!city) { showToast('Podaj miasto.', 'error'); return; }
  if (isNaN(people) || people < 1) { showToast('Podaj poprawną liczbę osób.', 'error'); return; }
  if (isNaN(hours)  || hours < 0.5) { showToast('Podaj poprawne godziny.', 'error'); return; }

  const job = {
    id: jobId || undefined,
    city, people, hours, clientRate, workerRate, date, status, notes,
    clientId: clientId || null,
  };

  try {
    const saved = await apiSaveJob(job);
    const idx   = state.jobs.findIndex(j => j.id === saved.id);
    if (idx >= 0) state.jobs[idx] = saved; else state.jobs.unshift(saved);

    renderAll();
    closeJobModal();
    showToast(jobId ? 'Zlecenie zaktualizowane.' : 'Zlecenie dodane!', 'success');
  } catch {
    showToast('Błąd zapisu. Spróbuj ponownie.', 'error');
  }
}

/**
 * Zmień status zlecenia
 * @param {string} id
 * @param {string} newStatus
 */
async function updateStatus(id, newStatus) {
  const job = state.jobs.find(j => j.id === id);
  if (!job) return;
  job.status = newStatus;
  await apiSaveJob(job);
  renderAll();
  showToast(`Status zmieniony na ${newStatus}.`, 'success');
}

/** Usuń zlecenie po potwierdzeniu */
async function deleteJob(id) {
  if (!confirm('Usunąć zlecenie? Tej operacji nie można cofnąć.')) return;
  await apiDeleteJob(id);
  state.jobs = state.jobs.filter(j => j.id !== id);
  renderAll();
  showToast('Zlecenie usunięte.', 'success');
}

// ══════════════════════════════════════════════════════════════
// PRACOWNICY
// ══════════════════════════════════════════════════════════════
function renderWorkers() {
  const container = document.getElementById('workersList');
  if (state.workers.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">👷</div>
      <p>Brak pracowników. Dodaj pierwszego!</p>
    </div>`;
    return;
  }
  container.innerHTML = state.workers.map(w => workerCard(w)).join('');
}

function workerCard(worker) {
  const avail    = worker.available !== false;
  const avBadge  = avail
    ? `<span class="status-badge status-ZROBIONE">Dostępny</span>`
    : `<span class="status-badge" style="background:var(--red-light);color:var(--red)">Niedostępny</span>`;

  // Policz zlecenia pracownika (przypisane przez ID)
  const jobCount = state.jobs.filter(j => j.workerIds && j.workerIds.includes(worker.id)).length;

  return `<div class="worker-card" data-id="${worker.id}">
    <div class="worker-top">
      <span class="worker-name">${escHtml(worker.name)}</span>
      ${avBadge}
    </div>
    ${worker.phone  ? `<div class="worker-phone">📞 ${escHtml(worker.phone)}</div>` : ''}
    ${worker.skills ? `<div class="worker-skills">🔧 ${escHtml(worker.skills)}</div>` : ''}
    <div class="worker-top" style="margin-top:.3rem">
      <span class="text-muted" style="font-size:.8rem">Zlecenia: ${jobCount}</span>
      <div class="worker-actions">
        <label class="toggle" title="Dostępność">
          <input type="checkbox" class="worker-avail-toggle" data-id="${worker.id}" ${avail ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
        <button class="btn btn-ghost btn-sm btn-icon edit-worker-btn" data-id="${worker.id}" title="Edytuj">✏️</button>
        <button class="btn btn-danger btn-sm btn-icon delete-worker-btn" data-id="${worker.id}" title="Usuń">🗑️</button>
      </div>
    </div>
  </div>`;
}

function openWorkerModal(worker = null) {
  document.getElementById('workerId').value        = worker?.id || '';
  document.getElementById('workerName').value      = worker?.name || '';
  document.getElementById('workerPhone').value     = worker?.phone || '';
  document.getElementById('workerSkills').value    = worker?.skills || '';
  document.getElementById('workerAvailable').checked = worker ? worker.available !== false : true;
  document.getElementById('workerModal').classList.remove('hidden');
  document.getElementById('workerName').focus();
}

function closeWorkerModal() {
  document.getElementById('workerModal').classList.add('hidden');
  document.getElementById('workerForm').reset();
}

async function saveWorker() {
  const name      = document.getElementById('workerName').value.trim();
  const phone     = document.getElementById('workerPhone').value.trim();
  const skills    = document.getElementById('workerSkills').value.trim();
  const available = document.getElementById('workerAvailable').checked;
  const workerId  = document.getElementById('workerId').value;

  if (!name) { showToast('Podaj imię i nazwisko pracownika.', 'error'); return; }

  const worker = { id: workerId || undefined, name, phone, skills, available };
  const saved  = await apiSaveWorker(worker);
  const idx    = state.workers.findIndex(w => w.id === saved.id);
  if (idx >= 0) state.workers[idx] = saved; else state.workers.push(saved);

  renderWorkers();
  renderDashboard();
  closeWorkerModal();
  showToast(workerId ? 'Pracownik zaktualizowany.' : 'Pracownik dodany!', 'success');
}

async function deleteWorker(id) {
  if (!confirm('Usunąć pracownika?')) return;
  await apiDeleteWorker(id);
  state.workers = state.workers.filter(w => w.id !== id);
  renderWorkers();
  renderDashboard();
  showToast('Pracownik usunięty.', 'success');
}

async function toggleWorkerAvailability(id, available) {
  const worker = state.workers.find(w => w.id === id);
  if (!worker) return;
  worker.available = available;
  await apiSaveWorker(worker);
  renderWorkers();
}

// ══════════════════════════════════════════════════════════════
// KLIENCI
// ══════════════════════════════════════════════════════════════
function renderClients() {
  const container = document.getElementById('clientsList');
  if (state.clients.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🏢</div>
      <p>Brak klientów. Dodaj pierwszego!</p>
    </div>`;
    return;
  }
  container.innerHTML = state.clients.map(c => clientCard(c)).join('');
}

function clientCard(client) {
  const jobCount = state.jobs.filter(j => j.clientId === client.id).length;
  const totalProfit = state.jobs
    .filter(j => j.clientId === client.id)
    .reduce((sum, j) => sum + calculateProfit(j), 0);

  return `<div class="client-card" data-id="${client.id}">
    <div class="client-name">${escHtml(client.name)}</div>
    ${client.phone ? `<div class="client-phone">📞 ${escHtml(client.phone)}</div>` : ''}
    ${client.email ? `<div class="client-phone">✉️ ${escHtml(client.email)}</div>` : ''}
    <div class="client-jobs">📋 Zleceń: ${jobCount} | Zysk: ${fmtPLN(totalProfit)}</div>
    ${client.notes ? `<div class="text-muted" style="font-size:.82rem">${escHtml(client.notes)}</div>` : ''}
    <div class="client-actions">
      <button class="btn btn-ghost btn-sm edit-client-btn" data-id="${client.id}">✏️ Edytuj</button>
      <button class="btn btn-danger btn-sm delete-client-btn" data-id="${client.id}">🗑️</button>
    </div>
  </div>`;
}

function openClientModal(client = null) {
  document.getElementById('clientId').value    = client?.id || '';
  document.getElementById('clientName').value  = client?.name || '';
  document.getElementById('clientPhone').value = client?.phone || '';
  document.getElementById('clientEmail').value = client?.email || '';
  document.getElementById('clientNotes').value = client?.notes || '';
  document.getElementById('clientModal').classList.remove('hidden');
  document.getElementById('clientName').focus();
}

function closeClientModal() {
  document.getElementById('clientModal').classList.add('hidden');
  document.getElementById('clientForm').reset();
}

async function saveClient() {
  const name     = document.getElementById('clientName').value.trim();
  const phone    = document.getElementById('clientPhone').value.trim();
  const email    = document.getElementById('clientEmail').value.trim();
  const notes    = document.getElementById('clientNotes').value.trim();
  const clientId = document.getElementById('clientId').value;

  if (!name) { showToast('Podaj nazwę klienta.', 'error'); return; }

  const client = { id: clientId || undefined, name, phone, email, notes };
  const saved  = await apiSaveClient(client);
  const idx    = state.clients.findIndex(c => c.id === saved.id);
  if (idx >= 0) state.clients[idx] = saved; else state.clients.push(saved);

  renderClients();
  renderDashboard();
  closeClientModal();
  showToast(clientId ? 'Klient zaktualizowany.' : 'Klient dodany!', 'success');
}

async function deleteClient(id) {
  if (!confirm('Usunąć klienta?')) return;
  await apiDeleteClient(id);
  state.clients = state.clients.filter(c => c.id !== id);
  renderClients();
  renderDashboard();
  showToast('Klient usunięty.', 'success');
}

// ══════════════════════════════════════════════════════════════
// STATYSTYKI
// ══════════════════════════════════════════════════════════════
function renderStats() {
  renderMonthlyChart();
  renderStatusChart();
  renderCityChart();
}

/** Zysk wg miesiąca (ostatnie 6 miesięcy) */
function renderMonthlyChart() {
  const monthsData = {};
  for (let i = 5; i >= 0; i--) {
    const d   = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    monthsData[key] = 0;
  }
  state.jobs.forEach(j => {
    const m = (j.date || '').slice(0, 7);
    if (m in monthsData) monthsData[m] += calculateProfit(j);
  });

  const max = Math.max(...Object.values(monthsData), 1);
  const container = document.getElementById('monthlyChart');
  container.innerHTML = Object.entries(monthsData).map(([month, val]) => {
    const pct   = Math.max(0, (val / max) * 100).toFixed(1);
    const label = month.slice(5) + '/' + month.slice(2, 4);
    return `<div class="chart-bar-row">
      <span class="chart-bar-label">${label}</span>
      <div class="chart-bar-wrap"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
      <span class="chart-bar-value">${fmtPLN(val)}</span>
    </div>`;
  }).join('');
}

/** Zlecenia wg statusu */
function renderStatusChart() {
  const counts = { NOWE: 0, 'W TRAKCIE': 0, ZROBIONE: 0 };
  state.jobs.forEach(j => { if (j.status in counts) counts[j.status]++; });
  const max = Math.max(...Object.values(counts), 1);
  const colors = { NOWE: '#3b82f6', 'W TRAKCIE': '#f59e0b', ZROBIONE: '#22c55e' };

  const container = document.getElementById('statusChart');
  container.innerHTML = Object.entries(counts).map(([status, cnt]) => {
    const pct = ((cnt / max) * 100).toFixed(1);
    return `<div class="chart-bar-row">
      <span class="chart-bar-label">${status}</span>
      <div class="chart-bar-wrap">
        <div class="chart-bar-fill" style="width:${pct}%;background:${colors[status]}"></div>
      </div>
      <span class="chart-bar-value">${cnt}</span>
    </div>`;
  }).join('');
}

/** Top 5 miast wg zysku */
function renderCityChart() {
  const cityData = {};
  state.jobs.forEach(j => {
    const city = j.city || 'Nieznane';
    cityData[city] = (cityData[city] || 0) + calculateProfit(j);
  });

  const top5 = Object.entries(cityData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const max = top5.length ? Math.max(...top5.map(e => e[1]), 1) : 1;
  const container = document.getElementById('cityChart');

  if (top5.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align:center;padding:2rem">Brak danych.</p>';
    return;
  }
  container.innerHTML = top5.map(([city, val]) => {
    const pct = Math.max(0, (val / max) * 100).toFixed(1);
    return `<div class="chart-bar-row">
      <span class="chart-bar-label">${escHtml(city)}</span>
      <div class="chart-bar-wrap"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
      <span class="chart-bar-value">${fmtPLN(val)}</span>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// PROFIL UŻYTKOWNIKA
// ══════════════════════════════════════════════════════════════

/** Zwróć inicjały z imienia i nazwiska (max 2 litery) */
function getInitials(name) {
  return (name || 'A').trim().split(/\s+/).filter(w => w.length > 0).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'A';
}

/** Renderuj formularz profilu */
function renderProfile() {
  const p = state.profile || apiGetProfile();
  document.getElementById('profileDisplayName').value = p.displayName || '';
  document.getElementById('profileEmail').value       = p.email || '';
  document.getElementById('profileAvatar').textContent = getInitials(p.displayName || p.username);
}

/** Zapisz zmiany profilu */
function saveProfile() {
  const displayName       = document.getElementById('profileDisplayName').value.trim();
  const email             = document.getElementById('profileEmail').value.trim();
  const currentPassword   = document.getElementById('profileCurrentPassword').value;
  const newPassword       = document.getElementById('profileNewPassword').value;
  const confirmPassword   = document.getElementById('profileConfirmPassword').value;

  const profile = state.profile ? { ...state.profile } : apiGetProfile();

  // Walidacja zmiany hasła
  if (currentPassword || newPassword || confirmPassword) {
    if (currentPassword !== profile.password) {
      showToast('Nieprawidłowe obecne hasło.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Nowe hasło musi mieć co najmniej 6 znaków.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Hasła nie są zgodne.', 'error');
      return;
    }
    profile.password = newPassword;
  }

  profile.displayName = displayName;
  profile.email       = email;

  state.profile = apiSaveProfile(profile);

  // Zaktualizuj wyświetlaną nazwę w sidebarze
  document.getElementById('sidebarUser').textContent = displayName || profile.username || 'admin';

  // Wyczyść pola hasła
  document.getElementById('profileCurrentPassword').value = '';
  document.getElementById('profileNewPassword').value     = '';
  document.getElementById('profileConfirmPassword').value = '';

  // Odśwież avatar
  document.getElementById('profileAvatar').textContent = getInitials(displayName || profile.username);

  showToast('Profil zaktualizowany!', 'success');
}

// ══════════════════════════════════════════════════════════════
// LEADY
// ══════════════════════════════════════════════════════════════

/** Obsługa formularza leadów */
async function handleLeadSubmit(e) {
  e.preventDefault();

  const name    = document.getElementById('leadName').value.trim();
  const phone   = document.getElementById('leadPhone').value.trim();
  const city    = document.getElementById('leadCity').value.trim();
  const service = document.getElementById('leadService').value.trim();

  // Walidacja
  if (!name || !phone || !city || !service) {
    showToast('Wszystkie pola są wymagane.', 'error');
    return;
  }

  const lead = {
    name,
    phone,
    city,
    service,
    status: 'NOWY',
  };

  try {
    const savedLead = await apiSaveLead(lead);
    state.leads.unshift(savedLead);

    // Wyczyść formularz
    document.getElementById('leadForm').reset();

    showToast('Lead dodany pomyślnie!', 'success');
  } catch (err) {
    console.error('Błąd podczas zapisywania leadu:', err);
    showToast('Błąd podczas zapisywania leadu.', 'error');
  }
}

// ══════════════════════════════════════════════════════════════
// TOAST / POWIADOMIENIA
// ══════════════════════════════════════════════════════════════
let toastTimer = null;
function showToast(message, type = '') {
  const el = document.getElementById('toast');
  el.textContent  = message;
  el.className    = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ══════════════════════════════════════════════════════════════
// BEZPIECZEŃSTWO / ESCAPE HTML
// ══════════════════════════════════════════════════════════════
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ══════════════════════════════════════════════════════════════
// PODPINANIE ZDARZEŃ
// ══════════════════════════════════════════════════════════════
function bindEvents() {
  // Nawigacja
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => showSection(btn.dataset.section));
  });

  // Wyloguj
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('topLogoutBtn').addEventListener('click', logout);

  // Menu mobilne
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // ── Zlecenia ──────────────────────────────────────────────
  document.getElementById('addJobBtn').addEventListener('click', () => openJobModal());
  document.getElementById('dashAddJobBtn').addEventListener('click', () => {
    showSection('jobs');
    openJobModal();
  });
  document.getElementById('saveJobBtn').addEventListener('click', addJob);
  document.getElementById('closeJobModal').addEventListener('click', closeJobModal);
  document.getElementById('cancelJobModal').addEventListener('click', closeJobModal);

  // Podgląd zysku w modalu na żywo
  ['jobClientRate', 'jobWorkerRate', 'jobHours', 'jobPeople'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateProfitPreview);
  });

  // Filtrowanie / sortowanie
  document.getElementById('filterStatus').addEventListener('change', renderJobs);
  document.getElementById('sortBy').addEventListener('change', renderJobs);
  document.getElementById('filterCity').addEventListener('input', renderJobs);

  // Delegacja zdarzeń na liście zleceń
  document.getElementById('jobsList').addEventListener('click', handleJobListClick);
  document.getElementById('jobsList').addEventListener('change', handleJobListChange);

  // ── Pracownicy ────────────────────────────────────────────
  document.getElementById('addWorkerBtn').addEventListener('click', () => openWorkerModal());
  document.getElementById('saveWorkerBtn').addEventListener('click', saveWorker);
  document.getElementById('closeWorkerModal').addEventListener('click', closeWorkerModal);
  document.getElementById('cancelWorkerModal').addEventListener('click', closeWorkerModal);
  document.getElementById('workersList').addEventListener('click', handleWorkerListClick);
  document.getElementById('workersList').addEventListener('change', handleWorkerListChange);

  // ── Klienci ───────────────────────────────────────────────
  document.getElementById('addClientBtn').addEventListener('click', () => openClientModal());
  document.getElementById('saveClientBtn').addEventListener('click', saveClient);
  document.getElementById('closeClientModal').addEventListener('click', closeClientModal);
  document.getElementById('cancelClientModal').addEventListener('click', closeClientModal);
  document.getElementById('clientsList').addEventListener('click', handleClientListClick);

  // ── Leady ─────────────────────────────────────────────────
  document.getElementById('leadForm').addEventListener('submit', handleLeadSubmit);

  // ── Profil ────────────────────────────────────────────────
  document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);

  // Zamknij modala klikając tło
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
      }
    });
  });

  // ESC zamyka modale
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    }
  });
}

// ── Event handlers (delegacja) ─────────────────────────────────

function handleJobListClick(e) {
  const target = e.target.closest('[data-id]');
  if (!target) return;
  const id = target.dataset.id;

  if (target.classList.contains('edit-job-btn')) {
    const job = state.jobs.find(j => j.id === id);
    if (job) openJobModal(job);
  } else if (target.classList.contains('delete-job-btn')) {
    deleteJob(id);
  }
}

function handleJobListChange(e) {
  if (e.target.classList.contains('status-select')) {
    updateStatus(e.target.dataset.id, e.target.value);
  }
}

function handleWorkerListClick(e) {
  const target = e.target.closest('[data-id]');
  if (!target) return;
  const id = target.dataset.id;

  if (target.classList.contains('edit-worker-btn')) {
    const w = state.workers.find(w => w.id === id);
    if (w) openWorkerModal(w);
  } else if (target.classList.contains('delete-worker-btn')) {
    deleteWorker(id);
  }
}

function handleWorkerListChange(e) {
  if (e.target.classList.contains('worker-avail-toggle')) {
    toggleWorkerAvailability(e.target.dataset.id, e.target.checked);
  }
}

function handleClientListClick(e) {
  const target = e.target.closest('[data-id]');
  if (!target) return;
  const id = target.dataset.id;

  if (target.classList.contains('edit-client-btn')) {
    const c = state.clients.find(c => c.id === id);
    if (c) openClientModal(c);
  } else if (target.classList.contains('delete-client-btn')) {
    deleteClient(id);
  }
}

// ── Wylogowanie ────────────────────────────────────────────────
function logout() {
  localStorage.removeItem('taskly_session');
  localStorage.removeItem('taskly_user');
  window.location.href = 'index.html';
}

// ══════════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', init);
