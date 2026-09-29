import sql from 'mssql';
import { query } from '../../db/pool.js';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const pad = (value) => String(value).padStart(2, '0');

const monthStart = (year, month) => `${year}-${pad(month)}-01`;

const addMonths = (year, month, delta) => {
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
};

const monthKey = (year, month) => `${year}-${pad(month)}`;

export const getDashboardSummary = async (year, month) => {
  const start = monthStart(year, month);
  const next = addMonths(year, month, 1);
  const twelveAgo = addMonths(year, month, -11);
  const paretoStart = monthStart(twelveAgo.year, twelveAgo.month);

  const [summary, pareto] = await Promise.all([
    query(
      `SELECT
         (SELECT COUNT_BIG(*) FROM dbo.training_acara
           WHERE tgl >= @monthStart AND tgl < @nextStart) AS training_count,
         (SELECT COUNT_BIG(DISTINCT pe.participant_nip)
            FROM dbo.training_peserta_acara pe
            INNER JOIN dbo.training_acara a ON a.id = pe.event_id
           WHERE a.tgl >= @monthStart AND a.tgl < @nextStart) AS trained_employees,
         (SELECT AVG(CAST(f.score AS float)) FROM dbo.training_feedback f
            INNER JOIN dbo.training_acara a ON a.id = f.event_id
           WHERE a.tgl >= @monthStart AND a.tgl < @nextStart
             AND f.score IS NOT NULL) AS average_score,
         (SELECT COUNT_BIG(*) FROM dbo.training_feedback f
            INNER JOIN dbo.training_acara a ON a.id = f.event_id
           WHERE a.tgl >= @monthStart AND a.tgl < @nextStart) AS feedback_count,
         (SELECT COUNT_BIG(*) FROM dbo.hris_Employee WHERE is_Active = 1) AS active_employees,
         (SELECT COUNT_BIG(*) FROM dbo.training_ruang_acara WHERE is_active = 1) AS active_rooms,
         (SELECT COUNT_BIG(*) FROM dbo.training_acara) AS total_trainings,
         (SELECT COUNT_BIG(*) FROM dbo.training_certificate) AS certificates_issued;`,
      (request) =>
        request
          .input('monthStart', sql.Date, start)
          .input('nextStart', sql.Date, monthStart(next.year, next.month))
          .input('paretoStart', sql.Date, paretoStart),
    ),
    query(
      `SELECT CONVERT(char(7), a.tgl, 126) AS month_key, COUNT_BIG(*) AS training_count
       FROM dbo.training_acara a
       WHERE a.tgl >= @paretoStart
       GROUP BY CONVERT(char(7), a.tgl, 126)
       ORDER BY month_key;`,
      (request) => request.input('paretoStart', sql.Date, paretoStart),
    ),
  ]);

  const row = summary.recordset[0];
  return {
    period: { year, month },
    month: {
      trainingCount: Number(row?.training_count ?? 0),
      trainedEmployees: Number(row?.trained_employees ?? 0),
      averageScore: row?.average_score == null ? null : Number(Number(row.average_score).toFixed(2)),
      feedbackCount: Number(row?.feedback_count ?? 0),
    },
    master: {
      activeEmployees: Number(row?.active_employees ?? 0),
      activeRooms: Number(row?.active_rooms ?? 0),
      totalTrainings: Number(row?.total_trainings ?? 0),
      certificatesIssued: Number(row?.certificates_issued ?? 0),
    },
    pareto: buildPareto(pareto.recordset, year, month),
  };
};

/**
 * Months with no rows are emitted as zero, so the axis never implies a gap is
 * missing data. The cumulative line divides by the real total, never by a
 * padded one.
 */
const buildPareto = (rows, year, month) => {
  const counts = new Map(rows.map((row) => [row.month_key, Number(row.training_count)]));
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);

  let running = 0;
  return Array.from({ length: 12 }, (_, index) => {
    const at = addMonths(year, month, index - 11);
    const key = monthKey(at.year, at.month);
    const trainingCount = counts.get(key) ?? 0;
    running += trainingCount;
    return {
      month: key,
      label: `${MONTH_LABELS[at.month - 1]} ${String(at.year).slice(2)}`,
      trainingCount,
      cumulativePercent: total === 0 ? 0 : Math.round((running / total) * 1000) / 10,
    };
  });
};
