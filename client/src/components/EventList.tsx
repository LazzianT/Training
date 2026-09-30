import { Link } from 'react-router-dom';
import type { DashboardEvent } from '@training/contracts';
import { EmptyState } from './ui/index.js';
import { daysFromToday, isToday, monthShort, relativeDay, timeRange } from '../lib/date.js';

type EventListProps = {
  events: DashboardEvent[];
  emptyTitle: string;
  emptyDescription: string;
  showRelativeDay?: boolean;
};

export const EventList = ({ events, emptyTitle, emptyDescription, showRelativeDay = false }: EventListProps) => {
  if (events.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {events.map((event) => {
        const imminent = showRelativeDay && daysFromToday(event.tgl) <= 1;
        return (
          <li key={event.id}>
            <Link
              to={`/events/${event.id}`}
              className="flex items-center gap-4 px-4 py-3.5 transition duration-150 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset focus-visible:outline-none sm:px-5"
            >
              <div className="w-11 shrink-0">
                <p className="text-lg leading-none font-semibold text-slate-900 tabular-nums">
                  {event.tgl.slice(8, 10)}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
                  {monthShort(event.tgl)}
                </p>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{event.judul}</p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {timeRange(event.waktuMulai, event.waktuSelesai)}
                  {event.ruangNama ? ` · ${event.ruangNama}` : ''}
                  {` · ${event.pesertaCount} peserta`}
                </p>
              </div>

              <div className="shrink-0 text-right">
                {showRelativeDay && (
                  <p className="flex items-center justify-end gap-1.5 text-xs font-semibold text-slate-600">
                    {imminent && (
                      <>
                        <span aria-hidden="true" className="imminent-dot block h-1.5 w-1.5 rounded-full bg-blue-600" />
                        <span className="sr-only">Segera: </span>
                      </>
                    )}
                    <span className={imminent ? 'text-blue-700' : undefined}>{relativeDay(event.tgl)}</span>
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500 capitalize">
                  {isToday(event.tgl) ? 'Hari ini' : event.status}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
};
