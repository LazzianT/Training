import { useId } from 'react';

type Choice = { value: string; label: string };

type ChoiceGroupProps = {
  legend: string;
  choices: Choice[];
  value: string | undefined;
  onChange: (value: string) => void;
  name: string;
};

/**
  Full-row tap targets for exam answers. The real radio stays in the DOM behind
  `sr-only`, so arrow-key navigation and the announced role are the platform's;
  only the surface is custom. A 44px minimum row keeps this usable one-handed on
  a phone, which is where this page is actually taken.
*/
export const ChoiceGroup = ({ legend, choices, value, onChange, name }: ChoiceGroupProps) => {
  const groupId = useId();

  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="grid gap-2">
        {choices.map((choice) => {
          const selected = value === choice.value;
          return (
            <label
              key={choice.value}
              className={`flex min-h-11 cursor-pointer items-center gap-3 border px-3 py-2.5 transition duration-150 ${
                selected
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 bg-white hover:border-slate-400'
              } has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-black has-[:focus-visible]:ring-offset-2`}
            >
              <input
                type="radio"
                id={`${groupId}-${choice.value}`}
                name={name}
                value={choice.value}
                checked={selected}
                onChange={() => onChange(choice.value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center text-xs font-semibold transition duration-150 ${
                  selected ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-500'
                }`}
              >
                {choice.value.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 text-sm text-slate-900">{choice.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};
