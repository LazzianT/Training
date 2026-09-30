import type { DashboardSummary } from '@training/contracts';

const W = 760;
const H = 260;
const PAD = { top: 18, right: 46, bottom: 34, left: 40 };

const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

type Props = {
  data: DashboardSummary['pareto'];
  hasData: boolean;
};

export const ParetoChart = ({ data, hasData }: Props) => {
  const maxCount = Math.max(...data.map((point) => point.trainingCount), 1);
  const slot = PLOT_W / data.length;
  const barW = Math.min(slot * 0.52, 34);
  const x = (index: number) => PAD.left + slot * index + slot / 2;
  const yBar = (count: number) => PAD.top + PLOT_H - (count / maxCount) * PLOT_H;
  const yLine = (percent: number) => PAD.top + PLOT_H - (percent / 100) * PLOT_H;

  const line = data.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${yLine(point.cumulativePercent)}`).join(' ');
  const gridValues = [0, 25, 50, 75, 100];

  if (!hasData) {
    return (
      <div className="flex min-h-[16rem] flex-col items-center justify-center gap-2 border border-dashed border-slate-200 px-6 text-center">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-6 w-6 text-slate-300"
          aria-hidden="true"
        >
          <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" strokeLinecap="square" />
        </svg>
        <p className="mt-1 text-sm font-semibold text-slate-900">Belum ada training tercatat</p>
        <p className="max-w-sm text-xs leading-relaxed text-slate-500">
          Diagram muncul setelah ada acara yang tersimpan di tabel training. Tidak ada data yang
          ditampilkan sebagai perkiraan.
        </p>
      </div>
    );
  }

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Grafik Pareto jumlah training per bulan, ${data.length} bulan terakhir, total ${data.reduce((sum, point) => sum + point.trainingCount, 0)} acara.`}
      >
        {gridValues.map((value) => (
          <g key={value}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yLine(value)}
              y2={yLine(value)}
              stroke="#0f172a"
              strokeOpacity={value === 0 ? 0.2 : 0.07}
              strokeWidth="1"
            />
            <text
              x={W - PAD.right + 8}
              y={yLine(value) + 3.5}
              fontSize="10"
              fill="#64748b"
              textAnchor="start"
            >
              {value}%
            </text>
          </g>
        ))}

        {data.map((point, index) => {
          const height = PAD.top + PLOT_H - yBar(point.trainingCount);
          return (
            <rect
              key={point.month}
              x={x(index) - barW / 2}
              y={yBar(point.trainingCount)}
              width={barW}
              height={Math.max(height, 0)}
              fill="#0f172a"
              fillOpacity="0.85"
            />
          );
        })}

        <path d={line} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />

        {data.map((point, index) => (
          <circle key={point.month} cx={x(index)} cy={yLine(point.cumulativePercent)} r="2.6" fill="#2563eb" />
        ))}

        {data.map((point, index) => (
          <text
            key={`label-${point.month}`}
            x={x(index)}
            y={H - PAD.bottom + 15}
            fontSize="9.5"
            fill="#64748b"
            textAnchor="middle"
          >
            {point.label}
          </text>
        ))}

        {data.map((point, index) => (
          point.trainingCount > 0 && (
            <text
              key={`value-${point.month}`}
              x={x(index)}
              y={yBar(point.trainingCount) - 6}
              fontSize="10"
              fill="#0f172a"
              textAnchor="middle"
            >
              {point.trainingCount}
            </text>
          )
        ))}
      </svg>

      <figcaption className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="block h-2.5 w-4 bg-slate-900" />
          Jumlah training per bulan
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="block h-0.5 w-4 bg-blue-600" />
          Akumulasi persen
        </span>
      </figcaption>
    </figure>
  );
};
