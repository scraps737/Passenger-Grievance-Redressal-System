import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/AppShell.jsx';
import { GrievanceMeta, SlaCell } from '../../components/GrievanceList.jsx';
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
  useToast,
} from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { CATEGORY_ICONS, CATEGORY_LABELS, relativeTime } from '../../lib/format.js';

export default function OfficerDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setError('');
    api
      .officerOverview()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const claim = async (g) => {
    setBusyId(g._id);
    try {
      await api.assignGrievance(g._id, { officerId: user.id || user._id, reason: 'Self-assigned from triage queue' });
      toast.success(`Case ${g.referenceId} assigned to you`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (error) {
    return (
      <>
        <PageHeader icon="dashboard" breadcrumb={['Officer']} title="Operations dashboard" />
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
        <PageHeader icon="dashboard" breadcrumb={['Officer']} title="Operations dashboard" />
        <div className="mx-auto max-w-[1720px] px-gutter py-6">
          <LoadingBlock label="Loading your operational load…" />
        </div>
      </>
    );
  }

  const { kpis, queue } = data;

  return (
    <>
      <PageHeader
        icon="badge"
        breadcrumb={['Ops Root', 'Officer Command']}
        title={user?.name || 'Officer console'}
        description={`${user?.designation || 'Officer'}${user?.employeeId ? ` · ${user.employeeId}` : ''}${
          user?.division ? ` · ${user.division} Division` : ''
        }`}
        meta={<Pill tone="ai" icon="sensors">Field mesh live</Pill>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/officer/queue" className="btn-primary btn-sm">
              <Icon name="list_alt" size={16} /> Open dispatch ledger
            </Link>
            <Link to="/officer/escalations" className="btn-secondary btn-sm">
              <Icon name="alt_route" size={16} /> Escalations
            </Link>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-[1720px] space-y-5 px-gutter py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Active in your scope" value={kpis.active} icon="assignment_turned_in" hint="Cases visible to you" tone="ai" />
          <StatCard label="Assigned to you" value={kpis.mine} icon="person_pin" hint="Personally owned cases" tone="pending" />
          <StatCard label="Awaiting triage sign-off" value={kpis.pendingTriage} icon="psychology" hint="Recommendation not yet actioned" tone={kpis.pendingTriage ? 'pending' : 'neutral'} />
          <StatCard label="SLA breached" value={kpis.breached} icon="timer_off" hint="Past the statutory window" tone={kpis.breached ? 'urgent' : 'resolved'} />
          <StatCard label="Escalated" value={kpis.escalated} icon="alt_route" hint="Raised to divisional level" tone={kpis.escalated ? 'urgent' : 'neutral'} />
          <StatCard label="Resolved today" value={kpis.resolvedToday} icon="task_alt" hint="Closed by you since midnight" tone="resolved" />
        </div>

        <Card>
          <CardHeader
            icon="priority_high"
            title="Urgent triage & incident queue"
            subtitle="Ranked by severity and remaining SLA window in your scope"
            action={
              <div className="flex items-center gap-2">
                <button type="button" className="btn-ghost btn-sm" onClick={load}>
                  <Icon name="refresh" size={16} /> Refresh
                </button>
                <Link to="/officer/queue" className="btn-secondary btn-sm">
                  View full ledger
                </Link>
              </div>
            }
          />

          {queue.length === 0 ? (
            <EmptyState
              icon="task_alt"
              title="No active cases in your scope"
              description="Nothing is currently assigned to you or your wing."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {queue.map((g) => (
                <li key={g._id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          g.priority === 'tier1' ? 'bg-red-50 text-red-600' : 'bg-sky-50 text-brand-blue'
                        }`}
                      >
                        <Icon name={CATEGORY_ICONS[g.category] || 'label'} size={20} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-label-sm text-slate-500">{g.referenceId}</span>
                          <Pill tone={g.priority === 'tier1' ? 'urgent' : g.priority === 'tier2' ? 'pending' : 'neutral'}>
                            {g.priority === 'tier1' ? 'Tier 1 · Critical' : g.priority === 'tier2' ? 'Tier 2 · High' : 'Tier 3 · Standard'}
                          </Pill>
                          <StatusPill status={g.status} label={g.statusLabel} />
                        </div>
                        <Link to={`/officer/cases/${g._id}`} className="mt-1 block text-body-md font-semibold text-primary hover:text-brand-blue">
                          {g.subject}
                        </Link>
                        <p className="mt-0.5 line-clamp-2 max-w-3xl text-body-sm text-slate-500">{g.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-label-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <Icon name="train" size={14} />
                            {g.trainNumber ? `${g.trainNumber}${g.coach ? ` · ${g.coach}` : ''}` : CATEGORY_LABELS[g.category]}
                          </span>
                          <span>· {relativeTime(g.createdAt)}</span>
                          {g.passenger?.name && <span>· {g.passenger.name}</span>}
                        </div>
                        <div className="mt-2">
                          <GrievanceMeta grievance={g} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <SlaCell grievance={g} />
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link to={`/officer/cases/${g._id}`} className="btn-secondary btn-sm">
                          <Icon name="open_in_new" size={15} /> Investigate
                        </Link>
                        {!g.assignedOfficer && (
                          <button type="button" className="btn-accent btn-sm" onClick={() => claim(g)} disabled={busyId === g._id}>
                            <Icon name="person_add" size={15} /> Claim
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
