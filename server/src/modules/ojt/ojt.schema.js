import { z } from 'zod';

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

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

export const createBatchBody = z
  .object({
    kode: z
      .string()
      .trim()
      .min(1, 'Kode batch wajib diisi')
      .max(50)
      .regex(/^[A-Za-z0-9._-]+$/, 'Kode batch hanya boleh huruf, angka, titik, garis, dan strip')
      .transform((value) => value.toUpperCase()),
    judul: z.string().trim().min(1, 'Judul wajib diisi').max(200, 'Judul maksimal 200 karakter'),
    tanggalMulai: isoDate,
    tanggalSelesai: isoDate,
    lokasi: optionalText(200),
    catatan: optionalText(20_000),
  })
  .refine((value) => value.tanggalSelesai >= value.tanggalMulai, {
    message: 'Tanggal selesai harus sama atau setelah tanggal mulai',
    path: ['tanggalSelesai'],
  });

/**
 * The participant code is generated server side and is never accepted from the
 * client. Department and position were dropped with it: an OJT participant is
 * not in HRIS yet, so those fields were always guesses.
 */
export const addPesertaBody = z.object({
  namaLengkap: z.string().trim().min(1, 'Nama lengkap wajib diisi').max(200, 'Nama maksimal 200 karakter'),
});

export const setAbsensiBody = z.object({
  entries: z
    .array(
      z.object({
        pesertaId: z.coerce.number().int().positive(),
        tanggal: isoDate,
        status: z.enum(['hadir', 'tidak_hadir', 'izin']),
        catatan: optionalText(500),
      }),
    )
    .min(1, 'Minimal satu catatan kehadiran')
    .max(500, 'Terlalu banyak baris kehadiran'),
});

export const toggleMateriBody = z.object({
  pesertaId: z.coerce.number().int().positive(),
  materiId: z.coerce.number().int().positive(),
  /** Omit to derive from the current state; send true/false to force it. */
  selesai: z.boolean().optional(),
});

const jam = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Jam harus format HH:MM');

const jadwalFields = {
  namaMateri: z
    .string()
    .trim()
    .min(1, 'Nama materi wajib diisi')
    .max(200, 'Nama materi maksimal 200 karakter'),
  jamMulai: jam.nullable().optional(),
  jamSelesai: jam.nullable().optional(),
  pengisiNip: optionalText(10),
  catatan: optionalText(400),
};

/*
  Both ends are optional on their own, because an all day session has neither, but
  a session that states one end has to be coherent. Verified here as well as by the
  check constraint: the constraint is the last line of defence against a bad write
  from any client, this one is how the user finds out before a round trip.
*/
const withJamOrder = (schema) =>
  schema.refine(
    (value) =>
      value.jamMulai === undefined ||
      value.jamMulai === null ||
      value.jamSelesai === undefined ||
      value.jamSelesai === null ||
      value.jamSelesai > value.jamMulai,
    {
      message: 'Jam selesai harus setelah jam mulai',
      path: ['jamSelesai'],
    },
  );

export const createJadwalBody = withJamOrder(
  z.object({ tanggal: isoDate, ...jadwalFields }),
);

export const updateJadwalBody = withJamOrder(
  z.object({ tanggal: isoDate.optional(), ...jadwalFields }).partial(),
);

export const fieldErrors = (error) => {
  const flattened = z.flattenError(error);
  return { ...flattened.fieldErrors, _root: flattened.formErrors };
};