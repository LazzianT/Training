import { useEffect, useState, type CSSProperties } from 'react';
import type { DashboardSummary } from '@training/contracts';
import { useAuth } from '../auth/AuthContext.js';
import { fetchSummary } from '../api/dashboard.js';
import { ApiRequestError } from '../api/auth.js';
import { ParetoChart } from '../components/ParetoChart.js';
import { EventList } from '../components/EventList.js';
import { TrainingCalendar } from '../components/TrainingCalendar.js';
import { Panel, SkeletonPanel, SkeletonTile, StatTile } from '../components/ui/index.js';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const selectClass =
  'h-9 border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition duration-150 hover:border-slate-400 focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2';

export const Dashboard = () => {
  const { session, signOut } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');

    fetchSummary(session.accessToken, year, month, controller.signal)
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof ApiRequestError && err.status === 401) {
          signOut();
          return;
        }
        setError(err instanceof ApiRequestError ? err.message : 'Ringkasan gagal dimuat.');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [session, year, month, signOut]);

  const monthLabel = `${MONTHS[month - 1]} ${year}`;
  const hasTraining = (data?.master.totalTrainings ?? 0) > 0;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">Ringkasan</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {session?.employee.name ? `${session.employee.name}, ` : ''}periode {monthLabel}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="month-select" className="sr-only">
            Pilih bulan
          </label>
          <select
            id="month-select"
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            className={selectClass}
          >
            {MONTHS.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
          <label htmlFor="year-select" className="sr-only">
            Pilih tahun
          </label>
          <select
            id="year-select"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className={selectClass}
          >
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error && (
        <div role="alert" className="mt-6 border border-red-500 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !data ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <SkeletonTile key={index} />
            ))}
          </div>
          <div className="mt-8">
            <SkeletonPanel rows={3} />
          </div>
          <div className="mt-8">
            <SkeletonPanel rows={4} />
          </div>
        </>
      ) : data ? (
        <>
          <section
            id="ringkasan"
            className="enter-section mt-6 grid scroll-mt-6 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            style={{ '--enter-delay': '0ms' } as CSSProperties}
          >
            <StatTile label="Training bulan ini" value={String(data.month.trainingCount)} unit="acara" />
            <StatTile
              label="Karyawan terlatih"
              value={String(data.month.trainedEmployees)}
              unit="orang"
              note={`${MONTHS[month - 1]} ${year}`}
            />
            <StatTile
              label="Rating rata-rata"
              value={data.month.averageScore === null ? '-' : data.month.averageScore.toFixed(2)}
              unit={data.month.averageScore === null ? undefined : '/ 5'}
              note={
                data.month.feedbackCount === 0
                  ? 'Belum ada feedback'
                  : `Dari ${data.month.feedbackCount} jawaban`
              }
            />
            <StatTile
              label="Sertifikat terbit"
              value={String(data.master.certificatesIssued)}
              unit="sertifikat"
              note="Sepanjang riwayat"
            />
          </section>

          <section
            id="kalender"
            className="enter-section mt-8 scroll-mt-6"
            style={{ '--enter-delay': '60ms' } as CSSProperties}
          >
            <Panel
              title="Kalender Training"
              description="Sebaran acara pada periode terpilih. Klik tanggal untuk melihat detail."
            >
              <TrainingCalendar year={year} month={month} events={data.monthEvents} />
            </Panel>
          </section>

          <section
            id="master"
            className="enter-section mt-8 scroll-mt-6"
            style={{ '--enter-delay': '120ms' } as CSSProperties}
          >
            <Panel title="Master Data" description="Angka reference dari data HR internal.">
              <dl className="divide-y divide-slate-100">
                {[
                  ['Karyawan aktif (HR)', data.master.activeEmployees, 'orang'],
                  ['Ruang acara aktif', data.master.activeRooms, 'ruang'],
                  ['Total acara', data.master.totalTrainings, 'acara'],
                ].map(([label, value, unit]) => (
                  <div
                    key={String(label)}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition duration-150 hover:bg-slate-50 sm:px-5"
                  >
                    <dt className="text-sm text-slate-600">{label}</dt>
                    <dd className="text-sm font-semibold text-slate-900 tabular-nums">
                      {String(value)}
                      <span className="ml-1 text-xs font-normal text-slate-500">{unit}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </section>

          <section
            id="agenda"
            className="enter-section mt-8 scroll-mt-6"
            style={{ '--enter-delay': '180ms' } as CSSProperties}
          >
            <Panel title="Minggu Ini" description="Acara yang akan datang dalam tujuh hari ke depan.">
              <EventList
                events={data.upcomingEvents}
                showRelativeDay
                emptyTitle="Tidak ada acara minggu ini"
                emptyDescription="Belum ada acara yang terjadwal dalam tujuh hari ke depan. Jadwal berikutnya akan muncul di sini begitu disimpan."
              />
            </Panel>
          </section>

          <section
            id="terbaru"
            className="enter-section mt-8 scroll-mt-6"
            style={{ '--enter-delay': '240ms' } as CSSProperties}
          >
            <Panel title="Event Terbaru" description="Lima acara terakhir yang sudah berlangsung.">
              <EventList
                events={data.recentEvents}
                emptyTitle="Belum ada event"
                emptyDescription="Belum ada acara yang pernah dibuat. Event yang pertama akan muncul di sini setelah disimpan."
              />
            </Panel>
          </section>

          <section
            id="pareto"
            className="enter-section mt-8 scroll-mt-6"
            style={{ '--enter-delay': '300ms' } as CSSProperties}
          >
            <Panel title="Pareto Training per Bulan" description="Dua belas bulan terakhir.">
              <div className="px-4 py-5 sm:px-5">
                <ParetoChart data={data.pareto} hasData={hasTraining} />
              </div>
            </Panel>
          </section>
        </>
      ) : null}
    </>
  );
};
