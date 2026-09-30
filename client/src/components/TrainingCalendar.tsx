import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { DashboardEvent } from '@training/contracts';
import { EventList } from './EventList.js';
import { EmptyState } from './ui/index.js';
import { dateKey, longDate, todayKey } from '../lib/date.js';
const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTH_LABELS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Monday-first, matching the Indonesian work week. */
const mondayIndex = (date: Date) => (date.getDay() + 6) % 7;

type CalendarCell = {
  day: number | null;
  date: string | null;
  events: DashboardEvent[];
  isToday: boolean;
};

type TrainingCalendarProps = {
  year: number;
  month: number;
  events: DashboardEvent[];
};

export const TrainingCalendar = ({ year, month, events }: TrainingCalendarProps) => {
  const [selected, setSelected] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, DashboardEvent[]>();
    for (const event of events) {
      const list = map.get(event.tgl);
      if (list) list.push(event);
      else map.set(event.tgl, [event]);
    }
    return map;
  }, [events]);

  const today = useMemo(() => new Date(), []);
  const todayStamp = useMemo(() => todayKey(), [today]);
  const isViewingCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  // Default to today when the current month is in view, otherwise leave nothing
  // selected rather than inventing a focus the user did not ask for.
  useEffect(() => {
    setSelected(isViewingCurrentMonth ? todayStamp : null);
  }, [isViewingCurrentMonth, todayStamp, year, month]);

  const cells = useMemo<CalendarCell[]>(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const leading = mondayIndex(new Date(year, month - 1, 1));
    const total = Math.ceil((leading + daysInMonth) / 7) * 7;

    return Array.from({ length: total }, (_, index) => {
      const day = index - leading + 1;
      if (day < 1 || day > daysInMonth) {
        return { day: null, date: null, events: [], isToday: false };
      }
      const date = dateKey(year, month, day);
      return { day, date, events: byDate.get(date) ?? [], isToday: date === todayStamp };
    });
  }, [year, month, byDate, todayStamp]);

  const selectedEvents = selected ? (byDate.get(selected) ?? []) : [];
  const monthCount = events.length;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="lg:border-r lg:border-slate-200">
        <div className="grid grid-cols-7 border-b border-slate-200">
          {WEEKDAYS.map((label) => (
            <div
              key={label}
              className="px-1 py-2.5 text-center text-[10px] font-semibold tracking-[0.1em] text-slate-500 uppercase"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((cell, index) => {
            const isSelected = cell.date !== null && cell.date === selected;
            const hasEvents = cell.events.length > 0;
            return (
              <div
                key={cell.date ?? `blank-${index}`}
                className="min-h-16 border-r border-b border-slate-100 last:border-r-0 sm:min-h-20 [&:nth-child(7n)]:border-r-0"
              >
                {cell.date && (
                  <button
                    type="button"
                    onClick={() => setSelected(isSelected ? null : cell.date)}
                    aria-pressed={isSelected}
                    aria-label={`${cell.day} ${MONTH_LABELS[month - 1]} ${year}, ${cell.events.length} acara${
                      cell.isToday ? ', hari ini' : ''
                    }`}
                    className={[
                      'enter-cell flex h-full w-full flex-col items-start gap-1 p-1.5 outline-none transition duration-150 sm:p-2',
                      'focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset',
                      isSelected
                        ? 'bg-slate-900 text-white'
                        : hasEvents
                          ? 'text-slate-900 hover:bg-slate-50'
                          : 'text-slate-400 hover:bg-slate-50',
                    ].join(' ')}
                    style={{ '--enter-delay': `${Math.min(Math.floor(index / 7), 5) * 24}ms` } as CSSProperties}
                  >
                    <span
                      className={[
                        'flex h-5 w-5 items-center justify-center text-xs font-semibold tabular-nums',
                        cell.isToday && !isSelected ? 'underline decoration-2 underline-offset-2' : '',
                      ].join(' ')}
                    >
                      {cell.day}
                    </span>
                    {hasEvents && (
                      <span className="flex items-center gap-1">
                        <span
                          aria-hidden="true"
                          className={`block h-1.5 w-1.5 ${isSelected ? 'bg-white' : 'bg-slate-900'}`}
                        />
                        <span
                          className={`text-[10px] font-semibold tabular-nums ${
                            isSelected ? 'text-white/80' : 'text-slate-500'
                          }`}
                        >
                          {cell.events.length}
                        </span>
                      </span>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-200 lg:border-t-0">
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-xs font-semibold tracking-[0.08em] text-slate-500 uppercase">
            {selected ? longDate(selected) : `${MONTH_LABELS[month - 1]} ${year}`}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {monthCount} acara pada periode ini
          </p>
        </div>

        {selected === null ? (
          <EmptyState
            title="Pilih satu tanggal"
            description="Klik tanggal pada kalender untuk melihat daftar acara di hari tersebut."
          />
        ) : (
          <EventList
            events={selectedEvents}
            emptyTitle="Tidak ada acara"
            emptyDescription="Belum ada acara yang terjadwal pada tanggal ini."
          />
        )}
      </div>
    </div>
  );
};
