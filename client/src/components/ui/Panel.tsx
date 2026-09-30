import type { ReactNode } from 'react';

type PanelProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export const Panel = ({ title, description, action, children, className = '' }: PanelProps) => (
  <section className={`border border-slate-200 bg-white ${className}`}>
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-5">
      <div>
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {action}
    </header>
    {children}
  </section>
);

export const SkeletonTile = () => (
  <div className="border border-slate-200 bg-white px-4 py-4">
    <div className="h-3 w-24 bg-slate-100" />
    <div className="mt-3 h-8 w-16 bg-slate-100" />
  </div>
);

export const SkeletonPanel = ({ rows = 3 }: { rows?: number }) => (
  <div className="border border-slate-200 bg-white px-4 py-4 sm:px-5">
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="flex items-center justify-between gap-4 py-2.5">
        <div className="h-3 w-40 bg-slate-100" />
        <div className="h-3 w-10 bg-slate-100" />
      </div>
    ))}
  </div>
);
