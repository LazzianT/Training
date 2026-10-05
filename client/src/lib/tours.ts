export type TourPlacement = 'top' | 'bottom' | 'left' | 'right';

export type TourStep = {
  /** Matches a `data-tour` attribute in the DOM. */
  target: string;
  title: string;
  body: string;
  placement?: TourPlacement;
};

export type TourDefinition = {
  id: string;
  title: string;
  /** Shown in the help menu, so it should read as a page name. */
  label: string;
  /** Start on first visit without being asked. Only one tour should set this. */
  autoStart?: boolean;
  steps: TourStep[];
};

const GAP = 12;
const MARGIN = 12;

export type Rect = { top: number; left: number; width: number; height: number };
export type Size = { width: number; height: number };

/**
 * Where to put the tooltip relative to the thing it describes.
 *
 * Clamped rather than centred, because an unclamped card near an edge is partly
 * off screen and the reader loses the button they were about to press. Clamping
 * is also why this is a function with tests: it is the part that quietly breaks
 * on a narrow window, and it is invisible until someone on a laptop hits it.
 *
 * When the preferred side has no room the opposite one is used, so a target at
 * the bottom of the screen puts its card above instead of pushing it off.
 */
export const positionTooltip = (
  target: Rect,
  tooltip: Size,
  placement: TourPlacement,
  viewport: Size,
): { top: number; left: number; placement: TourPlacement } => {
  const fits = {
    top: target.top - GAP - tooltip.height >= MARGIN,
    bottom: target.top + target.height + GAP + tooltip.height <= viewport.height - MARGIN,
    left: target.left - GAP - tooltip.width >= MARGIN,
    right: target.left + target.width + GAP + tooltip.width <= viewport.width - MARGIN,
  };

  const opposite: Record<TourPlacement, TourPlacement> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  };
  const chosen = fits[placement] || !fits[opposite[placement]] ? placement : opposite[placement];

  let top: number;
  let left: number;
  switch (chosen) {
    case 'top':
      top = target.top - GAP - tooltip.height;
      left = target.left + target.width / 2 - tooltip.width / 2;
      break;
    case 'bottom':
      top = target.top + target.height + GAP;
      left = target.left + target.width / 2 - tooltip.width / 2;
      break;
    case 'left':
      top = target.top + target.height / 2 - tooltip.height / 2;
      left = target.left - GAP - tooltip.width;
      break;
    default:
      top = target.top + target.height / 2 - tooltip.height / 2;
      left = target.left + target.width + GAP;
  }

  return {
    top: Math.min(Math.max(top, MARGIN), Math.max(viewport.height - tooltip.height - MARGIN, MARGIN)),
    left: Math.min(Math.max(left, MARGIN), Math.max(viewport.width - tooltip.width - MARGIN, MARGIN)),
    placement: chosen,
  };
};

/*
  Tours are written per page rather than as one long script, because a tour that
  spans pages has to drive navigation, and a tour that moves the user around is
  one they abandon halfway.

  Every step names a `data-tour` hook rather than a CSS class or a position in the
  tree. A step whose element is missing is dropped when the tour starts instead of
  pointing at nothing, so a tour survives the layout changing underneath it.
*/
export const TOURS: TourDefinition[] = [
  {
    id: 'welcome',
    title: 'Selamat datang',
    label: 'Tur awal',
    autoStart: true,
    steps: [
      {
        target: 'sidebar',
        title: 'Menu utama',
        body: 'Semua yang bisa Anda akses ada di sini. Menu yang tidak muncul memang tidak diberikan untuk peran Anda.',
        placement: 'right',
      },
      {
        target: 'role',
        title: 'Peran Anda',
        body: 'Peran menentukan apa yang bisa dibuka. Hubungi Human Capital bila peran Anda terasa kurang.',
        placement: 'right',
      },
      {
        target: 'dashboard.stats',
        title: 'Angka utama',
        body: 'Ringkasan training pada periode yang sedang dipilih.',
        placement: 'bottom',
      },
      {
        target: 'dashboard.calendar',
        title: 'Kalender training',
        body: 'Klik satu tanggal untuk melihat acara di hari itu.',
        placement: 'top',
      },
      {
        target: 'signout',
        title: 'Keluar',
        body: 'Gunakan ini bila memakai komputer bersama. Sesi juga berakhir sendiri bila dibiarkan.',
        placement: 'right',
      },
    ],
  },
  {
    id: 'events',
    title: 'Daftar Acara',
    label: 'Daftar Acara',
    steps: [
      {
        target: 'events.period',
        title: 'Pilih periode',
        body: 'Ganti bulan atau tahun untuk melihat acara pada periode lain.',
        placement: 'bottom',
      },
      {
        target: 'events.create',
        title: 'Buat acara',
        body: 'Mulai dari sini untuk menjadwalkan training baru.',
        placement: 'left',
      },
      {
        target: 'events.filters',
        title: 'Cari dan saring',
        body: 'Cari berdasarkan judul, ruang, atau pengisi acara, lalu saring menurut status.',
        placement: 'bottom',
      },
      {
        target: 'events.table',
        title: 'Daftar acara',
        body: 'Klik judul acara untuk membuka detail, atau cetak undangannya dari kolom Aksi.',
        placement: 'top',
      },
    ],
  },
  {
    id: 'ojt',
    title: 'Batch OJT',
    label: 'Batch OJT',
    steps: [
      {
        target: 'ojt.create',
        title: 'Buat batch',
        body: 'Batch baru selalu mulai berstatus Draf. Tambahkan peserta setelah batch dibuat.',
        placement: 'left',
      },
      {
        target: 'ojt.list',
        title: 'Daftar batch',
        body: 'Klik batch untuk mengatur peserta, jadwal materi, dan assessment-nya.',
        placement: 'top',
      },
    ],
  },
  {
    id: 'ojt-batch',
    title: 'Detail Batch OJT',
    label: 'Detail Batch OJT',
    steps: [
      {
        target: 'ojt.status',
        title: 'Status batch',
        body: 'Selama masih Draf, QR tidak bisa dibuat dan peserta belum bisa mengerjakan apa pun. Terbitkan dulu.',
        placement: 'bottom',
      },
      {
        target: 'ojt.peserta',
        title: 'Peserta dan kodenya',
        body: 'Cukup isi nama. Sistem membuat kode otomatis — berikan kode itu kepada peserta.',
        placement: 'bottom',
      },
      {
        target: 'ojt.jadwal',
        title: 'Jadwal materi',
        body: 'Klik tanggal, isi materi dan pengisinya. Satu materi hanya boleh dijadwalkan satu kali.',
        placement: 'bottom',
      },
      {
        target: 'ojt.materi',
        title: 'Materi batch ini',
        body: 'Tiap materi punya tombol Assessment berisi empat QR: pre-test, post-test, feedback, dan absensi.',
        placement: 'top',
      },
      {
        target: 'ojt.results',
        title: 'Nilai semua peserta',
        body: 'Termasuk yang belum mengerjakan, jadi kelihatan siapa yang perlu ditagih.',
        placement: 'top',
      },
      {
        target: 'ojt.attendance',
        title: 'Kehadiran per materi',
        body: 'Klik satu baris untuk melihat siapa yang sudah hadir dan siapa yang belum.',
        placement: 'top',
      },
    ],
  },
  {
    id: 'ojt-materi',
    title: 'Master Materi OJT',
    label: 'Master Materi OJT',
    steps: [
      {
        target: 'materi.create',
        title: 'Tambah materi',
        body: 'Katalog ini dipakai bersama semua batch, jadi satu materi cukup ditulis sekali.',
        placement: 'left',
      },
      {
        target: 'materi.search',
        title: 'Cari dan tampilkan nonaktif',
        body: 'Materi yang sudah tidak dipakai dinonaktifkan, bukan dihapus, supaya riwayat peserta tetap utuh. Centang di sini untuk menampilkannya.',
        placement: 'bottom',
      },
      {
        target: 'materi.list',
        title: 'Katalog',
        body: 'Panah menaikkan atau menurunkan urutan, dan urutan itu menentukan urutan materi di kalender. Kode dibuat otomatis. Tombol Soal menuju bank soal materi tersebut.',
        placement: 'top',
      },
    ],
  },
];
