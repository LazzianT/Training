# AGENTS.md

Konteks bersama untuk pengerjaan **Sistem Informasi Manajemen Training dan Refreshment
Karyawan pada PT Braja Mukti Cakra**.

Dokumen ini adalah sumber kebenaran konteks. Sebelum mengerjakan bagian apa pun, baca
dokumen ini dulu. Jangan mengambil keputusan yang bertentangan dengan isinya.

---

## 1. Identitas Proyek

| Item | Nilai |
|---|---|
| Judul laporan | Perancangan dan Implementasi Sistem Informasi Manajemen Training dan Refreshment Karyawan pada PT Braja Mukti Cakra |
| Instansi | PT Braja Mukti Cakra, Divisi Human Capital |
| Jenis tugas | KKP (Kerja Kuliah Praktik) |
| Syarat kampus | **Java, berbasis desktop.** Web tidak diterima |
| Aktor aplikasi | Admin Human Capital (satu-satunya pengguna) |
| Basis data | SQL Server (sudah ada, dipakai bersama sistem lain) |

### Batasan yang tidak bisa ditawar

1. Peserta dan trainer **tidak memakai aplikasi**. Formulir diisi di lapangan, lalu
   dicatat oleh admin ke dalam sistem.
2. Aplikasi hanya dipakai oleh admin Human Capital.
3. Tidak boleh menyebut web, browser, atau QR sebagai cara akses pengguna.
4. Database dipakai bersama. Tabel milik sistem lain **read-only**.
5. Tabel baru wajib berawalan `training_`.

---

## 2. Business Logic

### 2.1 Fungsi utama

| Kode | Fungsi | Isi |
|---|---|---|
| 1 | Login ke Aplikasi | Validasi admin |
| 2 | Mengelola Acara | Tambah, ubah, hapus acara, tambah/hapus peserta, tambah trainer, cetak undangan |
| 3 | Mengelola Bank Soal | Tambah, ubah, hapus, terbitkan soal |
| 4 | Mengelola Hasil dan Laporan | Catat absensi, catat nilai, koreksi essay, catat feedback, ekspor PDF |
| 5 | Mengelola OJT | Buat batch, tambah peserta OJT, susun jadwal, catat hasil |

Urutan di atas adalah urutan logis modul, bukan urutan pengerjaan.

### 2.2 Aturan bisnis wajib

**Pengguna**

1. Admin wajib login sebelum memakai aplikasi.
2. Admin hanya mengakses fungsi sesuai kewenangannya.
3. Satu admin hanya bisa mengubah data yang menjadi tanggung jawabnya.

**Acara**

1. Acara wajib punya nama, tanggal, waktu, tempat, materi, dan trainer.
2. Peserta hanya bisa ditambahkan setelah acara dibuat.
3. Satu peserta tidak boleh terdaftar dua kali pada acara yang sama.
4. Trainer internal diambil dari data kepegawaian.
5. Trainer eksternal diinput manual oleh admin.
6. Undangan dibuat dari data acara dan daftar peserta.

**Bank soal**

1. Bank soal wajib punya minimal satu soal sebelum dipakai.
2. Soal pilihan ganda wajib punya opsi, kunci jawaban, dan poin.
3. Soal essay wajib punya poin maksimum.
4. Soal yang sudah terbit menjadi acuan penilaian. Perubahan setelah terbit dibatasi.

**Pencatatan hasil**

1. Absensi dicatat dari daftar hadir.
2. Nilai pre-test dan post-test dicatat dari lembar jawaban.
3. Nilai harus di rentang 0 sampai poin maksimum.
4. Koreksi essay **tidak boleh mengubah isi jawaban** peserta.
5. Setiap pencatatan menyimpan waktu dan siapa yang mencatat.
6. Data belum lengkap **tidak boleh dianggap nilai nol**. Tandai "belum lengkap".

**Laporan**

1. Laporan menampilkan acara, peserta, absensi, nilai, feedback yang tersedia.
2. Laporan bisa disaring per acara atau per periode.
3. Perubahan data hanya lewat fungsi pengelolaan, bukan halaman laporan.

**OJT**

1. Data OJT berdiri sendiri, terpisah dari data training reguler.
2. Peserta OJT boleh dicatat walau data karyawannya belum lengkap.
3. Batch wajib punya periode kegiatan.
4. Batch ditutup setelah kegiatan dan pencatatan selesai.

---

## 3. Flow

### 3.1 Alur training

```text
Login
  -> buat acara, tambah peserta dan trainer
  -> siapkan bank soal, terbitkan soal
  -> cetak undangan dan lembar skor
  -> training berlangsung, peserta mengisi formulir lapangan
  -> catat absensi
  -> catat nilai pre-test dan post-test
  -> koreksi essay
  -> catat feedback
  -> lihat laporan
  -> ekspor PDF
```

### 3.2 Alur OJT

```text
Buat batch
  -> tambah peserta OJT
  -> susun jadwal per materi
  -> kegiatan berlangsung
  -> catat hasil per materi
  -> tutup batch
```

### 3.3 Kondisi akhir

Data acara, peserta, trainer, bank soal, absensi, nilai, feedback, laporan, dan data OJT
sudah tersimpan dan bisa ditelusuri.

### 3.4 Kenapa bukan Excel

Nilai tambah sistem ada pada **kemampuan menelusuri dan konsistensi**, bukan pada pengurangan
ketikan. Admin tetap mengetik hasil formulir, tetapi:

- Setiap pencatatan tahu sumbernya: siapa, kapan, dari lembar mana.
- Hanya ada satu sumber data. Tidak setiap penyusun laporan menghitung dengan tabel sendiri.
- Matriks riwayat pelatihan terbentuk otomatis dari data yang masuk.

---

## 4. Design Direction

Ringkasan dari `design.md`. Aplikasinya desktop, jadi prinsip visual tetap sama, hanya
medium-nya berbeda.

| Prinsip | Penerapan |
|---|---|
| Task first | Satu aksi utama per layar |
| Trust through clarity | Label, timestamp, sumber data, konteks error jelas |
| Dense but breathable | Tabel padat, ada jarak antar seksi |
| Progressive disclosure | Form kompleks hanya tampilkan field relevan |
| Reachable by keyboard | Navigasi penuh keyboard, focus ring terlihat |
| Honest states | Ada state loading, kosong, error, sukses |

### Warna

| Token | Nilai | Pemakaian |
|---|---|---|
| `white` | `#FFFFFF` | Canvas utama dan surface |
| `navy-950` | `#071B2C` | Sidebar dan heading kuat |
| `navy-900` | `#0A2942` | Navigasi, judul, aksi utama |
| `navy-700` | `#1B3A5C` | Hover dan judul seksi |
| `navy-100` | `#DCE8F2` | Navigasi aktif dan baris terpilih |
| `ink-900` | `#142333` | Teks isi |
| `ink-600` | `#526477` | Teks sekunder |
| `border` | `#D8E0E8` | Garis dan border input |
| `canvas` | `#F6F8FA` | Latar halaman |
| `success` | `#16704A` | Sukses, hadir, selesai |
| `warning` | `#9A5B00` | Menunggu koreksi |
| `danger` | `#B42318` | Error dan konfirmasi destruktif |

Tidak ada gradient, glow, glassmorphism, atau latar ornamental.

### Tipografi dan spacing

- Font sans-serif sistem. Preferensi: `Inter` atau `Segoe UI` untuk desktop Windows.
- Heading weight 600 sampai 700. Body minimal line height 1.5.
- Angka waktu, skor, dan count pakai tabular numerals.
- Base spacing 4px. Skala: 4, 8, 12, 16, 24, 32, 48.
- Radius 6px untuk input dan tombol, 10px untuk card atau dialog.
- Border diutamakan daripada shadow. Shadow hanya untuk dialog dan dropdown.
- Target sentuh minimal 44x44px.

---

## 5. Database dan Tabel

### 5.1 Aturan akses

- Server: SQL Server yang sudah ada, database `BMC`.
- Tabel milik sistem lain **read-only**. Tidak ada `ALTER`, `DROP`, `TRUNCATE`, `UPDATE`,
  `DELETE`, `INSERT`, atau `MERGE` tanpa persetujuan tertulis DBA.
- Data kepegawaian dibaca seperlunya, tidak pernah ditulis.
- Tabel baru wajib berawalan `training_`.
- Tiap migration wajib melewati schema review dan review DBA.

### 5.2 Tabel yang tersedia

Baseline `training_sql_server.sql` berisi 22 tabel.

| Kelompok | Tabel |
|---|---|
| Referensi | `training_ruang_acara` |
| Acara | `training_acara`, `training_acara_trainer` |
| Peserta dan absensi | `training_peserta_acara`, `training_absensi` |
| Soal | `training_test_set`, `training_question_pg`, `training_question_essay` |
| Jawaban | `training_test_session`, `training_answer_pg`, `training_answer_essay` |
| Penilaian | `training_answer_grade_pg`, `training_answer_grade_essay` |
| Feedback | `training_feedback` |
| Sertifikat | `training_certificate` |
| Notifikasi | `training_notification_outbox` |
| Keamanan | `training_user_credential`, `training_refresh_session`, `training_audit_log` |
| Akses QR | `training_qr_access` |
| Migrasi | `training_legacy_history`, `training_migration_map` |

### 5.3 Tabel yang perlu ditambahkan

Baseline `training_sql_server.sql` belum menyediakan tempat untuk materi dan OJT. Semua
tabel berikut adalah milik aplikasi ini sendiri, sehingga boleh dibuat dan diubah tanpa
persetujuan tambahan. Tabel milik sistem lain tetap read-only.

#### 5.3.1 Tabel master materi

Penyebab: `training_acara.materi_pokok` bertipe `nvarchar(max)` dan diisi bebas oleh
admin. OUT-5 Rekap Materi akan menghasilkan pengelompokan duplikat kalau field ini tetap
dipakai.

```text
training_materi
  id            int IDENTITY(1,1) PK
  kode          nvarchar(50)   NOT NULL UNIQUE
  nama          nvarchar(200)  NOT NULL
  deskripsi     nvarchar(max)  NULL
  is_active     bit            NOT NULL DEFAULT 1
  created_at    datetime2(3)   NOT NULL DEFAULT SYSUTCDATETIME()
  updated_at    datetime2(3)   NOT NULL DEFAULT SYSUTCDATETIME()
```

Tabel ini dipakai oleh dua consumer:

- `training_acara` ditambah kolom `materi_id int NULL` dengan foreign key ke
  `training_materi(id)`. Kolom `materi_pokok` dipertahankan sebagai salinan teks untuk
  data legacy.
- `training_test_set` ditambah kolom `materi_id int NULL`. Dengan begitu bank soal dimiliki
  materi, bukan acara, sehingga soal dengan materi sama dipakai ulang di banyak acara.

#### 5.3.2 Tabel rantai OJT

Fungsi 5 (Mengelola OJT) belum punya tempat penyimpanan.

```text
training_ojt_batch
  id            int IDENTITY(1,1) PK
  kode          nvarchar(50)   NOT NULL UNIQUE
  judul         nvarchar(200)  NOT NULL
  periode_mulai date           NOT NULL
  periode_selesai date         NOT NULL
  status        varchar(20)    NOT NULL   -- draft, published, closed
  created_by_nip nvarchar(50)  NULL
  created_at    datetime2(3)   NOT NULL DEFAULT SYSUTCDATETIME()
  updated_at    datetime2(3)   NOT NULL DEFAULT SYSUTCDATETIME()

training_ojt_peserta
  id            int IDENTITY(1,1) PK
  batch_id      int            NOT NULL FK -> training_ojt_batch(id)
  kode_peserta  nvarchar(50)   NOT NULL UNIQUE   -- OJT-00001
  nama          nvarchar(200)  NOT NULL
  catatan       nvarchar(max)  NULL
  created_at    datetime2(3)   NOT NULL DEFAULT SYSUTCDATETIME()

training_ojt_materi
  id            int IDENTITY(1,1) PK
  kode          nvarchar(50)   NOT NULL UNIQUE
  nama          nvarchar(200)  NOT NULL
  deskripsi     nvarchar(max)  NULL
  urutan        int            NOT NULL DEFAULT 0
  is_active     bit            NOT NULL DEFAULT 1

training_ojt_jadwal
  id            int IDENTITY(1,1) PK
  batch_id      int            NOT NULL FK -> training_ojt_batch(id)
  materi_id     int            NOT NULL FK -> training_ojt_materi(id)
  tgl           date           NOT NULL
  pengajar_nip  nvarchar(50)   NULL
  created_at    datetime2(3)   NOT NULL DEFAULT SYSUTCDATETIME()
  UQ (batch_id, materi_id)     -- satu materi satu kali per batch

training_ojt_hasil
  id              int IDENTITY(1,1) PK
  batch_id        int           NOT NULL FK -> training_ojt_batch(id)
  materi_id       int           NOT NULL FK -> training_ojt_materi(id)
  peserta_id      int           NOT NULL FK -> training_ojt_peserta(id)
  phase           varchar(4)    NOT NULL   -- pre, post
  nilai           decimal(8,2)  NULL
  hadir           varchar(20)   NOT NULL DEFAULT 'not_recorded'
  dicatat_oleh_nip nvarchar(50) NULL
  dicatat_at      datetime2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
  UQ (materi_id, peserta_id, phase)
```

Bank soal OJT memakai pola yang sama dengan training reguler: `training_ojt_bank_soal`,
`training_ojt_question_pg`, dan `training_ojt_question_essay` dimiliki
`training_ojt_materi`, bukan batch.

Semua tabel OJT terpisah dari `training_*` reguler supaya data OJT tidak pernah tercampur
ke laporan training.

#### 5.3.3 Kolom petugas pencatat absensi

Masalah: aturan "setiap pencatatan menyimpan petugas yang mencatat" tidak bisa dipenuhi
untuk absensi, karena `training_absensi` hanya punya `captured_at` dan `created_at`.
Bandingkan dengan `training_answer_grade_pg` yang sudah punya `graded_by_nip`.

Solusi yang dipilih: tambah satu kolom ke tabel milik kita sendiri.

```text
ALTER TABLE dbo.training_absensi ADD recorded_by_nip nvarchar(50) NULL;
```

Kolom ini nullable karena baris lama tidak punya nilai. `ALTER` diizinkan karena
`training_absensi` adalah tabel milik aplikasi ini, bukan tabel sistem lain.

### 5.4 Tabel yang belum dipakai fitur yang sedang dikerjakan

`training_certificate` dan `training_notification_outbox` belum ada alur runtime.
Selaras dengan latar belakang yang menyatakan fitur tersebut masih terbuka.

---

## 6. Tech Stack untuk KKP

Kampus mewajibkan Java berbasis desktop. Pemilihan berikut adalah keputusan yang perlu
disepakati tim.

| Komponen | Pilihan | Alasan |
|---|---|---|
| Bahasa | Java 17 atau lebih baru | Syarat kampus |
| UI | JavaFX | Layout modern, table dan form mudah, berbeda dari Swing yang cenderung kaku |
| Build | Maven atau Gradle | Maven lebih mudah dijelaskan di laporan |
| Basis data | SQL Server + JDBC (`mssql-jdbc`) | Database sudah ada, tidak perlu ganti |
| Akses data | JDBC prepared statement | Tidak ada ORM. T-SQL eksplisit mudah diaudit DBA |
| Auth | NIP + credential awal, session login | Satu aktor, tidak butuh OAuth |
| Report | Export PDF dari aplikasi | Ekspor PDF masih dalam ruang lingkup |
| Testing | JUnit 5 | Standar Java, mudah diuji black box |

Alternatif kalau tim memilih Swing: tabel lebih mudah, tapi form, dialog, dan styling jauh
lebih banyak kerja manual. Rekomendasi tetap JavaFX.

### Aturan implementasi

1. Tidak ada query string yang digabung dari input user. Selalu prepared statement.
2. Otorisasi dicek di sisi aplikasi, bukan hanya dengan menyembunyikan tombol.
3. Credential tidak disimpan sebagai teks polos.
4. Setiap pencatatan hasil menyimpan audit: siapa dan kapan.
5. Koneksi database tidak dibuka permanen di setiap layar. Gunakan connection manager.

---

## 7. KPI

KPI dipakai untuk mengukur keberhasilan proyek KKP dan untuk menilai kualitas sistem
setelah dipakai.

### 7.1 KPI proyek

| No | Indikator | Ukuran | Target |
|---|---|---|---|
| 1 | Kelengkapan modul | Fungsi utama yang selesai | 5 dari 5 |
| 2 | Kesesuaian aturan bisnis | Aturan yang diuji | Semua |
| 3 | Kelengkapan diagram UML | use case, activity, class, sequence | 4 dari 4 |
| 4 | Hasil pengujian black box | Skenario yang lulus | Seluruh skenario inti |
| 5 | Kesesuaian dengan kebutuhan | Hasil penilaian dosen | Sesuai kebutuhan |
| 6 | Output laporan | Laporan wajib yang selesai dibuat | 6 dari 6 |

### 7.2 KPI sistem setelah dipakai

| No | Indikator | Cara ukur |
|---|---|---|
| 1 | Kelengkapan data acara | Persentase acara yang punya peserta, soal, dan hasil |
| 2 | Kelengkapan pencatatan | Persentase peserta yang punya absensi dan nilai |
| 3 | Keterlacakan | Setiap nilai punya sumber: siapa mencatat, kapan, dari lembar mana |
| 4 | Kecepatan pelaporan | Waktu membuat laporan satu acara |
| 5 | Kualitas matriks karyawan | Persentase karyawan dengan riwayat training yang lengkap |

### 7.3 KPI untuk menilai efektivitas training

| No | Indikator | Cara ukur |
|---|---|---|
| 1 | Peningkatan hasil belajar | Selisih persentase capaian antara post-test dan pre-test |
| 2 | Persentase peserta naik | Peserta dengan gain di atas ambang, dibagi dengan peserta lengkap |
| 3 | Efektivitas per materi | Rata-rata gain tiap materi |
| 4 | Efektivitas per departemen | Rata-rata gain tiap departemen |

Catatan penting untuk KPI 7.3 sampai 7.6:

- Gain adalah **indikator**, bukan bukti sebab-akibat. Tidak ada kelompok pembanding.
- Peserta yang hanya mengisi satu fase ditandai **belum lengkap**, tidak dihitung sebagai
  gain nol.
- Ambang label harus bisa diatur admin, tidak di-hardcode.

---

## 8. Output Laporan Wajib

Aplikasi harus menghasilkan enam output laporan. Enam laporan ini adalah output minimal
yang wajib tersedia, dapat disaring, dan dapat diekspor ke PDF.

| Kode | Nama Laporan | Isi |
|---|---|---|
| OUT-1 | Laporan Daftar Acara | Nama acara, tanggal, waktu, tempat, materi, trainer, jumlah peserta |
| OUT-2 | Laporan Absensi | Peserta yang hadir per acara, beserta waktu pencatatan |
| OUT-3 | Laporan Hasil Training | Nilai pre-test, nilai post-test, gain, dan label kenaikan per peserta |
| OUT-4 | Laporan Matriks Karyawan | Karyawan terhadap training, dapat disaring per departemen |
| OUT-5 | Laporan Rekap Materi | Rata-rata gain, jumlah peserta, dan tingkat kenaikan per materi |
| OUT-6 | Laporan Hasil OJT | Nilai dan kehadiran peserta OJT per batch dan per materi |

Aturan output laporan:

1. Semua laporan dapat disaring berdasarkan acara, periode, atau departemen.
2. Semua laporan dapat diekspor ke PDF.
3. Laporan hanya menampilkan data yang tersimpan di sistem. Perubahan data hanya lewat
   fungsi pengelolaan, bukan dari halaman laporan.
4. Peserta yang belum melengkapi data tidak boleh dihitung sebagai nilai nol.
5. Semua query laporan memakai prepared statement dan tidak menggabungkan input user ke
   dalam query string.

### 8.1 OUT-1 Laporan Daftar Acara

**Sumber tabel:** `training_acara`, `training_ruang_acara`, `training_acara_trainer`,
`training_peserta_acara`

**Kolom yang dipakai:** `judul`, `tgl`, `waktu_mulai`, `waktu_selesai`, `materi_pokok`,
`sasaran`, `status`, `nama_ruangan`, `trainer_name`, `trainer_nip`, `trainer_type`,
`is_primary`.

**Cara join:**

```text
training_acara
  LEFT JOIN training_ruang_acara        ON ruang_id = id
  LEFT JOIN training_acara_trainer      ON event_id = training_acara.id
  LEFT JOIN training_peserta_acara      ON event_id = training_acara.id
```

Jumlah peserta dihitung dengan `COUNT` dari `training_peserta_acara`, bukan disimpan
sebagai kolom. Trainer yang ditampilkan diutamakan `is_primary = 1`.

**Filter:** periode `tgl`, `status`, kata kunci pada `judul`, ruang.

**Langkah di aplikasi:** buka menu Laporan → pilih Daftar Acara → tentukan periode →
centang kolom yang ditampilkan → pratinjau → ekspor PDF.

### 8.2 OUT-2 Laporan Absensi

**Sumber tabel:** `training_acara`, `training_peserta_acara`, `training_absensi`

**Kolom yang dipakai:** `participant_nip`, `participant_name`, `department_name`,
`attendance_status`, `captured_at`, `created_at`, `photo_path`.

**Cara join:**

```text
training_peserta_acara
  LEFT JOIN training_absensi ON event_id = ... AND participant_nip = ...
```

**Status kehadiran** diambil dari `training_peserta_acara.attendance_status` dengan nilai
`not_recorded`, `present`, `absent`. Baris `training_absensi` dipakai sebagai bukti
kehadiran beserta `captured_at`.

**Filter:** acara, periode, departemen, status kehadiran.

**Langkah di aplikasi:** pilih Laporan → Absensi → pilih acara → tentukan kolom →
pratinjau → ekspor PDF.

### 8.3 OUT-3 Laporan Hasil Training

**Sumber tabel:** `training_test_session`, `training_answer_pg`,
`training_answer_grade_pg`, `training_answer_essay`, `training_answer_grade_essay`,
`training_question_pg`, `training_question_essay`, `training_peserta_acara`

**Poin maksimal per test set** dihitung dari:

```text
Poin = SUM(training_question_pg.point) + SUM(training_question_essay.max_point)
```

**Nilai per peserta per fase** dihitung dari penjumlahan skor di
`training_answer_grade_pg.score` dan `training_answer_grade_essay.score`, dikelompokkan
per `participant_nip` dan `phase` pada `training_test_session`.

**Persentase capaian dan gain:**

```text
%Pre  = (nilai phase 'pre'  / poin maksimal) x 100
%Post = (nilai phase 'post' / poin maksimal) x 100
Gain  = %Post - %Pre
```

Nilai mentah tidak dibandingkan langsung karena pre-test dan post-test belum tentu memiliki
jumlah soal dan poin yang sama.

**Label dengan ambang yang dapat diatur admin:**

| Gain | Label |
|---|---|
| >= +15 | Naik signifikan |
| +5 sampai +14 | Naik tipis |
| -5 sampai +5 | Stagnan |
| <= -5 | Turun |

Peserta yang hanya punya satu fase ditandai **belum lengkap** dan tidak dihitung dalam
rata-rata.

**Filter:** acara, periode, departemen, label kenaikan.

### 8.4 OUT-4 Laporan Matriks Karyawan

**Sumber tabel:** `training_peserta_acara`, `training_acara`, data kepegawaian
(read-only).

**Kolom yang dipakai:** `participant_nip`, `participant_name`, `department_code`,
`department_name`, `judul`, `tgl`, `attendance_status`.

**Cara memperoleh data:** satu baris per karyawan per acara yang pernah diikuti. Rekap
departemen tidak dibuat sebagai laporan terpisah, melainkan menjadi filter
`department_code` pada laporan ini.

**Filter:** NIP, nama, departemen, periode, status kehadiran.

### 8.5 OUT-5 Laporan Rekap Materi

**Sumber tabel:** `training_acara`, `training_peserta_acara`, `training_test_session`,
tabel penilaian.

**Pengelompokan:** memakai `training_acara.materi_pokok`.

**Isi laporan:** jumlah acara, jumlah peserta, rata-rata gain, dan persentase peserta yang
naik per materi.

**Filter:** periode, departemen, materi.

### 8.6 OUT-6 Laporan Hasil OJT

**Sumber tabel:** tabel `training_ojt_*` yang belum tersedia di baseline.

**Isi laporan:** nilai pre-test dan post-test, gain, serta kehadiran per peserta, dikelompokkan
per batch dan per materi.

**Status:** menunggu desain tabel OJT. Laporan ini menjadi target setelah schema OJT disetujui.

### 8.7 Catatan teknis untuk pengembangan laporan

1. **Materi belum punya master data di baseline.** Pengelompokan OUT-5 sementara memakai kolom teks
   `training_acara.materi_pokok`. Perancangan tabel `training_materi` sudah ada di 5.3.1 dan perlu
   melewati review DBA.
3. **`training_feedback` belum dipakai.** Laporan feedback sengaja tidak dimasukkan karena
   belum ada alur runtime.
4. **`training_certificate` dan `training_notification_outbox` belum dipakai.** Keduanya
   tidak masuk daftar output wajib.
5. Semua perhitungan gain dilakukan di sisi database atau service, bukan di antarmuka, agar
   hasil antar laporan konsisten.

---

## 9. Hal yang Masih Butuh Keputusan

1. JavaFX atau Swing.
2. Maven atau Gradle.
3. Schema tabel OJT, perlu review DBA.
4. Ambang label gain untuk KPI 7.3.
5. Data profil instansi: bidang usaha dan jumlah karyawan resmi.
