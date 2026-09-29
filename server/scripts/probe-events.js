import { connectDatabase, closeDatabase, query } from '../src/db/pool.js';
import { createEvent, listEvents, listRooms } from '../src/modules/event/event.repository.js';
import { createEventBody } from '../src/modules/event/event.schema.js';

await connectDatabase();

// Leftovers from earlier failed probes.
await query("DELETE FROM dbo.training_ruang_acara WHERE nama_ruangan = 'Ruang Probe Uji';");
await query("DELETE FROM dbo.training_acara WHERE judul LIKE 'EVENT UJI%';");

const { recordset } = await query(
  "INSERT INTO dbo.training_ruang_acara (nama_ruangan) OUTPUT INSERTED.id VALUES ('Ruang Ujiroom');",
);
const roomId = recordset[0].id;

const id = await createEvent(
  createEventBody.parse({
    judul: 'EVENT UJI RUANG',
    tgl: '2026-12-24',
    waktuMulai: '09:00',
    waktuSelesai: '11:00',
    sasaran: 'Uji join ruang',
    ruangId: roomId,
    status: 'published',
  }),
  '0377',
);

const found = listEvents().then((rows) => rows.find((row) => row.id === id));
const row = await found;
console.log('ruang terdaftar :', JSON.stringify(await listRooms()));
console.log('acara dengan JOIN ruang:', JSON.stringify(row));
console.log('ruangNama terisi  :', row.ruangNama === 'Ruang Ujiroom' ? 'YA' : `TIDAK (${row.ruangNama})`);
console.log('waktu benar      :', row.waktuMulai === '09:00:00' && row.waktuSelesai === '11:00:00' ? 'YA' : 'TIDAK');

await query('DELETE FROM dbo.training_acara WHERE id = @id', (r) => r.input('id', id));
await query('DELETE FROM dbo.training_ruang_acara WHERE id = @id', (r) => r.input('id', roomId));

const sisa = await query(
  "SELECT (SELECT COUNT_BIG(*) FROM dbo.training_acara) AS a, (SELECT COUNT_BIG(*) FROM dbo.training_ruang_acara) AS r;",
);
console.log('sisa acara/ruang :', JSON.stringify(sisa.recordset[0]));

await closeDatabase();
