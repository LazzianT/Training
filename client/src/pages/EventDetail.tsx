import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { EventDetail as EventDetailType, EventStatus } from '@training/contracts';
import { EVENT_STATUSES, EVENT_STATUS_LABEL } from '@training/contracts';
import { useAuth } from '../auth/AuthContext.js';
import { addParticipants, fetchEvent, removeParticipant, updateEvent } from '../api/events.js';
import { suggestEmployeesForTraining } from '../api/employees.js';
import { ApiRequestError } from '../api/auth.js';
import { Button, Field, Panel, inputClass, selectClass, textareaClass } from '../components/ui/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { EmptyState } from '../components/ui/index.js';
import { useConfirm } from '../components/ConfirmDialog.js';

const checkboxClass =
  'h-4 w-4 shrink-0 rounded-none accent-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2';

export const EventDetail = () => {
  const { id } = useParams();
  const { session, signOut } = useAuth();
  const confirm = useConfirm();
  const eventId = Number(id);
  const [event, setEvent] = useState<EventDetailType | null>(null);
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'info' | 'error'>('info');
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [employees, setEmployees] = useState<{ nip: string; name: string; departId: string | null }[]>([]);
  const [suggestions, setSuggestions] = useState<{ nip: string; name: string; departId: string | null; departmentName?: string | null }[]>([]);
  const [refreshSuggestions, setRefreshSuggestions] = useState(0);

  const notify = (text: string, kind: 'info' | 'error' = 'info') => {
    setMessage(text);
    setTone(kind);
  };

  useEffect(() => {
    if (!session || !Number.isInteger(eventId)) return;
    fetchEvent(session.accessToken, eventId).then(setEvent).catch((error: unknown) => {
      if (error instanceof ApiRequestError && error.status === 401) signOut();
      else notify('Detail acara gagal dimuat.', 'error');
    });
  }, [eventId, session, signOut]);

  useEffect(() => {
    if (!session || query.trim().length < 1) { setEmployees([]); return; }
    const controller = new AbortController();
    suggestEmployeesForTraining(session.accessToken, event?.judul ?? '', query, controller.signal).then(setEmployees).catch(() => undefined);
    return () => controller.abort();
  }, [event?.judul, query, session]);

  useEffect(() => {
    if (!session || !event?.judul) return;
    const controller = new AbortController();
    suggestEmployeesForTraining(session.accessToken, event.judul, '', controller.signal)
      .then((items) => {
        const departments = new Set<string>();
        setSuggestions(items.filter((item) => {
          const department = item.departId ?? 'unknown';
          if (departments.has(department)) return false;
          departments.add(department);
          return true;
        }).slice(0, 7));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [event?.judul, refreshSuggestions, session]);

  if (!event) {
    return (
      <div data-surface="saas">
        <p className={tone === 'error' ? 'border border-red-500 bg-red-50 px-3 py-2.5 text-sm text-red-700' : 'text-sm text-slate-500'}>
          {message || 'Memuat detail acara...'}
        </p>
      </div>
    );
  }

  const save = async () => {
    if (!session) return;
    setSaving(true); setMessage('');
    try {
      await updateEvent(session.accessToken, event.id, {
        judul: event.judul, tgl: event.tgl, waktuMulai: event.waktuMulai.slice(0, 5), waktuSelesai: event.waktuSelesai.slice(0, 5),
        sasaran: event.sasaran, materiPokok: event.materiPokok, ruangId: event.ruangId, status: event.status,
        pengisiAcara: { type: event.pengisiAcaraType ?? 'external', nip: event.pengisiAcaraNip ?? undefined, name: event.pengisiAcara ?? '' },
      });
      setEdit(false); notify('Perubahan tersimpan.');
    } catch (error) { notify(error instanceof ApiRequestError ? error.message : 'Gagal menyimpan.', 'error'); }
    finally { setSaving(false); }
  };

  const add = async () => {
    if (!session || selected.length === 0) return;
    setAdding(true); setMessage('');
    try {
      const result = await addParticipants(session.accessToken, event.id, selected);
      const added = selected
        .filter((nip) => !event.participants.some((participant) => participant.nip === nip))
        .map((nip) => {
          const employee = employees.find((item) => item.nip === nip);
          return { nip, name: employee?.name ?? nip, department: employee?.departId ?? null };
        });
      setEvent({ ...event, participants: [...event.participants, ...added], pesertaCount: event.pesertaCount + result.added });
      setSelected([]);
      notify(`${result.added} peserta ditambahkan${result.skipped ? `, ${result.skipped} dilewati.` : '.'}`);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        signOut();
        return;
      }
      notify(error instanceof ApiRequestError ? error.message : 'Peserta gagal ditambahkan.', 'error');
    } finally {
      setAdding(false);
    }
  };

  const field = (key: 'judul' | 'tgl' | 'waktuMulai' | 'waktuSelesai' | 'sasaran' | 'materiPokok', value: string) => setEvent({ ...event, [key]: value });
  const remove = async (nip: string, name: string | null) => {
    if (!session) return;
    const ok = await confirm({
      title: 'Hapus peserta dari acara?',
      description: `${name ?? nip} akan dikeluarkan dari daftar peserta acara ini. Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: 'Hapus peserta',
      tone: 'danger',
    });
    if (!ok) return;
    setRemoving(nip); setMessage('');
    try {
      await removeParticipant(session.accessToken, event.id, nip);
      setEvent({ ...event, participants: event.participants.filter((participant) => participant.nip !== nip), pesertaCount: Math.max(0, event.pesertaCount - 1) });
      notify('Peserta dihapus dari acara.');
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) { signOut(); return; }
      notify(error instanceof ApiRequestError ? error.message : 'Peserta gagal dihapus.', 'error');
    } finally { setRemoving(null); }
  };
  const existing = new Set(event.participants.map((participant) => participant.nip));
  const candidates = employees.filter((employee) => !existing.has(employee.nip));
  const openSuggestions = suggestions.filter((employee) => !existing.has(employee.nip));

  return (
    <div data-surface="saas">
      <Link
        to="/events"
        className="text-sm font-semibold text-slate-900 underline underline-offset-4 outline-none transition duration-150 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
      >
        Kembali ke Daftar Acara
      </Link>

      <header className="enter-section mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusBadge status={event.status} label={EVENT_STATUS_LABEL[event.status]} />
          </div>
          <h1 className="mt-2.5 text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">
            {event.judul}
          </h1>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setEdit(!edit)}
          aria-expanded={edit}
        >
          {edit ? 'Tutup Edit' : 'Edit Acara'}
        </Button>
      </header>

      {message && (
        <div
          role={tone === 'error' ? 'alert' : 'status'}
          className={
            tone === 'error'
              ? 'mt-6 border border-red-500 bg-red-50 px-3 py-2.5 text-sm text-red-700'
              : 'mt-6 border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700'
          }
        >
          {message}
        </div>
      )}

      {edit && (
        <Panel title="Ubah Data Acara" className="mt-6">
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <Field id="edit-judul" label="Judul">
              {(f) => (
                <input value={event.judul} onChange={(e) => field('judul', e.target.value)} {...f} className={f.className} />
              )}
            </Field>
            <Field id="edit-tgl" label="Tanggal">
              {(f) => (
                <input type="date" value={event.tgl} onChange={(e) => field('tgl', e.target.value)} {...f} className={f.className} />
              )}
            </Field>
            <Field id="edit-mulai" label="Mulai">
              {(f) => (
                <input type="time" value={event.waktuMulai.slice(0, 5)} onChange={(e) => field('waktuMulai', e.target.value)} {...f} className={f.className} />
              )}
            </Field>
            <Field id="edit-selesai" label="Selesai">
              {(f) => (
                <input type="time" value={event.waktuSelesai.slice(0, 5)} onChange={(e) => field('waktuSelesai', e.target.value)} {...f} className={f.className} />
              )}
            </Field>
            <div className="sm:col-span-2">
              <Field id="edit-sasaran" label="Sasaran">
                {(f) => (
                  <textarea value={event.sasaran} onChange={(e) => field('sasaran', e.target.value)} {...f} className={textareaClass()} />
                )}
              </Field>
            </div>
            <Field id="edit-status" label="Status">
              {(f) => (
                <select
                  value={event.status}
                  onChange={(e) => setEvent({ ...event, status: e.target.value as EventStatus })}
                  {...f}
                  className={selectClass()}
                >
                  {EVENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {EVENT_STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div className="flex items-end">
              <Button type="button" disabled={saving} onClick={save}>
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </div>
          </div>
        </Panel>
      )}

      <section className="enter-section mt-6 grid gap-4 sm:grid-cols-3" style={{ '--enter-delay': '60ms' } as React.CSSProperties}>
        <div className="border border-slate-200 bg-white px-4 py-4">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">Pengisi acara</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{event.pengisiAcara ?? '-'}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {event.pengisiAcaraType === 'internal' ? 'Internal' : 'Eksternal'}
          </p>
        </div>
        <div className="border border-slate-200 bg-white px-4 py-4">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">Waktu</p>
          <p className="mt-2 text-sm font-semibold text-slate-900 tabular-nums">
            {event.tgl} · {event.waktuMulai.slice(0, 5)} – {event.waktuSelesai.slice(0, 5)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{event.ruangNama ?? 'Ruang belum ditentukan'}</p>
        </div>
        <div className="border border-slate-200 bg-white px-4 py-4">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">Peserta</p>
          <p className="mt-2 text-3xl leading-none font-semibold text-slate-900 tabular-nums">{event.pesertaCount}</p>
        </div>
      </section>

      <Panel
        title="Tambah Peserta"
        description="Rekomendasi hanya menampilkan karyawan yang belum pernah mengikuti training dengan judul mirip."
        className="enter-section mt-8"
      >
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-700">Kandidat rekomendasi</p>
            <Button
              type="button"
              variant="secondary"
              className="h-9 px-3 text-xs"
              onClick={() => setRefreshSuggestions((value) => value + 1)}
            >
              Refresh kandidat
            </Button>
          </div>
          {openSuggestions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {openSuggestions.map((employee) => {
                const isPicked = selected.includes(employee.nip);
                return (
                  <button
                    key={employee.nip}
                    type="button"
                    aria-pressed={isPicked}
                    onClick={() =>
                      setSelected(isPicked ? selected.filter((nip) => nip !== employee.nip) : [...selected, employee.nip])
                    }
                    className={`border px-3 py-2 text-left text-xs outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
                      isPicked
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-900 hover:border-slate-900'
                    }`}
                  >
                    <span className="font-semibold">{employee.name}</span>
                    <span className={`ml-1 ${isPicked ? 'text-white/70' : 'text-slate-500'}`}>
                      · {employee.departmentName ?? employee.departId ?? 'Departemen belum ada'}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Tidak ada kandidat baru.</p>
          )}
        </div>

        <div className="p-5">
          <Field id="participant-search" label="Cari peserta" hint="Cari berdasarkan NIP atau nama karyawan.">
            {(f) => (
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari NIP atau nama"
                {...f}
                className={inputClass()}
              />
            )}
          </Field>

          {candidates.length > 0 ? (
            <ul className="mt-4 max-h-56 overflow-y-auto border border-slate-200">
              {candidates.map((employee) => (
                <li key={employee.nip}>
                  <label className="flex items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-sm text-slate-900 transition duration-150 last:border-b-0 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      checked={selected.includes(employee.nip)}
                      onChange={() =>
                        setSelected(
                          selected.includes(employee.nip)
                            ? selected.filter((nip) => nip !== employee.nip)
                            : [...selected, employee.nip],
                        )
                      }
                    />
                    <span className="text-xs text-slate-500 tabular-nums">{employee.nip}</span>
                    <span>{employee.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
              {query.trim().length < 1
                ? 'Ketik NIP atau nama untuk mencari karyawan yang bisa ditambahkan.'
                : 'Tidak ada karyawan yang cocok dengan pencarian ini.'}
            </p>
          )}

          <div className="mt-5">
            <Button type="button" disabled={!selected.length || adding} onClick={add}>
              {adding ? 'Menambahkan...' : selected.length ? `Tambah ${selected.length} Peserta` : 'Tambah Peserta'}
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Daftar Peserta" description={`${event.participants.length} peserta terdaftar.`} className="mt-8">
        {event.participants.length === 0 ? (
          <EmptyState
            title="Belum ada peserta"
            description="Belum ada karyawan yang ditambahkan ke acara ini. Gunakan pencarian di atas untuk menambahkan peserta."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {event.participants.map((participant) => (
              <li
                key={participant.nip}
                className="flex items-center justify-between gap-3 px-5 py-3 transition duration-150 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-900">{participant.name ?? participant.nip}</p>
                  <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                    {participant.nip}
                    {participant.department ? ` · ${participant.department}` : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  className="h-9 shrink-0 px-3 text-xs"
                  disabled={removing === participant.nip}
                  onClick={() => remove(participant.nip, participant.name)}
                >
                  {removing === participant.nip ? 'Menghapus...' : 'Hapus'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};
