import { readDump } from './lib/legacy-dump.js';

const tables = await readDump('D:/Lazzian Al Falah/Application/training/training.sql');

for (const [name, rows] of tables) {
  console.log(`${name}: ${rows.length} rows, ${Object.keys(rows[0] ?? {}).length} cols`);
}

const distinct = (table, column) => {
  const values = new Set((tables.get(table) ?? []).map((r) => r[column]));
  return [...values].sort();
};

console.log('\n=== DISTINCT VALUES ===');
for (const [table, column] of [
  ['peserta_acara', 'kehadiran'],
  ['peserta_acara', 'blast'],
  ['peserta_acara', 'departemen'],
  ['essay', 'nilai'],
  ['essay_jawaban_user', 'nilai'],
  ['essay_jawaban_user', 'jenis'],
  ['jawaban_user', 'jenis'],
  ['jawaban_user', 'jawaban'],
  ['jawaban_user', 'kunci_jawaban'],
  ['jawaban_user', 'point'],
  ['master_soal', 'jenis_tes'],
  ['master_soal', 'kunci_jawaban'],
  ['induk_master_soal', 'jenis'],
  ['acara', 'status'],
]) {
  const rows = tables.get(table);
  if (!rows || !(column in rows[0])) continue;
  console.log(`${table}.${column} -> ${JSON.stringify(distinct(table, column))}`);
}

console.log('\n=== FIRST ROW SAMPLES ===');
for (const [name, rows] of tables) console.log(`${name}: ${JSON.stringify(rows[0])}`);

const risiko = [];
const acara = tables.get('acara') ?? [];
for (const a of acara) {
  if (a.waktu_selesai <= a.waktu_mulai) risiko.push(`acara ${a.id}: selesai ${a.waktu_selesai} <= mulai ${a.waktu_mulai}`);
}
for (const a of tables.get('master_soal') ?? []) {
  if (!['A', 'B', 'C', 'D'].includes(String(a.kunci_jawaban))) risiko.push(`master_soal ${a.id}: kunci '${a.kunci_jawaban}'`);
}
for (const a of tables.get('absensi_training') ?? []) {
  if (!a.file_ttd || !String(a.file_ttd).trim()) risiko.push(`absensi_training ${a.id}: file_ttd kosong`);
}
for (const t of ['user_feedback', 'trainer_feedback']) {
  for (const row of tables.get(t) ?? []) {
    for (const [k, v] of Object.entries(row)) {
      if (k === 'komentar' || k === 'id' || k === 'id_acara' || k === 'nik_peserta') continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 1 || n > 5) risiko.push(`${t} ${row.id}: ${k}='${v}' di luar 1-5`);
    }
  }
}
console.log(`\n=== RISIKO CONSTRAINT (${risiko.length}) ===`);
risiko.slice(0, 40).forEach((r) => console.log('  ' + r));
