const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Parsed as local midnight, so a date never shifts with the browser timezone. */
export const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** Canonical YYYY-MM-DD for building map keys without timezone surprises. */
export const dateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const todayKey = () => {
  const now = new Date();
  return dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
};

export const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export const daysFromToday = (value: string) =>
  Math.round((parseDate(value).getTime() - startOfToday().getTime()) / 86_400_000);

export const isToday = (value: string) => daysFromToday(value) === 0;

/** Short relative label for anything inside the planning horizon. */
export const relativeDay = (value: string) => {
  const diff = daysFromToday(value);
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Besok';
  if (diff > 1 && diff <= 14) return `${diff} hari lagi`;
  if (diff === -1) return 'Kemarin';
  if (diff < -1 && diff >= -7) return `${Math.abs(diff)} hari lalu`;
  return null;
};

export const dayNumber = (value: string) => parseDate(value).getDate();

export const monthShort = (value: string) => MONTH_LABELS[parseDate(value).getMonth()];

export const weekdayShort = (value: string) => DAY_LABELS[parseDate(value).getDay()];

export const longDate = (value: string) =>
  parseDate(value).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export const shortDate = (iso: string) => {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day} ${MONTH_LABELS[Number(month) - 1]} ${year}`;
};

export const timeRange = (start: string, end: string) => `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
