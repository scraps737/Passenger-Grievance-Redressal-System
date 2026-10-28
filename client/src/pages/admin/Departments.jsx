import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/AppShell.jsx';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  Input,
  LoadingBlock,
  Meter,
  Modal,
  Pill,
  Select,
  Spinner,
  StatCard,
  Textarea,
  useToast,
} from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { CATEGORY_LABELS, CATEGORY_OPTIONS } from '../../lib/format.js';

const EMPTY_FORM = {
  name: '',
  code: '',
  description: '',
  icon: 'corporate_fare',
  categories: [],
  escalationUnit: '',
  zone: 'Western Railway',
  division: '',
  head: '',
  capacity: 100,
  sla1: 6,
  sla2: 24,
  sla3: 72,
};

export default function Departments() {
  const toast = useToast();
  const [departments, setDepartments] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .listDepartments()
      .then((res) => setDepartments(res.departments))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    api
      .listOfficers()
      .then((res) => setOfficers(res.officers))
      .catch(() => setOfficers([]));
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (dept) => {
    setEditing(dept);
    setForm({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
      icon: dept.icon || 'corporate_fare',
      categories: dept.categories || [],
      escalationUnit: dept.escalationUnit || '',
      zone: dept.zone || 'Western Railway',
      division: dept.division || '',
      head: dept.head?._id || '',
      capacity: dept.capacity || 100,
      sla1: dept.slaHours?.tier1 ?? 6,
      sla2: dept.slaHours?.tier2 ?? 24,
      sla3: dept.slaHours?.tier3 ?? 72,
    });
    setModalOpen(true);
  };

  const save = async () => {
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      description: form.description,
      icon: form.icon,
      categories: form.categories,
      escalationUnit: form.escalationUnit,
      zone: form.zone,
      division: form.division,
      head: form.head || null,
      capacity: Number(form.capacity),
      slaHours: { tier1: Number(form.sla1), tier2: Number(form.sla2), tier3: Number(form.sla3) },
    };
    try {
      if (editing) {
        await api.updateDepartment(editing._id, payload);
        toast.success(`${payload.code} updated`);
      } else {
        await api.createDepartment(payload);
        toast.success(`${payload.code} commissioned`);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (dept) => {
    try {
      await api.deleteDepartment(dept._id);
      toast.success(`${dept.code} deactivated`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const visible = departments.filter(
    (d) =>
      !filter ||
      d.name.toLowerCase().includes(filter.toLowerCase()) ||
      d.code.toLowerCase().includes(filter.toLowerCase())
  );

  const totals = {
    active: departments.filter((d) => d.active).length,
    personnel: departments.reduce((s, d) => s + (d.metrics?.personnel || 0), 0),
    activeCases: departments.reduce((s, d) => s + (d.metrics?.activeCases || 0), 0),
    breached: departments.reduce((s, d) => s + (d.metrics?.breached || 0), 0),
  };

  if (error) {
    return (
      <>
        <PageHeader icon="corporate_fare" breadcrumb={['Administration']} title="Departments" />
        <div className="mx-auto max-w-[1720px] px-gutter py-6">
          <Card><ErrorState message={error} onRetry={load} /></Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon="corporate_fare"
        breadcrumb={['Transit Command', 'Administrative Governance', 'Department & Operational Wings']}
        title="Department & operational wing management"
        description="Each wing owns a set of categories and its own SLA windows. Load figures are derived from live cases."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={load}>
              <Icon name="refresh" size={16} /> Refresh
            </button>
            <button type="button" className="btn-accent btn-sm" onClick={openCreate}>
              <Icon name="add" size={16} /> Commission new wing
            </button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-[1720px] space-y-5 px-gutter py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active wings" value={totals.active} icon="corporate_fare" hint={`${departments.length} configured in total`} tone="ai" />
          <StatCard label="Assigned field staff" value={totals.personnel} icon="groups" hint="Active officer accounts" />
          <StatCard label="Live open workload" value={totals.activeCases} icon="pending_actions" hint="Across all wings" tone="pending" />
          <StatCard label="SLA breaches" value={totals.breached} icon="timer_off" hint="Historical breaches recorded" tone={totals.breached ? 'urgent' : 'resolved'} />
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
            <h2 className="font-display text-headline-sm text-primary">Operational wings</h2>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Icon name="search" size={16} />
              </span>
              <Input className="w-60 pl-9" placeholder="Search by name or code" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <LoadingBlock label="Loading departments…" />
          ) : visible.length === 0 ? (
            <EmptyState icon="corporate_fare" title="No departments" description="Commission the first operational wing." action={
              <button type="button" className="btn-accent btn-sm" onClick={openCreate}>
                <Icon name="add" size={16} /> Commission new wing
              </button>
            } />
          ) : (
            <div className="grid gap-4 p-5 lg:grid-cols-2">
              {visible.map((dept) => (
                <div key={dept._id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-brand-blue">
                        <Icon name={dept.icon || 'corporate_fare'} size={22} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-headline-sm text-primary">{dept.name}</h3>
                          <span className="font-mono text-label-sm text-slate-500">{dept.code}</span>
                          {!dept.active && <Pill tone="urgent">Inactive</Pill>}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-body-sm text-slate-500">{dept.description || 'No description'}</p>
                        <p className="mt-1 text-label-sm text-slate-400">
                          {dept.zone}
                          {dept.division ? ` · ${dept.division} Division` : ''}
                          {dept.escalationUnit ? ` · Escalation: ${dept.escalationUnit}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => openEdit(dept)}>
                        <Icon name="edit" size={14} /> Edit
                      </button>
                      {dept.active && (
                        <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => deactivate(dept)}>
                          <Icon name="block" size={14} /> Deactivate
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-4">
                    {[
                      ['Personnel', dept.metrics?.personnel ?? 0],
                      ['Open cases', dept.metrics?.activeCases ?? 0],
                      ['Total cases', dept.metrics?.totalCases ?? 0],
                      ['Breached', dept.metrics?.breached ?? 0],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-label-sm uppercase tracking-wider text-slate-400">{label}</p>
                        <p className="font-display text-headline-sm text-primary">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-label-sm text-slate-500">
                      <span>Capacity utilisation</span>
                      <span>{dept.metrics?.load ?? 0}%</span>
                    </div>
                    <div className="mt-1">
                      <Meter value={dept.metrics?.load ?? 0} tone={(dept.metrics?.load ?? 0) > 85 ? '#EF4444' : '#0EA5E9'} />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                    <span className="text-label-sm text-slate-400">SLA:</span>
                    <Pill tone="urgent">T1 {dept.slaHours?.tier1}h</Pill>
                    <Pill tone="pending">T2 {dept.slaHours?.tier2}h</Pill>
                    <Pill tone="resolved">T3 {dept.slaHours?.tier3}h</Pill>
                    {(dept.categories || []).map((c) => (
                      <Pill key={c} tone="neutral">{CATEGORY_LABELS[c] || c}</Pill>
                    ))}
                  </div>

                  {dept.head && (
                    <p className="mt-3 text-label-sm text-slate-500">
                      <Icon name="badge" size={13} /> Head: {dept.head.name} · {dept.head.designation || 'Officer'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader icon="info" title="Routing logic" subtitle="How a category maps to a wing" />
          <div className="p-5">
            <p className="text-body-sm text-slate-500">
              When a grievance is triaged, the recommended department code is matched against a wing's{' '}
              <code>code</code>. If no wing matches, the engine falls back to the first wing that lists the recategorised
              category, and finally to the operations wing. Department-level SLA hours always take precedence over the
              global SLA rules configured in system settings.
            </p>
          </div>
        </Card>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.code}` : 'Commission new wing'}
        subtitle="Wings own categories and define their own SLA windows."
        width="max-w-2xl"
        footer={
          <>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="button" className="btn-accent btn-sm" onClick={save} disabled={busy || !form.name || !form.code}>
              {busy && <Spinner size={15} className="border-white/40 border-t-white" />} {editing ? 'Save changes' : 'Commission wing'}
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Wing name" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Electrical & HVAC Systems" />
          </Field>
          <Field label="Short code" required hint="Used by the triage engine for routing.">
            <Input className="font-mono uppercase" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="ELEC" maxLength={24} />
          </Field>
          <Field label="Material icon" hint="Material Symbols name.">
            <Input className="font-mono" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} placeholder="ac_unit" />
          </Field>
          <Field label="Escalation unit">
            <Input value={form.escalationUnit} onChange={(e) => setForm((f) => ({ ...f, escalationUnit: e.target.value }))} placeholder="SSE (Coaching)" />
          </Field>
          <Field label="Wing head" hint="The officer accountable for this wing.">
            <Select value={form.head} onChange={(e) => setForm((f) => ({ ...f, head: e.target.value }))}>
              <option value="">Not assigned</option>
              {officers.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.name} — {o.designation || o.role}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Zone">
            <Input value={form.zone} onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))} />
          </Field>
          <Field label="Division">
            <Input value={form.division} onChange={(e) => setForm((f) => ({ ...f, division: e.target.value }))} placeholder="Ratlam" />
          </Field>
          <Field label="Case capacity" hint="Used to compute utilisation.">
            <Input type="number" min="0" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
          </Field>
          <Field label="SLA tier 1 (hours)">
            <Input type="number" min="1" value={form.sla1} onChange={(e) => setForm((f) => ({ ...f, sla1: e.target.value }))} />
          </Field>
          <Field label="SLA tier 2 (hours)">
            <Input type="number" min="1" value={form.sla2} onChange={(e) => setForm((f) => ({ ...f, sla2: e.target.value }))} />
          </Field>
          <Field label="SLA tier 3 (hours)">
            <Input type="number" min="1" value={form.sla3} onChange={(e) => setForm((f) => ({ ...f, sla3: e.target.value }))} />
          </Field>
        </div>

        <Field label="Categories handled" className="mt-4">
          <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
            {CATEGORY_OPTIONS.map((c) => (
              <label key={c.value} className="flex items-center gap-2 text-body-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand-blue"
                  checked={form.categories.includes(c.value)}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      categories: e.target.checked
                        ? [...f.categories, c.value]
                        : f.categories.filter((x) => x !== c.value),
                    }))
                  }
                />
                {c.label}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Description" className="mt-4">
          <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </Field>
      </Modal>
    </>
  );
}
