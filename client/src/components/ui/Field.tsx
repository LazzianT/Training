import type { ReactNode } from 'react';

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
