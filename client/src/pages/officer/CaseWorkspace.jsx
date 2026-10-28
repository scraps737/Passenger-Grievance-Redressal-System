import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/AppShell.jsx';
import { AttachmentList, CaseThread } from '../../components/CaseThread.jsx';
import { CaseTimeline } from '../../components/CaseTimeline.jsx';
import {
  Card,
  CardHeader,
  ErrorState,
  Field,
  Icon,
  InlineAlert,
  Input,
  LoadingBlock,
  Modal,
  Pill,
  Select,
  Spinner,
  StatusPill,
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
  STATUS_LABELS,
  formatDateTime,
} from '../../lib/format.js';

export default function CaseWorkspace() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [officers, setOfficers] = useState([]);
  const [busy, setBusy] = useState('');

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ officerId: '', reason: '' });
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideForm, setOverrideForm] = useState({ category: '', priority: '', slaHours: '', summary: '', reason: '' });
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveForm, setResolveForm] = useState({ notes: '', otp: '' });
  const [otpGenerated, setOtpGenerated] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    setError('');
    api
      .getGrievance(id)
      .then((res) => {
        setData(res);
        setOverrideForm({
          category: res.grievance.category,
          priority: res.grievance.priority,
          slaHours: res.grievance.sla?.hours || 24,
          summary: res.grievance.aiTriage?.summary || '',
          reason: '',
        });
        setResolveForm({ notes: res.grievance.resolution?.notes || '', otp: '' });
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .listOfficers()
      .then((res) => setOfficers(res.officers))
      .catch(() => setOfficers([]));
  }, []);

  if (error) {
    return (
      <>
        <PageHeader icon="travel_explore" breadcrumb={['Ops', 'Case']} title="Case workspace" />
        <div className="mx-auto max-w-[1600px] px-gutter py-6">
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
        <PageHeader icon="travel_explore" breadcrumb={['Ops', 'Case']} title="Case workspace" />
        <div className="mx-auto max-w-[1600px] px-gutter py-6">
          <LoadingBlock label="Loading case file…" />
        </div>
      </>
    );
  }

  const { grievance: g, timeline, messages } = data;
  const isAssigned = String(g.assignedOfficer?._id || g.assignedOfficer) === String(user?.id || user?._id);
  const canAct = isAdmin || isAssigned || (user?.department && String(g.department?._id) === String(user.department));

  const runAction = async (key, fn, successMessage) => {
    setBusy(key);
    try {
      await fn();
      if (successMessage) toast.success(successMessage);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const updateStatus = (status, note) =>
    runAction(`status-${status}`, () => api.updateStatus(g._id, { status, note }), `Status set to ${STATUS_LABELS[status]}`);

  const doAssign = () =>
    runAction(
      'assign',
      async () => {
        await api.assignGrievance(g._id, {
          officerId: assignForm.officerId || undefined,
          departmentId: g.department?._id,
          reason: assignForm.reason,
        });
        setAssignOpen(false);
      },
      'Case assignment updated'
    );

  const doEscalate = () =>
    runAction(
      'escalate',
      async () => {
        await api.escalateGrievance(g._id, { reason: escalateReason });
        setEscalateOpen(false);
        setEscalateReason('');
      },
      'Case escalated'
    );

  const doOverride = () =>
    runAction(
      'override',
      async () => {
        await api.overrideTriage(g._id, {
          category: overrideForm.category,
          priority: overrideForm.priority,
          slaHours: Number(overrideForm.slaHours),
          summary: overrideForm.summary,
          reason: overrideForm.reason,
        });
        setOverrideOpen(false);
      },
      'Triage recommendation overridden'
    );

  const generateOtp = () =>
    runAction(
      'otp',
      async () => {
        await api.generateOtp(g._id);
        setOtpGenerated(true);
      },
      'Verification code sent to the passenger'
    );

  const doResolve = () =>
    runAction(
      'resolve',
      async () => {
        await api.resolveGrievance(g._id, { notes: resolveForm.notes, otp: resolveForm.otp || undefined });
        setResolveOpen(false);
      },
      'Grievance resolved'
    );

  const onUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      await api.uploadAttachments(g._id, files);
      toast.success(`${files.length} file(s) attached for investigation`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <>
      <PageHeader
        icon="travel_explore"
        breadcrumb={['Home', 'Complaint Queue', `Investigation ${g.referenceId}`]}
        title={g.subject}
        description={`${CATEGORY_LABELS[g.category]} · ${g.department?.name || 'Unassigned'} · lodged ${formatDateTime(g.createdAt)}`}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={g.status} label={g.statusLabel} />
            <Pill tone={g.priority === 'tier1' ? 'urgent' : g.priority === 'tier2' ? 'pending' : 'neutral'}>
              {PRIORITY_LABELS[g.priority]}
            </Pill>
            <Pill tone={g.slaBreached ? 'urgent' : 'resolved'} icon="timer">
              {g.slaRemainingLabel}
            </Pill>
          </div>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={() => setAssignOpen(true)} disabled={!canAct}>
              <Icon name="group_add" size={15} /> Assign
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setEscalateOpen(true)} disabled={!canAct}>
              <Icon name="emergency_share" size={15} /> Escalate
            </button>
            <button type="button" className="btn-accent btn-sm" onClick={() => setResolveOpen(true)} disabled={!canAct}>
              <Icon name="verified" size={15} /> Resolve with OTP
            </button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-[1600px] space-y-5 px-gutter py-6">
        {!canAct && (
          <InlineAlert tone="warning" icon="lock">
            You can view this case but not modify it: only the assigned officer or the owning wing may act on it.
          </InlineAlert>
        )}
        {g.slaBreached && (
          <InlineAlert tone="error" icon="timer_off">
            SLA breached — this case has exceeded its {g.sla?.hours}h statutory window and has been flagged in the audit log.
          </InlineAlert>
        )}

        <div className="grid gap-5 xl:grid-cols-3">
          {/* ------------------------------ Main column ----------------------------- */}
          <div className="space-y-5 xl:col-span-2">
            <Card>
              <CardHeader icon="folder_open" title="Passenger complaint" subtitle={`Filed by ${g.passenger?.name || 'passenger'}`} />
              <div className="p-5">
                <p className="whitespace-pre-wrap text-body-md text-slate-700">{g.description}</p>
                <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
                  {[
                    ['Passenger', g.passenger?.name || '—'],
                    ['PNR', g.pnr || '—'],
                    ['Train / service', g.trainNumber ? `${g.trainNumber} ${g.trainName || ''}`.trim() : '—'],
                    ['Coach / berth', [g.coach, g.berth].filter(Boolean).join(' / ') || '—'],
                    ['Station', g.station || '—'],
                    ['Transport mode', g.transportMode],
                    ['Incident time', g.incidentAt ? formatDateTime(g.incidentAt) : '—'],
                    ['Specific spot', g.incidentLocation || '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-label-sm uppercase tracking-wider text-slate-400">{label}</dt>
                      <dd className="text-body-sm text-slate-700">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Card>

            <Card>
              <CardHeader
                icon="forum"
                title="Investigation communication"
                subtitle={`${messages.length} message(s)`}
                action={<Pill tone="ai" icon="lock">Encrypted case channel</Pill>}
              />
              <CaseThread
                grievanceId={g._id}
                messages={messages}
                currentUserId={user?.id || user?._id}
                role={user?.role}
                onSent={load}
                disabled={!canAct}
              />
            </Card>

            <Card>
              <CardHeader
                icon="attach_file"
                title="Evidence & field proofs"
                subtitle={`${g.attachments?.length || 0} file(s) on record`}
                action={
                  canAct && (
                    <label className={`btn-secondary btn-sm cursor-pointer ${uploading ? 'opacity-60' : ''}`}>
                      {uploading ? <Spinner size={14} /> : <Icon name="upload" size={15} />}
                      Attach
                      <input type="file" className="hidden" multiple accept="image/*,application/pdf,text/plain" onChange={onUpload} />
                    </label>
                  )
                }
              />
              <AttachmentList grievance={g._id} attachments={g.attachments || []} />
            </Card>

            {['resolved', 'closed'].includes(g.status) && (
              <Card>
                <CardHeader icon="task_alt" title="Resolution record" />
                <div className="p-5">
                  <p className="whitespace-pre-wrap text-body-md text-slate-700">{g.resolution?.notes || 'No notes recorded.'}</p>
                  <p className="mt-2 text-body-sm text-slate-500">
                    Resolved by {g.resolution?.resolvedBy?.name || '—'} on {formatDateTime(g.resolution?.resolvedAt)}
                    {g.resolution?.otpVerified ? ' · passenger confirmed with one-time code' : ' · awaiting passenger confirmation'}
                  </p>
                </div>
              </Card>
            )}
          </div>

          {/* -------------------------------- Sidebar ------------------------------- */}
          <div className="space-y-5">
            <Card>
              <CardHeader icon="bolt" title="Dispatch actions" subtitle="Available to the assigned officer" />
              <div className="grid gap-2 p-5">
                <button type="button" className="btn-secondary btn-sm justify-start" disabled={!canAct || busy === 'status-in_progress'} onClick={() => updateStatus('in_progress', 'Field investigation started.')}>
                  <Icon name="play_arrow" size={15} /> Mark in progress
                </button>
                <button type="button" className="btn-secondary btn-sm justify-start" disabled={!canAct || busy === 'status-awaiting_clarification'} onClick={() => updateStatus('awaiting_clarification', 'Clarification requested from the passenger.')}>
                  <Icon name="help_center" size={15} /> Awaiting clarification
                </button>
                <button type="button" className="btn-secondary btn-sm justify-start" disabled={!canAct || busy === 'status-rejected'} onClick={() => updateStatus('rejected', 'Rejected after verification — not a valid grievance.')}>
                  <Icon name="cancel" size={15} /> Reject case
                </button>
                {isAdmin && (
                  <button type="button" className="btn-secondary btn-sm justify-start" disabled={busy === 'status-closed'} onClick={() => updateStatus('closed', 'Closed by administrator.')}>
                    <Icon name="done_all" size={15} /> Close case (admin)
                  </button>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                icon="psychology"
                title="Triage assessment"
                action={
                  g.aiTriage?.engine === 'rule-based-fallback' ? (
                    <Pill tone="pending">Rule-based fallback</Pill>
                  ) : (
                    <Pill tone="ai">{g.aiTriage?.provider}</Pill>
                  )
                }
              />
              {g.aiTriage ? (
                <div className="space-y-3 p-5">
                  <p className="text-body-sm text-slate-600">{g.aiTriage.summary}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Pill tone="neutral" icon={CATEGORY_ICONS[g.aiTriage.category]}>
                      {CATEGORY_LABELS[g.aiTriage.category]}
                    </Pill>
                    <Pill tone="ai">Confidence {Math.round((g.aiTriage.confidence || 0) * 100)}%</Pill>
                    <Pill tone="neutral">Severity {g.aiTriage.severity}/4</Pill>
                  </div>
                  {g.aiTriage.nextSteps?.length > 0 && (
                    <ul className="space-y-1.5">
                      {g.aiTriage.nextSteps.map((s) => (
                        <li key={s} className="flex gap-2 text-body-sm text-slate-600">
                          <Icon name="arrow_right" size={15} className="mt-0.5 shrink-0 text-brand-blue" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                  {g.aiTriage.duplicateCandidates?.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-label-md text-amber-800">Possible duplicates</p>
                      <ul className="mt-1 space-y-1">
                        {g.aiTriage.duplicateCandidates.map((d) => (
                          <li key={d.referenceId} className="font-mono text-label-sm text-amber-900">
                            {d.referenceId} · {Math.round(d.score * 100)}% similar
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {g.aiTriage.overriddenAt && (
                    <InlineAlert tone="warning">
                      Overridden by an officer: {g.aiTriage.overrideReason}
                    </InlineAlert>
                  )}
                  <button type="button" className="btn-accent btn-sm w-full" onClick={() => setOverrideOpen(true)} disabled={!canAct}>
                    <Icon name="edit" size={15} /> Override recommendation
                  </button>
                </div>
              ) : (
                <p className="px-5 py-6 text-body-sm text-slate-400">No triage record for this case.</p>
              )}
            </Card>

            <Card>
              <CardHeader icon="assignment" title="Case attributes" />
              <dl className="divide-y divide-slate-100">
                {[
                  ['Status', STATUS_LABELS[g.status]],
                  ['Priority', PRIORITY_LABELS[g.priority]],
                  ['Severity', `${g.severity} of 4`],
                  ['Handling wing', g.department?.name || 'Unassigned'],
                  ['Assigned officer', g.assignedOfficer?.name || 'Unassigned'],
                  ['Escalation level', g.escalation?.level || 0],
                  ['SLA window', `${g.sla?.hours}h`],
                  ['SLA deadline', formatDateTime(g.sla?.dueAt)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <dt className="text-label-md text-slate-500">{label}</dt>
                    <dd className="text-right text-body-sm text-slate-700">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card>
              <CardHeader icon="history" title="Investigation timeline" />
              <CaseTimeline events={timeline} />
            </Card>

            <Link to="/officer/queue" className="btn-secondary btn-sm w-full">
              <Icon name="arrow_back" size={15} /> Back to dispatch ledger
            </Link>
          </div>
        </div>
      </div>

      {/* ---------------------------------- Modals --------------------------------- */}
      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign or reassign case"
        subtitle={`Route ${g.referenceId} to an officer`}
        footer={
          <>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setAssignOpen(false)}>Cancel</button>
            <button type="button" className="btn-accent btn-sm" onClick={doAssign} disabled={busy === 'assign'}>
              {busy === 'assign' && <Spinner size={15} className="border-white/40 border-t-white" />} Save assignment
            </button>
          </>
        }
      >
        <Field label="Officer" hint="Choose the officer who will own this case.">
          <Select value={assignForm.officerId} onChange={(e) => setAssignForm((f) => ({ ...f, officerId: e.target.value }))}>
            <option value="">Keep current assignment</option>
            {officers.map((o) => (
              <option key={o._id} value={o._id}>
                {o.name} — {o.designation || o.role} {o.department?.code ? `(${o.department.code})` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reason" className="mt-4" hint="Recorded in the case timeline and audit log.">
          <Textarea rows={3} value={assignForm.reason} onChange={(e) => setAssignForm((f) => ({ ...f, reason: e.target.value }))} />
        </Field>
      </Modal>

      <Modal
        open={escalateOpen}
        onClose={() => setEscalateOpen(false)}
        title="Escalate grievance"
        subtitle="The SLA window is halved on escalation and administrators are notified."
        footer={
          <>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setEscalateOpen(false)}>Cancel</button>
            <button type="button" className="btn-danger btn-sm" onClick={doEscalate} disabled={busy === 'escalate' || escalateReason.trim().length < 5}>
              {busy === 'escalate' && <Spinner size={15} className="border-white/40 border-t-white" />} Escalate now
            </button>
          </>
        }
      >
        <Field label="Escalation reason" required hint="Minimum 5 characters. Shown to the passenger.">
          <Textarea rows={4} value={escalateReason} onChange={(e) => setEscalateReason(e.target.value)} placeholder="Why does this case need divisional attention?" />
        </Field>
      </Modal>

      <Modal
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        title="Override triage recommendation"
        subtitle="Your change is recorded alongside the original machine recommendation."
        footer={
          <>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setOverrideOpen(false)}>Cancel</button>
            <button type="button" className="btn-accent btn-sm" onClick={doOverride} disabled={busy === 'override' || overrideForm.reason.trim().length < 3}>
              {busy === 'override' && <Spinner size={15} className="border-white/40 border-t-white" />} Apply override
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select value={overrideForm.category} onChange={(e) => setOverrideForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Priority tier">
            <Select value={overrideForm.priority} onChange={(e) => setOverrideForm((f) => ({ ...f, priority: e.target.value }))}>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="SLA hours" hint="Recalculates the deadline from the original filing time.">
            <Input type="number" min="1" max="720" value={overrideForm.slaHours} onChange={(e) => setOverrideForm((f) => ({ ...f, slaHours: e.target.value }))} />
          </Field>
          <Field label="Summary">
            <Input value={overrideForm.summary} onChange={(e) => setOverrideForm((f) => ({ ...f, summary: e.target.value }))} />
          </Field>
        </div>
        <Field label="Override reason" required className="mt-4">
          <Textarea rows={3} value={overrideForm.reason} onChange={(e) => setOverrideForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Why is the recommendation being changed?" />
        </Field>
      </Modal>

      <Modal
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        title="Record resolution"
        subtitle="Generate a one-time code, have the passenger confirm, then record the resolution."
        footer={
          <>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setResolveOpen(false)}>Cancel</button>
            <button type="button" className="btn-accent btn-sm" onClick={doResolve} disabled={busy === 'resolve' || resolveForm.notes.trim().length < 5}>
              {busy === 'resolve' && <Spinner size={15} className="border-white/40 border-t-white" />} Record resolution
            </button>
          </>
        }
      >
        <InlineAlert tone={otpGenerated ? 'success' : 'info'} icon="verified_user">
          {otpGenerated
            ? 'A 4-digit verification code has been delivered to the passenger notification stream. Ask the passenger for the code.'
            : 'Generate a verification code first. Resolution without the passenger code is recorded as unverified.'}
        </InlineAlert>

        <button type="button" className="btn-secondary btn-sm mt-3" onClick={generateOtp} disabled={busy === 'otp'}>
          {busy === 'otp' ? <Spinner size={15} /> : <Icon name="pin" size={15} />} Generate verification code
        </button>

        <Field label="Resolution notes" required className="mt-4" hint="What was actually done to fix the issue.">
          <Textarea rows={4} value={resolveForm.notes} onChange={(e) => setResolveForm((f) => ({ ...f, notes: e.target.value }))} />
        </Field>
        <Field label="Passenger verification code" className="mt-4" hint="Optional — leave blank to record the resolution as unverified.">
          <Input className="font-mono" maxLength={6} value={resolveForm.otp} onChange={(e) => setResolveForm((f) => ({ ...f, otp: e.target.value }))} placeholder="4-digit code" />
        </Field>
      </Modal>
    </>
  );
}
