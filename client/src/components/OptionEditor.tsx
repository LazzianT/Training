import { useId } from 'react';

const KEYS = ['A', 'B', 'C', 'D'] as const;
type Key = (typeof KEYS)[number];

type OptionEditorProps = {
  values: Record<Key, string>;
  correct: string;
  onChange: (key: Key, value: string) => void;
  onCorrectChange: (key: Key) => void;
};

/**
  The letter badge is both the option label and the answer key toggle, so
  choosing the correct answer costs one click instead of opening a dropdown and
  picking from a list. It is a real radiogroup, so arrow keys work.
*/
export const OptionEditor = ({ values, correct, onChange, onCorrectChange }: OptionEditorProps) => {
  const groupId = useId();

  return (
    <div role="radiogroup" aria-label="Pilihan jawaban dan kunci jawaban" className="grid gap-2">
      {KEYS.map((key) => {
        const isCorrect = correct === key;
        return (
          <div
            key={key}
            className={`flex items-stretch border transition duration-150 ${
              isCorrect ? 'border-slate-900' : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            <button
              type="button"
              role="radio"
              aria-checked={isCorrect}
              onClick={() => onCorrectChange(key)}
              title={isCorrect ? 'Kunci jawaban' : 'Jadikan kunci jawaban'}
              className={`flex w-11 shrink-0 items-center justify-center text-sm font-semibold outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset ${
                isCorrect
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {key}
              <span className="sr-only">
                {isCorrect ? `, kunci jawaban` : `, belum menjadi kunci jawaban`}
              </span>
            </button>
            <input
              id={`${groupId}-${key}`}
              value={values[key]}
              onChange={(event) => onChange(key, event.target.value)}
              placeholder={`Teks pilihan ${key}`}
              className="min-w-0 flex-1 border-0 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-500"
            />
          </div>
        );
      })}
    </div>
  );
};
