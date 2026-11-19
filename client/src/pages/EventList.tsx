import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';
import type { EventDetail, EventStatus, EventSummary } from '@training/contracts';
import { EVENT_STATUSES, EVENT_STATUS_LABEL } from '@training/contracts';
import { useAuth } from '../auth/AuthContext.js';
import { createEventQr, fetchEvent, fetchEvents, saveAttendance } from '../api/events.js';
import { ApiRequestError } from '../api/auth.js';
import { EmptyState, inputClass, selectClass } from '../components/ui/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { dayNumber, monthShort, relativeDay, timeRange } from '../lib/date.js';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

type SortKey = 'tgl' | 'judul' | 'pesertaCount' | 'waktuMulai';

const thClass = 'px-3 py-2.5 text-left text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase';
const thRightClass = `${thClass} text-right`;

/** Stagger caps at eight steps so a long month settles as one gesture, not a queue. */
const rowDelay = (index: number) => `${Math.min(index, 8) * 24}ms`;

const matches = (event: EventSummary, needle: string) => {
  if (!needle) return true;
  const haystack = `${event.judul} ${event.ruangNama ?? ''} ${event.pengisiAcara ?? ''}`.toLowerCase();
  return haystack.includes(needle);
};

export const EventList = () => {
  const { session, signOut } = useAuth();
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const [period, setPeriod] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<EventStatus | 'all'>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'tgl', dir: 'asc' });
  const [attendanceEvent, setAttendanceEvent] = useState<EventSummary | null>(null);
  const [attendanceTab, setAttendanceTab] = useState<'qr' | 'manual'>('qr');
  const [qr, setQr] = useState<{ title: string; url: string } | null>(null);
  const [qrLoadingId, setQrLoadingId] = useState<number | null>(null);
  const [qrError, setQrError] = useState('');
  const [manualEvent, setManualEvent] = useState<EventDetail | null>(null);
  const [manualStatuses, setManualStatuses] = useState<Record<string, 'present' | 'absent'>>({});
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manualNotice, setManualNotice] = useState('');

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();

    setLoading(true);
    setError('');
    fetchEvents(session.accessToken, period.year, period.month, controller.signal)
      .then(setEvents)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof ApiRequestError && err.status === 401) {
          signOut();
          return;
        }
        setError(err instanceof ApiRequestError ? err.message : 'Daftar acara gagal dimuat.');
        setEvents([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [period.month, period.year, session, signOut]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = (events ?? []).filter(
      (event) => (status === 'all' || event.status === status) && matches(event, needle),
    );
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.key === 'judul') return a.judul.localeCompare(b.judul, 'id') * factor;
      if (sort.key === 'pesertaCount') return (a.pesertaCount - b.pesertaCount) * factor;
      if (sort.key === 'waktuMulai') return a.waktuMulai.localeCompare(b.waktuMulai) * factor;
      return a.tgl.localeCompare(b.tgl) * factor;
    });
  }, [events, query, status, sort]);

  const stats = useMemo(() => {
    const source = events ?? [];
    return {
      total: source.length,
      peserta: source.reduce((sum, event) => sum + event.pesertaCount, 0),
      byStatus: EVENT_STATUSES.map((value) => ({
        value,
        count: source.filter((event) => event.status === value).length,
      })),
    };
  }, [events]);

  const openAttendance = (event: EventSummary) => {
    setAttendanceEvent(event);
    setAttendanceTab('qr');
    setQr(null);
    setQrError('');
    setManualEvent(null);
    setManualStatuses({});
    setManualError('');
    setManualNotice('');
  };

  const generateAttendanceQr = async () => {
    if (!session || !attendanceEvent || qrLoadingId !== null) return;
    setQrError('');
    setQrLoadingId(attendanceEvent.id);
    try {
      const access = await createEventQr(session.accessToken, attendanceEvent.id, 'attendance');
      if (!access.url || !/^https?:\/\//i.test(access.url)) throw new Error('Tautan QR tidak valid. Periksa alamat aplikasi publik pada konfigurasi server.');
      setQr({ title: attendanceEvent.judul, url: access.url });
    } catch (err) {
      setQrError(err instanceof ApiRequestError ? err.message : 'QR absensi gagal dibuat. Coba lagi.');
    } finally {
      setQrLoadingId(null);
    }
  };

  const openManualAttendance = async () => {
    if (!session || !attendanceEvent || manualLoading) return;
    setAttendanceTab('manual');
    if (manualEvent) return;
    setManualLoading(true);
    setManualError('');
    try {
      const detail = await fetchEvent(session.accessToken, attendanceEvent.id);
      setManualEvent(detail);
      setManualStatuses(Object.fromEntries(detail.participants.flatMap((participant) =>
        participant.attendanceStatus === 'not_recorded' ? [] : [[participant.nip, participant.attendanceStatus]],
      )));
    } catch (err) {
      setManualError(err instanceof ApiRequestError ? err.message : 'Daftar peserta gagal dimuat.');
    } finally {
      setManualLoading(false);
    }
  };

  const saveManualAttendance = async () => {
    if (!session || !attendanceEvent || !manualEvent || manualSaving) return;
    const entries = Object.entries(manualStatuses).map(([nip, status]) => ({ nip, status }));
    if (!entries.length) { setManualError('Pilih status kehadiran minimal satu peserta.'); return; }
    setManualSaving(true);
    setManualError('');
    setManualNotice('');
    try {
      await saveAttendance(session.accessToken, attendanceEvent.id, entries);
      setManualError('');
      setManualNotice('Absensi berhasil disimpan.');
      setManualEvent({ ...manualEvent, participants: manualEvent.participants.map((participant) => ({
        ...participant, attendanceStatus: manualStatuses[participant.nip] ?? participant.attendanceStatus,
      })) });
    } catch (err) {
      setManualError(err instanceof ApiRequestError ? err.message : 'Absensi gagal disimpan. Pilihan tetap tersimpan.');
    } finally {
      setManualSaving(false);
    }
  };

  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'tgl' ? 'asc' : 'desc' },
    );

  const sortIndicator = (key: SortKey) =>
    sort.key === key ? (sort.dir === 'asc' ? '↑' : '↓') : null;

  const sortButtonClass = 'inline-flex items-center gap-1 outline-none transition duration-150 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2';
  const periodLabel = `${MONTH_NAMES[period.month - 1]} ${period.year}`;
  const filtered = query.trim().length > 0 || status !== 'all';

  return (
    <div data-surface="saas">
      <header className="enter-section flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">Daftar Acara</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {events ? `${stats.total} acara pada ${periodLabel}.` : `Seluruh acara training pada ${periodLabel}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Anchored around the two selects alone, so the tour does not also
              light up the create button that happens to sit beside them. */}
          <div data-tour="events.period" className="flex flex-wrap items-center gap-2">
            <label htmlFor="event-month" className="sr-only">
              Pilih bulan
            </label>
            <select
              id="event-month"
              value={period.month}
              onChange={(change) => setPeriod({ ...period, month: Number(change.target.value) })}
              className={selectClass()}
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
            <label htmlFor="event-year" className="sr-only">
              Pilih tahun
            </label>
            <select
              id="event-year"
              value={period.year}
              onChange={(change) => setPeriod({ ...period, year: Number(change.target.value) })}
              className={selectClass()}
            >
              {Array.from({ length: 5 }, (_, index) => today.getFullYear() - 2 + index).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <Link
            to="/events/new"
            data-tour="events.create"
            className="flex h-11 items-center bg-accent px-3.5 text-sm font-semibold text-slate-900 outline-none transition duration-150 hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            Buat Acara
          </Link>
        </div>
      </header>

      {error && (
        <div role="alert" className="mt-6 border border-red-500 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 surface-card">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="border-b border-slate-100 px-4 py-4 last:border-b-0">
              <div className="h-3 w-24 bg-slate-100" />
              <div className="mt-2.5 h-3.5 w-2/3 bg-slate-100" />
            </div>
          ))}
        </div>
      ) : events && events.length === 0 ? (
        <div className="mt-6 surface-card">
          <EmptyState
            title="Belum ada acara"
            description={`Tidak ada acara pada ${periodLabel}. Buat acara pertama untuk memulai.`}
          />
          <div className="border-t border-slate-200 px-6 py-4 text-center">
            <Link
              to="/events/new"
              className="inline-flex h-11 items-center bg-accent px-3.5 text-sm font-semibold text-slate-900 outline-none transition duration-150 hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              Buat acara pertama
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="enter-section mt-6 grid gap-px border border-slate-200 bg-slate-200 sm:grid-cols-3" style={{ '--enter-delay': '40ms' } as CSSProperties}>
            <div className="flex items-baseline justify-between bg-white px-4 py-3">
              <span className="text-xs text-slate-500">Total peserta</span>
              <span className="text-lg font-semibold text-slate-900 tabular-nums">{stats.peserta}</span>
            </div>
            {stats.byStatus
              .filter((entry) => entry.count > 0)
              .slice(0, 2)
              .map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => setStatus(status === entry.value ? 'all' : entry.value)}
                  aria-pressed={status === entry.value}
                  className={`flex items-baseline justify-between px-4 py-3 text-left outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset ${
                    status === entry.value ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-xs ${status === entry.value ? 'text-white/70' : 'text-slate-500'}`}>
                    {EVENT_STATUS_LABEL[entry.value]}
                  </span>
                  <span className="text-lg font-semibold tabular-nums">{entry.count}</span>
                </button>
              ))}
          </div>

          <div data-tour="events.filters" className="enter-section mt-4 flex flex-wrap items-end gap-3" style={{ '--enter-delay': '80ms' } as CSSProperties}>
            <div className="min-w-56 flex-1">
              <label htmlFor="event-search" className="block text-xs font-semibold text-slate-700">
                Cari acara
              </label>
              <input
                id="event-search"
                type="search"
                value={query}
                onChange={(change) => setQuery(change.target.value)}
                placeholder="Judul, ruang, atau pengisi acara"
                className={`${inputClass()} mt-2`}
              />
            </div>
            <div>
              <label htmlFor="event-status" className="block text-xs font-semibold text-slate-700">
                Status
              </label>
              <select
                id="event-status"
                value={status}
                onChange={(change) => setStatus(change.target.value as EventStatus | 'all')}
                className={`${selectClass()} mt-2`}
              >
                <option value="all">Semua status</option>
                {EVENT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {EVENT_STATUS_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setStatus('all');
                }}
                className="mb-0.5 h-11 px-2 text-xs font-semibold text-slate-900 underline underline-offset-4 outline-none transition duration-150 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
              >
                Reset filter
              </button>
            )}
            <p className="mb-2.5 ml-auto text-xs text-slate-500">
              Menampilkan {visible.length} dari {stats.total} acara
            </p>
          </div>

          {visible.length === 0 ? (
            <div className="mt-4 surface-card">
              <EmptyState
                title="Tidak ada acara yang cocok"
                description="Ubah kata kunci atau pilih status lain untuk melihat hasil yang lebih banyak."
              />
            </div>
          ) : (
            <div data-tour="events.table" className="enter-section mt-4 overflow-x-auto surface-card" style={{ '--enter-delay': '120ms' } as CSSProperties}>
              <table className="w-full min-w-[46rem] border-collapse">
                <caption className="sr-only">
                  Daftar acara training pada {periodLabel}, {visible.length} baris.
                </caption>
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-slate-200">
                    <th scope="col" className={thClass}>
                      <button type="button" onClick={() => toggleSort('tgl')} className={sortButtonClass}>
                        Tanggal
                        <span aria-hidden="true" className="text-slate-400">{sortIndicator('tgl')}</span>
                      </button>
                    </th>
                    <th scope="col" className={thClass}>
                      <button type="button" onClick={() => toggleSort('judul')} className={sortButtonClass}>
                        Acara
                        <span aria-hidden="true" className="text-slate-400">{sortIndicator('judul')}</span>
                      </button>
                    </th>
                    <th scope="col" className={thRightClass}>
                      <button type="button" onClick={() => toggleSort('waktuMulai')} className={sortButtonClass}>
                        Waktu
                        <span aria-hidden="true" className="text-slate-400">{sortIndicator('waktuMulai')}</span>
                      </button>
                    </th>
                    <th scope="col" className={thRightClass}>
                      <button type="button" onClick={() => toggleSort('pesertaCount')} className={sortButtonClass}>
                        Peserta
                        <span aria-hidden="true" className="text-slate-400">{sortIndicator('pesertaCount')}</span>
                      </button>
                    </th>
                    <th scope="col" className={thClass}>Status</th>
                    <th scope="col" className={thRightClass}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((event, index) => {
                    const relative = relativeDay(event.tgl);
                    return (
                      <tr
                        key={event.id}
                        className="enter-row border-b border-slate-100 transition duration-150 last:border-b-0 hover:bg-slate-50"
                        style={{ '--enter-delay': rowDelay(index) } as CSSProperties}
                      >
                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <time dateTime={event.tgl} className="block text-sm text-slate-900 tabular-nums">
                            {dayNumber(event.tgl)} <span className="text-slate-500">{monthShort(event.tgl)}</span> {event.tgl.slice(0, 4)}
                          </time>
                          {relative && (
                            <span className="mt-0.5 block text-xs text-slate-500">{relative}</span>
                          )}
                        </td>
                        <td className="max-w-[22rem] px-3 py-3 align-top">
                          <Link
                            to={`/events/${event.id}`}
                            className="block truncate text-sm font-medium text-slate-900 outline-none transition duration-150 hover:underline focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                          >
                            {event.judul}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {event.ruangNama ?? 'Ruang belum ditentukan'}
                            {event.pengisiAcara
                              ? ` · ${event.pengisiAcara}${event.pengisiAcaraType === 'external' ? ' (eksternal)' : ''}`
                              : ' · Pengisi belum ditentukan'}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right align-top text-sm whitespace-nowrap text-slate-900 tabular-nums">
                          {timeRange(event.waktuMulai, event.waktuSelesai)}
                        </td>
                        <td className="px-3 py-3 text-right align-top text-sm text-slate-900 tabular-nums">
                          {event.pesertaCount}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <StatusBadge status={event.status} label={EVENT_STATUS_LABEL[event.status]} />
                        </td>
                        <td className="px-3 py-3 text-right align-top">
                          <div className="flex flex-col items-end gap-2">
                            <button
                              type="button"
                              onClick={() => openAttendance(event)}
                              className="text-xs font-semibold text-slate-900 underline underline-offset-4 outline-none transition duration-150 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                            >
                              Absensi
                            </button>
                            <Link
                              to={`/events/${event.id}/invitation`}
                              className="text-xs font-semibold text-slate-900 underline underline-offset-4 outline-none transition duration-150 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                            >
                              Cetak undangan
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {attendanceEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setAttendanceEvent(null); }}>
          <style>{'@media print { body * { visibility: hidden !important; } #attendance-qr-print, #attendance-qr-print * { visibility: visible !important; } #attendance-qr-print { position: fixed; inset: 0; margin: auto; width: max-content; height: max-content; box-shadow: none; border: 0; } }'}</style>
          <section role="dialog" aria-modal="true" aria-labelledby="attendance-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <header className="flex items-start justify-between gap-4">
              <div><h2 id="attendance-title" className="text-lg font-semibold text-slate-900">Absensi</h2><p className="mt-1 text-sm text-slate-600">{attendanceEvent.judul}</p></div>
              <button type="button" onClick={() => setAttendanceEvent(null)} aria-label="Tutup modal absensi" className="min-h-11 rounded-md border border-slate-300 px-3 text-sm focus-visible:ring-2 focus-visible:ring-slate-900">Tutup</button>
            </header>
            <div role="tablist" aria-label="Metode absensi" className="mt-5 flex border-b border-slate-200">
              <button id="attendance-qr-tab" role="tab" aria-selected={attendanceTab === 'qr'} aria-controls="attendance-qr-panel" onClick={() => setAttendanceTab('qr')} className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${attendanceTab === 'qr' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'}`}>Absen dengan QR Code</button>
              <button id="attendance-manual-tab" role="tab" aria-selected={attendanceTab === 'manual'} aria-controls="attendance-manual-panel" onClick={() => void openManualAttendance()} className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${attendanceTab === 'manual' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'}`}>Absen Manual Catat</button>
            </div>
            {attendanceTab === 'qr' ? (
              <div id="attendance-qr-panel" role="tabpanel" aria-labelledby="attendance-qr-tab" className="py-5 text-center">
                {qr ? <div id="attendance-qr-print"><p className="text-sm text-slate-600">Pindai untuk mengisi absensi peserta.</p><div className="mt-4 flex justify-center"><QRCodeSVG value={qr.url} size={240} level="M" marginSize={4} title={`QR absensi ${qr.title}`} /></div><a href={qr.url} target="_blank" rel="noreferrer" className="mt-4 block break-all text-xs text-slate-600 underline">{qr.url}</a></div> : <p className="text-sm text-slate-600">Buat QR untuk dibagikan atau dicetak.</p>}
                {qrError && <p role="alert" className="mt-3 text-sm text-red-700">{qrError}</p>}
                <button type="button" disabled={qrLoadingId !== null} onClick={() => void generateAttendanceQr()} className="mt-4 min-h-11 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60">{qrLoadingId === attendanceEvent.id ? 'Membuat QR...' : qr ? 'Buat QR Baru' : 'Buat QR Absensi'}</button>
                {qr && <button type="button" onClick={() => window.print()} className="ml-2 min-h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold">Cetak QR</button>}
              </div>
            ) : (
              <div id="attendance-manual-panel" role="tabpanel" aria-labelledby="attendance-manual-tab" className="py-5">
                {manualLoading ? <p role="status" className="text-sm text-slate-600">Memuat peserta...</p> : manualError && !manualEvent ? <p role="alert" className="text-sm text-red-700">{manualError}</p> : manualEvent?.participants.length ? <>
                  <div className="max-h-80 overflow-y-auto rounded-md border border-slate-200">
                    {manualEvent.participants.map((participant) => <div key={participant.nip} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 last:border-0">
                      <div><p className="text-sm font-medium text-slate-900">{participant.name ?? participant.nip}</p><p className="text-xs text-slate-500">{participant.nip}{participant.department ? ` · ${participant.department}` : ''}</p></div>
                      <select aria-label={`Status absensi ${participant.name ?? participant.nip}`} value={manualStatuses[participant.nip] ?? participant.attendanceStatus} onChange={(event) => setManualStatuses((current) => { const next = { ...current }; if (event.target.value === 'not_recorded') delete next[participant.nip]; else next[participant.nip] = event.target.value as 'present' | 'absent'; return next; })} className={selectClass()}>
                        {participant.attendanceStatus === 'not_recorded' && !manualStatuses[participant.nip] && <option value="not_recorded">Belum dicatat</option>}<option value="present">Hadir</option><option value="absent">Tidak hadir</option>
                      </select>
                    </div>)}
                  </div>
                  {manualError && <p role="alert" className="mt-3 text-sm text-red-700">{manualError}</p>}{manualNotice && <p role="status" className="mt-3 text-sm text-green-700">{manualNotice}</p>}
                  <button type="button" disabled={manualSaving} onClick={() => void saveManualAttendance()} className="mt-4 min-h-11 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60">{manualSaving ? 'Menyimpan...' : 'Simpan Absensi'}</button>
                </> : !manualLoading && !manualError ? <p className="text-sm text-slate-600">Belum ada peserta pada acara ini.</p> : null}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
