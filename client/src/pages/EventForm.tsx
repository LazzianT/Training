import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CreateEventRequest, EventStatus, Room } from '@training/contracts';
import { EVENT_STATUSES, EVENT_STATUS_LABEL } from '@training/contracts';
import { useAuth } from '../auth/AuthContext.js';
import { createEvent, fetchRooms } from '../api/events.js';
import { searchEmployees } from '../api/employees.js';
import { ApiRequestError } from '../api/auth.js';
import {
  Button,
  Field,
  FormSection,
  Segmented,
  SummaryCard,
  inputClass,
  selectClass,
  textareaClass,
} from '../components/ui/index.js';
import { longDate, timeRange } from '../lib/date.js';

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

  const resetTrainer = (type: 'internal' | 'external') => {
    setTrainerType(type);
    setTrainerNip('');
    setTrainerName('');
    setTrainerQuery('');
  };

  const roomName = rooms.find((room) => String(room.id) === form.ruangId)?.namaRuangan;

  const summary = useMemo(() => {
    const trainerFilled = trainerType === 'internal' ? trainerNip.length > 0 : trainerName.trim().length > 0;
    const rows = [
      { label: 'Judul', value: form.judul.trim() || 'Belum diisi', filled: form.judul.trim().length > 0 },
      { label: 'Tanggal', value: form.tgl ? longDate(form.tgl) : 'Belum diisi', filled: form.tgl.length > 0 },
      {
        label: 'Waktu',
        value: form.waktuMulai && form.waktuSelesai ? timeRange(form.waktuMulai, form.waktuSelesai) : 'Belum diisi',
        filled: form.waktuMulai.length > 0 && form.waktuSelesai.length > 0,
      },
      { label: 'Ruang', value: roomName ?? 'Belum ditentukan', filled: roomName !== undefined },
      { label: 'Pengisi', value: trainerFilled ? (trainerName || trainerNip) : 'Belum diisi', filled: trainerFilled },
      { label: 'Status', value: EVENT_STATUS_LABEL[form.status], filled: true },
    ];
    return { rows, complete: rows.every((row) => row.filled) };
  }, [form, roomName, trainerName, trainerNip]);

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
    <div data-surface="saas">
      <header className="enter-section border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">Buat Acara</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Waktu selesai harus lebih besar dari waktu mulai.
        </p>
      </header>

      {formError && (
        <div role="alert" className="mt-6 border border-red-500 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {formError}
        </div>
      )}

      <form onSubmit={submit} className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" noValidate>
        <div className="grid gap-7 border border-slate-200 bg-white p-5 sm:p-7">
          <FormSection title="Identitas Acara">
            <Field id="judul" label="Judul" error={errors.judul}>
              {(field) => (
                <input
                  type="text"
                  value={form.judul}
                  onChange={(e) => set('judul', e.target.value)}
                  placeholder="Contoh: Workshop Keamanan Informasi"
                  {...field}
                  className={field.className}
                />
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field id="tgl" label="Tanggal" error={errors.tgl}>
                {(field) => (
                  <input
                    type="date"
                    value={form.tgl}
                    onChange={(e) => set('tgl', e.target.value)}
                    {...field}
                    className={field.className}
                  />
                )}
              </Field>
              <Field id="waktuMulai" label="Mulai" error={errors.waktuMulai}>
                {(field) => (
                  <input
                    type="time"
                    value={form.waktuMulai}
                    onChange={(e) => set('waktuMulai', e.target.value)}
                    {...field}
                    className={field.className}
                  />
                )}
              </Field>
              <Field id="waktuSelesai" label="Selesai" error={errors.waktuSelesai}>
                {(field) => (
                  <input
                    type="time"
                    value={form.waktuSelesai}
                    onChange={(e) => set('waktuSelesai', e.target.value)}
                    {...field}
                    className={field.className}
                  />
                )}
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="ruangId"
                label="Ruang"
                error={errors.ruangId}
                hint={rooms.length === 0 ? 'Belum ada ruang terdaftar, acara disimpan tanpa ruang.' : undefined}
              >
                {(field) => (
                  <select
                    value={form.ruangId}
                    onChange={(e) => set('ruangId', e.target.value)}
                    {...field}
                    className={selectClass(Boolean(errors.ruangId))}
                  >
                    <option value="">Belum ditentukan</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.namaRuangan}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field id="status" label="Status" error={errors.status}>
                {(field) => (
                  <select
                    value={form.status}
                    onChange={(e) => set('status', e.target.value)}
                    {...field}
                    className={selectClass(Boolean(errors.status))}
                  >
                    {EVENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {EVENT_STATUS_LABEL[status]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </FormSection>

          <FormSection title="Pengisi Acara">
            <Segmented
              name="trainerType"
              legend="Asal pengisi"
              value={trainerType}
              onChange={resetTrainer}
              options={[
                { value: 'internal', label: 'Internal', hint: 'dari HR' },
                { value: 'external', label: 'Eksternal', hint: 'manual' },
              ]}
            />

            <Field
              id="trainer"
              label={trainerType === 'internal' ? 'Cari karyawan' : 'Nama pengisi eksternal'}
              error={errors.pengisiAcara}
              hint={trainerType === 'internal' ? 'Pilih dari data HR. Nama pengisi ikut terisi otomatis.' : undefined}
            >
              {(field) =>
                trainerType === 'internal' ? (
                  <div className="relative">
                    <input
                      type="search"
                      value={trainerNip ? `${trainerName} (${trainerNip})` : trainerQuery}
                      onChange={(e) => {
                        setTrainerNip('');
                        setTrainerName('');
                        setTrainerQuery(e.target.value);
                      }}
                      placeholder="Cari NIP atau nama karyawan"
                      {...field}
                      className={field.className}
                    />
                    {employees.length > 0 && !trainerNip && (
                      <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto border border-slate-200 bg-white">
                        {employees.map((employee) => (
                          <li key={employee.nip}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-900 outline-none transition duration-150 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset"
                              onClick={() => {
                                setTrainerNip(employee.nip);
                                setTrainerName(employee.name);
                                setTrainerQuery('');
                                setEmployees([]);
                              }}
                            >
                              <span className="text-xs text-slate-500 tabular-nums">{employee.nip}</span>
                              <span>{employee.name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={trainerName}
                    onChange={(e) => setTrainerName(e.target.value)}
                    placeholder="Nama pengisi acara eksternal"
                    {...field}
                    className={inputClass(Boolean(errors.pengisiAcara))}
                  />
                )
              }
            </Field>
          </FormSection>

          <FormSection title="Isian">
            <Field id="sasaran" label="Sasaran" error={errors.sasaran}>
              {(field) => (
                <textarea
                  rows={3}
                  value={form.sasaran}
                  onChange={(e) => set('sasaran', e.target.value)}
                  placeholder="Siapa saja yang seharusnya mengikuti acara ini"
                  {...field}
                  className={textareaClass(Boolean(errors.sasaran))}
                />
              )}
            </Field>
            <Field id="materiPokok" label="Materi pokok" optional>
              {(field) => (
                <textarea
                  rows={3}
                  value={form.materiPokok}
                  onChange={(e) => set('materiPokok', e.target.value)}
                  {...field}
                  className={field.className}
                />
              )}
            </Field>
          </FormSection>
        </div>

        <aside className="enter-section lg:sticky lg:top-6" style={{ '--enter-delay': '80ms' } as CSSProperties}>
          <SummaryCard
            title="Ringkasan Acara"
            description="Data ini yang akan tersimpan."
            rows={summary.rows}
          >
            <p
              className={`border-t border-slate-200 px-4 py-3 text-xs ${
                summary.complete ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              {summary.complete
                ? 'Semua kolom wajib sudah terisi.'
                : 'Kolom yang belum terisi akan tersimpan kosong.'}
            </p>
          </SummaryCard>

          <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 border border-slate-200 bg-white p-3">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? 'Menyimpan...' : 'Simpan Acara'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/events')}>
              Batal
            </Button>
          </div>
        </aside>
      </form>
    </div>
  );
};
