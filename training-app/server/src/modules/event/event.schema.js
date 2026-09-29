import { z } from 'zod';

/** Native <input type="date"> sends YYYY-MM-DD; reject anything else. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus format YYYY-MM-DD')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    );
  }, 'Tanggal tidak ada di kalender');

/**
 * Native <input type="time"> sends HH:MM, the database stores time(0) and the
 * driver only accepts HH:MM:SS, so normalise here rather than at each call site.
 */
const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Waktu harus format HH:MM')
  .transform((value) => (value.length === 5 ? `${value}:00` : value));

const toSeconds = (value) => {
  const [hours, minutes, seconds = '0'] = value.split(':');
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
};

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

export const createEventBody = z
  .object({
    judul: z.string().trim().min(1, 'Judul wajib diisi').max(200, 'Judul maksimal 200 karakter'),
    tgl: isoDate,
    waktuMulai: timeOfDay,
    waktuSelesai: timeOfDay,
    sasaran: z.string().trim().min(1, 'Sasaran wajib diisi'),
    materiPokok: optionalText(20_000),
    ruangId: z.coerce.number().int().positive().nullable().optional(),
    status: z.enum(['draft', 'published', 'closed', 'archived']),
    pengisiAcara: z.object({
      type: z.enum(['internal', 'external']),
      nip: z.string().trim().max(50).optional(),
      name: z.string().trim().min(1, 'Nama pengisi acara wajib diisi').max(200),
    }).superRefine((value, context) => {
      if (value.type === 'internal' && !value.nip) {
        context.addIssue({ code: 'custom', path: ['nip'], message: 'Pilih pengisi acara internal' });
      }
      if (value.type === 'external' && value.nip) {
        context.addIssue({ code: 'custom', path: ['nip'], message: 'Pengisi eksternal tidak memiliki NIP internal' });
      }
    }),
  })
  // Mirrors CK_training_acara_waktu so the client gets a field error, not a 500.
  .refine((value) => toSeconds(value.waktuSelesai) > toSeconds(value.waktuMulai), {
    message: 'Waktu selesai harus lebih besar dari waktu mulai',
    path: ['waktuSelesai'],
  });

export const fieldErrors = (error) => {
  const flattened = z.flattenError(error);
  return { ...flattened.fieldErrors, _root: flattened.formErrors };
};
