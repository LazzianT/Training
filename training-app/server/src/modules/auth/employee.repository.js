import sql from 'mssql';
import { query } from '../../db/pool.js';

// Name and DepartID are blank padded char columns, so they must be trimmed
// before they reach the UI. NIP is varchar(10): binding nvarchar would force a
// per row CONVERT and lose the index on NIP.
const toProfile = (row) =>
  row
    ? {
        nip: row.NIP,
        name: row.Name?.trim() ?? null,
        departId: row.DepartID?.trim() ?? null,
        departmentName: row.NamaDepartemen?.trim() ?? null,
        isEventTrainer: Boolean(row.is_event_trainer),
        phone: row.Phone ?? null,
        email: row.Email ?? null,
      }
    : null;

/**
 * Read-only against the HR table, as required by the data safety boundary.
 * Both century candidates are bound as parameters, never interpolated.
 * is_Active is filtered because a resigned employee must not be able to sign in.
 */
export const findEmployeeByNipAndBirthDate = async (nip, candidates) => {
  const { recordset } = await query(
    `SELECT TOP 1 e.NIP, e.Name, e.DepartID, e.Phone, e.Email,
             mc.NamaDepartemen,
             CASE WHEN EXISTS (
               SELECT 1 FROM dbo.training_acara_trainer t WHERE t.trainer_nip = e.NIP
             ) THEN 1 ELSE 0 END AS is_event_trainer
     FROM dbo.hris_Employee e
     LEFT JOIN dbo.MASCOSTCENTER mc ON mc.Departid = e.DepartID
     WHERE e.NIP = @nip
       AND e.is_Active = '1'
       AND CAST(e.BirthDate AS date) IN (@century1, @century2)
     ORDER BY e.Id_Employee;`,
    (request) =>
      request
        .input('nip', sql.VarChar(10), nip)
        .input('century1', sql.Date, candidates[0] ?? null)
        .input('century2', sql.Date, candidates[1] ?? null),
  );

  return toProfile(recordset[0]);
};
