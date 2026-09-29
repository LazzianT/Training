import { describe, expect, it } from 'vitest';
import { createEventBody } from '../src/modules/event/event.schema.js';

const valid = {
  judul: 'Workshop Keamanan Informasi',
  tgl: '2026-10-15',
  waktuMulai: '09:00',
  waktuSelesai: '11:30',
  sasaran: 'Seluruh karyawan IT',
  status: 'draft',
  pengisiAcara: {
    type: 'internal',
    nip: '0040',
    name: 'Pengisi Internal',
  },
};

describe('createEventBody', () => {
  it('accepts a well formed event', () => {
    expect(createEventBody.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty or over long title', () => {
    expect(createEventBody.safeParse({ ...valid, judul: '   ' }).success).toBe(false);
    expect(createEventBody.safeParse({ ...valid, judul: 'x'.repeat(201) }).success).toBe(false);
  });

  it('mirrors CK_training_acara_waktu', () => {
    const same = createEventBody.safeParse({ ...valid, waktuSelesai: '09:00' });
    expect(same.success).toBe(false);
    if (!same.success) {
      expect(same.error.issues[0].path).toEqual(['waktuSelesai']);
    }

    const reversed = createEventBody.safeParse({ ...valid, waktuMulai: '12:00', waktuSelesai: '11:00' });
    expect(reversed.success).toBe(false);
  });

  it('normalises HH:MM to the HH:MM:SS the driver requires', () => {
    const parsed = createEventBody.parse(valid);
    expect(parsed.waktuMulai).toBe('09:00:00');
    expect(parsed.waktuSelesai).toBe('11:30:00');
    expect(createEventBody.parse({ ...valid, waktuMulai: '09:00:00' }).waktuMulai).toBe('09:00:00');
  });

  it('rejects a date that does not exist rather than rolling it over', () => {
    expect(createEventBody.safeParse({ ...valid, tgl: '2026-02-31' }).success).toBe(false);
    expect(createEventBody.safeParse({ ...valid, tgl: '2026-13-01' }).success).toBe(false);
    expect(createEventBody.safeParse({ ...valid, tgl: '15/10/2026' }).success).toBe(false);
  });

  it('rejects an unknown status and a bad room id', () => {
    expect(createEventBody.safeParse({ ...valid, status: 'batal' }).success).toBe(false);
    expect(createEventBody.safeParse({ ...valid, ruangId: -1 }).success).toBe(false);
  });

  it('turns an empty optional text into null', () => {
    const parsed = createEventBody.parse({ ...valid, materiPokok: '  ' });
    expect(parsed.materiPokok).toBeNull();
  });
});
