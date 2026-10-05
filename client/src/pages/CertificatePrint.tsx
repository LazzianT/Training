import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { IssuedCertificate } from '@training/contracts';
import { useAuth } from '../auth/AuthContext.js';
import { issueMyCertificate } from '../api/certificates.js';
import { ApiRequestError } from '../api/auth.js';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const longDate = (iso: string) => {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
};

/**
 * The printable certificate for one training.
 *
 * Opening this page is what issues the certificate, and it is idempotent, so
 * arriving here twice does not mint a second one. Issuing on print rather than on
 * list load keeps the dashboard's issued count a count of certificates really
 * handed out instead of a count of who browsed.
 */
export const CertificatePrint = () => {
  const { eventId } = useParams();
  const { session, signOut } = useAuth();
  const [certificate, setCertificate] = useState<IssuedCertificate | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session || !eventId) return;
    issueMyCertificate(session.accessToken, Number(eventId))
      .then(setCertificate)
      .catch((reason: unknown) => {
        if (reason instanceof ApiRequestError && reason.status === 401) {
          signOut();
          return;
        }
        setError(reason instanceof ApiRequestError ? reason.message : 'Sertifikat gagal dimuat.');
      });
  }, [eventId, session, signOut]);

  if (!certificate) {
    return (
      <main className="min-h-dvh bg-[#D8D2C8] px-4 py-10 text-center text-[#0A2942] sm:px-8">
        <p className={`text-sm ${error ? 'font-semibold text-red-700' : ''}`} role={error ? 'alert' : 'status'}>
          {error || 'Menyiapkan sertifikat...'}
        </p>
        <Link to="/certificates" className="mt-4 inline-block text-sm text-[#8A5A17] underline underline-offset-4">
          Kembali ke Sertifikat Saya
        </Link>
      </main>
    );
  }

  return (
    <main className="invitation-page min-h-dvh bg-[#D8D2C8] px-4 py-6 text-[#0A2942] sm:px-8 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto max-w-[52rem]">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link to="/certificates" className="text-sm text-[#8A5A17] underline underline-offset-4">
            Kembali ke Sertifikat Saya
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-[#0A2942] px-4 py-2.5 text-sm font-semibold text-white outline-none transition duration-150 hover:bg-[#123a5c] focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            Cetak Sertifikat
          </button>
        </div>

        <article className="invitation-sheet bg-white px-8 py-12 shadow-[0_4px_18px_rgba(10,41,66,0.14)] sm:px-16 sm:py-16 print:min-h-0 print:shadow-none">
          <header className="invitation-header text-center">
            <img src="/logo.png" alt="PT Braja Mukti Cakra" className="mx-auto h-14 w-auto object-contain" />
          </header>

          <section className="mt-10 text-center">
            <p className="text-[13px] font-semibold tracking-[0.32em] text-[#8A5A17] uppercase">
              Sertifikat
            </p>
            <h1 className="mt-2 text-[26px] leading-tight font-bold tracking-[-0.01em]">
              Penyelenggaraan Training
            </h1>
            <div className="mx-auto mt-4 h-px w-24 bg-[#0A2942]" />
          </section>

          <section className="mt-10 text-center text-[15px] leading-7">
            <p>Diberikan kepada</p>
            <p className="mt-3 border-b border-[#0A2942] pb-1 text-[24px] leading-snug font-bold">
              {certificate.namaPeserta ?? '-'}
            </p>
            {certificate.departemen && (
              <p className="mt-2 text-[13px] text-[#55697C]">{certificate.departemen}</p>
            )}
          </section>

          <section className="mt-9 text-center text-[15px] leading-7">
            <p>atas keikutsertaannya dalam training</p>
            <p className="mt-2 text-[18px] font-bold">&quot;{certificate.judul}&quot;</p>
            <p className="mt-2">
              yang diselenggarakan pada {longDate(certificate.tanggal)}
              {certificate.ruang ? ` di ${certificate.ruang}` : ''}.
            </p>
          </section>

          <footer className="mt-14 text-[15px] leading-7">
            <div className="grid grid-cols-2 gap-10 text-center">
              <div className="text-left">
                <p className="text-[11px] tracking-[0.14em] text-[#55697C] uppercase">Kode verifikasi</p>
                <p className="mt-1 font-mono text-[13px] font-bold">{certificate.verificationCode}</p>
                <p className="mt-1 text-[11px] text-[#55697C]">
                  Terbit {longDate(certificate.issuedAt.slice(0, 10))}
                </p>
              </div>
              <div>
                <p>Hormat Kami,</p>
                <div className="h-20" />
                <p className="border-b border-black font-bold">LELA HAMONG PRASETYO</p>
                <p className="font-bold">Head of HC &amp; GS</p>
              </div>
            </div>
          </footer>
        </article>
      </div>
    </main>
  );
};
