import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EventSummary } from '@training/contracts';
import { useAuth } from '../auth/AuthContext.js';
import { ApiRequestError } from '../api/auth.js';
import {
  createEventQr,
  fetchAssessmentResults,
  fetchMyEvents,
  fetchTestSets,
  type AssessmentResults,
  type QrAccess,
} from '../api/events.js';

const publicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');

const TestResults = ({ title, submissions }: { title: string; submissions: AssessmentResults['submissions'] }) => {
  const average = submissions.length ? Math.round(submissions.reduce((total, item) => total + (item.percentage ?? 0), 0) / submissions.length) : 0;
  return <section className="border border-[#0A2942]/10 bg-white p-4 sm:p-5"><div className="flex items-end justify-between gap-3"><div><p className="eyebrow">{title}</p><h3 className="mt-1 text-lg font-semibold text-[#0A2942]">Hasil Peserta</h3></div><p className="text-sm text-[#55697C]">Rata-rata <strong className="text-[#0A2942]">{average}%</strong></p></div>{submissions.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead className="border-b border-[#0A2942]/10 text-xs text-[#55697C]"><tr><th className="px-2 py-2">Peserta</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Nilai</th></tr></thead><tbody>{submissions.map((item) => <tr key={`${item.phase}-${item.nip}`} className="border-b border-[#0A2942]/5"><td className="px-2 py-2">{item.name ?? item.nip}<span className="block text-xs text-[#55697C]">{item.nip}</span></td><td className="px-2 py-2">{item.status}</td><td className="px-2 py-2 text-right font-semibold">{item.percentage ?? 0}%</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-[#55697C]">Belum ada peserta yang mengirim jawaban.</p>}</section>;
};

const Results = ({ data }: { data: AssessmentResults }) => {
  const attended = data.attendance.filter((item) => item.attended).length;
  return <section className="result-panel-open mt-5 border-t border-[#0A2942]/10 pt-5"><div className="mb-5"><p className="eyebrow text-[#8A5A17]">Ringkasan event</p><h3 className="mt-1 text-xl font-semibold text-[#0A2942]">Hasil dan Kehadiran</h3></div><div className="grid gap-3 sm:grid-cols-4"><div className="bg-white p-4"><p className="eyebrow">Total peserta</p><p className="metric">{data.attendance.length}</p></div><div className="bg-white p-4"><p className="eyebrow">Hadir</p><p className="metric text-[#28704A]">{attended}</p></div><div className="bg-white p-4"><p className="eyebrow">Belum hadir</p><p className="metric text-[#B42318]">{data.attendance.length - attended}</p></div><div className="bg-white p-4"><p className="eyebrow">Total jawaban</p><p className="metric">{data.submissions.length}</p></div></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><TestResults title="Pre-test" submissions={data.submissions.filter((item) => item.phase === 'pre')} /><TestResults title="Post-test" submissions={data.submissions.filter((item) => item.phase === 'post')} /></div><section className="mt-5 border border-[#0A2942]/10 bg-white p-4 sm:p-5"><div className="flex items-end justify-between gap-3"><div><p className="eyebrow">Kehadiran</p><h3 className="mt-1 text-lg font-semibold text-[#0A2942]">Daftar Kehadiran Peserta</h3></div><p className="text-sm text-[#55697C]">{attended}/{data.attendance.length} hadir</p></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead className="border-b border-[#0A2942]/10 text-xs text-[#55697C]"><tr><th className="px-2 py-2">Peserta</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Waktu</th></tr></thead><tbody>{data.attendance.map((item) => <tr key={item.nip} className="border-b border-[#0A2942]/5"><td className="px-2 py-2">{item.name}<span className="block text-xs text-[#55697C]">{item.nip}</span></td><td className={`px-2 py-2 font-semibold ${item.attended ? 'text-[#28704A]' : 'text-[#B42318]'}`}>{item.attended ? 'Hadir' : 'Belum hadir'}</td><td className="px-2 py-2 text-xs text-[#55697C]">{item.capturedAt ? new Date(item.capturedAt).toLocaleString('id-ID') : '-'}</td></tr>)}</tbody></table></div></section></section>;
};

export const MyEvents = () => {
  const { session, signOut } = useAuth();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [message, setMessage] = useState('');
  const [qr, setQr] = useState<{ eventId: number; purpose: string; url: string } | null>(null);
  const [results, setResults] = useState<Record<number, AssessmentResults>>({});
  const [assessmentReady, setAssessmentReady] = useState<Record<number, boolean>>({});
  const [openResults, setOpenResults] = useState<number | null>(null);

  useEffect(() => {
    if (!session) return;
    fetchMyEvents(session.accessToken).then(async (items) => {
      setEvents(items);
      const readiness = await Promise.all(items.map(async (event) => {
        try {
          const tests = await fetchTestSets(session.accessToken, event.id);
          const ready = tests.some((test) => ['pg', 'mixed'].includes(test.type) && test.questionCount > 0 && test.status === 'published');
          return [event.id, ready] as const;
        } catch {
          return [event.id, false] as const;
        }
      }));
      setAssessmentReady(Object.fromEntries(readiness));
    }).catch((error: unknown) => {
      if (error instanceof ApiRequestError && error.status === 401) signOut();
      else setMessage(error instanceof ApiRequestError ? error.message : 'My Event gagal dimuat.');
    });
  }, [session, signOut]);

  const makeQr = async (eventId: number, purpose: QrAccess['purpose']) => {
    if (!session) return;
    try {
      const item = await createEventQr(session.accessToken, eventId, purpose);
      setQr({ eventId, purpose, url: `${publicAppUrl}${item.url}` });
      setMessage(`QR ${purpose} dibuat.`);
    } catch (error) {
      const nextMessage = error instanceof ApiRequestError ? error.message : 'QR gagal dibuat.';
      setMessage(nextMessage);
    }
  };

  const toggleResults = async (eventId: number) => {
    if (!session) return;
    if (openResults === eventId) return setOpenResults(null);
    setOpenResults(eventId);
    if (results[eventId]) return;
    try {
      const data = await fetchAssessmentResults(session.accessToken, eventId);
      setResults((current) => ({ ...current, [eventId]: data }));
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Hasil gagal dimuat.');
    }
  };

  return <>
    <header className="border-b border-[#0A2942]/15 pb-5">
      <p className="eyebrow text-[#8A5A17]">Peran Pengisi Acara</p>
      <h1 className="mt-1 text-3xl font-semibold text-[#0A2942]">My Event</h1>
      <p className="mt-2 text-sm text-[#55697C]">Kelola QR assessment, absensi, soal, dan hasil peserta.</p>
    </header>
    {message && <p className="mt-4 break-all text-sm text-[#8A5A17]">{message}</p>}
    <div className="my-events-grid mt-8 grid gap-5">
      {events.map((event) => <article key={event.id} className="my-event-card border border-[#0A2942]/15 bg-[#FAF8F3] p-5 sm:p-6">
        <Link to={`/events/${event.id}`}>
          <p className="text-xs uppercase text-[#8A5A17]">{event.tgl}</p>
          <h2 className="mt-1 text-xl font-semibold text-[#0A2942]">{event.judul}</h2>
          <p className="mt-2 text-sm text-[#55697C]">Pengisi acara: <strong className="text-[#0A2942]">{event.pengisiAcara ?? 'Belum ditentukan'}</strong></p>
          <p className="mt-1 text-xs text-[#55697C]">{event.pesertaCount} peserta</p>
        </Link>
        {qr?.eventId === event.id && <section className="mt-4 flex items-center gap-4 border border-[#0A2942]/15 bg-white p-4">
          <img src={`https://quickchart.io/qr?text=${encodeURIComponent(qr.url)}&size=220`} alt={`QR ${qr.purpose}`} className="h-32 w-32" />
          <div className="min-w-0"><p className="text-sm font-semibold">QR {qr.purpose}</p><p className="mt-1 break-all text-xs text-[#55697C]">{qr.url}</p></div>
        </section>}
        {!assessmentReady[event.id] && <p className="mt-4 border-l-4 border-[#D9A441] bg-[#D9A441]/10 p-3 text-sm text-[#8A5A17]">Kamu belum membuat soal Pre-test dan Post-test untuk event ini.</p>}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#0A2942]/10 pt-4 sm:grid-cols-4">
          {assessmentReady[event.id] && <>
            <button type="button" onClick={() => makeQr(event.id, 'pre_test')} className="min-h-20 border bg-white p-3 text-left text-xs">QR Pre-test</button>
            <button type="button" onClick={() => makeQr(event.id, 'post_test')} className="min-h-20 border bg-white p-3 text-left text-xs">QR Post-test</button>
          </>}
          <button type="button" onClick={() => makeQr(event.id, 'feedback')} className="min-h-20 border bg-white p-3 text-left text-xs">QR Feedback</button>
          <button type="button" onClick={() => makeQr(event.id, 'attendance')} className="min-h-20 border bg-white p-3 text-left text-xs">QR Attendance</button>
          <Link to={`/my-events/${event.id}/questions`} className="min-h-20 border border-[#D9A441] bg-[#D9A441]/10 p-3 text-left text-xs font-semibold text-[#8A5A17]">Buat / Publish Soal</Link>
          <button type="button" onClick={() => toggleResults(event.id)} className="min-h-20 border bg-white p-3 text-left text-xs">{openResults === event.id ? 'Tutup Hasil' : 'Lihat Hasil'}</button>
        </div>
        {openResults === event.id && results[event.id] && <Results data={results[event.id]} />}
      </article>)}
    </div>
  </>;
};
