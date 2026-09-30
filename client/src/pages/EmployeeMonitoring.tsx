import { useEffect, useState } from 'react';
import { ApiRequestError } from '../api/auth.js';
import { fetchEmployeeMonitoring, fetchEmployeeTraining, type EmployeeMonitoring as EmployeeMonitoringRow, type EmployeeTraining } from '../api/events.js';
import { useAuth } from '../auth/AuthContext.js';

export const EmployeeMonitoring = () => {
  const { session, signOut } = useAuth();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<EmployeeMonitoringRow[]>([]);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<EmployeeMonitoringRow | null>(null);
  const [training, setTraining] = useState<EmployeeTraining[]>([]);
  const [loadingTraining, setLoadingTraining] = useState(false);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => fetchEmployeeMonitoring(session.accessToken, query, controller.signal).then(setRows).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (error instanceof ApiRequestError && error.status === 401) signOut();
      else setMessage(error instanceof ApiRequestError ? error.message : 'Monitoring karyawan gagal dimuat.');
    }), 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, session, signOut]);

  useEffect(() => {
    if (!selected || !session) return;
    const controller = new AbortController();
    setTraining([]);
    setLoadingTraining(true);
    fetchEmployeeTraining(session.accessToken, selected.nip, controller.signal).then(setTraining).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage(error instanceof ApiRequestError ? error.message : 'Riwayat training gagal dimuat.');
    }).finally(() => setLoadingTraining(false));
    return () => controller.abort();
  }, [selected, session]);

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [selected]);

  return <>
    <header className="border-b border-[#0A2942]/15 pb-5"><p className="eyebrow text-[#8A5A17]">Human Capital</p><h1 className="mt-1 text-3xl font-semibold text-[#0A2942]">Monitoring Karyawan</h1><p className="mt-2 text-sm text-[#55697C]">Jumlah training setiap karyawan dalam 6 bulan terakhir.</p></header>
    {message && <p className="mt-4 text-sm text-[#B42318]">{message}</p>}
    <section className="mt-8 border border-[#0A2942]/15 bg-[#FAF8F3] p-5 sm:p-6">
      <label className="grid gap-2 text-sm font-semibold text-[#0A2942]">Cari NIK, nama, atau departemen<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ketik untuk mencari..." className="border border-[#0A2942]/20 bg-white px-3 py-3 font-normal outline-none focus:border-[#D9A441]" /></label>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-[#0A2942]/15 text-xs text-[#55697C]"><tr><th className="px-3 py-3">NIK</th><th className="px-3 py-3">Nama</th><th className="px-3 py-3">Departemen</th><th className="px-3 py-3 text-right">Training 6 Bulan</th></tr></thead><tbody>{rows.map((row) => <tr key={row.nip} onClick={() => setSelected(row)} className="cursor-pointer border-b border-[#0A2942]/8 hover:bg-[#D9A441]/10"><td className="px-3 py-3 font-medium">{row.nip}</td><td className="px-3 py-3">{row.name}</td><td className="px-3 py-3">{row.departmentName ?? row.departId ?? '-'}</td><td className="px-3 py-3 text-right font-semibold text-[#8A5A17]">{row.trainingCount}</td></tr>)}</tbody></table>{!rows.length && <p className="py-8 text-center text-sm text-[#55697C]">Data karyawan tidak ditemukan.</p>}</div>
    </section>
    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-[#0A2942]/60 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section role="dialog" aria-modal="true" aria-labelledby="employee-training-title" className="max-h-[85vh] w-full max-w-3xl overflow-y-auto bg-[#FAF8F3] p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4 border-b border-[#0A2942]/15 pb-4"><div><p className="eyebrow text-[#8A5A17]">Riwayat 6 bulan terakhir</p><h2 id="employee-training-title" className="mt-1 text-2xl font-semibold text-[#0A2942]">{selected.name}</h2><p className="mt-1 text-sm text-[#55697C]">NIK {selected.nip} · {selected.departmentName ?? selected.departId ?? '-'}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Tutup modal" className="border border-[#0A2942]/20 px-3 py-2 text-sm">Tutup</button></div>{loadingTraining ? <p className="py-10 text-center text-sm text-[#55697C]">Memuat riwayat training...</p> : training.length ? <div className="mt-5 grid gap-3">{training.map((item) => <article key={item.id} className="border border-[#0A2942]/15 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-[#0A2942]">{item.title}</h3><p className="mt-1 text-sm text-[#55697C]">{item.date}{item.room ? ` · ${item.room}` : ''}</p><p className="mt-1 text-xs text-[#55697C]">Trainer: {item.trainer ?? 'Belum ditentukan'}</p></div><span className={`px-2 py-1 text-xs font-semibold ${item.attended ? 'bg-[#28704A]/10 text-[#28704A]' : 'bg-[#B42318]/10 text-[#B42318]'}`}>{item.attended ? 'Hadir' : 'Belum hadir'}</span></div></article>)}</div> : <p className="py-10 text-center text-sm text-[#55697C]">Belum ada training dalam 6 bulan terakhir.</p>}</section></div>}
  </>;
};
