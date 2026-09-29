# ADR 001: Database Access Layer

Status: Accepted (2026-09-28)
Konteks: Aplikasi Training PT BMC, SQL Server `SVR-BMC-SQL` (10.19.25.27:1433) database `BMC` — shared dengan tabel `hris_*` existing yang read-only.

## Keputusan

Aplikasi memakai **node-mssql (`mssql`) raw dengan parameterized T-SQL** sebagai data access layer. Tidak memakai Knex, Prisma, TypeORM, atau ORM/query builder lain.

## Alasan

1. **Risiko maintenance Knex.** Release terakhir Knex adalah Desember 2023, dengan isu lama yang tidak tertangani pada dialect mssql/tedious. Driver `mssql` yang sudah dipakai proyek ini aktif dirawat dan sudah terbukti bekerja pada environment BMC.
2. **Sudah tervalidasi di environment nyata.** Probe 2026-09-28 (lihat Evidence) membuktikan koneksi, parameterized query, dan transaksi berjalan dengan latensi rendah terhadap `SVR-BMC-SQL`.
3. **Kontrol penuh atas T-SQL.** Schema aplikasi mengandung pola khusus SQL Server (composite FK `training_test_session (id, test_set_id)`, filtered index, `COUNT_BIG`, snapshot kolom) yang lebih mudah ditulis sebagai T-SQL eksplisit daripada diterjemahkan lewat query builder.
4. **Permukaan keamanan kecil.** Semua akses data lewat helper parameterized tunggal memudahkan audit: tidak ada string concatenation, tidak ada dynamic SQL tanpa allowlist.
5. **Kebutuhan migrasi adalah batch T-SQL.** Migration legacy berjalan sebagai batch statement dengan transaction control — bentuk yang memang natural ditulis sebagai T-SQL, bukan query builder.

## Konsekuensi

- Wajib disiplin: semua query melalui helper/repository yang memakai `.input()` untuk parameter. Dilarang menggabungkan string user input ke T-SQL.
- Sorting/filter dinamis wajib lewat **allowlist identifier** (mapping ke kolom literal), bukan interpolasi nilai.
- Tidak ada change-tracking/migration framework dari ORM. Migration tetap file SQL versioned di `server/migrations/` dengan runner sendiri (`migrate-legacy.ts`), plus guard approval DBA.
- Pool dikelola eksplisit: singleton pool pada runtime API, timeout dan graceful shutdown diatur di level aplikasi (bagian dari task observability fase 12).
- Jika kebutuhan pagination/report bertambah komplems, evaluasi ulang hanya dengan ADR baru — bukan penambahan dependency diam-diam.

## Evidence: Probe 2026-09-28 (read-only)

Script: `server/scripts/db-probe.ts` (SELECT-only, transaksi di-rollback).

- `Microsoft SQL Server 2019 (RTM) - 15.0.2000.5`, Standard Edition, database `BMC`, login `sa`
- Inventory: 638 tabel existing, **0** tabel `training_*` (belum ada tabrakan namespace)
- Parameterized query `hris_Employee WHERE is_Active = 1`: **516 rows** (11ms) — cocok dengan discovery 2026-09-25
- Transaksi read-only + rollback: **564 rows** (19ms) — cocok dengan discovery
- Latensi identity/inventory query: 26–32ms

## Alternatif yang Dipertimbangkan

- **Knex**: query builder populer, tapi risiko maintenance (rilis terakhir Des 2023) dan layer ekstra atas T-SQL yang justru ingin eksplisit.
- **Prisma/TypeORM**: butuh schema engine sendiri, menambah kompleksitas deployment on-premise, dan relasi composite FK sulit diekspresikan natural. Prisma juga tidak mendukung SQL Server sebagai target first-class di versi terkini.
- **EF Core (terpisah)**: menambah runtime .NET hanya untuk data access — tidak sesuai arsitektur Node.js yang sudah dipilih.
