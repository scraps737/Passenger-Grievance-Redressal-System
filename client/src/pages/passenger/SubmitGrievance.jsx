import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/AppShell.jsx';
import {
  Card,
  CardHeader,
  Field,
  Icon,
  InlineAlert,
  Input,
  Pill,
  Select,
  Spinner,
  Textarea,
  useToast,
} from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  PRIORITY_LABELS,
  TRANSPORT_MODE_LABELS,
} from '../../lib/format.js';

const STEPS = [
  { id: 1, label: 'Journey & incident' },
  { id: 2, label: 'Summary & narration' },
  { id: 3, label: 'Evidence & media' },
  { id: 4, label: 'Verify & submit' },
];

export default function SubmitGrievance() {
  const { user } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [details, setDetails] = useState([]);
  const [result, setResult] = useState(null);

  const [form, setForm] = useState({
    transportMode: user?.preferences?.defaultTransportMode || 'rail',
    trainNumber: '',
    trainName: '',
    coach: '',
    berth: '',
    pnr: user?.pnr || '',
    station: '',
    route: '',
    incidentLocation: '',
    incidentAt: new Date().toISOString().slice(0, 16),
    subject: '',
    description: '',
    categoryHint: '',
  });
  const [files, setFiles] = useState([]);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const canAdvance = useMemo(() => {
    if (step === 1) return true;
    if (step === 2) return form.subject.trim().length >= 5 && form.description.trim().length >= 20;
    return true;
  }, [step, form]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setDetails([]);
    try {
      const payload = {
        ...form,
        incidentAt: form.incidentAt ? new Date(form.incidentAt).toISOString() : undefined,
        categoryHint: form.categoryHint || undefined,
        runAiTriage: true,
      };
      Object.keys(payload).forEach((k) => payload[k] === '' && delete payload[k]);
      const res = await api.createGrievance(payload, files);
      setResult(res);
      setStep(5);
      toast.success(`Grievance ${res.grievance.referenceId} lodged`, 'Submitted for triage');
    } catch (err) {
      setError(err.message);
      if (err.details) setDetails(err.details);
    } finally {
      setBusy(false);
    }
  };

  const onFiles = (e) => {
    const picked = Array.from(e.target.files || []).slice(0, 5);
    setFiles(picked);
  };

  /* ------------------------------ Result screen ----------------------------- */
  if (step === 5 && result) {
    const { grievance, triage } = result;
    const isFallback = triage?.engine === 'rule-based-fallback';
    return (
      <>
        <PageHeader
          icon="check_circle"
          breadcrumb={['Home', 'Passenger Dashboard', 'Lodge Grievance']}
          title="Grievance lodged successfully"
          description={`Reference ${grievance.referenceId} has been recorded and routed.`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link to={`/passenger/grievances/${grievance._id}`} className="btn-secondary btn-sm">
                <Icon name="forum" size={16} /> Open case thread
              </Link>
              <Link to="/passenger" className="btn-primary btn-sm">
                <Icon name="dashboard" size={16} /> Back to dashboard
              </Link>
            </div>
          }
        />

        <div className="mx-auto w-full max-w-[1200px] space-y-5 px-gutter py-6">
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-label-md text-emerald-700">
                <Icon name="check_circle" size={14} /> Recorded
              </span>
              <span className="font-mono text-body-md font-semibold text-primary">{grievance.referenceId}</span>
              <Pill tone="ai">{grievance.statusLabel}</Pill>
              <Pill tone={grievance.priority === 'tier1' ? 'urgent' : 'pending'}>{PRIORITY_LABELS[grievance.priority]}</Pill>
            </div>
            <h2 className="mt-3 font-display text-headline-md text-primary">{grievance.subject}</h2>
            <p className="mt-1 text-body-sm text-slate-500">{grievance.description}</p>
            <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
              <div>
                <dt className="text-label-sm uppercase tracking-wider text-slate-400">Handling wing</dt>
                <dd className="text-body-sm text-slate-700">{grievance.department?.name || 'Awaiting routing'}</dd>
              </div>
              <div>
                <dt className="text-label-sm uppercase tracking-wider text-slate-400">Category</dt>
                <dd className="text-body-sm text-slate-700">{CATEGORY_LABELS[grievance.category]}</dd>
              </div>
              <div>
                <dt className="text-label-sm uppercase tracking-wider text-slate-400">SLA window</dt>
                <dd className="text-body-sm text-slate-700">{grievance.sla?.hours}h · due {grievance.slaRemainingLabel}</dd>
              </div>
              <div>
                <dt className="text-label-sm uppercase tracking-wider text-slate-400">Evidence files</dt>
                <dd className="text-body-sm text-slate-700">{grievance.attachments?.length || 0} attached</dd>
              </div>
            </dl>
          </Card>

          {triage && (
            <Card>
              <CardHeader
                icon="psychology"
                title="Automated triage report"
                subtitle="Generated from your submission and stored against this case"
                action={
                  <Pill tone={isFallback ? 'pending' : 'ai'} icon={isFallback ? 'rule' : 'auto_awesome'}>
                    {isFallback ? 'Rule-based fallback engine' : `${triage.provider} · ${triage.model}`}
                  </Pill>
                }
              />
              <div className="grid gap-5 p-5 lg:grid-cols-3">
                <div className="space-y-3">
                  <div>
                    <p className="text-label-sm uppercase tracking-wider text-slate-400">Recommended category</p>
                    <p className="flex items-center gap-1.5 text-body-md text-slate-700">
                      <Icon name={CATEGORY_ICONS[triage.category]} size={16} /> {CATEGORY_LABELS[triage.category]}
                    </p>
                  </div>
                  <div>
                    <p className="text-label-sm uppercase tracking-wider text-slate-400">Severity / priority</p>
                    <p className="text-body-md text-slate-700">
                      Severity {triage.severity} of 4 · {PRIORITY_LABELS[triage.priority]}
                    </p>
                  </div>
                  <div>
                    <p className="text-label-sm uppercase tracking-wider text-slate-400">SLA window</p>
                    <p className="text-body-md text-slate-700">{triage.slaHours} hours</p>
                  </div>
                  <div>
                    <p className="text-label-sm uppercase tracking-wider text-slate-400">Engine confidence</p>
                    <p className="text-body-md text-slate-700">{Math.round((triage.confidence || 0) * 100)}%</p>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <p className="text-label-sm uppercase tracking-wider text-slate-400">Summary</p>
                  <p className="mt-1 text-body-md text-slate-700">{triage.summary}</p>

                  {triage.nextSteps?.length > 0 && (
                    <>
                      <p className="mt-4 text-label-sm uppercase tracking-wider text-slate-400">Recommended next steps</p>
                      <ul className="mt-1 space-y-1.5">
                        {triage.nextSteps.map((s) => (
                          <li key={s} className="flex gap-2 text-body-sm text-slate-600">
                            <Icon name="arrow_right" size={15} className="mt-0.5 shrink-0 text-brand-blue" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {triage.duplicateCandidates?.length > 0 && (
                    <>
                      <p className="mt-4 text-label-sm uppercase tracking-wider text-slate-400">
                        Possible duplicate cases
                      </p>
                      <ul className="mt-1 space-y-1.5">
                        {triage.duplicateCandidates.map((d) => (
                          <li key={d.referenceId} className="flex items-center gap-2 text-body-sm text-slate-600">
                            <Icon name="content_copy" size={15} className="text-amber-500" />
                            <span className="font-mono">{d.referenceId}</span>
                            <span className="text-slate-400">similarity {Math.round(d.score * 100)}%</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {triage.notes && <InlineAlert tone={isFallback ? 'warning' : 'info'} className="mt-4">{triage.notes}</InlineAlert>}
                </div>
              </div>
            </Card>
          )}
        </div>
      </>
    );
  }

  /* ------------------------------- Wizard form ------------------------------ */
  return (
    <>
      <PageHeader
        icon="add_circle"
        breadcrumb={['Home', 'Passenger Dashboard', 'Lodge Grievance']}
        title="Lodge a transit grievance"
        description="Describe the issue and it will be triaged and routed to the responsible operational wing."
        actions={
          <Link to="/passenger" className="btn-secondary btn-sm">
            <Icon name="close" size={16} /> Cancel
          </Link>
        }
      />

      <div className="mx-auto w-full max-w-[1200px] px-gutter py-6">
        {/* Stepper */}
        <ol className="mb-5 flex flex-wrap items-center gap-2">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => s.id < step && setStep(s.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-label-md transition-colors ${
                  step === s.id
                    ? 'bg-primary-container text-white'
                    : step > s.id
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px]">
                  {step > s.id ? <Icon name="check" size={12} /> : s.id}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && <Icon name="chevron_right" size={16} className="text-slate-300" />}
            </li>
          ))}
        </ol>

        {error && (
          <InlineAlert tone="error" className="mb-4">
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

        <form onSubmit={submit}>
          <Card>
            {step === 1 && (
              <>
                <CardHeader
                  icon="train"
                  title="Journey & incident context"
                  subtitle="Optional, but journey detail helps officers locate the fault faster."
                />
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <Field label="Transport mode">
                    <Select value={form.transportMode} onChange={set('transportMode')}>
                      {Object.entries(TRANSPORT_MODE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="PNR / booking reference" hint="Defaults to the PNR on your profile.">
                    <Input className="font-mono" value={form.pnr} onChange={set('pnr')} placeholder="4829103810" />
                  </Field>
                  <Field label="Train / service number">
                    <Input value={form.trainNumber} onChange={set('trainNumber')} placeholder="12952" />
                  </Field>
                  <Field label="Train / service name">
                    <Input value={form.trainName} onChange={set('trainName')} placeholder="Tejas Rajdhani Express" />
                  </Field>
                  <Field label="Coach">
                    <Input value={form.coach} onChange={set('coach')} placeholder="B-4" />
                  </Field>
                  <Field label="Berth / seat">
                    <Input value={form.berth} onChange={set('berth')} placeholder="28" />
                  </Field>
                  <Field label="Station / location">
                    <Input value={form.station} onChange={set('station')} placeholder="Ratlam Junction" />
                  </Field>
                  <Field label="Route / corridor">
                    <Input value={form.route} onChange={set('route')} placeholder="Mumbai Central → New Delhi" />
                  </Field>
                  <Field label="Incident date & time">
                    <Input type="datetime-local" value={form.incidentAt} onChange={set('incidentAt')} />
                  </Field>
                  <Field label="Specific spot" hint="Bay, vestibule, platform, gate…">
                    <Input value={form.incidentLocation} onChange={set('incidentLocation')} placeholder="Berth 28, Bay 4" />
                  </Field>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <CardHeader
                  icon="edit_note"
                  title="Grievance summary & narration"
                  subtitle="Be specific — detail drives the severity and priority assessment."
                />
                <div className="space-y-4 p-5">
                  <Field
                    label="Subject / short headline"
                    required
                    hint={`${form.subject.length}/160 characters`}
                  >
                    <Input
                      value={form.subject}
                      onChange={set('subject')}
                      maxLength={160}
                      placeholder="AC thermostat failure causing excessive cooling in Coach B-4"
                    />
                  </Field>
                  <Field
                    label="Detailed description"
                    required
                    hint={`${form.description.length} characters · minimum 20`}
                  >
                    <Textarea
                      rows={8}
                      value={form.description}
                      onChange={set('description')}
                      maxLength={8000}
                      placeholder="Describe what happened, when it started, who was affected and what you have already tried."
                    />
                  </Field>
                  <Field
                    label="Preferred category (optional)"
                    hint="Leave blank to let the triage engine decide. If you choose a category, triage is skipped and your selection is used."
                  >
                    <Select value={form.categoryHint} onChange={set('categoryHint')}>
                      <option value="">Let the system decide</option>
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <CardHeader
                  icon="photo_camera"
                  title="Evidence & media"
                  subtitle="Attach photographs or documents. Files are stored privately and served only to authorised users."
                />
                <div className="p-5">
                  <label
                    htmlFor="evidence"
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition-colors hover:border-brand-blue"
                  >
                    <Icon name="cloud_upload" size={32} className="text-slate-400" />
                    <span className="text-body-md font-medium text-primary">Choose evidence files</span>
                    <span className="text-body-sm text-slate-500">
                      PNG, JPG, WEBP, GIF, PDF or TXT · up to 5 files
                    </span>
                    <input
                      id="evidence"
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/*,application/pdf,text/plain"
                      onChange={onFiles}
                    />
                  </label>

                  {files.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {files.map((f) => (
                        <li key={f.name} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                          <Icon name="attach_file" size={16} className="text-slate-400" />
                          <span className="min-w-0 flex-1 truncate text-body-sm text-slate-700">{f.name}</span>
                          <span className="text-label-sm text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                          <button
                            type="button"
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                            onClick={() => setFiles((prev) => prev.filter((x) => x !== f))}
                            aria-label={`Remove ${f.name}`}
                          >
                            <Icon name="close" size={15} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {files.length === 0 && (
                    <p className="mt-3 text-label-sm text-slate-400">
                      Evidence is optional. You can also attach files later from the case thread.
                    </p>
                  )}
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <CardHeader icon="fact_check" title="Verify & submit" subtitle="Review the details before lodging." />
                <div className="grid gap-5 p-5 lg:grid-cols-3">
                  <div className="lg:col-span-2 space-y-4">
                    <div>
                      <p className="text-label-sm uppercase tracking-wider text-slate-400">Subject</p>
                      <p className="text-body-md font-medium text-primary">{form.subject || '—'}</p>
                    </div>
                    <div>
                      <p className="text-label-sm uppercase tracking-wider text-slate-400">Description</p>
                      <p className="whitespace-pre-wrap text-body-sm text-slate-600">{form.description || '—'}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        ['Transport mode', TRANSPORT_MODE_LABELS[form.transportMode]],
                        ['Train', form.trainNumber || '—'],
                        ['Coach / berth', [form.coach, form.berth].filter(Boolean).join(' / ') || '—'],
                        ['PNR', form.pnr || '—'],
                        ['Station', form.station || '—'],
                        ['Category preference', form.categoryHint ? CATEGORY_LABELS[form.categoryHint] : 'Automatic triage'],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-label-sm uppercase tracking-wider text-slate-400">{label}</p>
                          <p className="text-body-sm text-slate-700">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-label-sm uppercase tracking-wider text-slate-400">Evidence files</p>
                      <p className="text-body-sm text-slate-700">
                        {files.length ? files.map((f) => f.name).join(', ') : 'None attached'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                    <p className="flex items-center gap-2 text-label-md text-sky-800">
                      <Icon name="psychology" size={18} /> Automatic triage will run
                    </p>
                    <p className="mt-2 text-body-sm text-sky-800/90">
                      On submission the triage engine recommends a category, severity, priority, handling wing and SLA
                      window, and checks for possible duplicate cases. The result is shown to you and stored against the
                      case. An authorised officer can override the recommendation.
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
              >
                <Icon name="chevron_left" size={16} /> Back
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => setStep((s) => Math.min(4, s + 1))}
                  disabled={!canAdvance}
                >
                  Continue <Icon name="chevron_right" size={16} />
                </button>
              ) : (
                <button type="submit" className="btn-accent btn-sm" disabled={busy || !form.subject || !form.description}>
                  {busy ? <Spinner size={16} className="border-white/40 border-t-white" /> : <Icon name="send" size={16} />}
                  Submit grievance
                </button>
              )}
            </div>
          </Card>
        </form>
      </div>
    </>
  );
}
