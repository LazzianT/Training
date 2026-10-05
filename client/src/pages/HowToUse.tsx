import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Panel } from '../components/ui/index.js';
import {
  MockButton,
  MockChip,
  MockFrame,
  MockInput,
  MockLine,
  MockPanel,
  MockQrButtons,
  MockRow,
  MockSidebar,
} from '../components/Mockup.js';

/**
 * The guide, in the app rather than in a document.
 *
 * Held as data so a chapter is one entry rather than another block of markup, and
 * so search can look inside the steps instead of only at the headings.
 *
 * It duplicates the written manual by design: the person who needs the guide most
 * is the one who does not know a separate document exists yet.
 */
type Step = { text: string; detail?: string; mock?: ReactNode };
type Section = { id: string; title: string; short: string; intro?: string; steps: Step[]; note?: ReactNode };

const READ_KEY = 'training.howto.read';

const SECTIONS: Section[] = [
  {
    id: 'masuk',
    title: 'Masuk dan peran Anda',
    short: 'Masuk',
    intro: 'Aplikasi ini dibuka lewat browser, tidak perlu memasang apa pun.',
    steps: [
      {
        text: 'Isi NIP pada kolom Nomor Induk Karyawan.',
        mock: (
          <MockFrame label="Halaman masuk">
            <div className="grid max-w-64 gap-2">
              <MockInput placeholder="Nomor Induk Karyawan" />
              <MockInput placeholder="Tanggal lahir · DD MM YY" />
              <MockButton tone="dark">Masuk ke workspace</MockButton>
            </div>
          </MockFrame>
        ),
      },
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
    short: 'Tur',
    intro: 'Aplikasi bisa menjelaskan dirinya sendiri, tanpa perlu membaca halaman ini dulu.',
    steps: [
      { text: 'Saat pertama masuk, tur awal berjalan sendiri dan mengenalkan menu, peran, dan ringkasan.' },
      {
        text: 'Untuk halaman lain, tekan tombol Tur di kanan atas.',
        detail: 'Tombol ini hanya muncul di halaman yang memang punya tur.',
        mock: (
          <MockFrame label="Tombol Tur">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-900">Daftar Acara</span>
              <MockButton>? Tur</MockButton>
            </div>
          </MockFrame>
        ),
      },
      { text: 'Gunakan Lanjut dan Kembali, atau tombol panah kiri dan kanan.' },
      { text: 'Tekan Esc atau Lewati untuk berhenti kapan saja.' },
    ],
  },
  {
    id: 'training',
    title: 'Membuat dan menjalankan training',
    short: 'Training',
    intro: 'Untuk admin Human Capital dan pengisi acara. Ini alurnya dari awal sampai hasil.',
    steps: [
      {
        text: 'Buka Event lalu Buat Acara.',
        detail: 'Isi judul, tanggal, jam, ruang, sasaran, dan pengisi acara. Pengisi internal dicari dari data HR; pengisi eksternal diisi manual.',
        mock: (
          <MockFrame label="Buat Acara">
            <div className="flex gap-3">
              <div className="hidden w-24 shrink-0 sm:block">
                <MockSidebar active="Daftar Acara" />
              </div>
              <div className="grid min-w-0 flex-1 gap-2">
                <MockInput placeholder="Judul acara" />
                <div className="grid grid-cols-3 gap-2">
                  <MockInput placeholder="Tanggal" />
                  <MockInput placeholder="Mulai" />
                  <MockInput placeholder="Selesai" />
                </div>
                <MockInput placeholder="Cari karyawan sebagai pengisi internal" />
                <div className="flex gap-2">
                  <MockButton tone="dark">Simpan Acara</MockButton>
                  <MockButton>Batal</MockButton>
                </div>
              </div>
            </div>
          </MockFrame>
        ),
      },
      { text: 'Simpan Acara.', detail: 'Acara baru berstatus Draf.' },
      { text: 'Buka acaranya dari Daftar Acara, lalu tambahkan peserta.', detail: 'Ada daftar kandidat rekomendasi — karyawan yang belum pernah mengikuti training dengan judul mirip — dan kolom pencarian NIP atau nama.' },
      { text: 'Cetak undangan bila diperlukan.', detail: 'Dari Daftar Acara tekan Cetak undangan, lalu tekan Cetak Undangan. Memakai fitur cetak browser, jadi atur kertas ke A4 dan matikan header/footer browser.' },
      { text: 'Pengisi acara menyiapkan soal di menu Acara Saya.', detail: 'Tekan Buat Soal, pilih jenis soal, isi pertanyaan dan kunci jawaban untuk pilihan ganda, lalu Simpan Soal Ini. Gambar soal bisa ditempel dengan Ctrl+V.' },
      { text: 'Tekan Publikasikan Test.', detail: 'Setelah terbit, jumlah soal terkunci — peserta yang sudah menjawab tidak boleh dinilai dengan soal yang berbeda.' },
      {
        text: 'Buat QR assessment.',
        detail: 'Tersedia QR Pre-test, Post-test, Feedback, dan Absensi. QR hanya muncul setelah soal dipublikasikan.',
        mock: (
          <MockFrame label="QR assessment di Acara Saya">
            <MockQrButtons />
            <p className="mt-2 text-[10px] text-slate-400">
              QR assessment terbuka setelah soal dipublish.
            </p>
          </MockFrame>
        ),
      },
      { text: 'Peserta mengerjakan lewat QR, lalu lihat hasilnya.', detail: 'Di Acara Saya tekan Lihat Hasil untuk melihat nilai dan daftar kehadiran.' },
    ],
    note: 'QR memakai tautan lengkap yang bisa langsung dibuka dari ponsel. Salin lewat tombol Salin tautan.',
  },
  {
    id: 'ojt',
    title: 'Menjalankan OJT',
    short: 'OJT',
    intro: 'OJT untuk karyawan baru yang belum terdaftar di HRIS dan belum punya NIP. Karena itu peserta tidak punya akun dan memakai kode dari sistem.',
    steps: [
      {
        text: 'Buat batch di menu OJT.',
        detail: 'Batch baru selalu berstatus Draf. Selama draf, QR belum bisa dibuat dan peserta belum bisa mengerjakan apa pun.',
        mock: (
          <MockFrame label="Daftar Batch OJT">
            <div className="flex gap-3">
              <div className="hidden w-24 shrink-0 sm:block">
                <MockSidebar active="OJT" />
              </div>
              <div className="grid min-w-0 flex-1 gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">OJT</span>
                  <MockButton tone="dark">Buat Batch</MockButton>
                </div>
                <div className="border border-slate-200 bg-white p-2">
                  <div className="flex items-center justify-between">
                    <MockChip tone="amber">Draf</MockChip>
                    <span className="text-[9px] text-slate-500 tabular-nums">OJT-2026-01</span>
                  </div>
                  <MockLine width="w-32" dark />
                  <span className="mt-2 block text-[9px] text-slate-500">
                    28 Sep 2026 – 2 Okt 2026 · 4 peserta
                  </span>
                </div>
              </div>
            </div>
          </MockFrame>
        ),
      },
      { text: 'Tambahkan peserta. Cukup isi nama.', detail: 'Sistem membuat kode otomatis seperti OJT-00001. Catat kodenya dan berikan ke peserta.' },
      { text: 'Siapkan katalog materi di Master Materi.', detail: 'Katalog ini dipakai bersama semua batch, jadi satu materi cukup ditulis sekali. Materi dinonaktifkan, tidak dihapus, supaya riwayat peserta tetap utuh.' },
      {
        text: 'Susun jadwal di kalender.',
        detail: 'Klik tanggal, isi nama materi dan pengisinya, lalu Simpan Materi. Satu materi hanya boleh dijadwalkan satu kali dalam satu batch.',
        mock: (
          <MockFrame label="Jadwal Materi">
            <div className="grid grid-cols-7 border-t border-l border-slate-200">
              {Array.from({ length: 21 }, (_, index) => {
                const inBatch = index >= 8 && index <= 18;
                const scheduled = index === 10 || index === 13;
                return (
                  <div
                    key={index}
                    className={`min-h-9 border-r border-b border-slate-200 p-1 ${
                      inBatch ? 'bg-white' : 'bg-slate-50'
                    }`}
                  >
                    <span className={`block text-[8px] tabular-nums ${inBatch ? 'text-slate-500' : 'text-slate-300'}`}>
                      {index + 1}
                    </span>
                    {scheduled && (
                      <span className="mt-0.5 block truncate bg-slate-900 px-0.5 text-[7px] text-white">
                        {index === 10 ? 'Safety' : 'QC Tools'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              Tanggal di luar rentang batch tidak bisa diklik.
            </p>
          </MockFrame>
        ),
      },
      { text: 'Tulis bank soal tiap materi.', detail: 'Dari Master Materi tekan Soal, atau dari modal Assessment. Bank soal milik materi dan dipakai semua batch yang mengajarnya. Tekan Publikasikan bila sudah siap.' },
      { text: 'Terbitkan batch.', detail: 'Setelah terbit, QR boleh dibuat dan peserta boleh mengerjakan.' },
      {
        text: 'Buat QR per materi.',
        detail: 'Di tabel Materi Batch Ini, tekan Assessment pada baris materi. Titik hijau berarti soal sudah siap; kuning berarti belum.',
        mock: (
          /* Frame label differs from the panel inside it; repeating "Materi Batch
             Ini" twice in one picture read as a rendering fault. */
          <MockFrame label="Detail Batch">
            <MockPanel title="Materi Batch Ini">
              <MockRow>
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium text-slate-900">Safety Induction</span>
                  <span className="block text-[9px] text-slate-500">28 Sep 2026 · SULAEMAN</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 bg-emerald-600" aria-hidden="true" />
                  <MockButton>Assessment</MockButton>
                </span>
              </MockRow>
              <MockRow last>
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium text-slate-900">7 QC Tools</span>
                  <span className="block text-[9px] text-slate-500">29 Sep 2026 · Belum ditentukan</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 bg-amber-500" aria-hidden="true" />
                  <MockButton>Assessment</MockButton>
                </span>
              </MockRow>
            </MockPanel>
          </MockFrame>
        ),
      },
      { text: 'Pantau hasilnya.', detail: 'Panel Nilai Pre-test dan Post-test menampilkan semua peserta, termasuk yang belum mengerjakan. Panel Kehadiran per Materi bisa diklik untuk melihat siapa yang belum hadir.' },
      { text: 'Tutup batch bila pengumpulan selesai.', detail: 'Menutup batch menghentikan pengiriman jawaban, termasuk dari QR yang sudah beredar. Batch bisa dibuka lagi bila salah tutup.' },
    ],
    note: 'Satu materi = satu set QR. Karena itu satu materi tidak boleh muncul di dua tanggal — kalau muncul, QR-nya jadi ambigu.',
  },
  {
    id: 'peserta',
    title: 'Mengisi sebagai peserta',
    short: 'Peserta',
    intro: 'Peserta tidak perlu punya akun. Semuanya dari QR yang dipindai.',
    steps: [
      { text: 'Pindai QR yang diberikan.', detail: 'Halaman akan menampilkan nama materi yang sedang dinilai beserta tanggalnya.' },
      {
        text: 'Ketik nama Anda, lalu pilih dari daftar peserta batch.',
        detail: 'Tidak perlu menghafal kode. Bila ada dua peserta bernama sama, baris nama itu menampilkan kode sebagai pembeda.',
        mock: (
          <MockFrame label="Halaman peserta OJT">
            <div className="grid max-w-72 gap-2">
              <span className="text-[9px] font-semibold tracking-[0.1em] text-slate-500 uppercase">Nama Anda</span>
              <MockInput placeholder="Ketik nama Anda" />
              <div className="border border-slate-200 bg-white">
                <MockRow>
                  <span className="text-[11px] text-slate-900">Joko Susilo</span>
                </MockRow>
                <MockRow last>
                  <span className="text-[11px] text-slate-900">Siti Aminah</span>
                  <span className="text-[9px] text-slate-500 tabular-nums">OJT-00004</span>
                </MockRow>
              </div>
              <MockButton tone="dark">Lanjutkan</MockButton>
            </div>
          </MockFrame>
        ),
      },
      { text: 'Tekan Lanjutkan.' },
      { text: 'Kerjakan sesuai jenisnya.', detail: 'Pre-test dan Post-test memilih jawaban; Feedback memberi nilai tiap aspek; Absensi menandatangani di layar dengan jari.' },
      { text: 'Tekan Kirim.', detail: 'Jawaban yang sudah dikirim tidak dapat diubah lagi.' },
    ],
  },
  {
    id: 'sertifikat',
    title: 'Sertifikat Saya',
    short: 'Sertifikat',
    intro: 'Riwayat training yang Anda ikuti, dan sertifikat yang bisa dicetak.',
    steps: [
      { text: 'Buka menu Sertifikat Saya.' },
      { text: 'Daftar menampilkan seluruh training yang Anda ikuti, urut dari yang terbaru.' },
      {
        text: 'Training yang kehadirannya sudah dicatat bisa dicetak.',
        detail: 'Kehadiran dicatat oleh Human Capital pada hari pelaksanaan. Training yang kehadirannya belum dicatat tetap tampil, tetapi belum bisa dicetak.',
        mock: (
          <MockFrame label="Sertifikat Saya">
            <MockPanel title="Training Saya">
              <MockRow>
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium text-slate-900">7 QC Tools</span>
                  <span className="block text-[9px] text-slate-500">2 Okt 2026 · Ruang Training</span>
                  <span className="mt-0.5 block text-[9px] font-semibold text-emerald-700">Hadir</span>
                </span>
                <MockButton tone="dark">Cetak sertifikat</MockButton>
              </MockRow>
              <MockRow last>
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium text-slate-900">Safety Induction</span>
                  <span className="block text-[9px] text-slate-500">28 Sep 2026 · Kantin Lt. 3</span>
                  <span className="mt-0.5 block text-[9px] font-semibold text-amber-700">
                    Kehadiran belum dicatat
                  </span>
                </span>
                <span className="text-[9px] text-slate-400">Belum bisa dicetak</span>
              </MockRow>
            </MockPanel>
          </MockFrame>
        ),
      },
      { text: 'Tekan Cetak sertifikat, lalu Cetak Sertifikat.', detail: 'Sertifikat memuat kode verifikasi unik. Cetak memakai fitur cetak browser, jadi atur kertas ke A4.' },
    ],
    note: 'Sertifikat dibuat saat Anda pertama kali membukanya. Membukanya lagi tidak membuat sertifikat baru.',
  },
  {
    id: 'monitoring',
    title: 'Monitoring karyawan',
    short: 'Monitoring',
    intro: 'Khusus admin Human Capital. Menjawab pertanyaan "siapa sudah ikut training apa".',
    steps: [
      { text: 'Buka menu Monitoring Karyawan.' },
      { text: 'Cari karyawan berdasarkan NIK, nama, atau departemen.' },
      {
        text: 'Tekan Lihat riwayat untuk melihat daftar training karyawan tersebut.',
        detail: 'Tiap baris menandai Hadir atau Belum hadir.',
        mock: (
          <MockFrame label="Monitoring Karyawan">
            <MockPanel title="Riwayat training">
              <MockRow>
                <span className="text-[11px] text-slate-900">7 QC Tools</span>
                <MockChip tone="green">Hadir</MockChip>
              </MockRow>
              <MockRow last>
                <span className="text-[11px] text-slate-900">Safety Induction</span>
                <MockChip>Belum hadir</MockChip>
              </MockRow>
            </MockPanel>
          </MockFrame>
        ),
      },
    ],
    note: 'Halaman ini menggantikan rekap manual di spreadsheet: jumlah training per karyawan selama enam bulan terakhir dihitung langsung dari data.',
  },
  {
    id: 'aturan',
    title: 'Aturan yang sering bikin bingung',
    short: 'Aturan',
    intro: 'Delapan hal yang paling sering ditanyakan. Membacanya sekali menghemat banyak pertanyaan.',
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
    short: 'Masalah',
    intro: 'Gejala yang paling sering muncul dan artinya.',
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

const readStored = (): string[] => {
  try {
    const value = JSON.parse(localStorage.getItem(READ_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    // Private mode, or storage disabled. Progress simply does not persist.
    return [];
  }
};

const writeStored = (ids: string[]) => {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(ids));
  } catch {
    /* not fatal */
  }
};

const matches = (section: Section, needle: string) =>
  section.title.toLowerCase().includes(needle) ||
  section.steps.some(
    (step) =>
      step.text.toLowerCase().includes(needle) || (step.detail ?? '').toLowerCase().includes(needle),
  );

/**
 * The guide, as something to be used rather than scrolled.
 *
 * Three affordances do the work. A two-pane layout means the chapter list stays in
 * view instead of scrolling away. Search looks inside the steps, because the
 * question people arrive with is about one action, not about a chapter title.
 * Read state is kept per chapter and shown as a bar, so a long page has an end
 * that is visible from the start.
 */
export const HowToUse = () => {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const [query, setQuery] = useState('');
  const [read, setRead] = useState<string[]>(readStored);
  const navRef = useRef<HTMLOListElement>(null);

  const needle = query.trim().toLowerCase();
  const results = useMemo(
    () => (needle === '' ? [] : SECTIONS.filter((section) => matches(section, needle))),
    [needle],
  );

  const active = SECTIONS.find((section) => section.id === activeId) ?? SECTIONS[0];
  const progress = Math.round((read.length / SECTIONS.length) * 100);
  const done = read.length === SECTIONS.length;

  const open = useCallback((id: string) => {
    setActiveId(id);
    setQuery('');
    setRead((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      writeStored(next);
      return next;
    });
    // Bring the chapter into view on a phone, where the panes stack.
    requestAnimationFrame(() => {
      document.getElementById(`howto-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }, []);

  /* Arrow keys move between chapters while focus is anywhere in the list, the way a real menu behaves. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Focus usually sits on a chapter button rather than the list itself, so
      // testing the list alone would leave the keys dead in the common case.
      if (!navRef.current?.contains(event.target as Node)) return;
      const index = SECTIONS.findIndex((section) => section.id === activeId);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        open(SECTIONS[Math.min(index + 1, SECTIONS.length - 1)].id);
        navRef.current?.focus();
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        open(SECTIONS[Math.max(index - 1, 0)].id);
        navRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeId, open]);

  return (
    <div data-surface="saas">
      <header className="enter-section">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-900 sm:text-3xl">Cara Pakai</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
          Panduan memakai aplikasi ini, dari masuk sampai mencetak sertifikat. Untuk versi yang menyorot
          langsung di layar, tekan tombol <strong>Tur</strong> di kanan atas halaman mana pun.
        </p>
      </header>

      <section
        className="enter-section mt-5 surface-card p-3.5 sm:p-4"
        style={{ '--enter-delay': '40ms' } as CSSProperties}
      >
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="howto-search" className="sr-only">
            Cari langkah
          </label>
          <input
            id="howto-search"
            type="search"
            value={query}
            onChange={(change) => setQuery(change.target.value)}
            placeholder="Cari langkah, misalnya: QR, sertifikat, batch"
            className="h-11 min-w-56 flex-1 border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition duration-150 placeholder:text-slate-500 hover:border-slate-400 focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          />
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-28 overflow-hidden bg-slate-200" role="presentation">
              <div
                className="h-full bg-slate-900 transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-600 tabular-nums">
              {read.length}/{SECTIONS.length} bagian
            </span>
          </div>
        </div>
        {done && (
          <p className="mt-3 border-l-2 border-emerald-500 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            Semua bagian sudah dibaca. Panduan ini juga tersedia sebagai dokumen terpisah untuk dicetak
            atau dibagikan.
          </p>
        )}
      </section>

      {needle !== '' ? (
        <section className="enter-section mt-5" style={{ '--enter-delay': '80ms' } as CSSProperties}>
          <Panel
            title="Hasil pencarian"
            description={
              results.length === 0
                ? `Tidak ada langkah yang cocok dengan "${query.trim()}".`
                : `${results.length} bagian mengandung "${query.trim()}".`
            }
          >
            {results.length === 0 ? (
              <p className="px-4 py-5 text-sm text-slate-500 sm:px-5">
                Coba kata lain, misalnya <strong>QR</strong>, <strong>sertifikat</strong>, atau{' '}
                <strong>batch</strong>.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {results.map((section) => (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => open(section.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none transition duration-150 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset sm:px-5"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900">{section.title}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {section.steps.length} langkah
                        </span>
                      </span>
                      <span aria-hidden="true" className="shrink-0 text-slate-400">
                        &rsaquo;
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      ) : (
        <div className="mt-5 gap-6 lg:grid lg:grid-cols-[17rem_1fr]">
          <nav aria-label="Bagian panduan" className="enter-section" style={{ '--enter-delay': '80ms' } as CSSProperties}>
            {/*
              Horizontal and scrollable on a phone, a sticky column on a desktop.
              One list, so the chapter you are reading is always the highlighted one
              in it rather than a second copy somewhere else.
            */}
            <ol
              ref={navRef}
              tabIndex={0}
              className="flex gap-1.5 overflow-x-auto pb-1 outline-none lg:sticky lg:top-6 lg:grid lg:gap-1 lg:overflow-visible lg:pb-0"
            >
              {SECTIONS.map((section, index) => {
                const isActive = section.id === active.id;
                const isRead = read.includes(section.id);
                return (
                  <li key={section.id} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      aria-current={isActive ? 'true' : undefined}
                      onClick={() => open(section.id)}
                      className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-2.5 text-left text-sm outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
                        isActive
                          ? 'border-accent bg-accent-soft font-semibold text-slate-900'
                          : 'border-transparent text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-5 w-5 shrink-0 items-center justify-center border text-[10px] font-semibold tabular-nums ${
                          isRead
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-300 text-slate-500'
                        }`}
                      >
                        {isRead ? '✓' : index + 1}
                      </span>
                      <span className="truncate whitespace-nowrap">
                        <span className="lg:hidden">{section.short}</span>
                        <span className="hidden lg:inline">{section.title}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 hidden text-xs text-slate-500 lg:block">
              Klik satu bagian untuk membukanya. Tombol panah atas dan bawah juga bisa dipakai.
            </p>
          </nav>

          {/* Keyed on the chapter so the entrance animation replays on every change. */}
          <div key={active.id} id={`howto-${active.id}`} className="enter-section mt-6 scroll-mt-6 lg:mt-0">
            <Panel title={active.title} description={active.intro}>
              <ol className="px-4 py-4 sm:px-5">
                {active.steps.map((step, index) => {
                  const last = index === active.steps.length - 1;
                  return (
                    <li key={step.text} className="flex gap-3.5">
                      {/*
                        A connector instead of a plain list: the steps are a sequence
                        and the line is what says so, where a number alone leaves the
                        order to the reader.
                      */}
                      <span className="flex shrink-0 flex-col items-center" aria-hidden="true">
                        <span className="flex h-7 w-7 items-center justify-center border border-slate-900 bg-white text-[11px] font-semibold text-slate-900 tabular-nums">
                          {index + 1}
                        </span>
                        {!last && <span className="w-px flex-1 bg-slate-200" />}
                      </span>
                      <span className={`min-w-0 ${last ? '' : 'pb-5'}`}>
                        <span className="block text-sm text-slate-900">{step.text}</span>
                        {step.detail && (
                          <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                            {step.detail}
                          </span>
                        )}
                        {step.mock}
                      </span>
                    </li>
                  );
                })}
              </ol>

              {active.note && (
                <p className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600 sm:px-5">
                  {active.note}
                </p>
              )}
            </Panel>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={active.id === SECTIONS[0].id}
                onClick={() => open(SECTIONS[Math.max(SECTIONS.findIndex((s) => s.id === active.id) - 1, 0)].id)}
                className="h-9 border border-slate-300 px-3 text-xs font-semibold text-slate-700 outline-none transition duration-150 hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:border-slate-200 disabled:hover:text-slate-300 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
              >
                &lsaquo; Sebelumnya
              </button>
              <button
                type="button"
                disabled={active.id === SECTIONS[SECTIONS.length - 1].id}
                onClick={() => {
                  const next = SECTIONS[SECTIONS.findIndex((s) => s.id === active.id) + 1];
                  if (next) open(next.id);
                }}
                className="h-9 border border-accent bg-accent px-3 text-xs font-semibold text-slate-900 outline-none transition duration-150 hover:bg-accent-strong disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
              >
                Berikutnya &rsaquo;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
