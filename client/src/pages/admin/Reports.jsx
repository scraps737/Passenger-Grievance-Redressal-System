import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/AppShell.jsx';
import {
  BarChart,
  Card,
  CardHeader,
  DistributionList,
  EmptyState,
  ErrorState,
  Icon,
  InlineAlert,
  LoadingBlock,
  Pill,
  Select,
  Spinner,
  StatCard,
  useToast,
} from '../../components/ui.jsx';
import { api, csvExportUrl, tokenStore } from '../../lib/api.js';
import { PRIORITY_LABELS } from '../../lib/format.js';

export default function Reports() {
  const toast = useToast();
  const [range, setRange] = useState('90d');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    setError('');
    api
      .reports(range)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const download = async (scope) => {
    setBusy(scope);
    try {
      const token = tokenStore.get();
      const params = scope === 'all' ? {} : { status: scope };
      const res = await fetch(csvExportUrl(params), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grievanceai-${scope}-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${scope} dataset as CSV`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  if (error) {
    return (
      <>
        <PageHeader icon="assessment" breadcrumb={['Administration']} title="Reports & exports" />
        <div className="mx-auto max-w-[1720px] px-gutter py-6">
          <Card><ErrorState message={error} onRetry={load} /></Card>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader icon="assessment" breadcrumb={['Administration']} title="Reports & exports" />
        <div className="mx-auto max-w-[1720px] px-gutter py-6">
          <LoadingBlock label="Compiling statutory report…" />
        </div>
      </>
    );
  }

  const { monthly, byStation, slaByPriority, topSubjects, messageVolume } = data;
  const totals = monthly.reduce(
    (acc, m) => ({
      intake: acc.intake + m.intake,
      resolved: acc.resolved + m.resolved,
      breached: acc.breached + m.breached,
    }),
    { intake: 0, resolved: 0, breached: 0 }
  );

  return (
    <>
      <PageHeader
        icon="assessment"
        breadcrumb={['Transit Command', 'Executive Governance', 'Statutory Reports & Exports']}
        title="Reports & data export engine"
        description="Statutory rollups, breach accounting and CSV export of the underlying records."
        meta={<Pill tone="ai" icon="database">Aggregated live</Pill>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onChange={(e) => setRange(e.target.value)} className="w-44">
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="12m">Last 12 months</option>
            </Select>
            <button type="button" className="btn-secondary btn-sm" onClick={load}>
              <Icon name="refresh" size={16} /> Recompute
            </button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-[1720px] space-y-5 px-gutter py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Intake in range" value={totals.intake} icon="dynamic_form" hint="Grievances received" tone="ai" />
          <StatCard label="Resolved in range" value={totals.resolved} icon="task_alt" hint="Verified closures" tone="resolved" />
          <StatCard label="SLA breaches" value={totals.breached} icon="timer_off" hint="Statutory failures" tone={totals.breached ? 'urgent' : 'resolved'} />
          <StatCard label="Conversation volume" value={messageVolume} icon="forum" hint="Messages exchanged" />
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader icon="calendar_month" title="Monthly rollup" subtitle="Intake, closures and breaches by month" />
            <div className="p-5">
              {monthly.length === 0 ? (
                <EmptyState icon="bar_chart" title="No data in range" />
              ) : (
                <BarChart
                  data={monthly.map((m) => ({ label: m.month, value: m.intake }))}
                  color="#0EA5E9"
                />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader icon="shield" title="SLA compliance by priority" />
            <div className="p-5 space-y-4">
              {slaByPriority.length === 0 ? (
                <EmptyState icon="verified" title="No SLA data yet" />
              ) : (
                slaByPriority.map((p) => (
                  <div key={p.priority} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <Pill tone={p.priority === 'tier1' ? 'urgent' : p.priority === 'tier2' ? 'pending' : 'resolved'}>
                        {PRIORITY_LABELS[p.priority] || p.priority}
                      </Pill>
                      <span className="font-display text-headline-sm text-primary">{p.compliance}%</span>
                    </div>
                    <p className="mt-1.5 text-label-sm text-slate-500">
                      {p.count} case(s) · {p.breached} breach(es)
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Card>
            <CardHeader icon="location_on" title="Top boarding / incident stations" />
            <div className="p-5">
              <DistributionList
                items={byStation.map((s) => ({ label: s.station, value: s.count }))}
                color="#14B8A6"
                emptyLabel="No station data recorded"
              />
            </div>
          </Card>

          <Card>
            <CardHeader icon="subject" title="Most common subjects" />
            <div className="p-5">
              {topSubjects.length === 0 ? (
                <EmptyState icon="subject" title="No subjects yet" />
              ) : (
                <ul className="space-y-3">
                  {topSubjects.map((s) => (
                    <li key={s.subject} className="flex items-start justify-between gap-3">
                      <span className="line-clamp-2 text-body-sm text-slate-600">{s.subject}</span>
                      <span className="shrink-0 text-body-sm font-semibold text-primary">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader icon="file_download" title="Export centre" subtitle="CSV of the raw grievance records" />
            <div className="space-y-3 p-5">
              <InlineAlert tone="info" icon="lock">
                Exports are authorised per request and written to the audit ledger.
              </InlineAlert>
              {[
                ['all', 'Complete dataset', 'Every grievance visible to the administrator'],
                ['resolved', 'Resolved cases', 'Closures with resolution timestamps'],
                ['escalated', 'Escalated cases', 'Cases raised above wing level'],
              ].map(([scope, title, body]) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => download(scope)}
                  disabled={busy === scope}
                  className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-brand-blue disabled:opacity-60"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-brand-blue">
                    {busy === scope ? <Spinner size={16} /> : <Icon name="table_view" size={18} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-body-sm font-medium text-primary">{title}</span>
                    <span className="block text-label-sm text-slate-500">{body}</span>
                  </span>
                </button>
              ))}
              <p className="text-label-sm text-slate-400">
                Exports are capped at 5,000 rows per download. PDF and XLSX rendering are not implemented in this build.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
