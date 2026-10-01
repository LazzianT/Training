import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OjtMateriMaster } from '@training/contracts';
import { ApiRequestError } from '../api/auth.js';
import {
  createOjtMateri,
  fetchOjtMateriMaster,
  moveOjtMateri,
  setOjtMateriAktif,
  updateOjtMateri,
} from '../api/ojt.js';
import { Button, EmptyState, Field, Panel } from '../components/ui/index.js';
import { Modal } from '../components/Modal.js';
import { useToast } from '../components/Toast.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { useAuth } from '../auth/AuthContext.js';

type Draft = { nama: string; deskripsi: string };
const emptyDraft = (): Draft => ({ nama: '', deskripsi: '' });

/**
 * The material catalog, maintained once here so every batch and calendar can
 * just pick from it instead of each planner inventing their own names.
 *
 * Removal is deactivation, never a delete: schedules and completions point at
 * these rows, and that history is the record of what was actually taught.
 */
export const OjtMateriMasterPage = () => {
  const { session } = useAuth();
  const { push } = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState<OjtMateriMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<OjtMateriMaster | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setItems(await fetchOjtMateriMaster(session.accessToken));
    } catch (error) {
      push({
        tone: 'danger',
        title: 'Katalog gagal dimuat',
        description: error instanceof ApiRequestError ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [session, push]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return items.filter((item) => {
      if (!showInactive && !item.aktif) return false;
      if (needle === '') return true;
      return (
        item.nama.toLowerCase().includes(needle) ||
        item.kode.toLowerCase().includes(needle) ||
        (item.deskripsi ?? '').toLowerCase().includes(needle)
      );
    });
  }, [items, term, showInactive]);

  const inactiveCount = useMemo(() => items.filter((item) => !item.aktif).length, [items]);

  const openCreate = () => {
    setDraft(emptyDraft());
    setCreating(true);
    setEditing(null);
  };

  const openEdit = (item: OjtMateriMaster) => {
    setDraft({ nama: item.nama, deskripsi: item.deskripsi ?? '' });
    setEditing(item);
    setCreating(false);
  };

  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
    setDraft(emptyDraft());
  };

  const save = async () => {
    if (!session) return;
    setSaving(true);
    try {
      if (editing) {
        await updateOjtMateri(session.accessToken, editing.id, draft);
        push({ tone: 'success', title: 'Materi diperbarui' });
      } else {
        await createOjtMateri(session.accessToken, draft);
        push({ tone: 'success', title: 'Materi ditambahkan ke katalog' });
      }
      closeDialog();
      await load();
    } catch (error) {
      push({
        tone: 'danger',
        title: 'Materi gagal disimpan',
        description: error instanceof ApiRequestError ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleAktif = async (item: OjtMateriMaster) => {
    if (!session) return;
    const next = !item.aktif;
    if (!next) {
      const ok = await confirm({
        title: `Nonaktifkan ${item.nama}?`,
        description:
          'Materi tidak akan muncul di pilihan jadwal lagi. Jadwal dan riwayat peserta yang sudah ada tetap tersimpan.',
        confirmLabel: 'Nonaktifkan',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setBusyId(item.id);
    try {
      await setOjtMateriAktif(session.accessToken, item.id, next);
      await load();
    } catch (error) {
      push({
        tone: 'danger',
        title: 'Status gagal diubah',
        description: error instanceof ApiRequestError ? error.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  };

  const move = async (item: OjtMateriMaster, direction: 1 | -1) => {
    if (!session) return;
    setBusyId(item.id);
    try {
      await moveOjtMateri(session.accessToken, item.id, direction);
      await load();
    } catch (error) {
      push({
        tone: 'danger',
        title: 'Urutan gagal diubah',
        description: error instanceof ApiRequestError ? error.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  };

  if (!session) return null;

  return (
    <div data-surface="saas">
      <header className="enter-section flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-900">Master Materi OJT</h1>
          <p className="mt-1 text-sm text-slate-500">
            Daftar materi yang dipakai bersama semua batch OJT. Jadwal di tiap batch nanti tinggal memilih dari
            daftar ini.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          Tambah Materi
        </Button>
      </header>

      <div className="enter-section mt-6 flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-xs">
          <Field id="ojt-cari-materi" label="Cari materi">
            {(field) => (
              <input
                value={term}
                onChange={(change) => setTerm(change.target.value)}
                placeholder="Nama, kode, atau deskripsi"
                autoComplete="off"
                {...field}
                className={field.className}
              />
            )}
          </Field>
        </div>
        {inactiveCount > 0 && (
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(change) => setShowInactive(change.target.checked)}
              className="h-4 w-4 accent-slate-900"
            />
            Tampilkan {inactiveCount} materi nonaktif
          </label>
        )}
      </div>

      <div className="enter-section mt-4">
        <Panel
          title="Katalog"
          description="Urutan menentukan urutan materi di kalender. Kode dibuat otomatis."
        >
          {loading ? (
            <p className="p-5 text-sm text-slate-500">Memuat katalog...</p>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={items.length === 0 ? 'Katalog masih kosong' : 'Tidak ada yang cocok'}
              description={
                items.length === 0
                  ? 'Tambahkan materi yang dipakai di OJT. Setelah ada, kalender di tiap batch bisa memilih dari daftar ini.'
                  : 'Coba kata kunci lain, atau tampilkan materi nonaktif.'
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((item, index) => {
                const busy = busyId === item.id;
                return (
                  <li
                    key={item.id}
                    className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition duration-150 hover:bg-slate-50 sm:px-5 ${item.aktif ? '' : 'bg-slate-50/60'}`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 shrink-0 text-xs font-semibold text-slate-400 tabular-nums">
                        {item.kode}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`truncate text-sm font-medium ${item.aktif ? 'text-slate-900' : 'text-slate-500 line-through'}`}
                        >
                          {item.nama}
                        </p>
                        {item.deskripsi && (
                          <p className="mt-0.5 truncate text-xs text-slate-500">{item.deskripsi}</p>
                        )}
                        <p className="mt-1 text-xs text-slate-400 tabular-nums">
                          {item.jadwalCount} jadwal · {item.progresCount} penyelesaian
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Naikkan ${item.nama}`}
                        disabled={busy || index === 0}
                        onClick={() => move(item, -1)}
                        className="flex h-8 w-8 items-center justify-center border border-slate-300 text-slate-700 outline-none transition duration-150 hover:border-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
                          <path d="M3 10l5-5 5 5" strokeLinecap="square" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label={`Turunkan ${item.nama}`}
                        disabled={busy || index === filtered.length - 1}
                        onClick={() => move(item, 1)}
                        className="flex h-8 w-8 items-center justify-center border border-slate-300 text-slate-700 outline-none transition duration-150 hover:border-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
                          <path d="M3 6l5 5 5-5" strokeLinecap="square" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openEdit(item)}
                        className="ml-1 h-8 border border-slate-300 px-2.5 text-xs font-semibold text-slate-900 outline-none transition duration-150 hover:border-slate-900 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                      >
                        Ubah
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggleAktif(item)}
                        className={`h-8 border px-2.5 text-xs font-semibold outline-none transition duration-150 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
                          item.aktif
                            ? 'border-slate-300 text-slate-900 hover:border-red-600 hover:text-red-600'
                            : 'border-slate-900 bg-slate-900 text-white hover:bg-slate-700'
                        }`}
                      >
                        {item.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Modal
        open={creating || editing !== null}
        onClose={closeDialog}
        title={editing ? 'Ubah Materi' : 'Tambah Materi'}
        description="Kode dan urutan dibuat otomatis."
        size="md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeDialog}>
              Batal
            </Button>
            <Button type="button" disabled={saving || !draft.nama.trim()} onClick={save}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </>
        }
      >
        <div className="space-y-5 p-5">
          <Field id="ojt-master-nama" label="Nama materi">
            {(field) => (
              <input
                value={draft.nama}
                onChange={(change) => setDraft({ ...draft, nama: change.target.value })}
                placeholder="Safety Induction"
                autoComplete="off"
                {...field}
                className={field.className}
              />
            )}
          </Field>
          <Field id="ojt-master-deskripsi" label="Deskripsi" optional>
            {(field) => (
              <textarea
                rows={3}
                value={draft.deskripsi}
                onChange={(change) => setDraft({ ...draft, deskripsi: change.target.value })}
                {...field}
                className={field.className}
              />
            )}
          </Field>
        </div>
      </Modal>
    </div>
  );
};
