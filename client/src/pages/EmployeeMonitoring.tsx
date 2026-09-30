import { useEffect, useMemo, useState } from 'react';
import { ApiRequestError } from '../api/auth.js';
import {
  fetchEmployeeMonitoring,
  fetchEmployeeTraining,
  type EmployeeMonitoring as EmployeeMonitoringRow,
  type EmployeeTraining,
} from '../api/events.js';
import { useAuth } from '../auth/AuthContext.js';
import { Distribution, EmptyState, StatTile, inputClass } from '../components/ui/index.js';
import { Modal } from '../components/Modal.js';

type SortKey = 'nip' | 'name' | 'departmentName' | 'trainingCount';

const thClass = 'px-3 py-2.5 text-left text-[11px] font-semibold tracking-[0.1em] text-slate-500 uppercase';
const thRightClass = `${thClass} text-right`;

const BUCKETS = [
  { label: 'Belum pernah training', max: 0 },
  { label: '1 kali', max: 1 },
  { label: '2 kali', max: 2 },
  { label: '3 kali atau lebih', max: Number.POSITIVE_INFINITY },
];

/** Bucket boundaries are inclusive upper bounds, so 0 lands in the first bucket. */
const bucketIndex = (count: number) => {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
};

export const EmployeeMonitoring = () => {
  const { session, signOut } = useAuth();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<EmployeeMonitoringRow[] | null>(null);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<EmployeeMonitoringRow | null>(null);
  const [training, setTraining] = useState<EmployeeTraining[]>([]);
  const [loadingTraining, setLoadingTraining] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'trainingCount', dir: 'desc' });

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const timer = window.setTimeout(
      () =>
        fetchEmployeeMonitoring(session.accessToken, query, controller.signal)
          .then(setRows)
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            if (error instanceof ApiRequestError && error.status === 401) signOut();
            else setMessage(error instanceof ApiRequestError ? error.message : 'Monitoring karyawan gagal dimuat.');
          }),
      250,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, session, signOut]);

  useEffect(() => {
    if (!selected || !session) return;
    const controller = new AbortController();
    setTraining([]);
    setLoadingTraining(true);
    fetchEmployeeTraining(session.accessToken, selected.nip, controller.signal)
      .then(setTraining)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setMessage(error instanceof ApiRequestError ? error.message : 'Riwayat training gagal dimuat.');
        }
      })
      .finally(() => setLoadingTraining(false));
    return () => controller.abort();
  }, [selected, session]);

  const stats = useMemo(() => {
    const source = rows ?? [];
    const totalTraining = source.reduce((sum, row) => sum + row.trainingCount, 0);
    const withoutTraining = source.filter((row) => row.trainingCount === 0).length;
    return {
      employees: source.length,
      totalTraining,
      average: source.length === 0 ? 0 : Math.round((totalTraining / source.length) * 10) / 10,
      withoutTraining,
    };
  }, [rows]);

  const buckets = useMemo(() => {
    const source = rows ?? [];
    return BUCKETS.map((bucket, index) => ({
      label: bucket.label,
      value: bucket.max,
      count: source.filter((row) => bucketIndex(row.trainingCount) === index).length,
    }));
  }, [rows]);

  const sorted = useMemo(() => {
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...(rows ?? [])].sort((a, b) => {
      if (sort.key === 'trainingCount') return (a.trainingCount - b.trainingCount) * factor;
      if (sort.key === 'nip') return a.nip.localeCompare(b.nip) * factor;
      if (sort.key === 'name') return (a.name ?? '').localeCompare(b.name ?? '', 'id') * factor;
      const left = a.departmentName ?? a.departId ?? '';
      const right = b.departmentName ?? b.departId ?? '';
      return left.localeCompare(right, 'id') * factor;
    });
  }, [rows, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'trainingCount' ? 'desc' : 'asc' },
    );

  const indicator = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? '↑' : '↓') : null);
  const sortButton = 'inline-flex items-center gap-1 outline-none transition duration-150 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2';

  return (
    <div data-surface="saas">
      <header className="enter-section border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">Monitoring Karyawan</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Jumlah training setiap karyawan dalam 6 bulan terakhir.
        </p>
      </header>

      {message && (
        <div role="alert" className="mt-6 border border-red-500 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {message}
        </div>
      )}

      {rows === null ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="border border-slate-200 bg-white px-4 py-4">
              <div className="h-3 w-24 bg-slate-100" />
              <div className="mt-3 h-8 w-16 bg-slate-100" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <section
            className="enter-section mt-6 grid scroll-mt-6 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            style={{ '--enter-delay': '40ms' } as React.CSSProperties}
          >
            <StatTile label="Karyawan dimuat" value={String(stats.employees)} unit="orang" />
            <StatTile label="Total training" value={String(stats.totalTraining)} unit="acara" />
            <StatTile label="Rata-rata per karyawan" value={String(stats.average)} unit="acara" />
            <StatTile
              label="Belum pernah training"
              value={String(stats.withoutTraining)}
              unit="orang"
              note={stats.employees > 0 ? `${Math.round((stats.withoutTraining / stats.employees) * 100)}% dari daftar` : undefined}
            />
          </section>

          {rows.length > 0 && (
            <div className="enter-section mt-4" style={{ '--enter-delay': '80ms' } as React.CSSProperties}>
              <Distribution
                buckets={buckets}
                total={stats.employees}
                caption={`${stats.employees} karyawan · 6 bulan terakhir`}
              />
            </div>
          )}

          <div className="enter-section mt-4" style={{ '--enter-delay': '120ms' } as React.CSSProperties}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-56 flex-1">
                <label htmlFor="employee-search" className="block text-xs font-semibold text-slate-700">
                  Cari karyawan
                </label>
                <input
                  id="employee-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="NIK, nama, atau departemen"
                  className={`${inputClass()} mt-2`}
                />
              </div>
              <p className="mb-2.5 text-xs text-slate-500">
                Menampilkan {sorted.length} dari {stats.employees} karyawan
              </p>
            </div>
          </div>

          <div
            className="enter-section mt-4 overflow-x-auto border border-slate-200 bg-white"
            style={{ '--enter-delay': '160ms' } as React.CSSProperties}
          >
            {rows.length === 0 ? (
              <EmptyState
                title="Data karyawan tidak ditemukan"
                description="Tidak ada karyawan yang cocok dengan pencarian ini. Coba NIP, nama, atau nama departemen lain."
              />
            ) : (
              <table className="w-full min-w-[38rem] border-collapse">
                <caption className="sr-only">
                  Jumlah training setiap karyawan dalam 6 bulan terakhir, {rows.length} baris.
                </caption>
                <thead>
                  <tr className="border-b border-slate-200">
                    <th scope="col" className={thClass}>
                      <button type="button" onClick={() => toggleSort('nip')} className={sortButton}>
                        NIK <span aria-hidden="true" className="text-slate-400">{indicator('nip')}</span>
                      </button>
                    </th>
                    <th scope="col" className={thClass}>
                      <button type="button" onClick={() => toggleSort('name')} className={sortButton}>
                        Nama <span aria-hidden="true" className="text-slate-400">{indicator('name')}</span>
                      </button>
                    </th>
                    <th scope="col" className={thClass}>
                      <button type="button" onClick={() => toggleSort('departmentName')} className={sortButton}>
                        Departemen <span aria-hidden="true" className="text-slate-400">{indicator('departmentName')}</span>
                      </button>
                    </th>
                    <th scope="col" className={thRightClass}>
                      <button type="button" onClick={() => toggleSort('trainingCount')} className={sortButton}>
                        Training 6 Bulan <span aria-hidden="true" className="text-slate-400">{indicator('trainingCount')}</span>
                      </button>
                    </th>
                    <th scope="col" className={thRightClass}>
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => (
                    <tr
                      key={row.nip}
                      className="border-b border-slate-100 transition duration-150 last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-600 tabular-nums">{row.nip}</td>
                      <td className="px-3 py-3 text-sm font-medium text-slate-900">{row.name}</td>
                      <td className="px-3 py-3 text-sm text-slate-600">
                        {row.departmentName ?? row.departId ?? '-'}
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-semibold text-slate-900 tabular-nums">
                        {row.trainingCount}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelected(row)}
                          className="text-xs font-semibold text-slate-900 underline underline-offset-4 outline-none transition duration-150 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                        >
                          Lihat riwayat
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        description={
          selected
            ? `NIK ${selected.nip} · ${selected.departmentName ?? selected.departId ?? '-'} · riwayat 6 bulan terakhir`
            : undefined
        }
        size="lg"
      >
        {loadingTraining ? (
          <div className="grid gap-3 p-5">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="border border-slate-200 p-4">
                <div className="h-3.5 w-2/3 bg-slate-100" />
                <div className="mt-2.5 h-3 w-1/3 bg-slate-100" />
              </div>
            ))}
          </div>
        ) : training.length === 0 ? (
          <EmptyState
            title="Belum ada training"
            description="Karyawan ini belum mengikuti training apa pun dalam 6 bulan terakhir."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {training.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.date}
                    {item.room ? ` · ${item.room}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Pengisi: {item.trainer ?? 'Belum ditentukan'}
                  </p>
                </div>
                <span
                  className={`shrink-0 border px-2 py-1 text-xs font-semibold ${
                    item.attended
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {item.attended ? 'Hadir' : 'Belum hadir'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
};
