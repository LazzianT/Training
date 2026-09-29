# Diagram UML &#8212; Aplikasi Training BMC

Folder ini berisi artefak diagram untuk laporan KKP. Semua diagram dalam format
`.drawio` (mxGraph XML, tidak terkompresi) sehingga dapat dibuka, diedit, dan
diekspor ke PNG/PDF/SVG.

## Cara membuka

**Opsi 1 &#8212; VS Code**
Pasang extension [Draw.io Integration](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio)
(`hediet.vscode-drawio`). File `.drawio` akan langsung ter-render di editor.

**Opsi 2 &#8212; draw.io web**
Buka <https://app.diagrams.net>, pilih `File > Open From > Device`, lalu pilih file
`.drawio` dari folder ini.

**Opsi 3 &#8212; draw.io desktop**
Aplikasi desktop membaca format yang sama.

## Ekspor untuk laporan

Pada draw.io: `File > Export As > PNG`, lalu atur `Zoom` sekitar 200&#8211;300%
agar teks tetap terbaca saat dicetak pada ukuran A4. Untuk sequence diagram yang
memanjang secara vertikal, gunakan `Zoom to Fit` lalu pilih `Custom` dengan lebar
sekitar 2000&#8211;2400 px.

## Daftar file

| File | Halaman | Isi |
|------|---------|-----|
| `use-case-bmc-training.drawio` | 1 halaman | Use Case Diagram lengkap: 6 aktor, 33 use case dalam 8 package, relasi `&lt;&lt;include&gt;&gt;` dan `&lt;&lt;extend&gt;&gt;`, catatan desain, legenda |
| `sequence-bmc-training.drawio` | 5 halaman | Sequence Diagram untuk alur inti aplikasi |

### Halaman pada `sequence-bmc-training.drawio`

| # | Halaman | Use case | Sumber kebenaran di kode |
|---|---------|----------|-------------------------|
| 1 | Login Admin HR | UC-01 | `auth.routes.js:21`, `login.service.js:19-48` |
| 2 | Admin Membuat Acara | UC-04 | `event.routes.js:58-82`, `event.repository.js:134-172` |
| 3 | Admin Tambah Peserta | UC-10, UC-11 | `event.routes.js:96-105`, `event.repository.js:198-217` |
| 4 | Peserta Pre-test via QR | UC-19, UC-20 | `assessment.routes.js:21-54`, `assessment.repository.js:189-242` |
| 5 | Absensi dan Feedback | UC-14, UC-23 | `assessment.routes.js:56-74`, `assessment.repository.js:244-256` |

## Konvensi penamaan

- Use case diberi nomor `UC-01` s.d. `UC-33` agar dapat ditelusuri ke
  `SRS.md` (mis. `QST-011`) dan `PRD.md` (mis. `US-004`).
- **Garis tebal** = use case sudah diimplementasikan pada MVP 2026-09-28.
- **Garis putus-putus** = use case direncanakan pada Sprint 7-8.
- **Kotak swimlane** = package / kelompok use case.
- **Catatan berbentuk kertas** = temuan desain atau Known Issue yang relevan.

## Dokumen pendamping

- `../METODOLOGI-PENGEMBANGAN.md` &#8212; alasan pemilihan Scrum, pemetaan Sprint,
  dan Known Issues Register yang dirujuk pada diagram.
