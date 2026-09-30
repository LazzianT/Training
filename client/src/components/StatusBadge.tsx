import type { EventStatus } from '@training/contracts';

const TONE: Record<EventStatus, string> = {
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  published: 'border-blue-200 bg-blue-50 text-blue-800',
  closed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  archived: 'border-slate-300 bg-white text-slate-500',
};

type StatusBadgeProps = {
  status: EventStatus;
  label: string;
};

export const StatusBadge = ({ status, label }: StatusBadgeProps) => (
  <span
    className={`inline-block whitespace-nowrap border px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] uppercase ${TONE[status]}`}
  >
    {label}
  </span>
);
