import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/AppShell.jsx';
import { GrievanceList } from '../../components/GrievanceList.jsx';
import {
  Card,
  ErrorState,
  Icon,
  Input,
  Pill,
  Select,
  StatCard,
  TabStrip,
  useToast,
} from '../../components/ui.jsx';
import { api, csvExportUrl, tokenStore } from '../../lib/api.js';
import { CATEGORY_OPTIONS, PRIORITY_LABELS, STATUS_OPTIONS } from '../../lib/format.js';

const QUICK_TABS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'tier1', label: 'High priority' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'escalated', label: 'Escalated' },
];

export default function MyGrievances() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [quick, setQuick] = useState('all');
  const [filters, setFilters] = useState({ status: '', category: '', priority: '', search: '', sort: 'latest' });
  const [searchDraft, setSearchDraft] = useState('');
  const [page, setPage] = useState(1);

  const query = useMemo(() => {
    const q = { page, limit: 10, sort: filters.sort };
    if (filters.status) q.status = filters.status;
    if (filters.category) q.category = filters.category;
    if (filters.priority) q.priority = filters.priority;
    if (searchDraft.trim()) q.search = searchDraft.trim();
    if (quick === 'active') q.status = 'active';
    if (quick === 'tier1') q.priority = 'tier1';
    if (quick === 'resolved') q.status = 'resolved';
    if (quick === 'escalated') q.escalated = 'true';
    return q;
  }, [page, filters, searchDraft, quick]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .listGrievances(query)
      .then((res) => {
        setItems(res.items);
        setPagination(res.pagination);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .passengerOverview()
      .then((res) => setSummary(res.kpis))
      .catch(() => setSummary(null));
  }, [pagination.total]);

  const exportCsv = async () => {
    try {
      const token = tokenStore.get();
      const res = await fetch(csvExportUrl(), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-grievances-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Your grievance audit was exported as CSV');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader
        icon="confirmation_number"
        breadcrumb={['Home', 'Passenger Dashboard', 'My Complaints']}
        title="My grievances & redressal history"
        description="Search, filter and track the full lifecycle of every grievance you have lodged."
        meta={<Pill tone="ai" icon="sync">Live SLA radar</Pill>}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={exportCsv}>
              <Icon name="file_download" size={16} /> Export CSV
            </button>
            <Link to="/passenger/submit" className="btn-accent btn-sm">
              <Icon name="add_circle" size={16} /> Lodge new grievance
            </Link>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-[1720px] space-y-5 px-gutter py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total grievances" value={summary?.total ?? '—'} icon="receipt_long" hint="Lifetime record" tone="ai" />
          <StatCard label="Active & in flight" value={summary?.active ?? '—'} icon="pending_actions" hint="With an operational wing" tone="pending" />
          <StatCard label="Resolved & closed" value={summary?.resolved ?? '—'} icon="verified" hint="Verified closures" tone="resolved" />
          <StatCard label="Escalated" value={summary?.escalated ?? '—'} icon="alt_route" hint="Raised to divisional level" tone={summary?.escalated ? 'urgent' : 'neutral'} />
        </div>

        <Card>
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabStrip
                tabs={QUICK_TABS.map((t) => ({ ...t, value: t.value }))}
                value={quick}
                onChange={(v) => {
                  setQuick(v);
                  setPage(1);
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Icon name="search" size={16} />
                  </span>
                  <Input
                    className="w-56 pl-9"
                    placeholder="Search reference or subject"
                    value={searchDraft}
                    onChange={(e) => {
                      setSearchDraft(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <button type="button" className="btn-secondary btn-sm" onClick={load} title="Refresh">
                  <Icon name="refresh" size={16} />
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="label" htmlFor="f-status">Lifecycle status</label>
                <Select
                  id="f-status"
                  value={filters.status}
                  onChange={(e) => {
                    setFilters((f) => ({ ...f, status: e.target.value }));
                    setQuick('all');
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="label" htmlFor="f-category">Category</label>
                <Select
                  id="f-category"
                  value={filters.category}
                  onChange={(e) => {
                    setFilters((f) => ({ ...f, category: e.target.value }));
                    setPage(1);
                  }}
                >
                  <option value="">All categories</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="label" htmlFor="f-priority">Priority tier</label>
                <Select
                  id="f-priority"
                  value={filters.priority}
                  onChange={(e) => {
                    setFilters((f) => ({ ...f, priority: e.target.value }));
                    setPage(1);
                  }}
                >
                  <option value="">All priorities</option>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="label" htmlFor="f-sort">Sort</label>
                <Select
                  id="f-sort"
                  value={filters.sort}
                  onChange={(e) => {
                    setFilters((f) => ({ ...f, sort: e.target.value }));
                    setPage(1);
                  }}
                >
                  <option value="latest">Latest filed</option>
                  <option value="oldest">Oldest filed</option>
                  <option value="priority">Priority (high to low)</option>
                  <option value="sla">SLA time remaining</option>
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
              showPassenger={false}
              detailPath={(g) => `/passenger/grievances/${g._id}`}
              emptyTitle="No grievances match your filters"
              emptyDescription="Try clearing the filters, or lodge a new grievance."
              emptyAction={
                <Link to="/passenger/submit" className="btn-accent btn-sm">
                  <Icon name="add_circle" size={16} /> Lodge a grievance
                </Link>
              }
              actionsFor={(g) => (
                <Link to={`/passenger/grievances/${g._id}`} className="btn-secondary btn-sm">
                  Open <Icon name="arrow_forward" size={14} />
                </Link>
              )}
              pagination={pagination}
              onPageChange={setPage}
            />
          )}
        </Card>
      </div>
    </>
  );
}
