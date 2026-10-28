import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/AppShell.jsx';
import { GrievanceList } from '../../components/GrievanceList.jsx';
import {
  Card,
  CardHeader,
  ErrorState,
  Icon,
  InlineAlert,
  Input,
  Pill,
  Select,
  StatCard,
  TabStrip,
  useToast,
} from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { CATEGORY_OPTIONS, PRIORITY_LABELS, TRANSPORT_MODE_LABELS } from '../../lib/format.js';

const TABS = [
  { value: 'all', label: 'All incidents' },
  { value: 'breached', label: 'SLA breached' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'tier1', label: 'Tier 1' },
  { value: 'escalated', label: 'Escalated' },
];

export default function OfficerQueue() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [filters, setFilters] = useState({ category: '', priority: '', transport: '', search: '', sort: 'sla' });
  const [searchDraft, setSearchDraft] = useState('');
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 12, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const query = useMemo(() => {
    const q = { page, limit: 12, sort: filters.sort };
    if (filters.category) q.category = filters.category;
    if (filters.priority) q.priority = filters.priority;
    if (searchDraft.trim()) q.search = searchDraft.trim();
    if (tab === 'breached') q.slaBreached = 'true';
    if (tab === 'tier1') q.priority = 'tier1';
    if (tab === 'escalated') q.escalated = 'true';
    if (tab === 'unassigned') q.status = 'triaged';
    return q;
  }, [page, filters, searchDraft, tab]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .listGrievances(query)
      .then((res) => {
        const list = tab === 'unassigned' ? res.items.filter((g) => !g.assignedOfficer) : res.items;
        setItems(list);
        setPagination(res.pagination);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [query, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(
    () => ({
      total: pagination.total,
      breached: items.filter((g) => g.slaBreached).length,
      tier1: items.filter((g) => g.priority === 'tier1').length,
      unassigned: items.filter((g) => !g.assignedOfficer).length,
    }),
    [items, pagination.total]
  );

  const claim = async (g) => {
    try {
      await api.assignGrievance(g._id, { officerId: user.id || user._id, reason: 'Claimed from dispatch ledger' });
      toast.success(`${g.referenceId} assigned to you`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader
        icon="list_alt"
        breadcrumb={['Ops Root', 'Officer Command', 'Triage & Dispatch Queue']}
        title="Complaint queue & incident triage console"
        description="Every case visible to your wing, ordered by SLA risk. Claim, investigate and dispatch from here."
        meta={<Pill tone="ai" icon="sensors">Auto-refreshing ledger</Pill>}
        actions={
          <button type="button" className="btn-secondary btn-sm" onClick={load}>
            <Icon name="refresh" size={16} /> Refresh ledger
          </button>
        }
      />

      <div className="mx-auto w-full max-w-[1720px] space-y-5 px-gutter py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Cases in query" value={summary.total} icon="dynamic_feed" hint="Matching the current filters" tone="ai" />
          <StatCard label="SLA breached" value={summary.breached} icon="timer_off" hint="On this page" tone={summary.breached ? 'urgent' : 'resolved'} />
          <StatCard label="Tier 1 critical" value={summary.tier1} icon="emergency" hint="On this page" tone={summary.tier1 ? 'urgent' : 'neutral'} />
          <StatCard label="Unassigned" value={summary.unassigned} icon="person_add" hint="Awaiting an officer" tone={summary.unassigned ? 'pending' : 'neutral'} />
        </div>

        <InlineAlert tone="info" icon="visibility">
          You only see cases assigned to you or belonging to{' '}
          <strong>{user?.department ? 'your department' : 'your scope'}</strong>. This restriction is enforced by the API,
          not just the interface.
        </InlineAlert>

        <Card>
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabStrip tabs={TABS} value={tab} onChange={(v) => { setTab(v); setPage(1); }} />
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Icon name="search" size={16} />
                </span>
                <Input
                  className="w-64 pl-9"
                  placeholder="Reference, subject or PNR"
                  value={searchDraft}
                  onChange={(e) => {
                    setSearchDraft(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="label" htmlFor="q-category">Category</label>
                <Select id="q-category" value={filters.category} onChange={(e) => { setFilters((f) => ({ ...f, category: e.target.value })); setPage(1); }}>
                  <option value="">All categories</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="label" htmlFor="q-priority">Priority tier</label>
                <Select id="q-priority" value={filters.priority} onChange={(e) => { setFilters((f) => ({ ...f, priority: e.target.value })); setTab('all'); setPage(1); }}>
                  <option value="">All tiers</option>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="label" htmlFor="q-transport">Transport mode</label>
                <Select id="q-transport" value={filters.transport} onChange={(e) => setFilters((f) => ({ ...f, transport: e.target.value }))}>
                  <option value="">All modes</option>
                  {Object.entries(TRANSPORT_MODE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="label" htmlFor="q-sort">Order by</label>
                <Select id="q-sort" value={filters.sort} onChange={(e) => { setFilters((f) => ({ ...f, sort: e.target.value })); setPage(1); }}>
                  <option value="sla">SLA time remaining</option>
                  <option value="priority">Priority (high to low)</option>
                  <option value="latest">Latest filed</option>
                  <option value="oldest">Oldest filed</option>
                </Select>
              </div>
            </div>
          </div>

          {error ? (
            <ErrorState message={error} onRetry={load} />
          ) : (
            <GrievanceList
              items={items}
              loading={loading}
              showPassenger
              detailPath={(g) => `/officer/cases/${g._id}`}
              emptyTitle="No incidents match this view"
              emptyDescription="Try a different tab or clear the filters."
              actionsFor={(g) => (
                <>
                  <Link to={`/officer/cases/${g._id}`} className="btn-secondary btn-sm">
                    <Icon name="open_in_new" size={14} /> Investigate
                  </Link>
                  {!g.assignedOfficer && (
                    <button type="button" className="btn-accent btn-sm" onClick={() => claim(g)}>
                      <Icon name="person_add" size={14} /> Claim
                    </button>
                  )}
                </>
              )}
              pagination={pagination}
              onPageChange={setPage}
            />
          )}
        </Card>

        <Card>
          <CardHeader icon="info" title="Dispatch reference" subtitle="How the queue is ordered" />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            {[
              ['Severity first', 'Tier 1 critical cases always appear above Tier 2 and Tier 3.'],
              ['Then SLA window', 'Within a tier, cases closest to breaching their SLA come first.'],
              ['Unassigned pool', 'Cases still awaiting an owner can be claimed directly from this ledger.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-slate-200 p-4">
                <p className="text-body-md font-semibold text-primary">{title}</p>
                <p className="mt-1 text-body-sm text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
