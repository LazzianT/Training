import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { OjtAttendanceStatus, OjtBatchDetail, OjtPesertaDetail } from '@training/contracts';
import { ApiRequestError } from '../api/auth.js';
import {
  addOjtPeserta,
  createOjtQr,
  fetchOjtBatch,
  fetchOjtResults,
  recordOjtAbsensi,
  removeOjtPeserta,
  setOjtBatchStatus,
  setOjtMateriDone,
} from '../api/ojt.js';
import { Button, EmptyState, Field, Panel, StatTile } from '../components/ui/index.js';
import { CopyButton, useToast } from '../components/Toast.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { useAuth } from '../auth/AuthContext.js';
import type { OjtResults } from '@training/contracts';
import { shortDate } from '../lib/date.js';

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const QR_PURPOSES = [
  { value: 'pre_test', label: 'Pre-test' },
  { value: 'post_test', label: 'Post-test' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'attendance', label: 'Absensi' },
] as const;

const ATTENDANCE_TONE: Record<OjtAttendanceStatus, string> = {
  hadir: 'bg-emerald-600 text-white border-emerald-600',
  tidak_hadir: 'bg-white text-slate-500 border-slate-300',
  izin: 'bg-amber-100 text-amber-800 border-amber-300',
};

const ATTENDANCE_LABEL: Record<OjtAttendanceStatus, string> = {
  hadir: 'Hadir',
  tidak_hadir: 'Tidak hadir',
  izin: 'Izin',
};

const CELL =
  'flex h-9 items-center justify-center border text-xs font-semibold transition duration-150 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset';

/** Weekdays only: OJT runs Monday to Friday, and a Saturday row would be noise. */
const workingDays = (start: string, end: string) => {
  const days: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cursor <= last) {
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const weekdayOf = (iso: string) => DAY_LABELS[(new Date(`${iso}T00:00:00`).getDay() + 6) % 7];

export const OjtBatchPage = () => {
  const { batchId } = useParams();
  const id = Number(batchId);
  const { session, signOut } = useAuth();
  const { push } = useToast();
  const confirm = useConfirm();

  const [batch, setBatch] = useState<OjtBatchDetail | null>(null);
  const [results, setResults] = useState<OjtResults | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [qr, setQr] = useState<{ purpose: string; url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Record<number, OjtAttendanceStatus>>({});
  const [pesertaDraft, setPesertaDraft] = useState({ kodePeserta: '', namaLengkap: '', departemen: '', jabatan: '' });

  useEffect(() => {
    if (!session || !Number.isInteger(id)) return;
    const controller = new AbortController();
    setError('');
    fetchOjtBatch(session.accessToken, id, controller.signal)
      .then(setBatch)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        if (reason instanceof ApiRequestError && reason.status === 401) return signOut();
        setError(reason instanceof ApiRequestError ? reason.message : 'Batch OJT gagal dimuat.');
      });
    return () => controller.abort();
  }, [session, id, signOut]);

  useEffect(() => {
    if (!session || !batch) return;
    const controller = new AbortController();
    fetchOjtResults(session.accessToken, batch.id, controller.signal)
      .then(setResults)
      .catch(() => undefined);
    return () => controller.abort();
  }, [session, batch]);

  const days = useMemo(
    () => (batch ? workingDays(batch.tanggalMulai, batch.tanggalSelesai) : []),
    [batch],
  );

  const stats = useMemo(() => {
    if (!batch) return { peserta: 0, materiRate: 0, hadirRate: 0, postScore: null as number | null };
    const total = batch.peserta.length;
    const materiTotal = total * batch.materi.length;
    const materiDone = batch.peserta.reduce((sum, item) => sum + item.materiSelesai.length, 0);
    const cells = total * days.length;
    const hadir = batch.peserta.reduce(
      (sum, item) => sum + item.absensi.filter((entry) => entry.status === 'hadir').length,
      0,
    );
    const post = results?.submissions.filter((item) => item.phase === 'post') ?? [];
    const scored = post.filter((item) => item.percentage !== null);
    return {
      peserta: total,
      materiRate: materiTotal === 0 ? 0 : Math.round((materiDone / materiTotal) * 100),
      hadirRate: cells === 0 ? 0 : Math.round((hadir / cells) * 100),
      postScore:
        scored.length === 0
          ? null
          : Math.round(scored.reduce((sum, item) => sum + (item.percentage ?? 0), 0) / scored.length),
    };
  }, [batch, days.length, results]);

  const reload = async () => {
    if (!session) return;
    const fresh = await fetchOjtBatch(session.accessToken, id);
    setBatch(fresh);
  };

  const savePeserta = async () => {
    if (!session || !batch) return;
    setSaving(true);
    try {
      await addOjtPeserta(session.accessToken, batch.id, pesertaDraft);
      setPesertaDraft({ kodePeserta: '', namaLengkap: '', departemen: '', jabatan: '' });
      await reload();
      push({ tone: 'success', title: 'Peserta ditambahkan' });
    } catch (reason) {
      push({
        tone: 'danger',
        title: 'Peserta gagal disimpan',
        description: reason instanceof ApiRequestError ? reason.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleMateri = async (pesertaId: number, materiId: number, current: boolean) => {
    if (!session || !batch) return;
    // Optimistic: the matrix is many small toggles and a round trip each would
    // make it feel broken.
    setBatch((current_) =>
      current_
        ? {
            ...current_,
            peserta: current_.peserta.map((item) =>
              item.id === pesertaId
                ? {
                    ...item,
                    materiSelesai: current
                      ? item.materiSelesai.filter((id_) => id_ !== materiId)
                      : [...item.materiSelesai, materiId],
                  }
                : item,
            ),
          }
        : current_,
    );
    try {
      await setOjtMateriDone(session.accessToken, batch.id, pesertaId, materiId, !current);
    } catch (reason) {
      await reload();
      push({
        tone: 'danger',
        title: 'Progres materi gagal disimpan',
        description: reason instanceof ApiRequestError ? reason.message : undefined,
      });
    }
  };

  const attendanceFor = (item: OjtPesertaDetail, day: string): OjtAttendanceStatus | null => {
    const pending = dirty[item.id];
    if (pending) return pending;
    return item.absensi.find((entry) => entry.tanggal === day)?.status ?? null;
  };

  const cycleAttendance = (item: OjtPesertaDetail, day: string) => {
    const order: OjtAttendanceStatus[] = ['hadir', 'izin', 'tidak_hadir'];
    const current = attendanceFor(item, day);
    const next = order[(order.indexOf(current ?? 'izin') + 1) % order.length];
    setDirty((previous) => ({ ...previous, [item.id]: next }));
  };

  const saveAttendance = async () => {
    if (!session || !batch) return;
    const entries = Object.entries(dirty).flatMap(([pesertaId, status]) =>
      days.map((day) => ({ pesertaId: Number(pesertaId), tanggal: day, status })),
    );
    if (entries.length === 0) {
      setMessage('Tidak ada kehadiran yang berubah.');
      return;
    }
    setSaving(true);
    try {
      await recordOjtAbsensi(session.accessToken, batch.id, entries);
      setDirty({});
      setMessage(`${entries.length} catatan kehadiran disimpan.`);
      await reload();
    } catch (reason) {
      setMessage(reason instanceof ApiRequestError ? reason.message : 'Kehadiran gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const removePeserta = async (item: OjtPesertaDetail) => {
    if (!session) return;
    const ok = await confirm({
      title: `Keluarkan ${item.namaLengkap}?`,
      description: 'Kehadiran, nilai test, dan feedback yang sudah terkumpul tetap tersimpan, tetapi peserta tidak lagi dihitung di batch ini.',
      confirmLabel: 'Keluarkan',
      tone: 'danger',
    });
    if (!ok) return;
    await removeOjtPeserta(session.accessToken, item.id);
    await reload();
  };

  const changeStatus = async (status: 'published' | 'closed') => {
    if (!session || !batch) return;
    const ok = await confirm({
      title: status === 'published' ? 'Terbitkan batch ini?' : 'Tutup batch ini?',
      description:
        status === 'published'
          ? 'Setelah terbit, peserta bisa mengisi assessment lewat QR untuk batch ini.'
          : 'Setelah ditutup, batch tidak bisa menerbitkan QR baru.',
      confirmLabel: status === 'published' ? 'Terbitkan' : 'Tutup',
    });
    if (!ok) return;
    await setOjtBatchStatus(session.accessToken, batch.id, status);
    await reload();
  };

  const makeQr = async (purpose: (typeof QR_PURPOSES)[number]['value']) => {
    if (!session || !batch) return;
    try {
      const created = await createOjtQr(session.accessToken, batch.id, purpose);
      setQr({ purpose, url: created.url });
    } catch (reason) {
      push({
        tone: 'danger',
        title: 'QR gagal dibuat',
        description: reason instanceof ApiRequestError ? reason.message : undefined,
      });
    }
  };

  if (!batch) {
    return (
      <div data-surface="saas">
        {error ? (
        <p role="alert" className="border border-red-500 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      ) : (
        <p className="text-sm text-slate-500">Memuat batch...</p>
      )}
      </div>
    );
  }

  return (
    <div data-surface="saas">
      <Link
        to="/ojt"
        className="text-sm font-semibold text-slate-900 underline underline-offset-4 outline-none transition duration-150 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
      >
        Kembali ke daftar OJT
      </Link>

      <header className="enter-section mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 tabular-nums">{batch.kode}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">{batch.judul}</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {shortDate(batch.tanggalMulai)} – {shortDate(batch.tanggalSelesai)}
            {batch.lokasi ? ` · ${batch.lokasi}` : ''}
          </p>
        </div>
        {batch.status === 'draft' ? (
          <Button type="button" onClick={() => changeStatus('published')}>
            Terbitkan Batch
          </Button>
        ) : batch.status === 'published' ? (
          <Button type="button" variant="secondary" onClick={() => changeStatus('closed')}>
            Tutup Batch
          </Button>
        ) : null}
      </header>

      {message && (
        <p role="status" className="mt-5 border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
          {message}
        </p>
      )}

      <section
        className="enter-section mt-6 grid scroll-mt-6 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        style={{ '--enter-delay': '40ms' } as CSSProperties}
      >
        <StatTile label="Peserta" value={String(stats.peserta)} unit="orang" />
        <StatTile label="Materi selesai" value={`${stats.materiRate}`} unit="%" note={`${batch.materi.length} materi per peserta`} />
        <StatTile label="Kehadiran" value={`${stats.hadirRate}`} unit="%" note={`${days.length} hari kerja`} />
        <StatTile
          label="Rata-rata post-test"
          value={stats.postScore === null ? '-' : String(stats.postScore)}
          unit={stats.postScore === null ? undefined : '%'}
          note={stats.postScore === null ? 'Belum ada jawaban' : undefined}
        />
      </section>

      <Panel title="Tambah Peserta" description="Kode peserta diberikan HR dan dipakai peserta saat membuka assessment." className="enter-section mt-8">
        <div className="grid gap-5 p-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="ojt-kode-peserta" label="Kode peserta" hint="Contoh: OJT-001">
              {(field) => (
                <input
                  value={pesertaDraft.kodePeserta}
                  onChange={(change) => setPesertaDraft((previous) => ({ ...previous, kodePeserta: change.target.value }))}
                  {...field}
                  className={field.className}
                />
              )}
            </Field>
            <Field id="ojt-nama" label="Nama lengkap">
              {(field) => (
                <input
                  value={pesertaDraft.namaLengkap}
                  onChange={(change) => setPesertaDraft((previous) => ({ ...previous, namaLengkap: change.target.value }))}
                  {...field}
                  className={field.className}
                />
              )}
            </Field>
            <Field id="ojt-departemen" label="Departemen" optional>
              {(field) => (
                <input
                  value={pesertaDraft.departemen}
                  onChange={(change) => setPesertaDraft((previous) => ({ ...previous, departemen: change.target.value }))}
                  {...field}
                  className={field.className}
                />
              )}
            </Field>
            <Field id="ojt-jabatan" label="Jabatan" optional>
              {(field) => (
                <input
                  value={pesertaDraft.jabatan}
                  onChange={(change) => setPesertaDraft((previous) => ({ ...previous, jabatan: change.target.value }))}
                  {...field}
                  className={field.className}
                />
              )}
            </Field>
          </div>
          <div>
            <Button
              type="button"
              disabled={saving || !pesertaDraft.kodePeserta.trim() || !pesertaDraft.namaLengkap.trim()}
              onClick={savePeserta}
            >
              {saving ? 'Menyimpan...' : 'Tambah Peserta'}
            </Button>
          </div>
        </div>
      </Panel>

      {batch.peserta.length === 0 ? (
        <div className="mt-8 border border-slate-200 bg-white">
          <EmptyState
            title="Belum ada peserta"
            description="Tambahkan peserta memakai kode dari HR. Kode itulah yang mereka pakai untuk mengisi pre-test, kehadiran, dan post-test."
          />
        </div>
      ) : (
        <>
          <Panel title="Progres Materi" description="Centang materi yang sudah diselesaikan peserta." className="enter-section mt-8">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">Peserta</th>
                    {batch.materi.map((materi) => (
                      <th key={materi.id} scope="col" className="px-2 py-2.5 text-center text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">
                        {materi.kode}
                      </th>
                    ))}
                    <th scope="col" className="px-4 py-2.5 text-right text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">Progres</th>
                    <th scope="col" className="px-4 py-2.5 text-right text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {batch.peserta.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 transition duration-150 last:border-b-0 hover:bg-slate-50">
                      <th scope="row" className="px-4 py-3 text-left">
                        <span className="block text-sm font-medium text-slate-900">{item.namaLengkap}</span>
                        <span className="block text-xs text-slate-500 tabular-nums">{item.kodePeserta}</span>
                      </th>
                      {batch.materi.map((materi) => {
                        const done = item.materiSelesai.includes(materi.id);
                        return (
                          <td key={materi.id} className="px-2 py-3 text-center">
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={done}
                              aria-label={`${materi.kode} untuk ${item.namaLengkap}`}
                              onClick={() => toggleMateri(item.id, materi.id, done)}
                              className={`${CELL} w-9 ${done ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-300 hover:border-slate-900'}`}
                            >
                              {done ? '✓' : ''}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 tabular-nums">
                        {item.materiSelesai.length}/{batch.materi.length}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removePeserta(item)}
                          className="text-xs font-semibold text-slate-900 underline underline-offset-4 outline-none transition duration-150 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                        >
                          Keluarkan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Kehadiran Harian"
            description="Klik sel untuk memutar status: Hadir, Izin, Tidak hadir."
            className="enter-section mt-8"
            action={
              <Button type="button" onClick={saveAttendance} disabled={saving || Object.keys(dirty).length === 0}>
                {saving ? 'Menyimpan...' : 'Simpan Kehadiran'}
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">Peserta</th>
                    {days.map((day) => (
                      <th key={day} scope="col" className="px-2 py-2.5 text-center text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">
                        {weekdayOf(day)}
                        <span className="block text-[10px] font-normal text-slate-400 tabular-nums">{day.slice(8, 10)}</span>
                      </th>
                    ))}
                    <th scope="col" className="px-4 py-2.5 text-right text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase">Hadir</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.peserta.map((item) => {
                    const hadir = days.filter((day) => attendanceFor(item, day) === 'hadir').length;
                    return (
                      <tr key={item.id} className="border-b border-slate-100 transition duration-150 last:border-b-0 hover:bg-slate-50">
                        <th scope="row" className="px-4 py-3 text-left text-sm font-medium text-slate-900">{item.namaLengkap}</th>
                        {days.map((day) => {
                          const status = attendanceFor(item, day);
                          return (
                            <td key={day} className="px-2 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => cycleAttendance(item, day)}
                                aria-label={`${item.namaLengkap}, ${shortDate(day)}: ${status ? ATTENDANCE_LABEL[status] : 'belum dicatat'}`}
                                className={`${CELL} w-9 ${status ? ATTENDANCE_TONE[status] : 'border-dashed border-slate-300 bg-white text-slate-300 hover:border-slate-500'}`}
                              >
                                {status === 'hadir' ? '✓' : status === 'izin' ? 'I' : status === 'tidak_hadir' ? '×' : ''}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 tabular-nums">
                          {hadir}/{days.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      <Panel title="Assessment" description="QR memakai batch ini untuk pre-test, post-test, feedback, dan absensi." className="enter-section mt-8">
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            {QR_PURPOSES.map((purpose) => (
              <Button
                key={purpose.value}
                type="button"
                variant="secondary"
                className="h-9 px-3 text-xs"
                onClick={() => makeQr(purpose.value)}
              >
                QR {purpose.label}
              </Button>
))}
          </div>

          {qr && (
            <div className="enter-qr mt-5 flex flex-wrap items-center gap-4 border border-slate-200 p-4">
              <img
                src={`https://quickchart.io/qr?text=${encodeURIComponent(qr.url)}&size=220`}
                alt={`QR ${qr.purpose}`}
                width={112}
                height={112}
                className="h-28 w-28"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">QR {qr.purpose}</p>
                <p className="mt-1 text-xs break-all text-slate-500">{qr.url}</p>
              </div>
              <CopyButton value={qr.url} />
            </div>
          )}
        </div>
      </Panel>

{results && results.submissions.length > 0 && (
        <Panel
          title="Hasil Post-test"
          description="Nilai akhir peserta pada batch ini, beserta jumlah hari hadir."
          className="enter-section mt-8"
        >
          <ul className="divide-y divide-slate-100">
            {results.submissions
              .filter((item) => item.phase === 'post')
              .map((item) => {
                const hadir = results.attendance.find((row) => row.kodePeserta === item.kodePeserta);
                return (
                  <li key={item.kodePeserta} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-slate-900">{item.name}</span>
                      <span className="block text-xs text-slate-500 tabular-nums">
                        {item.kodePeserta}
                        {hadir ? ` · ${hadir.hariHadir} hari hadir` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums">
                      {item.percentage ?? '-'}%
                    </span>
                  </li>
                );
              })}
          </ul>
        </Panel>
      )}
    </div>
  );
};