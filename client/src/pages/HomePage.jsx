import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PublicShell } from '../components/PublicLayout.jsx';
import { Card, EmptyState, Icon, InlineAlert, Pill, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { CATEGORY_ICONS, CATEGORY_LABELS, formatDateTime } from '../lib/format.js';

const CATEGORY_BLURBS = {
  delay: 'Late running, missed connections and schedule deviation.',
  overcrowding: 'Excess passengers, unauthorised boarding and congestion.',
  staff_behavior: 'Misconduct, unresponsiveness or unprofessional conduct.',
  lost_property: 'Misplaced belongings and retrieval requests.',
  ticketing_refund: 'Booking, cancellation, refund and fare disputes.',
  cleanliness: 'Coach hygiene, bio-toilets, waste and pest control.',
  safety: 'Security threats, unsafe conditions and theft.',
  accessibility: 'Wheelchair access, ramps, signage and assisted travel.',
  electrical_hvac: 'AC, lighting, sockets, inverters and power systems.',
  mechanical: 'Doors, brakes, suspension and undergear faults.',
  medical: 'Onboard medical emergencies and health hazards.',
  other: 'Anything not covered by another category.',
};

export default function HomePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [engine, setEngine] = useState(null);
  const [reference, setReference] = useState('');
  const [tracking, setTracking] = useState(null);
  const [trackError, setTrackError] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setStats(data.stats);
          setEngine(data.engine);
        }
      })
      .catch(() => {});
  }, []);

  const onTrack = async (e) => {
    e.preventDefault();
    const id = reference.trim();
    if (!id) return;
    setSearching(true);
    setTrackError('');
    setTracking(null);
    try {
      const res = await api.trackGrievance(id);
      setTracking(res.tracking);
    } catch (err) {
      setTrackError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const isFallback = engine?.engine === 'rule-based-fallback';

  return (
    <PublicShell>
      {/* ---------------------------------- Hero --------------------------------- */}
      <section className="relative w-full overflow-hidden bg-primary text-white">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-blue blur-3xl" />
          <div className="absolute -right-32 top-1/2 h-[32rem] w-[32rem] rounded-full bg-brand-teal opacity-40 blur-3xl" />
        </div>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />

        <div className="relative mx-auto grid w-full max-w-7xl gap-gutter px-gutter py-14 lg:grid-cols-12 lg:items-center lg:py-24">
          <div className="flex flex-col gap-5 lg:col-span-7">
            <div className="inline-flex w-fit flex-wrap items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-blue opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-blue" />
              </span>
              <span className="text-label-sm uppercase tracking-wider">
                {isFallback ? 'Rule-based triage engine active' : 'AI triage engine online'}
              </span>
              <span className="text-label-sm text-white/60">•</span>
              <span className="text-label-sm text-white/70">
                {stats ? `${stats.departments} operational wings` : 'Connecting…'}
              </span>
            </div>

            <div>
              <span className="text-label-md uppercase tracking-widest text-brand-blue">AI-Powered Civic Redressal</span>
              <h1 className="mt-2 font-display text-display-lg-mobile leading-tight tracking-tight text-white md:text-display-lg">
                Your Voice.
                <br />
                <span className="text-brand-blue">Better Journeys.</span>
              </h1>
            </div>

            <p className="max-w-xl text-body-lg text-slate-300">
              Lodge a passenger grievance and it is automatically categorised, risk-scored and routed to the
              responsible operational wing — with a tracked SLA and verified closure.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-accent" onClick={() => navigate('/register')}>
                Register a Complaint
                <Icon name="arrow_forward" size={18} />
              </button>
              <a href="#track" className="btn inline-flex bg-white/10 text-white hover:bg-white/20">
                <Icon name="travel_explore" size={18} />
                Track Existing Grievance
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-label-sm text-slate-400">
              <span className="flex items-center gap-1.5">
                <Icon name="check_circle" size={16} className="text-brand-blue" /> Complaint tracking available
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="verified_user" size={16} className="text-brand-blue" /> JWT + bcrypt authentication
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="timer" size={16} className="text-brand-blue" /> Configurable SLA tracking
              </span>
            </div>
          </div>

          {/* -------------------------------- Tracker ------------------------------- */}
          <div className="w-full lg:col-span-5" id="track">
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                <div className="flex items-center gap-2">
                  <Icon name="radar" size={22} className="text-brand-blue" />
                  <span className="font-display text-headline-sm text-primary">Live Grievance Tracker</span>
                </div>
                <Pill tone="ai">Public lookup</Pill>
              </div>
              <p className="pb-3 text-body-sm text-slate-500">
                Enter the reference ID issued when the grievance was lodged (for example{' '}
                <span className="font-mono text-slate-600">GAI-2026-4F9C21</span>).
              </p>

              <form onSubmit={onTrack} className="flex flex-col gap-3">
                <div>
                  <label className="label" htmlFor="tracking-input">
                    Grievance reference ID
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Icon name="search" size={18} />
                    </span>
                    <input
                      id="tracking-input"
                      className="input pl-10 font-mono"
                      placeholder="GAI-2026-XXXXXX"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full" disabled={searching || !reference.trim()}>
                  {searching ? <Spinner size={16} className="border-white/40 border-t-white" /> : <Icon name="chevron_forward" size={18} />}
                  Track Status in Real-Time
                </button>
              </form>

              <div className="mt-4">
                {trackError && <InlineAlert tone="error">{trackError}</InlineAlert>}

                {tracking && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-body-sm font-semibold text-primary">
                        {tracking.referenceId}
                      </span>
                      <Pill tone={tracking.slaBreached ? 'urgent' : 'ai'}>{tracking.statusLabel}</Pill>
                      {tracking.escalationLevel > 0 && <Pill tone="urgent">Escalation L{tracking.escalationLevel}</Pill>}
                    </div>
                    <p className="mt-2 text-body-md font-medium text-primary">{tracking.subject}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-body-sm">
                      <div>
                        <dt className="text-label-sm uppercase text-slate-400">Category</dt>
                        <dd className="text-slate-700">{tracking.categoryLabel}</dd>
                      </div>
                      <div>
                        <dt className="text-label-sm uppercase text-slate-400">Handling wing</dt>
                        <dd className="text-slate-700">{tracking.department}</dd>
                      </div>
                      <div>
                        <dt className="text-label-sm uppercase text-slate-400">SLA</dt>
                        <dd className={tracking.slaBreached ? 'text-red-600' : 'text-slate-700'}>
                          {tracking.slaRemainingLabel}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-label-sm uppercase text-slate-400">Logged</dt>
                        <dd className="text-slate-700">{formatDateTime(tracking.createdAt)}</dd>
                      </div>
                    </dl>
                    {tracking.steps?.length > 0 && (
                      <ol className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                        {tracking.steps.slice(-3).map((step, i) => (
                          <li key={i} className="flex gap-2 text-body-sm">
                            <Icon name="check_circle" size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                            <div>
                              <p className="font-medium text-slate-700">{step.title}</p>
                              <p className="text-slate-500">{step.description}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}

                {!tracking && !trackError && (
                  <p className="text-label-sm text-slate-400">
                    Only non-personal case status is shown publicly. Sign in to see the full thread.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* --------------------------------- Metrics -------------------------------- */}
      <section className="mx-auto w-full max-w-7xl px-gutter py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: 'verified',
              label: 'SLA compliance',
              value: stats ? `${stats.slaCompliance}%` : '—',
              hint: 'Across every recorded grievance',
            },
            {
              icon: 'bolt',
              label: 'Avg. resolution time',
              value: stats && stats.avgResolutionMinutes ? `${stats.avgResolutionMinutes}m` : '—',
              hint: 'From intake to verified closure',
            },
            {
              icon: 'task_alt',
              label: 'Grievances closed',
              value: stats ? stats.resolved : '—',
              hint: stats ? `${stats.totalGrievances} lodged in total` : 'Loading',
            },
            {
              icon: 'star',
              label: 'Passenger rating',
              value: stats && stats.avgRating ? `${stats.avgRating} / 5` : '—',
              hint: stats ? `${stats.feedbackCount} verified feedbacks` : 'Loading',
            },
          ].map((item) => (
            <Card key={item.label} className="p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-brand-blue">
                <Icon name={item.icon} size={20} filled />
              </span>
              <p className="mt-3 text-label-md uppercase tracking-wider text-slate-500">{item.label}</p>
              <p className="mt-1 font-display text-[26px] font-bold leading-none text-primary">{item.value}</p>
              <p className="mt-1.5 text-body-sm text-slate-500">{item.hint}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* -------------------------------- Categories ------------------------------ */}
      <section id="categories" className="mx-auto w-full max-w-7xl px-gutter pb-12">
        <div className="mb-5">
          <h2 className="font-display text-headline-lg text-primary">Grievance categories supported</h2>
          <p className="mt-1 text-body-md text-slate-500">
            Every category carries its own routing rule, severity model and statutory SLA window.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.keys(CATEGORY_LABELS).map((key) => (
            <Card key={key} className="flex gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-brand-blue">
                <Icon name={CATEGORY_ICONS[key]} size={20} />
              </span>
              <div className="min-w-0">
                <h3 className="text-headline-sm text-primary">{CATEGORY_LABELS[key]}</h3>
                <p className="mt-0.5 text-body-sm text-slate-500">{CATEGORY_BLURBS[key]}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* -------------------------------- Insights -------------------------------- */}
      <section id="insights" className="mx-auto w-full max-w-7xl px-gutter pb-12">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-headline-md text-primary">Most reported issues</h2>
              <Pill tone={isFallback ? 'pending' : 'ai'}>
                {isFallback ? 'Rule-based triage' : 'AI triage'}
              </Pill>
            </div>
            <p className="mt-1 text-body-sm text-slate-500">Last 90 days, derived from stored grievance records.</p>
            <div className="mt-4 space-y-3">
              {!stats && <EmptyState icon="hourglass" title="Loading insights…" />}
              {stats && stats.topCategories?.length === 0 && (
                <EmptyState
                  icon="insights"
                  title="No grievances recorded yet"
                  description="Insights populate automatically as grievances are lodged."
                />
              )}
              {stats?.topCategories?.map((c) => (
                <div key={c.category} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <Icon name={CATEGORY_ICONS[c.category] || 'label'} size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-body-md text-slate-700">{c.label}</span>
                      <span className="text-body-sm font-semibold text-primary">{c.count}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-blue"
                        style={{ width: `${(c.count / stats.topCategories[0].count) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-headline-md text-primary">How triage works</h2>
            <ol className="mt-4 space-y-4">
              {[
                ['edit_note', 'You describe the issue', 'Subject, description, journey context and optional evidence.'],
                ['psychology', 'Automatic triage', 'Category, severity, priority, department and SLA window are derived.'],
                ['alt_route', 'Routed to a wing', 'The responsible department and duty officer are notified.'],
                ['verified', 'Verified closure', 'Resolution is recorded and the passenger confirms with a code.'],
              ].map(([icon, title, body], i) => (
                <li key={title} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-brand-blue">
                    <Icon name={icon} size={18} />
                  </span>
                  <div>
                    <p className="text-body-md font-semibold text-primary">
                      {i + 1}. {title}
                    </p>
                    <p className="text-body-sm text-slate-500">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <InlineAlert tone={isFallback ? 'warning' : 'info'} className="mt-4">
              {isFallback
                ? 'No AI provider is configured on this deployment. Triage currently runs on the deterministic rule-based engine and is labelled as such throughout the portal.'
                : `Live AI triage is active via ${engine?.provider} (${engine?.model}).`}
            </InlineAlert>
          </Card>
        </div>
      </section>

      {/* ---------------------------------- CTA ---------------------------------- */}
      <section className="mx-auto w-full max-w-7xl px-gutter pb-4">
        <Card className="flex flex-col items-start justify-between gap-4 bg-primary-container p-6 text-white sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-headline-md text-white">Ready to lodge a grievance?</h2>
            <p className="mt-1 text-body-md text-slate-300">
              Create a passenger account to lodge, track and rate your grievances.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/register" className="btn-accent">
              <Icon name="person_add" size={18} /> Create account
            </Link>
            <Link to="/login" className="btn inline-flex bg-white/10 text-white hover:bg-white/20">
              <Icon name="badge" size={18} /> Officer / Admin sign in
            </Link>
          </div>
        </Card>
      </section>
    </PublicShell>
  );
}
