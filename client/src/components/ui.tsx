import type { ReactNode } from 'react';

type StatTileProps = {
  label: string;
  value: string;
  unit?: string;
  note?: string;
};

export const StatTile = ({ label, value, unit, note }: StatTileProps) => (
  <div className="border border-slate-200 bg-white px-4 py-4">
    <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">{label}</p>
    <p className="mt-2 text-3xl leading-none font-semibold text-slate-900 tabular-nums">
      {value}
      {unit && <span className="ml-1 text-sm font-medium text-slate-500">{unit}</span>}
    </p>
    {note && <p className="mt-1.5 text-xs text-slate-500">{note}</p>}
  </div>
);

type PanelProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
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

type EmptyStateProps = {
  title: string;
  description: string;
};

export const EmptyState = ({ title, description }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-12 text-center">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-6 w-6 text-slate-300"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="15" strokeLinecap="square" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" strokeLinecap="square" />
    </svg>
    <p className="mt-1 text-sm font-semibold text-slate-900">{title}</p>
    <p className="max-w-xs text-xs leading-relaxed text-slate-500">{description}</p>
  </div>
);

/* ---------------------------------------------------------------- form layer */

const controlBase =
  'block w-full border bg-white px-3 text-sm text-slate-900 outline-none transition duration-150 placeholder:text-slate-500 hover:border-slate-400 focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:bg-slate-50 disabled:text-slate-500';

export const inputClass = (invalid?: boolean) =>
  `${controlBase} h-11 ${invalid ? 'border-red-500' : 'border-slate-300'}`;

export const textareaClass = (invalid?: boolean) =>
  `${controlBase} resize-y py-2.5 ${invalid ? 'border-red-500' : 'border-slate-300'}`;

export const selectClass = (invalid?: boolean) =>
  `${controlBase} h-11 ${invalid ? 'border-red-500' : 'border-slate-300'}`;

type FieldRenderProps = {
  id: string;
  className: string;
  'aria-invalid': boolean | undefined;
  'aria-describedby': string | undefined;
};

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  /** Renders the control so the label, error and aria wiring stay in one place. */
  children: (props: FieldRenderProps) => ReactNode;
};

export const Field = ({ id, label, error, hint, optional, children }: FieldProps) => {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700">
        {label}
        {optional && <span className="ml-1 font-normal text-slate-500">(opsional)</span>}
      </label>
      <div className="mt-2">
        {children({
          id,
          className: inputClass(Boolean(error)),
          'aria-invalid': error ? true : undefined,
          'aria-describedby': describedBy,
        })}
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};

type FormSectionProps = {
  title?: string;
  description?: string;
  children: ReactNode;
};
export const FormSection = ({ title, description, children }: FormSectionProps) => (
  <section className="grid gap-5 border-t border-slate-200 pt-6">
    {title && <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-900">{title}</h2>}
    {description && <p className="-mt-4 text-sm text-slate-500">{description}</p>}
    {children}
  </section>
);

type ReadinessStep = {
  label: string;
  state: 'done' | 'pending' | 'blocked';
  note?: string;
};

/**
  A short checklist of what is still blocking an event. It only renders facts the
  caller already has, and every state carries a word as well as a mark, so the
  status never depends on colour alone.
*/
export const Readiness = ({ steps }: { steps: ReadinessStep[] }) => (
  <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
    {steps.map((step) => (
      <li key={step.label} className="flex items-center gap-1.5 text-xs">
        {step.state === 'done' ? (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 text-emerald-600" aria-hidden="true">
            <path d="M3 8.5l3.5 3.5L13 5" strokeLinecap="square" />
          </svg>
        ) : (
          <span aria-hidden="true" className="block h-1.5 w-1.5 bg-slate-300" />
        )}
        <span className={step.state === 'done' ? 'text-slate-600' : 'text-slate-500'}>
          {step.label}
          {step.note && <span className="text-slate-400"> · {step.note}</span>}
        </span>
        <span className="sr-only">
          {step.state === 'done' ? 'selesai' : step.state === 'blocked' ? 'terhalang' : 'belum'}
        </span>
      </li>
    ))}
  </ul>
);

/**
  A compact action row: a filled primary control plus outlined siblings. Used
  where a page has several valid actions but only one of them is the next step.
*/
export const ActionBar = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-2">{children}</div>
);

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
  <figure className="border border-slate-200 bg-white">
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

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'danger';
  children: ReactNode;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

export const Button = ({ variant = 'primary', children, className = '', ...props }: ButtonProps) => {
  const tone =
    variant === 'primary'
      ? 'bg-slate-900 text-white hover:bg-slate-700'
      : variant === 'danger'
        ? 'border border-red-500 bg-white text-red-700 hover:bg-red-50'
        : 'border border-slate-300 bg-white text-slate-900 hover:border-slate-900';

  return (
    <button
      className={`flex h-11 items-center justify-center px-4 text-sm font-semibold outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${tone} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

/**
  Segmented control. The real radio stays in the DOM, visually hidden, so arrow-key
  navigation and screen-reader semantics are the platform's, not re-implemented.
  Only the surface is custom.
*/
type SegmentedOption<T extends string> = { value: T; label: string; hint?: string };

type SegmentedProps<T extends string> = {
  name: string;
  legend: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
};

export const Segmented = <T extends string>({ name, legend, value, options, onChange }: SegmentedProps<T>) => (
  <fieldset>
    <legend className="text-xs font-semibold text-slate-700">{legend}</legend>
    <div className="mt-2 inline-flex border border-slate-300 bg-white p-0.5">
      {options.map((option) => (
        <label key={option.value} className="relative">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span
            className={`flex h-9 cursor-pointer items-center gap-2 px-4 text-sm font-medium whitespace-nowrap transition duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-black peer-focus-visible:ring-offset-2 ${
              value === option.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {option.label}
            {option.hint && (
              <span className={value === option.value ? 'text-white/60' : 'text-slate-400'}>{option.hint}</span>
            )}
          </span>
        </label>
      ))}
    </div>
  </fieldset>
);

type SummaryRow = { label: string; value: string; filled: boolean };

type SummaryCardProps = {
  title: string;
  description?: string;
  rows: SummaryRow[];
  children?: ReactNode;
};

export const SummaryCard = ({ title, description, rows, children }: SummaryCardProps) => (
  <div className="border border-slate-200 bg-white">
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

