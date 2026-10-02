export type HealthStatus = {
  status: 'ok' | 'degraded';
  service: 'training-api';
  requestId?: string;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
};

/**
 * NIP alone is not a secret, and neither is BirthDate, so BirthDate is only the
 * initial credential. The server hashes it on first login and forces a change.
 */
export type LoginRequest = {
  nip: string;
  /** Initial login: 6 digits DDMMYY. Later logins: the password the user set. */
  credential: string;
};

export type EmployeeProfile = {
  nip: string;
  name: string;
  departId: string | null;
  departmentName?: string | null;
  isEventTrainer?: boolean;
  isCoordinator?: boolean;
  phone: string | null;
  email: string | null;
};

export type LoginResponse = {
  accessToken: string;
  expiresInSeconds: number;
  employee: EmployeeProfile;
};

export type DashboardEvent = {
  id: number;
  judul: string;
  /** YYYY-MM-DD */
  tgl: string;
  /** HH:MM:SS */
  waktuMulai: string;
  /** HH:MM:SS */
  waktuSelesai: string;
  ruangNama: string | null;
  status: EventStatus;
  pesertaCount: number;
};

export type DashboardSummary = {
  period: { year: number; month: number };
  month: {
    trainingCount: number;
    trainedEmployees: number;
    averageScore: number | null;
    feedbackCount: number;
  };
  master: {
    activeEmployees: number;
    activeRooms: number;
    totalTrainings: number;
    certificatesIssued: number;
  };
  /** Up to five, newest first, strictly before today. */
  recentEvents: DashboardEvent[];
  /** Today through the next seven days inclusive, oldest first. */
  upcomingEvents: DashboardEvent[];
  /** Every event inside the selected period, oldest first. Feeds the calendar. */
  monthEvents: DashboardEvent[];
  /** Twelve months, oldest first, zero filled so the axis never lies about gaps. */
  pareto: { month: string; label: string; trainingCount: number; cumulativePercent: number }[];
};

export type EventStatus = 'draft' | 'published' | 'closed' | 'archived';

export const EVENT_STATUSES: EventStatus[] = ['draft', 'published', 'closed', 'archived'];

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Draf',
  published: 'Terbit',
  closed: 'Selesai',
  archived: 'Arsip',
};

export type EventSummary = {
  id: number;
  judul: string;
  /** YYYY-MM-DD */
  tgl: string;
  /** HH:MM:SS */
  waktuMulai: string;
  waktuSelesai: string;
  sasaran: string;
  materiPokok: string | null;
  ruangId: number | null;
  ruangNama: string | null;
  status: EventStatus;
  pengisiAcara: string | null;
  pengisiAcaraType: 'internal' | 'external' | null;
  pengisiAcaraNip?: string | null;
  pesertaCount: number;
};

export type EventParticipant = {
  nip: string;
  name: string | null;
  department: string | null;
};

export type EventDetail = EventSummary & {
  participants: EventParticipant[];
  pengisiAcara: string | null;
  pengisiAcaraType: 'internal' | 'external' | null;
};

export type MyEventSummary = EventSummary & {
  isPrimaryTrainer: boolean;
};

export type Room = {
  id: number;
  namaRuangan: string;
};

export type CreateEventRequest = {
  judul: string;
  /** YYYY-MM-DD */
  tgl: string;
  /** HH:MM or HH:MM:SS */
  waktuMulai: string;
  waktuSelesai: string;
  sasaran: string;
  materiPokok?: string | null;
  ruangId?: number | null;
  status: EventStatus;
  pengisiAcara: {
    type: 'internal' | 'external';
    nip?: string;
    name: string;
  };
};

export type EmployeeLite = {
  nip: string;
  name: string;
  departId: string | null;
  departmentName?: string | null;
};

export const FEEDBACK_ASPECTS = [
  { code: 'Tempat_Pelaksanaan_Training', label: 'Bagaimana penilaian Anda terhadap tempat pelaksanaan training?' },
  { code: 'Peralatan_Perlengkapan_Training', label: 'Bagaimana penilaian Anda terhadap peralatan/perlengkapan training?' },
  { code: 'Konsumsi_Snack', label: 'Bagaimana penilaian Anda terhadap konsumsi/snack?' },
  { code: 'Fasilitas_Kegiatan_Training', label: 'Bagaimana penilaian Anda terhadap fasilitas kegiatan training?' },
  { code: 'Iklim_Kerjasama_Suasana', label: 'Bagaimana penilaian Anda terhadap iklim kerja sama dan suasana training?' },
  { code: 'Pengendalian_Waktu', label: 'Bagaimana penilaian Anda terhadap pengendalian waktu?' },
  { code: 'Dinamika_Diskusi', label: 'Bagaimana penilaian Anda terhadap dinamika diskusi?' },
  { code: 'Pencapaian_Target_Sesuai_Schedule', label: 'Apakah target training tercapai sesuai jadwal?' },
  { code: 'Sikap_Perilaku_Trainer', label: 'Bagaimana sikap dan perilaku trainer?' },
  { code: 'Penguasaan_Simulasi_Training', label: 'Bagaimana penguasaan trainer terhadap simulasi training?' },
  { code: 'Kemampuan_Pembahasan_Simulasi', label: 'Bagaimana kemampuan trainer membahas simulasi?' },
  { code: 'Efektivitas_Penggunaan_Alat_Bantu_Peraga', label: 'Bagaimana efektivitas penggunaan alat bantu/peraga?' },
  { code: 'Antusiasme_dan_Suara', label: 'Bagaimana antusiasme dan kejelasan suara trainer?' },
  { code: 'Penampilan_Trainer', label: 'Bagaimana penampilan trainer?' },
] as const;

/* --------------------------------------------------------------- OJT */

export type OjtBatchStatus = 'draft' | 'published' | 'closed';
export type OjtAttendanceStatus = 'hadir' | 'tidak_hadir' | 'izin';

/** Everything a batch detail carries about a material. */
export type OjtMateri = {
  id: number;
  kode: string;
  nama: string;
  deskripsi: string | null;
  urutan: number;
  aktif: boolean;
};

/**
 * The catalog as a maintenance screen sees it: inactive rows included, plus how
 * much history hangs off each material.
 *
 * The counts are the reason removal is a deactivation rather than a delete, so
 * the page can say what would be affected before anyone clicks.
 */
export type OjtMateriMaster = OjtMateri & {
  /** Schedule rows pointing at this material. */
  jadwalCount: number;
  /** Participant completions recorded against it. */
  progresCount: number;
};

/**
 * Per material readiness for one batch.
 *
 * The point of `siapUntukUji` is that a pre-test QR can be printed and handed out
 * with no questions behind it, and nobody finds out until a participant scans
 * it. The screen checks this before showing the code.
 */
export type OjtAssessmentSummary = {
  jadwalId: number;
  materiId: number;
  materiKode: string;
  materiNama: string;
  /** YYYY-MM-DD, the day this material runs in this batch. */
  tanggal: string;
  jamMulai: string | null;
  jamSelesai: string | null;
  pengisiNip: string | null;
  catatan: string | null;
  pesertaCount: number;
  testSetId: number | null;
  testSetStatus: 'draft' | 'published' | null;
  questionCount: number;
  publishedAt: string | null;
  /** Locked sessions across this batch's participants, both phases. */
  sesiTerkunci: number;
  /** Published with at least one question, so a QR would open a real form. */
  siapUntukUji: boolean;
};

/** One question bank per material, shared by every batch that teaches it. */
export type OjtMateriTestSet = {
  id: number;
  materiId: number;
  status: 'draft' | 'published' | 'closed';
  questionCount: number;
  publishedAt: string | null;
  /** Only present on the ensure call: true when this call created the bank. */
  created?: boolean;
};

export type CreateOjtMateriRequest = {
  nama: string;
  deskripsi?: string | null;
};

export type UpdateOjtMateriRequest = Partial<CreateOjtMateriRequest>;

export type OjtAbsensi = {
  /** YYYY-MM-DD */
  tanggal: string;
  status: OjtAttendanceStatus;
  catatan: string | null;
};

/**
 * One material sitting on one day of a batch's calendar.
 *
 * The material name lives in a shared catalog, so several batches can point at
 * the same OjtMateri while scheduling it on different dates. Both clock times
 * are null for an all day session, which is a normal case rather than missing
 * data.
 */
export type OjtJadwalMateri = {
  id: number;
  batchId: number;
  materiId: number;
  materiKode: string;
  materiNama: string;
  /** YYYY-MM-DD, always inside the batch window. */
  tanggal: string;
  jamMulai: string | null;
  jamSelesai: string | null;
  pengisiNip: string | null;
  /** Null when the NIP no longer resolves in HRIS, for example after someone left. */
  pengisiNama: string | null;
  pengisiDepartemen: string | null;
  catatan: string | null;
};

export type OjtPeserta = {
  id: number;
  batchId: number;
  /** Issued by HR. Identifies one person across every batch. */
  kodePeserta: string;
  namaLengkap: string;
  departemen: string | null;
  jabatan: string | null;
  /** YYYY-MM-DD */
  tanggalMasuk: string | null;
  aktif: boolean;
};

export type OjtPesertaDetail = OjtPeserta & {
  materiSelesai: number[];
  absensi: OjtAbsensi[];
};

export type OjtBatch = {
  id: number;
  kode: string;
  judul: string;
  /** YYYY-MM-DD */
  tanggalMulai: string;
  /** YYYY-MM-DD */
  tanggalSelesai: string;
  status: OjtBatchStatus;
  lokasi: string | null;
  catatan: string | null;
  dibuatOlehNip: string;
  dibuatPada: string;
  pesertaCount: number;
};

export type OjtBatchDetail = OjtBatch & {
  peserta: OjtPesertaDetail[];
  materi: OjtMateri[];
  jadwal: OjtJadwalMateri[];
};

export type CreateOjtBatchRequest = {
  kode: string;
  judul: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  lokasi?: string | null;
  catatan?: string | null;
};

export type AddOjtPesertaRequest = {
  /** The participant code is generated server side, never sent by the client. */
  namaLengkap: string;
};

/**
 * Scheduling a material onto a calendar day.
 *
 * namaMateri is a name rather than a materiId on purpose: the calendar lets HR
 * type a material that is not in the catalog yet, and the server resolves it to
 * the catalog, creating it when the name is new.
 */
export type CreateOjtJadwalRequest = {
  /** YYYY-MM-DD, must fall inside the batch window. */
  tanggal: string;
  namaMateri: string;
  jamMulai?: string | null;
  jamSelesai?: string | null;
  pengisiNip?: string | null;
  catatan?: string | null;
};

/** Every field is optional: only what is sent gets written. */
export type UpdateOjtJadwalRequest = Partial<CreateOjtJadwalRequest>;

export type SetOjtAbsensiRequest = {
  entries: { pesertaId: number; tanggal: string; status: OjtAttendanceStatus; catatan?: string | null }[];
};

export type OjtSavedQuestion = { id: number; type: 'pg' | 'essay'; number: number; text: string };

export type OjtQuestionInput = {
  type: 'pg' | 'essay';
  text: string;
  a?: string;
  b?: string;
  c?: string;
  d?: string;
  correct?: 'A' | 'B' | 'C' | 'D';
  instructions?: string;
  answerGuide?: string;
  imageData?: string;
  point?: number;
};

/**
 * One participant's result on one phase of one material.
 *
 * Three states, kept apart because they mean different things to whoever chases
 * the missing ones. `belum` never started. `mengerjakan` has an open session, and
 * showing that as blank would send someone after a participant who is halfway
 * through. `tanpa_nilai` is locked with nothing gradeable, which an essay-only
 * bank produces; that is not a score of zero and must not read as one.
 */
export type OjtScoreCell = {
  state: 'belum' | 'mengerjakan' | 'selesai' | 'tanpa_nilai';
  score: number | null;
  totalScore: number | null;
  percentage: number | null;
};

export type OjtResults = {
  /** Scores for every participant against every material the batch teaches. */
  byMateri: {
    materiId: number;
    materiKode: string;
    materiNama: string;
    tanggal: string;
    peserta: {
      kodePeserta: string;
      namaLengkap: string;
      pre: OjtScoreCell;
      post: OjtScoreCell;
    }[];
  }[];
  attendance: {
    kodePeserta: string;
    name: string;
    /** Materials attended. Attendance is recorded per material, not per day. */
    materiHadir: number;
    /** Distinct days on which they attended something. */
    hariHadir: number;
  }[];
  /** Per material, who attended and who did not. */
  attendanceByMateri: {
    materiId: number;
    materiKode: string;
    materiNama: string;
    tanggal: string;
    /** Count of participants marked hadir, for the collapsed row. */
    hadir: number;
    peserta: { kodePeserta: string; namaLengkap: string; hadir: boolean }[];
  }[];
};

/** The unauthenticated participant payload behind an OJT QR. */
export type OjtAccess = {
  batchId: number;
  purpose: 'pre_test' | 'post_test' | 'feedback' | 'attendance';
  title: string;
  /** Which material of the batch this code assesses. Shown before the code is asked. */
  materiId: number;
  materiKode: string;
  materiNama: string;
  /** The day the material runs, or null when it is not on the schedule. */
  materiTanggal: string | null;
  /**
   * Who is in this batch, so the form can offer a name instead of demanding a
   * code. Name and code only: this list is readable by anyone holding the QR.
   */
  peserta: { kodePeserta: string; namaLengkap: string }[];
  lokasi: string | null;
  tanggalMulai: string;
  tanggalSelesai: string;
};

export type OjtQuestion = {
  id: number;
  number: number;
  text: string;
  image: string | null;
  options: Record<string, string>;
};
