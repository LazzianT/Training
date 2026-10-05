import type { ReactNode } from 'react';

/*
  Illustrations of the screens the guide describes.

  Drawn as real markup rather than captured as images. A screenshot goes stale the
  moment the layout changes and nobody notices until a reader is misled by it; these
  are built from the same classes and the same labels as the screens themselves, so
  they drift only when the screen actually changes. They also stay sharp at any
  zoom, weigh nothing, and need no one to re-capture them.

  They are deliberately not pixel-exact. The frame says so, and the labels are the
  real ones, so a reader learns what to look for without being promised a faithful
  reproduction.
*/

export const MockFrame = ({ label, children }: { label: string; children: ReactNode }) => (
  <figure className="mt-3 border border-slate-200 bg-white">
    <figcaption className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-1.5">
      <span className="flex gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 bg-slate-300" />
        <span className="h-1.5 w-1.5 bg-slate-300" />
        <span className="h-1.5 w-1.5 bg-slate-300" />
      </span>
      <span className="text-[10px] font-semibold tracking-[0.1em] text-slate-500 uppercase">{label}</span>
      <span className="ml-auto text-[10px] text-slate-400">ilustrasi</span>
    </figcaption>
    <div className="p-3 sm:p-4">{children}</div>
  </figure>
);

/** A clickable-looking control. Never actually clickable: this is a picture. */
export const MockButton = ({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'dark' | 'muted' }) => (
  <span
    className={`inline-flex h-6 shrink-0 items-center border px-2 text-[10px] font-semibold ${
      tone === 'dark'
        ? 'border-slate-900 bg-slate-900 text-white'
        : tone === 'muted'
          ? 'border-slate-200 bg-slate-50 text-slate-400'
          : 'border-slate-300 bg-white text-slate-700'
    }`}
  >
    {children}
  </span>
);

export const MockInput = ({ placeholder }: { placeholder: string }) => (
  <span className="flex h-6 items-center border border-slate-300 bg-white px-2 text-[10px] text-slate-400">
    {placeholder}
  </span>
);

export const MockChip = ({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'green' | 'amber' }) => (
  <span
    className={`inline-flex items-center border px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.06em] uppercase ${
      tone === 'green'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-slate-200 bg-slate-50 text-slate-600'
    }`}
  >
    {children}
  </span>
);

export const MockPanel = ({ title, action, children }: { title: string; action?: ReactNode; children?: ReactNode }) => (
  <div className="border border-slate-200 bg-white">
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-2.5 py-1.5">
      <span className="text-[11px] font-semibold text-slate-900">{title}</span>
      {action}
    </div>
    {children}
  </div>
);

export const MockRow = ({ children, last = false }: { children: ReactNode; last?: boolean }) => (
  <div className={`flex items-center justify-between gap-2 px-2.5 py-2 ${last ? '' : 'border-b border-slate-100'}`}>
    {children}
  </div>
);

export const MockLine = ({ width = 'w-24', dark = false }: { width?: string; dark?: boolean }) => (
  <span className={`block h-2 ${width} ${dark ? 'bg-slate-300' : 'bg-slate-200'}`} />
);

/** The navigation rail, so a step that says "open the OJT menu" can show where that is. */
export const MockSidebar = ({ active }: { active: string }) => (
  <div className="flex h-full w-24 flex-col gap-1 border-r border-slate-200 bg-white p-1.5">
    {['Ringkasan', 'Sertifikat Saya', 'Cara Pakai', 'Daftar Acara', 'OJT'].map((item) => (
      <span
        key={item}
        className={`truncate border-l-2 px-1.5 py-1 text-[9px] ${
          item === active ? 'border-slate-900 bg-slate-50 font-semibold text-slate-900' : 'border-transparent text-slate-500'
        }`}
      >
        {item}
      </span>
    ))}
  </div>
);

/** A row of QR buttons, the thing most OJT steps are actually about. */
export const MockQrButtons = ({ disabled = [] }: { disabled?: string[] }) => (
  <div className="grid gap-1.5 sm:grid-cols-2">
    {['QR Pre-test', 'QR Post-test', 'QR Feedback', 'QR Absensi'].map((label) => {
      const blocked = disabled.some((entry) => label.includes(entry));
      return (
        <span
          key={label}
          className={`flex items-center justify-between border px-2 py-1.5 text-[10px] font-semibold ${
            blocked ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-300 bg-white text-slate-900'
          }`}
        >
          {label}
          <span className={`text-[9px] font-normal ${blocked ? 'text-slate-400' : 'text-slate-500'}`}>
            {blocked ? 'belum siap' : 'buat'}
          </span>
        </span>
      );
    })}
  </div>
);
