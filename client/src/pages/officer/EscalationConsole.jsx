import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/AppShell.jsx';
import { SlaCell } from '../../components/GrievanceList.jsx';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  Input,
  Modal,
  Pill,
  Select,
  Spinner,
  StatCard,
  TabStrip,
  useToast,
} from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { CATEGORY_ICONS, PRIORITY_LABELS, relativeTime } from '../../lib/format.js';

const TABS = [
  { value: 'breached', label: 'SLA breached' },
  { value: 'imminent', label: 'Imminent breach' },
  { value: 'unassigned', label: 'Pending assignment' },
  { value: 'escalated', label: 'Escalation watchlist' },
];

export default function EscalationConsole() {
  const toast = useToast();
  const [tab, setTab] = useState('breached');
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [officers, setOfficers] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [reassignOpen, setReassignOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const [reassignForm, setReassignForm] = useState({ officerId: '', departmentId: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = { limit: 50, sort: 'sla' };
    if (tab === 'breached') params.slaBreached = 'true';
    if (tab === 'escalated') params.escalated = 'true';
    if (tab === 'unassigned') params.status = 'triaged';
    if (search.trim()) params.search = search.trim();

    api
      .listGrievances(params)
      .then((res) => {
        let list = res.items;
        if (tab === 'unassigned') list = list.filter((g) => !g.assignedOfficer);
        if (tab === 'imminent') {
          const active = list.filter((g) => !['resolved', 'closed', 'rejected'].includes(g.status));
          const soon = active.filter(
            (g) => g.slaRemainingMs !== null && g.slaRemainingMs > 0 && g.slaRemainingMs < 15 * 60 * 1000
          );
          list = soon.length ? soon : active.slice(0, 8);
        }
        setItems(list);
        setPagination(res.pagination);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tab, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    Promise.all([api.listOfficers().catch(() => ({ officers: [] })), api.listDepartments().catch(() => ({ departments: [] }))]).then(
      ([o, d]) => {
        setOfficers(o.officers || []);
        setDepartments(d.departments || []);
      }
    );
  }, []);

  const fleet = useMemo(() => {
    const engaged = new Set(items.map((g) => g.assignedOfficer?._id).filter(Boolean));
    const total = officers.length || 1;
    return { total: officers.length, engaged: engaged.size, util: Math.round((engaged.size / total) * 100) };
  }, [items, officers]);

  const openReassign = (g) => {
    setTarget(g);
    setReassignForm({ officerId: g.assignedOfficer?._id || '', departmentId: g.department?._id || '', reason: '' });
    setReassignOpen(true);
  };

  const doReassign = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await api.assignGrievance(target._id, {
        officerId: reassignForm.officerId || undefined,
        departmentId: reassignForm.departmentId || undefined,
        reason: reassignForm.reason || 'Batch reassignment from escalation console',
      });
      toast.success(`${target.referenceId} reassigned`);
      setReassignOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const doEscalate = async (g) => {
    try {
      await api.escalateGrievance(g._id, { reason: 'Automatic escalation from the SLA watchlist.' });
      toast.success(`${g.referenceId} escalated to divisional level`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const counts = {
    breached: items.filter((g) => g.slaBreached).length,
    imminent: items.filter((g) => g.slaRemainingMs !== null && g.slaRemainingMs > 0 && g.slaRemainingMs < 15 * 60 * 1000).length,
    unassigned: items.filter((g) => !g.assignedOfficer).length,
    escalated: items.filter((g) => g.escalation?.level > 0).length,
  };

  return (
    <>
      <PageHeader
        icon="alt_route"
        breadcrumb={['Ops Command', 'Triage & Dispatch', 'Escalation & Assignment Console']}
        title="Escalation & assignment console"
        description="SLA watchlist, countdown to breach, unassigned intake and the escalation queue."
        meta={<Pill tone="ai" icon="router">Adaptive dispatch</Pill>}
        actions={
          <button type="button" className="btn-secondary btn-sm" onClick={load}>
            <Icon name="refresh" size={16} /> Refresh watchlist
          </button>
        }
      />

      <div className="mx-auto w-full max-w-[1720px] space-y-5 px-gutter py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="SLA breached" value={counts.breached} icon="crisis_alert" hint="Past the statutory window" tone={counts.breached ? 'urgent' : 'resolved'} />
          <StatCard label="Imminent breach" value={counts.imminent} icon="timer" hint="Under 15 minutes remaining" tone={counts.imminent ? 'pending' : 'neutral'} />
          <StatCard label="Pending assignment" value={counts.unassigned} icon="pending_actions" hint="Awaiting an owning officer" tone={counts.unassigned ? 'pending' : 'neutral'} />
          <StatCard label="Fleet utilisation" value={`${fleet.util}%`} icon="groups" hint={`${fleet.engaged} of ${fleet.total} officers engaged`} tone="ai" />
        </div>

        {counts.breached > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <Icon name="notification_important" size={20} className="text-red-600" />
            <p className="text-body-sm text-red-700">
              <strong>{counts.breached} case(s)</strong> have breached their statutory SLA. These are recorded in the audit
              log and should be escalated or resolved immediately.
            </p>
          </div>
        )}

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
            <TabStrip
              tabs={TABS.map((t) => ({ ...t, count: counts[t.value] }))}
              value={tab}
              onChange={setTab}
            />
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Icon name="search" size={16} />
              </span>
              <Input className="w-60 pl-9" placeholder="Search reference or subject" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {error ? (
            <ErrorState message={error} onRetry={load} />
          ) : loading ? (
            <div className="p-5">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-14 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon="verified"
              title="Nothing needs attention here"
              description="No cases in this view. The watchlist is clear."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="table-th">Incident</th>
                    <th className="table-th">Priority</th>
                    <th className="table-th">Wing</th>
                    <th className="table-th">SLA status</th>
                    <th className="table-th">Assigned to</th>
                    <th className="table-th text-right">Dispatch</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((g) => (
                    <tr key={g._id} className="border-b border-slate-100 align-top hover:bg-slate-50/60">
                      <td className="table-td">
                        <Link to={`/officer/cases/${g._id}`} className="flex items-start gap-2 font-medium text-primary hover:text-brand-blue">
                          <Icon name={CATEGORY_ICONS[g.category] || 'label'} size={16} className="mt-0.5 shrink-0 text-slate-400" />
                          <span>
                            {g.subject}
                            <span className="mt-0.5 block font-mono text-label-sm font-normal text-slate-400">
                              {g.referenceId} · {relativeTime(g.createdAt)}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="table-td">
                        <Pill tone={g.priority === 'tier1' ? 'urgent' : g.priority === 'tier2' ? 'pending' : 'neutral'}>
                          {PRIORITY_LABELS[g.priority]}
                        </Pill>
                      </td>
                      <td className="table-td text-slate-600">{g.department?.name || 'Unassigned'}</td>
                      <td className="table-td">
                        <SlaCell grievance={g} />
                        <span className={`mt-1 block text-label-sm ${g.slaBreached ? 'text-red-600' : 'text-slate-400'}`}>
                          {g.slaBreached ? 'SLA breached' : g.statusLabel || g.status}
                        </span>
                      </td>
                      <td className="table-td">
                        {g.assignedOfficer ? (
                          <span className="text-slate-700">{g.assignedOfficer.name}</span>
                        ) : (
                          <Pill tone="pending">Unassigned</Pill>
                        )}
                      </td>
                      <td className="table-td">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button type="button" className="btn-secondary btn-sm" onClick={() => openReassign(g)}>
                            <Icon name="swap_horiz" size={14} /> Reassign
                          </button>
                          {!g.slaBreached && g.escalation?.level === 0 && (
                            <button type="button" className="btn-danger btn-sm" onClick={() => doEscalate(g)}>
                              <Icon name="emergency_share" size={14} /> Escalate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="border-t border-slate-100 px-5 py-3 text-label-sm text-slate-400">
            {pagination.total} case(s) matched · showing {items.length}
          </p>
        </Card>

        <Card>
          <CardHeader icon="insights" title="Escalation ladder" subtitle="How SLA pressure drives escalation" />
          <ol className="grid gap-3 p-5 sm:grid-cols-4">
            {[
              ['1', 'Wing level', 'The owning department officer acts within the SLA window.'],
              ['2', 'Divisional', 'On breach or imminent breach the case escalates and the SLA window halves.'],
              ['3', 'DRM office', 'Administrators and the divisional office are notified automatically.'],
              ['4', 'Statutory audit', 'Every breach and escalation is written to the immutable audit log.'],
            ].map(([step, title, body]) => (
              <li key={step} className="rounded-lg border border-slate-200 p-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-container text-label-sm text-white">
                  {step}
                </span>
                <p className="mt-2 text-body-md font-semibold text-primary">{title}</p>
                <p className="mt-0.5 text-body-sm text-slate-500">{body}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Modal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title="Reassign case"
        subtitle={target ? `${target.referenceId} — ${target.subject}` : ''}
        footer={
          <>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setReassignOpen(false)}>Cancel</button>
            <button type="button" className="btn-accent btn-sm" onClick={doReassign} disabled={busy}>
              {busy && <Spinner size={15} className="border-white/40 border-t-white" />} Apply reassignment
            </button>
          </>
        }
      >
        <Field label="Department / wing">
          <Select value={reassignForm.departmentId} onChange={(e) => setReassignForm((f) => ({ ...f, departmentId: e.target.value }))}>
            <option value="">Keep current wing</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} ({d.code})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Officer" className="mt-4">
          <Select value={reassignForm.officerId} onChange={(e) => setReassignForm((f) => ({ ...f, officerId: e.target.value }))}>
            <option value="">Leave unassigned (pool)</option>
            {officers.map((o) => (
              <option key={o._id} value={o._id}>
                {o.name} — {o.designation || o.role} {o.department?.code ? `(${o.department.code})` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reason" className="mt-4">
          <Input value={reassignForm.reason} onChange={(e) => setReassignForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Optional note for the timeline" />
        </Field>
      </Modal>
    </>
  );
}
