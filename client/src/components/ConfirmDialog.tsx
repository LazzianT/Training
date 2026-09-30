import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Modal } from './Modal.js';

type ConfirmInput = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
};

type ConfirmValue = (input: ConfirmInput) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmValue | null>(null);

/**
  A promise-based confirm. Callers `await` it exactly where they used to call
  window.confirm, so the surrounding control flow does not change.
*/
export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [pending, setPending] = useState<(ConfirmInput & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback<ConfirmValue>(
    (input) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...input, resolve });
      }),
    [],
  );

  const close = useCallback((ok: boolean) => {
    setPending((current) => {
      current?.resolve(ok);
      return null;
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext value={value}>
      {children}
      <Modal
        open={pending !== null}
        onClose={() => close(false)}
        title={pending?.title ?? ''}
        description={pending?.description}
        assertive
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => close(false)}
              className="h-10 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition duration-150 hover:border-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              {pending?.cancelLabel ?? 'Batal'}
            </button>
            <button
              type="button"
              onClick={() => close(true)}
              className={`h-10 px-4 text-sm font-semibold text-white outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
                pending?.tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-700'
              }`}
            >
              {pending?.confirmLabel ?? 'Ya, lanjutkan'}
            </button>
          </>
        }
      />
    </ConfirmContext>
  );
};

export const useConfirm = () => {
  const value = useContext(ConfirmContext);
  if (!value) throw new Error('useConfirm must be used inside ConfirmProvider');
  return value;
};
