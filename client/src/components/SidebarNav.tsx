import { NavLink } from 'react-router-dom';
import type { ComponentType } from 'react';
import {
  IconAcaraSaya,
  IconBuat,
  IconDaftar,
  IconMonitoring,
  IconRingkasan,
} from './icons.js';

type IconType = ComponentType<{ className?: string }>;

type NavItem = { label: string; to: string; icon: IconType; end?: boolean };
type NavSection = { heading: string; items: NavItem[] };

type SidebarNavProps = {
  /** Departid 0300. Can list and create events, and read HR monitoring. */
  canManageEvents: boolean;
  canViewMyEvents: boolean;
  showLabels: boolean;
};

const sectionClass = 'px-3 pb-1.5 text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase';

const itemClass = (isActive: boolean, showLabels: boolean) =>
  [
    'group relative flex items-center gap-3 border-l-2 py-2.5 pr-3 text-sm transition duration-150',
    'focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none',
    showLabels ? 'pl-3' : 'lg:justify-center lg:pl-0 lg:pr-0',
    isActive
      ? 'border-slate-900 bg-slate-50 font-semibold text-slate-900'
      : 'border-transparent text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900',
  ].join(' ');

/**
  Three explicit sections instead of one flat list. Previously "Monitoring
  Karyawan" and "Acara Saya" sat under the "Event" heading with no separation,
  so they read as children of a group they did not belong to.

  Visibility is not a design choice: /api/events answers 403 for anyone outside
  departId 0300, so those links stay hidden for everyone else. A section with no
  items is dropped entirely rather than left as a bare heading.
*/
export const SidebarNav = ({ canManageEvents, canViewMyEvents, showLabels }: SidebarNavProps) => {
  const sections: NavSection[] = [
    { heading: 'Utama', items: [{ label: 'Ringkasan', to: '/dashboard', icon: IconRingkasan, end: true }] },
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
          ? [{ label: 'Monitoring Karyawan', to: '/employee-monitoring', icon: IconMonitoring }]
          : []),
        ...(canViewMyEvents ? [{ label: 'Acara Saya', to: '/my-events', icon: IconAcaraSaya }] : []),
      ],
    },
  ].filter((section) => section.items.length > 0);

  return (
    <nav aria-label="Menu utama" className="grid gap-5">
      {sections.map((section) => (
        <div key={section.heading}>
          <p className={sectionClass}>{section.heading}</p>
          <ul className="grid gap-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
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
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
};
