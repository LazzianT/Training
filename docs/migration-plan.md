# Training Legacy Migration Plan

Status: Draft untuk review DBA dan Engineering.
Sumber legacy: `training.sql`, dump MariaDB `10.4.28`.
Target: SQL Server `SVR-BMC-SQL`, database `BMC`.
Migration DDL: `server/migrations/001_training_schema.sql`.

## 1. Safety Boundary

- Existing SQL Server tables are read-only.
- Tidak menjalankan `ALTER`, `DROP`, `TRUNCATE`, `UPDATE`, `DELETE`, `INSERT`, atau `MERGE` pada existing table.
- Semua target table baru memakai prefix `training_`.
- Raw `training.sql` tidak dipublikasikan ke GitHub.
- DDL belum dieksekusi. Review schema dan DBA approval diperlukan sebelum migration.

## 2. Mapping Tabel

| Legacy table | Target table | Keterangan |
|---|---|---|
| `acara` | `training_acara` | Judul, tanggal, sasaran, materi, waktu, ruang, status |
| `trainer_acara` | `training_acara_trainer` | NIP internal atau marker external untuk data yang belum tervalidasi |
| `ruang_acara` | `training_ruang_acara` | Nama ruang dan legacy ID |
| `peserta_acara` | `training_peserta_acara` | NIP, snapshot departemen, kehadiran, invitation status |
| `absensi_training` | `training_absensi` | Path tanda tangan/foto, waktu, checksum file bila tersedia |
| `induk_master_soal` | `training_test_set` | Satu set dapat memiliki session pre-test dan post-test |
| `master_soal` | `training_question_pg` | Pilihan ganda, kunci, gambar, point |
| `essay` | `training_question_essay` | Pertanyaan, guide, gambar, point bila tersedia |
| `jawaban_user` | `training_answer_pg` | Jawaban, legacy key, legacy point, phase dari `jenis` |
| `essay_jawaban_user` | `training_answer_essay` | Jawaban dan legacy result |
| `user_feedback` | `training_feedback` | Satu row per aspect, score 1 sampai 5 bila valid |
| `trainer_feedback` | `training_feedback` | Satu row per aspect, score 1 sampai 5 bila valid |
| `feedback` | `training_legacy_history` | Data umum tanpa event ID; relasi event tidak dapat dipastikan |
| `data_training_karyawan` | `training_legacy_history` | Riwayat training lama tanpa event ID |
| `schedule_creator` | Tidak ditambahkan | Password lama tidak dimigrasi; credential baru dari HR |

## 3. Mapping Aturan

### 3.1 NIP

- Legacy `NONIK` dipetakan ke `NIP` tanpa mengubah format string.
- Simpan sebagai `nvarchar(50)` untuk mempertahankan leading zero.
- Mapping divalidasi terhadap `hris_employee.NIP`.
- Duplicate NIP pada `hris_employee` menghasilkan exception list, bukan silent join.

### 3.2 Event dan trainer

- `acara.id` disimpan sebagai `training_acara.legacy_id`.
- `acara.trainer` atau `trainer_acara.nik_trainer` dicari pada `hris_employee`.
- NIP valid menjadi `trainer_type = 'internal'`.
- NIP tidak ditemukan tidak boleh otomatis dianggap sebagai trainer eksternal. Catat sebagai `rejected` untuk review admin.
- Trainer eksternal baru dapat dibuat melalui form manual, bukan dari dump legacy.

### 3.3 Peserta

- `peserta_acara.nik_peserta` dipetakan ke `participant_nip`.
- `departemen` lama disimpan sebagai snapshot, bukan foreign key mutable.
- `kehadiran` kosong menjadi `not_recorded`.
- `blast` provisional mapping: `0 = not_sent`, `1 = sent`, `2 = skipped`. Mapping final perlu approval owner.
- Duplicate pasangan event dan NIP masuk reconciliation report.

### 3.4 Absensi

- `file_ttd` dipetakan ke `photo_path` jika file benar-benar tersedia.
- Missing file tidak dianggap success. Catat `rejected` atau `pending_file`.
- File baru harus disimpan pada private volume dengan UUID path dan checksum.

### 3.5 Test dan phase

- `induk_master_soal` menjadi satu `training_test_set`.
- `jawaban_user.jenis = 'pre'` dan `jenis = 'post'` atau `'pos'` menjadi session phase `pre` dan `post`.
- `jenis = 'pos'` dinormalisasi menjadi `post` dan dicatat pada migration map.
- Satu set dapat digunakan pada dua phase; karena itu phase berada pada `training_test_session`, bukan pada question set.
- Jawaban setelah submit tidak dapat diubah. Grade essay berada pada tabel grade terpisah.

### 3.6 Feedback

- `user_feedback` dipetakan ke `feedback_type = 'user'`.
- `trainer_feedback` dipetakan ke `feedback_type = 'trainer'`.
- Setiap kolom aspect menjadi satu row `training_feedback`.
- Score string `1` sampai `5` menjadi decimal. Score kosong, di luar range, atau tidak numeric menjadi exception.
- `komentar` disimpan pada setiap row aspect atau row pertama sesuai aturan final sebelum migration.

## 4. Migration Sequence

1. DBA review DDL dan migration plan.
2. Buat database target atau schema approved jika diperlukan.
3. Jalankan DDL `001_training_schema.sql` pada disposable SQL Server clone.
4. Jalankan mapping source ke tabel `training_migration_map` dalam batch kecil.
5. Migrasikan `ruang_acara` dan `acara`.
6. Migrasikan trainer tervalidasi dan peserta tervalidasi.
7. Migrasikan absensi dengan file verification.
8. Migrasikan test set, questions, sessions, dan answers.
9. Migrasikan feedback dan history.
10. Jalankan reconciliation queries.
11. DBA review hasil dan backup sebelum production migration.

## 5. Validation Queries

Query berikut dijalankan setelah migration pada target baru. Query bersifat read-only.

```sql
SELECT source_table, status, COUNT_BIG(*) AS row_count
FROM dbo.training_migration_map
GROUP BY source_table, status
ORDER BY source_table, status;

SELECT COUNT_BIG(*) AS orphan_participants
FROM dbo.training_peserta_acara p
LEFT JOIN dbo.training_acara e ON e.id = p.event_id
WHERE e.id IS NULL;

SELECT COUNT_BIG(*) AS duplicate_event_nip
FROM (
    SELECT event_id, participant_nip
    FROM dbo.training_peserta_acara
    GROUP BY event_id, participant_nip
    HAVING COUNT_BIG(*) > 1
) d;

SELECT COUNT_BIG(*) AS invalid_feedback
FROM dbo.training_feedback
WHERE score IS NULL OR score < 1 OR score > 5;

SELECT COUNT_BIG(*) AS duplicate_answer_session_question
FROM (
    SELECT session_id, question_id
    FROM dbo.training_answer_pg
    GROUP BY session_id, question_id
    HAVING COUNT_BIG(*) > 1
) d;

SELECT COUNT_BIG(*) AS certificates_without_expiry
FROM dbo.training_certificate
WHERE expires_at IS NULL OR expires_at <= issued_at;
```

## 6. Blocking Exceptions

- NIP tidak ditemukan di `hris_employee`.
- NIP duplicate pada `hris_employee`.
- Legacy date `0000-00-00`.
- Point tidak numeric atau di luar range.
- Feedback aspect tidak valid.
- File absensi tidak ditemukan.
- Event reference tidak ditemukan.
- Trainer legacy tidak dapat diklasifikasikan.
- Password legacy tidak pernah dimigrasi.

## 7. Definition of Done Migration

- DDL reviewed DBA.
- Tidak ada perubahan existing table.
- Semua source row punya status `completed`, `rejected`, atau `pending_file`.
- Count source dan target/report cocok atau selisih dijelaskan.
- Tidak ada duplicate event/NIP, session/question, atau certificate.
- Semua jawaban permanent dan tidak memiliki endpoint update isi.
- Backup target dan kredensial DBA tersimpan aman.
- QA menandatangani migration result.
