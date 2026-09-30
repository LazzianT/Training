import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';

const NAV = [
  { label: 'Home', to: '/dashboard' },
  {
    label: 'Event',
    children: [
      { label: 'Input New Event', to: '/events/new' },
      { label: 'List Event', to: '/events' },
    ],
  },
];

const itemClass = (isActive: boolean, nested = false) =>
  `group block border-l-2 py-2.5 pr-3 text-[14.5px] transition-[color,border-color,transform] duration-200 hover:translate-x-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#D9A441] ${
    nested ? 'pl-6 text-[14px]' : 'pl-3'
  } ${isActive ? 'border-[#D9A441] text-white' : 'border-transparent text-white/70 hover:border-white/25 hover:text-white'}`;

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { session, signOut } = useAuth();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const employee = session?.employee;
  const nav = employee?.departId === '0300'
    ? [...NAV, { label: 'Monitoring Karyawan', to: '/employee-monitoring' }, { label: 'My Event', to: '/my-events' }]
    : employee?.isCoordinator || employee?.isEventTrainer
      ? [{ label: 'My Event', to: '/my-events' }]
      : [];
  const initials = (employee?.name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Mobile only: a strip is unavoidable at this width, so it holds nothing but the toggle. */}
      <div className="flex items-center justify-between bg-[#0A2942] px-4 py-3 lg:hidden print:hidden">
        <span className="text-[12px] tracking-[0.18em] text-white/70 uppercase">Dashboard</span>
        <button
          type="button"
          onClick={() => setDrawerOpen((open) => !open)}
          aria-expanded={drawerOpen}
          aria-label={drawerOpen ? 'Tutup menu' : 'Buka menu'}
          className="flex h-10 w-10 items-center justify-center text-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9A441]"
        >
          <span className="flex flex-col gap-1" aria-hidden="true">
            <span className="block h-px w-5 bg-current" />
            <span className="block h-px w-5 bg-current" />
            <span className="block h-px w-5 bg-current" />
          </span>
        </button>
      </div>

      {drawerOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 top-[3.25rem] z-20 bg-[#0A2942]/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex h-dvh max-h-dvh w-64 flex-col justify-between overflow-y-auto bg-[#0A2942] transition-transform lg:static lg:translate-x-0 print:hidden ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex min-h-0 flex-1 flex-col px-5 py-6">
          <div className="flex w-full items-center justify-center gap-3">
            <div className="flex w-full justify-center bg-[#EFEAE0] px-3 py-2">
              <img src="/logo.png" alt="PT Braja Mukti Cakra" className="h-8 w-auto object-contain" />
            </div>
          </div>

          <nav className="mt-9" aria-label="Menu utama">
            <p className="mb-3 px-3 text-[10px] font-semibold tracking-[0.2em] text-white/35 uppercase">Workspace</p>
            <ul className="grid gap-1">
              {nav.map((group) => (
                <li key={group.label}>
                  {group.to ? (
                    <NavLink to={group.to} end className={({ isActive }) => itemClass(isActive)}>
                      {group.label}
                    </NavLink>
                  ) : (
                    <p className="px-3 pt-3 pb-1.5 text-[11px] font-semibold tracking-[0.16em] text-white/40 uppercase">
                      {group.label}
                    </p>
                  )}

                  {group.children && (
                    <ul className="grid gap-0.5">
                      {group.children.map((child) => (
                        <li key={child.to}>
                          {/* end keeps List Event from matching /events/new. */}
                          <NavLink
                            to={child.to}
                            end
                            className={({ isActive }) => itemClass(isActive, true)}
                          >
                            {child.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {(employee?.isCoordinator === true || employee?.isEventTrainer) && (
            <section className="sidebar-context mt-10 border border-white/10 bg-white/[0.06] p-4">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-[#D9A441] uppercase">{employee?.isCoordinator ? 'Training Desk' : 'Ruang Pengisi Acara'}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-white/75">
                Satu tempat untuk menyiapkan assessment dan membaca hasil training.
              </p>
              <div className="mt-4 grid gap-2 border-t border-white/10 pt-3 text-[11px] text-white/50">
                <span className="flex items-center justify-between"><span>QR assessment</span><span className="text-white/30">01</span></span>
                <span className="flex items-center justify-between"><span>Bank soal</span><span className="text-white/30">02</span></span>
                <span className="flex items-center justify-between"><span>Hasil peserta</span><span className="text-white/30">03</span></span>
              </div>
            </section>
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 px-5 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center bg-white/10 text-[13px] font-semibold text-white/85"
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-white">
                {employee?.name ?? '-'}
              </p>
              <p className="truncate text-[12px] text-white/50">
                NIP {employee?.nip ?? '-'}
                {employee?.departId ? ` · ${employee.departId}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut(false)}
            className="mt-4 w-full border border-white/20 px-3 py-2.5 text-[13px] font-semibold text-white/80 transition-colors hover:border-white/45 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9A441]"
          >
            Keluar
          </button>
        </div>
      </aside>

      <main className="paper min-w-0 max-h-dvh overflow-y-auto print:max-h-none print:overflow-visible">
        <div className="mx-auto max-w-[68rem] px-5 py-7 sm:px-8 lg:px-10 lg:py-10 print:max-w-none print:p-0">{children}</div>
      </main>
    </div>
  );
};
