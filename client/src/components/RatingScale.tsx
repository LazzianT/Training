import { useId } from 'react';

type RatingScaleProps = {
  legend: string;
  value: number;
  onChange: (value: number) => void;
  lowLabel: string;
  highLabel: string;
  max?: number;
};

const SCALE = [1, 2, 3, 4, 5];

/**
  A 1-5 scale with both endpoint words visible, because a bare number means
  nothing to a participant holding a phone. Implemented as a radiogroup so
  arrow keys move between scores.

  The legend is rendered, not only announced. It used to live in aria-label alone,
  so a sighted participant saw a row of numbers and two endpoint words with no
  question above them and nothing to answer. Screen readers were told the question
  and everyone else was not, which is the wrong way round.
*/
export const RatingScale = ({ legend, value, onChange, lowLabel, highLabel, max = 5 }: RatingScaleProps) => {
  const steps = SCALE.filter((score) => score <= max);
  const legendId = useId();

  return (
    <div role="radiogroup" aria-labelledby={legendId}>
      <p id={legendId} className="text-sm font-medium text-slate-900">
        {legend}
      </p>
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {steps.map((score) => {
          const selected = value === score;
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(score)}
              className={`flex h-11 items-center justify-center text-sm font-semibold outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
                selected
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-900'
              }`}
            >
              {score}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
};

type ProgressBarProps = {
  answered: number;
  total: number;
  label: string;
};

export const ProgressBar = ({ answered, total, label }: ProgressBarProps) => {
  const pct = total === 0 ? 0 : Math.round((answered / total) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        <p className="text-xs text-slate-500 tabular-nums">
          {answered} dari {total}
        </p>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full bg-slate-100"
        role="progressbar"
        aria-valuenow={answered}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={label}
      >
        <div
          className="h-full bg-slate-900 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
