import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { EventStatus, EventSummary } from '@training/contracts';
import { EVENT_STATUSES, EVENT_STATUS_LABEL } from '@training/contracts';
import { useAuth } from '../auth/AuthContext.js';
import { fetchEvents } from '../api/events.js';
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
            className="flex h-11 items-center bg-slate-900 px-3.5 text-sm font-semibold text-white outline-none transition duration-150 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
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
              className="inline-flex h-11 items-center bg-slate-900 px-3.5 text-sm font-semibold text-white outline-none transition duration-150 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
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
                          <Link
                            to={`/events/${event.id}/invitation`}
                            className="text-xs font-semibold text-slate-900 underline underline-offset-4 outline-none transition duration-150 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                          >
                            Cetak undangan
                          </Link>
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
    </div>
  );
};
