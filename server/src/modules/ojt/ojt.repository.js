import sql from 'mssql';
import { query } from '../../db/pool.js';

const toDate = (value) => new Date(`${value}T00:00:00Z`);
const toIso = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10));

const mapBatch = (row) => ({
  id: row.id,
  kode: row.kode,
  judul: row.judul,
  tanggalMulai: toIso(row.tanggal_mulai),
  tanggalSelesai: toIso(row.tanggal_selesai),
  status: row.status,
  lokasi: row.lokasi ?? null,
  catatan: row.catatan ?? null,
  eventId: row.event_id,
  dibuatOlehNip: row.dibuat_oleh_nip,
  dibuatPada: row.dibuat_pada instanceof Date ? row.dibuat_pada.toISOString() : String(row.dibuat_pada),
  pesertaCount: Number(row.peserta_count ?? 0),
});

export const listBatches = async () => {
  const result = await query(`
    SELECT b.*, (SELECT COUNT_BIG(*) FROM dbo.training_ojt_peserta p
                  WHERE p.batch_id = b.id AND p.aktif = 1) AS peserta_count
    FROM dbo.training_ojt_batch b
    ORDER BY b.tanggal_mulai DESC, b.id DESC;`);
  return result.recordset.map(mapBatch);
};

export const listMateri = async () => {
  const result = await query(
    `SELECT id, kode, nama, deskripsi, urutan, aktif FROM dbo.training_ojt_materi WHERE aktif = 1 ORDER BY urutan;`,
  );
  return result.recordset.map((row) => ({
    id: row.id,
    kode: row.kode,
    nama: row.nama,
    deskripsi: row.deskripsi ?? null,
    urutan: Number(row.urutan),
    aktif: Boolean(row.aktif),
  }));
};

export const getBatch = async (batchId) => {
  const [batch, materi, peserta, materiProgress, absensi] = await Promise.all([
    query(`
      SELECT b.*, (SELECT COUNT_BIG(*) FROM dbo.training_ojt_peserta p
                    WHERE p.batch_id = b.id AND p.aktif = 1) AS peserta_count
      FROM dbo.training_ojt_batch b WHERE b.id = @id;`,
      (request) => request.input('id', sql.Int, batchId)),
    listMateri(),
    query(`
      SELECT id, batch_id, kode_peserta, nama_lengkap, departemen, jabatan, tanggal_masuk, aktif
      FROM dbo.training_ojt_peserta WHERE batch_id = @id AND aktif = 1
      ORDER BY kode_peserta;`,
      (request) => request.input('id', sql.Int, batchId)),
    query(`
      SELECT mp.peserta_id, mp.materi_id FROM dbo.training_ojt_materi_peserta mp
      JOIN dbo.training_ojt_peserta p ON p.id = mp.peserta_id WHERE p.batch_id = @id;`,
      (request) => request.input('id', sql.Int, batchId)),
    query(`
      SELECT a.peserta_id, a.tanggal, a.status, a.catatan FROM dbo.training_ojt_absensi a
      JOIN dbo.training_ojt_peserta p ON p.id = a.peserta_id WHERE p.batch_id = @id
      ORDER BY a.tanggal;`,
      (request) => request.input('id', sql.Int, batchId)),
  ]);

  const row = batch.recordset[0];
  if (!row) return null;

  const progressBy = new Map();
  for (const item of materiProgress.recordset) {
    const list = progressBy.get(item.peserta_id) ?? [];
    list.push(Number(item.materi_id));
    progressBy.set(item.peserta_id, list);
  }
  const absensiBy = new Map();
  for (const item of absensi.recordset) {
    const list = absensiBy.get(item.peserta_id) ?? [];
    list.push({ tanggal: toIso(item.tanggal), status: item.status, catatan: item.catatan ?? null });
    absensiBy.set(item.peserta_id, list);
  }

  return {
    ...mapBatch(row),
    materi,
    peserta: peserta.recordset.map((item) => ({
      id: item.id,
      batchId: item.batch_id,
      kodePeserta: item.kode_peserta,
      namaLengkap: item.nama_lengkap,
      departemen: item.departemen ?? null,
      jabatan: item.jabatan ?? null,
      tanggalMasuk: item.tanggal_masuk ? toIso(item.tanggal_masuk) : null,
      aktif: Boolean(item.aktif),
      materiSelesai: progressBy.get(item.id) ?? [],
      absensi: absensiBy.get(item.id) ?? [],
    })),
  };
};

/**
 * Creates the mirrored training_acara row and the batch in one transaction.
 * The acara row is what carries the assessment chain: every FK in
 * training_test_set, training_test_session, training_feedback and
 * training_certificate is keyed on (event_id, participant_nip), so a batch that
 * owns an acara can use those tables untouched.
 */
export const createBatch = async (input, actorNip) => {
  const result = await query(`
    BEGIN TRANSACTION;
    DECLARE @eventId int;

    INSERT INTO dbo.training_acara
      (judul, tgl, sasaran, materi_pokok, waktu_mulai, waktu_selesai, ruang_id, status, created_by_nip, updated_by_nip, kind)
    OUTPUT INSERTED.id
    VALUES
      (@judul, @tanggalMulai, @sasaran, @materiPokok, '08:00:00', '17:00:00', NULL, 'draft', @nip, @nip, 'ojt');

    SET @eventId = SCOPE_IDENTITY();

    INSERT INTO dbo.training_ojt_batch
      (kode, judul, tanggal_mulai, tanggal_selesai, status, lokasi, catatan, event_id, dibuat_oleh_nip)
    VALUES
      (@kode, @judul, @tanggalMulai, @tanggalSelesai, 'draft', @lokasi, @catatan, @eventId, @nip);

    COMMIT TRANSACTION;

    SELECT b.*, (SELECT COUNT_BIG(*) FROM dbo.training_ojt_peserta p
                  WHERE p.batch_id = b.id AND p.aktif = 1) AS peserta_count
    FROM dbo.training_ojt_batch b WHERE b.event_id = @eventId;`,
    (request) =>
      request
        .input('kode', sql.NVarChar(50), input.kode)
        .input('judul', sql.NVarChar(200), input.judul)
        .input('tanggalMulai', sql.Date, toDate(input.tanggalMulai))
        .input('tanggalSelesai', sql.Date, toDate(input.tanggalSelesai))
        .input('sasaran', sql.NVarChar(sql.MAX), `Peserta OJT batch ${input.kode}`)
        .input('materiPokok', sql.NVarChar(sql.MAX), input.catatan ?? null)
        .input('lokasi', sql.NVarChar(200), input.lokasi ?? null)
        .input('catatan', sql.NVarChar(sql.MAX), input.catatan ?? null)
        .input('nip', sql.NVarChar(50), actorNip),
  );
  return mapBatch(result.recordset[0]);
};

/**
 * A participant gets two rows: the authoritative OJT record, plus a mirrored
 * training_peserta_acara row whose participant_nip holds the HR code. That
 * mirrored row is what every existing assessment FK resolves against.
 */
export const addPeserta = async (batchId, input) => {
  const result = await query(`
    BEGIN TRANSACTION;
    DECLARE @eventId int = (SELECT event_id FROM dbo.training_ojt_batch WHERE id = @batchId);
    IF @eventId IS NULL THROW 51000, 'BATCH_NOT_FOUND', 1;

    INSERT INTO dbo.training_ojt_peserta
      (batch_id, kode_peserta, nama_lengkap, departemen, jabatan, tanggal_masuk)
    OUTPUT INSERTED.id
    VALUES (@batchId, @kodePeserta, @namaLengkap, @departemen, @jabatan, @tanggalMasuk);

    INSERT INTO dbo.training_peserta_acara
      (event_id, participant_nip, participant_name, department_name)
    VALUES (@eventId, @kodePeserta, @namaLengkap, @departemen);

    COMMIT TRANSACTION;`,
    (request) =>
      request
        .input('batchId', sql.Int, batchId)
        .input('kodePeserta', sql.NVarChar(50), input.kodePeserta)
        .input('namaLengkap', sql.NVarChar(200), input.namaLengkap)
        .input('departemen', sql.NVarChar(200), input.departemen ?? null)
        .input('jabatan', sql.NVarChar(200), input.jabatan ?? null)
        .input('tanggalMasuk', sql.Date, input.tanggalMasuk ? toDate(input.tanggalMasuk) : null),
  );
  return Number(result.recordset[0].id);
};

export const removePeserta = async (pesertaId) => {
  const result = await query(`
    BEGIN TRANSACTION;
    DECLARE @eventId int = (
      SELECT b.event_id FROM dbo.training_ojt_peserta p
      JOIN dbo.training_ojt_batch b ON b.id = p.batch_id WHERE p.id = @pesertaId);
    DECLARE @kode nvarchar(50) = (SELECT kode_peserta FROM dbo.training_ojt_peserta WHERE id = @pesertaId);

    -- Deactivate instead of delete: attendance, test answers, and feedback
    -- still reference this person and must not lose their history.
    UPDATE dbo.training_ojt_peserta SET aktif = 0 WHERE id = @pesertaId;
    UPDATE dbo.training_peserta_acara
      SET invitation_status = 'skipped'
      WHERE event_id = @eventId AND participant_nip = @kode;

    COMMIT TRANSACTION;`,
    (request) => request.input('pesertaId', sql.Int, pesertaId),
  );
  return (result.rowsAffected[0] ?? 0) > 0;
};

/**
 * Upsert, so re-recording the same day overwrites instead of colliding. Done as
 * UPDATE-then-INSERT rather than MERGE, which has a long list of documented
 * quirks in SQL Server for no gain on a single-row write.
 */
export const setAbsensi = async (entries, actorNip) => {
  for (const entry of entries) {
    await query(
      `
      UPDATE dbo.training_ojt_absensi
      SET status = @status, catatan = @catatan, dicatat_oleh_nip = @nip, dicatat_pada = SYSUTCDATETIME()
      WHERE peserta_id = @pesertaId AND tanggal = @tanggal;

      IF @@ROWCOUNT = 0
        INSERT INTO dbo.training_ojt_absensi (peserta_id, tanggal, status, catatan, dicatat_oleh_nip)
        VALUES (@pesertaId, @tanggal, @status, @catatan, @nip);`,
      (request) =>
        request
          .input('pesertaId', sql.Int, entry.pesertaId)
          .input('tanggal', sql.Date, toDate(entry.tanggal))
          .input('status', sql.VarChar(20), entry.status)
          .input('catatan', sql.NVarChar(500), entry.catatan ?? null)
          .input('nip', sql.NVarChar(50), actorNip),
    );
  }
  return entries.length;
};

/** Returns the state the row ended up in, so the caller can echo it back. */
export const toggleMateri = async (pesertaId, materiId, selesai, actorNip) => {
  if (selesai) {
    await query(
      `
      IF NOT EXISTS (SELECT 1 FROM dbo.training_ojt_materi_peserta WHERE peserta_id = @pesertaId AND materi_id = @materiId)
        INSERT INTO dbo.training_ojt_materi_peserta (peserta_id, materi_id, dicatat_oleh_nip)
        VALUES (@pesertaId, @materiId, @nip);`,
      (request) =>
        request
          .input('pesertaId', sql.Int, pesertaId)
          .input('materiId', sql.Int, materiId)
          .input('nip', sql.NVarChar(50), actorNip),
    );
    return true;
  }
  await query(
    `DELETE FROM dbo.training_ojt_materi_peserta WHERE peserta_id = @pesertaId AND materi_id = @materiId;`,
    (request) => request.input('pesertaId', sql.Int, pesertaId).input('materiId', sql.Int, materiId),
  );
  return false;
};

export const setBatchStatus = async (batchId, status) => {
  const result = await query(`
    BEGIN TRANSACTION;
    DECLARE @eventId int = (SELECT event_id FROM dbo.training_ojt_batch WHERE id = @batchId);
    UPDATE dbo.training_ojt_batch SET status = @status WHERE id = @batchId;
    UPDATE dbo.training_acara SET status = @status, updated_at = SYSUTCDATETIME() WHERE id = @eventId;
    COMMIT TRANSACTION;`,
    (request) => request.input('batchId', sql.Int, batchId).input('status', sql.VarChar(20), status),
  );
  return result.rowsAffected;
};