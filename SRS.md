---
title: Software Requirements Specification Aplikasi Training PT BMC
version: 0.2
status: Draft
date_created: 2026-09-25
last_updated: 2026-09-25
owner: Human Capital / Engineering
source: PRD.md, RECREATION_PLAN.md
---

# Software Requirements Specification

## 1. Pendahuluan

SRS ini mendefinisikan kebutuhan perangkat lunak untuk aplikasi training dan refreshment karyawan PT BMC. Aplikasi menggantikan workflow PHP/MySQL lama dengan aplikasi web internal berbasis React, Vite, Tailwind CSS, Express.js, dan SQL Server.

Nilai `TBD` berarti keputusan harus dikonfirmasi sebelum bagian yang terkait diimplementasikan.

## 2. Definisi

| Istilah | Definisi |
|---|---|
| Admin | Pengguna dengan `DepartID = '0300'` pada `hris_employee` |
| Peserta | Karyawan yang terdaftar pada suatu acara |
| Trainer internal | Trainer yang berasal dari `hris_employee` dan dipilih melalui pencarian HR |
| Trainer eksternal | Trainer yang tidak berasal dari HR dan diinput manual oleh admin |
| Trainer/evaluator | Orang yang melakukan kegiatan; role login khusus belum ditetapkan |
| NIP | Identifier karyawan pada SQL Server HR, dipetakan dari `NONIK` legacy |
| Acara | Satu kegiatan training atau refreshment |
| Set soal | Kumpulan soal yang dimiliki satu acara |
| Absensi | Catatan kehadiran peserta pada acara |
| Completion rule | Kondisi yang harus terpenuhi sebelum sertifikat diterbitkan |
| Outbox | Penyimpanan pesan outbound sebelum dikirim ke provider WhatsApp |
| TBD | Belum ditentukan dan membutuhkan keputusan bisnis |

## 3. Matriks Otorisasi

| Aksi | Admin | Peserta | Trainer/evaluator |
|---|---:|---:|---:|
| Login dan refresh token | Ya | Ya | Jika diaktifkan |
| Melihat acara milik sendiri | Semua | Jika terdaftar | Jika diaktifkan |
| CRUD acara | Ya | Tidak | Tidak |
| CRUD peserta | Ya | Tidak | Tidak |
| Absen foto | Melihat | Jika terdaftar | TBD |
| CRUD soal | Ya | Tidak | TBD |
| Submit jawaban | Tidak | Jika sesi milik sendiri | TBD |
| Edit jawaban setelah submit | Tidak | Tidak | Tidak |
| Koreksi essay | Ya | Tidak | TBD |
| Feedback user | Melihat | Mengisi | TBD |
| Feedback trainer | Melihat | Tidak | TBD |
| Laporan | Ya | Tidak | TBD |
| Blast WhatsApp | Ya | Tidak | TBD |
| Sertifikat | Terbitkan | Lihat atau unduh | TBD |

Otorisasi ditegakkan di server pada setiap endpoint. Menyembunyikan menu di client bukan kontrol keamanan.

### 3.1 Guardrail Data Existing

- Tabel SQL Server yang sudah ada hanya dibaca.
- Tabel baru aplikasi boleh ditambahkan pada namespace `training_` atau nama yang disetujui DBA.
- Penambahan tabel baru wajib melalui schema review, review migration script, dan approval DBA.
- Aplikasi tidak menjalankan `ALTER`, `DROP`, `TRUNCATE`, `UPDATE`, `DELETE`, `INSERT`, atau `MERGE` terhadap tabel existing tanpa approval tertulis DBA.
- Migrasi hanya menulis ke tabel target baru atau staging table.

## 4. Kebutuhan Fungsional

### 4.1 Authentication dan session

- **AUTH-001**: Sistem menerima `NIP` dan password melalui `POST /api/auth/login`.
- **AUTH-002**: Sistem mencari akun pada `hris_employee` melalui koneksi read-only.
- **AUTH-003**: Initial password yang valid adalah `BirthDate` dengan format `YYMMDD`.
- **AUTH-004**: Setelah initial password berhasil, sistem membuat hash bcrypt dengan cost minimal 12 dan menandai password harus diganti.
- **AUTH-005**: Sistem menolak akun tidak aktif, akun tidak ditemukan, dan password salah dengan pesan generik.
- **AUTH-006**: Role admin berlaku bila `DepartID = '0300'`. Selain itu role user.
- **AUTH-007**: Respons login memuat profile minimum, role, access token berumur pendek, dan refresh token melalui cookie `HttpOnly` serta `Secure` pada HTTPS.
- **AUTH-008**: `POST /api/auth/refresh` menghasilkan access token baru hanya dari refresh token valid.
- **AUTH-009**: Refresh token dapat direvoke saat logout, reset password, atau perubahan password.
- **AUTH-010**: `POST /api/auth/logout` merevoke session aktif.
- **AUTH-011**: Rate limit login diterapkan per IP dan per NIP.
- **AUTH-012**: Percobaan login, logout, refresh failure, dan password change dicatat tanpa password atau token.

### 4.2 Employee reference, trainer, dan jabatan

- **EMP-001**: `GET /api/karyawan?q=` hanya dapat dipanggil oleh admin.
- **EMP-002**: Query pencarian menerima NIP atau nama sesuai aturan minimum yang disepakati.
- **EMP-003**: Hasil employee memuat `NIP`, nama, telepon bila tersedia, departemen, dan status aktif.
- **EMP-004**: `GET /api/jabatan` mengembalikan jabatan aktif dari `hris_employeecareerpath` dengan filter NIP.
- **EMP-005**: Data HR tidak dapat diubah melalui API training.
- **EMP-006**: Jika HR source tidak dapat diakses, endpoint mengembalikan status degradasi yang jelas tanpa menyimpan cache sensitif tanpa retention policy.
- **EMP-007**: Admin dapat mencari trainer internal dari `hris_employee` dan memilih NIP yang valid.
- **EMP-008**: Admin dapat membuat data trainer eksternal secara manual. Data eksternal tidak ditulis ke HR source.

### 4.3 Acara dan ruang

- **EVT-001**: Admin dapat membuat acara dengan judul, tanggal, sasaran, materi pokok, waktu mulai, waktu selesai, ruang, dan trainer.
- **EVT-002**: Waktu selesai harus lebih besar dari waktu mulai. Timezone harus terdokumentasi.
- **EVT-003**: Admin dapat melihat daftar acara dengan filter tanggal, status, ruang, trainer, dan keyword judul.
- **EVT-004**: Detail acara memuat jumlah peserta, absensi, kelengkapan jawaban, dan status feedback.
- **EVT-005**: Admin dapat mengubah acara sesuai lifecycle yang disetujui.
- **EVT-006**: Admin dapat archive acara tanpa menghapus history jawaban dan laporan.
- **EVT-007**: Ruang memiliki nama unik dan dapat dinonaktifkan.
- **EVT-008**: Perubahan acara memakai optimistic concurrency melalui `version` atau `updatedAt`.
- **EVT-009**: Setiap acara menyimpan `trainer_type` bernilai `internal` atau `external`.
- **EVT-010**: Untuk `trainer_type = 'internal'`, `trainer_nip` harus ada dan valid pada `hris_employee`.
- **EVT-011**: Untuk `trainer_type = 'external'`, `trainer_nip` harus null dan detail trainer eksternal wajib diisi manual.

### 4.4 Peserta

- **PTC-001**: Admin dapat menambahkan NIP aktif ke acara.
- **PTC-002**: NIP yang sama tidak dapat masuk dua kali pada acara yang sama.
- **PTC-003**: Saat peserta ditambahkan, sistem menyimpan snapshot nama, departemen, dan jabatan.
- **PTC-004**: Admin dapat menghapus peserta yang belum memiliki activity, atau meminta konfirmasi bila activity sudah ada.
- **PTC-005**: Peserta hanya dapat melihat acara tempat NIP-nya terdaftar.
- **PTC-006**: Daftar peserta menampilkan status undangan, bukan status absensi.

### 4.5 Absensi foto

- **ATT-001**: Peserta dapat mengirim foto absensi pada acara yang terdaftar.
- **ATT-002**: Server memverifikasi authentication, ownership, status acara, dan duplicate sebelum menyimpan.
- **ATT-003**: File harus JPEG, PNG, atau WebP. MIME, extension, dan signature harus cocok.
- **ATT-004**: Ukuran, resolusi, dan batas file mengikuti environment configuration dan divalidasi server.
- **ATT-005**: Nama file disimpan sebagai UUID atau nilai unik. Path dari client tidak dipercaya.
- **ATT-006**: Waktu absensi menggunakan server time.
- **ATT-007**: Admin dapat melihat daftar hadir, foto, waktu, dan status validasi.
- **ATT-008**: File invalid menghasilkan error yang jelas dan tidak tersimpan sebagai data valid.
- **ATT-009**: Foto absensi disimpan permanen dan tetap dapat diakses hanya melalui route terotorisasi.

### 4.6 Pre-test, post-test, soal, dan ujian

- **TST-001**: QR untuk acara mengarah ke landing page yang menampilkan akses pre-test dan post-test.
- **TST-002**: Landing page menampilkan identitas acara, status akses, serta action pre-test atau post-test yang sesuai.
- **TST-003**: Akses landing page dan test mengikuti authentication serta access policy yang disetujui.
- **TST-004**: Pre-test dan post-test memakai set soal yang terhubung ke acara dan fase `pre` atau `post`.
- **QST-001**: Admin dapat membuat set soal untuk satu acara.
- **QST-002**: Set soal menyimpan jenis, fase `pre` atau `post`, trainer, tanggal, jumlah soal, dan status.
- **QST-003**: Soal pilihan ganda memiliki pertanyaan, opsi A sampai D, kunci jawaban, dan point.
- **QST-004**: Soal essay memiliki pertanyaan, point atau nilai maksimum, dan instruksi penilaian.
- **QST-005**: Jumlah soal harus sesuai dengan metadata atau tervalidasi sebelum publish.
- **QST-006**: Admin dapat publish set soal setelah seluruh soal lolos validasi.
- **QST-007**: Peserta hanya dapat mengakses set soal yang dipublish dan terkait dengan acaranya.
- **QST-008**: Jawaban pilihan ganda menyimpan jawaban, kunci saat penilaian, point, dan status benar atau salah.
- **QST-009**: Jawaban essay menyimpan jawaban dan nilai awal dengan status `pending` atau `graded`.
- **QST-010**: Submit jawaban bersifat atomik. Kegagalan parsial tidak meninggalkan jawaban final setengah tersimpan.
- **QST-011**: Setelah submit berhasil, peserta tidak dapat mengubah jawaban melalui API maupun client.
- **QST-012**: Admin tidak dapat mengubah isi jawaban peserta. Admin hanya dapat mengoreksi nilai essay atau metadata operasional yang diizinkan, dengan audit.
- **QST-013**: API tidak mengembalikan `kunci_jawaban` ke client peserta untuk mode penilaian otomatis.

### 4.7 Koreksi

- **GRD-001**: Admin dapat melihat daftar essay `pending` per acara.
- **GRD-002**: Nilai berada pada rentang 0 sampai point maksimum.
- **GRD-003**: Nilai dan koreksi menyimpan evaluator serta server timestamp.
- **GRD-004**: Total nilai dan status kelulusan mengikuti aturan yang disetujui.
- **GRD-005**: Setiap perubahan nilai dapat ditelusuri melalui audit log.

### 4.8 Feedback

- **FBK-001**: Sistem menyediakan feedback user dan feedback trainer.
- **FBK-002**: Setiap aspek memiliki label yang disetujui dan nilai integer 1 sampai 5.
- **FBK-003**: Semua aspek wajib diisi. Keterangan opsional kecuali disetujui wajib.
- **FBK-004**: Peserta hanya dapat mengirim feedback user satu kali untuk setiap acara.
- **FBK-005**: Trainer atau admin dapat mengirim feedback trainer sesuai role final.
- **FBK-006**: Admin dapat melihat hasil per aspek, rata-rata, distribusi, dan komentar yang berwenang.
- **FBK-007**: Feedback tidak ditampilkan kepada pihak yang tidak berwenang.

### 4.9 WhatsApp

- **WA-001**: `POST /api/acara/:id/blast-wa` membuat draft pesan untuk peserta yang dipilih.
- **WA-002**: Setiap message memiliki recipient, template, provider request ID, status, error code, dan timestamp.
- **WA-003**: Provider API key hanya tersedia di server environment.
- **WA-004**: Sistem memakai idempotency key agar retry tidak mengirim duplikat.
- **WA-005**: Placeholder template di-escape. HTML atau script injection ditolak.
- **WA-006**: Status minimal adalah `queued`, `sending`, `sent`, `delivered`, `failed`, dan `skipped`.
- **WA-007**: Error provider dinormalisasi dan tidak mengekspos secret.
- **WA-008**: Rate limit dan retry mengikuti kontrak provider.
- **WA-009**: Link undangan, sertifikat, dan QR dibuat setelah authorization check.

### 4.10 Dokumen, QR, dan sertifikat

- **DOC-001**: Undangan berisi detail acara, jadwal, lokasi, instruksi, dan QR atau access code yang disetujui.
- **DOC-002**: Sertifikat berisi NIP, nama snapshot, judul acara, tanggal, trainer, dan verification code.
- **DOC-003**: Sertifikat tidak diterbitkan sebelum completion rule terpenuhi.
- **DOC-004**: Sertifikat memiliki masa berlaku 3 tahun sejak `issued_at`. Setelah 3 tahun, status menjadi `expired` dan tidak dapat dianggap valid.
- **DOC-005**: QR mengarah ke landing page pre-test dan post-test untuk acara terkait. QR tidak memuat NIP, BirthDate, atau token JWT.
- **DOC-006**: Halaman pre-test dan post-test memiliki loading, unauthorized, not found, ready, dan error states.
- **DOC-007**: Halaman dokumen memiliki loading, unauthorized, not found, ready, dan print states.
- **DOC-008**: Tampilan print tetap terbaca pada ukuran A4.
- **DOC-009**: Template visual merupakan desain baru, bukan salinan template legacy.

### 4.11 Laporan

- **RPT-001**: Laporan kehadiran menampilkan total peserta, hadir, belum hadir, foto invalid, dan waktu absensi.
- **RPT-002**: Laporan ujian menampilkan jawaban, status koreksi, nilai, dan kelulusan sesuai aturan.
- **RPT-003**: Laporan feedback menampilkan jumlah respons, rata-rata, distribusi, dan filter departemen.
- **RPT-004**: Ringkasan departemen dapat difilter berdasarkan rentang tanggal.
- **RPT-005**: Laporan dipreview di web. Export PDF memiliki batas data yang disepakati serta membutuhkan otorisasi.
- **RPT-006**: Report tidak menampilkan data yang tidak diperlukan oleh role.

### 4.12 Audit dan error contract

- **AUD-001**: Mutasi penting menulis audit event berisi actor NIP, action, entity type, entity ID, timestamp, correlation ID, dan result.
- **AUD-002**: Audit tidak menyimpan password, access token, refresh token, atau binary file.
- **ERR-001**: API mengembalikan JSON konsisten dengan `error.code`, `error.message`, `error.details` yang aman, dan `requestId`.
- **ERR-002**: Validation error memakai HTTP 400 atau 422; unauthenticated 401; forbidden 403; not found 404; conflict 409; server error 500 tanpa detail internal.
- **ERR-003**: Client menampilkan pesan yang dapat ditindaklanjuti tanpa stack trace atau credential.

## 5. Data Requirements

### 5.1 Entitas inti

| Entitas | Key | Atribut wajib | Relasi atau constraint |
|---|---|---|---|
| `acara` | `id` | judul, tanggal, waktu, ruang, trainer, status | `trainer_type`, `trainer_nip`, atau detail trainer eksternal |
| `ruang_acara` | `id` | nama_ruangan | Nama unik |
| `peserta_acara` | `id` | id_acara, NIP, snapshot employee | Unik id_acara + NIP |
| `absensi_training` | `id` | id_acara, NIP, foto, waktu | Unik id_acara + NIP; file permanen |
| `induk_master_soal` | `id` | id_acara, fase, trainer, jenis, jumlah, status | Satu acara |
| `master_soal` | `id` | id_induk, nomor, pertanyaan, opsi, kunci, point | Unik set + nomor |
| `essay` | `id` | id_induk, nomor, pertanyaan, point | Unik set + nomor |
| `jawaban_user` | `id` | id_induk, nomor, jawaban, NIP, point | Unik set + nomor + NIP; immutable |
| `essay_jawaban_user` | `id` | id_induk, nomor, jawaban, NIP, nilai | Unik set + nomor + NIP; isi immutable |
| `training_feedback` | `id` | id_acara, NIP, jenis, aspek, keterangan | Unik id_acara + NIP + jenis |
| `notification_outbox` | `id` | recipient, template, payload, status | Idempotency key unik |
| `certificate` | `id` | id_acara, NIP, verification code, issued_at, expires_at, status | Valid 3 tahun sejak `issued_at` |
| `audit_log` | `id` | actor, action, entity, timestamp | Index actor + timestamp |

### 5.2 HR reference

- `hris_employee`: read-only untuk NIP, nama, telepon, BirthDate, `DepartID`, dan status aktif.
- `hris_employeecareerpath`: read-only untuk jabatan, department code, effective date, dan archive status.
- `hc.KARYAWAN`, `hc.departemen`, dan `budget.tarif`: fallback legacy read-only hanya bila connectivity disetujui.

### 5.3 Retention

Foto absensi dan seluruh jawaban peserta disimpan permanen. Retention feedback, audit, message log, dan report masih TBD. Jangan menyalin data HR ke tabel aplikasi kecuali diperlukan.

## 6. API Contract

### 6.1 Konvensi

- Base path: `/api`.
- Content type: `application/json`, kecuali multipart upload.
- Autentikasi: `Authorization: Bearer <access-token>`.
- ID eksternal harus di-encode dengan benar.
- Endpoint list memakai pagination dan sorting yang disepakati.
- Mutasi penting mendukung idempotency key.

### 6.2 Endpoint baseline

| Method | Path | Role | Fungsi |
|---|---|---|---|
| POST | `/auth/login` | Public | Login |
| POST | `/auth/refresh` | Refresh | Access token baru |
| POST | `/auth/logout` | Authenticated | Revoke session |
| POST | `/auth/change-password` | Authenticated | Ganti password |
| GET | `/me` | Authenticated | Profile dan role |
| GET | `/karyawan?q=` | Admin | Cari employee |
| GET | `/jabatan` | Admin | Cari jabatan |
| GET/POST | `/acara` | Admin | List dan create |
| GET/PATCH | `/acara/:id` | Admin atau user scoped | Detail dan update |
| GET/POST | `/acara/:id/peserta` | Admin atau user scoped | List dan add |
| DELETE | `/acara/:id/peserta/:pesertaId` | Admin | Remove participant |
| GET/POST | `/acara/:id/absensi` | Admin atau user scoped | Attendance |
| GET/POST | `/acara/:id/soal` | Admin | Question sets |
| POST | `/soal/:idInduk/jawaban` | Peserta | Submit jawaban |
| PATCH | `/jawaban/:id/koreksi` | Admin atau evaluator | Grade essay |
| GET/POST | `/acara/:id/feedback/user` | Admin atau peserta | Feedback user |
| GET/POST | `/acara/:id/feedback/trainer` | Admin atau evaluator | Feedback trainer |
| POST | `/acara/:id/blast-wa` | Admin | Queue WA |
| GET | `/acara/:id/pre-test` | Peserta scoped | Halaman pre-test |
| GET | `/acara/:id/post-test` | Peserta scoped | Halaman post-test |
| GET | `/sertifikat/:verificationCode` | Sesuai policy | Certificate verification |
| POST | `/sertifikat/:id/revoke` | Admin | Revoke certificate |
| GET | `/acara/:id/report/*` | Admin | Reports |
| POST | `/acara/:id/report/*/export-pdf` | Admin | Export PDF |
| GET | `/health/live` | Ops | Liveness |
| GET | `/health/ready` | Ops | Readiness |

## 7. Security dan Privacy

- **SEC-001**: Semua query SQL parameterized. Dynamic sort hanya dari allowlist.
- **SEC-002**: Secret, token, dan credential tidak ada di source code, log, URL, atau client bundle.
- **SEC-003**: Password hash memakai bcrypt dengan cost minimal 12. Initial password hanya dipakai sekali dan tidak disimpan plaintext.
- **SEC-004**: Access token expiry, refresh rotation, revocation, dan session invalidation wajib diuji.
- **SEC-005**: Endpoint admin melakukan authorization terhadap resource, bukan hanya role.
- **SEC-006**: Upload diverifikasi signature, MIME, ukuran, dimensi, dan nama aman.
- **SEC-007**: File dilayani melalui route terotorisasi, bukan direktori publik.
- **SEC-008**: CORS, security headers, rate limit, request size limit, dan timeout diterapkan.
- **SEC-009**: Dependency vulnerability scan dijalankan pada CI.
- **SEC-010**: Data pribadi diminimalisasi pada response dan report.
- **SEC-011**: Audit log tidak dapat diubah melalui application user biasa.
- **SEC-012**: Logout, password change, account disable, dan certificate revoke menutup session relevan.
- **SEC-013**: Refresh token disimpan hashed atau melalui secure cookie storage sesuai keputusan implementasi.
- **SEC-014**: QR code untuk pre-test dan post-test memakai random opaque token atau signed token yang dapat direvoke.

## 8. Nonfunctional Requirements

| ID | Kategori | Requirement |
|---|---|---|
| NFR-001 | Performance | p95 API list maksimal 2 detik pada data dan concurrency yang disepakati |
| NFR-002 | Reliability | Health check membedakan liveness dan readiness; transient provider failure tetap ada di outbox |
| NFR-003 | Availability | Target uptime ditentukan sebelum production; tidak ada klaim SLA sebelum disepakati |
| NFR-004 | Usability | Setiap data view memiliki loading, empty, error, dan success state |
| NFR-005 | Accessibility | Core flow memenuhi target WCAG 2.1 AA; keyboard focus terlihat; error terhubung ke field |
| NFR-006 | Browser | Browser internal dan minimum version didokumentasikan |
| NFR-007 | Observability | Structured log, request ID, metrics minimal, dan alert untuk auth, queue, dan DB failure |
| NFR-008 | Backup | Backup database dan upload storage terjadwal; restore diuji sebelum go-live |
| NFR-009 | Audit | Mutasi bisnis memiliki actor, server time, entity, dan correlation ID |
| NFR-010 | Privacy | Foto dan jawaban disimpan permanen; retention feedback, audit, message log, masking, dan access review disetujui sebelum production |

## 9. Acceptance Scenarios

### AS-001 Login admin

- Given NIP aktif dengan `DepartID = '0300'` dan initial password valid
- When user login
- Then sistem mengembalikan role admin, meminta password change, dan tidak mengembalikan HR data yang tidak diperlukan

### AS-002 Login user

- Given NIP aktif dengan `DepartID` selain `0300`
- When user login dengan initial password
- Then sistem mengembalikan role user dan akses hanya ke acara terkait

### AS-003 Absen duplikat

- Given peserta sudah memiliki attendance pada acara
- When peserta mengirim foto lagi
- Then API menolak dengan conflict dan tidak menimpa record awal

### AS-004 Submit jawaban atomik

- Given satu set soal memiliki lima soal
- When request kelima gagal
- Then tidak ada partial submission yang terlihat sebagai jawaban final

### AS-005 Koreksi essay

- Given admin membuka essay `pending`
- When nilai di luar 0 sampai point dikirim
- Then server menolak dan tidak mengubah nilai sebelumnya

### AS-006 Feedback

- Given aspect label sudah disetujui
- When peserta mengirim rating 0 atau 6
- Then server menolak; rating 1 sampai 5 diterima; response tersimpan satu kali

### AS-007 WhatsApp retry

- Given provider mengembalikan timeout
- When retry dilakukan dengan idempotency key yang sama
- Then sistem tidak membuat message duplikat dan menyimpan status failure

### AS-008 Jawaban immutable

- Given peserta sudah submit jawaban
- When peserta atau admin mencoba mengubah isi jawaban
- Then server menolak perubahan isi; koreksi nilai essay tetap hanya dapat dilakukan oleh admin sesuai audit

### AS-009 Trainer internal dan eksternal

- Given admin membuat acara dengan trainer internal
- When admin memilih NIP dari `hris_employee`
- Then NIP terisi valid dan sumber trainer disimpan sebagai internal

- Given admin membuat acara dengan trainer eksternal
- When admin mengisi detail eksternal
- Then NIP tetap null dan detail manual wajib tersimpan

### AS-010 Certificate gate dan masa berlaku

- Given peserta hadir tetapi nilai belum memenuhi completion rule
- When peserta membuka certificate
- Then sistem menampilkan status belum memenuhi syarat

- Given sertifikat sudah diterbitkan lebih dari 3 tahun
- When verifikasi dibuka
- Then status certificate adalah expired dan tidak valid

### AS-011 QR dan laporan PDF

- Given QR untuk acara dipindai
- When tujuan dibuka
- Then sistem menampilkan landing page pre-test dan post-test untuk acara terkait

- Given admin mengekspor laporan
- When export PDF diminta
- Then server menghasilkan PDF yang berwenang dan tidak memuat data di luar scope

### AS-012 Resource authorization

- Given user A terdaftar pada acara 1
- When user A meminta endpoint scoped acara 2
- Then server mengembalikan 403 atau 404 yang disepakati tanpa membocorkan resource

### AS-013 Migration reconciliation

- Given source dan target selesai dimigrasikan
- When validator dijalankan
- Then count, duplicate, null, orphan, dan mapping mismatch dilaporkan; perbedaan belum diputuskan dianggap gagal

## 10. Test Automation Strategy

- Unit: service domain, validasi, scoring, authorization helper.
- Integration: API, SQL Server transaction, migration validator, outbox adapter dengan fake provider.
- End-to-end: admin dan participant happy path, error state, upload, print, mobile participant flow.
- Security: OWASP ASVS baseline subset, dependency scan, secret scan, authorization matrix, upload fuzz test.
- Data migration: repeatable dry run, count reconciliation, checksum atau sample hash untuk kolom kritis.
- Performance: load smoke test setelah dataset dan concurrency disepakati.
- CI: lint, typecheck, unit, integration terhadap disposable SQL Server, build, migration dry run.
- Coverage: target awal 80% pada critical service, disesuaikan berdasarkan risiko; bukan pengganti test skenario.
- Test data: NIP sintetis, cleanup, tidak memakai data karyawan nyata di non-production.

## 11. Dependencies dan Integrations

### External systems

- **EXT-001**: SQL Server `Training` untuk data aplikasi.
- **EXT-002**: SQL Server HR read-only untuk employee, role, department, dan career path.
- **EXT-003**: Legacy MySQL untuk migrasi, bila tersedia dan disetujui.
- **EXT-004**: WhatsApp Business Provider, API, dan template yang disetujui.
- **EXT-005**: SMTP atau identity provider eksternal tidak diperlukan untuk baseline.

### Infrastructure

- **INF-001**: Docker Engine dan Docker Compose on-premise.
- **INF-002**: Persistent volume untuk upload, atau object storage internal bila disetujui.
- **INF-003**: Reverse proxy TLS internal.
- **INF-004**: Backup storage terpisah dari host aplikasi.

### Data dependencies

- **DAT-001**: `hris_employee` read-only.
- **DAT-002**: `hris_employeecareerpath` read-only.
- **DAT-003**: Legacy source schema dan mapping final.
- **DAT-004**: Master definisi aspek feedback.
- **DAT-005**: Standar template dan nomor sertifikat.
- **DAT-006**: Master data trainer internal dan field minimum trainer eksternal.

## 12. Edge Cases

- NIP lama tidak memiliki pasangan pada HR baru.
- Karyawan berubah departemen setelah menjadi peserta.
- Trainer berubah setelah set soal dibuat.
- Peserta dihapus setelah memiliki jawaban.
- Set soal diubah saat peserta menjawab.
- MIME file berbeda dari signature file.
- Timezone atau daylight saving tidak konsisten.
- Provider WA timeout setelah menerima message.
- Certificate link dibuka setelah revoke.
- Report membutuhkan data dalam jumlah besar.
- User kehilangan session ketika role atau status berubah.

## 13. Validation Criteria

SRS siap implementasi bila:

- Semua TBD yang memengaruhi schema, auth, security, retention, dan compliance memiliki owner dan keputusan.
- PRD, design, techstack, dan todo memakai nama, role, endpoint, dan istilah yang sama.
- DBA menyetujui DDL dan read-only HR access.
- Security owner menyetujui token, upload, certificate, dan secret handling.
- Product owner menyetujui feedback aspects, completion rule, document design, dan WhatsApp template.
- QA menyetujui test strategy dan data fixture.

## 14. Related Documents

- `PRD.md`
- `design.md`
- `techstack.md`
- `todo.md`
- `RECREATION_PLAN.md`
