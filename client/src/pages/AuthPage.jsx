import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PublicShell } from '../components/PublicLayout.jsx';
import { InlineAlert, Icon, Input, Field, Spinner } from '../components/ui.jsx';
import { useAuth, HOME_FOR_ROLE } from '../context/AuthContext.jsx';

const DEMO_ACCOUNTS = [
  { role: 'Passenger', email: 'priya.sharma@example.com', password: 'Passenger@123', icon: 'person' },
  { role: 'Officer', email: 'r.murthy@grievanceai.gov', password: 'Officer@12345', icon: 'badge' },
  { role: 'Admin', email: 'admin@grievanceai.gov', password: 'Admin@12345', icon: 'shield_person' },
];

export default function AuthPage({ mode = 'login' }) {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [profile, setProfile] = useState('citizen');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', pnr: '' });
  const [error, setError] = useState('');
  const [details, setDetails] = useState([]);
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const fillDemoAccount = (account) => {
    setForm((prev) => ({ ...prev, email: account.email, password: account.password }));
    setProfile(account.role === 'Officer' || account.role === 'Admin' ? 'official' : 'citizen');
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setDetails([]);
    try {
      const user = isLogin
        ? await login(form.email.trim(), form.password)
        : await register({
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            phone: form.phone.trim(),
            pnr: form.pnr.trim(),
          });
      const redirect = location.state?.from;
      navigate(redirect || HOME_FOR_ROLE[user.role] || '/', { replace: true });
    } catch (err) {
      setError(err.message);
      if (err.details) setDetails(err.details);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicShell>
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-gutter py-10 lg:grid-cols-2 lg:py-14">
        {/* ------------------------------ Value panel ----------------------------- */}
        <section className="flex flex-col gap-5">
          <div>
            <span className="text-label-md uppercase tracking-widest text-brand-blue">Portal access</span>
            <h1 className="mt-2 font-display text-display-lg-mobile leading-tight text-primary md:text-display-lg">
              {isLogin ? 'Sign in to GrievanceAI' : 'Create your passenger account'}
            </h1>
            <p className="mt-2 max-w-lg text-body-lg text-slate-500">
              {isLogin
                ? 'Passengers, transit officers and administrators share one secure entry point. Your role determines the console you reach.'
                : 'Register to lodge grievances, upload evidence, follow the live SLA countdown and rate the resolution.'}
            </p>
          </div>

          <InlineAlert tone="warning" icon="gpp_maybe">
            GrievanceAI officials will never ask for your password or a one-time code over a call or message.
          </InlineAlert>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['train', 'Journey context', 'Attach train, coach, berth and PNR detail to every case.'],
              ['psychology', 'Automatic triage', 'Category, severity, priority and SLA are derived on submission.'],
              ['forum', 'Two-way thread', 'Officers can request clarification and you can reply in-app.'],
              ['verified', 'Verified closure', 'Resolution is confirmed with a one-time code before closure.'],
            ].map(([icon, title, body]) => (
              <div key={title} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-brand-blue">
                  <Icon name={icon} size={18} />
                </span>
                <div>
                  <p className="text-body-md font-semibold text-primary">{title}</p>
                  <p className="text-body-sm text-slate-500">{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-label-md uppercase tracking-wider text-slate-500">Demo accounts (seeded)</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  onClick={() => fillDemoAccount(account)}
                  className="flex flex-col items-start gap-1 rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-brand-blue"
                >
                  <span className="flex items-center gap-1.5 text-label-md text-primary">
                    <Icon name={account.icon} size={15} /> {account.role}
                  </span>
                  <span className="truncate text-label-sm text-slate-500">{account.email}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-label-sm text-slate-400">Click a card to fill the form.</p>
          </div>
        </section>

        {/* -------------------------------- Form card ----------------------------- */}
        <section>
          <div className="card p-6">
            {isLogin && (
              <div className="mb-5">
                <p className="label">Select access profile</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'citizen', label: 'Citizen / Passenger', icon: 'person' },
                    { id: 'official', label: 'Officer / Admin', icon: 'badge' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setProfile(option.id)}
                      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-body-sm transition-colors ${
                        profile === option.id
                          ? 'border-brand-blue bg-sky-50 font-semibold text-primary'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <Icon name={option.icon} size={18} />
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-label-sm text-slate-400">
                  This is a display preference only — your real role comes from your account.
                </p>
              </div>
            )}

            <h2 className="font-display text-headline-md text-primary">
              {isLogin ? 'Sign in to your account' : 'Passenger registration'}
            </h2>
            <p className="mt-1 text-body-sm text-slate-500">
              {isLogin ? 'Enter the credentials issued to your account.' : 'All new self-service accounts are passenger accounts.'}
            </p>

            {error && (
              <InlineAlert tone="error" className="mt-4">
                <span>{error}</span>
                {details?.length > 0 && (
                  <ul className="mt-1 list-disc pl-4">
                    {details.map((d) => (
                      <li key={`${d.path}-${d.message}`}>
                        {d.path}: {d.message}
                      </li>
                    ))}
                  </ul>
                )}
              </InlineAlert>
            )}

            <form className="mt-5 space-y-4" onSubmit={submit}>
              {!isLogin && (
                <Field label="Full legal name" required hint="Must match the government photo ID on record.">
                  <Input value={form.name} onChange={set('name')} placeholder="Priya Sharma" required autoComplete="name" />
                </Field>
              )}

              <Field label="Email address" required>
                <Input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </Field>

              <Field
                label="Password"
                required
                hint={isLogin ? undefined : 'At least 8 characters, including a letter and a number.'}
              >
                <Input
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  placeholder="••••••••"
                  required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
              </Field>

              {!isLogin && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Mobile number">
                    <Input value={form.phone} onChange={set('phone')} placeholder="98765 43210" autoComplete="tel" />
                  </Field>
                  <Field label="PNR (optional)" hint="Links your journeys automatically.">
                    <Input value={form.pnr} onChange={set('pnr')} placeholder="4829103810" className="font-mono" />
                  </Field>
                </div>
              )}

              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy && <Spinner size={16} className="border-white/40 border-t-white" />}
                {isLogin ? 'Sign in' : 'Create passenger account'}
              </button>
            </form>

            <p className="mt-5 text-center text-body-sm text-slate-500">
              {isLogin ? (
                <>
                  New passenger?{' '}
                  <Link to="/register" className="font-semibold text-brand-blue hover:underline">
                    Create an account
                  </Link>
                </>
              ) : (
                <>
                  Already registered?{' '}
                  <Link to="/login" className="font-semibold text-brand-blue hover:underline">
                    Sign in
                  </Link>
                </>
              )}
            </p>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
