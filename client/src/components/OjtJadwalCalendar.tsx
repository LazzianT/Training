import { useEffect, useMemo, useRef, useState } from 'react';
import type { EmployeeLite, OjtJadwalMateri, OjtMateri } from '@training/contracts';
import { ApiRequestError } from '../api/auth.js';
import { searchEmployees } from '../api/employees.js';
import { Button, Field, Panel } from './ui/index.js';
import { Modal } from './Modal.js';
import { useToast } from './Toast.js';

const DAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Local date parts, not UTC: toISOString() shifts a midnight date back a day east of Greenwich. */
const parseDate = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

/** The shape the calendar hands back, named for the page that consumes it. */
export type JadwalFormInput = {
  namaMateri: string;
  jamMulai: string;
  jamSelesai: string;
  pengisiNip: string;
  pengisiNama: string;
  catatan: string;
};

const emptyForm = (): JadwalFormInput => ({
  namaMateri: '',
  jamMulai: '',
  jamSelesai: '',
  pengisiNip: '',
  pengisiNama: '',
  catatan: '',
});

type Props = {
  token: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  materi: OjtMateri[];
  jadwal: OjtJadwalMateri[];
  onCreate: (tanggal: string, body: JadwalFormInput) => Promise<void>;
  onUpdate: (jadwalId: number, body: Partial<JadwalFormInput>) => Promise<void>;
  onDelete: (jadwalId: number) => Promise<void>;
};

/**
 * A month grid over the batch's own window. Days outside the window are shown
 * disabled rather than hidden, so it stays obvious where the batch starts and
 * ends instead of looking like a normal month that happens to be sparse.
 */
export const OjtJadwalCalendar = ({
  token,
  tanggalMulai,
  tanggalSelesai,
  materi,
  jadwal,
  onCreate,
  onUpdate,
  onDelete,
}: Props) => {
  const { push } = useToast();
  const start = useMemo(() => parseDate(tanggalMulai), [tanggalMulai]);
  const end = useMemo(() => parseDate(tanggalSelesai), [tanggalSelesai]);

  const [cursor, setCursor] = useState(() => new Date(start.getFullYear(), start.getMonth(), 1));
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [form, setForm] = useState<JadwalFormInput>(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const byDate = useMemo(() => {
    const map = new Map<string, OjtJadwalMateri[]>();
    for (const item of jadwal) {
      const list = map.get(item.tanggal) ?? [];
      list.push(item);
      map.set(item.tanggal, list);
    }
    return map;
  }, [jadwal]);

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    // getDay() is Sunday-first; the grid starts Monday, so shift it.
    const lead = (first.getDay() + 6) % 7;
    const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
    const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= total; day += 1) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const shift = (months: number) => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + months, 1));

  const dayForm = (item: OjtJadwalMateri): JadwalFormInput => ({
    namaMateri: item.materiNama,
    jamMulai: item.jamMulai ?? '',
    jamSelesai: item.jamSelesai ?? '',
    pengisiNip: item.pengisiNip ?? '',
    pengisiNama: item.pengisiNama ?? '',
    catatan: item.catatan ?? '',
  });

  const closeDay = () => {
    setOpenDate(null);
    setEditingId(null);
    setForm(emptyForm());
  };

  const openDay = (iso: string) => {
    setOpenDate(iso);
    setEditingId(null);
    setForm(emptyForm());
  };

  const editEntry = (item: OjtJadwalMateri) => {
    setOpenDate(item.tanggal);
    setEditingId(item.id);
    setForm(dayForm(item));
  };

  const submit = async () => {
    if (!openDate) return;
    setSaving(true);
    try {
      /*
        Editing goes through onUpdate rather than delete plus create, so the
        schedule keeps its id and anything else pointing at it stays attached.
      */
      if (editingId !== null) {
        await onUpdate(editingId, { ...form });
      } else {
        await onCreate(openDate, form);
      }
      closeDay();
    } catch (error) {
      push({
        tone: 'danger',
        title: editingId !== null ? 'Perubahan gagal disimpan' : 'Materi gagal dijadwalkan',
        description: error instanceof ApiRequestError ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const existing = openDate ? (byDate.get(openDate) ?? []) : [];

  return (
    <>
      <Panel
        title="Jadwal Materi"
        description="Klik tanggal untuk mengisi materi dan pengisinya."
        className="enter-section mt-8"
        action={
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Bulan sebelumnya"
              onClick={() => shift(-1)}
              className="flex h-9 w-9 items-center justify-center border border-slate-300 text-slate-700 outline-none transition duration-150 hover:border-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M10 3L5 8l5 5" strokeLinecap="square" />
              </svg>
            </button>
            <span className="min-w-[7.5rem] text-center text-sm font-semibold text-slate-900">
              {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <button
              type="button"
              aria-label="Bulan berikutnya"
              onClick={() => shift(1)}
              className="flex h-9 w-9 items-center justify-center border border-slate-300 text-slate-700 outline-none transition duration-150 hover:border-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M6 3l5 5-5 5" strokeLinecap="square" />
              </svg>
            </button>
          </div>
        }
      >
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-7 border-l border-t border-slate-200">
            {DAY_HEADERS.map((label, index) => (
              <div
                key={label}
                className={`border-r border-b border-slate-200 py-2 text-center text-[11px] font-semibold tracking-[0.1em] uppercase ${
                  index >= 5 ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <span className="sr-only">{label}</span>
                <span aria-hidden="true">{label.slice(0, 1)}</span>
              </div>
            ))}

            {days.map((date, index) => {
              if (!date) return <div key={`pad-${index}`} className="border-r border-b border-slate-200" />;

              const iso = toIso(date);
              const inBatch = date >= start && date <= end;
              const weekend = isWeekend(date);
              const entries = byDate.get(iso) ?? [];

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!inBatch}
                  onClick={() => openDay(iso)}
                  aria-label={`${iso}, ${entries.length} materi`}
                  className={`min-h-24 border-r border-b border-slate-200 p-1.5 text-left align-top outline-none transition duration-150 ${
                    inBatch
                      ? 'bg-white hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset'
                      : 'bg-slate-50'
                  } ${weekend && inBatch ? 'bg-slate-50/70' : ''}`}
                >
                  <span
                    className={`block text-xs font-semibold tabular-nums ${
                      !inBatch ? 'text-slate-300' : entries.length > 0 ? 'text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {entries.slice(0, 2).map((item) => (
                    <span
                      key={item.id}
                      className="mt-1 block truncate border border-slate-900 bg-slate-900 px-1 py-0.5 text-[10px] font-medium text-white"
                    >
                      {item.materiNama}
                    </span>
                  ))}
                  {entries.length > 2 && (
                    <span className="mt-0.5 block text-[10px] font-semibold text-slate-500">
                      +{entries.length - 2} lagi
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {!inBatchHint(start, end, cursor) && (
            <p className="mt-3 text-xs text-slate-500">
              Batch berjalan {tanggalMulai} sampai {tanggalSelesai}. Tanggal di luar rentang itu tidak bisa diklik.
            </p>
          )}
        </div>
      </Panel>

      <Modal
        open={openDate !== null}
        onClose={() => setOpenDate(null)}
        title={openDate ? `Materi pada ${openDate}` : 'Materi'}
        description="Nama materi yang belum ada akan masuk ke katalog dan bisa dipakai lagi di batch lain."
        size="lg"
        footer={
          <>
            {editingId !== null && (
              <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setForm(emptyForm()); }}>
                Batal ubah
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={closeDay}>
              Tutup
            </Button>
            <Button type="button" disabled={saving || !form.namaMateri.trim()} onClick={submit}>
              {saving ? 'Menyimpan...' : editingId !== null ? 'Simpan Perubahan' : 'Simpan Materi'}
            </Button>
          </>
        }
      >
        <div className="space-y-5 p-5">
          {existing.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-[0.1em] text-slate-500 uppercase">
                Sudah ada di tanggal ini
              </p>
              <ul className="mt-2 divide-y divide-slate-100 border border-slate-200">
                {existing.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{item.materiNama}</p>
                      <p className="text-xs text-slate-500">
                        {[item.jamMulai && item.jamSelesai ? `${item.jamMulai}-${item.jamSelesai}` : null, item.pengisiNama]
                          .filter(Boolean)
                          .join(' · ') || 'Tanpa pengisi'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => editEntry(item)}
                        className="text-xs font-semibold text-slate-900 underline underline-offset-4 outline-none transition duration-150 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                      >
                        Ubah
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await onDelete(item.id);
                          } catch (error) {
                            push({
                              tone: 'danger',
                              title: 'Materi gagal dihapus',
                              description: error instanceof ApiRequestError ? error.message : undefined,
                            });
                          }
                        }}
                        className="text-xs font-semibold text-red-600 underline underline-offset-4 outline-none transition duration-150 hover:text-red-800 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                      >
                        Hapus
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Field id="ojt-nama-materi" label="Nama materi" hint="Ketik nama baru, atau pilih dari katalog.">
            {(field) => (
              <>
                <input
                  list="ojt-katalog-materi"
                  value={form.namaMateri}
                  onChange={(change) => setForm({ ...form, namaMateri: change.target.value })}
                  placeholder="Safety Induction"
                  autoComplete="off"
                  {...field}
                  className={field.className}
                />
                <datalist id="ojt-katalog-materi">
                  {materi.map((item) => (
                    <option key={item.id} value={item.nama} />
                  ))}
                </datalist>
              </>
            )}
          </Field>

          <PengisiField token={token} form={form} onChange={setForm} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ojt-jam-mulai" label="Jam mulai" optional>
              {(field) => (
                <input
                  type="time"
                  value={form.jamMulai}
                  onChange={(change) => setForm({ ...form, jamMulai: change.target.value })}
                  {...field}
                  className={field.className}
                />
              )}
            </Field>
            <Field id="ojt-jam-selesai" label="Jam selesai" optional>
              {(field) => (
                <input
                  type="time"
                  value={form.jamSelesai}
                  onChange={(change) => setForm({ ...form, jamSelesai: change.target.value })}
                  {...field}
                  className={field.className}
                />
              )}
            </Field>
          </div>

          <Field id="ojt-catatan-materi" label="Catatan" optional>
            {(field) => (
              <textarea
                rows={2}
                value={form.catatan}
                onChange={(change) => setForm({ ...form, catatan: change.target.value })}
                {...field}
                className={field.className}
              />
            )}
          </Field>
        </div>
      </Modal>
    </>
  );
};

/** True when the visible month overlaps the batch window at all. */
const inBatchHint = (start: Date, end: Date, cursor: Date) =>
  new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0) >= start &&
  new Date(cursor.getFullYear(), cursor.getMonth(), 1) <= end;

/**
 * Presenter picker over the HRIS employee list.
 *
 * Type to search, click to choose. A plain free text field was tried first and
 * rejected: an NIP is only four digits, so a typo lands on a real employee and
 * nobody notices until the schedule turns out to be assigned to the wrong person.
 */
const PengisiField = ({
  token,
  form,
  onChange,
}: {
  token: string;
  form: JadwalFormInput;
  onChange: (next: JadwalFormInput) => void;
}) => {
  const [term, setTerm] = useState('');
  const [options, setOptions] = useState<EmployeeLite[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const skipNextSearch = useRef(false);

  useEffect(() => {
    // Choosing from the list already fills the field; searching again for the
    // chosen name would replace the options with a single row.
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (term.trim().length < 2) {
      setOptions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchEmployees(token, term.trim(), controller.signal)
        .then(setOptions)
        .catch(() => undefined);
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [token, term]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const chosen = Boolean(form.pengisiNip);

  return (
    <Field
      id="ojt-pengisi"
      label="Pengisi materi"
      optional
      hint="Cari nama atau NIP karyawan internal."
    >
      {(field) => (
        <div className="relative" ref={boxRef}>
          <input
            value={chosen ? form.pengisiNama : term}
            onChange={(change) => {
              setTerm(change.target.value);
              onChange({ ...form, pengisiNip: '', pengisiNama: '' });
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Cari pengisi..."
            autoComplete="off"
            {...field}
            className={`${field.className} ${chosen ? 'pr-24' : ''}`}
          />
          {chosen && (
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-slate-500">
              {form.pengisiNip}
            </span>
          )}
          {open && options.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto border border-slate-200 bg-white shadow-lg">
              {options.map((person) => (
                <li key={person.nip}>
                  <button
                    type="button"
                    onClick={() => {
                      skipNextSearch.current = true;
                      setTerm(person.name);
                      onChange({ ...form, pengisiNip: person.nip, pengisiNama: person.name });
                      setOpen(false);
                    }}
                    className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left outline-none transition duration-150 hover:bg-slate-50 focus-visible:bg-slate-50"
                  >
                    <span className="truncate text-sm text-slate-900">{person.name}</span>
                    <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                      {person.nip}
                      {person.departmentName ? ` · ${person.departmentName}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {chosen && (
            <button
              type="button"
              onClick={() => {
                skipNextSearch.current = true;
                setTerm('');
                onChange({ ...form, pengisiNip: '', pengisiNama: '' });
              }}
              className="mt-1.5 text-xs font-semibold text-slate-900 underline underline-offset-4 outline-none transition duration-150 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              Ganti pengisi
            </button>
          )}
        </div>
      )}
    </Field>
  );
};
