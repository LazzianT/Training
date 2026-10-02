import { useEffect, useMemo, useRef, useState } from 'react';
import { duplicatedNames } from '../lib/peserta.js';

type Peserta = { kodePeserta: string; namaLengkap: string };

type Props = {
  id: string;
  peserta: Peserta[];
  /** The selected participant code, or '' when nothing is chosen yet. */
  value: string;
  onSelect: (kodePeserta: string, namaLengkap: string) => void;
  onClear: () => void;
  disabled?: boolean;
  className: string;
  /** Wired through from Field so the hint and error stay announced. */
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

/**
 * Type a name, pick yourself from the list.
 *
 * The code was the only way in before, and a code is something a participant has
 * to still have. HR hands it out once at induction; by the day the material runs
 * it is gone, which turns a two minute form into a walk to the HR desk. A name is
 * something nobody has lost.
 *
 * The list is filtered in the browser rather than fetched per keystroke, because
 * the whole batch is already in the access payload and a participant on office
 * wifi should not wait on a round trip per letter.
 */
export const OjtPesertaPicker = ({
  id,
  peserta,
  value,
  onSelect,
  onClear,
  disabled,
  className,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: Props) => {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const chosen = peserta.find((item) => item.kodePeserta === value) ?? null;

  /*
    A name shared by more than one participant cannot identify anyone on its own.
    Only those rows show their code, so the common case never puts a code in front
    of somebody who does not need it, and the rare case is still resolvable.
  */
  const ambiguousNames = useMemo(() => duplicatedNames(peserta), [peserta]);

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (needle === '') return peserta;
    return peserta.filter(
      (item) =>
        item.namaLengkap.toLowerCase().includes(needle) ||
        item.kodePeserta.toLowerCase().includes(needle),
    );
  }, [peserta, term]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Keep the highlight inside the list as it shrinks under the typed term.
  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(matches.length - 1, 0)));
  }, [matches.length]);

  const choose = (item: Peserta) => {
    onSelect(item.kodePeserta, item.namaLengkap);
    setTerm(item.namaLengkap);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((current) => Math.min(current + 1, matches.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      if (open && matches[active]) {
        event.preventDefault();
        choose(matches[active]);
      }
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  if (chosen) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border border-slate-300 bg-white px-3 py-3">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-900">{chosen.namaLengkap}</span>
          <span className="mt-0.5 block text-xs text-slate-500 tabular-nums">{chosen.kodePeserta}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            setTerm('');
            setOpen(false);
            onClear();
          }}
          className="shrink-0 text-xs font-semibold text-slate-900 underline underline-offset-4 outline-none transition duration-150 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          Ganti
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${id}-opt-${active}` : undefined}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        value={term}
        disabled={disabled}
        autoComplete="off"
        placeholder="Ketik nama Anda"
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={className}
      />

      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label="Daftar peserta"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto border border-slate-200 bg-white shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-500">
              Nama tidak ditemukan. Hubungi HR bila Anda merasa terdaftar.
            </li>
          ) : (
            matches.map((item, index) => {
              const ambiguous = ambiguousNames.has(item.namaLengkap.trim().toLowerCase());
              return (
                <li key={item.kodePeserta} id={`${id}-opt-${index}`} role="option" aria-selected={index === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(item)}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left outline-none transition duration-150 ${
                      index === active ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate text-sm text-slate-900">{item.namaLengkap}</span>
                    {ambiguous && (
                      <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                        {item.kodePeserta}
                      </span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
};