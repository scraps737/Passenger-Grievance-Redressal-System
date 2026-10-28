import { Link } from 'react-router-dom';
import { Icon, Pill, EmptyState, Pagination, StatusPill } from './ui.jsx';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  classNames,
  formatDate,
  relativeTime,
  slaLabel,
} from '../lib/format.js';

export function GrievanceMeta({ grievance }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pill tone={grievance.priority === 'tier1' ? 'urgent' : grievance.priority === 'tier2' ? 'pending' : 'neutral'} icon="flag">
        {PRIORITY_LABELS[grievance.priority] || grievance.priority}
      </Pill>
      <Pill tone="neutral" icon={CATEGORY_ICONS[grievance.category] || 'label'}>
        {grievance.categoryLabel || CATEGORY_LABELS[grievance.category] || grievance.category}
      </Pill>
      {grievance.escalation?.level > 0 && <Pill tone="urgent" icon="alt_route">Escalation L{grievance.escalation.level}</Pill>}
    </div>
  );
}

export function SlaCell({ grievance }) {
  const remaining = grievance.slaRemainingMs;
  const breached = grievance.slaBreached;
  const label = grievance.slaRemainingLabel || slaLabel(remaining);
  const overdue = remaining !== null && remaining !== undefined && remaining < 0;
  const isClosed = ['resolved', 'closed', 'rejected'].includes(grievance.status);
  const windowMs = (grievance.sla?.hours || 24) * 3600000;
  const elapsed = remaining === null || remaining === undefined ? 0 : windowMs - remaining;
  const elapsedPct = Math.max(4, Math.min(100, (elapsed / windowMs) * 100));

  return (
    <div className="min-w-[130px]">
      <p className={classNames('text-body-sm font-medium', breached ? 'text-red-600' : overdue ? 'text-amber-600' : 'text-slate-700')}>
        {label}
      </p>
      {isClosed ? (
        <p className="mt-1 text-label-sm text-slate-400">{grievance.sla?.hours}h window</p>
      ) : (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full"
            style={{
              width: `${elapsedPct}%`,
              background: breached ? '#EF4444' : remaining < 3600000 ? '#F59E0B' : '#10B981',
            }}
          />
        </div>
      )}
    </div>
  );
}

export function GrievanceCard({ grievance, to, actions, showPassenger = false, footer }) {
  return (
    <div className="card p-4 transition-shadow hover:shadow-popover">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Icon name={CATEGORY_ICONS[grievance.category] || 'label'} size={18} />
          </span>
          <div className="min-w-0">
            <Link to={to} className="block truncate text-body-md font-semibold text-primary hover:text-brand-blue">
              {grievance.subject}
            </Link>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-label-sm text-slate-500">
              <span>{grievance.referenceId}</span>
              {grievance.trainNumber && <span>· Train {grievance.trainNumber}</span>}
              {grievance.coach && <span>· {grievance.coach}</span>}
              <span>· {relativeTime(grievance.createdAt)}</span>
            </p>
          </div>
        </div>
        <StatusPill status={grievance.status} label={grievance.statusLabel} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <GrievanceMeta grievance={grievance} />
        {showPassenger && grievance.passenger?.name && (
          <span className="text-body-sm text-slate-500">{grievance.passenger.name}</span>
        )}
      </div>

      <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
        <div>
          <p className="text-label-sm uppercase tracking-wider text-slate-400">Handling wing</p>
          <p className="text-body-sm text-slate-700">{grievance.department?.name || 'Unassigned'}</p>
        </div>
        <SlaCell grievance={grievance} />
      </div>

      {(actions || footer) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {actions}
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * Responsive grievance list: a data table on large screens that collapses to
 * cards on small screens, mirroring the Stitch list/detail pattern.
 */
export function GrievanceList({
  items = [],
  loading = false,
  detailPath,
  actionsFor,
  showPassenger = false,
  emptyTitle = 'No grievances found',
  emptyDescription = 'Adjust your filters or lodge a new grievance.',
  emptyAction,
  pagination,
  onPageChange,
}) {
  if (!loading && items.length === 0) {
    return (
      <div>
        <EmptyState icon="inbox" title={emptyTitle} description={emptyDescription} action={emptyAction} />
        {pagination && <Pagination {...pagination} onChange={onPageChange} />}
      </div>
    );
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="table-th">Reference &amp; subject</th>
              {showPassenger && <th className="table-th">Passenger</th>}
              <th className="table-th">Category</th>
              <th className="table-th">Priority</th>
              <th className="table-th">Status</th>
              <th className="table-th">SLA</th>
              <th className="table-th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td colSpan={showPassenger ? 7 : 6} className="table-td">
                    <div className="skeleton h-8 w-full rounded" />
                  </td>
                </tr>
              ))}
            {!loading &&
              items.map((g) => (
                <tr key={g._id} className="border-b border-slate-100 align-top hover:bg-slate-50/60">
                  <td className="table-td">
                    <Link to={detailPath(g)} className="font-medium text-primary hover:text-brand-blue">
                      {g.subject}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-label-sm text-slate-500">
                      <span>{g.referenceId}</span>
                      {g.trainNumber && <span>· {g.trainNumber}</span>}
                      {g.coach && <span>· {g.coach}</span>}
                    </p>
                    <p className="mt-0.5 text-label-sm text-slate-400">
                      {g.department?.name || 'Unassigned'} · {formatDate(g.createdAt)}
                    </p>
                  </td>
                  {showPassenger && (
                    <td className="table-td">
                      <p className="text-slate-700">{g.passenger?.name || '—'}</p>
                      {g.pnr && <p className="font-mono text-label-sm text-slate-400">PNR {g.pnr}</p>}
                    </td>
                  )}
                  <td className="table-td">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <Icon name={CATEGORY_ICONS[g.category] || 'label'} size={15} />
                      {g.categoryLabel || CATEGORY_LABELS[g.category] || g.category}
                    </span>
                  </td>
                  <td className="table-td">
                    <Pill tone={g.priority === 'tier1' ? 'urgent' : g.priority === 'tier2' ? 'pending' : 'neutral'}>
                      {PRIORITY_LABELS[g.priority] || g.priority}
                    </Pill>
                  </td>
                  <td className="table-td">
                    <StatusPill status={g.status} label={g.statusLabel} />
                    {g.escalation?.level > 0 && (
                      <p className="mt-1 text-label-sm text-red-600">Escalated L{g.escalation.level}</p>
                    )}
                  </td>
                  <td className="table-td">
                    <SlaCell grievance={g} />
                  </td>
                  <td className="table-td">
                    <div className="flex flex-wrap justify-end gap-1.5">{actionsFor ? actionsFor(g) : null}</div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 p-4 lg:hidden">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-40 w-full rounded-lg" />)}
        {!loading &&
          items.map((g) => (
            <GrievanceCard
              key={g._id}
              grievance={g}
              to={detailPath(g)}
              showPassenger={showPassenger}
              actions={actionsFor ? actionsFor(g) : null}
            />
          ))}
      </div>

      {pagination && <Pagination {...pagination} onChange={onPageChange} />}
    </div>
  );
}
