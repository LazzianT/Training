import { useEffect, useMemo, useRef, useState } from 'react';
import { ambiguousLabels, isAmbiguous } from '../lib/labels.js';

export type PickerOption = {
  /** What gets sent to the server when this row is chosen. */
  value: string;
  /** What the person reads, and what they type to find themselves. */
  label: string;
  /** Shown only when the label is ambiguous, as a tie breaker. */
  hint?: string | null;
};

type Props = {
  id: string;
  options: PickerOption[];
  /** The chosen value, or '' when nothing is chosen yet. */
  value: string;
  onSelect: (option: PickerOption) => void;
  onClear: () => void;
  placeholder: string;
  /** Shown when nothing matches, and should say what to do about it. */
  noMatch: string;
  disabled?: boolean;
  className: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

/**
 * Type to search, click to choose.
 *
 * Shared by both chains. They differ only in what identifies a person, a NIP on one
 * and a generated participant code on the other, so the field name is the only thing
 * that is not common.
 *
 * Somebody who has to type an identifier they were issued weeks ago will get it
 * wrong or will not have it, and a name is something nobody has lost.
 *
 * Filtering happens in the browser rather than per keystroke against the server,
 * because the whole list is already in the payload and somebody on office wifi
 * should not wait on a round trip per letter.
 */
export const SearchSelect = ({
  id,
  options,
  value,
  onSelect,
  onClear,
  placeholder,
  noMatch,
  disabled,
  className,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: Props) => {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const chosen = options.find((option) => option.value === value) ?? null;

  /*
    A label shared by more than one entry cannot identify anyone on its own, so only
    those rows show their hint. The common case never puts a code in front of
    somebody who does not need it, and the rare case is still resolvable.
  */
  const ambiguous = useMemo(() => ambiguousLabels(options.map((option) => option.label)), [options]);

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (needle === '') return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.value.toLowerCase().includes(needle),
    );
  }, [options, term]);

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

  const choose = (option: PickerOption) => {
    onSelect(option);
    setTerm(option.label);
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
    if (event.key === 'Escape') setOpen(false);
  };

  if (chosen) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border border-slate-300 bg-white px-3 py-3">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-900">{chosen.label}</span>
          {chosen.hint && (
            <span className="mt-0.5 block text-xs text-slate-500 tabular-nums">{chosen.hint}</span>
          )}
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
        placeholder={placeholder}
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
          aria-label="Daftar pilihan"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto border border-slate-200 bg-white shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-500">{noMatch}</li>
          ) : (
            matches.map((option, index) => (
              <li
                key={option.value}
                id={`${id}-opt-${index}`}
                role="option"
                aria-selected={index === active}
              >
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                  className={`flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left outline-none transition duration-150 ${
                    index === active ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate text-sm text-slate-900">{option.label}</span>
                  {option.hint && isAmbiguous(option.label, ambiguous) && (
                    <span className="shrink-0 text-xs text-slate-500 tabular-nums">{option.hint}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};
