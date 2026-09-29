import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { EventDetail as EventDetailType } from '@training/contracts';
import { useAuth } from '../auth/AuthContext.js';
import { fetchEvent } from '../api/events.js';
import { ApiRequestError } from '../api/auth.js';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const formatDate = (value: string) => {
  const [year, month, day] = value.split('-');
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`;
};

export const EventInvitation = () => {
  const { id } = useParams();
  const { session, signOut } = useAuth();
  const [event, setEvent] = useState<EventDetailType | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session || !id) return;
    fetchEvent(session.accessToken, Number(id)).then(setEvent).catch((reason: unknown) => {
      if (reason instanceof ApiRequestError && reason.status === 401) signOut();
      else setError('Undangan gagal dimuat.');
    });
  }, [id, session, signOut]);

  if (!event) return <main className="min-h-dvh bg-[#EFEAE0] p-8 text-[#55697C]">{error || 'Memuat undangan...'}</main>;

  return (
    <main className="invitation-page min-h-dvh bg-[#D8D2C8] px-4 py-6 text-[#0A2942] sm:px-8 print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto max-w-[52rem]">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link to={`/events/${event.id}`} className="text-sm text-[#8A5A17] underline underline-offset-4">Kembali ke detail</Link>
          <button type="button" onClick={() => window.print()} className="bg-[#0A2942] px-4 py-2.5 text-sm font-semibold text-white">Cetak Undangan</button>
        </div>

        <article className="invitation-sheet bg-white px-8 py-10 shadow-[0_4px_18px_rgba(10,41,66,0.14)] sm:px-14 sm:py-12 print:min-h-0 print:shadow-none">
          <header className="invitation-header border-b-2 border-[#0A2942] pb-5 text-center">
            <img src="/logo.png" alt="PT Braja Mukti Cakra" className="mx-auto h-14 w-auto object-contain" />
          </header>

          <section className="invitation-meta pt-5 text-[15px] leading-7">
            <div className="grid grid-cols-[5.5rem_1fr]">
              <span>Tanggal</span><span>: {formatDate(event.tgl)}</span>
              <span>Perihal</span><strong>: UNDANGAN PELAKSANAAN TRAINING IN HOUSE</strong>
            </div>
            <div className="mt-8">Kepada Yth.</div>
            <strong>Pekerja PT Braja Mukti Cakra</strong>
            <p className="mt-6">Berikut ini kami beritahukan pelaksanaan In House Training dengan materi <strong>&quot;{event.judul}&quot;</strong> yang akan diselenggarakan pada:</p>
          </section>

          <section className="invitation-details mt-3 ml-6 max-w-xl text-[15px] leading-7">
            <div className="grid grid-cols-[6rem_1fr]"><strong>Hari</strong><strong>: {new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(new Date(`${event.tgl}T00:00:00`))}</strong></div>
            <div className="grid grid-cols-[6rem_1fr]"><strong>Tanggal</strong><strong>: {formatDate(event.tgl)}</strong></div>
            <div className="grid grid-cols-[6rem_1fr]"><strong>Waktu</strong><strong>: Pk. {event.waktuMulai.slice(0, 5)} - {event.waktuSelesai.slice(0, 5)} WIB</strong></div>
            <div className="grid grid-cols-[6rem_1fr]"><strong>Tempat</strong><strong>: {event.ruangNama ?? 'Belum ditentukan'}</strong></div>
            <div className="grid grid-cols-[6rem_1fr]"><strong>Instruktur</strong><strong>: {event.pengisiAcara ?? 'Belum ditentukan'}</strong></div>
          </section>

          <section className="mt-7 text-[15px] leading-7">
            <p>Adapun nama-nama peserta training <strong>&quot;{event.judul}&quot;</strong> sesuai dengan kebutuhan peningkatan skill data peserta pelatihan dari Dept./Sub Dept. adalah sebagai berikut:</p>
            <table className="invitation-participants mt-4 w-full border-collapse text-[13px] leading-5">
              <thead className="bg-[#D9D9D9]">
                <tr><th className="w-12 border-2 border-black px-2 py-2">No</th><th className="border-y-2 border-black px-3 py-2 text-left">Nama Peserta Pelatihan</th><th className="w-32 border-2 border-black px-2 py-2">NIK</th><th className="w-40 border-2 border-black px-2 py-2">Departemen</th></tr>
              </thead>
              <tbody>
              {event.participants.length > 0 ? event.participants.map((participant, index) => (
                <tr key={participant.nip}><td className="border-x border-b border-black px-2 py-1.5 text-center">{index + 1}</td><td className="border-b border-black px-3 py-1.5">{participant.name ?? '-'}</td><td className="border-b border-black px-2 py-1.5 text-center font-mono text-[11px]">{participant.nip}</td><td className="border-x border-b border-black px-2 py-1.5">{participant.department ?? '-'}</td></tr>
              )) : <tr><td colSpan={4} className="border border-black px-3 py-3 text-center">Belum ada peserta terdaftar.</td></tr>}
              </tbody>
            </table>
          </section>

          <footer className="mt-7 text-[15px] leading-7">
            <p>Demikian pemberitahuan ini kami sampaikan. Atas perhatian dan kerja samanya kami ucapkan terima kasih.</p>
            <div className="mt-8 grid grid-cols-2 gap-10 text-center">
              <div />
              <div><p>Hormat Kami,</p><div className="h-20" /><p className="border-b border-black font-bold">LELA HAMONG PRASETYO</p><p className="font-bold">Head of HC &amp; GS</p></div>
            </div>
            <p className="mt-8 text-[13px] font-bold italic">Note: Peserta training harap membawa alat tulis dan Handphone</p>
          </footer>
        </article>
      </div>
    </main>
  );
};
