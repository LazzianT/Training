import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { OjtBatchDetail, OjtPesertaDetail } from '@training/contracts';
import { ApiRequestError } from '../api/auth.js';
import {
  addOjtPeserta,
  createOjtJadwal,
  createOjtQr,
  deleteOjtJadwal,
  fetchOjtBatch,
  fetchOjtResults,
  removeOjtPeserta,
  setOjtBatchStatus,
  updateOjtJadwal,
} from '../api/ojt.js';
import { OjtJadwalCalendar, type JadwalFormInput } from '../components/OjtJadwalCalendar.js';
import { Button, EmptyState, Field, Panel, StatTile } from '../components/ui/index.js';
import { CopyButton, useToast } from '../components/Toast.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { Modal } from '../components/Modal.js';
import { useAuth } from '../auth/AuthContext.js';
import type { OjtResults } from '@training/contracts';
import { shortDate } from '../lib/date.js';

const QR_PURPOSES = [
  { value: 'pre_test', label: 'Pre-test' },
  { value: 'post_test', label: 'Post-test' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'attendance', label: 'Absensi' },
] as const;

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


export const OjtBatchPage = () => {
  const { batchId } = useParams();
  const id = Number(batchId);
  const { session, signOut } = useAuth();
  const { push } = useToast();
  const confirm = useConfirm();

  const [batch, setBatch] = useState<OjtBatchDetail | null>(null);
  const [results, setResults] = useState<OjtResults | null>(null);
  const [error, setError] = useState('');
  const [qr, setQr] = useState<{ purpose: string; url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingPeserta, setAddingPeserta] = useState(false);
  const [pesertaDraft, setPesertaDraft] = useState({ namaLengkap: '' });

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

const submitPeserta = async () => {
    if (!session || !batch) return;
    setSaving(true);
    try {
      const created = await addOjtPeserta(session.accessToken, batch.id, pesertaDraft);
      setPesertaDraft({ namaLengkap: '' });
      setAddingPeserta(false);
      await reload();
      push({
        tone: 'success',
        title: `${created.kodePeserta} dibuat`,
        description: 'Berikan kode ini kepada peserta untuk mengisi assessment.',
      });
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

  const saveJadwal = async (tanggal: string, form: JadwalFormInput) => {
    if (!session || !batch) return;
    await createOjtJadwal(session.accessToken, batch.id, {
      tanggal,
      namaMateri: form.namaMateri,
      jamMulai: form.jamMulai || null,
      jamSelesai: form.jamSelesai || null,
      pengisiNip: form.pengisiNip || null,
      catatan: form.catatan || null,
    });
    await reload();
  };

  const editJadwal = async (jadwalId: number, form: Partial<JadwalFormInput>) => {
    if (!session) return;
    await updateOjtJadwal(session.accessToken, jadwalId, {
      namaMateri: form.namaMateri,
      jamMulai: form.jamMulai || null,
      jamSelesai: form.jamSelesai || null,
      pengisiNip: form.pengisiNip || null,
      catatan: form.catatan || null,
    });
    await reload();
  };

  const dropJadwal = async (jadwalId: number) => {
    if (!session) return;
    const ok = await confirm({
      title: 'Hapus materi ini dari jadwal?',
      description: 'Jadwal di tanggal itu dihapus. Materi tetap ada di katalog dan bisa dijadwalkan lagi.',
      confirmLabel: 'Hapus',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteOjtJadwal(session.accessToken, jadwalId);
    await reload();
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

  if (!batch || !session) {
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

{/*
        The list is the point of this screen, so it leads and the add form lives
        in a dialog. A full width panel for a single text field pushed the list
        below the fold and read as the main task.
      */}
      <Panel
        title="Peserta"
        description="Kode dibuat otomatis. Berikan kode ini kepada peserta untuk mengisi assessment."
        className="enter-section mt-8"
        action={
          <Button type="button" className="h-9 px-3 text-xs" onClick={() => setAddingPeserta(true)}>
            Tambah Peserta
          </Button>
        }
      >
        {batch.peserta.length === 0 ? (
          <EmptyState
            title="Belum ada peserta"
            description="Tambahkan peserta satu per satu. Sistem membuat kode otomatis yang dipakai peserta saat membuka assessment."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {batch.peserta.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition duration-150 hover:bg-slate-50 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{item.namaLengkap}</p>
                  <p className="mt-0.5 text-xs text-slate-500 tabular-nums">{item.kodePeserta}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs text-slate-500">
                  <span className="tabular-nums">
                    {item.materiSelesai.length}/{batch.materi.length} materi
                  </span>
                  <span className="tabular-nums">
                    {item.absensi.filter((entry) => entry.status === 'hadir').length}/{days.length} hari
                  </span>
                  <button
                    type="button"
                    onClick={() => removePeserta(item)}
                    className="font-semibold text-slate-900 underline underline-offset-4 outline-none transition duration-150 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                  >
                    Keluarkan
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal
        open={addingPeserta}
        onClose={() => setAddingPeserta(false)}
        title="Tambah Peserta"
        description="Cukup nama. Kode peserta dibuat otomatis oleh sistem."
        size="md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setAddingPeserta(false)}>
              Batal
            </Button>
            <Button type="button" disabled={saving || !pesertaDraft.namaLengkap.trim()} onClick={submitPeserta}>
              {saving ? 'Menyimpan...' : 'Tambah'}
            </Button>
          </>
        }
      >
        <div className="p-5">
          <Field id="ojt-nama" label="Nama lengkap">
            {(field) => (
              <input
                value={pesertaDraft.namaLengkap}
                onChange={(change) => setPesertaDraft({ namaLengkap: change.target.value })}
                placeholder="Nama sesuai KTP"
                autoComplete="off"
                {...field}
                className={field.className}
              />
            )}
          </Field>
        </div>
</Modal>


      <OjtJadwalCalendar
        token={session.accessToken}
        tanggalMulai={batch.tanggalMulai}
        tanggalSelesai={batch.tanggalSelesai}
        materi={batch.materi}
        jadwal={batch.jadwal ?? []}
        onCreate={saveJadwal}
        onUpdate={editJadwal}
        onDelete={dropJadwal}
      />

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
