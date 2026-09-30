import sql from 'mssql';
import { query } from '../../db/pool.js';

/**
 * Read-only against hris_Employee, as the data safety boundary requires.
 * Only NIP, Name and DepartID are selected: BirthDate is the login credential
 * and Phone/Email are not needed to fill a participant list, so neither leaves
 * the server.
 */
export const searchEmployees = async (term = '', limit = 60) => {
  const like = `%${term.trim()}%`;
  const { recordset } = await query(
    `SELECT TOP (@limit) e.NIP, LTRIM(RTRIM(e.Name)) AS name, LTRIM(RTRIM(e.DepartID)) AS depart_id,
             LTRIM(RTRIM(mc.NamaDepartemen)) AS department_name
     FROM dbo.hris_Employee e
     LEFT JOIN dbo.MASCOSTCENTER mc ON mc.Departid = e.DepartID
     WHERE e.is_Active = '1'
       AND (@term = '' OR e.NIP LIKE @like OR e.Name LIKE @like)
     ORDER BY e.Name, e.NIP;`,
    (request) =>
      request
        .input('limit', sql.Int, limit)
        .input('term', sql.NVarChar(50), term.trim())
        .input('like', sql.NVarChar(50), like),
  );

  return recordset.map((row) => ({ nip: row.NIP, name: row.name, departId: row.depart_id, departmentName: row.department_name }));
};

export const suggestEmployeesForTraining = async (title, term = '', limit = 200) => {
  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const like = `%${term.trim()}%`;
  const { recordset } = await query(
    `WITH employee_training AS (
       SELECT DISTINCT p.participant_nip,
         LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(a.judul, ' ', ''), '-', ''), '_', ''), '.', ''), '(', ''), ')', ''), '/', '')) AS normalized_title
       FROM dbo.training_peserta_acara p
       JOIN dbo.training_acara a ON a.id = p.event_id
     )
     SELECT TOP (@limit) e.NIP, LTRIM(RTRIM(e.Name)) AS name,
            LTRIM(RTRIM(e.DepartID)) AS depart_id,
            LTRIM(RTRIM(mc.NamaDepartemen)) AS department_name
     FROM dbo.hris_Employee e
     LEFT JOIN dbo.MASCOSTCENTER mc ON mc.Departid = e.DepartID
     WHERE e.is_Active = '1'
       AND (@term = '' OR e.NIP LIKE @like OR e.Name LIKE @like)
       AND NOT EXISTS (
         SELECT 1 FROM employee_training et
         WHERE et.participant_nip = e.NIP
           AND (et.normalized_title LIKE '%' + @normalizedTitle + '%' OR @normalizedTitle LIKE '%' + et.normalized_title + '%')
       )
     ORDER BY NEWID();`,
    (request) => request
      .input('limit', sql.Int, limit)
      .input('term', sql.NVarChar(50), term.trim())
      .input('like', sql.NVarChar(50), like)
      .input('normalizedTitle', sql.NVarChar(200), normalizedTitle),
  );

  return recordset.map((row) => ({ nip: row.NIP, name: row.name, departId: row.depart_id, departmentName: row.department_name }));
};

export const monitorEmployees = async (term = '', limit = 200) => {
  const like = `%${term.trim()}%`;
  const { recordset } = await query(
    `SELECT TOP (@limit) e.NIP, LTRIM(RTRIM(e.Name)) AS name,
            LTRIM(RTRIM(e.DepartID)) AS depart_id,
            LTRIM(RTRIM(mc.NamaDepartemen)) AS department_name,
            COUNT(DISTINCT p.event_id) AS training_count
     FROM dbo.hris_Employee e
     LEFT JOIN dbo.MASCOSTCENTER mc ON mc.Departid = e.DepartID
     LEFT JOIN dbo.training_peserta_acara p ON p.participant_nip = e.NIP
       AND EXISTS (
         SELECT 1 FROM dbo.training_acara a
         WHERE a.id = p.event_id AND a.tgl >= DATEADD(month, -6, CAST(GETDATE() AS date))
       )
     WHERE e.is_Active = '1'
       AND (@term = '' OR e.NIP LIKE @like OR e.Name LIKE @like OR mc.NamaDepartemen LIKE @like)
     GROUP BY e.NIP, e.Name, e.DepartID, mc.NamaDepartemen
     ORDER BY e.Name, e.NIP;`,
    (request) => request
      .input('limit', sql.Int, limit)
      .input('term', sql.NVarChar(50), term.trim())
      .input('like', sql.NVarChar(50), like),
  );

  return recordset.map((row) => ({
    nip: row.NIP,
    name: row.name,
    departId: row.depart_id,
    departmentName: row.department_name,
    trainingCount: Number(row.training_count),
  }));
};

export const getEmployeeTrainingHistory = async (nip) => {
  const { recordset } = await query(
    `SELECT a.id, a.judul, a.tgl, a.status, r.nama_ruangan,
            t.trainer_name, t.trainer_type,
            CASE WHEN ab.id IS NULL THEN 0 ELSE 1 END AS attended,
            ab.captured_at
     FROM dbo.training_peserta_acara p
     JOIN dbo.training_acara a ON a.id = p.event_id
     LEFT JOIN dbo.training_ruang_acara r ON r.id = a.ruang_id
     OUTER APPLY (
       SELECT TOP 1 trainer_name, trainer_type
       FROM dbo.training_acara_trainer
       WHERE event_id = a.id
       ORDER BY is_primary DESC, id
     ) t
     LEFT JOIN dbo.training_absensi ab ON ab.event_id = p.event_id AND ab.participant_nip = p.participant_nip
     WHERE p.participant_nip = @nip
       AND a.tgl >= DATEADD(month, -6, CAST(GETDATE() AS date))
     ORDER BY a.tgl DESC, a.id DESC;`,
    (request) => request.input('nip', sql.NVarChar(50), nip),
  );

  return recordset.map((row) => ({
    id: row.id,
    title: row.judul,
    date: String(row.tgl),
    status: row.status,
    room: row.nama_ruangan,
    trainer: row.trainer_name,
    trainerType: row.trainer_type,
    attended: Boolean(row.attended),
    capturedAt: row.captured_at,
  }));
};
