import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Announced as an alert instead of a plain dialog, for destructive asks. */
  assertive?: boolean;
  size?: 'md' | 'lg' | 'xl';
  children?: ReactNode;
  footer?: ReactNode;
};

const WIDTH = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;

/**
  One modal for the whole app: Escape to close, backdrop click to dismiss, focus
  moved in on open, focus trapped while open, and focus returned to whatever
  opened it. Anything that needs a dialog should reuse this rather than
  re-implementing the keyboard contract.
*/
export const Modal = ({
  open,
  onClose,
  title,
  description,
  assertive = false,
  size = 'lg',
  children,
  footer,
}: ModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = 'modal-title';
  const descriptionId = 'modal-description';

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role={assertive ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`enter-section w-full ${WIDTH[size]} border border-slate-200 bg-white`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold tracking-[-0.02em] text-slate-900">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-xs text-slate-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="-m-1 shrink-0 p-1 text-slate-400 outline-none transition duration-150 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="square" />
            </svg>
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto">{children}</div>

        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
};
