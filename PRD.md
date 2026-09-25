---
title: PRD Aplikasi Training dan Refreshment Karyawan PT BMC
version: 0.2
status: Draft
date_created: 2026-09-25
last_updated: 2026-09-25
source: RECREATION_PLAN.md
---

# PRD Aplikasi Training dan Refreshment Karyawan PT BMC

## 1. Ringkasan Eksekutif

### Masalah

Aplikasi training lama berbasis PHP, MySQL, dan Skydash memiliki workflow yang tersebar. Session authentication, input data manual, serta proses data antar tabel membuat administrasi, absensi, penilaian, feedback, laporan, dan komunikasi sulit dipantau.

### Solusi

Bangun aplikasi web internal berbasis React, Vite, Tailwind CSS, Express.js, dan SQL Server. Aplikasi menyediakan role admin Human Capital dan role user karyawan. Seluruh modul legacy dipetakan ke modular monolith dengan REST API, audit log, dan kontrol akses server-side.

### Tujuan produk

1. Menyatukan administrasi training dan refreshment dalam satu aplikasi.
2. Mengurangi input manual untuk peserta, absensi, soal, koreksi, feedback, dan laporan.
3. Menyediakan jejak audit untuk perubahan data operasional.
4. Mempermudah Human Capital mengelola acara dan membaca hasil evaluasi.
5. Memindahkan data historis aplikasi lama secara terkontrol ke SQL Server.

### Kriteria sukses

Kriteria berikut adalah target yang harus divalidasi melalui UAT. Angka adalah target engineering, bukan klaim hasil produksi.

| Area | Target |
|---|---|
| Autentikasi | Seluruh akun uji dengan NIP, initial password, dan role yang disetujui dapat login sesuai aturan |
| Migrasi | Count source dan target sama, atau selisih dijelaskan dan disetujui owner bisnis |
| Akses data | Seluruh skenario akses admin, user, dan resource di luar scope diuji dan diblokir sesuai role |
| Kualitas data | Tidak ada duplikasi absensi atau jawaban untuk kombinasi acara, peserta, dan soal yang sama |
| Alur inti | Login, membuat acara, menambah peserta, absen, menjawab soal, dan admin membaca hasil lulus pada E2E test |
| Operasional | Backup dan restore SQL Server, upload storage, serta konfigurasi aplikasi terdokumentasi dan diuji |
| Pengalaman | Halaman inti mobile tidak memiliki horizontal overflow; target WCAG 2.1 AA diuji pada komponen utama |

## 2. Keputusan yang Sudah Dikonfirmasi

- Deployment: Docker on-premise.
- Cakupan: seluruh modul legacy, termasuk WhatsApp, QR code, sertifikat, dan cetak undangan.
- Sumber data: SQL Server tersedia untuk aplikasi dan integrasi HR.
- Bahasa aplikasi dan dokumen: Indonesia.
- Trainer internal berasal dari `hris_employee`.
- Trainer eksternal diinput manual oleh admin.
- Jawaban peserta tidak dapat diubah setelah submit.
- Sertifikat berlaku 3 tahun sejak tanggal terbit, kecuali dicabut.
- QR code mengarah ke landing page pre-test dan post-test untuk acara terkait.
- Laporan tersedia di web. Export menggunakan PDF.
- Foto absensi dan seluruh jawaban peserta disimpan permanen.
- Mapping legacy `NONIK` ke `NIP` sudah dikonfirmasi.
- Tabel SQL Server yang sudah ada tetap read-only. Pembuatan tabel baru dengan prefix `training_` disetujui; setiap migration tetap wajib schema review dan review DBA sebelum dieksekusi.

## 3. Asumsi Kerja

- Database runtime training bernama `Training` atau nama final yang disetujui DBA.
- `hris_employee` dan `hris_employeecareerpath` diakses read-only.
- Data MySQL lama hanya menjadi sumber migrasi bila aksesnya disetujui.
- Provider WhatsApp ditentukan pada discovery. API key tidak diasumsikan.
- Detail minimum trainer eksternal masih TBD.
- Role login khusus trainer atau evaluator masih TBD.
- Timezone bisnis menggunakan `Asia/Jakarta`, pending konfirmasi DBA.
- Completion rule dan pass score sertifikat masih TBD.
- Retention feedback, audit log, dan message log masih TBD.

## 4. Pengguna dan Role

| Persona | Kebutuhan utama | Hak akses baseline |
|---|---|---|
| Admin Human Capital | Merencanakan acara, mengelola peserta, absensi, soal, koreksi, laporan, dan komunikasi | Semua modul operasional dengan pembatasan resource |
| Karyawan peserta | Melihat acara terdaftar, absen, menjawab soal, memberi feedback, dan mengunduh sertifikat | Data dan aksi milik NIP sendiri |
| Trainer internal | Trainer yang tercatat pada `hris_employee` | Akses data limited sesuai role final |
| Trainer eksternal | Trainer yang diinput manual oleh admin | Akses diberikan bila role login disetujui |
| DBA atau operator | Database, backup, access, dan deployment | Operasional, bukan pengguna aplikasi |

## 5. Ruang Lingkup

### Termasuk

- Login berbasis NIP.
- Password awal dari `hris_employee.BirthDate` dengan format `YYMMDD`.
- Role admin bila `DepartID = '0300'`, selain itu role user.
- Manajemen acara, ruang, tanggal, materi, sasaran, waktu, dan trainer.
- Pencarian trainer internal dari `hris_employee`.
- Input manual trainer eksternal.
- Pencarian karyawan dan jabatan dari SQL Server HR.
- Manajemen peserta per acara.
- Absensi foto oleh peserta.
- Landing page, pre-test, dan post-test sebagai tujuan QR.
- Soal pilihan ganda dan essay.
- Jawaban peserta yang tidak dapat diubah setelah submit.
- Koreksi nilai essay oleh admin tanpa mengubah isi jawaban.
- Feedback user dan trainer dengan skala 1 sampai 5.
- Laporan kehadiran, ujian, feedback, dan ringkasan departemen di web.
- Export laporan ke PDF.
- Undangan dan sertifikat dengan tampilan cetak.
- Sertifikat dengan masa berlaku 3 tahun.
- Blast WhatsApp untuk undangan dan sertifikat.
- Halaman thank you.
- Migrasi data legacy dengan rekonsiliasi.
- Audit log untuk login, mutasi, upload, koreksi, dan outbound message.

### Tidak Termasuk pada Versi Awal

- Aplikasi mobile native.
- Integrasi payroll atau penulisan data ke HR.
- AI, prediksi, atau rekomendasi otomatis.
- Multi-tenant untuk banyak perusahaan.
- Microservices terpisah.
- LMS streaming, gamifikasi, atau manajemen aset digital.
- Template visual warisan. Desain baru harus disetujui.

## 6. Modul dan Prioritas

| Modul | Prioritas | Hasil utama | Status |
|---|---:|---|---|
| Auth dan role | P0 | Login, logout, refresh, password change | Dalam scope |
| Acara dan ruang | P0 | CRUD acara, filter, publish, close | Dalam scope |
| Trainer | P0 | Trainer internal dari HR dan trainer eksternal manual | Dalam scope |
| Peserta | P0 | Tambah, hapus, cari, snapshot departemen | Dalam scope |
| Absensi foto | P0 | Absen sekali per peserta dan upload foto | File validation TBD; disimpan permanen |
| Pre-test dan post-test | P0 | Landing page QR dan akses setelah login | Dalam scope |
| Soal pilihan ganda | P0 | Set soal, opsi, kunci, point, jawaban | Penilaian otomatis |
| Essay | P0 | Soal, jawaban, nilai manual | Status koreksi |
| Feedback | P1 | Form user dan trainer, hasil per aspek | Skala 1 sampai 5 |
| Laporan | P1 | Kehadiran, ujian, feedback, departemen | Web dan export PDF |
| WhatsApp | P1 | Outbox, pengiriman, retry, status | Provider TBD |
| Dokumen | P1 | Undangan, sertifikat, QR, thank you | Template baru |
| Dashboard | P1 | Ringkasan acara dan pekerjaan tertunda | Data dari API |
| Audit dan observability | P0 | Log operasional dan kesehatan aplikasi | Retention TBD; foto dan jawaban permanen |

## 7. Alur Utama

### Alur admin

1. Admin login menggunakan NIP.
2. Sistem memverifikasi kredensial, initial password, status akun, dan role HR.
3. Admin membuat acara dan mengisi ruang, waktu, materi, sasaran, serta trainer.
4. Admin memilih trainer internal dari `hris_employee` atau mengisi trainer eksternal secara manual.
5. Admin mencari karyawan dari HR dan menambahkan peserta.
6. Admin mengirim undangan melalui WhatsApp atau mencetak undangan.
7. Peserta melakukan pre-test, absensi, menjawab soal, post-test, dan memberi feedback.
8. Admin memeriksa kehadiran, mengoreksi nilai essay, dan meninjau feedback.
9. Admin membuka laporan web, melakukan export PDF, dan menerbitkan sertifikat sesuai aturan penyelesaian.

### Alur peserta

1. Peserta login menggunakan akun HR.
2. Peserta memindai QR atau membuka halaman acara.
3. Peserta mengakses landing page pre-test dan post-test sesuai access policy.
4. Peserta melakukan absensi dengan foto.
5. Peserta menjawab soal pilihan ganda atau essay.
6. Setelah submit, jawaban peserta terkunci dan tidak dapat diubah.
7. Peserta memberikan feedback.
8. Peserta melihat status dan mengunduh sertifikat atau halaman thank you bila tersedia.

## 8. User Story dan Acceptance Criteria

| ID | User story | Acceptance criteria |
|---|---|---|
| US-001 | Sebagai admin, saya ingin membuat acara agar proses training terstruktur | Judul, tanggal, waktu, ruang, materi, sasaran, dan trainer tervalidasi; admin dapat melihat dan mengubah acara |
| US-002 | Sebagai admin, saya ingin menambahkan karyawan dari HR agar data tidak diketik manual | Pencarian NIP mengembalikan data read-only; snapshot nama, departemen, dan jabatan tersimpan; duplicate dicegah |
| US-003 | Sebagai peserta, saya ingin absen dengan foto agar kehadiran dapat diverifikasi | Hanya peserta terdaftar yang dapat absen; duplicate dicegah; file tervalidasi; waktu server dicatat; foto tersimpan permanen |
| US-004 | Sebagai peserta, saya ingin menjawab soal agar hasil pelatihan dapat diukur | Set soal tervalidasi; jawaban tersimpan atomik; setelah submit jawaban tidak dapat diubah oleh peserta |
| US-005 | Sebagai admin, saya ingin mengoreksi essay agar nilai peserta akurat | Nilai berada dalam rentang 0 sampai point maksimum; evaluator dan timestamp tersimpan; isi jawaban tidak berubah |
| US-006 | Sebagai peserta, saya ingin memberi feedback agar kualitas training dapat dinilai | Semua aspek wajib diisi dengan nilai 1 sampai 5; hanya satu feedback per acara |
| US-007 | Sebagai admin, saya ingin melihat laporan agar keputusan dapat diambil | Laporan web menampilkan kehadiran, nilai, feedback, dan agregasi departemen dengan filter jelas; export PDF tersedia |
| US-008 | Sebagai admin, saya ingin mengirim undangan dan sertifikat agar komunikasi lebih cepat | Pesan memiliki recipient, template, status, provider ID, dan log; retry tidak mengirim duplikat |
| US-009 | Sebagai peserta, saya ingin mengunduh sertifikat setelah menyelesaikan kegiatan | Sertifikat hanya tersedia setelah completion rule terpenuhi; valid 3 tahun sejak terbit; QR membuka halaman pre-test dan post-test |
| US-010 | Sebagai admin, saya ingin melihat jejak perubahan agar data dapat ditelusuri | Login, mutasi, upload, koreksi, dan outbound message memiliki aktor, aksi, entity, waktu, dan correlation ID |
| US-011 | Sebagai admin, saya ingin membedakan trainer internal dan eksternal agar data sesuai sumbernya | Trainer internal dipilih dari `hris_employee`; trainer eksternal diinput manual dan tidak melakukan pencarian NIP HR |

## 9. Kebutuhan Nonfungsional

Detail dan acceptance criteria ada di `SRS.md`.

- Security: parameterized query, bcrypt, JWT access dan refresh yang dapat direvoke, rate limit, authorization server-side, upload validation, secret management.
- Reliability: transaksi untuk jawaban dan koreksi, retry terbatas untuk WA, health check, backup, restore drill.
- Retention: foto absensi dan seluruh jawaban peserta disimpan permanen. Retention feedback, audit, dan message log ditetapkan owner sebelum production.
- Usability: bahasa Indonesia, loading, empty, error, success state, dan mobile participant flow.
- Accessibility: keyboard navigation, visible focus, label form, kontras WCAG AA pada komponen inti.
- Performance: target p95 API daftar 2 detik pada dataset dan concurrency yang disepakati.
- Auditability: mutasi bisnis dapat ditelusuri berdasarkan aktor, waktu server, entity, dan correlation ID.
- Portability: aplikasi berjalan melalui Docker Compose di jaringan internal.

## 10. Roadmap

### Fase 0: Discovery

- Verifikasi schema SQL Server dan akses read-only HR.
- Petakan kolom lengkap feedback dan aturan penyelesaian.
- Verifikasi field minimum trainer eksternal.
- Finalisasi landing page, pre-test, dan post-test yang menjadi tujuan QR.
- Finalisasi retention feedback, audit, dan message log.
- Finalisasi export PDF dan template dokumen.
- Tetapkan acceptance test, data fixture, dan environment.

### Fase 1: Foundation

- Scaffold monorepo client, server, contracts, dan Docker Compose.
- Konfigurasi lint, typecheck, test, environment, dan health check.
- Buat schema, constraint, index, dan migration baseline.

### Fase 2: Core pilot

- Auth dan role.
- Acara, ruang, trainer internal dan eksternal, peserta, dan absensi foto.
- Landing page, pre-test, dan post-test.
- Soal pilihan ganda, essay, jawaban, dan koreksi.
- Dashboard dan laporan dasar.

### Fase 3: Communication dan dokumen

- Feedback user dan trainer.
- WhatsApp outbox dan status pengiriman.
- Undangan, QR, sertifikat, dan thank you page.
- Export PDF serta audit report.

### Fase 4: UAT dan go-live

- Rekonsiliasi migrasi.
- UAT admin dan user.
- Security review, load smoke test, backup restore drill.
- Go-live, monitoring, dan rollback procedure.

## 11. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Schema sumber tidak lengkap | Migrasi gagal atau data salah | Schema discovery, sample data, mapping document, reconciliation |
| Initial password berbasis tanggal lahir | Risiko akses tidak sah | Hash saat first login, force password change, rate limit, jangan simpan plaintext |
| Provider WhatsApp belum ditentukan | Modul komunikasi tertunda | Provider adapter dan outbox |
| Foto dan jawaban disimpan permanen | Risiko privasi dan volume storage | Least privilege, audit, backup, legal review, no content logging |
| Template dokumen belum disetujui | Print dan sertifikat tertunda | Placeholder terlabel dan sign-off sebelum production |
| Role authorization trainer belum jelas | Otorisasi tidak aman | Trainer internal dan eksternal sudah dibedakan sebagai sumber data; role login default admin sampai disetujui |

## 12. Jawaban untuk Pertanyaan Nomor 11

1. **Trainer**: dibedakan menjadi internal dan eksternal. Internal berasal dari `hris_employee`. Eksternal diisi manual oleh admin.
2. **Jawaban peserta**: tidak dapat diubah setelah submit. Admin dapat mengoreksi nilai atau metadata yang diizinkan, tetapi tidak dapat mengubah isi jawaban.
3. **Sertifikat**: valid 3 tahun sejak tanggal terbit, kecuali dicabut.
4. **QR**: scan menuju landing page yang menampilkan akses pre-test dan post-test untuk acara terkait.
5. **Laporan**: format utama tersedia di web. Export memakai PDF.
6. **Penyimpanan**: foto absensi dan seluruh jawaban peserta disimpan permanen.

## 13. Pertanyaan yang Masih Terbuka

1. Apa field minimum untuk trainer eksternal?
2. Apa threshold serta aturan completion rule dan kelulusan untuk penerbitan sertifikat?
3. Apakah landing page, pre-test, dan post-test memerlukan login dan aturan akses berbeda?
4. Provider WhatsApp, template, dan environment credential apa yang disetujui?
5. Berapa lama feedback, audit, dan message log disimpan?
6. Apa target RTO, RPO, maintenance window, dan owner go-live?

## 14. Definition of Done Produk

Produk siap go-live bila:

- Acceptance criteria P0 dan P1 lulus.
- Migrasi source-to-target memiliki reconciliation report.
- Role admin dan user diuji pada API dan UI.
- Credential dan connection string tidak tersimpan di repository.
- Foto dan jawaban peserta memiliki retention permanen, backup, dan access control yang diuji.
- Error, loading, empty, mobile, dan keyboard flow diuji.
- Human Capital, DBA, Security, dan DevOps memberi sign-off.
