# Rencana Recreate Project Training — PT BMC

Dokumen rencana untuk membangun ulang aplikasi Training (sebelumnya PHP/MySQL/Skydash) dengan stack modern. Buka/buat di lokasi lain.

## 1. Tujuan

- Rebuild aplikasi Training PT BMC dari PHP (Skydash/Bootstrap 4) ke **React + Vite + Tailwind CSS**.
- Backend **Express.js (Node.js)**.
- Database **SQL Server** (migrasi dari MySQL).
- Desain profesional, warna **primary putih** dan **secondary navy**, dengan transisi animasi yang halus.

## 2. Stack Target

| Lapisan    | Teknologi                                   |
|------------|---------------------------------------------|
| Frontend   | React 18+, Vite, Tailwind CSS, React Router |
| Backend    | Express.js (Node.js), REST API              |
| Database   | SQL Server (mssql), ORM: Prisma/Knex        |
| Auth       | JWT (+ refresh token), bcrypt password hash |
| Build      | npm / pnpm, Vite                            |

## 3. Inventaris Fitur Aplikasi Lama (harus dipetakan)

### Admin (`admin/`)
- Dashboard beranda
- Kelola acara/training (`training_schedule_input`, `training_daftar_acara`, `training_proses_acara`)
- Kelola peserta (`training_peserta_input`, `training_proses_peserta`, `delete_peserta`)
- Daftar hadir (`training_daftar_hadir`, `training_proses_kehadiran`)
- Kelola soal pilihan ganda (`training_soal_*, training_daftar_soal*`)
- Kelola soal essay (`training_essay_*`)
- Koreksi jawaban / essay (`training_koreksi_jawaban*`)
- Feedback user & trainer (`training_feedback_*`, `training_hasil_feedback*`)
- Blast WhatsApp (undangan/sertifikat, `blast_wa*`, `training_blast_wa`)
- Cetak undangan (`training_cetak_undangan`)
- Report (`training_report*`)
- QR code (phpqrcode)

### User (`user/`)
- Absen foto (`training_absen_input`, `training_absen_insert`)
- Isi jawaban PQ (`training_jawab_input`, `training_jawab_insert`)
- Isi jawaban essay (`training_jawab_essay_*`)
- Feedback (`training_feedback`, `training_proses_feedback`)
- Sertifikat cetak (`sertifikat_cetak`)
- Thank you page (`thankyou`)

### Auth
- `training_login(_2).php` → `training_auth.php` → session `NONIK`
- **Baru**: login diverifikasi dari tabel SQL Server `hris_employee`; **password awal = tanggal lahir**; role **admin** = departemen **Human Capital**.

- Legacy dump resmi ditemukan di `training.sql` (MariaDB `10.4.28`). File ini belum dimuat ke SQL Server.
- `training.sql` tidak boleh dieksekusi langsung pada SQL Server. Ia hanya sumber inventaris dan migrasi setelah masking, mapping, serta approval DBA.

### DB `training` (koneksi `$local`)
| Tabel                | Kolom (inferensi dari kode)                                      |
|----------------------|------------------------------------------------------------------|
| `schedule_creator`   | `NONIK` (PK), `PASSWORD` — dipakai login                            |
| `acara`              | `id`, `judul`, `tgl`, `sasaran1`, `materi_pokok`, `waktu_mulai`, `waktu_selesai`, `ruangan`, `trainer` |
| `ruang_acara`        | `id`, `nama_ruangan`                                             |
| `peserta_acara`      | `id`, `id_acara`, `tgl`, `nik_peserta`, `departemen`, `blast` (0/1/2) |
| `absensi_training`   | `id`, `id_acara`, `nik_peserta`, `foto`, `tgl`                   |
| `induk_master_soal`  | `id_soal`, `id_acara`, `id_trainer`, `tgl`, `jenis`, `jumlah_soal` |
| `master_soal`        | `id`, `id_induk`, `jenis`, `nomor_soal`, `pertanyaan`, `A..D`, `kunci_jawaban`, `nama`, `point` |
| `essay`              | `id`, `id_induk`, `nomor_soal`, `pertanyaan`, `nama`, extra 2 kolom |
| `jawaban_user`       | `id`, `id_induk`, `nomor_soal`, `jawaban`, `kunci_jawaban`, `nik_peserta`, `jenis`, `point` |
| `essay_jawaban_user` | `id`, `id_induk`, `nomor_soal`, `jawaban`, `nik_peserta`, `jenis`, `nilai` |
| `user_feedback`      | `id`, `id_acara`, `nik_peserta`, `Tempat_Pelaksanaan_Training`, `Peralatan_Perlengkapan_Training`, `Konsumsi_Snack`, + nilai aspek lain, `keterangan`, `tgl` (detail cek file) |
| `trainer_feedback`   | `id`, `id_acara`, `nik_peserta`, `Sikap_Perilaku_Peserta`, `Keaktifan_Peserta`, `Keterbukaan_Peserta`, + nilai aspek lain, `keterangan`, `tgl` |
| `feedback`           | `nik`, `departemen`, `keterangan`                                |

### DB `hc` / `budget` (koneksi `$roaming`, server 192.168.10.51) — BACA SAJA
- `hc.KARYAWAN`: `NONIK`, `NM_KAR`, `telp`, `sex`, `KODEF`, `KELUAR`
- `hc.departemen`: `KODEF`, `NMDEF`
- `budget.tarif`: `KODEF`, `NMDEF`

> **Catatan (info terbaru):** di lingkungan baru, data karyawan/jabatan berpindah ke SQL Server:
> - **`hris_employee`** — login + data pribadi. **Login pakai `NIP`**, password awal = `BirthDate` format **YYMMDD**, role admin = **`DepartID = 0300`** (Human Capital).
> - **`hris_employeecareerpath`** — jabatan: `Id_CareerPath`, `NIP`, `Id_Jobtitle`, `Jobtitle`, `StartDate`, `EndDate`, `DeptCode`, `CategoryName`, `is_Archive`, `InputDate`, `DeptCodeOld`, `Id_Section`, `Id_ProdJobtitle`, `Id_Category_Old`.
>
> Mapping lama → baru diverifikasi saat migrasi (NONIK lama ≈ `NIP` baru).

## 5. Strategi Migrasi Data → SQL Server

1. Buat DB baru `Training` di SQL Server.
2. Buat skrip DDL SQL Server untuk semua tabel dari inventaris di atas.
   - Semua `id` auto-increment → `INT IDENTITY(1,1) PRIMARY KEY`.
   - Tambah FK: `peserta_acara.id_acara → acara.id`, `absensi.id_acara → acara.id`, dll.
   - Normalisasi: `nik_peserta`, `departemen` sebagai kolom (bukan relasi) karena data karyawan dari sistem lain.
3. Migrasi data (2 opsi):
   - **Opsional A (recommended)**: script Node.js/Prisma `seed` — konek MySQL lama + SQL Server baru, salin batch-by-batch.
   - **Opsional B**: `mysqldump` → transform SQL → impor SSMS/Bulk Insert.
4. Login baru memakai akun dari `hris_employee` (SQL Server): verifikasi `NIP` + password (`BirthDate` format YYMMDD sebagai password awal); role admin dari `DepartID = 0300` (Human Capital).
5. Verifikasi jumlah baris per tabel (count source == count target).

## 6. Arsitektur Folder Baru (monorepo sederhana)

```
training-app/
├── client/                 # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/admin/
│   │   ├── pages/user/
│   │   ├── api/            # axios/fetch client
│   │   ├── contexts/       # auth
│   │   └── utils/
├── server/                 # Express.js
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── db/             # koneksi mssql / prisma
│   │   ├── middleware/     # auth JWT, role
│   │   └── utils/
│   └── .env                # DB + JWT secret
└── docs/
```

## 7. Rancangan API (REST)

Prefix `/api`.
- `POST /auth/login` — cek NIP + password (`hris_employee.BirthDate` format YYMMDD), kirim JWT (role admin jika `DepartID = 0300`)
- `POST /auth/logout`
- `GET /acara` · `POST /acara` · `GET /acara/:id`
- `GET/POST/DELETE /acara/:id/peserta`
- `GET/POST /acara/:id/absensi` (foto → upload)
- `GET/POST /acara/:id/soal` (master_soal, essay)
- `POST /soal/:idInduk/jawaban` (jawaban_user / essay_jawaban_user)
- `GET/POST /acara/:id/feedback/user` · `/feedback/trainer` (skala 1–5)
- `POST /acara/:id/blast-wa`
- `GET /acara/:id/report/*` (kehadiran, hasil ujian, feedback, ringkasan per departemen)
- `GET /karyawan?q=` (read-only dari `hris_employee`)
- `GET /jabatan` (dari `hris_employeecareerpath`)

## 8. Desain UI

- **Warna**: primary `#FFFFFF` (putih), secondary navy `#0A2942` / `#1B3A5C`.
- Tailwind config: custom `colors.primary`, `colors.navy` + variasi `navy-50..900`.
- Tipografi: font sans modern (Inter/Poppins), heading bold.
- Komponen: Reusable (Button, Card, Table, Modal, Form Field, Sidebar, Navbar, StatCard).
- Transisi halus:
  - Route transitions (fade/slide) via `framer-motion` atau CSS transition.
  - Hover card lift + shadow.
  - Sidebar collapse animasi.
  - Skeleton loading saat fetch data.
  - Toast notifikasi (mis. `react-hot-toast`).

## 9. Catatan Keamanan (improve dari versi lama)

- [ ] Login verifikasi di `hris_employee`; password awal = tanggal lahir, simpan/bandingkan sebagai hash (bcrypt) saat pertama login.
- [ ] Semua query pakai parameterized (Prisma/Knex) — versi lama rawan SQL injection.
- [ ] JWT + middleware role admin/user.
- [ ] Validasi input server-side (express-validator / zod).
- [ ] Upload absensi/foto: validasi tipe & ukuran file, simpan nama unik.
- [ ] .env untuk kredensial (jangan commit).

## 9a. Feedback

- Skala penilaian **1–5** untuk tiap aspek (`user_feedback`, `trainer_feedback`).

## 10. Roadmap

1. Scaffold `client` (Vite+React+Tailwind) & `server` (Express+mssql/Prisma).
2. DDL SQL Server + script migrasi data + verifikasi.
3. Halaman login (auth JWT) — gantikan `training_login`/`training_auth`.
4. Layout admin (sidebar + navbar navy/putih) + dashboard.
5. Modul acara → peserta → absensi.
6. Modul soal (PG + essay) → koreksi → report.
7. Modul feedback user/trainer + hasil.
8. Modul blast WA + cetak undangan/sertifikat + QR.
9. Polish transisi UI, uji role user & admin, deploy.

## 11. Daftar Cek Awal

- [ ] Spek `schedule_creator`, `acara`, `ruang_acara` dari DB asli (dumping skema saat akses tersedia).
- [ ] Struktur lengkap kolom `user_feedback` / `trainer_feedback` (dari file atau DB).
- [ ] Mapping jelas; lanjut setujui data sampel & izin baca DB HR untuk pengembangan.
- [ ] Template undangan & sertifikat: **desain baru modern** (bukan template lama).
- [ ] Koneksi ke `hc`/`budget` read-only di lingkungan baru.