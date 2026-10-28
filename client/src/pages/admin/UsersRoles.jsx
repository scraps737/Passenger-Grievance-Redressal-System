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
  Modal,
  Pagination,
  Pill,
  Select,
  Spinner,
  StatCard,
  TabStrip,
  useToast,
} from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';

const ROLE_TABS = [
  { value: 'all', label: 'All users' },
  { value: 'officer', label: 'Officers & squad leads' },
  { value: 'admin', label: 'Administrators' },
  { value: 'passenger', label: 'Passengers' },
];

const ROLE_TONE = { admin: 'urgent', officer: 'ai', passenger: 'neutral' };
const STATUS_TONE = { active: 'resolved', pending: 'pending', suspended: 'urgent' };

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'officer',
  phone: '',
  employeeId: '',
  designation: '',
  department: '',
  zone: 'Western Railway',
  division: '',
};

const PERMISSIONS = {
  passenger: [
    'Submit and track own grievances',
    'Upload evidence on own cases',
    'Reply to clarification requests',
    'Rate resolutions on own cases',
  ],
  officer: [
    'View cases assigned or belonging to own wing',
    'Assign / reassign cases within scope',
    'Update status, escalate and resolve',
    'Override AI triage recommendations',
  ],
  admin: [
    'Full access to every grievance',
    'Manage users, roles and departments',
    'Configure SLA rules and settings',
    'Read the security audit ledger',
  ],
};

export default function UsersRoles() {
  const toast = useToast();
  const [role, setRole] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [roleCounts, setRoleCounts] = useState({});
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [permsOpen, setPermsOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = { page, limit: 20 };
    if (role !== 'all') params.role = role;
    if (search.trim()) params.search = search.trim();
    api
      .listUsers(params)
      .then((res) => {
        setItems(res.items);
        setRoleCounts(res.roleCounts || {});
        setPagination(res.pagination);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, role, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .listDepartments({ active: 'true' })
      .then((res) => setDepartments(res.departments))
      .catch(() => setDepartments([]));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({
      ...EMPTY_FORM,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || '',
      employeeId: user.employeeId || '',
      designation: user.designation || '',
      department: user.department?._id || '',
      zone: user.zone || '',
      division: user.division || '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      if (editing) {
        await api.updateUser(editing._id, {
          name: form.name,
          role: form.role,
          phone: form.phone,
          employeeId: form.employeeId,
          designation: form.designation,
          department: form.department || null,
          zone: form.zone,
          division: form.division,
        });
        toast.success(`${form.name} updated`);
      } else {
        await api.createUser({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          phone: form.phone,
          employeeId: form.employeeId,
          designation: form.designation,
          department: form.department || null,
          zone: form.zone,
          division: form.division,
        });
        toast.success(`${form.role} account created`);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (user) => {
    const next = user.status === 'active' ? 'suspended' : 'active';
    try {
      await api.updateUser(user._id, { status: next });
      toast.success(`${user.name} is now ${next}`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (user) => {
    try {
      await api.deleteUser(user._id);
      toast.success(`${user.name} removed`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const total = Object.values(roleCounts).reduce((s, n) => s + n, 0);

  return (
    <>
      <PageHeader
        icon="group"
        breadcrumb={['Transit Command', 'Administrative Governance', 'User & Access Control']}
        title="User & role management"
        description="Identity directory and role-based access control. Role changes are enforced server-side and audited."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={() => setPermsOpen(true)}>
              <Icon name="tune" size={16} /> Role permissions
            </button>
            <button type="button" className="btn-accent btn-sm" onClick={openCreate}>
              <Icon name="person_add" size={16} /> Invite officer / admin
            </button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-[1720px] space-y-5 px-gutter py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Registered directory" value={total} icon="groups" hint="All accounts" tone="ai" />
          <StatCard label="Passengers" value={roleCounts.passenger || 0} icon="person" hint="Self-service accounts" />
          <StatCard label="Officers" value={roleCounts.officer || 0} icon="badge" hint="Operational staff" tone="pending" />
          <StatCard label="Administrators" value={roleCounts.admin || 0} icon="shield_person" hint="Full-access accounts" tone="urgent" />
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
            <TabStrip
              tabs={ROLE_TABS.map((t) => ({
                ...t,
                count: t.value === 'all' ? total : roleCounts[t.value] || 0,
              }))}
              value={role}
              onChange={(v) => { setRole(v); setPage(1); }}
            />
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Icon name="search" size={16} />
              </span>
              <Input
                className="w-64 pl-9"
                placeholder="Search name, email or staff ID"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          {error ? (
            <ErrorState message={error} onRetry={load} />
          ) : loading ? (
            <LoadingBlock label="Loading directory…" />
          ) : items.length === 0 ? (
            <EmptyState icon="person_search" title="No accounts found" description="Adjust the filters or invite a new user." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="table-th">Name</th>
                    <th className="table-th">Role</th>
                    <th className="table-th">Department / wing</th>
                    <th className="table-th">Staff ID</th>
                    <th className="table-th">Status</th>
                    <th className="table-th">Created</th>
                    <th className="table-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr key={u._id} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="table-td">
                        <p className="font-medium text-primary">{u.name}</p>
                        <p className="text-label-sm text-slate-500">{u.email}</p>
                      </td>
                      <td className="table-td">
                        <Pill tone={ROLE_TONE[u.role]}>{u.role}</Pill>
                      </td>
                      <td className="table-td text-slate-600">{u.department?.name || '—'}</td>
                      <td className="table-td font-mono text-label-sm text-slate-500">{u.employeeId || '—'}</td>
                      <td className="table-td">
                        <Pill tone={STATUS_TONE[u.status]}>{u.status}</Pill>
                      </td>
                      <td className="table-td text-label-sm text-slate-500">{formatDate(u.createdAt)}</td>
                      <td className="table-td">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button type="button" className="btn-secondary btn-sm" onClick={() => openEdit(u)}>
                            <Icon name="edit" size={14} /> Edit
                          </button>
                          <button
                            type="button"
                            className={u.status === 'active' ? 'btn-ghost btn-sm text-amber-600' : 'btn-ghost btn-sm text-emerald-600'}
                            onClick={() => toggleStatus(u)}
                          >
                            <Icon name={u.status === 'active' ? 'block' : 'check_circle'} size={14} />
                            {u.status === 'active' ? 'Suspend' : 'Activate'}
                          </button>
                          <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => remove(u)}>
                            <Icon name="delete" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination {...pagination} onChange={setPage} />
        </Card>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Invite officer / administrator'}
        subtitle={editing ? 'Changes to role take effect immediately and are audited.' : 'Staff accounts cannot self-register; create them here.'}
        width="max-w-2xl"
        footer={
          <>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setModalOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn-accent btn-sm"
              onClick={save}
              disabled={busy || !form.name || (!editing && (!form.email || form.password.length < 8))}
            >
              {busy && <Spinner size={15} className="border-white/40 border-t-white" />} {editing ? 'Save changes' : 'Create account'}
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} disabled={Boolean(editing)} className={editing ? 'bg-slate-50' : ''} />
          </Field>
          {!editing && (
            <Field label="Temporary password" required hint="At least 8 characters.">
              <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </Field>
          )}
          <Field label="Role" required>
            <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="officer">Officer</option>
              <option value="admin">Administrator</option>
              {editing && <option value="passenger">Passenger</option>}
            </Select>
          </Field>
          <Field label="Department / wing">
            <Select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>
              <option value="">Unassigned</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
              ))}
            </Select>
          </Field>
          <Field label="Staff ID">
            <Input className="font-mono" value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} placeholder="HH-4091" />
          </Field>
          <Field label="Designation">
            <Input value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} placeholder="SSE Electrical" />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Zone">
            <Input value={form.zone} onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))} />
          </Field>
          <Field label="Division">
            <Input value={form.division} onChange={(e) => setForm((f) => ({ ...f, division: e.target.value }))} />
          </Field>
        </div>
        {editing && (
          <p className="mt-4 text-label-sm text-slate-400">
            Email addresses cannot be changed after creation. Suspend and recreate the account if the address is wrong.
          </p>
        )}
      </Modal>

      <Modal
        open={permsOpen}
        onClose={() => setPermsOpen(false)}
        title="Role permissions matrix"
        subtitle="Enforced by the API on every request — the interface merely reflects it."
        width="max-w-3xl"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {Object.entries(PERMISSIONS).map(([roleKey, list]) => (
            <div key={roleKey} className="rounded-lg border border-slate-200 p-4">
              <Pill tone={ROLE_TONE[roleKey]}>{roleKey}</Pill>
              <ul className="mt-3 space-y-2">
                {list.map((p) => (
                  <li key={p} className="flex gap-2 text-body-sm text-slate-600">
                    <Icon name="check" size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <CardHeader
          icon="security"
          title="Guarantees"
          className="mt-4 rounded-lg border border-slate-200"
        />
        <ul className="space-y-2 px-1 pt-2">
          {[
            'A passenger can only ever read their own grievance records — verified by an automated test.',
            'An officer can only act on cases assigned to them or owned by their wing.',
            'Self-registration always creates a passenger account; a supplied role is ignored.',
            'Every privileged action writes an entry to the audit ledger.',
          ].map((g) => (
            <li key={g} className="flex gap-2 text-body-sm text-slate-600">
              <Icon name="verified_user" size={15} className="mt-0.5 shrink-0 text-brand-blue" />
              {g}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
