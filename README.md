# Notulen Rapat

Aplikasi web untuk mencatat notulen rapat, mengelola tindak lanjut, dan mencetak laporan periodik.

- **Frontend**: HTML, CSS, JavaScript murni → di-host di GitHub Pages
- **Backend**: Google Apps Script (Web App) sebagai API
- **Database**: Google Spreadsheet (sheet `Users`, `Rapat`, `TindakLanjut`)
- **Keamanan**: login username + password, password di-hash (SHA-256 + salt + 5.000 putaran), sesi token 4 jam, kunci sementara setelah 5 kali gagal

## Struktur file

```
notulen-rapat/
├── index.html    # Halaman utama (login + aplikasi)
├── style.css     # Design system
├── config.js     # URL API (diisi setelah deploy)
├── api.js        # Komunikasi ke backend
├── app.js        # Logika aplikasi
├── Code.gs       # Backend — tempel ke Apps Script
└── README.md
```

## Fitur

| Fitur | Keterangan |
|---|---|
| Login | Username & password, sesi berakhir otomatis |
| Daftar rapat | Kartu rapat, pencarian, indikator tindak lanjut terbuka |
| Notulen | Info rapat, peserta & kehadiran, agenda, pembahasan, keputusan, tindak lanjut (PIC, tenggat, status) |
| Cetak notulen | Format berita acara A4 dengan tanda tangan notulis & pimpinan |
| Laporan | Rentang tanggal, ringkasan angka, rekap rapat, daftar keputusan, status tindak lanjut; tindak lanjut lewat tenggat ditandai merah |
| Cetak / PDF | Laporan dapat dicetak atau disimpan sebagai PDF lewat dialog cetak browser |

---

## Langkah pemasangan

### 1. Buat Google Spreadsheet
1. Buat spreadsheet baru di Google Sheets (misalnya "DB Notulen Rapat").
2. Salin **ID** spreadsheet dari URL: `https://docs.google.com/spreadsheets/d/`**`ID_DI_SINI`**`/edit`.

### 2. Pasang backend
1. Di spreadsheet: **Extensions → Apps Script**.
2. Hapus isi file default, lalu tempel seluruh isi `Code.gs`.
3. (Opsional) Isi `SHEET_ID` di bagian `CONFIG` dengan ID dari langkah 1. Jika script dibuat dari dalam spreadsheet, biarkan kosong.
4. Pilih fungsi **`setupSistem`** lalu klik **Run**. Berikan izin akses saat diminta.
5. Ganti password default di fungsi **`buatAdminAwal`**, lalu pilih fungsi itu dan klik **Run**. Akun admin dibuat dengan username `admin`.
6. Hapus atau ubah password di kode setelah dipakai. Password tidak disimpan dalam bentuk teks biasa.

### 3. Deploy Web App
1. Klik **Deploy → New deployment**.
2. Pilih tipe **Web app**.
3. **Execute as**: *Me* (akun pemilik spreadsheet).
4. **Who has access**: *Anyone*. Akses tetap dijaga oleh login aplikasi.
5. Klik **Deploy**, lalu salin **Web app URL** (berakhiran `/exec`).

> Setiap kali `Code.gs` diubah, lakukan **Deploy → Manage deployments → Edit → New version**. Jika tidak, perubahan tidak aktif.

### 4. Hubungkan frontend
Buka `config.js` dan ganti nilai `API_URL` dengan Web App URL dari langkah 3.

### 5. Publish di GitHub Pages
1. Buat repository baru di GitHub, misalnya `notulen-rapat`. Repository boleh **Public** karena data ada di Spreadsheet dan hanya diakses lewat login. Gunakan **Private** jika GitHub Pages tersedia untuk akun Anda.
2. Upload semua file (`index.html`, `style.css`, `config.js`, `api.js`, `app.js`). `Code.gs` tidak perlu diupload ke repo publik, karena berisi logika backend (simpan di Apps Script).
3. Buka **Settings → Pages**, lalu pilih **Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Aplikasi tersedia di `https://<username>.github.io/notulen-rapat/`.

---

## Keamanan — checklist

- [ ] Ganti password `admin` default sebelum dipakai.
- [ ] Bagikan **Spreadsheet** hanya ke pemilik. Sheet `Users` berisi hash password dan salt.
- [ ] Jangan bagikan project Apps Script ke orang lain (mereka bisa membaca dan mengubah kode).
- [ ] Buat akun terpisah untuk setiap notulis: jalankan `buatUser('budi', 'Budi Santoso', 'notulis', 'PasswordKuat#1')` di Apps Script.
- [ ] Ganti password: `gantiPassword('budi', 'PasswordBaru#2')`.
- [ ] Nonaktifkan akun yang sudah tidak dipakai: `nonaktifkanUser('budi')`.
- [ ] Gunakan password minimal 12 karakter dengan kombinasi huruf, angka, dan simbol.

**Catatan:**
- Apps Script dibatasi kuota Google. Untuk pemakaian internal kecil, ini cukup.
- Login dikunci per username setelah 5 kali gagal selama 15 menit. Kunci ini memakai cache sementara sehingga tidak permanen.
- Role `admin` dapat mengubah atau menghapus rapat milik siapa pun. Role `notulis` hanya dapat mengubah atau menghapus rapat miliknya sendiri.

## Pengembangan lanjutan (opsional)

- Unggah lampiran notulen ke Google Drive.
- Notifikasi email ke PIC untuk tindak lanjut yang mendekati tenggat (gunakan Time-driven trigger di Apps Script).
- Ekspor laporan ke file Excel dengan membuat fungsi tambahan di backend.
