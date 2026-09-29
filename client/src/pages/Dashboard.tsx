import { useEffect, useState } from 'react';
import type { DashboardSummary } from '@training/contracts';
import { useAuth } from '../auth/AuthContext.js';
import { fetchSummary } from '../api/dashboard.js';
import { ApiRequestError } from '../api/auth.js';
import { ParetoChart } from '../components/ParetoChart.js';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const Tile = ({ label, value, unit, note }: { label: string; value: string; unit?: string; note?: string }) => (
  <div className="flex flex-col gap-1 border-t-2 border-[#0A2942] bg-white/55 px-4 py-4">
    <p className="text-[11.5px] font-semibold tracking-[0.13em] uppercase text-[#55697C]">{label}</p>
    <p className="text-[2rem] leading-none font-semibold text-[#0A2942] tabular-nums">
      {value}
      {unit && <span className="ml-1 text-[15px] font-medium text-[#55697C]">{unit}</span>}
    </p>
    {note && <p className="text-[12px] text-[#55697C]">{note}</p>}
  </div>
);

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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold text-[#0A2942]">Ringkasan</h1>
          <p className="mt-1.5 text-[14px] text-[#55697C]">
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
            className="border-0 border-b border-[#0A2942]/30 bg-transparent py-1.5 pr-6 text-[14px] text-[#0A2942] focus:border-[#8A5A17] focus:ring-0 focus:outline-none"
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
            className="border-0 border-b border-[#0A2942]/30 bg-transparent py-1.5 pr-6 text-[14px] text-[#0A2942] focus:border-[#8A5A17] focus:ring-0 focus:outline-none"
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
        <div
          role="alert"
          className="mt-6 border-l-2 border-[#B42318] bg-[#B42318]/8 py-2.5 pl-3.5 pr-3 text-[13.5px] text-[#8A1C14]"
        >
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="mt-8 grid gap-px bg-[#0A2942]/12 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="bg-[#EFEAE0] px-4 py-4">
              <div className="h-3 w-24 bg-[#0A2942]/10" />
              <div className="mt-3 h-8 w-16 bg-[#0A2942]/10" />
            </div>
          ))}
        </div>
      ) : data ? (
        <>
          <section id="ringkasan" className="mt-8 scroll-mt-6">
            <div className="grid gap-px bg-[#0A2942]/12 sm:grid-cols-2 lg:grid-cols-4">
              <Tile label="Training bulan ini" value={String(data.month.trainingCount)} unit="acara" />
              <Tile
                label="Karyawan terlatih"
                value={String(data.month.trainedEmployees)}
                unit="orang"
                note={`${MONTHS[month - 1]} ${year}`}
              />
              <Tile
                label="Rating rata-rata"
                value={data.month.averageScore === null ? '-' : data.month.averageScore.toFixed(2)}
                unit={data.month.averageScore === null ? undefined : '/ 5'}
                note={
                  data.month.feedbackCount === 0
                    ? 'Belum ada feedback'
                    : `Dari ${data.month.feedbackCount} jawaban`
                }
              />
              <Tile
                label="Sertifikat terbit"
                value={String(data.master.certificatesIssued)}
                unit="sertifikat"
                note="Sepanjang riwayat"
              />
            </div>
          </section>

          <section id="master" className="mt-10 scroll-mt-6">
            <h2 className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[#55697C]">
              Master Data
            </h2>
            <dl className="mt-4 grid gap-px bg-[#0A2942]/12 sm:grid-cols-3">
              {[
                ['Karyawan aktif (HR)', data.master.activeEmployees, 'orang'],
                ['Ruang acara aktif', data.master.activeRooms, 'ruang'],
                ['Total acara', data.master.totalTrainings, 'acara'],
              ].map(([label, value, unit]) => (
                <div key={String(label)} className="flex items-baseline justify-between bg-[#EFEAE0] px-4 py-3.5">
                  <dt className="text-[13.5px] text-[#55697C]">{label}</dt>
                  <dd className="text-[17px] font-semibold text-[#0A2942] tabular-nums">
                    {String(value)}
                    <span className="ml-1 text-[12px] font-normal text-[#55697C]">{unit}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="pareto" className="mt-10 scroll-mt-6">
            <h2 className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[#55697C]">
              Pareto Training per Bulan
            </h2>
            <p className="mt-1.5 text-[13px] text-[#55697C]">Dua belas bulan terakhir.</p>
            <div className="mt-4 border border-[#0A2942]/12 bg-white/55 px-3 py-5 sm:px-5">
              <ParetoChart data={data.pareto} hasData={hasTraining} />
            </div>
          </section>
        </>
      ) : null}
    </>
  );
};
