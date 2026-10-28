import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/AppShell.jsx';
import {
  Card,
  CardHeader,
  DistributionList,
  EmptyState,
  ErrorState,
  Icon,
  InlineAlert,
  LoadingBlock,
  Meter,
  Pill,
  Select,
  StatCard,
} from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { CATEGORY_ICONS } from '../../lib/format.js';

export default function AiInsights() {
  const [range, setRange] = useState('90d');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api
      .aiInsights(range)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <>
        <PageHeader icon="psychology" breadcrumb={['Administration']} title="AI insights" />
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
        <PageHeader icon="psychology" breadcrumb={['Administration']} title="AI insights" />
        <div className="mx-auto max-w-[1720px] px-gutter py-6">
          <LoadingBlock label="Analysing triage records…" />
        </div>
      </>
    );
  }

  const { engine, totals, categories, recurringPatterns, escalationHotspots, engineConfidence } = data;
  const isFallback = engine.engine === 'rule-based-fallback';

  return (
    <>
      <PageHeader
        icon="psychology"
        breadcrumb={['Transit Command', 'Administrative Governance', 'AI Predictive Intelligence']}
        title="AI triage insights & systemic patterns"
        description="Engine transparency plus recurring-issue detection computed from real triage records."
        meta={
          <Pill tone={isFallback ? 'pending' : 'ai'} icon={isFallback ? 'rule' : 'auto_awesome'}>
            {isFallback ? 'Rule-based fallback engine' : `${engine.provider} · ${engine.model}`}
          </Pill>
        }
        actions={
          <Select value={range} onChange={(e) => setRange(e.target.value)} className="w-44">
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="12m">Last 12 months</option>
          </Select>
        }
      />

      <div className="mx-auto w-full max-w-[1720px] space-y-5 px-gutter py-6">
        <InlineAlert tone={isFallback ? 'warning' : 'success'} icon={isFallback ? 'info' : 'verified'}>
          <strong>Engine status: {engine.engine}</strong>
          <span className="mt-0.5 block">{engine.note}</span>
        </InlineAlert>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Cases analysed" value={totals.analyzed} icon="database" hint="In the selected range" tone="ai" />
          <StatCard label="Duplicates clustered" value={totals.duplicatesClustered} icon="content_copy" hint="Linked to a parent case" tone="pending" />
          <StatCard label="Unresolved" value={totals.unresolved} icon="pending_actions" hint="Still with a wing" tone={totals.unresolved ? 'pending' : 'resolved'} />
          <StatCard
            label="Avg. engine confidence"
            value={
              engineConfidence.length
                ? `${Math.round(
                    (engineConfidence.reduce((s, c) => s + c.avgConfidence, 0) / engineConfidence.length) * 100
                  )}%`
                : '—'
            }
            icon="psychology"
            hint={`${engineConfidence.reduce((s, c) => s + c.samples, 0)} triage sample(s)`}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader icon="category" title="Category attribution" subtitle="Volume, share and SLA breaches by category" />
            <div className="p-5">
              {categories.length === 0 ? (
                <EmptyState icon="insights" title="No triaged cases in range" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="table-th">Category</th>
                        <th className="table-th">Cases</th>
                        <th className="table-th">Share</th>
                        <th className="table-th">Breached</th>
                        <th className="table-th">Distribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((c) => (
                        <tr key={c.category} className="border-b border-slate-100">
                          <td className="table-td">
                            <span className="flex items-center gap-2 text-slate-700">
                              <Icon name={CATEGORY_ICONS[c.category] || 'label'} size={16} />
                              {c.label}
                            </span>
                          </td>
                          <td className="table-td font-semibold text-primary">{c.count}</td>
                          <td className="table-td text-slate-600">{c.share}%</td>
                          <td className="table-td">
                            {c.breached > 0 ? <Pill tone="urgent">{c.breached}</Pill> : <span className="text-slate-400">0</span>}
                          </td>
                          <td className="table-td w-40">
                            <Meter value={c.share} tone="#0EA5E9" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader icon="replay" title="Recurring patterns" subtitle="Repeated sub-categories with 2+ cases" />
            <div className="p-5">
              {recurringPatterns.length === 0 ? (
                <EmptyState icon="pattern" title="No recurring patterns detected" description="Patterns appear once the same sub-category recurs." />
              ) : (
                <ul className="space-y-3">
                  {recurringPatterns.map((p) => (
                    <li key={`${p.category}-${p.pattern}`} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-body-sm font-medium text-primary">{p.label}</span>
                        <Pill tone="ai">{p.count} cases</Pill>
                      </div>
                      <p className="mt-1 line-clamp-2 text-label-sm text-slate-500">{p.pattern}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Card>
            <CardHeader icon="warning" title="Escalation hotspots" subtitle="Categories most often escalated" />
            <div className="p-5">
              <DistributionList
                items={escalationHotspots.map((h) => ({ label: h.label, value: h.count }))}
                color="#EF4444"
                emptyLabel="No escalations in range"
              />
            </div>
          </Card>

          <Card>
            <CardHeader icon="model_training" title="Engine confidence by engine" subtitle="Samples and mean confidence" />
            <div className="p-5">
              {engineConfidence.length === 0 ? (
                <EmptyState icon="psychology" title="No triage records yet" />
              ) : (
                <ul className="space-y-4">
                  {engineConfidence.map((c) => (
                    <li key={c.engine}>
                      <div className="flex items-center justify-between text-body-sm">
                        <span className="font-mono text-slate-700">{c.engine}</span>
                        <span className="font-semibold text-primary">{Math.round(c.avgConfidence * 100)}%</span>
                      </div>
                      <div className="mt-1.5">
                        <Meter value={c.avgConfidence * 100} tone={c.engine === 'rule-based-fallback' ? '#F59E0B' : '#14B8A6'} />
                      </div>
                      <p className="mt-1 text-label-sm text-slate-400">{c.samples} triage sample(s)</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader icon="settings_suggest" title="How the triage engine works" />
            <div className="space-y-3 p-5">
              <p className="text-body-sm text-slate-600">
                The engine produces a structured recommendation — category, sub-category, severity, priority, handling
                wing, SLA window, a neutral summary, next steps, sentiment and duplicate candidates. The output is
                validated against a strict schema before it is accepted.
              </p>
              <ul className="space-y-2 text-body-sm text-slate-600">
                {[
                  'Provider-backed results are tagged with the real provider and model name.',
                  'If a provider is configured but fails, the case falls back and the reason is recorded.',
                  'When no provider is configured the deterministic rule-based engine runs and is labelled as such.',
                  'Authorised officers may override any recommendation; the original is preserved.',
                  'Duplicate detection is computed from actual stored grievances, never invented.',
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <Icon name="check_circle" size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                    {line}
                  </li>
                ))}
              </ul>
              <InlineAlert tone="info" className="mt-2">
                Configure a provider with <code className="font-mono">AI_PROVIDER</code> and the matching API key in{' '}
                <code className="font-mono">server/.env</code> to enable live model triage.
              </InlineAlert>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
