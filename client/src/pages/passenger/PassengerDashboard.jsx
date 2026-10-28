import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/AppShell.jsx';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Icon,
  LoadingBlock,
  Pill,
  StatCard,
  StatusPill,
} from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  formatDateTime,
  relativeTime,
  slaLabel,
} from '../../lib/format.js';

const MILESTONES = ['submitted', 'triaged', 'assigned', 'in_progress', 'resolved'];

export default function PassengerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api
      .passengerOverview()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <>
        <PageHeader icon="dashboard" breadcrumb={['Passenger']} title="My Redressal Dashboard" />
        <div className="mx-auto max-w-[1720px] px-gutter py-6">
          <Card>
            <ErrorState message={error} onRetry={load} />
          </Card>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader icon="dashboard" breadcrumb={['Passenger']} title="My Redressal Dashboard" />
        <div className="mx-auto max-w-[1720px] px-gutter py-6">
          <LoadingBlock label="Loading your redressal record…" />
        </div>
      </>
    );
  }

  const { kpis, recent } = data;
  const live = recent.find((g) => !['resolved', 'closed', 'rejected'].includes(g.status));
  const currentStep = live ? Math.max(0, MILESTONES.indexOf(live.status === 'awaiting_clarification' || live.status === 'escalated' ? 'in_progress' : live.status)) : -1;

  return (
    <>
      <PageHeader
        icon="dashboard"
        breadcrumb={['Home', 'Passenger Dashboard']}
        title={`Welcome back, ${user?.name?.split(' ')[0] || 'passenger'}`}
        description={
          user?.pnr
            ? `Verified commuter · PNR ${user.pnr} · ${kpis.active} active case(s) in flight`
            : `${kpis.active} active case(s) in flight`
        }
        meta={<Pill tone="ai" icon="verified_user">JWT session active</Pill>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/passenger/submit" className="btn-accent btn-sm">
              <Icon name="add_circle" size={16} /> Submit new grievance
            </Link>
            <Link to="/passenger/grievances" className="btn-secondary btn-sm">
              <Icon name="list_alt" size={16} /> My tickets
            </Link>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-[1720px] space-y-5 px-gutter py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total complaints" value={kpis.total} icon="folder_open" hint="Lifetime passenger record" tone="ai" />
          <StatCard label="Active & in flight" value={kpis.active} icon="sync" hint="Currently with an operational wing" tone="pending" />
          <StatCard label="Resolved & closed" value={kpis.resolved} icon="check_circle" hint="Verified closures" tone="resolved" />
          <StatCard
            label="Avg. rating given"
            value={kpis.avgRatingGiven ? `${kpis.avgRatingGiven} / 5` : '—'}
            icon="star"
            hint={`${kpis.feedbackCount} feedback(s) submitted`}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          {/* --------------------------- Live ticket --------------------------- */}
          <Card className="xl:col-span-2">
            <CardHeader
              icon="confirmation_number"
              title="Active ticket"
              subtitle={live ? 'Live SLA countdown and milestone tracking' : 'No grievance currently in flight'}
            />
            {!live ? (
              <EmptyState
                icon="task_alt"
                title="Nothing in flight"
                description="You have no open grievances. Lodge one and it will be triaged and routed automatically."
                action={
                  <Link to="/passenger/submit" className="btn-accent btn-sm">
                    <Icon name="add_circle" size={16} /> Lodge a grievance
                  </Link>
                }
              />
            ) : (
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={live.slaBreached ? 'urgent' : 'pending'} icon="flag">
                        {PRIORITY_LABELS[live.priority]}
                      </Pill>
                      <Pill tone="ai">{live.statusLabel}</Pill>
                      {live.escalation?.level > 0 && <Pill tone="urgent">Escalated L{live.escalation.level}</Pill>}
                    </div>
                    <h3 className="mt-2 font-display text-headline-md text-primary">{live.subject}</h3>
                    <p className="mt-1 line-clamp-2 max-w-2xl text-body-sm text-slate-500">{live.description}</p>
                  </div>
                  <Link to={`/passenger/grievances/${live._id}`} className="btn-secondary btn-sm">
                    Open case <Icon name="arrow_forward" size={16} />
                  </Link>
                </div>

                <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
                  <div>
                    <dt className="text-label-sm uppercase tracking-wider text-slate-400">Reference</dt>
                    <dd className="font-mono text-body-sm text-slate-700">{live.referenceId}</dd>
                  </div>
                  <div>
                    <dt className="text-label-sm uppercase tracking-wider text-slate-400">Category</dt>
                    <dd className="flex items-center gap-1.5 text-body-sm text-slate-700">
                      <Icon name={CATEGORY_ICONS[live.category]} size={15} />
                      {CATEGORY_LABELS[live.category]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-label-sm uppercase tracking-wider text-slate-400">Handling wing</dt>
                    <dd className="text-body-sm text-slate-700">{live.department?.name || 'Awaiting assignment'}</dd>
                  </div>
                  <div>
                    <dt className="text-label-sm uppercase tracking-wider text-slate-400">SLA</dt>
                    <dd className={live.slaBreached ? 'text-body-sm font-medium text-red-600' : 'text-body-sm text-slate-700'}>
                      {live.slaRemainingLabel || slaLabel(live.slaRemainingMs)}
                    </dd>
                  </div>
                </dl>

                {live.assignedOfficer && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
                      <Icon name="engineering" size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-body-sm font-semibold text-primary">{live.assignedOfficer.name}</p>
                      <p className="text-label-sm text-slate-500">
                        {live.assignedOfficer.designation || 'Assigned officer'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-5">
                  <p className="mb-3 text-label-md uppercase tracking-wider text-slate-500">
                    Redressal milestone tracker
                  </p>
                  <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-0">
                    {MILESTONES.map((step, i) => {
                      const done = i <= currentStep || live.status === 'resolved';
                      const isCurrent = i === currentStep + 1;
                      return (
                        <li key={step} className="flex flex-1 items-start gap-2 sm:flex-col sm:items-center sm:text-center">
                          <div className="flex items-center gap-2 sm:w-full sm:flex-col">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-label-sm ${
                                done ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-brand-blue text-white' : 'bg-slate-200 text-slate-500'
                              }`}
                            >
                              {done ? <Icon name="check" size={14} /> : i + 1}
                            </span>
                            {i < MILESTONES.length - 1 && (
                              <span className={`hidden h-0.5 flex-1 sm:block ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                            )}
                          </div>
                          <span className={`text-label-sm capitalize ${done ? 'text-slate-700' : 'text-slate-400'}`}>
                            {step.replace(/_/g, ' ')}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            )}
          </Card>

          {/* --------------------------- Recent list --------------------------- */}
          <Card>
            <CardHeader
              icon="history"
              title="Recent grievances"
              action={
                <button type="button" className="btn-ghost btn-sm" onClick={load} title="Refresh">
                  <Icon name="refresh" size={16} />
                </button>
              }
            />
            {recent.length === 0 ? (
              <EmptyState icon="inbox" title="No grievances yet" description="Your lodged grievances will appear here." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((g) => (
                  <li key={g._id}>
                    <Link to={`/passenger/grievances/${g._id}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <Icon name={CATEGORY_ICONS[g.category] || 'label'} size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-medium text-primary">{g.subject}</p>
                        <p className="mt-0.5 font-mono text-label-sm text-slate-400">
                          {g.referenceId} · {relativeTime(g.createdAt)}
                        </p>
                      </div>
                      <StatusPill status={g.status} label={g.statusLabel} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {[
            { icon: 'bolt', title: 'Automated triage', body: 'Category, severity and SLA window are derived the moment you submit.', to: '/passenger/submit', cta: 'Lodge a grievance' },
            { icon: 'forum', title: 'Two-way communication', body: 'Reply to officer clarification requests inside the case thread.', to: '/passenger/grievances', cta: 'Open my tickets' },
            { icon: 'notifications', title: 'Notifications', body: 'Status changes, assignments and escalations are pushed to your feed.', to: '/notifications', cta: 'View notifications' },
          ].map((item) => (
            <Card key={item.title} className="p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-brand-blue">
                <Icon name={item.icon} size={20} />
              </span>
              <h3 className="mt-3 text-headline-sm text-primary">{item.title}</h3>
              <p className="mt-1 text-body-sm text-slate-500">{item.body}</p>
              <button type="button" className="btn-ghost btn-sm mt-3 -ml-3 text-brand-blue" onClick={() => navigate(item.to)}>
                {item.cta} <Icon name="arrow_forward" size={15} />
              </button>
            </Card>
          ))}
        </div>

        <p className="text-label-sm text-slate-400">
          Record last synchronised {formatDateTime(new Date())}. Figures are derived from your own grievance records only.
        </p>
      </div>
    </>
  );
}
