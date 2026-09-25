# Tech Stack Aplikasi Training PT BMC

Status: Draft implementasi.
Sumber: `RECREATION_PLAN.md`, `PRD.md`, `SRS.md`.

## 1. Keputusan Utama

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Client | React 18+ dengan Vite | Sesuai recreate plan; build cepat dan komponen reusable |
| Styling | Tailwind CSS | Sesuai recreate plan; token konsisten tanpa framework berat |
| Routing | React Router | Route guard per role |
| Server | Express.js dengan TypeScript | REST API sederhana; mudah dipisahkan antara controller dan middleware |
| Database | SQL Server | Sesuai recreate plan; data HR dan aplikasi satu platform |
| Data access | Knex baseline, spike sebelum production | SQL Server dan batch migration perlu query transparency |
| Auth | JWT access token, refresh token, bcrypt | Sesuai recreate plan dan target deployment internal |
| Validation | Zod | Schema dapat dipakai di boundary server dan kontrak bersama |
| Upload | Multer dengan storage adapter | Native Node stream; storage dapat diganti nanti |
| QR | Package `qrcode` atau server equivalent | Menghasilkan QR lokal tanpa runtime third-party |
| PDF | PDF renderer server-side | Export laporan web harus menghasilkan PDF |
| Build | pnpm workspace | Monorepo client, server, contracts |
| Runtime | Node.js LTS yang didukung | Dependency security dan maintenance |
| Deployment | Docker Compose on-premise | Target dikonfirmasi; isolated services dan persistent volume |
| Reverse proxy | Nginx atau internal gateway | TLS termination, static serving, health routing |
| CI | Pipeline internal atau GitHub Actions, TBD | Mengikuti source control perusahaan |

## 2. Version Policy

Versi exact belum dikunci karena package availability, Node runtime, dan deployment image harus diverifikasi.

- Gunakan major dan minor yang masih didukung.
- Pin exact version di `package.json` dan lockfile.
- Jangan memakai `@latest` di manifest atau CI.
- Vulnerability check wajib sebelum release.
- Jika library membutuhkan native binary, gunakan image build yang reproducible.
- Pilih package setelah smoke test di Node LTS target.

## 3. Arsitektur Repository

```text
training-app/
├── client/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── styles/
│   │   └── utils/
│   └── tests/
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── acara/
│   │   │   ├── peserta/
│   │   │   ├── absensi/
│   │   │   ├── soal/
│   │   │   ├── feedback/
│   │   │   ├── laporan/
│   │   │   ├── whatsapp/
│   │   │   └── dokumen/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── schemas/
│   │   └── utils/
│   ├── migrations/
│   └── tests/
├── packages/
│   └── contracts/
│       ├── src/
│       │   ├── api/
│       │   ├── domain/
│       │   └── schemas/
│       └── package.json
├── docs/
├── scripts/
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

Dependency direction:

```text
client -> contracts
server -> contracts
server -> database adapters
server -> provider adapters
```

Client tidak meng-import server. Database adapter tidak meng-import HTTP layer. Shared contract tidak berisi secret, connection string, atau side effect.

### Data Safety Boundary

- Existing SQL Server tables are read-only for this project.
- New application tables may be added under the `training_` namespace or another DBA-approved prefix.
- New tables require schema review, migration script review, and DBA approval before creation.
- No `ALTER`, `DROP`, `TRUNCATE`, `UPDATE`, `DELETE`, `INSERT`, or `MERGE` against existing tables without explicit DBA approval.
- Migration writes only to new target tables or staging tables.

## 4. Frontend Stack

### Core

- React 18+ dan React DOM.
- Vite.
- TypeScript dengan `strict: true`.
- React Router.
- Tailwind CSS.
- Native `fetch` baseline. Tambahkan HTTP library hanya bila ada kebutuhan konkret.

### State

- Server state memakai hooks dan request service pada baseline.
- Auth state memakai context dengan reducer atau store minimal.
- Form state memakai controlled forms dengan schema validation yang konsisten antara client dan server.
- Browser storage hanya untuk draft non-sensitive. Jangan menyimpan password, token, atau foto mentah.

### UI

- Reuse `Button`, `Field`, `DataTable`, `Modal`, `StatusBadge`, `Toast`, `PhotoUploader`, `RatingScale`, `DocumentPreview`, `TestLauncher`, dan `LockedAnswerView`.
- Gunakan satu icon library bila diperlukan. Setiap icon wajib memiliki accessible name bila menjadi action.
- Animation baseline memakai CSS transition. Motion library hanya ditambahkan bila CSS tidak cukup.

## 5. Backend Stack

- Node.js LTS.
- Express.js.
- TypeScript.
- `helmet` untuk security headers baseline.
- CORS allowlist untuk client origin.
- Explicit JSON body limit.
- `zod` untuk validation.
- Pino atau logger JSON untuk structured logging. Jangan log token, password, atau multipart content.
- `bcrypt` atau `bcryptjs` untuk password hash. Pilih native hanya bila image build stabil.
- `jsonwebtoken` atau `jose` untuk token signing. Pilih satu.

### Middleware Order

```text
request ID
security headers
CORS
body parser
rate limit
authentication
authorization
route handler
error serializer
access log
```

Error serializer mengikuti `SRS.md` dan tidak mengirim stack trace ke client.

## 6. Database dan ORM Decision Spike

Plan menyebut Prisma atau Knex. Baseline memilih satu saja, yaitu Knex, karena SQL Server, batch migration, dan legacy mapping memerlukan query transparency. Keputusan final tetap memerlukan spike.

### Spike Wajib

1. Koneksi SQL Server.
2. Transaction dan `IDENTITY`.
3. Read-only query ke `hris_employee`.
4. Migration create dan rollback.
5. Batch insert dan compare count.
6. Parameterized query dan safe dynamic sorting.
7. Connection pool timeout dan graceful shutdown.

### Constraint Schema

- Unique `(acara_id, nip_peserta)`.
- Unique `(acara_id, nip_peserta)` untuk attendance dan answer set.
- Foreign key ke `acara`, `ruang_acara`, dan answer parent.
- `nvarchar` untuk identifier atau NIP yang mungkin memiliki leading zero.
- `datetime2` untuk timestamp aplikasi dengan conversion timezone yang disepakati.
- Jangan memakai `float` untuk nilai. Gunakan integer point atau decimal sesuai rules.
- Check constraint atau validation layer untuk score dan feedback 1 sampai 5.
- `trainer_type` menyimpan `internal` atau `external`.
- `trainer_nip` wajib untuk internal dan null untuk external.
- Detail trainer eksternal disimpan pada tabel snapshot yang disetujui.
- `certificate.expires_at` dihitung 3 tahun dari `issued_at`.
- Jawaban peserta immutable setelah submit. API tidak menyediakan update isi jawaban.
- Index untuk date, event, NIP, department snapshot, dan status.

## 7. Authentication Design

### Access Token

- Signed JWT.
- Masa berlaku singkat, misalnya 15 menit, TBD.
- Claims minimum: `sub` = NIP, `role`, `sessionId`, dan `type = access`.
- Jangan masukkan data HR lengkap atau data sensitif.

### Refresh Token

- Random opaque token lebih baik daripada JWT refresh yang dapat dibaca.
- Simpan hash di database.
- Rotation setiap refresh.
- Revoke saat logout, password change, atau account disable.
- Cookie `HttpOnly`, `Secure`, dan SameSite konsisten dengan topologi.

### Initial Password

- Ambil `BirthDate` dari HR pada saat login awal.
- Format `YYMMDD` hanya untuk bootstrap.
- Setelah verifikasi, hash dan simpan hash account, lalu paksa password change.
- Jangan membuat endpoint yang mengembalikan BirthDate.
- Password policy final disetujui sebelum production.

## 8. API dan Data Contract

- REST JSON dengan prefix `/api`.
- OpenAPI menjadi source contract setelah API stabil.
- Zod schema berada di `packages/contracts` atau satu boundary yang disepakati.
- Error shape: `error.code`, `error.message`, `error.details`, dan `requestId`.
- Pagination: page dan limit atau cursor setelah data profiling.
- Sorting: allowlist server.
- Idempotency key untuk WA blast, upload penting, dan mutasi message.
- Pre-test dan post-test memakai endpoint terpisah dengan `phase` yang eksplisit.
- Jawaban immutable memakai endpoint submit-only, tanpa update endpoint untuk isi jawaban.
- PDF export memakai endpoint server-side dengan authorization dan batas data.

## 9. File Upload dan Storage

Baseline filesystem volume:

```text
/app/data/uploads/
├── absensi/
└── documents/
```

Production volume tidak boleh dapat diakses sebagai static public. Route backend memeriksa authorization sebelum stream file.

Validation:

- MIME allowlist.
- Magic byte atau signature check.
- Size dan image dimension limit.
- UUID filename.
- Antivirus scan bila kebijakan internal mewajibkan.
- Quarantine bila scan atau signature check gagal.
- Foto dan jawaban tidak memiliki automatic expiry atau deletion job.
- Backup dan restore wajib mencakup upload storage.

## 10. WhatsApp Adapter

Buat boundary internal yang tidak bergantung pada provider:

```text
OutboxService
  -> MessageProvider
     -> WhatsAppProvider (selected later)
```

Provider responsibilities:

- validate recipient.
- render approved template.
- send idempotently.
- normalize response.
- expose delivery status.

UI tidak mengirim pesan langsung. Semua request masuk server dan outbox.

## 11. QR, Test, dan Sertifikat

- Generate QR di server atau client dari opaque verification token.
- QR mengarah ke landing page pre-test dan post-test untuk acara terkait.
- Payload tidak memuat NIP, BirthDate, atau token JWT.
- Verification route memeriksa revocation dan access policy.
- Template sertifikat baru memakai `DocumentPreview` dan print CSS.
- Sertifikat menampilkan `issued_at` dan `expires_at` dengan validitas 3 tahun.

## 12. Docker Deployment

### Services

```text
gateway
client-static
api
worker-outbox (opsional, bila queue dipisah)
sql-server (external atau managed internal)
```

Baseline dapat menjalankan API dan outbox dalam satu process. Pisahkan worker bila volume atau retry requirement membutuhkannya.

### Environment Contract

```dotenv
NODE_ENV=production
PORT=3000
DATABASE_URL=
HRIS_DATABASE_URL=
JWT_ACCESS_SECRET=
REFRESH_TOKEN_PEPPER=
UPLOAD_ROOT=
MAX_UPLOAD_BYTES=
CORS_ORIGIN=
WHATSAPP_PROVIDER=
WHATSAPP_API_KEY=
```

Secret hanya melalui secret manager atau protected `.env` di host. `.env` tidak masuk image dan repository.

### Health

- `/health/live`: process hidup.
- `/health/ready`: database ready, migration version sesuai, storage writable.
- Health tidak mengembalikan credential atau detail internal.

## 13. Testing Stack

- Unit: framework test ringan untuk TypeScript.
- API integration: HTTP test runner dan disposable SQL Server.
- E2E: browser automation untuk role dan flow inti.
- Contract: schema validation untuk request, response, dan error.
- Migration: dry-run dan reconciliation script.
- Security: dependency scan, secret scan, authorization matrix.
- Load: smoke test, bukan benchmark produksi tanpa spesifikasi.
- PDF: assert output signature `%PDF-` dan ukuran file minimum pada test.
- Retention: test bahwa foto dan jawaban tetap dapat dibaca setelah migration lifecycle.

## 14. Observability

Minimum structured fields:

```text
timestamp
level
requestId
actorNipHash or actorNip
route
method
statusCode
durationMs
errorCode
```

Jangan log password, JWT, refresh token, NIP lengkap tanpa kebutuhan, foto, atau isi feedback.

Dashboard minimal:

- Request rate dan p95 latency.
- Error rate.
- Login failure.
- Database pool dan slow query.
- Outbox queue depth dan failed messages.
- Disk dan storage usage.
- Migration version.

## 15. Environment Strategy

| Environment | Data | External service |
|---|---|---|
| Local | Seed sintetis | Fake provider |
| Test atau CI | Disposable SQL Server | Fake provider |
| Staging | Sanitized atau masked | Provider sandbox bila ada |
| Production | Data approved | Provider production |

Test tidak dijalankan terhadap production database. Account SQL Server training dan HR dipisahkan berdasarkan privilege.

## 16. Alternatives Considered

| Keputusan | Alternatif | Alasan ditunda |
|---|---|---|
| Express | Fastify | Plan menetapkan Express; tidak perlu mengganti framework |
| Knex | Prisma | Knex dipilih baseline untuk query transparency; spike tetap wajib |
| REST | GraphQL | Scope CRUD dan report cukup REST |
| Filesystem | Object storage | On-prem baseline; object storage bila volume tidak memadai |
| Single API | Microservices | Modular monolith mengurangi operational cost |
| Custom UI | Full component suite | Tidak ada kebutuhan framework besar saat ini |
| Browser print | Server-side PDF | Export PDF harus berupa file yang dapat diunduh; renderer dipilih saat setup |

## 17. Decision Log

| ID | Keputusan | Status | Owner | Dependency |
|---|---|---|---|---|
| T-01 | Knex sebagai baseline ORM | Open sampai spike | Engineering | Spike SQL Server |
| T-02 | Node LTS exact | Open | DevOps | Runtime support policy |
| T-03 | WhatsApp provider | Open | Product dan IT | Template dan credential |
| T-04 | QR payload dan access policy | Open | Security dan Product | Pre-test dan post-test landing page |
| T-05 | File storage | Open | DevOps dan DBA | Backup dan retention permanen |
| T-06 | CI platform | Open | DevOps | Source control location |
| T-07 | Browser minimum | Open | Product dan IT | Internal user devices |
| T-08 | Retention feedback, audit, message log | Open | Legal, HC, dan IT | Foto dan jawaban permanen |
| T-09 | PDF renderer | Open | Engineering | Format laporan dan font policy |

## 18. Definition of Technical Ready

Implementasi dapat dimulai bila:

- ORM dan SQL Server spike berhasil.
- Node, package, dan browser versions disetujui.
- Secret management dan Docker image strategy disetujui.
- API contract dan error shape disepakati.
- DDL review DBA selesai.
- Security review untuk token, upload, HR read-only, QR, certificate, dan permanent retention selesai.
- PDF renderer dan report authorization disetujui.
