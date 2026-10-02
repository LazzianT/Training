type DistributionProps = {
  /** Label to count. Order is the display order, not sorted by value. */
  buckets: { label: string; value: number; count: number }[];
  total: number;
  caption: string;
};

/**
  A real distribution, not decoration: each bar length is the share of employees
  in that bucket, and every bar carries its own number and label as text, so the
  chart is never the only place the value appears.
*/
export const Distribution = ({ buckets, total, caption }: DistributionProps) => (
  <figure className="surface-card">
    <figcaption className="border-b border-slate-200 px-4 py-3">
      <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-900">Sebaran Training</h2>
      <p className="mt-0.5 text-xs text-slate-500">{caption}</p>
    </figcaption>
    <div className="grid gap-3 p-4">
      {buckets.map((bucket) => {
        const share = total === 0 ? 0 : bucket.count / total;
        return (
          <div key={bucket.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 text-xs text-slate-600">{bucket.label}</span>
            </div>
            <span className="text-sm font-semibold text-slate-900 tabular-nums">{bucket.count}</span>
            <div className="col-span-2 h-1.5 w-full bg-slate-100">
              <div
                className="h-full bg-slate-900 transition-[width] duration-300"
                style={{ width: `${Math.round(share * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  </figure>
);
