import { NavLink, useLocation } from 'react-router-dom';
import { useState, type ComponentType } from 'react';
import {
  IconAcaraSaya,
  IconBantuan,
  IconBuat,
  IconDaftar,
  IconMonitoring,
  IconOjt,
  IconRingkasan,
  IconSertifikat,
} from './icons.js';

type IconType = ComponentType<{ className?: string }>;

/** Nested pages are text only; the parent's icon stands in for the whole group. */
type NavChild = { label: string; to: string };
type NavItem = { label: string; to: string; icon: IconType; end?: boolean; children?: NavChild[] };
type NavSection = { heading: string; items: NavItem[] };

type SidebarNavProps = {
  /** Departid 0300. Can list and create events, and read HR monitoring. */
  canManageEvents: boolean;
  canViewMyEvents: boolean;
  showLabels: boolean;
  /**
   * Called when a group is clicked in the collapsed rail. The rail has no room for
   * a nested list, so the parent opens the sidebar instead of leaving the click to
   * go nowhere.
   */
  onRequestExpand?: () => void;
};

/*
  The sidebar is the navy surface, so everything inside it is painted light on dark
  rather than dark on light. The selected row is marked with the accent orange,
  which is the one place in the sidebar the accent is used: it is the row that
  answers "where am I", and that is worth the colour.
*/
const sectionClass = 'px-3 pb-1.5 text-[10px] font-semibold tracking-[0.16em] text-white/45 uppercase';

const itemClass = (isActive: boolean, showLabels: boolean) =>
  [
    /*
      w-full and min-w-0 are load-bearing. Without them the item is sized to its
      own max-content, and a group heading like "PEMANTAUAN" is wider than the
      collapsed rail, so the item overflows it and justify-center parks the icon
      past the clip. That is what made the icons vanish when the sidebar closed.
    */
    'group relative flex w-full min-w-0 items-center gap-3 border-l-2 py-2.5 pr-3 text-sm transition duration-150',
    'focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none',
    showLabels ? 'pl-3' : 'lg:justify-center lg:pl-0 lg:pr-0',
    isActive
      ? 'border-accent bg-white/10 font-semibold text-white'
      : 'border-transparent text-white/70 hover:border-white/25 hover:bg-white/5 hover:text-white',
  ].join(' ');

const childClass = (isActive: boolean) =>
  [
    'block border-l-2 py-1.5 pr-3 pl-9 text-[13px] transition duration-150',
    'focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none',
    isActive
      ? 'border-accent font-semibold text-white'
      : 'border-transparent text-white/60 hover:border-white/25 hover:text-white',
  ].join(' ');

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    aria-hidden="true"
  >
    <path d="M3 6l5 5 5-5" strokeLinecap="square" />
  </svg>
);

/**
 * Three explicit sections instead of one flat list. Previously "Monitoring
 * Karyawan" and "Acara Saya" sat under the "Event" heading with no separation,
 * so they read as children of a group they did not belong to.
 *
 * An item with children is a group, not a link: the row expands and its children
 * carry the navigation. Making the row also a link left two different controls
 * pointing at the same place, which is how OJT ended up as "OJT" plus a
 * separate "Master Materi OJT" sibling instead of one menu.
 *
 * A group opens itself when the current route is already inside it, so landing
 * on a nested page by URL does not show a collapsed parent hiding where you are.
 * The toggle is still there to close it.
 *
 * Visibility is not a design choice: /api/events answers 403 for anyone outside
 * departId 0300, so those links stay hidden for everyone else. A section with no
 * items is dropped entirely rather than left as a bare heading.
 */
export const SidebarNav = ({ canManageEvents, canViewMyEvents, showLabels, onRequestExpand }: SidebarNavProps) => {
  const location = useLocation();
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  /** True when the route belongs to this item or to anything nested under it. */
  const containsRoute = (item: NavItem) =>
    location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

  const isOpen = (item: NavItem) => toggled[item.to] ?? containsRoute(item);

  const sections: NavSection[] = [
    {
      heading: 'Utama',
      items: [
        { label: 'Ringkasan', to: '/dashboard', icon: IconRingkasan, end: true },
        // Personal to whoever is signed in, so every role gets them.
        { label: 'Sertifikat Saya', to: '/certificates', icon: IconSertifikat },
        { label: 'Cara Pakai', to: '/how-to-use', icon: IconBantuan },
      ],
    },
    {
      heading: 'Event',
      items: canManageEvents
        ? [
            { label: 'Daftar Acara', to: '/events', icon: IconDaftar, end: true },
            { label: 'Buat Acara', to: '/events/new', icon: IconBuat },
          ]
        : [],
    },
    {
      heading: 'Pemantauan',
      items: [
        ...(canManageEvents
          ? [
              { label: 'Monitoring Karyawan', to: '/employee-monitoring', icon: IconMonitoring },
              {
                label: 'OJT',
                to: '/ojt',
                icon: IconOjt,
                children: [
                  { label: 'Batch OJT', to: '/ojt' },
                  { label: 'Master Materi', to: '/ojt/materi' },
                ],
              },
            ]
          : []),
        ...(canViewMyEvents ? [{ label: 'Acara Saya', to: '/my-events', icon: IconAcaraSaya }] : []),
      ],
    },
  ].filter((section) => section.items.length > 0);

  return (
    <nav aria-label="Menu utama" className="grid w-full grid-cols-1 gap-5">
      {sections.map((section) => (
        <div key={section.heading} className="min-w-0">
          {/*
            Hidden rather than clipped in the rail. It was the widest thing in the
            nav, so it set the width of every item under it and pushed the icons
            out of view; and a heading cut off as "PEMA" reads as a fault anyway.
          */}
          {showLabels && <p className={sectionClass}>{section.heading}</p>}
          <ul className="grid w-full grid-cols-1 gap-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;

              if (!item.children) {
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      title={showLabels ? undefined : item.label}
                      className={({ isActive }) => itemClass(isActive, showLabels)}
                    >
                      <Icon />
                      {showLabels ? (
                        <span className="truncate">{item.label}</span>
                      ) : (
                        <span className="sr-only">{item.label}</span>
                      )}
                    </NavLink>
                  </li>
                );
              }

              const open = isOpen(item);
              return (
                <li key={item.to}>
                  {/*
                    With labels on, the row is a button that expands and the children
                    navigate. With labels off there is no room for a nested list, so
                    the row opens the sidebar instead: the group is the entry point
                    to its submenu, and pointing it at the group's own page would
                    leave the submenu unreachable from the rail.
                  */}
                  {showLabels ? (
                    <div className={itemClass(containsRoute(item), true)}>
                      <Icon />
                      <span className="flex-1 truncate">{item.label}</span>
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-label={`${open ? 'Tutup' : 'Buka'} submenu ${item.label}`}
                        onClick={() => setToggled((current) => ({ ...current, [item.to]: !open }))}
                        className="-mr-1 shrink-0 p-1 text-slate-500 outline-none transition duration-150 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                      >
                        <Chevron open={open} />
                      </button>
                    </div>
                  ) : (
                    /*
                      The rail has nowhere to put a nested list, so this opens the
                      sidebar with the group already expanded rather than pointing
                      at a page and leaving the submenu unreachable.
                    */
                    <button
                      type="button"
                      title={`${item.label} — buka menu`}
                      aria-label={`Buka submenu ${item.label}`}
                      onClick={() => {
                        setToggled((current) => ({ ...current, [item.to]: true }));
                        onRequestExpand?.();
                      }}
                      className={itemClass(containsRoute(item), false)}
                    >
                      <Icon />
                      <span className="sr-only">{item.label}</span>
                    </button>
                  )}

                  {open && showLabels && (
                    <ul className="grid w-full grid-cols-1 gap-0.5">
                      {item.children.map((child) => (
                        <li key={child.to} className="min-w-0">
                          <NavLink to={child.to} end className={({ isActive }) => childClass(isActive)}>
                            {child.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
};
