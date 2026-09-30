import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EventSummary } from '@training/contracts';
import { EVENT_STATUS_LABEL } from '@training/contracts';
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
import { ActionBar, EmptyState, Panel, Readiness, StatTile, inputClass } from '../components/ui.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Modal } from '../components/Modal.js';
import { CopyButton } from '../components/Toast.js';
import { shortDate } from '../lib/date.js';

const publicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');

const thClass = 'px-3 py-2.5 text-left text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase';
const thRightClass = `${thClass} text-right`;

const actionClass =
  'flex h-9 items-center justify-center gap-1.5 border px-2.5 text-xs font-medium transition duration-150 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2';

const QR_LABEL: Record<QrAccess['purpose'], string> = {
  pre_test: 'Pre-test',
  post_test: 'Post-test',
  feedback: 'Feedback',
  attendance: 'Absensi',
};

const TestResults = ({ title, submissions }: { title: string; submissions: AssessmentResults['submissions'] }) => {
  const average = submissions.length
    ? Math.round(submissions.reduce((total, item) => total + (item.percentage ?? 0), 0) / submissions.length)
    : 0;

  return (
    <Panel title={title} description={`Rata-rata ${average}%`}>
      {submissions.length === 0 ? (
        <EmptyState title="Belum ada jawaban" description={`Belum ada peserta yang mengirim ${title.toLowerCase()}.`} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[24rem]">
            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className={thClass}>Peserta</th>
                <th scope="col" className={thClass}>Status</th>
                <th scope="col" className={thRightClass}>Nilai</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((item) => (
                <tr key={`${item.phase}-${item.nip}`} className="border-b border-slate-100 transition duration-150 last:border-b-0 hover:bg-slate-50">
                  <td className="px-3 py-2.5 text-sm text-slate-900">
                    {item.name ?? item.nip}
                    <span className="block text-xs text-slate-500 tabular-nums">{item.nip}</span>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-600">{item.status}</td>
                  <td className="px-3 py-2.5 text-right text-sm font-semibold text-slate-900 tabular-nums">
                    {item.percentage ?? 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
};

const Results = ({ data }: { data: AssessmentResults }) => {
  const attended = data.attendance.filter((item) => item.attended).length;

  return (
    <div className="mt-6 grid gap-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatTile label="Total peserta" value={String(data.attendance.length)} unit="orang" />
        <StatTile label="Hadir" value={String(attended)} unit="orang" />
        <StatTile label="Belum hadir" value={String(data.attendance.length - attended)} unit="orang" />
        <StatTile label="Total jawaban" value={String(data.submissions.length)} unit="jawaban" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TestResults title="Pre-test" submissions={data.submissions.filter((item) => item.phase === 'pre')} />
        <TestResults title="Post-test" submissions={data.submissions.filter((item) => item.phase === 'post')} />
      </div>

      <Panel title="Daftar Kehadiran Peserta" description={`${attended} dari ${data.attendance.length} hadir.`}>
        {data.attendance.length === 0 ? (
          <EmptyState title="Belum ada data kehadiran" description="Belum ada peserta yang tercatat pada acara ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem]">
              <thead>
                <tr className="border-b border-slate-200">
                  <th scope="col" className={thClass}>Peserta</th>
                  <th scope="col" className={thClass}>Status</th>
                  <th scope="col" className={thClass}>Waktu</th>
                </tr>
              </thead>
              <tbody>
                {data.attendance.map((item) => (
                  <tr key={item.nip} className="border-b border-slate-100 transition duration-150 last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-sm text-slate-900">
                      {item.name}
                      <span className="block text-xs text-slate-500 tabular-nums">{item.nip}</span>
                    </td>
                    <td className={`px-3 py-2.5 text-sm font-semibold ${item.attended ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {item.attended ? 'Hadir' : 'Belum hadir'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 tabular-nums">
                      {item.capturedAt ? new Date(item.capturedAt).toLocaleString('id-ID') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
};

export const MyEvents = () => {
  const { session, signOut } = useAuth();
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [message, setMessage] = useState('');
  const [qr, setQr] = useState<{ eventId: number; purpose: QrAccess['purpose']; url: string } | null>(null);
  const [results, setResults] = useState<Record<number, AssessmentResults>>({});
  const [assessmentReady, setAssessmentReady] = useState<Record<number, boolean>>({});
  const [resultFor, setResultFor] = useState<number | null>(null);
  const [query, setQuery] = useState('');

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
      else setMessage(error instanceof ApiRequestError ? error.message : 'Acara saya gagal dimuat.');
    });
  }, [session, signOut]);

  const makeQr = async (eventId: number, purpose: QrAccess['purpose']) => {
    if (!session) return;
    try {
      const item = await createEventQr(session.accessToken, eventId, purpose);
      setQr({ eventId, purpose, url: `${publicAppUrl}${item.url}` });
      setMessage(`QR ${purpose} dibuat.`);
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'QR gagal dibuat.');
    }
  };

  const openResultsFor = async (eventId: number) => {
    if (!session) return;
    setResultFor(eventId);
    if (results[eventId]) return;
    try {
      const data = await fetchAssessmentResults(session.accessToken, eventId);
      setResults((current) => ({ ...current, [eventId]: data }));
    } catch (error) {
      setResultFor(null);
      setMessage(error instanceof ApiRequestError ? error.message : 'Hasil gagal dimuat.');
    }
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const source = events ?? [];
    if (!needle) return source;
    return source.filter((event) =>
      `${event.judul} ${event.pengisiAcara ?? ''} ${event.ruangNama ?? ''}`.toLowerCase().includes(needle),
    );
  }, [events, query]);

  return (
    <div data-surface="saas">
      <header className="enter-section border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">Acara Saya</h1>
        <p className="mt-1.5 text-sm text-slate-500">Kelola QR assessment, absensi, soal, dan hasil peserta.</p>
      </header>

      {message && (
        <p role="status" className="mt-5 break-all border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
          {message}
        </p>
      )}

      {events === null ? (
        <div className="mt-6 border border-slate-200 bg-white">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="border-b border-slate-100 px-5 py-5 last:border-b-0">
              <div className="h-3 w-28 bg-slate-100" />
              <div className="mt-2.5 h-4 w-2/3 bg-slate-100" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="mt-6 border border-slate-200 bg-white">
          <EmptyState
            title="Belum ada acara"
            description="Belum ada acara yang ditugaskan kepada Anda sebagai pengisi. Acara akan muncul di sini setelah ditugaskan oleh Human Capital."
          />
        </div>
      ) : (
        <>
          <div
            className="enter-section mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            style={{ '--enter-delay': '40ms' } as React.CSSProperties}
          >
            <StatTile label="Acara ditugaskan" value={String(events.length)} unit="acara" />
            <StatTile
              label="Siapassessment"
              value={String(events.filter((event) => assessmentReady[event.id]).length)}
              unit="acara"
              note="soal sudah dipublish"
            />
            <StatTile
              label="Perlu soal"
              value={String(events.filter((event) => !assessmentReady[event.id]).length)}
              unit="acara"
            />
            <StatTile
              label="Total peserta"
              value={String(events.reduce((sum, event) => sum + event.pesertaCount, 0))}
              unit="orang"
            />
          </div>

          <div
            className="enter-section mt-4 flex flex-wrap items-end justify-between gap-3"
            style={{ '--enter-delay': '80ms' } as React.CSSProperties}
          >
            <div className="min-w-56 flex-1">
              <label htmlFor="my-event-search" className="block text-xs font-semibold text-slate-700">
                Cari acara
              </label>
              <input
                id="my-event-search"
                type="search"
                value={query}
                onChange={(change) => setQuery(change.target.value)}
                placeholder="Judul, pengisi, atau ruang"
                className={`${inputClass()} mt-2`}
              />
            </div>
            <p className="mb-2.5 text-xs text-slate-500">
              Menampilkan {visible.length} dari {events.length} acara
            </p>
          </div>
        </>
      )}

      {events !== null && events.length > 0 && visible.length === 0 && (
        <div className="mt-4 border border-slate-200 bg-white">
          <EmptyState
            title="Tidak ada acara yang cocok"
            description="Ubah kata kunci untuk melihat daftar acara Anda yang lain."
          />
        </div>
      )}

      {events !== null && events.length > 0 && visible.length > 0 && (
        <div className="mt-6 grid gap-4">
          {visible.map((event, index) => {
            const ready = assessmentReady[event.id] === true;
            return (
              <article
                key={event.id}
                className="enter-section border border-slate-200 bg-white"
                style={{ '--enter-delay': `${Math.min(index, 5) * 60}ms` } as React.CSSProperties}
              >
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={event.status} label={EVENT_STATUS_LABEL[event.status]} />
                      <span className="text-xs text-slate-500 tabular-nums">{shortDate(event.tgl)}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-900">
                      <Link
                        to={`/events/${event.id}`}
                        className="outline-none transition duration-150 hover:underline focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                      >
                        {event.judul}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {event.pengisiAcara ?? 'Pengisi belum ditentukan'}
                      {event.ruangNama ? ` · ${event.ruangNama}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-xs text-slate-500">
                    <span className="block text-lg font-semibold text-slate-900 tabular-nums">
                      {event.pesertaCount}
                    </span>
                    peserta
                  </span>
                </header>

                <div className="border-b border-slate-200 px-5 py-3.5">
                  <Readiness
                    steps={[
                      {
                        label: 'Soal assessment',
                        state: ready ? 'done' : 'pending',
                        note: ready ? undefined : 'belum dipublish',
                      },
                      {
                        label: 'Peserta',
                        state: event.pesertaCount > 0 ? 'done' : 'blocked',
                        note: event.pesertaCount > 0 ? undefined : 'belum ada',
                      },
                    ]}
                  />
                </div>

                {qr?.eventId === event.id && (
                  <div className="enter-qr flex flex-wrap items-center gap-4 border-b border-slate-200 p-5">
                    <img
                      src={`https://quickchart.io/qr?text=${encodeURIComponent(qr.url)}&size=220`}
                      alt={`QR ${QR_LABEL[qr.purpose]}`}
                      className="h-28 w-28"
                      width={112}
                      height={112}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">QR {QR_LABEL[qr.purpose]}</p>
                      <p className="mt-1 text-xs break-all text-slate-500">{qr.url}</p>
                    </div>
                    <CopyButton value={qr.url} />
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <ActionBar>
                    {ready ? (
                      (['attendance', 'feedback', 'pre_test', 'post_test'] as const).map((purpose) => (
                        <button
                          key={purpose}
                          type="button"
                          onClick={() => makeQr(event.id, purpose)}
                          className={`${actionClass} border-slate-300 bg-white text-slate-900 outline-none hover:border-slate-900`}
                        >
                          QR {QR_LABEL[purpose]}
                        </button>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">
                        QR assessment terbuka setelah soal dipublish.
                      </span>
                    )}
                  </ActionBar>

                  <ActionBar>
                    <Link
                      to={`/my-events/${event.id}/questions`}
                      className={`${actionClass} border-slate-900 bg-slate-900 text-white outline-none hover:bg-slate-700`}
                    >
                      {ready ? 'Kelola Soal' : 'Buat Soal'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => openResultsFor(event.id)}
                      className={`${actionClass} border-slate-300 bg-white text-slate-900 outline-none hover:border-slate-900`}
                    >
                      Lihat Hasil
                    </button>
                  </ActionBar>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={resultFor !== null}
        onClose={() => setResultFor(null)}
        title={resultFor ? (events?.find((event) => event.id === resultFor)?.judul ?? 'Hasil Peserta') : ''}
        description={resultFor ? `Pre-test, post-test, dan kehadiran untuk acara ini.` : undefined}
        size="xl"
      >
        {resultFor === null ? null : results[resultFor] ? (
          <Results data={results[resultFor]} />
        ) : (
          <div className="grid gap-3 p-5">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-16 bg-slate-100" />
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};
