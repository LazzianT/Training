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
