/*
  One authored icon set, 24px box, 1.5 stroke, round caps. Drawn rather than
  pulled from a library so the sidebar has a single consistent voice; a mixed
  icon set is what makes a nav look assembled rather than designed.
*/
type IconProps = { className?: string };

const base = 'h-5 w-5 shrink-0';

export const IconRingkasan = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
    <rect x="3.5" y="3.5" width="7" height="7" />
    <rect x="13.5" y="3.5" width="7" height="7" />
    <rect x="3.5" y="13.5" width="7" height="7" />
    <rect x="13.5" y="13.5" width="7" height="7" />
  </svg>
);

export const IconDaftar = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
    <path d="M8 6.5h12M8 12h12M8 17.5h12" strokeLinecap="square" />
    <path d="M4 6.5h.01M4 12h.01M4 17.5h.01" strokeLinecap="round" strokeWidth="2" />
  </svg>
);

export const IconBuat = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
    <path d="M12 4.5v15M4.5 12h15" strokeLinecap="square" />
  </svg>
);

export const IconMonitoring = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" strokeLinecap="square" />
    <path d="M16 5.5a3.5 3.5 0 010 7M17.5 20c0-2.4-.8-4.3-2-5.6 2.9.4 5.5 2.4 5.5 5.6" strokeLinecap="square" />
  </svg>
);

export const IconAcaraSaya = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
    <path d="M4 6.5h16v13H4z" strokeLinecap="square" />
    <path d="M4 10.5h16M8.5 3.5v4M15.5 3.5v4" strokeLinecap="square" />
    <path d="M8.75 14.5l2 2 4-4" strokeLinecap="square" />
  </svg>
);

export const IconOjt = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
    <path d="M12 3.5l8 4.5-8 4.5-8-4.5z" strokeLinejoin="miter" />
    <path d="M4 12l8 4.5 8-4.5" strokeLinecap="square" />
    <path d="M4 16.5l8 4.5 8-4.5" strokeLinecap="square" />
  </svg>
);

export const IconChevron = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
    <path d="M14.5 6l-6 6 6 6" strokeLinecap="square" />
  </svg>
);

/**
 * The app's mark, for the sidebar header. Not a replacement for the company logo,
 * which stays on the login page and on the printed invitation where it belongs.
 *
 * Three strokes carry the three ideas: the open loop is the refreshment cycle, the
 * arrowhead is progress breaking out of it, and the three bars rising inside are
 * the training levels. Drawn in the same 24px, 1.5 stroke voice as the nav icons so
 * the sidebar reads as one set rather than a bitmap sitting next to a font.
 */
export const IconBrand = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-3.4-7" strokeLinecap="square" />
    <path d="M21 2.9v5.4h-5.4" strokeLinecap="square" />
    <path d="M9.4 15v-2.6M12 15V9.4M14.6 15v-4" strokeLinecap="square" />
  </svg>
);

export const IconKeluar = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
    <path d="M14 7.5V5H5v14h9v-2.5" strokeLinecap="square" />
    <path d="M10 12h10M17 9l3 3-3 3" strokeLinecap="square" />
  </svg>
);
