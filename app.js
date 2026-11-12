/* =========================================================
   NOTULEN RAPAT — Logika aplikasi (vanilla JS)
   ========================================================= */

const state = {
  user: null, meetings: [], current: null,
  peserta: [], tindak: [], bahasan: [], report: null,
};

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => 'T' + Math.random().toString(36).slice(2, 10);

const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const fmtTanggal = (s) => s
  ? new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  : '-';
const fmtTanggalSingkat = (s) => s
  ? new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  : '-';

const FIELDS = ['judul', 'tanggal', 'waktu', 'tempat', 'pimpinan', 'notulis', 'status', 'agenda', 'keputusan'];
const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6', '#f43f5e', '#14b8a6'];
const colorFor = (s) => COLORS[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

const ic = (name) => `<i data-lucide="${name}"></i>`;
const icons = () => { if (window.lucide) window.lucide.createIcons(); };

const statCard = (label, val, icon, color) => `
  <div class="stat" style="--c:${color}">
    <div class="stat-ico">${ic(icon)}</div>
    <span>${label}</span>
    <strong>${val}</strong>
  </div>`;
const emptyState = (icon, title, text) => `
  <div class="empty-state">${ic(icon)}<h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
const emptyInline = (text) => `<p class="empty-inline">${esc(text)}</p>`;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2600);
}

function showView(id) {
  ['view-login', 'view-app'].forEach(v => $('#' + v).classList.toggle('hidden', v !== id));
  icons();
}

function showPage(name) {
  ['list', 'editor', 'report'].forEach(p => $('#page-' + p).classList.toggle('hidden', p !== name));
  $$('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === name));
  window.scrollTo(0, 0);
  icons();
}

/* ---------- Login ---------- */
async function login(e) {
  e.preventDefault();
  const f = e.target;
  const btn = f.querySelector('button[type="submit"]');
  const label = btn.querySelector('span');
  const errEl = $('#login-error');
  errEl.classList.add('hidden');
  btn.disabled = true;
  label.textContent = 'Memeriksa…';
  try {
    const r = await API.call('login', { username: f.username.value.trim(), password: f.password.value });
    sessionStorage.setItem('token', r.token);
    state.user = r.user;
    f.reset();
    await enterApp();
  } catch (err) {
    errEl.innerHTML = `${ic('circle-alert')} <span>${esc(err.message)}</span>`;
    errEl.classList.remove('hidden');
    icons();
  } finally {
    btn.disabled = false;
    label.textContent = 'Masuk';
  }
}

function togglePw() {
  const input = $('#form-login input[name="password"]');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  const btn = $('#btn-pw');
  btn.innerHTML = ic(show ? 'eye-off' : 'eye');
  btn.title = show ? 'Sembunyikan password' : 'Tampilkan password';
  icons();
}

async function logout(silent = false) {
  if (!silent) { try { await API.call('logout'); } catch (_) {} }
  sessionStorage.clear();
  state.user = null;
  state.meetings = [];
  state.report = null;
  showView('view-login');
}

async function enterApp() {
  showView('view-app');
  const name = state.user.name || state.user.username || '?';
  $('#user-name').textContent = name;
  $('#user-role').textContent = state.user.role === 'admin' ? 'Administrator' : 'Notulis';
  $('#user-chip').textContent = name.split(' ')[0];
  $('#user-initial').textContent = name.trim()[0].toUpperCase();
  setDefaultRange();
  await loadMeetings();
  showPage('list');
}

/* ---------- Daftar rapat ---------- */
async function loadMeetings() {
  try {
    state.meetings = await API.call('listMeetings');
    renderList();
  } catch (err) {
    toast(err.message);
  }
}

function renderList() {
  const all = state.meetings;
  const q = $('#search').value.trim().toLowerCase();
  const finalCount = all.filter(m => m.status === 'Final').length;
  const openTasks = all.reduce((a, m) => a + (m.jumlahTerbuka || 0), 0);

  $('#list-stats').innerHTML = [
    statCard('Total rapat', all.length, 'calendar-days', '#6366f1'),
    statCard('Final', finalCount, 'badge-check', '#10b981'),
    statCard('Draf', all.length - finalCount, 'pencil-line', '#f59e0b'),
    statCard('Tindak lanjut terbuka', openTasks, 'list-checks', '#f43f5e'),
  ].join('');

  const items = all
    .filter(m => [m.judul, m.pimpinan, m.tempat, m.notulis].join(' ').toLowerCase().includes(q))
    .sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));

  $('#meeting-list').innerHTML = items.length
    ? items.map(m => `
      <article class="meeting-card" data-id="${esc(m.id)}" tabindex="0" style="--c:${colorFor(m.id)}">
        <div class="mc-accent"></div>
        <div class="mc-body">
          <div class="mc-top">
            <span class="badge ${m.status === 'Final' ? 'b-final' : 'b-draft'}">${m.status === 'Final' ? ic('check') + ' Final' : 'Draf'}</span>
            <span class="mc-date">${ic('calendar')} ${esc(fmtTanggalSingkat(m.tanggal))}${m.waktu ? ' · ' + esc(m.waktu) : ''}</span>
          </div>
          <h3>${esc(m.judul)}</h3>
          <div class="mc-meta">
            ${m.tempat ? `<span>${ic('map-pin')} ${esc(m.tempat)}</span>` : ''}
            ${m.pimpinan ? `<span>${ic('user')} ${esc(m.pimpinan)}</span>` : ''}
          </div>
        </div>
        <div class="mc-foot">
          ${m.jumlahTerbuka > 0
            ? `<span class="chip chip-rose">${ic('circle-alert')} ${m.jumlahTerbuka} tindak lanjut terbuka</span>`
            : `<span class="chip chip-emerald">${ic('check')} Tidak ada tindak lanjut terbuka</span>`}
        </div>
      </article>`).join('')
    : emptyState(
        all.length ? 'search-x' : 'notebook-pen',
        all.length ? 'Tidak ditemukan' : 'Belum ada rapat',
        all.length ? 'Coba kata kunci lain.' : 'Klik "Rapat Baru" untuk mulai mencatat notulen.');

  icons();
}

async function openMeeting(id) {
  try {
    fillEditor(await API.call('getMeeting', { id }));
  } catch (err) {
    toast(err.message);
  }
}

/* ---------- Editor ---------- */
function fillEditor(m) {
  m = m || {
    id: '', judul: '', tanggal: today(), waktu: '08:00', tempat: '', pimpinan: '',
    notulis: state.user.name, status: 'Draf', agenda: '', keputusan: '',
    peserta: [], tindak: [], pembahasan: [],
  };
  state.current = m.id || null;

  const f = $('#form-meeting');
  f.reset();
  FIELDS.forEach(k => { if (f[k]) f[k].value = m[k] ?? ''; });

  state.peserta = toArr(m.peserta).map(p => ({ nama: p.nama || '', hadir: !!p.hadir }));
  state.tindak  = toArr(m.tindak).map(t => ({ ...t }));
  state.bahasan = toBahasan(m.pembahasan);

  $('#editor-title').textContent = m.id ? 'Edit Notulen' : 'Rapat Baru';
  $('#btn-delete').classList.toggle('hidden', !m.id);
  renderDyn();
  showPage('editor');
}

/** Pastikan nilai berupa array (berjaga jika backend mengembalikan teks atau null). */
function toArr(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch (_) {}
  }
  return [];
}

/** Pembahasan: array {judul, isi}. Teks biasa dari data lama dijadikan satu blok. */
function toBahasan(v) {
  if (Array.isArray(v)) return v.map(b => ({ judul: b.judul || '', isi: b.isi || '' }));
  if (typeof v === 'string' && v.trim()) {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return toBahasan(p);
    } catch (_) {}
    return [{ judul: '', isi: v }];
  }
  return [];
}

function renderDyn() {
  renderPeserta();
  renderTindak();
  renderBahasan();
  icons();
}

function renderPeserta() {
  $('#peserta-list').innerHTML = state.peserta.map((p, i) => `
    <div class="dyn-row" data-i="${i}">
      <input data-f="nama" value="${esc(p.nama)}" placeholder="Nama peserta" maxlength="120">
      <label class="toggle"><input type="checkbox" data-f="hadir" ${p.hadir ? 'checked' : ''}> Hadir</label>
      <button type="button" class="icon-btn danger" data-rm="peserta" data-i="${i}" title="Hapus peserta">${ic('x')}</button>
    </div>`).join('') || emptyInline('Belum ada peserta.');
}

function renderTindak() {
  $('#tindak-list').innerHTML = state.tindak.map((t, i) => `
    <div class="dyn-row tindak" data-i="${i}">
      <input data-f="uraian" value="${esc(t.uraian)}" placeholder="Uraian tindak lanjut" maxlength="500">
      <input data-f="pic" value="${esc(t.pic)}" placeholder="PIC" maxlength="120">
      <input data-f="tenggat" type="date" value="${esc(t.tenggat)}">
      <select data-f="status">
        <option value="Terbuka" ${t.status !== 'Selesai' ? 'selected' : ''}>Terbuka</option>
        <option value="Selesai" ${t.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
      </select>
      <button type="button" class="icon-btn danger" data-rm="tindak" data-i="${i}" title="Hapus">${ic('x')}</button>
    </div>`).join('') || emptyInline('Belum ada tindak lanjut.');
}

function renderBahasan() {
  $('#bahasan-list').innerHTML = state.bahasan.map((b, i) => `
    <div class="bh-item" data-i="${i}">
      <div class="bh-head">
        <span class="bh-num">${i + 1}</span>
        <input data-f="judul" value="${esc(b.judul)}" placeholder="Judul pembahasan, mis. Evaluasi anggaran" maxlength="200">
        <button type="button" class="icon-btn danger" data-rm="bahasan" data-i="${i}" title="Hapus pembahasan">${ic('trash-2')}</button>
      </div>
      <textarea data-f="isi" rows="3" placeholder="Tulis poin-poin pembahasan, satu poin per baris…">${esc(b.isi)}</textarea>
      <p class="bh-hint">Setiap baris akan dicetak sebagai satu poin di dalam kotak pembahasan.</p>
    </div>`).join('') || emptyInline('Belum ada pembahasan. Klik "Tambah pembahasan".');
}

function arrOf(kind) {
  return kind === 'peserta' ? state.peserta : kind === 'tindak' ? state.tindak : state.bahasan;
}

/** Sinkronkan perubahan input dinamis ke state secara langsung (tanpa render ulang). */
function syncDyn(kind, e) {
  const field = e.target.dataset.f;
  const row = e.target.closest('[data-i]');
  if (!field || !row) return;
  const item = arrOf(kind)[+row.dataset.i];
  if (!item) return;
  item[field] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
}

function bindDyn() {
  const boxes = { '#peserta-list': 'peserta', '#tindak-list': 'tindak', '#bahasan-list': 'bahasan' };
  Object.entries(boxes).forEach(([sel, kind]) => {
    const box = $(sel);
    box.addEventListener('input',  e => syncDyn(kind, e));
    box.addEventListener('change', e => syncDyn(kind, e));
    box.addEventListener('click', e => {
      const btn = e.target.closest('[data-rm]');
      if (!btn) return;
      arrOf(kind).splice(+btn.dataset.i, 1);
      renderDyn();
    });
  });

  $$('[data-add]').forEach(btn => btn.addEventListener('click', () => {
    const kind = btn.dataset.add;
    if (kind === 'peserta')      state.peserta.push({ nama: '', hadir: true });
    else if (kind === 'tindak')  state.tindak.push({ id: uid(), uraian: '', pic: '', tenggat: '', status: 'Terbuka' });
    else                         state.bahasan.push({ judul: '', isi: '' });
    renderDyn();
    $(`#${kind}-list`).lastElementChild?.querySelector('input')?.focus();
  }));
}

function collectMeeting() {
  const f = $('#form-meeting');
  const o = { id: state.current || '' };
  FIELDS.forEach(k => { o[k] = (f[k].value || '').trim(); });
  o.peserta    = state.peserta.filter(p => (p.nama || '').trim());
  o.tindak     = state.tindak.filter(t => (t.uraian || '').trim());
  o.pembahasan = state.bahasan
    .map(b => ({ judul: (b.judul || '').trim(), isi: (b.isi || '').trim() }))
    .filter(b => b.judul || b.isi);
  return o;
}

async function saveMeeting(e) {
  e.preventDefault();
  const m = collectMeeting();
  if (!m.judul || !m.tanggal) return toast('Judul dan tanggal wajib diisi');

  const btn = $('#form-meeting button[type="submit"]');
  btn.disabled = true;
  try {
    const { id } = await API.call('saveMeeting', { meeting: m });
    toast('Notulen tersimpan');
    await loadMeetings();
    await openMeeting(id);
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
  }
}

async function deleteMeeting() {
  if (!state.current) return;
  if (!confirm('Hapus rapat ini beserta seluruh tindak lanjutnya? Tindakan ini tidak dapat dibatalkan.')) return;
  try {
    await API.call('deleteMeeting', { id: state.current });
    toast('Rapat dihapus');
    await loadMeetings();
    showPage('list');
  } catch (err) {
    toast(err.message);
  }
}

/* ---------- Cetak notulen (berita acara) ---------- */
const lines = (text) => String(text || '').split('\n').map(s => s.trim()).filter(Boolean);

function minutesHTML(m) {
  const hadir = m.peserta.filter(p => p.hadir).length;
  const keputusan = lines(m.keputusan);

  const bahasan = m.pembahasan.length
    ? m.pembahasan.map((b, i) => {
        const poin = lines(b.isi);
        return `
        <div class="bh-box">
          <div class="bh-title"><span class="bh-no">${i + 1}</span><b>${esc(b.judul || 'Pembahasan ' + (i + 1))}</b></div>
          ${poin.length ? `<ul>${poin.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
        </div>`;
      }).join('')
    : '<p>-</p>';

  return `
  <div class="doc">
    <h1>NOTULEN RAPAT</h1>
    <h2>${esc(m.judul)}</h2>

    <table class="meta">
      <tr><td>Hari / Tanggal</td><td>${esc(fmtTanggal(m.tanggal))}</td></tr>
      <tr><td>Waktu</td><td>${esc(m.waktu || '-')}</td></tr>
      <tr><td>Tempat</td><td>${esc(m.tempat || '-')}</td></tr>
      <tr><td>Pimpinan Rapat</td><td>${esc(m.pimpinan || '-')}</td></tr>
      <tr><td>Notulis</td><td>${esc(m.notulis || '-')}</td></tr>
    </table>

    <h3>Daftar Hadir (${hadir} dari ${m.peserta.length} peserta)</h3>
    <table class="grid">
      <tr><th style="width:44px">No</th><th>Nama</th><th style="width:140px">Kehadiran</th></tr>
      ${m.peserta.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.nama)}</td><td>${p.hadir ? 'Hadir' : 'Tidak hadir'}</td></tr>`).join('')
        || '<tr><td colspan="3">-</td></tr>'}
    </table>

    <h3>Agenda</h3>
    ${lines(m.agenda).map(l => `<p>${esc(l)}</p>`).join('') || '<p>-</p>'}

    <h3>Pembahasan</h3>
    ${bahasan}

    <h3>Keputusan</h3>
    ${keputusan.length ? `<ol>${keputusan.map(k => `<li>${esc(k)}</li>`).join('')}</ol>` : '<p>-</p>'}

    <h3>Tindak Lanjut</h3>
    <table class="grid">
      <tr><th style="width:44px">No</th><th>Uraian</th><th>PIC</th><th style="width:120px">Tenggat</th><th style="width:90px">Status</th></tr>
      ${m.tindak.map((t, i) => `
        <tr><td>${i + 1}</td><td>${esc(t.uraian)}</td><td>${esc(t.pic || '-')}</td>
        <td>${esc(t.tenggat ? fmtTanggalSingkat(t.tenggat) : '-')}</td><td>${esc(t.status)}</td></tr>`).join('')
        || '<tr><td colspan="5">-</td></tr>'}
    </table>

    <div class="sign">
      <div>Notulis<br><br><br><br>( ${esc(m.notulis || '.......................')} )</div>
      <div>Pimpinan Rapat<br><br><br><br>( ${esc(m.pimpinan || '.......................')} )</div>
    </div>
  </div>`;
}

function printMinutes() {
  $('#print-area').innerHTML = minutesHTML(collectMeeting());
  window.print();
}

/* ---------- Laporan ---------- */
function setDefaultRange() {
  const f = $('#form-report');
  const t = today();
  f.from.value = t.slice(0, 8) + '01';
  f.to.value = t;
}

async function runReport(e) {
  if (e) e.preventDefault();
  const f = $('#form-report');
  const from = f.from.value, to = f.to.value;
  if (!from || !to) return toast('Pilih rentang tanggal');
  if (from > to) return toast('Tanggal awal tidak boleh setelah tanggal akhir');
  try {
    state.report = await API.call('report', { from, to });
    renderReport();
  } catch (err) {
    toast(err.message);
  }
}

function reportHTML(r) {
  const s = r.summary;
  const periode = `${fmtTanggal(r.from)} s.d. ${fmtTanggal(r.to)}`;

  const rapatRows = r.meetings.map(m => `
    <tr>
      <td>${esc(fmtTanggalSingkat(m.tanggal))}</td>
      <td><b>${esc(m.judul)}</b>${m.tempat ? `<br><span class="small muted">${esc(m.tempat)}</span>` : ''}</td>
      <td>${esc(m.pimpinan || '-')}</td>
      <td>${m.hadir}/${m.totalPeserta}</td>
      <td>${m.keputusan.length}</td>
      <td>${m.jumlahTindak}</td>
    </tr>`).join('');

  const tindakRows = r.tindak.map(t => `
    <tr class="${t.overdue ? 'overdue' : ''}">
      <td>${esc(t.judulRapat)}</td>
      <td>${esc(t.uraian)}</td>
      <td>${esc(t.pic || '-')}</td>
      <td>${esc(t.tenggat ? fmtTanggalSingkat(t.tenggat) : '-')}</td>
      <td>
        <span class="badge ${t.status === 'Selesai' ? 'b-final' : 'b-draft'}">${esc(t.status)}</span>
        ${t.overdue ? '<span class="badge b-danger">Lewat tenggat</span>' : ''}
      </td>
    </tr>`).join('');

  const kepBlocks = r.meetings.filter(m => m.keputusan.length).map(m => `
    <div class="kep" style="--c:${colorFor(m.id)}">
      <b>${esc(m.judul)}</b> <span class="small muted">· ${esc(fmtTanggalSingkat(m.tanggal))}</span>
      <ol>${m.keputusan.map(k => `<li>${esc(k)}</li>`).join('')}</ol>
    </div>`).join('');

  return `
  <div class="report-doc">
    <header class="report-head">
      <h2>LAPORAN RAPAT</h2>
      <p class="muted">Periode: ${esc(periode)}</p>
    </header>

    <div class="stats">
      ${statCard('Total rapat', s.rapat, 'calendar-days', '#6366f1')}
      ${statCard('Keputusan', s.keputusan, 'gavel', '#10b981')}
      ${statCard('Tindak lanjut', s.tindak, 'list-checks', '#0ea5e9')}
      ${statCard('Selesai', s.selesai, 'check-circle', '#14b8a6')}
      ${statCard('Terbuka', s.terbuka, 'clock', '#f59e0b')}
      ${statCard('Lewat tenggat', s.lewat, 'triangle-alert', '#f43f5e')}
    </div>

    <h3 class="h-sec">${ic('layout-list')} Rekap Rapat</h3>
    ${r.meetings.length
      ? `<div class="table-wrap"><table class="table">
           <thead><tr><th>Tanggal</th><th>Rapat</th><th>Pimpinan</th><th>Hadir</th><th>Keputusan</th><th>Tindak lanjut</th></tr></thead>
           <tbody>${rapatRows}</tbody></table></div>`
      : emptyInline('Tidak ada rapat pada periode ini.')}

    <h3 class="h-sec">${ic('gavel')} Keputusan</h3>
    ${kepBlocks || emptyInline('Belum ada keputusan tercatat pada periode ini.')}

    <h3 class="h-sec">${ic('clipboard-list')} Status Tindak Lanjut</h3>
    ${r.tindak.length
      ? `<div class="table-wrap"><table class="table">
           <thead><tr><th>Rapat</th><th>Uraian</th><th>PIC</th><th>Tenggat</th><th>Status</th></tr></thead>
           <tbody>${tindakRows}</tbody></table></div>`
      : emptyInline('Tidak ada tindak lanjut pada periode ini.')}
  </div>`;
}

function renderReport() {
  const html = reportHTML(state.report);
  $('#report-body').innerHTML = html;
  $('#print-area').innerHTML = html;
  icons();
}

/* ---------- Inisialisasi ---------- */
function bind() {
  $('#form-login').addEventListener('submit', login);
  $('#btn-pw').addEventListener('click', togglePw);
  ['#btn-logout', '#btn-logout-m'].forEach(sel => $(sel).addEventListener('click', () => logout()));

  $$('[data-nav]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.nav === 'list') { loadMeetings(); showPage('list'); }
    else { showPage('report'); runReport(); }
  }));

  $('#btn-new').addEventListener('click', () => fillEditor(null));
  $('#tab-add').addEventListener('click', () => fillEditor(null));
  $('#btn-back').addEventListener('click', () => { loadMeetings(); showPage('list'); });

  $('#search').addEventListener('input', renderList);
  $('#meeting-list').addEventListener('click', e => {
    const card = e.target.closest('.meeting-card');
    if (card) openMeeting(card.dataset.id);
  });
  $('#meeting-list').addEventListener('keydown', e => {
    const card = e.target.closest('.meeting-card');
    if (card && e.key === 'Enter') openMeeting(card.dataset.id);
  });

  $('#form-meeting').addEventListener('submit', saveMeeting);
  $('#btn-delete').addEventListener('click', deleteMeeting);
  $('#btn-print-minutes').addEventListener('click', printMinutes);

  $('#form-report').addEventListener('submit', runReport);
  $('#btn-print').addEventListener('click', () => {
    if (!state.report) return toast('Tampilkan laporan terlebih dahulu');
    window.print();
  });

  bindDyn();
  window.addEventListener('session-expired', () => {
    toast('Sesi habis, silakan masuk kembali');
    logout(true);
  });
}

async function init() {
  bind();
  if (sessionStorage.getItem('token')) {
    try {
      state.user = await API.call('me');
      await enterApp();
      return;
    } catch (_) {
      sessionStorage.clear();
    }
  }
  showView('view-login');
}

document.addEventListener('DOMContentLoaded', init);
