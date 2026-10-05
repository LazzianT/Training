import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { positionTooltip, TOURS, type Rect, type TourStep } from '../lib/tours.js';
import { Button } from './ui/index.js';

const seenKey = (id: string) => `training.tour.seen.${id}`;

const readSeen = (id: string) => {
  try {
    return localStorage.getItem(seenKey(id)) === '1';
  } catch {
    // Private mode, or storage disabled. The tour simply offers itself again.
    return false;
  }
};

const markSeen = (id: string) => {
  try {
    localStorage.setItem(seenKey(id), '1');
  } catch {
    /* not fatal: the tour runs again next time */
  }
};

/** Steps whose element is actually on screen. A missing anchor drops the step. */
const resolvableSteps = (id: string): TourStep[] => {
  const tour = TOURS.find((item) => item.id === id);
  if (!tour) return [];
  return tour.steps.filter((step) => {
    const element = document.querySelector(`[data-tour="${step.target}"]`);
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
};

type TourContextValue = {
  start: (id: string) => void;
  stop: () => void;
  /** False when this page has no anchors, so the trigger can hide itself. */
  available: (id: string) => boolean;
};

const TourContext = createContext<TourContextValue | null>(null);

export const useTour = () => {
  const value = useContext(TourContext);
  if (!value) throw new Error('useTour must be used inside TourProvider');
  return value;
};

/**
 * A short guided tour of whichever page the user is on.
 *
 * Runs once for the welcome tour and otherwise only when asked for, because an
 * uninvited overlay on every page is a thing people learn to dismiss without
 * reading. The help button is always there for the second look.
 *
 * A step whose target is missing is dropped rather than pointing at empty space,
 * so the tour keeps working when the layout changes underneath it.
 */
export const TourProvider = ({ children }: { children: ReactNode }) => {
  const [active, setActive] = useState<{ id: string; steps: TourStep[]; index: number } | null>(null);
  const [target, setTarget] = useState<Rect | null>(null);
  const [tooltip, setTooltip] = useState({ width: 0, height: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const start = useCallback((id: string) => {
    const steps = resolvableSteps(id);
    if (steps.length === 0) return;
    markSeen(id);
    setActive({ id, steps, index: 0 });
  }, []);

  const stop = useCallback(() => setActive(null), []);

  const value = useMemo<TourContextValue>(
    () => ({
      start,
      stop,
      available: (id) => resolvableSteps(id).length > 0,
    }),
    [start, stop],
  );

  // The welcome tour offers itself once, after the layout has settled enough for
  // its anchors to have a size.
  useEffect(() => {
    const welcome = TOURS.find((item) => item.autoStart);
    if (!welcome || readSeen(welcome.id)) return;
    const timer = setTimeout(() => start(welcome.id), 600);
    return () => clearTimeout(timer);
  }, [start]);

  const step = active?.steps[active.index] ?? null;

  useLayoutEffect(() => {
    if (!active || !step) return;
    const element = document.querySelector(`[data-tour="${step.target}"]`);
    if (!element) return;

    element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });

    // Measured after the scroll settles: measuring first would place the card
    // against where the element used to be.
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setTarget({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      const box = cardRef.current?.getBoundingClientRect();
      if (box) setTooltip({ width: box.width, height: box.height });
    };
    measure();
    const timer = setTimeout(measure, 260);

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, step]);

  useEffect(() => {
    if (!active) return;
    cardRef.current?.focus();
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        stop();
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault();
        setActive((current) =>
          current && current.index < current.steps.length - 1
            ? { ...current, index: current.index + 1 }
            : null,
        );
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActive((current) =>
          current && current.index > 0 ? { ...current, index: current.index - 1 } : current,
        );
      }
    };
    // Capture, so a key the page also listens for does not move the page as well.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, stop]);

  const place = useMemo(() => {
    if (!target || tooltip.width === 0) return null;
    return positionTooltip(
      target,
      tooltip,
      step?.placement ?? 'bottom',
      { width: window.innerWidth, height: window.innerHeight },
    );
  }, [target, tooltip, step]);

  return (
    <TourContext.Provider value={value}>
      {children}

      {active && step && (
        <>
          {/*
            The dim is a spotlight, not a cover: a transparent box over the target
            with an enormous shadow spread paints everything around it. One element
            rather than four rectangles, which is the version that does not have a
            seam when the target is near an edge.
          */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[70] border-2 border-white transition-all duration-200"
            style={{
              top: (target?.top ?? 0) - 6,
              left: (target?.left ?? 0) - 6,
              width: (target?.width ?? 0) + 12,
              height: (target?.height ?? 0) + 12,
              boxShadow: '0 0 0 9999px rgb(15 23 42 / 0.62)',
              opacity: place ? 1 : 0,
            }}
          />

          {/*
            Swallows clicks outside the card. A tour that lets you navigate away
            mid-sentence is a tour that ends with the second step still highlighted
            over a different page.
          */}
          <div className="fixed inset-0 z-[71]" onClick={(event) => event.stopPropagation()} />

          <div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-step-title"
            tabIndex={-1}
            className="surface-card fixed z-[72] w-[min(20rem,calc(100vw-1.5rem))] outline-none"
            style={{ top: place?.top ?? 0, left: place?.left ?? 0, opacity: place ? 1 : 0 }}
          >
            <div className="p-4">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                {active.index + 1} / {active.steps.length}
              </p>
              <h2
                id="tour-step-title"
                className="mt-1.5 text-sm font-semibold tracking-[-0.01em] text-slate-900"
              >
                {step.title}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{step.body}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                onClick={stop}
                className="text-xs font-semibold text-slate-500 underline underline-offset-4 outline-none transition duration-150 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
              >
                Lewati
              </button>
              <div className="flex items-center gap-2">
                {active.index > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => setActive({ ...active, index: active.index - 1 })}
                  >
                    Kembali
                  </Button>
                )}
                <Button
                  type="button"
                  className="h-8 px-2.5 text-xs"
                  onClick={() =>
                    setActive(
                      active.index < active.steps.length - 1
                        ? { ...active, index: active.index + 1 }
                        : null,
                    )
                  }
                >
                  {active.index < active.steps.length - 1 ? 'Lanjut' : 'Selesai'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </TourContext.Provider>
  );
};

/**
 * Starts a tour for the current page.
 *
 * Hides itself when the page has no anchors, so a page that has not been given a
 * tour yet does not offer a button that does nothing.
 */
export const TourButton = ({ id, className = '' }: { id: string; className?: string }) => {
  const { start, available } = useTour();
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(available(id)), [available, id]);

  if (!ready) return null;

  return (
    <button
      type="button"
      onClick={() => start(id)}
      title="Jalankan tur halaman ini"
      aria-label="Jalankan tur halaman ini"
      className={`inline-flex h-9 items-center gap-1.5 border border-slate-300 px-3 text-xs font-semibold text-slate-700 outline-none transition duration-150 hover:border-slate-900 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${className}`}
    >
      <span aria-hidden="true">?</span>
      Tur
    </button>
  );
};
