import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { classNames, initials, statusTone } from '../lib/format.js';

/* ---------------------------------- Icon ---------------------------------- */

export function Icon({ name, className = '', filled = false, size = 20, style }) {
  return (
    <span
      aria-hidden="true"
      className={classNames('material-symbols-outlined', filled && 'icon-filled', className)}
      style={{ fontSize: `${size}px`, ...style }}
    >
      {name}
    </span>
  );
}

/* ---------------------------------- Card ---------------------------------- */

export function Card({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag className={classNames('card', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, icon, action, className = '' }) {
  return (
    <div className={classNames('flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4', className)}>
      <div className="flex items-start gap-3">
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-brand-blue">
            <Icon name={icon} size={20} />
          </span>
        )}
        <div>
          <h3 className="text-headline-sm text-primary">{title}</h3>
          {subtitle && <p className="mt-0.5 text-body-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* --------------------------------- Badges --------------------------------- */

const TONE_CLASS = {
  urgent: 'pill-urgent',
  pending: 'pill-pending',
  resolved: 'pill-resolved',
  ai: 'pill-ai',
  neutral: 'pill-neutral',
};

export function Pill({ tone = 'neutral', children, icon, className = '' }) {
  return (
    <span className={classNames(TONE_CLASS[tone] || TONE_CLASS.neutral, className)}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export function StatusPill({ status, label }) {
  return <Pill tone={statusTone(status)}>{label || status}</Pill>;
}

/* -------------------------------- Stat card ------------------------------- */

export function StatCard({ label, value, icon, hint, tone = 'neutral', delta }) {
  const toneRing = {
    urgent: 'bg-red-50 text-red-600',
    pending: 'bg-amber-50 text-amber-600',
    resolved: 'bg-emerald-50 text-emerald-600',
    ai: 'bg-sky-50 text-brand-blue',
    neutral: 'bg-slate-100 text-slate-600',
  }[tone];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label-md uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 truncate font-display text-[28px] font-bold leading-none text-primary">{value}</p>
          {(hint || delta) && (
            <p className="mt-2 flex items-center gap-1.5 text-body-sm text-slate-500">
              {delta && (
                <span className={delta.startsWith('-') ? 'text-red-600' : 'text-emerald-600'}>
                  <Icon name={delta.startsWith('-') ? 'trending_down' : 'trending_up'} size={14} />
                </span>
              )}
              {hint}
            </p>
          )}
        </div>
        {icon && <span className={classNames('flex h-11 w-11 items-center justify-center rounded-xl', toneRing)}>
          <Icon name={icon} size={22} />
        </span>}
      </div>
    </Card>
  );
}

/* -------------------------------- Feedback -------------------------------- */

export function Spinner({ size = 20, className = '' }) {
  return (
    <span
      className={classNames('inline-block animate-spin rounded-full border-2 border-slate-300 border-t-brand-blue', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function LoadingBlock({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
      <Spinner />
      <span className="text-body-md">{label}</span>
    </div>
  );
}

export function SkeletonRows({ rows = 4, className = '' }) {
  return (
    <div className={classNames('space-y-3 p-5', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name={icon} size={28} />
      </span>
      <h4 className="text-headline-sm text-primary">{title}</h4>
      {description && <p className="max-w-md text-body-sm text-slate-500">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
        <Icon name="error" size={24} />
      </span>
      <p className="max-w-lg text-body-md text-slate-600">{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary btn-sm" onClick={onRetry}>
          <Icon name="refresh" size={16} /> Retry
        </button>
      )}
    </div>
  );
}

export function InlineAlert({ tone = 'info', icon, children, className = '' }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
  const icons = { info: 'info', warning: 'warning', error: 'error', success: 'check_circle' };
  return (
    <div className={classNames('flex items-start gap-2 rounded-lg border px-3 py-2 text-body-sm', tones[tone], className)}>
      <Icon name={icon || icons[tone]} size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* --------------------------------- Inputs --------------------------------- */

export function Field({ label, hint, error, required, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-label-sm text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-label-sm text-slate-400">{hint}</p>
      )}
    </div>
  );
}

export function Input({ className = '', ...rest }) {
  return <input className={classNames('input', className)} {...rest} />;
}

export function Textarea({ className = '', ...rest }) {
  return <textarea className={classNames('input resize-y', className)} {...rest} />;
}

export function Select({ className = '', children, ...rest }) {
  return (
    <select className={classNames('input pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

export function Avatar({ name, size = 32, className = '' }) {
  return (
    <span
      className={classNames('inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      title={name}
    >
      {initials(name) || <Icon name="person" size={size * 0.55} />}
    </span>
  );
}

/* --------------------------------- Modal ---------------------------------- */

export function Modal({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-primary/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className={classNames('w-full rounded-t-xl bg-white shadow-modal sm:rounded-xl', width)}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-headline-sm text-primary">{title}</h3>
            {subtitle && <p className="mt-0.5 text-body-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------- Pagination ------------------------------- */

export function Pagination({ page, pages, total, limit, onChange }) {
  if (!pages || pages <= 1) {
    return total ? <p className="px-5 py-3 text-body-sm text-slate-500">{total} record(s)</p> : null;
  }
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
      <p className="text-body-sm text-slate-500">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <Icon name="chevron_left" size={16} /> Prev
        </button>
        <span className="text-body-sm text-slate-600">
          Page {page} / {pages}
        </span>
        <button type="button" className="btn-secondary btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next <Icon name="chevron_right" size={16} />
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- Charts --------------------------------- */

/** Simple responsive SVG bar chart with an accessible table fallback. */
export function BarChart({ data = [], height = 180, color = '#0EA5E9', valueSuffix = '' }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <EmptyState icon="bar_chart" title="No data yet" />;
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex min-w-[420px] items-end gap-2" style={{ height }}>
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-label-sm text-slate-500">{d.value}{valueSuffix}</span>
            <div
              className="w-full rounded-t-md transition-all"
              style={{ height: `${Math.max(3, (d.value / max) * (height - 46))}px`, background: d.color || color }}
              title={`${d.label}: ${d.value}`}
            />
            <span className="w-full truncate text-center text-label-sm text-slate-500" title={d.label}>
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dual-series line/area chart for intake vs. resolution trends. */
export function TrendChart({ data = [], height = 220 }) {
  if (!data.length) return <EmptyState icon="show_chart" title="No trend data yet" />;

  const width = 720;
  const padding = { top: 16, right: 16, bottom: 28, left: 36 };
  const max = Math.max(1, ...data.map((d) => Math.max(d.intake, d.resolved)));
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const pointsFor = (key) =>
    data.map((d, i) => [padding.left + i * step, padding.top + innerH - (d[key] / max) * innerH]);

  const path = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const intakePts = pointsFor('intake');
  const resolvedPts = pointsFor('resolved');
  const areaPath = `${path(intakePts)} L${intakePts.at(-1)[0].toFixed(1)},${padding.top + innerH} L${intakePts[0][0].toFixed(1)},${padding.top + innerH} Z`;

  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[560px]" role="img" aria-label="Intake and resolution trend">
        <defs>
          <linearGradient id="intakeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => {
          const y = padding.top + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#E2E8F0" strokeWidth="1" />
              <text x={padding.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                {t}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#intakeFill)" />
        <path d={path(intakePts)} fill="none" stroke="#0EA5E9" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={path(resolvedPts)} fill="none" stroke="#14B8A6" strokeWidth="2.5" strokeDasharray="5 4" strokeLinejoin="round" />
        {data.map((d, i) => {
          if (data.length > 14 && i % Math.ceil(data.length / 7) !== 0) return null;
          return (
            <text key={d.date + i} x={padding.left + i * step} y={height - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">
              {String(d.date).slice(5)}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-label-sm text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-brand-blue" /> Intake
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-brand-teal" /> Resolved
        </span>
      </div>
    </div>
  );
}

/** Horizontal distribution bars — used for category / department breakdowns. */
export function DistributionList({ items = [], color = '#0EA5E9', emptyLabel = 'No data yet' }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="px-5 py-6 text-body-sm text-slate-500">{emptyLabel}</p>;
  return (
    <ul className="space-y-3.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-center justify-between gap-3 text-body-sm">
            <span className="truncate text-slate-700">{item.label}</span>
            <span className="shrink-0 font-semibold text-primary">{item.value}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.value / max) * 100}%`, background: item.color || color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Meter({ value = 0, tone = '#0EA5E9', height = 6, label }) {
  return (
    <div>
      {label && <p className="mb-1 text-label-sm text-slate-500">{label}</p>}
      <div className="w-full overflow-hidden rounded-full bg-slate-100" style={{ height }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: tone }} />
      </div>
    </div>
  );
}

/* ---------------------------------- Tabs ---------------------------------- */

export function TabStrip({ tabs = [], value, onChange, className = '' }) {
  return (
    <div className={classNames('flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={classNames(
            'rounded-md px-3 py-1.5 text-label-md transition-colors',
            value === tab.value ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {tab.label}
          {tab.count !== undefined && <span className="ml-1.5 text-slate-400">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------- Toasts --------------------------------- */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, tone: 'info', ...toast }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), toast.duration || 4500);
  }, []);

  const value = useMemo(
    () => ({
      toast: push,
      success: (message, title = 'Success') => push({ tone: 'success', title, message }),
      error: (message, title = 'Something went wrong') => push({ tone: 'error', title, message }),
      info: (message, title = 'Notice') => push({ tone: 'info', title, message }),
    }),
    [push]
  );

  const toneClass = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
  };
  const toneIcon = { success: 'check_circle', error: 'error', info: 'info' };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={classNames('pointer-events-auto flex items-start gap-2 rounded-lg border px-3.5 py-3 shadow-popover', toneClass[t.tone])}
          >
            <Icon name={toneIcon[t.tone]} size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-label-md">{t.title}</p>
              {t.message && <p className="mt-0.5 text-body-sm opacity-90">{t.message}</p>}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              className="ml-auto rounded p-0.5 opacity-60 hover:opacity-100"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
