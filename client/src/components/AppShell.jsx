import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { Avatar, Icon, Pill } from './ui.jsx';
import { classNames, relativeTime } from '../lib/format.js';

const NAV_BY_ROLE = {
  passenger: [
    { to: '/passenger', label: 'Overview', icon: 'dashboard', end: true },
    { to: '/passenger/submit', label: 'Lodge Grievance', icon: 'add_circle' },
    { to: '/passenger/grievances', label: 'My Tickets', icon: 'confirmation_number' },
    { to: '/notifications', label: 'Notifications', icon: 'notifications' },
    { to: '/passenger/profile', label: 'Account', icon: 'person' },
  ],
  officer: [
    { to: '/officer', label: 'Overview', icon: 'dashboard', end: true },
    { to: '/officer/queue', label: 'Queue Ledger', icon: 'list_alt' },
    { to: '/officer/escalations', label: 'Escalation & Assignment', icon: 'alt_route' },
    { to: '/notifications', label: 'Notifications', icon: 'notifications' },
  ],
  admin: [
    { to: '/admin', label: 'Overview', icon: 'dashboard', end: true },
    { to: '/officer/queue', label: 'Queue Ledger', icon: 'list_alt' },
    { to: '/officer/escalations', label: 'Escalation & Assignment', icon: 'alt_route' },
    { to: '/admin/ai-insights', label: 'AI Insights', icon: 'psychology' },
    { to: '/admin/departments', label: 'Departments', icon: 'corporate_fare' },
    { to: '/admin/users', label: 'Users & Roles', icon: 'group' },
    { to: '/admin/reports', label: 'Reports & Exports', icon: 'assessment' },
    { to: '/admin/settings', label: 'System Settings', icon: 'settings' },
    { to: '/notifications', label: 'Notifications', icon: 'notifications' },
  ],
};

export function AppShell({ children }) {
  const { user, logout, engine } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const nav = NAV_BY_ROLE[user?.role] || NAV_BY_ROLE.passenger;

  const loadUnread = useCallback(() => {
    api
      .listNotifications({ limit: 1, unread: 'true' })
      .then((res) => setUnread(res.unread || 0))
      .catch(() => setUnread(0));
  }, []);

  useEffect(() => {
    loadUnread();
    const id = setInterval(loadUnread, 30000);
    return () => clearInterval(id);
  }, [loadUnread, location.pathname]);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const fallbackEngine = engine?.engine === 'rule-based-fallback';

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed inset-x-0 top-0 z-50 bg-surface/95 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        <div className="flex h-16 w-full items-center justify-between gap-3 px-gutter">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/" className="flex shrink-0 items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container text-brand-blue shadow-sm">
                <Icon name="commute" size={22} />
              </span>
              <span className="hidden flex-col sm:flex">
                <span className="font-display text-headline-sm leading-none tracking-tight text-on-surface">
                  Grievance<span className="text-brand-blue">AI</span>
                </span>
                <span className="text-label-sm uppercase tracking-wider text-slate-500">Rail &amp; Transit Ops</span>
              </span>
            </Link>
            <div className="hidden items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-slate-500 xl:flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue" />
              <span className="text-label-sm">{fallbackEngine ? 'Rule-based triage active' : 'AI engine online'}</span>
            </div>
          </div>

          <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto lg:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  classNames(
                    'shrink-0 rounded-lg px-3 py-2 text-body-md transition-colors',
                    isActive
                      ? 'bg-primary-container font-semibold text-white'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-on-surface'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="hidden items-center gap-1.5 rounded-lg bg-error px-3 py-1.5 text-label-md text-white shadow-sm transition-colors hover:brightness-110 sm:flex"
              onClick={() => navigate(user?.role === 'passenger' ? '/passenger/submit' : '/officer/queue')}
              title="Raise an emergency grievance"
            >
              <Icon name="e911_emergency" size={18} />
              SOS Quick
            </button>

            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
            >
              <Icon name="notifications" size={22} />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-blue px-1 text-[9px] font-semibold leading-none text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 transition-colors hover:bg-slate-100"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="hidden flex-col text-right xl:flex">
                  <span className="text-label-md font-semibold leading-tight text-on-surface">{user?.name}</span>
                  <span className="text-label-sm capitalize text-slate-500">{user?.role}</span>
                </span>
                <Avatar name={user?.name} size={32} />
                <Icon name="expand_more" size={18} className="text-slate-400" />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-popover">
                  <div className="border-b border-slate-100 px-3 py-2">
                    <p className="text-body-md font-semibold text-primary">{user?.name}</p>
                    <p className="truncate text-body-sm text-slate-500">{user?.email}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Pill tone="ai">{user?.role}</Pill>
                      {user?.employeeId && <Pill tone="neutral">{user.employeeId}</Pill>}
                    </div>
                  </div>
                  {user?.role === 'passenger' && (
                    <Link
                      role="menuitem"
                      to="/passenger/profile"
                      onClick={() => setMenuOpen(false)}
                      className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-body-sm text-slate-600 hover:bg-slate-50"
                    >
                      <Icon name="manage_accounts" size={18} /> Profile &amp; settings
                    </Link>
                  )}
                  <button
                    role="menuitem"
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-body-sm text-red-600 hover:bg-red-50"
                  >
                    <Icon name="logout" size={18} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Compact navigation for small screens */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-3 py-1.5 lg:hidden">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                classNames(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-label-md',
                  isActive ? 'bg-primary-container text-white' : 'text-slate-500'
                )
              }
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="w-full pt-16 lg:pt-16">
        <div className="lg:pt-0 pt-12">{children}</div>
      </main>
    </div>
  );
}

/** Operational banner used at the top of every console screen (mirrors Stitch). */
export function PageHeader({ icon, breadcrumb = [], title, description, actions, meta, tone = 'primary' }) {
  return (
    <div className="w-full bg-surface-container-low py-4 shadow-sm">
      <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-3 px-gutter xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {icon && (
            <span
              className={classNames(
                'flex h-12 w-12 items-center justify-center rounded-xl shadow-md',
                tone === 'primary' ? 'bg-primary-container text-brand-blue' : 'bg-brand-blue text-white'
              )}
            >
              <Icon name={icon} size={26} filled />
            </span>
          )}
          <div className="min-w-0">
            {breadcrumb.length > 0 && (
              <nav className="flex flex-wrap items-center gap-1 text-label-sm uppercase tracking-wider text-slate-500">
                {breadcrumb.map((crumb, i) => (
                  <span key={crumb} className="flex items-center gap-1">
                    {i > 0 && <Icon name="chevron_right" size={12} />}
                    {crumb}
                  </span>
                ))}
              </nav>
            )}
            <h1 className="truncate font-display text-headline-lg text-primary">{title}</h1>
            {description && <p className="mt-0.5 max-w-3xl text-body-sm text-slate-500">{description}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {meta}
          {actions}
        </div>
      </div>
    </div>
  );
}

export function EngineBadge({ engine }) {
  if (!engine) return null;
  const isFallback = engine.engine === 'rule-based-fallback';
  return (
    <Pill tone={isFallback ? 'pending' : 'ai'} icon={isFallback ? 'rule' : 'auto_awesome'}>
      {isFallback ? 'Rule-based fallback' : `${engine.provider} · ${engine.model}`}
    </Pill>
  );
}

export function LastUpdated({ value }) {
  return <span className="text-label-sm text-slate-500">Updated {relativeTime(value)}</span>;
}
