import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { EventDetail as EventDetailType, EventStatus } from '@training/contracts';
import { EVENT_STATUSES, EVENT_STATUS_LABEL } from '@training/contracts';
import { useAuth } from '../auth/AuthContext.js';
import { addParticipants, fetchEvent, removeParticipant, updateEvent } from '../api/events.js';
import { suggestEmployeesForTraining } from '../api/employees.js';
import { ApiRequestError } from '../api/auth.js';

export const EventDetail = () => {
  const { id } = useParams();
  const { session, signOut } = useAuth();
  const eventId = Number(id);
  const [event, setEvent] = useState<EventDetailType | null>(null);
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [employees, setEmployees] = useState<{ nip: string; name: string; departId: string | null }[]>([]);
  const [suggestions, setSuggestions] = useState<{ nip: string; name: string; departId: string | null; departmentName?: string | null }[]>([]);
  const [refreshSuggestions, setRefreshSuggestions] = useState(0);

  useEffect(() => {
    if (!session || !Number.isInteger(eventId)) return;
    fetchEvent(session.accessToken, eventId).then(setEvent).catch((error: unknown) => {
      if (error instanceof ApiRequestError && error.status === 401) signOut();
      else setMessage('Detail acara gagal dimuat.');
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

  if (!event) return <p className="text-[#55697C]">{message || 'Memuat detail acara...'}</p>;

  const save = async () => {
    if (!session) return;
    setSaving(true); setMessage('');
    try {
      await updateEvent(session.accessToken, event.id, {
        judul: event.judul, tgl: event.tgl, waktuMulai: event.waktuMulai.slice(0, 5), waktuSelesai: event.waktuSelesai.slice(0, 5),
        sasaran: event.sasaran, materiPokok: event.materiPokok, ruangId: event.ruangId, status: event.status,
        pengisiAcara: { type: event.pengisiAcaraType ?? 'external', nip: event.pengisiAcaraNip ?? undefined, name: event.pengisiAcara ?? '' },
      });
      setEdit(false); setMessage('Perubahan tersimpan.');
    } catch (error) { setMessage(error instanceof ApiRequestError ? error.message : 'Gagal menyimpan.'); }
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
      setMessage(`${result.added} peserta ditambahkan${result.skipped ? `, ${result.skipped} dilewati.` : '.'}`);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        signOut();
        return;
      }
      setMessage(error instanceof ApiRequestError ? error.message : 'Peserta gagal ditambahkan.');
    } finally {
      setAdding(false);
    }
  };

  const field = (key: 'judul' | 'tgl' | 'waktuMulai' | 'waktuSelesai' | 'sasaran' | 'materiPokok', value: string) => setEvent({ ...event, [key]: value });
  const remove = async (nip: string, name: string | null) => {
    if (!session || !window.confirm(`Hapus ${name ?? nip} dari acara ini?`)) return;
    setRemoving(nip); setMessage('');
    try {
      await removeParticipant(session.accessToken, event.id, nip);
      setEvent({ ...event, participants: event.participants.filter((participant) => participant.nip !== nip), pesertaCount: Math.max(0, event.pesertaCount - 1) });
      setMessage('Peserta dihapus dari acara.');
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) { signOut(); return; }
      setMessage(error instanceof ApiRequestError ? error.message : 'Peserta gagal dihapus.');
    } finally { setRemoving(null); }
  };
  const existing = new Set(event.participants.map((participant) => participant.nip));

  return <>
    <Link to="/events" className="text-sm text-[#8A5A17] underline underline-offset-4">Kembali ke List Event</Link>
    <header className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b border-[#0A2942]/15 pb-5">
      <div><p className="text-[11px] font-semibold tracking-[0.18em] text-[#8A5A17] uppercase">Detail Acara</p><h1 className="mt-1 text-3xl font-semibold text-[#0A2942]">{event.judul}</h1></div>
      <button type="button" onClick={() => setEdit(!edit)} className="border border-[#0A2942]/25 px-4 py-2.5 text-sm font-semibold text-[#0A2942]">{edit ? 'Tutup Edit' : 'Edit Acara'}</button>
    </header>
    {message && <p className="mt-4 text-sm text-[#8A5A17]">{message}</p>}
    {edit && <section className="mt-6 grid gap-4 border border-[#0A2942]/15 bg-[#FAF8F3] p-5 sm:grid-cols-2">
      <label className="text-sm text-[#55697C]">Judul<input value={event.judul} onChange={(e) => field('judul', e.target.value)} className="mt-1 w-full border border-[#0A2942]/25 bg-white p-2.5 text-[#0A2942]" /></label>
      <label className="text-sm text-[#55697C]">Tanggal<input type="date" value={event.tgl} onChange={(e) => field('tgl', e.target.value)} className="mt-1 w-full border border-[#0A2942]/25 bg-white p-2.5 text-[#0A2942]" /></label>
      <label className="text-sm text-[#55697C]">Mulai<input type="time" value={event.waktuMulai.slice(0, 5)} onChange={(e) => field('waktuMulai', e.target.value)} className="mt-1 w-full border border-[#0A2942]/25 bg-white p-2.5 text-[#0A2942]" /></label>
      <label className="text-sm text-[#55697C]">Selesai<input type="time" value={event.waktuSelesai.slice(0, 5)} onChange={(e) => field('waktuSelesai', e.target.value)} className="mt-1 w-full border border-[#0A2942]/25 bg-white p-2.5 text-[#0A2942]" /></label>
      <label className="text-sm text-[#55697C] sm:col-span-2">Sasaran<textarea value={event.sasaran} onChange={(e) => field('sasaran', e.target.value)} className="mt-1 w-full border border-[#0A2942]/25 bg-white p-2.5 text-[#0A2942]" /></label>
      <label className="text-sm text-[#55697C]">Status<select value={event.status} onChange={(e) => setEvent({ ...event, status: e.target.value as EventStatus })} className="mt-1 w-full border border-[#0A2942]/25 bg-white p-2.5 text-[#0A2942]">{EVENT_STATUSES.map((status) => <option key={status} value={status}>{EVENT_STATUS_LABEL[status]}</option>)}</select></label>
      <button type="button" disabled={saving} onClick={save} className="self-end bg-[#0A2942] px-4 py-2.5 font-semibold text-white">{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
    </section>}
    <section className="mt-6 grid gap-4 sm:grid-cols-3">
      <div className="border border-[#0A2942]/15 bg-[#FAF8F3] p-4"><p className="text-xs uppercase text-[#55697C]">Pengisi Acara</p><p className="mt-2 font-semibold text-[#0A2942]">{event.pengisiAcara ?? '-'}</p><p className="text-xs text-[#8A5A17]">{event.pengisiAcaraType === 'internal' ? 'Internal' : 'Eksternal'}</p></div>
      <div className="border border-[#0A2942]/15 bg-[#FAF8F3] p-4"><p className="text-xs uppercase text-[#55697C]">Waktu</p><p className="mt-2 font-semibold text-[#0A2942]">{event.tgl} · {event.waktuMulai.slice(0, 5)} - {event.waktuSelesai.slice(0, 5)}</p></div>
      <div className="border border-[#0A2942]/15 bg-[#FAF8F3] p-4"><p className="text-xs uppercase text-[#55697C]">Peserta</p><p className="mt-2 text-2xl font-semibold text-[#0A2942]">{event.pesertaCount}</p></div>
    </section>
    <section className="mt-8 border border-[#0A2942]/15 bg-[#FAF8F3] p-5">
       <h2 className="text-xl font-semibold text-[#0A2942]">Tambah Peserta</h2><p className="mt-1 text-sm text-[#55697C]">Rekomendasi hanya menampilkan karyawan yang belum pernah mengikuti training dengan judul mirip.</p>
       <div className="mt-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold tracking-[0.12em] text-[#8A5A17] uppercase">Kandidat rekomendasi</p><button type="button" onClick={() => setRefreshSuggestions((value) => value + 1)} className="border border-[#0A2942]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#0A2942] hover:border-[#D9A441]">Refresh kandidat</button></div>{suggestions.filter((employee) => !existing.has(employee.nip)).length > 0 ? <div className="mt-2 flex flex-wrap gap-2">{suggestions.filter((employee) => !existing.has(employee.nip)).map((employee) => <button key={employee.nip} type="button" onClick={() => setSelected(selected.includes(employee.nip) ? selected.filter((nip) => nip !== employee.nip) : [...selected, employee.nip])} className={`rounded-full border px-3 py-2 text-left text-xs transition-colors ${selected.includes(employee.nip) ? 'border-[#28704A] bg-[#28704A]/10 text-[#28704A]' : 'border-[#0A2942]/20 bg-white text-[#0A2942] hover:border-[#D9A441] hover:bg-[#D9A441]/10'}`}><span className="font-semibold">{employee.name}</span><span className="ml-1 text-[#55697C]">· {employee.departmentName ?? employee.departId ?? 'Departemen belum ada'}</span></button>)}</div> : <p className="mt-2 text-xs text-[#55697C]">Tidak ada kandidat baru.</p>}</div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari NIP atau nama" className="mt-4 w-full border border-[#0A2942]/25 bg-white p-2.5 text-[#0A2942]" />
      <div className="mt-3 max-h-56 overflow-y-auto border border-[#0A2942]/10 bg-white">{employees.filter((employee) => !existing.has(employee.nip)).map((employee) => <label key={employee.nip} className="flex gap-3 border-b border-[#0A2942]/10 px-3 py-2 text-sm"><input type="checkbox" checked={selected.includes(employee.nip)} onChange={() => setSelected(selected.includes(employee.nip) ? selected.filter((nip) => nip !== employee.nip) : [...selected, employee.nip])} /><span className="font-mono text-xs text-[#78716C]">{employee.nip}</span><span>{employee.name}</span></label>)}</div>
      <button type="button" disabled={!selected.length || adding} onClick={add} className="mt-4 bg-[#0A2942] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{adding ? 'Menambahkan...' : `Tambah ${selected.length || ''} Peserta`}</button>
      <div className="mt-6 grid gap-2">{event.participants.map((participant) => <div key={participant.nip} className="flex items-center justify-between gap-3 border-b border-[#0A2942]/10 py-2 text-sm"><div><span className="text-[#0A2942]">{participant.name ?? participant.nip}</span><span className="ml-3 font-mono text-xs text-[#78716C]">{participant.nip}</span></div><button type="button" disabled={removing === participant.nip} onClick={() => remove(participant.nip, participant.name)} className="shrink-0 text-xs font-semibold text-[#B42318] underline underline-offset-2 disabled:opacity-40">{removing === participant.nip ? 'Menghapus...' : 'Hapus'}</button></div>)}</div>
    </section>
  </>;
};
