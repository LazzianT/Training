import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { SidebarNav } from '../components/SidebarNav.js';
import { TourButton } from '../components/Tour.js';
import { IconChevron, IconKeluar } from '../components/icons.js';

const COLLAPSE_KEY = 'training.sidebar.collapsed';

const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

/**
 * Which tour belongs to the page being viewed.
 *
 * Kept here rather than in each page so a new page has one place to register, and
 * so the trigger can live in the layout instead of being repeated twelve times.
 * Pages without a tour simply get no button.
 */
const tourForPath = (pathname: string) => {
  if (pathname.startsWith('/ojt/materi')) return 'ojt-materi';
  if (/^\/ojt\/\d+/.test(pathname)) return 'ojt-batch';
  if (pathname === '/ojt') return 'ojt';
  if (pathname.startsWith('/events')) return 'events';
  if (pathname === '/dashboard') return 'welcome';
  return null;
};

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { session, signOut } = useAuth();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [desktop, setDesktop] = useState(isDesktop);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === 'collapsed');

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setDesktop(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  /*
    Collapsing is a desktop affordance only. On a phone the drawer must always show
    labels, so the preference never follows the user down a breakpoint.
  */
  const railCollapsed = collapsed && desktop;
  const showLabels = !railCollapsed;

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      localStorage.setItem(COLLAPSE_KEY, current ? 'expanded' : 'collapsed');
      return !current;
    });
  };

  /*
    Called from the rail when a group is clicked.

    A collapsed group row cannot show its submenu, so clicking it would otherwise
    be a dead end: the entry it leads to is invisible. Opening the sidebar instead
    means one click gets to it, and the submenu the user was reaching for is what
    appears.

    This is also why the rail does not open on hover. Hovering while the pointer is
    already over the sidebar, which is exactly where it is when the collapse button
    is pressed, re-opened it instantly and made the click look like it had done
    nothing. Click is the control; nothing else moves the sidebar.
  */
  const expandSidebar = () => {
    setCollapsed(false);
    localStorage.setItem(COLLAPSE_KEY, 'expanded');
  };

  const employee = session?.employee;
  const isAdmin = employee?.departId === '0300';
  const initials = (employee?.name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const role = isAdmin
    ? 'Human Capital'
    : employee?.isCoordinator || employee?.isEventTrainer
      ? 'Pengisi Acara'
      : 'Karyawan';

  const tour = tourForPath(pathname);

  return (
    <div data-surface="saas" className="min-h-dvh bg-slate-50 text-slate-900 lg:grid lg:grid-cols-[auto_1fr]">
      {/* Mobile only: a strip is unavoidable at this width, so it holds nothing but the toggle. */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden print:hidden">
        <span className="text-sm font-semibold tracking-tight">BMC Training</span>
        <button
          type="button"
          onClick={() => setDrawerOpen((open) => !open)}
          aria-expanded={drawerOpen}
          aria-label={drawerOpen ? 'Tutup menu' : 'Buka menu'}
          className="flex h-10 w-10 items-center justify-center text-slate-700 outline-none transition duration-150 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
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
          className="fixed inset-0 top-[3.25rem] z-20 bg-slate-900/40 lg:hidden"
        />
      )}

      {/*
        The spacer holds the grid column at the rail's width. The aside itself is
        fixed, so without something occupying the column the content would slide
        left underneath it.
      */}
      <div aria-hidden="true" className={`shrink-0 ${railCollapsed ? 'lg:w-16' : 'lg:w-64'}`} />

      <aside
        data-tour="sidebar"
        className={`fixed inset-y-0 left-0 z-30 flex h-dvh max-h-dvh flex-col justify-between overflow-y-auto overflow-x-hidden border-r border-slate-200 bg-white transition-[width,transform] duration-200 print:hidden lg:translate-x-0 ${
          showLabels ? 'w-64' : 'w-64 lg:w-16'
        } ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex min-h-0 flex-1 flex-col px-3 py-5 sm:px-5">
          <div className={`flex items-center gap-2.5 ${showLabels ? '' : 'lg:justify-center'}`}>
            {/*
              The wordmark is hidden rather than shrunk in the rail. It is about
              80px wide at this height and the rail has 64, so leaving it in would
              clip it mid-letter and read as a rendering fault. The mark comes back
              the moment the rail opens.
            */}
            <img
              src="/logo.png"
              alt="PT Braja Mukti Cakra"
              width={1016}
              height={404}
              className={`h-8 w-auto shrink-0 object-contain ${showLabels ? '' : 'lg:hidden'}`}
            />
            <p className={`truncate text-sm font-semibold tracking-tight ${showLabels ? '' : 'lg:sr-only'}`}>
              BMC Training
            </p>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Perlebar sidebar' : 'Ciutkan sidebar'}
              /*
                Centred and always visible while collapsed, because it is the only
                way back out of the rail. It used to sit after the wordmark with
                ml-auto and was pushed past the edge, so the rail had no visible
                control at all.
              */
              className={`h-8 w-8 shrink-0 items-center justify-center text-slate-400 outline-none transition duration-150 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
                showLabels ? 'ml-auto hidden lg:flex' : 'mx-auto flex'
              }`}
            >
              <IconChevron className={`h-4 w-4 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
            </button>
          </div>

          <div className={`mt-8 ${showLabels ? '' : 'lg:mt-6'}`}>
            <SidebarNav
              canManageEvents={isAdmin}
              canViewMyEvents={isAdmin || employee?.isCoordinator === true || employee?.isEventTrainer === true}
              showLabels={showLabels}
              onRequestExpand={expandSidebar}
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 px-3 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-5">
          <div className={`flex items-center gap-3 ${showLabels ? '' : 'lg:justify-center'}`}>
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700"
            >
              {initials}
            </span>
            <div data-tour="role" className={`min-w-0 flex-1 ${showLabels ? '' : 'lg:hidden'}`}>
              <p className="truncate text-sm font-semibold text-slate-900">{employee?.name ?? '-'}</p>
              <p className="truncate text-xs text-slate-500">
                {role}
                {employee?.nip ? ` · ${employee.nip}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-tour="signout"
            onClick={() => signOut(false)}
            title={showLabels ? undefined : 'Keluar'}
            className={`mt-4 flex h-10 w-full items-center justify-center gap-2 border border-slate-200 bg-white text-sm font-semibold text-slate-700 outline-none transition duration-150 hover:border-slate-900 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
              showLabels ? '' : 'lg:p-0'
            }`}
          >
            <IconKeluar />
            <span className={showLabels ? '' : 'lg:sr-only'}>Keluar</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 max-h-dvh overflow-y-auto print:max-h-none print:overflow-visible">
        <div className="mx-auto max-w-[68rem] px-4 py-6 sm:px-6 lg:px-10 lg:py-10 print:max-w-none print:p-0">
          {tour && (
            <div className="mb-3 flex justify-end print:hidden">
              <TourButton id={tour} />
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
};
