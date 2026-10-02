type StatTileProps = {
  label: string;
  value: string;
  unit?: string;
  note?: string;
};

export const StatTile = ({ label, value, unit, note }: StatTileProps) => (
  <div className="surface-card px-4 py-4">
    <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">{label}</p>
    <p className="mt-2 text-3xl leading-none font-semibold text-slate-900 tabular-nums">
      {value}
      {unit && <span className="ml-1 text-sm font-medium text-slate-500">{unit}</span>}
    </p>
    {note && <p className="mt-1.5 text-xs text-slate-500">{note}</p>}
  </div>
);
