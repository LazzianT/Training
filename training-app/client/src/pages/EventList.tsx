import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { EventSummary } from '@training/contracts';
import { EVENT_STATUS_LABEL } from '@training/contracts';
import { useAuth } from '../auth/AuthContext.js';
import { fetchEvents } from '../api/events.js';
import { ApiRequestError } from '../api/auth.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const formatTanggal = (iso: string) => {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`;
};

const formatWaktu = (value: string) => value.slice(0, 5);

const Status = ({ status }: { status: EventSummary['status'] }) => (
  <span className="inline-block border border-[#0A2942]/25 px-1.5 py-0.5 text-[10.5px] font-semibold tracking-[0.1em] text-[#0A2942] uppercase">
    {EVENT_STATUS_LABEL[status]}
  </span>
);

export const EventList = () => {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const [period, setPeriod] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();

    setLoading(true);
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

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
         <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold text-[#0A2942]">List Event</h1>
          <p className="mt-1.5 text-[14px] text-[#55697C]">Seluruh acara training yang tercatat.</p>
        </div>
         <div className="flex flex-wrap items-center gap-2">
         <select value={period.month} onChange={(event) => setPeriod({ ...period, month: Number(event.target.value) })} className="border border-[#0A2942]/20 bg-[#FAF8F3] px-3 py-2.5 text-sm text-[#0A2942]">
           {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
         </select>
         <select value={period.year} onChange={(event) => setPeriod({ ...period, year: Number(event.target.value) })} className="border border-[#0A2942]/20 bg-[#FAF8F3] px-3 py-2.5 text-sm text-[#0A2942]">
           {Array.from({ length: 5 }, (_, index) => today.getFullYear() - 2 + index).map((year) => <option key={year} value={year}>{year}</option>)}
         </select>
         <Link
          to="/events/new"
          className="bg-[#0A2942] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#16405F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A5A17]"
         >
           Input New Event
         </Link>
         </div>
      </header>

      {error && (
        <div
          role="alert"
          className="mt-6 border-l-2 border-[#B42318] bg-[#B42318]/8 py-2.5 pl-3.5 pr-3 text-[13.5px] text-[#8A1C14]"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 grid gap-px bg-[#0A2942]/12">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="bg-[#EFEAE0] px-4 py-5">
              <div className="h-3.5 w-2/3 bg-[#0A2942]/10" />
            </div>
          ))}
        </div>
      ) : events && events.length === 0 ? (
        <div className="mt-8 flex flex-col items-start gap-2 border border-dashed border-[#0A2942]/20 px-5 py-8">
          <p className="text-[14.5px] font-semibold text-[#0A2942]">Belum ada acara</p>
           <p className="max-w-md text-[13px] leading-relaxed text-[#55697C]">
             Tidak ada acara pada {MONTH_NAMES[period.month - 1]} {period.year}.
          </p>
          <Link
            to="/events/new"
            className="mt-3 text-[13.5px] text-[#0A2942] underline decoration-dotted underline-offset-4"
          >
            Buat acara pertama
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3">
          {events?.map((event) => (
            <li key={event.id} role="link" tabIndex={0} onClick={() => navigate(`/events/${event.id}`)} onKeyDown={(keyboardEvent) => { if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') { keyboardEvent.preventDefault(); navigate(`/events/${event.id}`); } }} className="cursor-pointer border border-[#0A2942]/15 bg-[#F7F3EB] px-5 py-5 shadow-[0_2px_0_rgba(10,41,66,0.08)] transition-colors hover:border-[#8A5A17]/60 focus-visible:outline-2 focus-visible:outline-[#8A5A17] sm:px-6">
              <div className="flex gap-4">
                <time className="hidden w-16 shrink-0 border-r border-[#0A2942]/15 pr-4 text-center sm:block" dateTime={event.tgl}>
                  <span className="block text-[12px] font-semibold tracking-[0.12em] text-[#8A5A17] uppercase">{MONTHS[Number(event.tgl.slice(5, 7)) - 1]}</span>
                  <span className="mt-1 block text-3xl font-semibold leading-none text-[#0A2942]">{event.tgl.slice(8, 10)}</span>
                  <span className="mt-1 block text-[11px] text-[#55697C]">{event.tgl.slice(0, 4)}</span>
                </time>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-medium tracking-[0.1em] text-[#8A5A17] uppercase">{formatTanggal(event.tgl)}</p>
                      <h2 className="mt-1 text-lg font-semibold leading-tight text-[#0A2942]">{event.judul}</h2>
                    </div>
                    <Status status={event.status} />
                  </div>
                  <dl className="mt-4 grid gap-2 border-t border-[#0A2942]/10 pt-3 text-[13px] text-[#55697C] sm:grid-cols-3">
                    <div><dt className="text-[10px] font-semibold tracking-[0.12em] uppercase">Waktu</dt><dd className="mt-0.5 text-[#0A2942] tabular-nums">{formatWaktu(event.waktuMulai)} - {formatWaktu(event.waktuSelesai)}</dd></div>
                    <div><dt className="text-[10px] font-semibold tracking-[0.12em] uppercase">Ruangan</dt><dd className="mt-0.5 text-[#0A2942]">{event.ruangNama ?? 'Belum ditentukan'}</dd></div>
                    <div><dt className="text-[10px] font-semibold tracking-[0.12em] uppercase">Pengisi Acara</dt><dd className="mt-0.5 text-[#0A2942]">{event.pengisiAcara ?? 'Belum ditentukan'}{event.pengisiAcaraType === 'external' && <span className="ml-1 text-[#8A5A17]">(Eksternal)</span>}</dd></div>
                  </dl>
                  <div className="mt-4 flex justify-end border-t border-[#0A2942]/10 pt-3">
                     <Link onClick={(clickEvent) => clickEvent.stopPropagation()} to={`/events/${event.id}/invitation`} className="text-xs font-semibold text-[#8A5A17] underline underline-offset-4 hover:text-[#0A2942]">Cetak undangan</Link>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};
