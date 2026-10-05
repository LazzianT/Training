import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MyCertificate } from '@training/contracts';
import { useAuth } from '../auth/AuthContext.js';
import { fetchMyCertificates } from '../api/certificates.js';
import { ApiRequestError } from '../api/auth.js';
import { EmptyState, Panel } from '../components/ui/index.js';
import { shortDate } from '../lib/date.js';

const ATTENDANCE_LABEL: Record<MyCertificate['attendanceStatus'], string> = {
  present: 'Hadir',
  absent: 'Tidak hadir',
  not_recorded: 'Kehadiran belum dicatat',
};

const ATTENDANCE_TONE: Record<MyCertificate['attendanceStatus'], string> = {
  present: 'text-emerald-700',
  absent: 'text-red-700',
  not_recorded: 'text-amber-700',
};

/**
 * The trainings the signed-in employee has been registered for, and the
 * certificate for each once they can get one.
 *
 * Trainings that were not attended are listed too. Hiding them would leave an
 * empty page for somebody who has been to sessions nobody recorded, which looks
 * like the app is broken rather than like a record that needs fixing.
 */
export const Certificates = () => {
  const { session, signOut } = useAuth();
  const [items, setItems] = useState<MyCertificate[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!session) return;
    try {
      setItems(await fetchMyCertificates(session.accessToken, signal));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      if (reason instanceof ApiRequestError && reason.status === 401) return signOut();
      setError(reason instanceof ApiRequestError ? reason.message : 'Sertifikat gagal dimuat.');
    }
  }, [session, signOut]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const printable = (items ?? []).filter((item) => item.hadir).length;

  return (
    <div data-surface="saas">
      <header className="enter-section">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-900 sm:text-3xl">
          Sertifikat Saya
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Training yang Anda ikuti, beserta sertifikat yang bisa dicetak.
        </p>
      </header>

      {error && (
        <p role="alert" className="enter-section mt-5 border border-red-500 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      {items && items.length > 0 && (
        <p
          className="enter-section mt-5 border-l-2 border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
          style={{ '--enter-delay': '40ms' } as React.CSSProperties}
        >
          Sertifikat bisa dicetak untuk training yang <strong>kehadirannya sudah dicatat</strong> oleh
          Human Capital. Dari {items.length} training, {printable} sudah bisa dicetak.
        </p>
      )}

      <div className="enter-section mt-4" style={{ '--enter-delay': '80ms' } as React.CSSProperties}>
        {items === null ? (
          <Panel title="Training Saya" description="Memuat...">
            <div className="px-5 py-6 text-sm text-slate-500">Memuat daftar training...</div>
          </Panel>
        ) : items.length === 0 ? (
          <Panel title="Training Saya" description="Riwayat training yang Anda ikuti.">
            <EmptyState
              title="Belum ada training"
              description="Training yang Anda ikuti akan muncul di sini. Hubungi Human Capital bila Anda merasa sudah mengikuti training."
            />
          </Panel>
        ) : (
          <Panel
            title="Training Saya"
            description="Urut dari yang terbaru."
            action={
              <span className="text-xs font-semibold text-slate-500 tabular-nums">
                {items.length} training
              </span>
            }
          >
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li
                  key={item.eventId}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition duration-150 hover:bg-slate-50 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{item.judul}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {shortDate(item.tanggal)}
                      {item.ruang ? ` · ${item.ruang}` : ''}
                      {item.pengisi ? ` · ${item.pengisi}` : ''}
                    </p>
                    <p className={`mt-1 text-xs font-semibold ${ATTENDANCE_TONE[item.attendanceStatus]}`}>
                      {ATTENDANCE_LABEL[item.attendanceStatus]}
                      {item.certificate && item.certificate.status !== 'valid' && ` · sertifikat ${item.certificate.status}`}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {item.hadir ? (
                      <Link
                        to={`/certificates/${item.eventId}`}
                        className="inline-flex h-9 items-center border border-slate-900 px-3 text-xs font-semibold text-slate-900 outline-none transition duration-150 hover:bg-slate-900 hover:text-white focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                      >
                        {item.certificate ? 'Cetak sertifikat' : 'Buat sertifikat'}
                      </Link>
                    ) : (
                      /*
                        No button rather than a disabled one: a disabled control
                        invites a click that will never work, and the reason is in
                        the line above.
                      */
                      <span className="text-xs text-slate-400">Belum bisa dicetak</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
};
