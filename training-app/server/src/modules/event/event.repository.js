import sql from 'mssql';
import { query } from '../../db/pool.js';

export const listEvents = async (actor, year, month) => {
  const { recordset } = await query(`
    SELECT a.id,
           a.judul,
           CONVERT(char(10), a.tgl, 126) AS tgl,
           CONVERT(char(8), a.waktu_mulai, 108) AS waktu_mulai,
           CONVERT(char(8), a.waktu_selesai, 108) AS waktu_selesai,
           a.sasaran,
           a.materi_pokok,
           a.ruang_id,
           r.nama_ruangan,
           a.status,
           t.trainer_type,
           t.trainer_name,
           (SELECT COUNT_BIG(*) FROM dbo.training_peserta_acara p WHERE p.event_id = a.id) AS peserta_count
     FROM dbo.training_acara a
     LEFT JOIN dbo.training_ruang_acara r ON r.id = a.ruang_id
     OUTER APPLY (
       SELECT TOP 1 trainer_type, trainer_name
       FROM dbo.training_acara_trainer
       WHERE event_id = a.id
       ORDER BY is_primary DESC, id ASC
     ) t
      WHERE a.tgl >= DATEFROMPARTS(@year, @month, 1)
        AND a.tgl < DATEADD(month, 1, DATEFROMPARTS(@year, @month, 1))
        AND (@isAdmin = 1 OR EXISTS (
       SELECT 1 FROM dbo.training_acara_trainer scope_t
       WHERE scope_t.event_id = a.id AND scope_t.trainer_nip = @nip
     ))
     ORDER BY a.tgl DESC, a.id DESC;
  `, (request) => request.input('isAdmin', sql.Bit, actor.departId === '0300').input('nip', sql.NVarChar(50), actor.nip).input('year', sql.Int, year).input('month', sql.Int, month));

  return recordset.map((row) => ({
    id: row.id,
    judul: row.judul,
    tgl: String(row.tgl),
    waktuMulai: String(row.waktu_mulai),
    waktuSelesai: String(row.waktu_selesai),
    sasaran: row.sasaran,
    materiPokok: row.materi_pokok,
    ruangId: row.ruang_id,
     ruangNama: row.ruang_nama ?? row.nama_ruangan ?? null,
     status: row.status,
     pengisiAcara: row.trainer_name ?? null,
     pengisiAcaraType: row.trainer_type ?? null,
     pesertaCount: Number(row.peserta_count),
  }));
};

export const getEvent = async (eventId, actor) => {
  const result = await query(`
    SELECT a.id, a.judul, CONVERT(char(10), a.tgl, 126) AS tgl,
           CONVERT(char(8), a.waktu_mulai, 108) AS waktu_mulai,
           CONVERT(char(8), a.waktu_selesai, 108) AS waktu_selesai,
           a.sasaran, a.materi_pokok, a.ruang_id, r.nama_ruangan, a.status,
           t.trainer_type, t.trainer_name, t.trainer_nip,
           p.participant_nip, p.participant_name, p.department_name, p.department_code
    FROM dbo.training_acara a
    LEFT JOIN dbo.training_ruang_acara r ON r.id = a.ruang_id
    OUTER APPLY (SELECT TOP 1 trainer_type, trainer_name, trainer_nip FROM dbo.training_acara_trainer WHERE event_id = a.id ORDER BY is_primary DESC, id) t
    LEFT JOIN dbo.training_peserta_acara p ON p.event_id = a.id
     WHERE a.id = @eventId
       AND (@isAdmin = 1 OR EXISTS (SELECT 1 FROM dbo.training_acara_trainer scope_t WHERE scope_t.event_id = a.id AND scope_t.trainer_nip = @nip))
    ORDER BY p.participant_name, p.participant_nip;`,
     (request) => request.input('eventId', sql.Int, eventId)
       .input('isAdmin', sql.Bit, actor.isCoordinator === true)
       .input('nip', sql.NVarChar(50), actor.nip),
  );
  if (result.recordset.length === 0) return null;
  const first = result.recordset[0];
  return {
    id: first.id, judul: first.judul, tgl: String(first.tgl),
    waktuMulai: String(first.waktu_mulai), waktuSelesai: String(first.waktu_selesai),
    sasaran: first.sasaran, materiPokok: first.materi_pokok, ruangId: first.ruang_id,
    ruangNama: first.ruang_nama ?? null, status: first.status,
    pengisiAcara: first.trainer_name ?? null, pengisiAcaraType: first.trainer_type ?? null,
    pengisiAcaraNip: first.trainer_nip ?? null,
    pesertaCount: result.recordset.filter((row) => row.participant_nip).length,
    participants: result.recordset.filter((row) => row.participant_nip).map((row) => ({
      nip: row.participant_nip, name: row.participant_name, department: row.department_name ?? row.department_code,
    })),
  };
};

export const getMyEvents = async (actor) => {
  const { recordset } = await query(`
    SELECT a.id, a.judul, CONVERT(char(10), a.tgl, 126) AS tgl,
      CONVERT(char(8), a.waktu_mulai, 108) AS waktu_mulai, CONVERT(char(8), a.waktu_selesai, 108) AS waktu_selesai,
      a.sasaran, a.materi_pokok, a.ruang_id, r.nama_ruangan, a.status,
      CAST(CASE WHEN t.is_primary = 1 THEN 1 ELSE 0 END AS bit) AS is_primary_trainer,
      t.trainer_name, t.trainer_type,
      (SELECT COUNT_BIG(*) FROM dbo.training_peserta_acara p WHERE p.event_id = a.id) AS peserta_count
    FROM dbo.training_acara a
    LEFT JOIN dbo.training_ruang_acara r ON r.id = a.ruang_id
    JOIN dbo.training_acara_trainer t ON t.event_id = a.id AND (@isCoordinator = 1 OR t.trainer_nip = @nip)
    ORDER BY a.tgl DESC, a.id DESC;`,
     (request) => request.input('nip', sql.NVarChar(50), actor.nip).input('isCoordinator', sql.Bit, actor.isCoordinator === true),
  );
  return recordset.map((row) => ({ id: row.id, judul: row.judul, tgl: String(row.tgl), waktuMulai: String(row.waktu_mulai), waktuSelesai: String(row.waktu_selesai), sasaran: row.sasaran, materiPokok: row.materi_pokok, ruangId: row.ruang_id, ruangNama: row.nama_ruangan ?? null, status: row.status, pengisiAcara: row.trainer_name ?? null, pengisiAcaraType: row.trainer_type ?? null, pesertaCount: Number(row.peserta_count), isPrimaryTrainer: Boolean(row.is_primary_trainer) }));
};

export const listRooms = async () => {
  const { recordset } = await query(`
    SELECT id, nama_ruangan FROM dbo.training_ruang_acara
    WHERE is_active = 1 ORDER BY nama_ruangan;
  `);
  return recordset.map((row) => ({ id: row.id, namaRuangan: row.nama_ruangan }));
};

export const ensureDefaultRooms = async () => {
  await query(`
    INSERT INTO dbo.training_ruang_acara (nama_ruangan)
    SELECT v.nama_ruangan
    FROM (VALUES (N'Serbaguna'), (N'Dojo')) v(nama_ruangan)
    WHERE NOT EXISTS (
      SELECT 1 FROM dbo.training_ruang_acara r WHERE r.nama_ruangan = v.nama_ruangan
    );
  `);
};

/**
 * The tedious driver validates a time parameter by calling new Date() on it, so
 * an 'HH:MM:SS' string parses to NaN. It must be a Date, and the driver reads
 * UTC parts, so the epoch date is built in UTC to avoid a local offset shift.
 */
const toTime = (value) => {
  const [hours, minutes, seconds] = value.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds ?? 0));
};

export const createEvent = async (input, createdByNip) => {
  const { recordset } = await query(
    `SET XACT_ABORT ON;
     BEGIN TRANSACTION;
     DECLARE @new_event TABLE (id int);
     INSERT INTO dbo.training_acara
       (judul, tgl, sasaran, materi_pokok, waktu_mulai, waktu_selesai, ruang_id, status, created_by_nip)
      OUTPUT INSERTED.id INTO @new_event
      VALUES (@judul, @tgl, @sasaran, @materiPokok, @waktuMulai, @waktuSelesai, @ruangId, @status, @createdByNip);

     INSERT INTO dbo.training_acara_trainer
       (event_id, trainer_type, trainer_nip, trainer_name, is_primary)
     SELECT e.id, @trainerType,
            CASE WHEN @trainerType = 'internal' THEN h.NIP ELSE NULL END,
            CASE WHEN @trainerType = 'internal' THEN LTRIM(RTRIM(h.Name)) ELSE @trainerName END,
            1
     FROM @new_event e
     LEFT JOIN dbo.hris_Employee h
       ON @trainerType = 'internal' AND h.NIP = @trainerNip AND h.is_Active = '1';

     SELECT id FROM @new_event;
     COMMIT TRANSACTION;`,
    (request) =>
      request
        .input('judul', sql.NVarChar(200), input.judul)
        .input('tgl', sql.Date, input.tgl)
        .input('sasaran', sql.NVarChar(sql.MAX), input.sasaran)
        .input('materiPokok', sql.NVarChar(sql.MAX), input.materiPokok ?? null)
        .input('waktuMulai', sql.Time, toTime(input.waktuMulai))
        .input('waktuSelesai', sql.Time, toTime(input.waktuSelesai))
        .input('ruangId', sql.Int, input.ruangId ?? null)
        .input('status', sql.VarChar(20), input.status)
        .input('createdByNip', sql.NVarChar(50), createdByNip)
        .input('trainerType', sql.VarChar(10), input.pengisiAcara.type)
        .input('trainerNip', sql.NVarChar(50), input.pengisiAcara.nip ?? null)
        .input('trainerName', sql.NVarChar(200), input.pengisiAcara.name),
  );
  return recordset[0].id;
};

export const updateEvent = async (eventId, input, updatedByNip) => {
  await query(`
    SET XACT_ABORT ON; BEGIN TRANSACTION;
    UPDATE dbo.training_acara SET judul=@judul, tgl=@tgl, sasaran=@sasaran, materi_pokok=@materiPokok,
      waktu_mulai=@waktuMulai, waktu_selesai=@waktuSelesai, ruang_id=@ruangId, status=@status,
      updated_by_nip=@updatedByNip, updated_at=SYSUTCDATETIME(), version=version+1 WHERE id=@eventId;
    DELETE FROM dbo.training_acara_trainer WHERE event_id=@eventId;
    INSERT INTO dbo.training_acara_trainer (event_id, trainer_type, trainer_nip, trainer_name, is_primary)
    SELECT @eventId, @trainerType,
      CASE WHEN @trainerType='internal' THEN h.NIP ELSE NULL END,
      CASE WHEN @trainerType='internal' THEN LTRIM(RTRIM(h.Name)) ELSE @trainerName END, 1
    FROM dbo.hris_Employee h WHERE @trainerType='internal' AND h.NIP=@trainerNip AND h.is_Active='1'
    UNION ALL SELECT @eventId, 'external', NULL, @trainerName, 1 WHERE @trainerType='external';
    COMMIT TRANSACTION;`,
    (request) => request.input('eventId', sql.Int, eventId)
      .input('judul', sql.NVarChar(200), input.judul).input('tgl', sql.Date, input.tgl)
      .input('sasaran', sql.NVarChar(sql.MAX), input.sasaran).input('materiPokok', sql.NVarChar(sql.MAX), input.materiPokok ?? null)
      .input('waktuMulai', sql.Time, toTime(input.waktuMulai)).input('waktuSelesai', sql.Time, toTime(input.waktuSelesai))
      .input('ruangId', sql.Int, input.ruangId ?? null).input('status', sql.VarChar(20), input.status)
      .input('updatedByNip', sql.NVarChar(50), updatedByNip).input('trainerType', sql.VarChar(10), input.pengisiAcara.type)
      .input('trainerNip', sql.NVarChar(50), input.pengisiAcara.nip ?? null).input('trainerName', sql.NVarChar(200), input.pengisiAcara.name),
  );
};

export const addParticipants = async (eventId, nips) => {
  const unique = [...new Set(nips.map((nip) => String(nip).trim()).filter(Boolean))];
  const { rowsAffected } = await query(`
    INSERT INTO dbo.training_peserta_acara (event_id, participant_nip, participant_name, department_code, department_name)
    SELECT @eventId, h.NIP, LTRIM(RTRIM(h.Name)), LTRIM(RTRIM(h.DepartID)), LTRIM(RTRIM(mc.NamaDepartemen))
    FROM dbo.hris_Employee h LEFT JOIN dbo.MASCOSTCENTER mc ON mc.Departid = h.DepartID WHERE h.is_Active='1' AND h.NIP IN (SELECT [value] FROM OPENJSON(@nips))
      AND NOT EXISTS (SELECT 1 FROM dbo.training_peserta_acara p WHERE p.event_id=@eventId AND p.participant_nip=h.NIP);`,
    (request) => request.input('eventId', sql.Int, eventId).input('nips', sql.NVarChar(sql.MAX), JSON.stringify(unique)),
  );
  return { added: rowsAffected?.[0] ?? 0, skipped: unique.length - (rowsAffected?.[0] ?? 0) };
};

export const removeParticipant = async (eventId, nip) => {
  const { rowsAffected } = await query(
    `DELETE FROM dbo.training_peserta_acara
     WHERE event_id = @eventId AND participant_nip = @nip;`,
    (request) => request.input('eventId', sql.Int, eventId).input('nip', sql.NVarChar(50), nip),
  );
  return (rowsAffected?.[0] ?? 0) > 0;
};
