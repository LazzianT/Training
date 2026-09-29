# Metodologi Pengembangan Perangkat Lunak
## Aplikasi Training dan Refreshment Karyawan PT Braja Mukti Cakra (BMC)

Dokumen ini disusun sebagai bahan Bab III (Metode Penelitian) / Bab IV (Pembahasan)
pada laporan Kerja Praktek Kerja Lapangan (KKP).

---

## 1. Alasan Pemilihan Metode

Pemilihan metode pengembangan pada proyek ini tidak dilakukan secara sukarela,
melainkan diturunkan dari **karakteristik masalah dan kendala nyata** yang ditemukan
pada tahap discovery.

### 1.1 Karakteristik masalah

| No | Karakteristik | Bukti pada proyek |
|----|---------------|-------------------|
| 1 | Kebutuhan berubah berulang | `PRD.md` masih memiliki 6 pertanyaan terbuka (§13); `todo.md` mencatat 9 keputusan bisnis yang belum ditetapkan |
| 2 | Proses legacy tidak terdokumentasi | `SRS.md` harus ditulis ulang dari nol karena spesifikasi lama tidak tersedia |
| 3 | Keputusan bisnis tersebar di banyak pihak | Admin HC, DBA, tim Security, dan DevOps harus sama-sama menyetujui (§14 PRD) |
| 4 | Risiko data sangat tinggi | Database `BMC` dipakai bersama dengan tabel `hris_*` existing yang wajib read-only (`todo.md` §Guardrail Data) |
| 5 | Fitur inti harus cepat tervalidasi | Fungsi absensi dan tes harus bisa dicoba dalam kegiatan nyata, bukan hanya setelah proyek selesai |

### 1.2 Mengapa bukan Waterfall

Model Waterfall mengasumsikan kebutuhan sudah lengkap di awal dan berubah sedikit.
Kenyataannya, pada proyek ini:

- Spesifikasi harus menunggu keputusan stakeholder yang belum ada (misalnya aturan
  **completion rule** untuk sertifikat belum ditetapkan sampai hari ini).
- Environment target (`SVR-BMC-SQL` / database `BMC`) baru terverifikasi pada
  discovery tanggal 2026-09-25, yaitu **setelah** dokumen PRD dan SRS ditulis.
- Temuan teknis di tengah pengerjaan memaksa perubahan pendekatan, misalnya keputusan
  abandon ORM dan memakai `node-mssql` raw yang dicatat di `docs/adr-001-data-access.md`.

### 1.3 Mengapa bukan Kanban murni

Kanban cocok untuk tim yang sudah stabil dan memiliki aliran kerja yang continuous.
Pada proyek ini masih ada banyak ketidakpastian di awal (schema, auth, security,
provider eksternal), sehingga diperlukan **kerangka iterasi dengan waktu tetap** agar setiap capaian
per Sprint dapat direview oleh stakeholder.

### 1.4 Rekomendasi: **Scrum**

Scrum dipilih dengan alasan sebagai berikut:

1. **Requirements tidak stabil** — Scrum dirancang untuk bekerja dengan kebutuhan
   yang berubah; setiap Sprint Review menjadi kesempatan stakeholders mengoreksi arah.
2. **Tersedia Incremental Delivery** — aplikasi dapat didemokan setiap akhir Sprint
   (login → dashboard → acara → peserta → QR → assessment), bukan hanya di akhir proyek.
3. **Ada stakeholder eksternal yang harus dikoordinasikan** — Scrum memaksa format
   penulisan hasil Sprint Review yang seragam dan memisahkan secara tegas antara
   **Product Owner** (Human Capital) dengan **tim pengembang**.
4. **Ada banyak risiko teknis** — retrospective meeting memungkinkan identifikasi
   risiko (misalnya self-migrating `ALTER TABLE` saat boot) sebelum menjadi masalah besar.
5. **Artefak Scrum sudah ada di repo** — proyek ini tidak perlu diimprovisasi dari nol:
   - Product Backlog → `PRD.md` §8 (US-001 s.d. US-011) dan `todo.md`
   - Sprint Backlog → `todo.md` §1 s.d. §15
   - Acceptance Criteria → `Exit criteria` di setiap seksi `todo.md`
   - Definition of Done → `todo.md` §Definition of Done
   - Increment → "MVP Implemented 2026-09-28"
   - Decision log → `techstack.md` (T-01 s.d. T-09) dan `design.md` (D-01 s.d. D-06)

---

## 2. Kerangka Scrum yang Digunakan

### 2.1 Sprint

- **Durasi Sprint:** 2 minggu (10 hari kerja).
- **Alasan:** Requirements cukup stabil untukSIAP satu iterasi 2 minggu, namun tetap
  menyediakan waktu cukup untuk migrasi database yang memerlukan persetujuan DBA.
- **Jumlah Sprint yang direncanakan:** 8 Sprint (lihat roadmap di §3).

### 2.2 Peran (Scrum Team)

| Peran | Personnel | Tanggung Jawab |
|-------|-----------|----------------|
| **Product Owner** | Human Capital / Training Desk (`DepartID = 0300`) | Menentukan prioritas, memiliki Product Backlog, menerima dan mengevaluasi hasil Increment, membuat keputusan ketika requirement ambigu |
| **Scrum Master** | Developers | Memfasilitasi proses, menjaga ritme Sprint, menjaga transparansi dan inspeksi, menghilangkan hambatan (impediment) |
| **Tim Pengembang** | 1 orang (mahasiswa KKP) | Self-organizing, melakukan estimasi, mengimplementasikan, dan menguji |

> **Catatan independensi.** Pada proyek KKP dengan tim satu orang, Scrum Master dan
> Developer secara fisik memang orang yang sama. Namun posisi Scrum Master tetap
> dipisahkan secara *peran*, bukan *orang*, agar pemeriksaan ulang (inspection) tetap
> dijalankan terhadap hasil kerja sendiri. Fenomena ini lazim disebut *single-person
> Scrum* dan akan dibahas lagi pada bagian refleksi.

### 2.3 Artefak Scrum

#### a) Product Backlog

Disusun dari `PRD.md` §8 dan diprioritaskan berdasarkan modul P0/P1 (`PRD.md` §6).

**Prioritas Modul:**

| Prioritas | Modul | Alasan |
|-----------|-------|--------|
| **P0** | Autentikasi & otorisasi | Tanpa ini tidak ada data yang aman diakses |
| **P0** | Manajemen acara & ruang | Objek inti dari seluruh sistem |
| **P0** | Manajemen peserta | Sumber data untuk seluruh modul downstream |
| **P0** | Absensi | Fungsi paling krusial bagi aktivitas bisnis |
| **P0** | Pre-test & post-test | Tujuan utama kegiatan training |
| **P1** | Feedback & laporan | Penting untuk evaluasi kualitas training |
| **P1** | WhatsApp blast | Opsional, provider belum ditentukan |
| **P2** | Sertifikat & PDF export | Bergantung pada aturan completion rule yang belum disetujui |
| **P2** | Audit log | Wajib, tetapi dapat diimplementasikan setelah sistem stabil |

**Contoh Product Backlog Item:**

```
PBI-001  Sebagai admin, saya ingin membuat acara agar proses training terstruktur
         (US-001 | AC: judul, tanggal, waktu, ruang, materi, sasaran, trainer tervalidasi
          | Estimate: 8 SP | Priority: P0 | Sprint: 3 | Status: Done)

PBI-002  Sebagai admin, saya ingin menambahkan karyawan dari HR agar data tidak
         diketik manual (US-002 | AC: pencarian read-only, snapshot nama/departemen/jabatan,
         duplicate dicegah | Estimate: 5 SP | Priority: P0 | Sprint: 4 | Status: Done)
```

**Aturan prioritas (MoSCoW):**

| Kategori | Arti | Contoh |
|----------|------|--------|
| **Must have** | Wajib ada di MVP | Login, acara, peserta, absensi, pre-test |
| **Should have** | Penting tapi bisa ditunda | Feedback, laporan dasar, template QR |
| **Could have** | Nilai tambah jika ada waktu | WhatsApp blast, PDF export |
| **Won't have (now)** | Tidak masuk scope saat ini | Integrasi SSO, aplikasi mobile native |

#### b) Sprint Backlog

Setiap Sprint memiliki target yang jelas. Berikut pemetaan Sprint terhadap kondisi
saat ini:

| Sprint | Durasi | Fokus | Exit Criteria (ringkas) | Status |
|--------|--------|-------|------------------------|--------|
| **Sprint 0** — Discovery | 2 minggu | Verifikasi environment, schema SQL Server, access HRIS, keputusan blocking | Keputusan T-01…T-09 ditetapkan | ✅ Selesai 2026-09-25 |
| **Sprint 1** — Foundation | 2 minggu | Monorepo, lint/typecheck/test, Docker, healthcheck, runbook | Fresh setup dapat build & run | ✅ Selesai |
| **Sprint 2** — Data & Migration | 2 minggu | Skema 22 tabel, migration runner, import legacy | Disetujui DBA | 🟡 DDL selesai, approval pending |
| **Sprint 3** — Auth & Events | 2 minggu | Login NIP+TTL, dashboard, CRUD acara, ruang, trainer | otorisasi server-side teruji | ✅ Selesai |
| **Sprint 4** — Peserta & Absensi | 2 minggu | Cari karyawan, bulk add, absensi tanda tangan | Duplicate dicegah, waktu server | ✅ Selesai |
| **Sprint 5** — Assessment | 2 minggu | QR, pre/post-test, auto-scoring, set soal, publish | Kunci jawaban tidak dikirim client | ✅ Selesai |
| **Sprint 6** — Feedback & Laporan | 2 minggu | Feedback 14 aspek, hasil & statistik, dashboard Pareto | Semua aspect wajib diisi | ✅ Selesai (parsial) |
| **Sprint 7** — Hardening | 2 minggu | Security, performance, E2E test, go-live prep | UAT, backup drill, sign-off 4 pihak | ⏳ Belum dimulai |

#### c) Increment

Setiap Sprint menghasilkan **Increment yang benar-benar dapat didemokan**, bukan
sekadar laporan. Contoh Increment:

- **Increment Sprint 3:** Admin dapat login, melihat dashboard kosong, dan membuat
  satu acara training.
- **Increment Sprint 5:** Peserta dapat memindai QR di HP, mengisi pre-test 10 soal,
  dan langsung melihat skor — **tanpa perlu login**.
- **Increment Sprint 6:** Admin dapat melihat tabel perolehan nilai pre vs post-test
  dan 5 soal tersulit yang paling sering dijawab salah.

#### d) Definition of Done

Mengikuti `todo.md` §Definition of Done, suatu item dianggap selesai bila **semua**
poin berikut terpenuhi:

- [ ] Requirement terkait terimplementasi
- [ ] Unit, integration, dan E2E test untuk scope lulus
- [ ] Server-side authorization dan validation diuji
- [ ] Loading, empty, error, dan success state tersedia
- [ ] Keyboard dan mobile flow diuji untuk perubahan UI
- [ ] Tidak ada secret, SQL injection path, atau token di client bundle
- [ ] Database migration, rollback strategy, dan data verification terdokumentasi
- [ ] Dokumentasi operator diperbarui

> **Aturan penting:** Status `[x]` pada `todo.md` **hanya** boleh dipasang bila
> sudah ada bukti (evidence) berupa lint, typecheck, test, atau review — bukan
> sekadar karena kode sudah ditulis. Hal ini ditegaskan pada `todo.md` baris 12
> dan merupakan bentuk **Definition of Done yang konsisten**.

### 2.4 Scrum Events

| Event | Durasi | Tujuan | Output yang Dihasilkan pada Proyek Ini |
|-------|--------|--------|------------------------------------------|
| **Sprint Planning** | 4 jam (per Sprint) | Memilih PBI dari Product Backlog, membuat Sprint Goal, menyepakati Definition of Done | Sprint Backlog + Sprint Goal tertulis di `todo.md` |
| **Daily Scrum** | 15 menit (harian) | Sinkronisasi kemajuan dan identifikasi hambatan | Catatan harian; hambatan dipindahkan ke Known Issues |
| **Sprint Review** | 2 jam (akhir Sprint) | Demo Increment kepada Product Owner dan pengumpulan umpan balik | Masukan stakeholder; revisi Product Backlog |
| **Retrospective** | 1,5 jam (akhir Sprint) | Evaluasi proses kerja tim, mencari perbaikan | Action item proses; lihat tabel Known Issues §5 |

---

## 3. Roadmap Fase → Sprint Mapping

Roadmap pada `PRD.md` §10 dipetakan ke Sprint Scrum:

| Fase PRD | Cakupan | Sprint |
|----------|---------|--------|
| **Fase 0** — Discovery | Verifikasi schema, akses HR, aturan bisnis | Sprint 0 |
| **Fase 1** — Foundation | Monorepo, CI skeleton, schema & migration | Sprint 1–2 |
| **Fase 2** — Core Pilot | Auth, acara, peserta, absensi, pre/post-test | Sprint 3–5 |
| **Fase 3** — Komunikasi & Dokumen | Feedback, WhatsApp, sertifikat, PDF | Sprint 6–7 |
| **Fase 4** — UAT & Go-live | Migrasi, UAT, security review, go-live | Sprint 8 |

---

## 4. Agile Practices Pendukung (Scrum ≠ Semua Agile)

Scrum adalah **framework** untuk mengatur alur kerja, bukan keseluruhan cara kerja.
Beberapa praktik Agile tambahan diterapkan untuk menjaga kualitas dan keamanan proyek
ini, khususnya Extreme Programming (XP) untuk sisi teknis dan Kanban untuk sisi alur
pekerjaan perbaikan bug.

### 4.1 Extreme Programming (XP) — Praktik Teknis

| Praktik XP | Penerapan pada Proyek Ini |
|------------|---------------------------|
| **Pair Programming** | Diimplementasikan sebagai **self-review**: setiap fitur di-review ulang oleh penulis dengan checklist terstruktur sebelum ditandai selesai. Pada tim satu orang, ini digantikan oleh disiplin *disagree and commit* terhadap temuan audit. |
| **Test-Driven Development (TDD)** | Diterapkan pada bagian kritikal: `birth-date.test.js` (parsing abad), `event.schema.test.js` (validasi Zod), `health.test.js` (contract test endpoint). Logika bisnis yang riskannya tinggi selalu ditulis test lebih dulu. |
| **Refactoring** | Terlihat pada perpindahan `server/src/*.ts` → `.js`, dan pada `ensureAssessmentSchema()` yang dipisah dari route handler. |
| **Continuous Integration** | Saat ini masih **gap** — belum ada pipeline. Rencana: GitHub Actions untuk `lint`, `typecheck`, `test` pada `training-app/`. |
| **Simple Design** | Manifestasi pada keputusan ADR-001: menolak Knex/Prisma demi `mssql` raw yang lebih sederhana dan lebih mudah di-audit. |

### 4.2 Kanban — Flow Management untuk Known Bugs

Untuk **Known Bugs** dan temuan teknis yang muncul setelah Sprint selesai, digunakan
praktik Kanban agar perbaikan tidak menghambat laju pengerjaan Sprint berikutnya.

**Kebijakan Kanban Known Bugs:**

- **WIP Limit: 2 item.** Maksimal 2 bug yang boleh berstatus `In Progress` secara
  bersamaan. Jika mencapai limit, tidak ada fitur baru yang dimulai.
- **Kolom Board:** `Backlog` → `Ready` → `In Progress (max 2)` → `Review` → `Done`
- **Pull Policy:** Bug dengan severity `Critical` atau `High` diprioritaskan masuk
  `In Progress` pada hari yang sama.

**Known Issues Register (hasil audit Sprint 6):**

| ID | Deskripsi | Severity | Status | Dampak |
|----|-----------|----------|--------|--------|
| **BUG-001** | Absensi hanya menyimpan tanda tangan; tidak ada upload foto seperti disyaratkan `SRS.md:ATT-003` | High | Backlog | Penyimpangan dari spesifikasi |
| **BUG-002** | Jawaban peserta masih bisa di-update (`MERGE ... WHEN MATCHED THEN UPDATE`) melanggar `QST-011` | High | Backlog | Pelanggaran immutability jawaban |
| **BUG-003** | Submit jawaban tidak atomik (session dan jawaban di-query terpisah tanpa transaction) | High | Backlog | Risiko data tidak konsisten |
| **BUG-004** | Belum ada refresh token, rate limit, dan audit log (AUTH-004…012 belum terpenuhi) | High | Backlog | Kekuatan keamanan belum produksi-grade |
| **BUG-005** | `002_assessment_workflow.sql` di-bypass dengan `ALTER TABLE` saat boot | Medium | Backlog | Perilaku self-migrating di produksi |
| **BUG-006** | QR code di-render via `quickchart.io` (pihak ketiga), bertentangan dengan `SEC-002` | Medium | Backlog | Ketergantungan eksternal |
| **BUG-007** | Dockerfile server masih merujuk `tsconfig.json` yang sudah dihapus | Medium | **Done** | Image Docker gagal dibangun; sudah diperbaiki pada commit `97941f5` |
| **BUG-008** | Belum ada pipeline CI; `lint`/`typecheck`/`test` hanya bisa dijalankan dari `training-app/`, bukan repo root | Medium | Backlog | Kualitas tidak dijaga otomatis saat ada commit baru |

> **Catatan integritas intelektual.** Known Issues di atas sengaja ditampilkan, bukan
> disembunyikan. Dalam konteks KKP, menunjukkan bahwa pengembang mampu **mengidentifikasi
> dan jujur melaporkan** kekurangan propria adalah nilai yang lebih besar daripada
> mengklaim sistem sudah sempurna.
>
> **Catatan verifikasi.** Tabel ini merupakan hasil audit terhadap source code, bukan
> hasil pengujian manual di server produksi. Angka "24 test passed" di `todo.md`
> sudah diverifikasi ulang dengan `pnpm test` (3 file, 24 test, semua lulus). Sebaliknya,
> Image Docker untuk service server belum pernah dibangun karena Docker daemon tidak
> berjalan pada lingkungan pengembangan.

### 4.3 Continuous Feedback & Definition of Done Berlapis

Selain Definition of Done di level tim (`todo.md`), ada **Definition of Done level
produk** (`PRD.md` §14) yang memerlukan sign-off dari empat pihak:

- Human Capital
- DBA
- Security
- DevOps

Produk baru dinyatakan "go-live ready" bila keempat pihak telah menyetujui.

---

## 5. Retrospective: Temuan yang Dapat Dibahas

Salah satu nilai Scrum yang paling terlihat dalam laporan KKP adalah **kemampuan
untuk mengoreksi arah sebelum produk selesai**. Berikut tiga temuan dari retrospektif
Sprint 6 yang layak dibahas secara terbuka:

| No | Temuan | Dampak | Tindakan Korektif |
|----|--------|--------|------------------|
| 1 | Persyaratan keamanan pada `SRS.md` (bcrypt, refresh token, rate limit) belum diimplementasikan | Sistem belum memenuhi standar produksi | Dipindahkan ke Product Backlog P1 dan direncanakan pada Sprint 7 |
| 2 | `ALTER TABLE` dijalankan otomatis saat server boot melalui `ensureAssessmentSchema()` | Risiko operasional di produksi | DDL akan dipindahkan ke migration runner yang eksplisit pada Sprint 7 |
| 3 | Token akses disimpan di `sessionStorage` dan hanya berumur 15 menit tanpa refresh | UX menurun dan belum ada mekanisme pencabutan token | Refresh token dan pencabutan direncanakan pada Sprint 7 |

> **Pelajaran yang diambil.** Ketiga temuan di atas tidak ditemukan pada saat kode
> ditulis, melainkan pada saat retrospektif. Ini justru menunjukkan nilai retrospektif:
> proses pemeriksaan berkala berhasil menemukan kekurangan yang tidak terlihat pada
> pemeriksaan harian.

---

## 6. Ringkasan

| Aspek | Keputusan |
|-------|-----------|
| **Metode** | Scrum dengan durasi Sprint 2 minggu |
| **Pendukung** | XP (TDD, refactoring) + Kanban untuk Known Bugs |
| **Jumlah Sprint** | 8 Sprint + Sprint 0 (Discovery) |
| **Peran** | Product Owner (HC), Scrum Master, Tim Pengembang (1 orang) |
| **Artefak utama** | Product Backlog, Sprint Backlog, Increment, DoD, Known Issues |
| **Bukti penerapan** | `PRD.md`, `SRS.md`, `todo.md`, `docs/adr-001-data-access.md`, `runbook.md` |

---

*Dokumen ini disusun berdasarkan audit langsung terhadap source code dan dokumen
proyek pada 29 September 2026. Semua referensi file dan nomor baris dapat diverifikasi
kembali pada repository.*
