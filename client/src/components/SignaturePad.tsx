import { useRef, type PointerEvent } from 'react';

type SignaturePadProps = {
  onChange: (dataUrl: string) => void;
};

const W = 600;
const H = 240;

/**
  Pointer-events based so it works with touch, pen, and mouse from one path.
  Coordinates are mapped through the bounding rect, so a phone at 375px wide
  still produces a 600px-wide signature.
*/
export const SignaturePad = ({ onChange }: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const pointFor = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const point = pointFor(event);
    if (!canvas || !point) return;
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const draw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const point = pointFor(event);
    const context = canvasRef.current?.getContext('2d');
    if (!point || !context) return;
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const end = () => {
    if (!drawing.current || !canvasRef.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  return (
    <div>
      <div className="relative border border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={start}
          onPointerMove={draw}
          onPointerUp={end}
          onPointerCancel={end}
          aria-label="Area tanda tangan"
          className="block h-40 w-full touch-none sm:h-48"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 bottom-6 border-b border-dashed border-slate-200"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Tanda tangan dengan jari di layar.</p>
        <button
          type="button"
          onClick={clear}
          className="h-9 shrink-0 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 outline-none transition duration-150 hover:border-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          Hapus
        </button>
      </div>
    </div>
  );
};
