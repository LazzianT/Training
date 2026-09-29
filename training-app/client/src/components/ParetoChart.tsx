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
      <div className="flex min-h-[16rem] flex-col items-center justify-center gap-2 border border-dashed border-[#0A2942]/20 px-6 text-center">
        <p className="text-[14.5px] font-semibold text-[#0A2942]">Belum ada training tercatat</p>
        <p className="max-w-sm text-[13px] leading-relaxed text-[#55697C]">
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
              stroke="#0A2942"
              strokeOpacity={value === 0 ? 0.28 : 0.08}
              strokeWidth="1"
            />
            <text
              x={W - PAD.right + 8}
              y={yLine(value) + 3.5}
              fontSize="10"
              fill="#55697C"
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
              fill="#0A2942"
              fillOpacity="0.78"
            />
          );
        })}

        <path d={line} fill="none" stroke="#C8892F" strokeWidth="2" strokeLinejoin="round" />

        {data.map((point, index) => (
          <circle key={point.month} cx={x(index)} cy={yLine(point.cumulativePercent)} r="2.6" fill="#C8892F" />
        ))}

        {data.map((point, index) => (
          <text
            key={`label-${point.month}`}
            x={x(index)}
            y={H - PAD.bottom + 15}
            fontSize="9.5"
            fill="#55697C"
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
              fill="#0A2942"
              textAnchor="middle"
            >
              {point.trainingCount}
            </text>
          )
        ))}
      </svg>

      <figcaption className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-[#55697C]">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="block h-2.5 w-4 bg-[#0A2942]/78" />
          Jumlah training per bulan
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="block h-0.5 w-4 bg-[#C8892F]" />
          Akumulasi persen
        </span>
      </figcaption>
    </figure>
  );
};
