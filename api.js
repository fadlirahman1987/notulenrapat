/**
 * Lapisan komunikasi dengan backend Google Apps Script.
 * Memakai Content-Type text/plain agar tidak memicu preflight CORS.
 */
const API = {
  async call(action, payload = {}) {
    const token = sessionStorage.getItem('token') || '';
    let res;
    try {
      res = await fetch(APP_CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token, ...payload }),
      });
    } catch (_) {
      throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet.');
    }

    let json;
    try { json = await res.json(); }
    catch (_) { throw new Error('Respons server tidak valid. Pastikan URL API benar.'); }

    if (!json.ok) {
      if (json.code === 'SESSION') window.dispatchEvent(new Event('session-expired'));
      throw new Error(json.error || 'Terjadi kesalahan');
    }
    return json.data;
  },
};
