import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { OjtBatch } from '@training/contracts';
import { useAuth } from '../auth/AuthContext.js';
import { ApiRequestError } from '../api/auth.js';
import { createOjtBatch, fetchOjtBatches } from '../api/ojt.js';
import { Button, EmptyState, Field, Panel, textareaClass } from '../components/ui/index.js';
import { useToast } from '../components/Toast.js';
import { shortDate } from '../lib/date.js';

const STATUS_LABEL = { draft: 'Draft', published: 'Diterbitkan', closed: 'Ditutup' } as const;
const STATUS_TONE = {
  draft: 'border-slate-200 bg-slate-50 text-slate-700',
  published: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  closed: 'border-slate-300 bg-white text-slate-500',
} as const;

const OjtStatusBadge = ({ status }: { status: OjtBatch['status'] }) => (
  <span className={`inline-block whitespace-nowrap border px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] uppercase ${STATUS_TONE[status]}`}>
    {STATUS_LABEL[status]}
  </span>
);

type Errors = Record<string, string | undefined>;

/** Five working days from the start date, so a one-week OJT is one click. */
const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const mondayOfWeek = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date.toISOString().slice(0, 10);
};

export const OjtList = () => {
  const { session, signOut } = useAuth();
  const { push } = useToast();
  const today = new Date();
  const [batches, setBatches] = useState<OjtBatch[] | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const [form, setForm] = useState({
    kode: `OJT-${today.getFullYear()}-01`,
    judul: '',
    tanggalMulai: mondayOfWeek(today.toISOString().slice(0, 10)),
    tanggalSelesai: addDays(mondayOfWeek(today.toISOString().slice(0, 10)), 4),
    lokasi: '',
    catatan: '',
  });

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    setError('');
    fetchOjtBatches(session.accessToken, controller.signal)
      .then(setBatches)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        if (reason instanceof ApiRequestError && reason.status === 401) return signOut();
        setBatches([]);
        setError(reason instanceof ApiRequestError ? reason.message : 'Batch OJT gagal dimuat.');
      });
    return () => controller.abort();
  }, [session, signOut]);

  const set = (key: keyof typeof form, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;
    setSaving(true);
    setFormError('');
    setErrors({});
    try {
      const batch = await createOjtBatch(session.accessToken, form);
      setBatches((current) => [batch, ...(current ?? [])]);
      setCreating(false);
      push({ tone: 'success', title: `Batch ${batch.kode} dibuat`, description: 'Tambahkan peserta untuk memulai.' });
      setForm((previous) => ({
        ...previous,
        judul: '',
        lokasi: '',
        catatan: '',
        kode: `OJT-${today.getFullYear()}-${String((batches?.length ?? 0) + 2).padStart(2, '0')}`,
      }));
    } catch (reason) {
      if (reason instanceof ApiRequestError && reason.status === 401) return signOut();
      const details = reason instanceof ApiRequestError ? reason.details : undefined;
      const flat: Errors = {};
      for (const [field, messages] of Object.entries(details ?? {})) {
        const first = Array.isArray(messages) ? messages[0] : undefined;
        if (first) flat[field] = first;
      }
      setErrors(flat);
      const root = details?._root?.[0];
      setFormError(Object.keys(flat).length === 0 ? (root ?? (reason instanceof Error ? reason.message : 'Batch gagal disimpan.')) : '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-surface="saas">
      <header className="enter-section flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">OJT</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            On Job Training untuk karyawan baru yang belum terdaftar di HRIS.
          </p>
        </div>
        <Button type="button" onClick={() => setCreating((value) => !value)} aria-expanded={creating}>
          {creating ? 'Tutup' : 'Buat Batch'}
        </Button>
      </header>

      {creating && (
        <Panel title="Batch Baru" description="Periode default lima hari kerja." className="enter-section mt-6">
          <form onSubmit={submit} className="grid gap-5 p-5 sm:p-7" noValidate>
            {formError && (
              <div role="alert" className="border border-red-500 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {formError}
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="ojt-kode" label="Kode batch" error={errors.kode}>
                {(field) => (
                  <input
                    value={form.kode}
                    onChange={(change) => set('kode', change.target.value)}
                    placeholder="OJT-2026-01"
                    {...field}
                    className={field.className}
                  />
                )}
              </Field>
              <Field id="ojt-lokasi" label="Lokasi" optional error={errors.lokasi}>
                {(field) => (
                  <input
                    value={form.lokasi}
                    onChange={(change) => set('lokasi', change.target.value)}
                    placeholder="Kantin Lt. 3"
                    {...field}
                    className={field.className}
                  />
                )}
              </Field>
            </div>
            <Field id="ojt-judul" label="Judul" error={errors.judul}>
              {(field) => (
                <input
                  value={form.judul}
                  onChange={(change) => set('judul', change.target.value)}
                  placeholder="OJT wavedeck produksi"
                  {...field}
                  className={field.className}
                />
              )}
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="ojt-mulai" label="Tanggal mulai" error={errors.tanggalMulai}>
                {(field) => (
                  <input
                    type="date"
                    value={form.tanggalMulai}
                    onChange={(change) => {
                      const start = change.target.value;
                      setForm((previous) => ({ ...previous, tanggalMulai: start, tanggalSelesai: addDays(start, 4) }));
                    }}
                    {...field}
                    className={field.className}
                  />
                )}
              </Field>
              <Field id="ojt-selesai" label="Tanggal selesai" error={errors.tanggalSelesai}>
                {(field) => (
                  <input
                    type="date"
                    value={form.tanggalSelesai}
                    min={form.tanggalMulai}
                    onChange={(change) => set('tanggalSelesai', change.target.value)}
                    {...field}
                    className={field.className}
                  />
                )}
              </Field>
            </div>
            <Field id="ojt-catatan" label="Catatan" optional error={errors.catatan}>
              {(field) => (
                <textarea
                  value={form.catatan}
                  onChange={(change) => set('catatan', change.target.value)}
                  {...field}
                  className={textareaClass()}
                />
              )}
            </Field>
            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-5">
              <Button type="submit" disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan Batch'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                Batal
              </Button>
            </div>
          </form>
        </Panel>
      )}

      {error && (
        <div role="alert" className="mt-6 border border-red-500 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {batches === null ? (
        <div className="mt-6 grid gap-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="surface-card p-5">
              <div className="h-3 w-28 bg-slate-100" />
              <div className="mt-2.5 h-4 w-2/3 bg-slate-100" />
            </div>
          ))}
        </div>
      ) : batches.length === 0 ? (
        <div className="mt-6 surface-card">
          <EmptyState
            title="Belum ada batch OJT"
            description="Buat batch pertama untuk mulai mencatat peserta, materi, dan kehadiran karyawan baru."
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {batches.map((batch, index) => (
            <Link
              key={batch.id}
              to={`/ojt/${batch.id}`}
              className="enter-section block surface-card p-5 outline-none transition duration-150 hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
              style={{ '--enter-delay': `${Math.min(index, 6) * 40}ms` } as CSSProperties}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <OjtStatusBadge status={batch.status} />
                    <span className="text-xs text-slate-500 tabular-nums">{batch.kode}</span>
                  </div>
                  <p className="mt-2 text-base font-semibold tracking-[-0.02em] text-slate-900">{batch.judul}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {shortDate(batch.tanggalMulai)}  {shortDate(batch.tanggalSelesai)}
                    {batch.lokasi ? `  ${batch.lokasi}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-right text-xs text-slate-500">
                  <span className="block text-lg font-semibold text-slate-900 tabular-nums">{batch.pesertaCount}</span>
                  peserta
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
