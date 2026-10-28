import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/AppShell.jsx';
import {
  Card,
  CardHeader,
  DistributionList,
  ErrorState,
  Icon,
  LoadingBlock,
  Meter,
  Pill,
  Select,
  StatCard,
  TabStrip,
  TrendChart,
} from '../../components/ui.jsx';
import { api } from '../../lib/api.js';

const RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '12m', label: 'Last 12 months' },
];

export default function AdminDashboard() {
  const [range, setRange] = useState('90d');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api
      .adminOverview(range)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <>
        <PageHeader icon="insights" breadcrumb={['Administration']} title="Executive analytics" />
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
        <PageHeader icon="insights" breadcrumb={['Administration']} title="Executive analytics" />
        <div className="mx-auto max-w-[1720px] px-gutter py-6">
          <LoadingBlock label="Computing analytics from stored records…" />
        </div>
      </>
    );
  }

  const { kpis, byStatus, byCategory, byDepartment, byPriority, trend } = data;
  const totalPriority = byPriority.reduce((s, p) => s + p.count, 0) || 1;

  return (
    <>
      <PageHeader
        icon="insights"
        breadcrumb={['Transit Command', 'Executive Governance', 'Analytics & Performance BI']}
        title="Systemwide redressal analytics"
        description="Every figure on this page is aggregated live from the grievance database."
        meta={<Pill tone="ai" icon="database">Live aggregation</Pill>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onChange={(e) => setRange(e.target.value)} className="w-44">
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
            <button type="button" className="btn-secondary btn-sm" onClick={load}>
              <Icon name="refresh" size={16} /> Refresh
            </button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-[1720px] space-y-5 px-gutter py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total grievances" value={kpis.total} icon="receipt_long" hint={`${kpis.inRange} in selected range`} tone="ai" />
          <StatCard label="Resolution rate" value={`${kpis.resolutionRate}%`} icon="task_alt" hint={`${kpis.resolved} closed overall`} tone="resolved" />
          <StatCard label="SLA compliance" value={`${kpis.slaCompliance}%`} icon="verified" hint={`${kpis.breached} breach(es) recorded`} tone={kpis.slaCompliance >= 90 ? 'resolved' : 'pending'} />
          <StatCard label="Mean time to resolve" value={kpis.mttrMinutes ? `${kpis.mttrMinutes}m` : '—'} icon="timer" hint={`${kpis.mttrSamples} resolved case(s) sampled`} />
          <StatCard label="Active workload" value={kpis.active} icon="pending_actions" hint="Currently with a wing" tone="pending" />
          <StatCard label="Escalations" value={kpis.escalated} icon="alt_route" hint="Raised above wing level" tone={kpis.escalated ? 'urgent' : 'neutral'} />
          <StatCard label="Passenger rating" value={kpis.avgRating ? `${kpis.avgRating} / 5` : '—'} icon="star" hint={`${kpis.feedbackCount} verified feedback(s)`} />
          <StatCard label="Registered accounts" value={kpis.passengerCount + kpis.staffCount} icon="groups" hint={`${kpis.staffCount} staff · ${kpis.passengerCount} passengers`} />
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              icon="query_stats"
              title="Intake & resolution velocity"
              subtitle={`Daily intake versus closures over the selected range`}
            />
            <div className="p-5">
              <TrendChart data={trend} />
            </div>
          </Card>

          <Card>
            <CardHeader icon="donut_small" title="Lifecycle distribution" subtitle="Current status mix" />
            <div className="p-5">
              <DistributionList
                items={byStatus.map((s) => ({ label: s.label, value: s.count }))}
                color="#0EA5E9"
                emptyLabel="No grievances recorded yet"
              />
            </div>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Card>
            <CardHeader icon="category" title="Category distribution" />
            <div className="p-5">
              <DistributionList
                items={byCategory.map((c) => ({ label: c.label, value: c.count }))}
                color="#14B8A6"
                emptyLabel="No grievances in range"
              />
            </div>
          </Card>

          <Card>
            <CardHeader icon="corporate_fare" title="Departmental load" />
            <div className="p-5">
              <DistributionList
                items={byDepartment.map((d) => ({ label: d.name, value: d.count }))}
                color="#0F1E36"
                emptyLabel="No routed cases yet"
              />
            </div>
          </Card>

          <Card>
            <CardHeader icon="flag" title="Priority mix" subtitle="Share of cases by tier" />
            <div className="p-5 space-y-4">
              {[
                ['tier1', 'Tier 1 · Critical', '#EF4444'],
                ['tier2', 'Tier 2 · High', '#F59E0B'],
                ['tier3', 'Tier 3 · Standard', '#10B981'],
              ].map(([key, label, color]) => {
                const count = byPriority.find((p) => p.priority === key)?.count || 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="text-slate-600">{label}</span>
                      <span className="font-semibold text-primary">
                        {count} · {Math.round((count / totalPriority) * 100)}%
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Meter value={(count / totalPriority) * 100} tone={color} />
                    </div>
                  </div>
                );
              })}

              <div className="border-t border-slate-100 pt-4">
                <Link to="/admin/ai-insights" className="btn-secondary btn-sm w-full">
                  <Icon name="psychology" size={15} /> Open AI insights
                </Link>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader
            icon="bolt"
            title="Administrative shortcuts"
            subtitle="Jump straight into the governance consoles"
          />
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['group', 'Users & roles', '/admin/users', 'RBAC directory and identity governance'],
              ['corporate_fare', 'Departments', '/admin/departments', 'Operational wings, capacity and SLA'],
              ['assessment', 'Reports & exports', '/admin/reports', 'Statutory reporting and CSV export'],
              ['settings', 'Settings & audit', '/admin/settings', 'SLA rules, taxonomy and audit trail'],
            ].map(([icon, title, to, body]) => (
              <Link key={to} to={to} className="card p-4 transition-shadow hover:shadow-popover">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-brand-blue">
                  <Icon name={icon} size={20} />
                </span>
                <p className="mt-3 text-body-md font-semibold text-primary">{title}</p>
                <p className="mt-0.5 text-body-sm text-slate-500">{body}</p>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader icon="info" title="Data provenance" />
          <div className="p-5">
            <TabStrip
              tabs={[
                { value: 'note', label: 'How these figures are produced' },
              ]}
              value="note"
              onChange={() => {}}
            />
            <p className="mt-3 text-body-sm text-slate-500">
              All metrics are computed with MongoDB aggregation pipelines over the live <code>grievances</code>,{' '}
              <code>feedback</code>, <code>users</code> and <code>departments</code> collections. No placeholder or
              fabricated values are displayed; an empty database correctly reports zeros and empty distributions.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
