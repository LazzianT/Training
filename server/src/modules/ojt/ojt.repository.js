import sql from 'mssql';
import { query, transaction } from '../../db/pool.js';

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

/**
 * Confirms a presenter exists and is still active in HRIS.
 *
 * pengisi_nip cannot be a foreign key because hris_Employee has no declared key
 * to reference and sits outside this schema's write boundary. That leaves a
 * mistyped NIP able to store happily and then render as a blank presenter
 * forever, so the check has to happen on the way in.
 */
/**
 * Every catalog row, including the inactive ones.
 *
 * The master list is a maintenance screen, not a picker, so hiding deactivated
 * rows there would make them impossible to bring back.
 */
export const listAllMateri = async () => {
  const result = await query(
    `SELECT m.id, m.kode, m.nama, m.deskripsi, m.urutan, m.aktif,
            (SELECT COUNT_BIG(*) FROM dbo.training_ojt_jadwal_materi j WHERE j.materi_id = m.id) AS jadwal_count,
            (SELECT COUNT_BIG(*) FROM dbo.training_ojt_materi_peserta p WHERE p.materi_id = m.id) AS progres_count
     FROM dbo.training_ojt_materi m
     ORDER BY m.urutan, m.nama;`,
  );
  return result.recordset.map((row) => ({
    id: row.id,
    kode: row.kode,
    nama: row.nama,
    deskripsi: row.deskripsi ?? null,
    urutan: Number(row.urutan),
    aktif: Boolean(row.aktif),
    jadwalCount: Number(row.jadwal_count),
    progresCount: Number(row.progres_count),
  }));
};

export const createMateri = async (input) => {
  const cleaned = input.nama.trim().replace(/\s+/g, ' ');
  const clash = await query(
    'SELECT 1 AS found FROM dbo.training_ojt_materi WHERE LOWER(nama) = LOWER(@nama);',
    (request) => request.input('nama', sql.NVarChar(200), cleaned),
  );
  if (clash.recordset.length > 0) {
    throw Object.assign(new Error('MATERI_SUDAH_ADA'), { code: 'MATERI_SUDAH_ADA' });
  }

  return transaction(async (request) => {
    /*
      The whole read of MAX(urutan) and the insert share one transaction with an
      update lock held, otherwise two people adding a material at the same moment
      both read the same next value and one loses the race on the unique kode.
    */
    const next = await request().query(
      'SELECT ISNULL(MAX(urutan), 0) + 1 AS next_urutan FROM dbo.training_ojt_materi WITH (UPDLOCK, HOLDLOCK);',
    );
    const urutan = Number(next.recordset[0].next_urutan);
    const result = await request()
      .input('nama', sql.NVarChar(200), cleaned)
      .input('deskripsi', sql.NVarChar(2000), input.deskripsi || null)
      .input('urutan', sql.Int, urutan)
      .query(`
        INSERT INTO dbo.training_ojt_materi (kode, nama, deskripsi, urutan)
        OUTPUT INSERTED.id
        VALUES ('M' + CAST(@urutan AS nvarchar(10)), @nama, @deskripsi, @urutan);`);
    return result.recordset[0].id;
  });
};

export const updateMateri = async (materiId, input) => {
  const sets = [];
  if (input.nama !== undefined) sets.push('nama = @nama');
  if (input.deskripsi !== undefined) sets.push('deskripsi = @deskripsi');
  if (sets.length === 0) return materiId;

  const result = await query(
    `UPDATE dbo.training_ojt_materi SET ${sets.join(', ')} WHERE id = @id;`,
    (binder) => {
      const req = binder.input('id', sql.Int, materiId);
      if (input.nama !== undefined) req.input('nama', sql.NVarChar(200), input.nama.trim().replace(/\s+/g, ' '));
      if (input.deskripsi !== undefined) req.input('deskripsi', sql.NVarChar(2000), input.deskripsi || null);
      return req;
    },
  );
  if (result.rowsAffected?.[0] === 0) {
    throw Object.assign(new Error('MATERI_NOT_FOUND'), { code: 'MATERI_NOT_FOUND' });
  }
  return materiId;
};

/**
 * Deactivates rather than deletes.
 *
 * training_ojt_jadwal_materi and training_ojt_materi_peserta both reference this
 * table, and those rows are real history: a schedule that ran and a participant
 * who completed it. A hard delete would take the history with it, so removal is
 * expressed as aktif = 0 and the rows stay reachable.
 */
export const setMateriAktif = async (materiId, aktif) => {
  const result = await query(
    'UPDATE dbo.training_ojt_materi SET aktif = @aktif WHERE id = @id;',
    (request) => request.input('id', sql.Int, materiId).input('aktif', sql.Bit, aktif),
  );
  if (result.rowsAffected?.[0] === 0) {
    throw Object.assign(new Error('MATERI_NOT_FOUND'), { code: 'MATERI_NOT_FOUND' });
  }
  return materiId;
};

/**
 * Moves a material one slot up or down in the curriculum order.
 *
 * Done as a swap rather than a renumber-everything pass, and the two rows are
 * pushed to temporary negative values first: urutan carries a UNIQUE constraint,
 * so writing the target value while the current occupant still holds it would
 * fail partway and leave the order half applied.
 */
export const moveMateri = async (materiId, direction) => {
  return transaction(async (request) => {
    const current = await request()
      .input('id', sql.Int, materiId)
      .query('SELECT id, urutan FROM dbo.training_ojt_materi WITH (UPDLOCK, HOLDLOCK) WHERE id = @id;');
    const row = current.recordset[0];
    if (!row) throw Object.assign(new Error('MATERI_NOT_FOUND'), { code: 'MATERI_NOT_FOUND' });

    const neighbour = await request()
      .input('urutan', sql.Int, row.urutan + direction)
      .query('SELECT id, urutan FROM dbo.training_ojt_materi WHERE urutan = @urutan;');
    const other = neighbour.recordset[0];
    // Already at the end of the list. Not an error: the button just does nothing.
    if (!other) return false;

    const bind = (req) =>
      req
        .input('aId', sql.Int, row.id)
        .input('bId', sql.Int, other.id)
        .input('aSeq', sql.Int, row.urutan)
        .input('bSeq', sql.Int, other.urutan);

    /*
      urutan carries a UNIQUE constraint, so both rows are parked on negative
      values before taking each other's slot. Writing them straight through would
      fail the moment the target value is still held, and the move would end up
      half applied. Two separate requests, because a Request that has run cannot
      have its parameters declared again.
    */
    await bind(request()).query(`
      UPDATE dbo.training_ojt_materi
      SET urutan = CASE WHEN id = @aId THEN -@aSeq ELSE -@bSeq END
      WHERE id IN (@aId, @bId);`);
    await bind(request()).query(`
      UPDATE dbo.training_ojt_materi
      SET urutan = CASE WHEN id = @aId THEN @bSeq ELSE @aSeq END
      WHERE id IN (@aId, @bId);`);
    return true;
  });
};

/**
 * Turns "HH:MM" into the Date object the driver insists on.
 *
 * tedious validates a Time parameter with `new Date(Date.parse(value))` when it
 * is not already a Date, and Date.parse returns NaN for a bare clock time, so any
 * string fails with "Invalid time". Only a Date gets through.
 *
 * Built with Date.UTC and read back with getUTCHours, which is the same pairing
 * toTime() uses. mssql connects with useUTC on, so the clock time survives the
 * round trip instead of shifting by the server's offset.
 *
 * The date part is an arbitrary 1970-01-01 because Time carries no date and only
 * the time components are read.
 */
export const toSqlTime = (value) => {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
};

export const findPengisi = async (nip) => {
  const result = await query(
    `SELECT TOP 1 e.NIP, LTRIM(RTRIM(e.Name)) AS name, LTRIM(RTRIM(e.DepartID)) AS depart_id
     FROM dbo.hris_Employee e
     WHERE e.NIP = @nip AND e.is_Active = '1';`,
    (request) => request.input('nip', sql.VarChar(10), nip),
  );
  const row = result.recordset[0];
  return row ? { nip: row.NIP, name: row.name, departId: row.depart_id } : null;
};

export const listJadwal = async (batchId) => {
  const result = await query(
    `SELECT j.id, j.batch_id, j.materi_id, j.tanggal, j.jam_mulai, j.jam_selesai,
            j.pengisi_nip, j.catatan, m.kode AS materi_kode, m.nama AS materi_nama,
            LTRIM(RTRIM(e.Name)) AS pengisi_nama, LTRIM(RTRIM(e.DepartID)) AS pengisi_departemen
     FROM dbo.training_ojt_jadwal_materi j
     JOIN dbo.training_ojt_materi m ON m.id = j.materi_id
     LEFT JOIN dbo.hris_Employee e ON e.NIP = j.pengisi_nip
     WHERE j.batch_id = @id
     ORDER BY j.tanggal, j.jam_mulai, m.urutan;`,
    (request) => request.input('id', sql.Int, batchId),
  );

  return result.recordset.map((row) => ({
    id: row.id,
    batchId: row.batch_id,
    materiId: row.materi_id,
    materiKode: row.materi_kode,
    materiNama: row.materi_nama,
    tanggal: toIso(row.tanggal),
    jamMulai: toTime(row.jam_mulai),
    jamSelesai: toTime(row.jam_selesai),
    pengisiNip: row.pengisi_nip ?? null,
    pengisiNama: row.pengisi_nama ?? null,
    pengisiDepartemen: row.pengisi_departemen ?? null,
    catatan: row.catatan ?? null,
  }));
};

const toTime = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 5);
  const date = value instanceof Date ? value : new Date(value);
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
};

/**
 * Resolves a material name to a catalog row, creating it when the name is new.

 * The catalog is shared, so matching on nama alone is not enough: two people can
 * legitimately call a session "Safety Induction" while one means the half day and
 * the other the full day. Case and surrounding whitespace are normalised so a
 * near duplicate does not silently become a second row, and kode is derived from
 * the catalog's next urutan so the two unique constraints stay satisfied.
 */
export const resolveMateri = async (request, nama) => {
  const cleaned = nama.trim().replace(/\s+/g, ' ');
  const existing = await request().input('nama', sql.NVarChar(200), cleaned).query(
    'SELECT id, nama FROM dbo.training_ojt_materi WHERE LOWER(nama) = LOWER(@nama);',
  );
  if (existing.recordset.length > 0) return existing.recordset[0].id;

  const next = await request().query(
    'SELECT ISNULL(MAX(urutan), 0) + 1 AS next_urutan FROM dbo.training_ojt_materi WITH (UPDLOCK, HOLDLOCK);',
  );
  const urutan = Number(next.recordset[0].next_urutan);

  const inserted = await request()
    .input('nama', sql.NVarChar(200), cleaned)
    .input('urutan', sql.Int, urutan)
    .query(`
      INSERT INTO dbo.training_ojt_materi (kode, nama, urutan)
      OUTPUT INSERTED.id
      VALUES ('M' + CAST(@urutan AS nvarchar(10)), @nama, @urutan);`);
  return inserted.recordset[0].id;
};

export const createJadwal = async (batchId, input) => {
  const batch = await query(
    'SELECT tanggal_mulai, tanggal_selesai FROM dbo.training_ojt_batch WHERE id = @id;',
    (request) => request.input('id', sql.Int, batchId),
  );
  const row = batch.recordset[0];
  if (!row) throw Object.assign(new Error('BATCH_NOT_FOUND'), { code: 'BATCH_NOT_FOUND' });

  /*
    A material scheduled outside the batch window would never appear in the
    calendar and would quietly slip past every attendance total derived from it.
    Checked here rather than in a constraint, because the constraint would need
    the batch's date range, which lives in another table.
  */
  if (input.tanggal < toIso(row.tanggal_mulai) || input.tanggal > toIso(row.tanggal_selesai)) {
    throw Object.assign(new Error('TANGGAL_DI_LUAR_RENTANG'), { code: 'TANGGAL_DI_LUAR_RENTANG' });
  }

  /*
    A material runs on exactly one day of a batch, and there is a unique index
    enforcing it. Checked here as well so the user is told which material is
    already scheduled and when, instead of being handed a constraint violation
    that names a bare index.
  */
  return transaction(async (request) => {
    const resolvedMateriId = await resolveMateri(request, input.namaMateri);

    const clash = await request()
      .input('batchId', sql.Int, batchId)
      .input('materiId', sql.Int, resolvedMateriId)
      .query(`
        SELECT tanggal FROM dbo.training_ojt_jadwal_materi
        WHERE batch_id = @batchId AND materi_id = @materiId;`);
    const existing = clash.recordset[0];
    if (existing) {
      throw Object.assign(
        new Error(`MATERI_SUDAH_DIJADWALKAN:${toIso(existing.tanggal)}`),
        { code: 'MATERI_SUDAH_DIJADWALKAN', tanggal: toIso(existing.tanggal) },
      );
    }

    const result = await request()
      .input('batchId', sql.Int, batchId)
      .input('materiId', sql.Int, resolvedMateriId)
      .input('tanggal', sql.Date, input.tanggal)
      .input('jamMulai', sql.Time, toSqlTime(input.jamMulai))
      .input('jamSelesai', sql.Time, toSqlTime(input.jamSelesai))
      .input('pengisiNip', sql.VarChar(10), input.pengisiNip || null)
      .input('catatan', sql.NVarChar(400), input.catatan || null)
      .query(`
        INSERT INTO dbo.training_ojt_jadwal_materi
          (batch_id, materi_id, tanggal, jam_mulai, jam_selesai, pengisi_nip, catatan)
        OUTPUT INSERTED.id
        VALUES (@batchId, @materiId, @tanggal, @jamMulai, @jamSelesai, @pengisiNip, @catatan);`);
    return result.recordset[0].id;
  });
};

export const updateJadwal = async (jadwalId, input) => {
  const existing = await query(
    'SELECT 1 AS found FROM dbo.training_ojt_jadwal_materi WHERE id = @id;',
    (request) => request.input('id', sql.Int, jadwalId),
  );
  if (existing.recordset.length === 0) {
    throw Object.assign(new Error('JADWAL_NOT_FOUND'), { code: 'JADWAL_NOT_FOUND' });
  }

  const sets = [];
  if (input.namaMateri !== undefined) sets.push('materi_id = @materiId');
  if (input.pengisiNip !== undefined) sets.push('pengisi_nip = @pengisiNip');
  if (input.jamMulai !== undefined) sets.push('jam_mulai = @jamMulai');
  if (input.jamSelesai !== undefined) sets.push('jam_selesai = @jamSelesai');
  if (input.catatan !== undefined) sets.push('catatan = @catatan');
  if (sets.length === 0) return jadwalId;
  sets.push('diubah_pada = SYSUTCDATETIME()');

  /*
    One transaction, because resolving the material name may insert into the
    catalog. A catalog row committed without the schedule row pointing at it would
    be an orphan nothing ever cleans up.
  */
  await transaction(async (request) => {
    const binder = request();
    if (input.namaMateri !== undefined) {
      binder.input('materiId', sql.Int, await resolveMateri(request, input.namaMateri));
    }
    if (input.pengisiNip !== undefined) binder.input('pengisiNip', sql.VarChar(10), input.pengisiNip || null);
    if (input.jamMulai !== undefined) binder.input('jamMulai', sql.Time, toSqlTime(input.jamMulai));
    if (input.jamSelesai !== undefined) binder.input('jamSelesai', sql.Time, toSqlTime(input.jamSelesai));
    if (input.catatan !== undefined) binder.input('catatan', sql.NVarChar(400), input.catatan || null);

    await binder.input('id', sql.Int, jadwalId).query(`
      UPDATE dbo.training_ojt_jadwal_materi SET ${sets.join(', ')} WHERE id = @id;`);
  });

  return jadwalId;
};

export const deleteJadwal = async (jadwalId) => {
  const result = await query(
    'DELETE FROM dbo.training_ojt_jadwal_materi WHERE id = @id;',
    (request) => request.input('id', sql.Int, jadwalId),
  );
  return result.rowsAffected?.[0] === 1;
};

export const getBatch = async (batchId) => {
  const [batch, materi, peserta, materiProgress, absensi, jadwal] = await Promise.all([
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
    listJadwal(batchId),
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
    jadwal,
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
 * A batch is a standalone row. Nothing is written to training_acara, so OJT can
 * never surface in the training dashboard, the event list, or certificates.
 */
export const createBatch = async (input, actorNip) => {
  const result = await query(`
    INSERT INTO dbo.training_ojt_batch
      (kode, judul, tanggal_mulai, tanggal_selesai, status, lokasi, catatan, dibuat_oleh_nip)
    OUTPUT INSERTED.id
    VALUES (@kode, @judul, @tanggalMulai, @tanggalSelesai, 'draft', @lokasi, @catatan, @nip);

    SELECT b.*, (SELECT COUNT_BIG(*) FROM dbo.training_ojt_peserta p
                  WHERE p.batch_id = b.id AND p.aktif = 1) AS peserta_count
    FROM dbo.training_ojt_batch b WHERE b.id = SCOPE_IDENTITY();`,
    (request) =>
      request
        .input('kode', sql.NVarChar(50), input.kode)
        .input('judul', sql.NVarChar(200), input.judul)
        .input('tanggalMulai', sql.Date, toDate(input.tanggalMulai))
        .input('tanggalSelesai', sql.Date, toDate(input.tanggalSelesai))
        .input('lokasi', sql.NVarChar(200), input.lokasi ?? null)
        .input('catatan', sql.NVarChar(sql.MAX), input.catatan ?? null)
        .input('nip', sql.NVarChar(50), actorNip),
  );
  return mapBatch(result.recordset[0]);
};

/**
 * Deactivate rather than delete: attendance, test answers and feedback already
 * reference this person, and losing that history would make the OJT record
 * incomplete for a decision that can be reversed.
 *
 * The code comes from a sequence, so it is unique across the whole table and two
 * people added at the same moment cannot receive the same one.
 */
export const addPeserta = async (batchId, namaLengkap) => {
  const result = await query(`
    DECLARE @exists int = (SELECT COUNT(*) FROM dbo.training_ojt_batch WHERE id = @batchId);
    IF @exists = 0 THROW 51000, 'BATCH_NOT_FOUND', 1;

    DECLARE @kode nvarchar(50) =
      'OJT-' + RIGHT('00000' + CAST(NEXT VALUE FOR dbo.training_ojt_peserta_kode_seq AS nvarchar(10)), 5);

    INSERT INTO dbo.training_ojt_peserta (batch_id, kode_peserta, nama_lengkap)
    OUTPUT INSERTED.id, INSERTED.kode_peserta
    VALUES (@batchId, @kode, @namaLengkap);`,
    (request) =>
      request.input('batchId', sql.Int, batchId).input('namaLengkap', sql.NVarChar(200), namaLengkap),
  );
  return { id: Number(result.recordset[0].id), kodePeserta: result.recordset[0].kode_peserta };
};

export const removePeserta = async (pesertaId) => {
  const result = await query(
    `UPDATE dbo.training_ojt_peserta SET aktif = 0 WHERE id = @pesertaId;`,
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
  const result = await query(
    `UPDATE dbo.training_ojt_batch SET status = @status WHERE id = @batchId;`,
    (request) => request.input('batchId', sql.Int, batchId).input('status', sql.VarChar(20), status),
  );
  return result.rowsAffected;
};