import { InputHTMLAttributes, forwardRef } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, error, hint, id, className = '', ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint ? `${inputId}-hint` : undefined;

    return (
      <div className={className}>
        <label htmlFor={inputId} className="block text-[13px] font-semibold uppercase tracking-wide text-[#526477]">
          {label}
        </label>
        {hint && (
          <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-[#526477]">
            {hint}
          </p>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          className={`mt-2.5 block w-full rounded-lg border px-4 py-3 text-[15px] transition-all duration-150 placeholder:text-[#526477]/40 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
            error
              ? 'border-[#B42318] bg-[#FEF3F2]/30 focus:border-[#B42318] focus:ring-[#B42318]/20'
              : 'border-[#D8E0E8] bg-white focus:border-[#0A2942] focus:ring-[#0A2942]/10'
          }`}
          {...props}
        />
        {error && (
          <p id={errorId} className="mt-2 text-xs font-medium leading-relaxed text-[#B42318]">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Field.displayName = 'Field';
