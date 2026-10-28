import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/AppShell.jsx';
import {
  Card,
  CardHeader,
  ErrorState,
  Field,
  Icon,
  InlineAlert,
  Input,
  LoadingBlock,
  Pagination,
  Pill,
  Select,
  Spinner,
  StatCard,
  TabStrip,
  useToast,
} from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { CATEGORY_ICONS, formatDateTime, relativeTime } from '../../lib/format.js';

const TABS = [
  { value: 'rules', label: 'Business rules' },
  { value: 'taxonomy', label: 'Categories' },
  { value: 'audit', label: 'Audit ledger' },
];

const SEVERITY_TONE = { info: 'ai', warning: 'pending', critical: 'urgent' };

export default function SettingsAudit() {
  const toast = useToast();
  const [tab, setTab] = useState('rules');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [sla, setSla] = useState({ tier1: 6, tier2: 24, tier3: 72 });
  const [aiConfig, setAiConfig] = useState({ autoTriage: true, officerOverrideAllowed: true, duplicateDetection: true, confidenceThreshold: 0.6 });
  const [general, setGeneral] = useState({ organisation: '', timezone: 'Asia/Kolkata', defaultLanguage: 'en', dualOtpEnforced: true });

  const [logs, setLogs] = useState([]);
  const [logPage, setLogPage] = useState(1);
  const [logPagination, setLogPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [auditLoading, setAuditLoading] = useState(false);
  const [severity, setSeverity] = useState('');
  const [entity, setEntity] = useState('');

  const load = useCallback(() => {
    setError('');
    api
      .getSettings()
      .then((res) => {
        setData(res);
        setSla(res.settings.slaRules);
        setAiConfig(res.settings.aiConfig);
        setGeneral(res.settings.general);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadLogs = useCallback(() => {
    setAuditLoading(true);
    const params = { page: logPage, limit: 20 };
    if (severity) params.severity = severity;
    if (entity) params.entity = entity;
    api
      .auditLogs(params)
      .then((res) => {
        setLogs(res.items);
        setLogPagination({ total: res.total, page: res.page, limit: res.limit, pages: res.pages });
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setAuditLoading(false));
  }, [logPage, severity, entity, toast]);

  useEffect(() => {
    if (tab === 'audit') loadLogs();
  }, [tab, loadLogs]);

  const save = async () => {
    setBusy(true);
    try {
      await api.updateSettings({
        slaRules: {
          tier1: Number(sla.tier1),
          tier2: Number(sla.tier2),
          tier3: Number(sla.tier3),
        },
        aiConfig,
        general,
      });
      toast.success('Settings saved and propagated');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <>
        <PageHeader icon="settings" breadcrumb={['Administration']} title="System settings" />
        <div className="mx-auto max-w-[1720px] px-gutter py-6">
          <Card><ErrorState message={error} onRetry={load} /></Card>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader icon="settings" breadcrumb={['Administration']} title="System settings" />
        <div className="mx-auto max-w-[1720px] px-gutter py-6">
          <LoadingBlock label="Loading configuration…" />
        </div>
      </>
    );
  }

  const { engine, taxonomy } = data;

  return (
    <>
      <PageHeader
        icon="settings"
        breadcrumb={['Transit Command', 'Administrative Governance', 'System Settings & Audit']}
        title="System settings, business rules & security audit"
        description="SLA policy, AI behaviour, the category taxonomy and the immutable action ledger."
        meta={
          <div className="flex flex-wrap gap-2">
            <Pill tone={engine.configured ? 'ai' : 'pending'} icon="smart_toy">
              {engine.configured ? `${engine.provider} configured` : 'Rule-based fallback'}
            </Pill>
            <Pill tone="resolved" icon="enhanced_encryption">RBAC enforced</Pill>
          </div>
        }
        actions={
          <button type="button" className="btn-primary btn-sm" onClick={save} disabled={busy}>
            {busy ? <Spinner size={15} className="border-white/40 border-t-white" /> : <Icon name="save" size={16} />}
            Save &amp; propagate changes
          </button>
        }
      />

      <div className="mx-auto w-full max-w-[1720px] space-y-5 px-gutter py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="SLA tier 1" value={`${sla.tier1}h`} icon="timer" hint="Critical cases" tone="urgent" />
          <StatCard label="SLA tier 2" value={`${sla.tier2}h`} icon="timer" hint="High priority" tone="pending" />
          <StatCard label="SLA tier 3" value={`${sla.tier3}h`} icon="timer" hint="Standard" tone="resolved" />
          <StatCard label="Categories" value={taxonomy.length} icon="category" hint={`${taxonomy.length} routing classes`} tone="ai" />
        </div>

        <TabStrip tabs={TABS} value={tab} onChange={setTab} />

        {tab === 'rules' && (
          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader icon="timer" title="SLA rules" subtitle="Global fallback windows, in hours. Department-level values take precedence." />
              <div className="grid gap-4 p-5 sm:grid-cols-3">
                <Field label="Tier 1 · Critical">
                  <Input type="number" min="1" max="720" value={sla.tier1} onChange={(e) => setSla((s) => ({ ...s, tier1: e.target.value }))} />
                </Field>
                <Field label="Tier 2 · High">
                  <Input type="number" min="1" max="720" value={sla.tier2} onChange={(e) => setSla((s) => ({ ...s, tier2: e.target.value }))} />
                </Field>
                <Field label="Tier 3 · Standard">
                  <Input type="number" min="1" max="720" value={sla.tier3} onChange={(e) => setSla((s) => ({ ...s, tier3: e.target.value }))} />
                </Field>
              </div>
              <div className="border-t border-slate-100 p-5">
                <InlineAlert tone="info" icon="info">
                  Changing these values affects newly submitted grievances. Existing cases keep the deadline that was
                  calculated when they were lodged, unless an officer overrides them individually.
                </InlineAlert>
              </div>
            </Card>

            <Card>
              <CardHeader icon="smart_toy" title="AI triage behaviour" subtitle="Applies to the configured engine and the rule-based fallback." />
              <div className="divide-y divide-slate-100">
                {[
                  ['autoTriage', 'Run triage automatically', 'Assess every new grievance on submission.'],
                  ['officerOverrideAllowed', 'Allow officer overrides', 'Authorised officers may replace a recommendation.'],
                  ['duplicateDetection', 'Detect duplicate cases', 'Compare new grievances against recent records.'],
                ].map(([key, title, body]) => (
                  <label key={key} className="flex cursor-pointer items-start gap-3 px-5 py-4">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-blue"
                      checked={aiConfig[key]}
                      onChange={(e) => setAiConfig((c) => ({ ...c, [key]: e.target.checked }))}
                    />
                    <span>
                      <span className="block text-body-md font-medium text-primary">{title}</span>
                      <span className="block text-body-sm text-slate-500">{body}</span>
                    </span>
                  </label>
                ))}
                <div className="px-5 py-4">
                  <Field label="Confidence threshold" hint="Recommendations below this value are flagged for review.">
                    <Input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={aiConfig.confidenceThreshold}
                      onChange={(e) => setAiConfig((c) => ({ ...c, confidenceThreshold: Number(e.target.value) }))}
                    />
                  </Field>
                </div>
              </div>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader icon="public" title="Organisation & enforcement" />
              <div className="grid gap-4 p-5 sm:grid-cols-3">
                <Field label="Organisation name">
                  <Input value={general.organisation} onChange={(e) => setGeneral((g) => ({ ...g, organisation: e.target.value }))} />
                </Field>
                <Field label="Timezone">
                  <Input value={general.timezone} onChange={(e) => setGeneral((g) => ({ ...g, timezone: e.target.value }))} />
                </Field>
                <Field label="Default language">
                  <Select value={general.defaultLanguage} onChange={(e) => setGeneral((g) => ({ ...g, defaultLanguage: e.target.value }))}>
                    <option value="en">English (EN)</option>
                    <option value="hi">हिन्दी (HI)</option>
                    <option value="mr">मराठी (MR)</option>
                  </Select>
                </Field>
                <label className="flex cursor-pointer items-start gap-3 sm:col-span-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-blue"
                    checked={general.dualOtpEnforced}
                    onChange={(e) => setGeneral((g) => ({ ...g, dualOtpEnforced: e.target.checked }))}
                  />
                  <span>
                    <span className="block text-body-md font-medium text-primary">Enforce dual verification on closure</span>
                    <span className="block text-body-sm text-slate-500">
                      Officers must obtain a passenger one-time code before a case can be marked resolved.
                    </span>
                  </span>
                </label>
              </div>
            </Card>
          </div>
        )}

        {tab === 'taxonomy' && (
          <Card>
            <CardHeader
              icon="category"
              title="Complaint categories & routing"
              subtitle="Read-only view of the taxonomy the triage engine routes on."
              action={<Pill tone="neutral">{taxonomy.length} classes</Pill>}
            />
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {taxonomy.map((c) => (
                <div key={c.key} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-brand-blue">
                      <Icon name={CATEGORY_ICONS[c.key] || c.icon} size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-body-md font-semibold text-primary">{c.label}</p>
                      <p className="font-mono text-label-sm text-slate-400">{c.key}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-body-sm text-slate-500">{c.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Pill tone="neutral">Routing: {c.defaultDepartment}</Pill>
                    <Pill tone={c.defaultTier === 'tier1' ? 'urgent' : c.defaultTier === 'tier2' ? 'pending' : 'resolved'}>
                      {c.defaultTier}
                    </Pill>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 p-5">
              <InlineAlert tone="info" icon="info">
                The taxonomy is defined in <code className="font-mono">server/src/config/constants.js</code> so that the
                API and the triage engine always agree on the valid category set.
              </InlineAlert>
            </div>
          </Card>
        )}

        {tab === 'audit' && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
              <CardHeader
                icon="history_edu"
                title="Security & user action audit logs"
                subtitle={`${logPagination.total} recorded action(s)`}
                className="border-0 px-0 py-0"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Select className="w-40" value={severity} onChange={(e) => { setSeverity(e.target.value); setLogPage(1); }}>
                  <option value="">All severities</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </Select>
                <Input className="w-40" placeholder="Entity (e.g. Grievance)" value={entity} onChange={(e) => { setEntity(e.target.value); setLogPage(1); }} />
                <button type="button" className="btn-secondary btn-sm" onClick={loadLogs}>
                  <Icon name="refresh" size={16} /> Refresh
                </button>
              </div>
            </div>

            {auditLoading ? (
              <LoadingBlock label="Loading audit entries…" />
            ) : logs.length === 0 ? (
              <p className="px-5 py-10 text-center text-body-sm text-slate-400">No audit entries match the filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="table-th">When</th>
                      <th className="table-th">Actor</th>
                      <th className="table-th">Action</th>
                      <th className="table-th">Entity</th>
                      <th className="table-th">Description</th>
                      <th className="table-th">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log._id} className="border-b border-slate-100 align-top">
                        <td className="table-td whitespace-nowrap">
                          <span className="text-slate-700">{relativeTime(log.createdAt)}</span>
                          <span className="mt-0.5 block text-label-sm text-slate-400">{formatDateTime(log.createdAt)}</span>
                        </td>
                        <td className="table-td">
                          <span className="text-slate-700">{log.actorName}</span>
                          <span className="mt-0.5 block text-label-sm capitalize text-slate-400">{log.actorRole}</span>
                        </td>
                        <td className="table-td font-mono text-label-sm text-slate-600">{log.action}</td>
                        <td className="table-td text-slate-600">{log.entity}</td>
                        <td className="table-td max-w-md text-slate-500">{log.description}</td>
                        <td className="table-td">
                          <Pill tone={SEVERITY_TONE[log.severity] || 'neutral'}>{log.severity}</Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Pagination {...logPagination} onChange={setLogPage} />
          </Card>
        )}
      </div>
    </>
  );
}
