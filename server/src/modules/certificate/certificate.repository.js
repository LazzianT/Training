import { randomBytes } from 'node:crypto';
import sql from 'mssql';
import { query, transaction } from '../../db/pool.js';

/*
  A certificate is earned by attending, not by being registered.

  training_peserta_acara.attendance_status is the only completion signal the schema
  carries: there is no pass mark and no "finished" flag, and a post-test can be
  skipped entirely while still attending. Marking attendance is what HR actually
  does on the day, so that is what the certificate hangs on.

  The list still shows trainings that were not attended. An empty page for someone
  who has been to three sessions that nobody marked is worse than a page saying so,
  and it points at the record that needs fixing rather than hiding it.
*/

const CERTIFICATE_YEARS = 10;

const toIso = (value) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10);

const timeOf = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 5);
  const date = value instanceof Date ? value : new Date(value);
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
};

/** Every training this employee is on the list for, newest first. */
export const listMine = async (nip) => {
  const result = await query(
    `SELECT a.id AS event_id, a.judul, a.tgl, a.waktu_mulai, a.waktu_selesai, a.status AS event_status,
            r.nama_ruangan AS ruang,
            p.participant_name, p.department_name, p.attendance_status,
            c.id AS certificate_id, c.verification_code, c.issued_at, c.status AS certificate_status,
            (SELECT TOP 1 COALESCE(t.trainer_name, e.Name)
               FROM dbo.training_acara_trainer t
               LEFT JOIN dbo.hris_Employee e ON e.NIP = t.trainer_nip
              WHERE t.event_id = a.id ORDER BY t.is_primary DESC, t.id) AS pengisi
     FROM dbo.training_peserta_acara p
     JOIN dbo.training_acara a ON a.id = p.event_id
     LEFT JOIN dbo.training_ruang_acara r ON r.id = a.ruang_id
     LEFT JOIN dbo.training_certificate c ON c.event_id = a.id AND c.participant_nip = p.participant_nip
     WHERE p.participant_nip = @nip
     ORDER BY a.tgl DESC, a.id DESC;`,
    (request) => request.input('nip', sql.NVarChar(50), nip),
  );

  return result.recordset.map((row) => ({
    eventId: row.event_id,
    judul: row.judul,
    tanggal: toIso(row.tgl),
    waktuMulai: timeOf(row.waktu_mulai),
    waktuSelesai: timeOf(row.waktu_selesai),
    eventStatus: row.event_status,
    ruang: row.ruang ?? null,
    pengisi: row.pengisi ?? null,
    namaPeserta: row.participant_name ?? null,
    departemen: row.department_name ?? null,
    attendanceStatus: row.attendance_status,
    /** Attendance recorded. The only thing that makes a certificate printable. */
    hadir: row.attendance_status === 'present',
    certificate: row.certificate_id
      ? {
          id: row.certificate_id,
          verificationCode: row.verification_code,
          issuedAt: row.issued_at ? new Date(row.issued_at).toISOString() : null,
          status: row.certificate_status,
        }
      : null,
  }));
};

const mintCode = (eventId) => {
  const year = new Date().getFullYear();
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  return `BMC-${year}-${eventId}-${suffix}`;
};

/**
 * Issues the certificate for one training, or returns the one already issued.
 *
 * Idempotent because the unique index on (event_id, participant_nip) would reject
 * a second row anyway, and a duplicate key is not something the person pressing
 * Print should ever see. The read and the insert share a transaction under an
 * update lock so two requests arriving together cannot both decide the row is
 * missing and race for the insert.
 */
export const issueFor = async (nip, eventId) => {
  return transaction(async (request) => {
    const existing = await request()
      .input('nip', sql.NVarChar(50), nip)
      .input('eventId', sql.Int, eventId)
      .query(`
        SELECT c.id, c.event_id, c.verification_code, c.issued_at, c.status,
               a.judul, a.tgl, r.nama_ruangan AS ruang, p.participant_name, p.department_name,
               p.attendance_status
        FROM dbo.training_certificate c
        JOIN dbo.training_acara a ON a.id = c.event_id
        LEFT JOIN dbo.training_ruang_acara r ON r.id = a.ruang_id
        LEFT JOIN dbo.training_peserta_acara p ON p.event_id = c.event_id AND p.participant_nip = c.participant_nip
        WHERE c.participant_nip = @nip AND c.event_id = @eventId;`);

    if (existing.recordset[0]) return { ...mapCertificate(existing.recordset[0]), created: false };

    const row = await request()
      .input('nip', sql.NVarChar(50), nip)
      .input('eventId', sql.Int, eventId)
      .query(`
        SELECT a.id, a.judul, a.tgl, a.status, r.nama_ruangan AS ruang,
               p.participant_name, p.department_name, p.attendance_status
        FROM dbo.training_acara a
        LEFT JOIN dbo.training_ruang_acara r ON r.id = a.ruang_id
        LEFT JOIN dbo.training_peserta_acara p ON p.event_id = a.id AND p.participant_nip = @nip
        WHERE a.id = @eventId;`);

    const event = row.recordset[0];
    if (!event) throw Object.assign(new Error('EVENT_NOT_FOUND'), { code: 'EVENT_NOT_FOUND' });
    if (!event.attendance_status) {
      throw Object.assign(new Error('NOT_REGISTERED'), { code: 'NOT_REGISTERED' });
    }
    if (event.attendance_status !== 'present') {
      throw Object.assign(new Error('BELUM_HADIR'), { code: 'BELUM_HADIR' });
    }

    const code = mintCode(eventId);
    const inserted = await request()
      .input('nip', sql.NVarChar(50), nip)
      .input('eventId', sql.Int, eventId)
      .input('code', sql.NVarChar(100), code)
      .input('years', sql.Int, CERTIFICATE_YEARS)
      .query(`
        INSERT INTO dbo.training_certificate (event_id, participant_nip, verification_code, issued_at, expires_at)
        OUTPUT INSERTED.id, INSERTED.verification_code, INSERTED.issued_at, INSERTED.status
        VALUES (@eventId, @nip, @code, SYSUTCDATETIME(), DATEADD(year, @years, SYSUTCDATETIME()));`);

    const created = inserted.recordset[0];
    return {
      id: created.id,
      eventId: event.id,
      judul: event.judul,
      tanggal: toIso(event.tgl),
      ruang: event.ruang ?? null,
      namaPeserta: event.participant_name ?? null,
      departemen: event.department_name ?? null,
      verificationCode: created.verification_code,
      issuedAt: new Date(created.issued_at).toISOString(),
      status: created.status,
      created: true,
    };
  });
};

const mapCertificate = (row) => ({
  id: row.id,
  eventId: row.event_id,
  judul: row.judul,
  tanggal: toIso(row.tgl),
  ruang: row.ruang ?? null,
  namaPeserta: row.participant_name ?? null,
  departemen: row.department_name ?? null,
  verificationCode: row.verification_code,
  issuedAt: new Date(row.issued_at).toISOString(),
  status: row.status,
});
