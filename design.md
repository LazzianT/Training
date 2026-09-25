# Design Aplikasi Training PT BMC

Status: Draft untuk discovery dan UI review.
Sumber: `RECREATION_PLAN.md`, `PRD.md`, `SRS.md`.

## 1. Design Direction

Reading this as: internal HR operations workspace untuk Human Capital dan karyawan, visual language tenang dan tegas, dial `ENERGY 1 / RHYTHM 2 / MOTION 1`.

Brief menetapkan putih sebagai primary, navy sebagai secondary, tampilan profesional, dan transisi halus. Setiap keputusan besar dituliskan alasannya.

## 2. Prinsip Desain

| Prinsip | Penerapan | Dampak UI |
|---|---|---|
| Task first | Staff mencapai tugas operasional tanpa navigasi berlebihan | Satu primary action per screen |
| Trust through clarity | Data karyawan, nilai, dan status jelas | Label, timestamp, source, error context |
| Dense but breathable | Admin dapat bekerja dengan data banyak | Table compact, whitespace antar section |
| Progressive disclosure | Complex form hanya menampilkan field relevan | Section atau collapsible sections |
| Reachable by keyboard | Administrasi internal dapat diakses semua user | Focus ring, logical tab order, Escape handler |
| Honest states | Data tidak selalu tersedia atau request gagal | Loading, empty, error, success state |

## 3. Visual System

### 3.1 Warna

| Token | Nilai | Usage | Alasan |
|---|---|---|---|
| `white` | `#FFFFFF` | Canvas utama dan primary surface | Brief meminta primary putih |
| `navy-950` | `#071B2C` | Sidebar dan heading kuat | Membership hierarchy dan identitas internal |
| `navy-900` | `#0A2942` | Navigation, title, primary dark action | Secondary brand color dari brief |
| `navy-700` | `#1B3A5C` | Hover dan section heading | Mempertahankan kontras pada permukaan gelap |
| `navy-100` | `#DCE8F2` | Active navigation dan selected row | Menunjukkan current context |
| `ink-900` | `#142333` | Body text | Contrast tinggi pada putih |
| `ink-600` | `#526477` | Secondary text | Tetap terbaca tanpa noise |
| `border` | `#D8E0E8` | Divider dan input border | Struktur tanpa decorative noise |
| `canvas` | `#F6F8FA` | Page background | Memisahkan content surface dari white card |
| `success` | `#16704A` | Sukses, hadir, selesai | Status semantic |
| `warning` | `#9A5B00` | Menunggu koreksi, upload warning | Status semantic |
| `danger` | `#B42318` | Error dan destructive confirmation | Status semantic |

Tidak ada gradient default, glow, glassmorphism, atau ornamental background. Warna text dan status harus diuji pada background yang sebenarnya.

### 3.2 Tipografi

- Font UI: `Inter` dengan fallback system sans-serif. Alasan: keterbacaan tinggi untuk table dan form internal.
- Heading: weight 600 sampai 700 dengan hierarchy yang jelas.
- Body: 14 sampai 16px dengan line height minimal 1.5.
- Label: 12 sampai 13px, weight 600, tanpa letter tracking berlebihan.
- Angka waktu, score, dan count memakai tabular numerals.

Font di-self-host atau memakai fallback cepat agar tidak memblokir first render.

### 3.3 Spacing, radius, shadow

- Base spacing: 4px. Skala: 4, 8, 12, 16, 24, 32, 48.
- Radius: 6px untuk input dan tombol, 10px untuk card atau dialog. Tidak memakai pill shape.
- Shadow hanya digunakan pada dialog, dropdown, dan sidebar overlay.
- Border lebih diutamakan daripada shadow untuk table, divider, dan card.
- Target sentuh minimum: 44x44px di mobile.

### 3.4 Motion

Motion dial: `MOTION 1`. Aplikasi operasional harus cepat dan tidak mengganggu reading.

- Hover: 120 sampai 160ms untuk warna atau shadow.
- Route: fade 150ms tanpa slide yang mengganggu.
- Sidebar: width transition 180ms, menghormati `prefers-reduced-motion`.
- Loading: skeleton atau spinner dengan accessible label.
- Tidak ada auto animation, parallax, atau motion yang tidak relevan.

## 4. Information Architecture

### 4.1 Public

```text
/login
/verify-account
/reset-password
```

### 4.2 Admin

```text
/admin
/admin/acara
/admin/acara/:id
/admin/acara/:id/peserta
/admin/acara/:id/absensi
/admin/acara/:id/soal
/admin/acara/:id/pre-test
/admin/acara/:id/post-test
/admin/acara/:id/feedback
/admin/acara/:id/laporan
/admin/karyawan
/admin/notifikasi
```

### 4.3 User

```text
/app
/app/acara
/app/acara/:id
/app/acara/:id/absen
/app/acara/:id/pre-test
/app/acara/:id/post-test
/app/acara/:id/ujian
/app/acara/:id/feedback
/app/sertifikat
/app/bantuan
```

Route guard mencegah user atau admin mengakses route yang tidak sesuai. Menu yang belum dibangun tidak ditampilkan sebagai link aktif. Jika perlu, tandai `Segera`.

## 5. Layout Global

### Desktop

- Sidebar 248 sampai 272px dengan `navy-950`, navigation group, dan collapse control.
- Topbar putih setinggi 64px berisi breadcrumb, current user, dan notification action yang nyata.
- Content area memakai background `canvas`, max width 1440px, padding 24 sampai 32px.
- Dashboard admin memakai dense table, bukan hero landing page.

### Tablet

- Sidebar dapat collapse menjadi icon rail.
- Table mempertahankan horizontal scroll di area tabel, bukan seluruh page.
- Filter menjadi drawer atau stacked row.

### Mobile

- Prioritas mobile adalah alur peserta: login, daftar acara, absen, ujian, feedback, sertifikat.
- Sidebar admin menjadi off-canvas drawer dengan focus trap dan Escape close.
- Table admin dapat menjadi stacked record row tanpa kehilangan field penting.
- Sticky bottom action bar untuk submit utama.
- Tidak ada horizontal overflow.

## 6. Halaman dan Komponen

### 6.1 Login

Layout dua bagian pada desktop: panel kiri navy dengan identitas singkat, panel kanan form putih. Mobile hanya form dengan text mark `[LOGO]` bila aset belum disetujui.

Form fields:

- NIP.
- Password.
- Show atau hide password dengan accessible label.
- Error inline dan global form error.
- Loading state pada tombol submit.

Tidak menampilkan statistik, testimonial, atau klaim yang belum terbukti.

### 6.2 Admin Dashboard

Focal point: `Acara mendatang` atau `Tindakan yang perlu diselesaikan`, bukan metric dekoratif.

Konten:

- Filter tanggal.
- Quick action `Buat acara`.
- Tabel acara dengan judul, tanggal, ruang, peserta, absensi, dan status soal.
- Panel `Perlu ditinjau` untuk essay `pending` dan outbound message failure.
- Empty state: `Belum ada acara. Buat acara pertama untuk memulai.` dengan action yang bekerja.

### 6.3 Daftar Acara

- Search dan filter tanggal, status, ruang, serta trainer.
- Table columns: Judul, Jadwal, Ruang, Peserta, Kehadiran, Ujian, Status, Aksi.
- Row click membuka detail. Action menu keyboard accessible.
- Filter state bertahan selama navigasi bila disetujui.

### 6.4 Detail Acara

Header berisi judul, tanggal, status, dan primary action sesuai lifecycle. Section atau tab:

- Ringkasan.
- Peserta.
- Absensi.
- Soal dan ujian.
- Pre-test.
- Post-test.
- Feedback.
- Komunikasi.
- Laporan.

Tab yang belum memiliki route tidak ditampilkan sebagai link aktif. Tab locked harus menjelaskan alasannya.

### 6.5 Trainer Internal dan Eksternal

Admin event form memiliki dua mode:

- `Internal`: pencarian NIP dari HR read-only, preview nama dan departemen, pilihan hanya NIP valid.
- `Eksternal`: form manual dengan field minimum yang disetujui, tanpa pencarian HR.

Mode trainer tidak mengubah lifecycle acara. Perubahan sumber trainer setelah acara dipublikasikan mengikuti aturan audit.

### 6.6 Peserta

- Search NIP atau nama dari HR.
- Preview data sebelum add.
- Bulk add hanya bila input sudah dinormalisasi. Parser file tidak termasuk MVP.
- Status undangan: `Belum dikirim`, `Dikirim`, `Gagal`, `Dilewati`.
- Remove memakai confirmation dialog yang menyebut NIP dan event.

### 6.7 Absensi

Admin view memiliki filter hadir atau belum hadir, thumbnail, timestamp, dan status file. User view memiliki preview, guidance, capture atau upload, dan submit.

- Preview sebelum upload.
- Constraint file tampil sebelum picker dan divalidasi ulang server.
- Success screen menampilkan timestamp server dan event.
- Error state mempertahankan metadata draft tetapi tidak mengklaim foto diterima.
- Foto yang berhasil disimpan permanen dan tidak memiliki tombol hapus dari UI user.

### 6.8 Soal dan Ujian

Admin editor:

- Set header berisi judul set, fase, trainer, jenis, dan jumlah.
- Question list dengan reorder sederhana.
- Multiple choice editor memisahkan stem, options, key, dan point.
- Essay editor memisahkan stem, instruction, dan point.
- Preview mode sebelum publish.

Participant exam:

- Satu soal per screen atau section yang jelas.
- Autosave hanya bila endpoint tersedia dan dikonfigurasi.
- Submit confirmation merangkum jumlah terjawab.
- Submit disabled bila required question belum dijawab.
- Setelah submit, form berada pada state `locked`; tidak ada action edit.
- Kunci jawaban tidak masuk ke payload user.

### 6.9 Koreksi Essay

- Desktop: daftar essay di kiri dan form koreksi di kanan.
- Mobile: list lalu drill-down.
- Numeric input dengan batas min dan max.
- Action `Simpan nilai`.
- Setelah save, tampilkan timestamp evaluator.
- Isi jawaban tetap read-only.

### 6.10 Feedback

- Aspek berasal dari backend.
- Radio scale 1 sampai 5 dengan label endpoint yang jelas.
- Keterangan opsional.
- Progress `n dari m aspek terisi`.
- Submit state dan duplicate response handling.

### 6.11 Pre-test dan Post-test

- QR pada undangan atau akses acara mengarah ke landing page.
- Landing page menampilkan event, status akses, serta action pre-test atau post-test.
- Setelah test dimulai, navigasi keluar memerlukan confirmation.
- Setelah submit, test berada pada state `locked` dan menampilkan timestamp submit.
- Pre-test dan post-test tidak menampilkan kunci jawaban.

### 6.12 Laporan

- Filter: event, date range, department, dan attendance status.
- Summary strip memakai angka dari query.
- Tabs: Kehadiran, Ujian, Feedback.
- Action `Export PDF` tersedia setelah endpoint siap.
- Print stylesheet menyembunyikan sidebar dan navigation.

### 6.13 WhatsApp

- Langkah 1 pilih recipients.
- Langkah 2 pilih template.
- Langkah 3 preview dan confirm.
- Outbox table dengan status dan retry.
- Tidak ada blast langsung tanpa preview.

### 6.14 Sertifikat dan Undangan

- Preview A4 menjadi focal point.
- QR pada undangan atau akses acara mengarah ke landing page pre-test dan post-test.
- Setelah dipindai, halaman menampilkan status akses, event, dan pilihan pre-test atau post-test yang sesuai.
- Sertifikat menampilkan masa berlaku 3 tahun sejak tanggal terbit.
- Status sertifikat: `Belum memenuhi syarat`, `Siap`, `Kedaluwarsa`, `Dicabut`, `Tidak ditemukan`.
- Print action nyata.

## 7. Component Inventory

| Component | Tanggung jawab |
|---|---|
| `AppShell` | Sidebar, topbar, content, responsive layout |
| `RouteGuard` | Authenticated dan role-based route access |
| `Button` | Action hierarchy, loading, disabled state |
| `Field` | Label, input, hint, error association |
| `DataTable` | Table semantics, sorting, empty, loading, pagination |
| `StatusBadge` | Status semantic dengan label text |
| `Modal` | Confirmation dan form overlay dengan focus management |
| `Toast` | Transient result, bukan critical error |
| `ScoreInput` | Numeric score dengan min dan max |
| `RatingScale` | Feedback 1 sampai 5 |
| `PhotoUploader` | Preview, validation, progress, error |
| `DocumentPreview` | A4 atau print-ready preview |
| `QrVerification` | Verification code link dan status |
| `TestLauncher` | Menampilkan pre-test atau post-test yang sesuai |
| `LockedAnswerView` | Menampilkan jawaban submitted tanpa action edit |

## 8. State Contract

Setiap data-bearing screen wajib memiliki:

- **Loading:** skeleton atau progress dengan accessible label.
- **Empty:** penyebab, dampak, dan satu primary action bila ada.
- **Error:** pesan, request ID untuk support, dan retry bila aman.
- **Success:** konfirmasi perubahan dan lokasi hasil.
- **Forbidden:** penjelasan singkat tanpa data sensitif.
- **Offline atau timeout:** retry dan draft retention tanpa klaim sukses.
- **Partial data:** tandai field yang belum tersedia. Jangan memakai `-` yang ambigu.
- **Locked:** test atau jawaban sudah submit dan tidak dapat diedit.

## 9. Accessibility

- Semua action dapat dicapai keyboard.
- Focus ring minimal 2px dengan kontras terhadap background.
- Dialog menerima fokus, mengembalikan fokus ke trigger, dan dapat ditutup dengan Escape.
- Table memiliki caption atau heading yang dapat diakses.
- Form error dikaitkan dengan `aria-describedby` dan `aria-invalid`.
- Status tidak hanya mengandalkan warna. Label text selalu tersedia.
- Kontras diuji pada navy, white, canvas, dan semantic colors.
- Reduced motion mengubah non-essential transition menjadi instant.

## 10. Content Direction

- Bahasa Indonesia dengan plain language.
- CTA spesifik: `Buat acara`, `Simpan peserta`, `Kirim undangan`, `Simpan nilai`, `Export PDF`.
- Contoh error: `Tidak dapat memuat daftar peserta. Coba lagi atau hubungi admin.`
- Empty state menjelaskan tindakan berikutnya.
- Jangan membuat nama, testimoni, statistik, atau logo fiktif.
- Sebelum aset final tersedia, gunakan `[LOGO]`, `[NAMA INSTANSI]`, atau teks yang jelas.

## 11. Visual Acceptance Checklist

- [ ] Desktop, tablet, dan mobile tidak memiliki page-level horizontal overflow.
- [ ] Primary action terlihat jelas pada setiap task screen.
- [ ] Semua data view punya loading, empty, error, dan success state.
- [ ] Table admin tetap dapat digunakan dengan keyboard.
- [ ] Dialog dan drawer dapat ditutup dengan Escape.
- [ ] Semua kontrol memiliki visible focus state.
- [ ] Warna status memiliki label text.
- [ ] QR pada landing page mengarah ke `/acara/:id/pre-test` atau `/acara/:id/post-test`, bukan ke route kosong.
- [ ] Jawaban submitted tampil read-only tanpa action edit.
- [ ] Sertifikat menampilkan tanggal terbit dan tanggal kedaluwarsa 3 tahun.
- [ ] Print A4 tidak memotong content.
- [ ] Tidak ada navigasi ke route yang belum ada.
- [ ] Tidak ada angka, statistik, testimonial, atau logo fiktif.

## 12. Design Decision Log

| ID | Keputusan | Alasan | Dampak |
|---|---|---|---|
| D-01 | White dan navy | Brief serta konteks internal perusahaan | Sidebar gelap, content putih, hierarchy kuat |
| D-02 | Table-first admin | Admin bekerja dengan daftar dan status | Data density, bukan landing-page cards |
| D-03 | Mobile-first participant | Absensi dan ujian dipakai saat mobile | Single-column flow dan sticky action |
| D-04 | Motion 1 | Mengurangi beban pada tugas berulang | Hanya feedback dan state transition |
| D-05 | QR ke pre-test dan post-test | Mempermudah akses assessment | Butuh access policy dan token opaque |
| D-06 | Jawaban locked setelah submit | Menjaga integritas hasil | Read-only state dan audit boundary |
