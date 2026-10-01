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

export const addPesertaBody = z.object({
  kodePeserta: z
    .string()
    .trim()
    .min(1, 'Kode peserta wajib diisi')
    .max(50)
    .regex(/^[A-Za-z0-9._-]+$/, 'Kode peserta hanya boleh huruf, angka, titik, garis, dan strip')
    .transform((value) => value.toUpperCase()),
  namaLengkap: z.string().trim().min(1, 'Nama lengkap wajib diisi').max(200, 'Nama maksimal 200 karakter'),
  departemen: optionalText(200),
  jabatan: optionalText(200),
  tanggalMasuk: isoDate.nullable().optional(),
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

export const fieldErrors = (error) => {
  const flattened = z.flattenError(error);
  return { ...flattened.fieldErrors, _root: flattened.formErrors };
};