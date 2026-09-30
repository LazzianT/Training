import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds on screen. Session expiry uses a long one on purpose. */
  duration?: number;
};

type Toast = Required<Pick<ToastInput, 'title'>> & Omit<ToastInput, 'title'> & { id: number };

type ToastValue = {
  push: (toast: ToastInput) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastValue | null>(null);

const TONE_MARK: Record<ToastTone, string> = {
  info: 'bg-slate-900',
  success: 'bg-emerald-600',
  warning: 'bg-amber-500',
  danger: 'bg-red-600',
};

const ToastCard = ({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) => (
  <div className="enter-toast pointer-events-auto flex w-full items-start gap-3 border border-slate-200 bg-white p-3.5">
    <span aria-hidden="true" className={`mt-1 block h-2 w-2 shrink-0 ${TONE_MARK[toast.tone ?? 'info']}`} />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
      {toast.description && (
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{toast.description}</p>
      )}
    </div>
    <button
      type="button"
      onClick={() => onDismiss(toast.id)}
      aria-label="Tutup notifikasi"
      className="-m-1 shrink-0 p-1 text-slate-400 outline-none transition duration-150 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="square" />
      </svg>
    </button>
  </div>
);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { ...input, id, tone: input.tone ?? 'info' }].slice(-3));
      const duration = input.duration ?? 6000;
      const timer = window.setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo<ToastValue>(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext value={value}>
      {children}
      {/* Live region sits outside the app shell so it is never clipped by a page's own scroll container. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext>
  );
};

export const useToast = () => {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
};

type CopyButtonProps = {
  value: string;
  label?: string;
  className?: string;
};

/**
  Clipboard writes are the one action whose success is invisible, so it reports
  through the same toast channel as everything else instead of a silent no-op.
*/
export const CopyButton = ({ value, label = 'Salin tautan', className = '' }: CopyButtonProps) => {
  const { push } = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      push({ tone: 'success', title: 'Tautan disalin', duration: 3000 });
    } catch {
      push({
        tone: 'danger',
        title: 'Gagal menyalin',
        description: 'Salin tautan secara manual dari kolom di samping.',
      });
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={`h-9 shrink-0 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 outline-none transition duration-150 hover:border-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${className}`}
    >
      {label}
    </button>
  );
};
