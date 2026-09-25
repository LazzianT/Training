# TODO Implementasi Aplikasi Training PT BMC

Status: Draft.
Sumber: `PRD.md`, `SRS.md`, `design.md`, `techstack.md`, `RECREATION_PLAN.md`.

## Cara Pakai

- `[ ]` belum selesai.
- `[x]` selesai dan sudah diverifikasi.
- `[!]` blocked. Tuliskan blocker pada `Notes`.
- Urutan penting. Jangan lanjutkan task bila dependency belum jelas.
- Jangan tandai selesai hanya karena kode ditulis. Wajib ada lint, typecheck, test, atau review evidence.

## Guardrail Data

- Existing SQL Server tables are read-only for this project.
- New application tables may be added under the `training_` namespace.
- Adding a new table is allowed after schema review, migration script review, and DBA approval.
- Never execute `ALTER`, `DROP`, `TRUNCATE`, `UPDATE`, `DELETE`, `INSERT`, `MERGE`, or other schema/data changes against existing tables without explicit written approval.
- Legacy data migration reads source tables and writes only new target tables or staging tables.
- Any migration that requires changing an existing table is blocked until DBA review and approval.

## Definition of Done

- Requirement terkait terimplementasi.
- Unit, integration, dan E2E test untuk scope lulus.
- Server-side authorization dan validation diuji.
- Loading, empty, error, dan success state tersedia.
- Keyboard dan mobile flow diuji untuk perubahan UI.
- Tidak ada secret, raw SQL injection path, atau token di client bundle.
- Database migration, rollback strategy, dan data verification terdokumentasi.
- Dokumentasi operator diperbarui.

## 0. Discovery dan Keputusan Blocking

- [x] Konfirmasi hostname, environment, dan owner approval untuk deployment Docker on-premise. Target SQL Server terkonfirmasi; approval deployment final masih perlu.
- [x] Ambil schema SQL Server `BMC` dan nama server/database final. Target: `SVR-BMC-SQL`, database `BMC`.
- [x] Verifikasi read-only access ke `hris_employee`. Terbaca dengan user `.env`; current role `sa` adalah `db_owner`, jadi akses aplikasi harus dipisahkan dari credential discovery.
- [x] Verifikasi read-only access ke `hris_employeecareerpath`. Terbaca.
- [x] Ambil sample schema legacy `schedule_creator`, `acara`, dan `ruang_acara`. Sumber tersedia di `training.sql`.
- [x] Ambil sample schema legacy tabel feedback. Sumber tersedia di `training.sql`.
- [ ] Petakan `NONIK` legacy ke `NIP` baru. Mapping belum divalidasi.
- [x] Tentukan status aktif atau inaktif employee dari sumber HR. `hris_Employee.is_Active` tersedia.
- [ ] Tetapkan event lifecycle: draft, published, closed, archived.
- [ ] Tetapkan batas waktu submit jawaban.
- [ ] Tetapkan completion rule dan pass score sertifikat.
- [ ] Tetapkan role login trainer atau evaluator.
- [ ] Verifikasi field minimum trainer internal dan eksternal.
- [ ] Tetapkan daftar lengkap aspek feedback user dan trainer.
- [ ] Verifikasi output PDF untuk laporan.
- [ ] Tetapkan provider WhatsApp dan template QA.
- [ ] Finalisasi QR destination ke pre-test dan post-test.
- [x] Konfirmasi retention permanen foto dan jawaban.
- [ ] Tetapkan retention feedback, audit, dan message log.
- [ ] Tetapkan timezone `Asia/Jakarta` dan locale.
- [ ] Tetapkan browser internal minimum.
- [ ] Tetapkan RTO, RPO, backup window, dan restore owner.
- [ ] Sepakati acceptance test fixtures dan data masking.

**Exit:** TBD schema, auth, security, compliance, provider, PDF, dan retention yang menghalangi Phase 1 sudah diputuskan.

## 0A. Hasil Discovery 2026-09-25

### Environment

- Workspace awal berisi dokumen planning saja. Belum ada source aplikasi.
- Node.js `v24.14.1`, npm `11.11.0`, Corepack `0.34.6`, pnpm `12.6.0` tersedia melalui Corepack.
- Docker CLI `29.3.1` tersedia, tetapi Docker Desktop daemon belum berjalan.
- Target remote `10.19.25.27:1433` berhasil diakses. Server `SVR-BMC-SQL`, SQL Server `15.0.2000.5`, Standard Edition, database `BMC` online.
- User `.env` saat ini `sa`, database role `db_owner`, `db_datareader`, `db_datawriter`, dan `CONNECT`. Credential ini hanya untuk discovery; aplikasi production wajib memakai akun least privilege.
- Semua query discovery menggunakan `SELECT` dan metadata. Tidak ada perubahan tabel existing.
- Differential backup `BMC` tercatat terakhir pada `2026-09-25 11:47:08`, sekitar 4.19 GB.

### Database Discovery

- `hris_Employee`: 564 rows, 563 distinct NIP, 1 duplicate NIP group, 516 active, 48 inactive, 3 rows `DepartID = '0300'`.
- `hris_EmployeeCareerPath`: 1.425 rows, 426 distinct NIP, 999 archived, 426 non-archived.
- 138 employee belum memiliki career path. 425 employee memiliki current career path.
- Legacy schema dan data tersedia di `training.sql`, hasil dump MariaDB `10.4.28`, 15 tabel, 13 tabel berisi INSERT data, 27 statement ALTER.
- Dump belum dimuat ke SQL Server dan tidak boleh dieksekusi langsung karena syntax MariaDB, legacy password, NIP, jawaban, feedback, serta data training.
- Sumber legacy yang terkonfirmasi: `training.sql`. Tabel target SQL Server tetap read-only.
- Tabel baru aplikasi akan memakai prefix `training_` dan perlu approval DBA sebelum pembuatan.

### Blocker

- [ ] [BLOCKED] `training.sql` mengandung data sensitif. File tetap lokal dan tidak dipublikasikan ke GitHub.
- [ ] [BLOCKED] Migrasi legacy ke SQL Server belum dilakukan. Existing SQL Server tetap read-only.
- [ ] [BLOCKED] `sa` memiliki `db_owner`; belum tersedia read-only application account.
- [ ] [BLOCKED] Belum ada schema/table `training_` untuk aplikasi baru.
- [ ] [BLOCKED] Deployment Docker belum diverifikasi karena Docker daemon belum berjalan.

### Keputusan yang Masih Dibutuhkan

- [ ] Field minimum trainer eksternal.
- [ ] Role login trainer atau evaluator.
- [ ] Deadline pre-test, post-test, dan submit jawaban.
- [ ] Completion rule dan pass score sertifikat.
- [ ] Aspek feedback user dan trainer.
- [ ] Access policy QR: public, login, atau one-time token.
- [ ] Provider WhatsApp dan template.
- [ ] Retention feedback, audit, dan message log.
- [ ] Timezone, browser minimum, RTO/RPO, backup window, dan owner go-live.

## 1. Foundation Repository

- [x] Buat workspace root `training-app/`.
- [x] Inisialisasi pnpm workspace.
- [x] Tambahkan `client`, `server`, dan `packages/contracts`.
- [x] Tambahkan TypeScript strict config.
- [x] Tambahkan lint formatter serta scripts `lint`, `typecheck`, `test`, dan `build`.
- [x] Tambahkan `.env.example` tanpa nilai production.
- [x] Tambahkan `.gitignore` untuk `.env`, upload, build, coverage, dan `node_modules`.
- [x] Tambahkan runbook operator minimal.
- [ ] Tambahkan proprietary notice bila diwajibkan perusahaan.
- [x] Buat Dockerfile client dan server.
- [x] Buat `docker-compose.yml` baseline dengan persistent volume upload.
- [x] Tambahkan healthcheck `/health/live` dan `/health/ready`.
- [x] Tambahkan request ID middleware dan structured logger.
- [x] Tambahkan dependency audit script.

**Exit:** Fresh setup dapat menjalankan lint, typecheck, test, build, dan healthcheck. Docker image belum dapat dibangun karena Docker daemon belum berjalan.

## 2. Database Schema dan Migration

- [ ] Selesaikan spike Knex dan SQL Server.
- [ ] Dokumentasikan alasan pilihan ORM.
- [ ] Buat migration DDL SQL Server.
- [ ] Buat tabel `acara`.
- [ ] Buat tabel `ruang_acara`.
- [ ] Buat tabel `peserta_acara`.
- [ ] Buat tabel `absensi_training`.
- [ ] Buat tabel `induk_master_soal` dengan fase pre atau post.
- [ ] Buat tabel `master_soal`.
- [ ] Buat tabel `essay`.
- [ ] Buat tabel `jawaban_user`.
- [ ] Buat tabel `essay_jawaban_user`.
- [ ] Buat tabel feedback user.
- [ ] Buat tabel feedback trainer.
- [ ] Buat tabel notification outbox.
- [ ] Buat tabel certificate dengan `issued_at`, `expires_at`, dan status.
- [ ] Buat tabel audit log.
- [ ] Buat tabel user credential, session, dan revocation bila diperlukan.
- [ ] Tambahkan FK dan cascade behavior yang disetujui.
- [ ] Tambahkan unique constraint untuk event + NIP, set + question number, dan set + NIP + question.
- [ ] Tambahkan check constraint untuk score dan feedback scale.
- [ ] Tambahkan index date, event, NIP, status, dan department snapshot.
- [ ] Tambahkan kolom `trainer_type` dan detail trainer internal atau eksternal.
- [ ] Pastikan `trainer_nip` hanya diisi untuk trainer internal.
- [ ] Pastikan `expires_at` dihitung 3 tahun dari `issued_at`.
- [ ] Pastikan tabel jawaban tidak memiliki jalur update isi setelah submit.
- [ ] Tentukan soft delete atau archive policy.
- [ ] Tulis migration rollback atau documented forward-fix policy.
- [ ] Jalankan migration pada disposable SQL Server.
- [ ] Jalankan migration pada staging clone yang disetujui.

**Exit:** Schema tervalidasi DBA, migration repeatable, dan tidak ada FK orphan pada fixture.

## 3. Migration Data Legacy

- [ ] Buat inventory source dengan row count dan checksum.
- [ ] Buat mapping field legacy ke field baru.
- [ ] Tulis migration batch script dengan retry dan transaction control.
- [ ] Migrasikan ruang acara.
- [ ] Migrasikan acara.
- [ ] Migrasikan trainer existing ke `trainer_type` dan sumber yang sesuai.
- [ ] Migrasikan peserta acara.
- [ ] Migrasikan absensi dan foto bila tersedia.
- [ ] Migrasikan question set dan soal.
- [ ] Migrasikan jawaban peserta.
- [ ] Migrasikan feedback setelah aspect final.
- [ ] Migrasikan user credential bila kebijakan mengizinkan.
- [ ] Tulis validator count per tabel.
- [ ] Tulis validator duplicate.
- [ ] Tulis validator FK orphan.
- [ ] Tulis validator null dan enum.
- [ ] Tulis sample checksum untuk field kritis.
- [ ] Siapkan reconciliation report.
- [ ] Minta owner bisnis menyetujui perbedaan.

**Exit:** Count dan sample checksum explaining differences terdokumentasi, migration rerun aman, dan tidak ada data loss senyap.

## 4. Auth dan Authorization

- [ ] Buat password bootstrap adapter dari `hris_employee.BirthDate` format `YYMMDD`.
- [ ] Buat password hash dengan bcrypt cost minimal 12.
- [ ] Implementasikan initial password one-time replacement.
- [ ] Implementasikan access token berumur pendek.
- [ ] Implementasikan refresh token rotation.
- [ ] Hash atau secure-store refresh token.
- [ ] Implementasikan logout dan token revocation.
- [ ] Implementasikan change password.
- [ ] Tetapkan role admin dari `DepartID = '0300'`.
- [ ] Implementasikan role user default.
- [ ] Tambahkan `RouteGuard` dan server authorization.
- [ ] Tambahkan rate limit login per IP dan NIP.
- [ ] Tambahkan generic auth error.
- [ ] Tambahkan audit auth events.
- [ ] Tambahkan test token expiry, rotation, revoke, dan wrong role.

**Exit:** Admin/user authorization matrix lulus dan tidak ada route yang hanya mengandalkan client guard.

## 5. Shared API Contract

- [ ] Definisikan response envelope dan error shape.
- [ ] Definisikan pagination contract.
- [ ] Definisikan sorting allowlist.
- [ ] Definisikan common types di `packages/contracts`.
- [ ] Tambahkan schema auth.
- [ ] Tambahkan schema acara.
- [ ] Tambahkan schema trainer internal dan eksternal.
- [ ] Tambahkan schema peserta.
- [ ] Tambahkan schema absensi.
- [ ] Tambahkan schema pre-test dan post-test.
- [ ] Tambahkan schema soal dan jawaban immutable.
- [ ] Tambahkan schema feedback.
- [ ] Tambahkan schema laporan.
- [ ] Tambahkan schema PDF export.
- [ ] Tambahkan schema outbox.
- [ ] Tambahkan schema certificate dengan `expires_at`.
- [ ] Tambahkan schema health.
- [ ] Tambahkan request dan response contract tests.

**Exit:** Client dan server memakai contract yang sama atau generated artifact yang versioned.

## 6. Client Foundation

- [ ] Setup React, Vite, dan TypeScript.
- [ ] Setup Tailwind token white, navy, dan semantic colors.
- [ ] Setup router dan route guards.
- [ ] Setup request service dan auth header.
- [ ] Setup refresh-token interceptor tanpa infinite loop.
- [ ] Setup auth context dengan loading dan logout.
- [ ] Setup primitive Button, Field, Table, Badge, Modal, dan Toast.
- [ ] Setup AppShell desktop dan mobile.
- [ ] Implementasikan sidebar collapse accessible.
- [ ] Implementasikan topbar dan breadcrumb.
- [ ] Implementasikan global loading dan error boundary.
- [ ] Implementasikan visible focus.
- [ ] Implementasikan responsive table strategy.
- [ ] Tambahkan component test untuk primitive critical.

**Exit:** Client build lulus, route auth stabil, serta mobile dan keyboard baseline tersedia.

## 7. Admin Dashboard, Acara, Trainer, Peserta

- [ ] Buat dashboard summary endpoint minimal.
- [ ] Buat dashboard `Perlu ditinjau` untuk essay `pending` dan message failure.
- [ ] Buat halaman daftar acara.
- [ ] Buat filter tanggal, status, ruang, dan trainer.
- [ ] Buat form trainer internal dengan pencarian HR.
- [ ] Buat form trainer eksternal dengan input manual.
- [ ] Buat form acara dengan validation `trainer_type`.
- [ ] Buat form ruang dengan unique name validation.
- [ ] Implementasikan edit dan archive acara.
- [ ] Buat halaman detail acara.
- [ ] Buat search karyawan HR.
- [ ] Buat preview employee sebelum add.
- [ ] Tambahkan snapshot nama, departemen, dan jabatan.
- [ ] Cegah duplicate NIP per acara.
- [ ] Buat remove participant dengan confirmation.
- [ ] Implementasikan participant invitation status.

**Exit:** Admin dapat membuat acara, memilih sumber trainer, dan mengelola peserta tanpa access data di luar scope.

## 8. Absensi Foto

- [ ] Buat upload endpoint multipart.
- [ ] Validasi MIME allowlist.
- [ ] Validasi magic bytes.
- [ ] Validasi size dan dimensions.
- [ ] Generate UUID filename.
- [ ] Simpan ke private volume.
- [ ] Cegah duplicate attendance.
- [ ] Catat server timestamp.
- [ ] Buat user capture dan upload flow.
- [ ] Buat preview sebelum submit.
- [ ] Buat admin attendance table.
- [ ] Buat streaming route terotorisasi.
- [ ] Tambahkan invalid-file cleanup.
- [ ] Implementasikan policy retention permanen tanpa automatic delete.
- [ ] Tambahkan storage quota, disk alert, dan backup coverage.

**Exit:** File valid tersimpan permanen, file invalid ditolak, dan unauthorized user tidak dapat membaca file.

## 9. Pre-test, Post-test, Soal, Jawaban, Koreksi

- [ ] Buat question set CRUD dengan fase `pre` atau `post`.
- [ ] Buat landing page QR dengan status akses.
- [ ] Buat pre-test launcher.
- [ ] Buat post-test launcher.
- [ ] Buat multiple choice editor.
- [ ] Buat essay editor.
- [ ] Validasi jumlah soal dan point.
- [ ] Implementasikan publish set soal.
- [ ] Buat participant test launcher.
- [ ] Buat question navigation dan required state.
- [ ] Implementasikan atomic submit.
- [ ] Implementasikan locked read-only state setelah submit.
- [ ] Pastikan tidak ada endpoint update isi jawaban.
- [ ] Simpan jawaban pilihan ganda.
- [ ] Hitung hasil pilihan ganda di server.
- [ ] Simpan essay answers dengan status `pending`.
- [ ] Buat admin correction list.
- [ ] Buat correction form dengan min dan max score.
- [ ] Audit setiap correction.
- [ ] Buat report status koreksi.
- [ ] Tambahkan authorization test untuk jawaban peserta lain.

**Exit:** Tidak ada answer key leak, submit atomic, isi jawaban immutable, dan score reproducible dari server data.

## 10. Feedback dan Laporan

- [ ] Finalisasi aspect schema.
- [ ] Buat endpoint feedback user.
- [ ] Buat endpoint feedback trainer atau role evaluator.
- [ ] Validasi rating 1 sampai 5.
- [ ] Cegah duplicate feedback.
- [ ] Buat feedback form dinamis dari backend aspects.
- [ ] Buat admin feedback summary.
- [ ] Buat attendance report.
- [ ] Buat exam report.
- [ ] Buat feedback report.
- [ ] Buat department summary.
- [ ] Tambahkan date dan department filters.
- [ ] Implementasikan report preview di web.
- [ ] Implementasikan server-side PDF export.
- [ ] Validasi PDF signature, authorization, dan data scope.
- [ ] Tambahkan report authorization tests.

**Exit:** Angka report konsisten dengan source query, PDF dapat diunduh, dan user tidak dapat melihat report admin.

## 11. WhatsApp, QR, Dokumen

- [ ] Pilih WhatsApp provider.
- [ ] Simpan credentials di secret manager.
- [ ] Buat provider adapter.
- [ ] Buat outbox migration dan repository.
- [ ] Buat template renderer dengan escaping.
- [ ] Buat recipient selection flow.
- [ ] Buat preview sebelum blast.
- [ ] Implementasikan idempotency key.
- [ ] Implementasikan queue status lifecycle.
- [ ] Implementasikan bounded retry.
- [ ] Implementasikan dead-letter view admin.
- [ ] Buat invitation preview.
- [ ] Buat QR yang mengarah ke pre-test dan post-test landing page.
- [ ] Buat certificate preview dan print.
- [ ] Tampilkan `issued_at` dan `expires_at` 3 tahun.
- [ ] Implementasikan completion gate.
- [ ] Implementasikan certificate revoke dan status `expired`.
- [ ] Buat thank you page.
- [ ] Audit outbound message dan certificate issue.

**Exit:** Tidak ada duplicate message, QR destination dapat diverifikasi, dan certificate expired atau revoked ditolak.

## 12. Observability, Security, Operations

- [ ] Konfigurasi structured logging.
- [ ] Redact secret, password, token, dan sensitive payload.
- [ ] Tambahkan CORS allowlist.
- [ ] Tambahkan security headers.
- [ ] Tambahkan body dan request size limits.
- [ ] Tambahkan DB pool timeout dan graceful shutdown.
- [ ] Tambahkan dependency vulnerability scan.
- [ ] Tambahkan secret scan.
- [ ] Jalankan OWASP security review.
- [ ] Review authorization matrix.
- [ ] Review upload path traversal dan content spoofing.
- [ ] Review certificate dan QR enumeration.
- [ ] Setup backup SQL Server.
- [ ] Setup upload backup.
- [ ] Jalankan restore drill.
- [ ] Pastikan retention permanen foto dan jawaban tidak memiliki deletion job.
- [ ] Setup disk, DB, auth, dan outbox alerts.
- [ ] Tulis runbook incident login dan WA failure.
- [ ] Tulis rollback deployment dan migration recovery.

**Exit:** Security review P0 clean, backup restore teruji, dan runbook owner tersedia.

## 13. Testing dan Quality Gates

- [ ] Tulis unit tests auth, validation, scoring, rating, dan immutable answer.
- [ ] Tulis integration tests seluruh repository critical.
- [ ] Tulis API contract tests.
- [ ] Tulis migration validation tests.
- [ ] Tulis E2E admin create event dengan trainer internal.
- [ ] Tulis E2E admin create event dengan trainer eksternal.
- [ ] Tulis E2E add participant.
- [ ] Tulis E2E user attend with photo.
- [ ] Tulis E2E QR landing page dan pre-test.
- [ ] Tulis E2E post-test dan locked answer.
- [ ] Tulis E2E admin grade essay.
- [ ] Tulis E2E feedback user.
- [ ] Tulis E2E report preview dan PDF export.
- [ ] Tulis E2E certificate print, expiry, dan revoke.
- [ ] Tulis negative auth tests.
- [ ] Tulis upload spoofing tests.
- [ ] Tulis mobile viewport tests.
- [ ] Tulis keyboard-only test untuk critical flow.
- [ ] Jalankan lint.
- [ ] Jalankan typecheck.
- [ ] Jalankan unit dan integration tests.
- [ ] Jalankan E2E pada CI atau staging.
- [ ] Jalankan production build.
- [ ] Scan container image.
- [ ] Catat evidence pada release checklist.

**Exit:** Semua gate wajib hijau dan failure tidak diabaikan untuk mengejar waktu.

## 14. UAT dan Go-live

- [ ] Siapkan data UAT sintetis atau masked.
- [ ] Latih admin Human Capital.
- [ ] Latih minimal dua peserta uji.
- [ ] Verifikasi login admin dan user.
- [ ] Verifikasi trainer internal dan eksternal.
- [ ] Verifikasi absensi dari jaringan internal dan retention permanen.
- [ ] Verifikasi pre-test dan post-test dari QR.
- [ ] Verifikasi jawaban tidak dapat diedit setelah submit.
- [ ] Verifikasi soal dan koreksi.
- [ ] Verifikasi feedback.
- [ ] Verifikasi laporan web dan PDF.
- [ ] Verifikasi WhatsApp sandbox atau production config.
- [ ] Verifikasi undangan, QR, sertifikat, expiry, dan print.
- [ ] Verifikasi backup dan restore termasuk foto serta jawaban.
- [ ] Verifikasi rollback plan.
- [ ] Verifikasi retention dan access review.
- [ ] Dapatkan sign-off Product, HC, DBA, Security, dan DevOps.
- [ ] Jadwalkan go-live.
- [ ] Deploy versi terkunci ke staging.
- [ ] Jalankan smoke test staging.
- [ ] Deploy production dengan approval.
- [ ] Monitor metrics dan error selama observation window.
- [ ] Tutup incident atau buat bug follow-up.

**Exit:** Go-live approval terdokumentasi, rollback path diuji, dan observation owner serta threshold disepakati.

## 15. Backlog Setelah MVP

- [ ] Role trainer atau evaluator terisolasi.
- [ ] Bulk participant import tervalidasi.
- [ ] Calendar atau sinkronisasi jadwal.
- [ ] Reminder WhatsApp otomatis.
- [ ] Template builder untuk invitation dan certificate.
- [ ] Advanced analytics departemen.
- [ ] Offline draft ujian dengan sinkronisasi.
- [ ] Certificate verification public atau internal policy.
- [ ] Object storage integration bila volume tidak memadai.
- [ ] Split worker dari API bila queue load membutuhkannya.

Jangan mengerjakan backlog sebelum MVP, security, migration, retention, dan UAT selesai.
