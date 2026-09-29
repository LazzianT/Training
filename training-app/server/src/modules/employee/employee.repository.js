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
