import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/AppShell.jsx';
import {
  Avatar,
  Card,
  CardHeader,
  Field,
  Icon,
  Input,
  LoadingBlock,
  Pill,
  Spinner,
  TabStrip,
  useToast,
} from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { TRANSPORT_MODE_LABELS, formatDate } from '../../lib/format.js';

const TABS = [
  { value: 'personal', label: 'Personal & contact' },
  { value: 'transit', label: 'Transit preferences' },
  { value: 'notifications', label: 'Notification rules' },
  { value: 'security', label: 'Security' },
];

export default function ProfileSettings() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('personal');
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    alternateEmail: '',
    pnr: '',
    zone: '',
    division: '',
    emergencyName: '',
    emergencyPhone: '',
    emailAlerts: true,
    smsAlerts: true,
    pushAlerts: true,
    defaultTransportMode: 'rail',
  });

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || '',
      phone: user.phone || '',
      alternateEmail: user.alternateEmail || '',
      pnr: user.pnr || '',
      zone: user.zone || '',
      division: user.division || '',
      emergencyName: user.emergencyContact?.name || '',
      emergencyPhone: user.emergencyContact?.phone || '',
      emailAlerts: user.preferences?.emailAlerts ?? true,
      smsAlerts: user.preferences?.smsAlerts ?? true,
      pushAlerts: user.preferences?.pushAlerts ?? true,
      defaultTransportMode: user.preferences?.defaultTransportMode || 'rail',
    });
  }, [user]);

  const loadStats = useCallback(() => {
    api
      .passengerOverview()
      .then((res) => setStats(res.kpis))
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const toggle = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.checked }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.updateProfile({
        name: form.name,
        phone: form.phone,
        alternateEmail: form.alternateEmail,
        pnr: form.pnr,
        zone: form.zone,
        division: form.division,
        emergencyContact: { name: form.emergencyName, phone: form.emergencyPhone },
        preferences: {
          emailAlerts: form.emailAlerts,
          smsAlerts: form.smsAlerts,
          pushAlerts: form.pushAlerts,
          defaultTransportMode: form.defaultTransportMode,
        },
      });
      updateUser(res.user);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwBusy(true);
    try {
      await api.changePassword(pwForm);
      setPwForm({ currentPassword: '', newPassword: '' });
      toast.success('Password changed successfully');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-gutter py-8">
        <LoadingBlock />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        icon="manage_accounts"
        breadcrumb={['Home', 'Passenger Dashboard', 'Account']}
        title="Passenger profile & settings"
        description="Manage your contact details, transit preferences, notification rules and account security."
        actions={
          <button type="submit" form="profile-form" className="btn-primary btn-sm" disabled={busy}>
            {busy ? <Spinner size={15} className="border-white/40 border-t-white" /> : <Icon name="save" size={16} />}
            Save profile changes
          </button>
        }
      />

      <div className="mx-auto w-full max-w-[1200px] space-y-5 px-gutter py-6">
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={user.name} size={64} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-headline-md text-primary">{user.name}</h2>
                <Pill tone="resolved" icon="verified">{user.status}</Pill>
                {user.pnr && <Pill tone="neutral" icon="confirmation_number">PNR {user.pnr}</Pill>}
              </div>
              <p className="mt-0.5 text-body-sm text-slate-500">{user.email}</p>
              <p className="text-label-sm text-slate-400">
                Member since {formatDate(user.createdAt)} · trust score {user.trustScore}%
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                ['Grievances', stats?.total ?? '—'],
                ['Resolved', stats?.resolved ?? '—'],
                ['Avg. rating', stats?.avgRatingGiven ? `${stats.avgRatingGiven}/5` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="text-center">
                  <p className="text-label-sm uppercase tracking-wider text-slate-400">{label}</p>
                  <p className="font-display text-headline-md text-primary">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <TabStrip tabs={TABS} value={tab} onChange={setTab} />

        <form id="profile-form" onSubmit={save}>
          {tab === 'personal' && (
            <Card>
              <CardHeader icon="contact_mail" title="Personal & verified contact information" subtitle="Used for case communication and closure verification." />
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <Field label="Full legal name" required>
                  <Input value={form.name} onChange={set('name')} required />
                </Field>
                <Field label="Registered mobile">
                  <Input value={form.phone} onChange={set('phone')} placeholder="98765 43210" />
                </Field>
                <Field label="Primary email" hint="Your sign-in identity; contact an administrator to change it.">
                  <Input value={user.email} readOnly className="bg-slate-50" />
                </Field>
                <Field label="Alternate email">
                  <Input type="email" value={form.alternateEmail} onChange={set('alternateEmail')} placeholder="optional@example.com" />
                </Field>
                <Field label="Emergency contact name">
                  <Input value={form.emergencyName} onChange={set('emergencyName')} placeholder="Next of kin" />
                </Field>
                <Field label="Emergency contact number">
                  <Input value={form.emergencyPhone} onChange={set('emergencyPhone')} placeholder="98765 43211" />
                </Field>
                <Field label="Home zone">
                  <Input value={form.zone} onChange={set('zone')} placeholder="Western Railway" />
                </Field>
                <Field label="Home division">
                  <Input value={form.division} onChange={set('division')} placeholder="Mumbai Central" />
                </Field>
              </div>
            </Card>
          )}

          {tab === 'transit' && (
            <Card>
              <CardHeader icon="train" title="Transit & journey baseline" subtitle="Defaults applied when lodging a new grievance." />
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <Field label="Active PNR" hint="Pre-fills the PNR field on new grievances.">
                  <Input className="font-mono" value={form.pnr} onChange={set('pnr')} placeholder="4829103810" />
                </Field>
                <Field label="Preferred transport mode">
                  <select className="input" value={form.defaultTransportMode} onChange={set('defaultTransportMode')}>
                    {Object.entries(TRANSPORT_MODE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </Card>
          )}

          {tab === 'notifications' && (
            <Card>
              <CardHeader icon="notifications_active" title="Notification & dispatch rules" subtitle="Choose how you want to be alerted about case activity." />
              <div className="divide-y divide-slate-100">
                {[
                  ['emailAlerts', 'Email alerts', 'Case status changes and resolution summaries by email.'],
                  ['smsAlerts', 'SMS alerts', 'High-priority updates to your registered mobile number.'],
                  ['pushAlerts', 'In-app alerts', 'Notifications inside the GrievanceAI portal.'],
                ].map(([key, title, body]) => (
                  <label key={key} className="flex cursor-pointer items-start gap-3 px-5 py-4">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-blue"
                      checked={form[key]}
                      onChange={toggle(key)}
                    />
                    <span>
                      <span className="block text-body-md font-medium text-primary">{title}</span>
                      <span className="block text-body-sm text-slate-500">{body}</span>
                    </span>
                  </label>
                ))}
              </div>
            </Card>
          )}
        </form>

        {tab === 'security' && (
          <div className="space-y-5">
            <Card>
              <CardHeader icon="lock_reset" title="Change password" subtitle="Passwords are hashed with bcrypt before storage." />
              <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={changePassword}>
                <Field label="Current password" required>
                  <Input
                    type="password"
                    value={pwForm.currentPassword}
                    onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))}
                    required
                    autoComplete="current-password"
                  />
                </Field>
                <Field label="New password" required hint="At least 8 characters with a letter and a number.">
                  <Input
                    type="password"
                    value={pwForm.newPassword}
                    onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))}
                    required
                    autoComplete="new-password"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <button type="submit" className="btn-primary btn-sm" disabled={pwBusy}>
                    {pwBusy ? <Spinner size={15} className="border-white/40 border-t-white" /> : <Icon name="key" size={16} />}
                    Update password
                  </button>
                </div>
              </form>
            </Card>

            <Card>
              <CardHeader icon="shield" title="Session & access" />
              <dl className="divide-y divide-slate-100">
                {[
                  ['Account role', user.role],
                  ['Account status', user.status],
                  ['Last sign-in', user.lastLoginAt ? formatDate(user.lastLoginAt) : 'This session'],
                  ['Authentication', 'JWT bearer token (7 day expiry)'],
                  ['Password storage', 'bcrypt, cost factor 12'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-5 py-2.5">
                    <dt className="text-label-md text-slate-500">{label}</dt>
                    <dd className="text-body-sm capitalize text-slate-700">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
