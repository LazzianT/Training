import type { ReactNode } from 'react';
import { Panel } from '../components/ui/index.js';

/**
 * The guide, in the app rather than in a document.
 *
 * Kept as data so the sections and their steps stay uniform, and so adding a
 * chapter is one entry rather than another block of markup. It duplicates the
 * written manual by design: the person who needs the guide most is the one who
 * does not know a separate document exists yet.
 */
type Step = { text: string; detail?: string };
type Section = { id: string; title: string; intro?: string; steps: Step[]; note?: ReactNode };

const SECTIONS: Section[] = [
  {
    id: 'masuk',
    title: 'Masuk dan peran Anda',
    intro: 'Aplikasi ini dibuka lewat browser, tidak perlu memasang apa pun.',
    steps: [
      { text: 'Isi NIP pada kolom Nomor Induk Karyawan.' },
      { text: 'Isi tanggal lahir dengan 6 digit, format DD MM YY.', detail: 'Contoh: 17 08 90 untuk 17 Agustus 1990.' },
      { text: 'Tekan Masuk ke workspace.' },
      {
        text: 'Perhatikan menu yang muncul.',
        detail: 'Menu yang tidak muncul memang tidak diberikan untuk peran Anda. Peran ditentukan oleh Human Capital, dan pembatasannya ada di server, bukan hanya disembunyikan.',
      },
    ],
    note: 'Peran Anda tertera di bagian bawah sidebar. Hubungi Human Capital bila terasa kurang.',
  },
  {
    id: 'tur',
    title: 'Tur panduan di dalam aplikasi',
    intro: 'Aplikasi bisa menjelaskan dirinya sendiri, tanpa perlu membaca halaman ini dulu.',
    steps: [
      { text: 'Saat pertama masuk, tur awal berjalan sendiri dan mengenalkan menu, peran, dan ringkasan.' },
      { text: 'Untuk halaman lain, tekan tombol Tur di kanan atas.', detail: 'Tombol ini hanya muncul di halaman yang memang punya tur.' },
      { text: 'Gunakan Lanjut dan Kembali, atau tombol panah kiri dan kanan.' },
      { text: 'Tekan Esc atau Lewati untuk berhenti kapan saja.' },
    ],
  },
  {
    id: 'training',
    title: 'Membuat dan menjalankan training',
    intro: 'Untuk admin Human Capital dan pengisi acara. Ini alurnya dari awal sampai hasil.',
    steps: [
      { text: 'Buka Event lalu Buat Acara.', detail: 'Isi judul, tanggal, jam, ruang, sasaran, dan pengisi acara. Pengisi internal dicari dari data HR; pengisi eksternal diisi manual.' },
      { text: 'Simpan Acara.', detail: 'Acara baru berstatus Draf.' },
      { text: 'Buka acaranya dari Daftar Acara, lalu tambahkan peserta.', detail: 'Ada daftar kandidat rekomendasi — karyawan yang belum pernah mengikuti training dengan judul mirip — dan kolom pencarian NIP atau nama.' },
      { text: 'Cetak undangan bila diperlukan.', detail: 'Dari Daftar Acara tekan Cetak undangan, lalu tekan Cetak Undangan. Memakai fitur cetak browser, jadi atur kertas ke A4 dan matikan header/footer browser.' },
      { text: 'Pengisi acara menyiapkan soal di menu Acara Saya.', detail: 'Tekan Buat Soal, pilih jenis soal, isi pertanyaan dan kunci jawaban untuk pilihan ganda, lalu Simpan Soal Ini. Gambar soal bisa ditempel dengan Ctrl+V.' },
      { text: 'Tekan Publikasikan Test.', detail: 'Setelah terbit, jumlah soal terkunci — peserta yang sudah menjawab tidak boleh dinilai dengan soal yang berbeda.' },
      { text: 'Buat QR assessment.', detail: 'Tersedia QR Pre-test, Post-test, Feedback, dan Absensi. QR hanya muncul setelah soal dipublikasikan.' },
      { text: 'Peserta mengerjakan lewat QR, lalu lihat hasilnya.', detail: 'Di Acara Saya tekan Lihat Hasil untuk melihat nilai dan daftar kehadiran.' },
    ],
    note: 'QR memakai tautan lengkap yang bisa langsung dibuka dari ponsel. Salin lewat tombol Salin tautan.',
  },
  {
    id: 'ojt',
    title: 'Menjalankan OJT',
    intro: 'OJT untuk karyawan baru yang belum terdaftar di HRIS dan belum punya NIP. Karena itu peserta tidak punya akun dan memakai kode dari sistem.',
    steps: [
      { text: 'Buat batch di menu OJT.', detail: 'Batch baru selalu berstatus Draf. Selama draf, QR belum bisa dibuat dan peserta belum bisa mengerjakan apa pun.' },
      { text: 'Tambahkan peserta. Cukup isi nama.', detail: 'Sistem membuat kode otomatis seperti OJT-00001. Catat kodenya dan berikan ke peserta.' },
      { text: 'Siapkan katalog materi di Master Materi.', detail: 'Katalog ini dipakai bersama semua batch, jadi satu materi cukup ditulis sekali. Materi dinonaktifkan, tidak dihapus, supaya riwayat peserta tetap utuh.' },
      { text: 'Susun jadwal di kalender.', detail: 'Klik tanggal, isi nama materi dan pengisinya, lalu Simpan Materi. Satu materi hanya boleh dijadwalkan satu kali dalam satu batch.' },
      { text: 'Tulis bank soal tiap materi.', detail: 'Dari Master Materi tekan Soal, atau dari modal Assessment. Bank soal milik materi dan dipakai semua batch yang mengajarnya. Tekan Publikasikan bila sudah siap.' },
      { text: 'Terbitkan batch.', detail: 'Setelah terbit, QR boleh dibuat dan peserta boleh mengerjakan.' },
      { text: 'Buat QR per materi.', detail: 'Di tabel Materi Batch Ini, tekan Assessment pada baris materi. Titik hijau berarti soal sudah siap; kuning berarti belum.' },
      { text: 'Pantau hasilnya.', detail: 'Panel Nilai Pre-test dan Post-test menampilkan semua peserta, termasuk yang belum mengerjakan. Panel Kehadiran per Materi bisa diklik untuk melihat siapa yang belum hadir.' },
      { text: 'Tutup batch bila pengumpulan selesai.', detail: 'Menutup batch menghentikan pengiriman jawaban, termasuk dari QR yang sudah beredar. Batch bisa dibuka lagi bila salah tutup.' },
    ],
    note: 'Satu materi = satu set QR. Karena itu satu materi tidak boleh muncul di dua tanggal — kalau muncul, QR-nya jadi ambigu.',
  },
  {
    id: 'peserta',
    title: 'Mengisi sebagai peserta',
    intro: 'Peserta tidak perlu punya akun. Semuanya dari QR yang dipindai.',
    steps: [
      { text: 'Pindai QR yang diberikan.', detail: 'Halaman akan menampilkan nama materi yang sedang dinilai beserta tanggalnya.' },
      { text: 'Ketik nama Anda, lalu pilih dari daftar peserta batch.', detail: 'Tidak perlu menghafal kode. Bila ada dua peserta bernama sama, baris nama itu menampilkan kode sebagai pembeda.' },
      { text: 'Tekan Lanjutkan.' },
      { text: 'Kerjakan sesuai jenisnya.', detail: 'Pre-test dan Post-test memilih jawaban; Feedback memberi nilai tiap aspek; Absensi menandatangani di layar dengan jari.' },
      { text: 'Tekan Kirim.', detail: 'Jawaban yang sudah dikirim tidak dapat diubah lagi.' },
    ],
  },
  {
    id: 'sertifikat',
    title: 'Sertifikat Saya',
    intro: 'Riwayat training yang Anda ikuti, dan sertifikat yang bisa dicetak.',
    steps: [
      { text: 'Buka menu Sertifikat Saya.' },
      { text: 'Daftar menampilkan seluruh training yang Anda ikuti, urut dari yang terbaru.' },
      {
        text: 'Training yang kehadirannya sudah dicatat bisa dicetak.',
        detail: 'Kehadiran dicatat oleh Human Capital pada hari pelaksanaan. Training yang kehadirannya belum dicatat tetap tampil, tetapi belum bisa dicetak.',
      },
      { text: 'Tekan Cetak sertifikat, lalu Cetak Sertifikat.', detail: 'Sertifikat memuat kode verifikasi unik. Cetak memakai fitur cetak browser, jadi atur kertas ke A4.' },
    ],
    note: 'Sertifikat dibuat saat Anda pertama kali membukanya. Membukanya lagi tidak membuat sertifikat baru.',
  },
  {
    id: 'monitoring',
    title: 'Monitoring karyawan',
    intro: 'Khusus admin Human Capital. Menjawab pertanyaan "siapa sudah ikut training apa".',
    steps: [
      { text: 'Buka menu Monitoring Karyawan.' },
      { text: 'Cari karyawan berdasarkan NIK, nama, atau departemen.' },
      { text: 'Tekan Lihat riwayat untuk melihat daftar training karyawan tersebut.', detail: 'Tiap baris menandai Hadir atau Belum hadir.' },
    ],
    note: 'Halaman ini menggantikan rekap manual di spreadsheet: jumlah training per karyawan selama enam bulan terakhir dihitung langsung dari data.',
  },
  {
    id: 'aturan',
    title: 'Aturan yang sering bikin bingung',
    steps: [
      { text: 'Batch OJT harus Terbit sebelum QR bisa dibuat.', detail: 'Kode untuk batch yang belum dibuka tidak bisa diselesaikan siapa pun.' },
      { text: 'Tombol QR Pre-test dan Post-test mati bila soal belum dipublikasikan.', detail: 'Kode tanpa soal terlihat berfungsi, tapi isinya kosong.' },
      { text: 'Jumlah soal terkunci setelah dipublikasikan.' },
      { text: 'QR baru mencabut QR lama untuk materi dan tujuan yang sama.', detail: 'Jadi hanya satu kode yang berlaku pada satu waktu. Kode lama yang sudah dicetak berhenti bekerja.' },
      { text: 'Satu materi hanya sekali dalam satu batch.' },
      { text: 'Batch yang ditutup menghentikan pengiriman jawaban, bukan hanya QR baru.' },
      { text: 'Materi dinonaktifkan, tidak dihapus.' },
      { text: 'Jawaban tidak bisa diubah setelah dikirim.' },
    ],
  },
  {
    id: 'masalah',
    title: 'Kalau ada masalah',
    steps: [
      { text: 'Tombol QR tidak bisa ditekan.', detail: 'Lihat labelnya: "belum dibuka" berarti batch belum terbit, "belum siap" berarti soal belum dipublikasikan.' },
      { text: 'Peserta bilang QR-nya tidak berlaku.', detail: 'QR lama sudah dicabut oleh QR yang lebih baru, atau sudah kedaluwarsa.' },
      { text: 'Peserta tidak menemukan namanya.', detail: 'Belum ditambahkan sebagai peserta batch, atau namanya dinonaktifkan.' },
      { text: 'Peserta tidak bisa mengirim.', detail: 'Batch sudah ditutup, atau sudah pernah mengirim untuk tahap itu.' },
      { text: 'Sertifikat tidak bisa dicetak.', detail: 'Kehadiran belum dicatat Human Capital. Hubungi Human Capital untuk melengkapinya.' },
      { text: 'Muncul "Sesi Anda berakhir".', detail: 'Sesi login habis. Masuk kembali.' },
      { text: 'Muncul "Tidak dapat menghubungi server".', detail: 'Jaringan atau server sedang mati.' },
    ],
    note: 'Bila masalahnya bukan salah satu di atas, hubungi Human Capital.',
  },
];

export const HowToUse = () => (
  <div data-surface="saas">
    <header className="enter-section">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-900 sm:text-3xl">Cara Pakai</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
        Panduan memakai aplikasi ini, dari masuk sampai mencetak sertifikat. Untuk versi yang
        menyorot langsung di layar, tekan tombol <strong>Tur</strong> di kanan atas halaman mana pun.
      </p>
    </header>

    {/* Jump links, because the page is long and nobody reads it top to bottom. */}
    <nav aria-label="Daftar isi" className="enter-section mt-5">
      <ul className="flex flex-wrap gap-2">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="inline-flex border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none transition duration-150 hover:border-slate-900 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>

    <div className="mt-6 grid gap-6">
      {SECTIONS.map((section, index) => (
        <div key={section.id} id={section.id} className="scroll-mt-6">
          <Panel title={section.title} description={section.intro}>
            <ol className="grid gap-4 px-4 py-4 sm:px-5">
              {section.steps.map((step, stepIndex) => (
                <li key={step.text} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-slate-300 text-[11px] font-semibold text-slate-600 tabular-nums"
                  >
                    {stepIndex + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-900">{step.text}</span>
                    {step.detail && (
                      <span className="mt-1 block text-xs leading-relaxed text-slate-500">{step.detail}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>

            {section.note && (
              <p className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600 sm:px-5">
                {section.note}
              </p>
            )}
          </Panel>

          {index === SECTIONS.length - 1 && (
            <p className="mt-4 text-xs text-slate-500">
              Panduan ini juga tersedia sebagai dokumen terpisah untuk dicetak atau dibagikan.
            </p>
          )}
        </div>
      ))}
    </div>
  </div>
);
