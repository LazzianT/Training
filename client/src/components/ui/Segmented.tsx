/**
  Segmented control. The real radio stays in the DOM, visually hidden, so arrow-key
  navigation and screen-reader semantics are the platform's, not re-implemented.
  Only the surface is custom.
*/
type SegmentedOption<T extends string> = { value: T; label: string; hint?: string };

type SegmentedProps<T extends string> = {
  name: string;
  legend: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
};

export const Segmented = <T extends string>({ name, legend, value, options, onChange }: SegmentedProps<T>) => (
  <fieldset>
    <legend className="text-xs font-semibold text-slate-700">{legend}</legend>
    <div className="mt-2 inline-flex border border-slate-300 bg-white p-0.5">
      {options.map((option) => (
        <label key={option.value} className="relative">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span
            className={`flex h-9 cursor-pointer items-center gap-2 px-4 text-sm font-medium whitespace-nowrap transition duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-black peer-focus-visible:ring-offset-2 ${
              value === option.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {option.label}
            {option.hint && (
              <span className={value === option.value ? 'text-white/60' : 'text-slate-400'}>{option.hint}</span>
            )}
          </span>
        </label>
      ))}
    </div>
  </fieldset>
);
