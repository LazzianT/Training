import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CreateEventRequest, EventStatus, Room } from '@training/contracts';
import { EVENT_STATUSES, EVENT_STATUS_LABEL } from '@training/contracts';
import { useAuth } from '../auth/AuthContext.js';
import { createEvent, fetchRooms } from '../api/events.js';
import { searchEmployees } from '../api/employees.js';
import { ApiRequestError } from '../api/auth.js';

const LABEL = 'block text-[11.5px] font-semibold tracking-[0.14em] uppercase text-[#55697C]';
const FIELD =
  'mt-2 block w-full border border-[#0A2942]/25 bg-white px-3 py-2.5 text-[15px] text-[#0A2942] shadow-[0_1px_0_rgba(10,41,66,0.05)] focus:border-[#8A5A17] focus:ring-2 focus:ring-[#D9A441]/25 focus:outline-none';
const INVALID = 'border-[#B42318] focus:border-[#B42318]';

type Errors = Record<string, string | undefined>;

export const EventForm = () => {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
   const [rooms, setRooms] = useState<Room[]>([]);
   const [errors, setErrors] = useState<Errors>({});
   const [formError, setFormError] = useState('');
   const [saving, setSaving] = useState(false);
   const [trainerType, setTrainerType] = useState<'internal' | 'external'>('internal');
   const [trainerNip, setTrainerNip] = useState('');
   const [trainerName, setTrainerName] = useState('');
   const [trainerQuery, setTrainerQuery] = useState('');
   const [employees, setEmployees] = useState<{ nip: string; name: string; departId: string | null }[]>([]);

  const [form, setForm] = useState({
    judul: '',
    tgl: '',
    waktuMulai: '',
    waktuSelesai: '',
    sasaran: '',
    materiPokok: '',
    ruangId: '',
    status: 'draft' as EventStatus,
  });

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    fetchRooms(session.accessToken, controller.signal)
      .then(setRooms)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof ApiRequestError && err.status === 401) signOut();
      });
    return () => controller.abort();
  }, [session, signOut]);

  useEffect(() => {
    if (!session || trainerType !== 'internal' || trainerQuery.trim().length < 1) {
      setEmployees([]);
      return;
    }
    const controller = new AbortController();
    searchEmployees(session.accessToken, trainerQuery, controller.signal)
      .then(setEmployees)
      .catch((err: unknown) => {
        if (err instanceof ApiRequestError && err.status === 401) signOut();
      });
    return () => controller.abort();
  }, [session, signOut, trainerQuery, trainerType]);

  const set = (key: keyof typeof form, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;
    setFormError('');
    setErrors({});
    setSaving(true);

    const body: CreateEventRequest = {
      judul: form.judul,
      tgl: form.tgl,
      waktuMulai: form.waktuMulai,
      waktuSelesai: form.waktuSelesai,
      sasaran: form.sasaran,
      materiPokok: form.materiPokok || null,
      ruangId: form.ruangId ? Number(form.ruangId) : null,
      status: form.status,
      pengisiAcara: {
        type: trainerType,
        nip: trainerType === 'internal' ? trainerNip : undefined,
        name: trainerName,
      },
    };

   try {
       await createEvent(session.accessToken, body);
       navigate('/events', { replace: true });
     } catch (err) {
       if (err instanceof ApiRequestError && err.status === 401) {
         signOut();
         return;
       }
       if (err instanceof ApiRequestError && err.details) {
         const flat: Errors = {};
         for (const [field, messages] of Object.entries(err.details)) {
           if (Array.isArray(messages) && messages[0]) flat[field] = messages[0];
         }
         setErrors(flat);
         if (Object.keys(flat).length === 0) setFormError(err.message);
        } else {
         setFormError(err instanceof ApiRequestError ? err.message : 'Gagal menyimpan acara.');
       }
     } finally {
       setSaving(false);
     }
   };

  return (
    <>
      <header className="border-b border-[#0A2942]/15 pb-5">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[#8A5A17] uppercase">Manajemen Training</p>
        <h1 className="mt-1 text-[1.9rem] leading-tight font-semibold text-[#0A2942]">Input New Event</h1>
        <p className="mt-2 text-[14px] text-[#55697C]">
          Waktu selesai harus lebih besar dari waktu mulai.
        </p>
      </header>

      {formError && (
        <div
          role="alert"
          className="mt-6 border-l-2 border-[#B42318] bg-[#B42318]/8 py-2.5 pl-3.5 pr-3 text-[13.5px] text-[#8A1C14]"
        >
          {formError}
        </div>
      )}

      <form onSubmit={submit} className="mt-6 max-w-[48rem] border border-[#0A2942]/15 bg-[#FAF8F3] px-5 py-6 shadow-[0_3px_0_rgba(10,41,66,0.08)] sm:px-7 sm:py-7" noValidate>
        <div className="grid gap-5">
           <div>
             <label className={LABEL}>Pengisi Acara</label>
             <div className="mt-2 flex gap-4 text-sm text-[#0A2942]">
               {(['internal', 'external'] as const).map((type) => (
                 <label key={type} className="flex items-center gap-2">
                   <input type="radio" name="trainerType" checked={trainerType === type} onChange={() => {
                     setTrainerType(type); setTrainerNip(''); setTrainerName(''); setTrainerQuery('');
                   }} />
                   {type === 'internal' ? 'Internal' : 'Eksternal'}
                 </label>
               ))}
             </div>
             {trainerType === 'internal' ? (
               <div className="relative">
                 <input
                   type="search"
                   value={trainerNip ? `${trainerName} (${trainerNip})` : trainerQuery}
                   onChange={(event) => { setTrainerNip(''); setTrainerName(''); setTrainerQuery(event.target.value); }}
                   placeholder="Cari NIP atau nama karyawan"
                   className={`${FIELD} ${errors.pengisiAcara ? INVALID : ''}`}
                 />
                 {employees.length > 0 && !trainerNip && (
                   <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto border border-[#D6CDBF] bg-white shadow-lg">
                     {employees.map((employee) => (
                       <li key={employee.nip}>
                         <button type="button" className="flex w-full gap-2 px-3 py-2 text-left text-sm hover:bg-[#F5F5F4]" onClick={() => {
                           setTrainerNip(employee.nip); setTrainerName(employee.name); setTrainerQuery(''); setEmployees([]);
                         }}>
                           <span className="font-mono text-xs text-[#78716C]">{employee.nip}</span><span>{employee.name}</span>
                         </button>
                       </li>
                     ))}
                   </ul>
                 )}
               </div>
             ) : (
               <input type="text" value={trainerName} onChange={(event) => setTrainerName(event.target.value)} placeholder="Nama pengisi acara eksternal" className={`${FIELD} ${errors.pengisiAcara ? INVALID : ''}`} />
             )}
             {errors.pengisiAcara && <p className="mt-1.5 text-[12.5px] text-[#B42318]">{errors.pengisiAcara}</p>}
           </div>

           <div>
            <label htmlFor="judul" className={LABEL}>
              Judul
            </label>
            <input
              id="judul"
              type="text"
              value={form.judul}
              onChange={(e) => set('judul', e.target.value)}
              aria-invalid={Boolean(errors.judul)}
              aria-describedby={errors.judul ? 'judul-error' : undefined}
              placeholder="Contoh: Workshop Keamanan Informasi"
              className={`${FIELD} ${errors.judul ? INVALID : ''}`}
            />
            {errors.judul && (
              <p id="judul-error" className="mt-1.5 text-[12.5px] text-[#B42318]">
                {errors.judul}
              </p>
            )}
          </div>

          <div className="border-t border-[#0A2942]/10 pt-5 grid gap-5 sm:grid-cols-3">
            <div>
              <label htmlFor="tgl" className={LABEL}>
                Tanggal
              </label>
              <input
                id="tgl"
                type="date"
                value={form.tgl}
                onChange={(e) => set('tgl', e.target.value)}
                aria-invalid={Boolean(errors.tgl)}
                className={`${FIELD} ${errors.tgl ? INVALID : ''}`}
              />
              {errors.tgl && <p className="mt-1.5 text-[12.5px] text-[#B42318]">{errors.tgl}</p>}
            </div>

            <div>
              <label htmlFor="waktuMulai" className={LABEL}>
                Mulai
              </label>
              <input
                id="waktuMulai"
                type="time"
                value={form.waktuMulai}
                onChange={(e) => set('waktuMulai', e.target.value)}
                aria-invalid={Boolean(errors.waktuMulai)}
                className={`${FIELD} ${errors.waktuMulai ? INVALID : ''}`}
              />
              {errors.waktuMulai && (
                <p className="mt-1.5 text-[12.5px] text-[#B42318]">{errors.waktuMulai}</p>
              )}
            </div>

            <div>
              <label htmlFor="waktuSelesai" className={LABEL}>
                Selesai
              </label>
              <input
                id="waktuSelesai"
                type="time"
                value={form.waktuSelesai}
                onChange={(e) => set('waktuSelesai', e.target.value)}
                aria-invalid={Boolean(errors.waktuSelesai)}
                aria-describedby={errors.waktuSelesai ? 'waktuSelesai-error' : undefined}
                className={`${FIELD} ${errors.waktuSelesai ? INVALID : ''}`}
              />
              {errors.waktuSelesai && (
                <p id="waktuSelesai-error" className="mt-1.5 text-[12.5px] text-[#B42318]">
                  {errors.waktuSelesai}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-[#0A2942]/10 pt-5">
            <label htmlFor="sasaran" className={LABEL}>
              Sasaran
            </label>
            <textarea
              id="sasaran"
              rows={3}
              value={form.sasaran}
              onChange={(e) => set('sasaran', e.target.value)}
              aria-invalid={Boolean(errors.sasaran)}
              aria-describedby={errors.sasaran ? 'sasaran-error' : undefined}
              placeholder="Siapa saja yang seharusnya mengikuti acara ini"
              className={`mt-2 block w-full resize-y border border-[#0A2942]/25 bg-transparent px-3 py-2 text-[15px] text-[#0A2942] placeholder:text-[#55697C]/55 focus:border-[#8A5A17] focus:ring-0 focus:outline-none ${errors.sasaran ? INVALID : ''}`}
            />
            {errors.sasaran && (
              <p id="sasaran-error" className="mt-1.5 text-[12.5px] text-[#B42318]">
                {errors.sasaran}
              </p>
            )}
          </div>

          <div className="border-t border-[#0A2942]/10 pt-5">
            <label htmlFor="materiPokok" className={LABEL}>
              Materi Pokok <span className="font-normal normal-case">(opsional)</span>
            </label>
            <textarea
              id="materiPokok"
              rows={3}
              value={form.materiPokok}
              onChange={(e) => set('materiPokok', e.target.value)}
              className="mt-2 block w-full resize-y border border-[#0A2942]/25 bg-transparent px-3 py-2 text-[15px] text-[#0A2942] focus:border-[#8A5A17] focus:ring-0 focus:outline-none"
            />
          </div>

          <div className="border-t border-[#0A2942]/10 pt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="ruangId" className={LABEL}>
                Ruang
              </label>
              <select
                id="ruangId"
                value={form.ruangId}
                onChange={(e) => set('ruangId', e.target.value)}
                className={`${FIELD} ${errors.ruangId ? INVALID : ''}`}
              >
                <option value="">Belum ditentukan</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.namaRuangan}
                  </option>
                ))}
              </select>
              {rooms.length === 0 && (
                <p className="mt-1.5 text-[12.5px] text-[#55697C]">
                  Belum ada ruang terdaftar, acara disimpan tanpa ruang.
                </p>
              )}
              {errors.ruangId && <p className="mt-1.5 text-[12.5px] text-[#B42318]">{errors.ruangId}</p>}
            </div>

            <div>
              <label htmlFor="status" className={LABEL}>
                Status
              </label>
              <select
                id="status"
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                className={`${FIELD} ${errors.status ? INVALID : ''}`}
              >
                {EVENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {EVENT_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
              {errors.status && <p className="mt-1.5 text-[12.5px] text-[#B42318]">{errors.status}</p>}
            </div>
          </div>
         </div>

         <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-[#0A2942] px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#16405F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A5A17] active:translate-y-px disabled:translate-y-0 disabled:cursor-wait"
          >
            {saving ? 'Menyimpan...' : 'Simpan Acara'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/events')}
            className="border border-[#0A2942]/25 px-5 py-3 text-[15px] font-semibold text-[#0A2942] transition-colors hover:border-[#0A2942] hover:bg-[#0A2942]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A5A17]"
          >
            Batal
          </button>
        </div>
      </form>
    </>
  );
};
