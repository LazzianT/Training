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
