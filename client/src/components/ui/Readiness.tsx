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
