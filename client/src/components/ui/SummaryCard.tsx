import type { ReactNode } from 'react';

type SummaryRow = { label: string; value: string; filled: boolean };

type SummaryCardProps = {
  title: string;
  description?: string;
  rows: SummaryRow[];
  children?: ReactNode;
};

export const SummaryCard = ({ title, description, rows, children }: SummaryCardProps) => (
  <div className="surface-card">
    <div className="border-b border-slate-200 px-4 py-3">
      <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
    </div>
    <dl className="divide-y divide-slate-100">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-4 px-4 py-2.5">
          <dt className="shrink-0 text-xs text-slate-500">{row.label}</dt>
          <dd
            className={`min-w-0 text-right text-sm break-words ${row.filled ? 'font-medium text-slate-900' : 'text-slate-400 italic'}`}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
    {children}
  </div>
);
