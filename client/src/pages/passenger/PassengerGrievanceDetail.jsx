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
  LoadingBlock,
  Modal,
  Pill,
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
  PRIORITY_LABELS,
  STATUS_LABELS,
  formatDateTime,
} from '../../lib/format.js';

export default function PassengerGrievanceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [ratingOpen, setRatingOpen] = useState(false);

  const load = useCallback(() => {
    setError('');
    api
      .getGrievance(id)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <>
        <PageHeader icon="support_agent" breadcrumb={['Home', 'My Tickets']} title="Case detail" />
        <div className="mx-auto max-w-[1400px] px-gutter py-6">
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
        <PageHeader icon="support_agent" breadcrumb={['Home', 'My Tickets']} title="Case detail" />
        <div className="mx-auto max-w-[1400px] px-gutter py-6">
          <LoadingBlock label="Loading case file…" />
        </div>
      </>
    );
  }

  const { grievance: g, timeline, messages, feedback } = data;
  const canRate = ['resolved', 'closed'].includes(g.status) && !feedback;
  const awaiting = g.status === 'awaiting_clarification';

  const submitFeedback = async () => {
    setBusy(true);
    try {
      await api.submitFeedback(g._id, { rating, comment });
      toast.success('Thank you — your rating has been recorded');
      setRatingOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const closeCase = async () => {
    setBusy(true);
    try {
      await api.updateStatus(g._id, { status: 'closed', note: 'Passenger confirmed the resolution.' });
      toast.success('Grievance closed');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        icon="support_agent"
        breadcrumb={['Home', 'Passenger Dashboard', 'Case', g.referenceId]}
        title={g.subject}
        description={`${CATEGORY_LABELS[g.category]} · ${g.department?.name || 'Unassigned'} · lodged ${formatDateTime(g.createdAt)}`}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={g.status} label={g.statusLabel} />
            <Pill tone={g.priority === 'tier1' ? 'urgent' : g.priority === 'tier2' ? 'pending' : 'neutral'}>
              {PRIORITY_LABELS[g.priority]}
            </Pill>
            {g.escalation?.level > 0 && <Pill tone="urgent">Escalated L{g.escalation.level}</Pill>}
          </div>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canRate && (
              <button type="button" className="btn-accent btn-sm" onClick={() => setRatingOpen(true)}>
                <Icon name="star" size={16} /> Rate resolution
              </button>
            )}
            {g.status === 'resolved' && (
              <button type="button" className="btn-primary btn-sm" onClick={closeCase} disabled={busy}>
                {busy ? <Spinner size={15} className="border-white/40 border-t-white" /> : <Icon name="done_all" size={16} />}
                Close case
              </button>
            )}
            <Link to="/passenger/grievances" className="btn-secondary btn-sm">
              <Icon name="arrow_back" size={16} /> All tickets
            </Link>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-[1400px] space-y-5 px-gutter py-6">
        {awaiting && (
          <InlineAlert tone="warning" icon="help_center">
            The handling officer needs more information before proceeding. Reply in the conversation below.
          </InlineAlert>
        )}
        {g.slaBreached && (
          <InlineAlert tone="error" icon="timer_off">
            This grievance has passed its {g.sla?.hours}h statutory SLA window and has been flagged as breached.
          </InlineAlert>
        )}

        <div className="grid gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            {/* Conversation */}
            <Card>
              <CardHeader
                icon="forum"
                title="Investigation communication"
                subtitle={`${messages.length} message(s) on this case`}
                action={<Pill tone="ai" icon="lock">Visible to you and the handling wing</Pill>}
              />
              <CaseThread
                grievanceId={g._id}
                messages={messages}
                currentUserId={user?.id || user?._id}
                role="passenger"
                onSent={load}
              />
            </Card>

            {/* Description */}
            <Card>
              <CardHeader icon="description" title="Your narration" />
              <div className="p-5">
                <p className="whitespace-pre-wrap text-body-md text-slate-700">{g.description}</p>
                <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                  {[
                    ['Reference', g.referenceId],
                    ['Train / service', g.trainNumber ? `${g.trainNumber} ${g.trainName || ''}`.trim() : '—'],
                    ['Coach / berth', [g.coach, g.berth].filter(Boolean).join(' / ') || '—'],
                    ['PNR', g.pnr || '—'],
                    ['Station', g.station || '—'],
                    ['Incident time', g.incidentAt ? formatDateTime(g.incidentAt) : '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-label-sm uppercase tracking-wider text-slate-400">{label}</dt>
                      <dd className={`text-body-sm text-slate-700 ${label === 'Reference' ? 'font-mono' : ''}`}>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Card>

            {/* Attachments */}
            <Card>
              <CardHeader icon="attach_file" title="Evidence & attachments" subtitle={`${g.attachments?.length || 0} file(s)`} />
              <AttachmentList grievance={g._id} attachments={g.attachments || []} />
            </Card>

            {/* Resolution + feedback */}
            {['resolved', 'closed'].includes(g.status) && (
              <Card>
                <CardHeader icon="task_alt" title="Resolution record" />
                <div className="p-5">
                  <p className="whitespace-pre-wrap text-body-md text-slate-700">{g.resolution?.notes || 'No notes recorded.'}</p>
                  <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                    <div>
                      <dt className="text-label-sm uppercase tracking-wider text-slate-400">Resolved by</dt>
                      <dd className="text-body-sm text-slate-700">{g.resolution?.resolvedBy?.name || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-label-sm uppercase tracking-wider text-slate-400">Resolved at</dt>
                      <dd className="text-body-sm text-slate-700">{formatDateTime(g.resolution?.resolvedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-label-sm uppercase tracking-wider text-slate-400">Passenger confirmation</dt>
                      <dd className="text-body-sm text-slate-700">
                        {g.resolution?.otpVerified ? 'Verified with one-time code' : 'Not yet verified'}
                      </dd>
                    </div>
                  </dl>

                  {feedback && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5 text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Icon key={i} name={i < feedback.rating ? 'star' : 'star_border'} size={16} filled={i < feedback.rating} />
                          ))}
                        </span>
                        <span className="text-label-md text-amber-800">Your rating: {feedback.rating}/5</span>
                        <Pill tone={feedback.resolvedWithinSla ? 'resolved' : 'urgent'}>
                          {feedback.resolvedWithinSla ? 'Within SLA' : 'Beyond SLA'}
                        </Pill>
                      </div>
                      {feedback.comment && <p className="mt-2 text-body-sm text-amber-900">{feedback.comment}</p>}
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <Card>
              <CardHeader icon="info" title="Case summary" />
              <dl className="divide-y divide-slate-100">
                {[
                  ['Status', STATUS_LABELS[g.status]],
                  ['Category', CATEGORY_LABELS[g.category]],
                  ['Priority', PRIORITY_LABELS[g.priority]],
                  ['Severity', `${g.severity} of 4`],
                  ['Handling wing', g.department?.name || 'Unassigned'],
                  ['Assigned officer', g.assignedOfficer?.name || 'Not yet assigned'],
                  ['SLA window', `${g.sla?.hours}h`],
                  ['SLA deadline', formatDateTime(g.sla?.dueAt)],
                  ['SLA state', g.slaBreached ? 'Breached' : 'Within window'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <dt className="text-label-md text-slate-500">{label}</dt>
                    <dd className={`text-right text-body-sm ${g.slaBreached && label === 'SLA state' ? 'text-red-600' : 'text-slate-700'}`}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>

            {g.aiTriage && (
              <Card>
                <CardHeader
                  icon="psychology"
                  title="Triage record"
                  action={
                    <Pill tone={g.aiTriage.engine === 'rule-based-fallback' ? 'pending' : 'ai'}>
                      {g.aiTriage.engine === 'rule-based-fallback' ? 'Rule-based' : g.aiTriage.provider}
                    </Pill>
                  }
                />
                <div className="space-y-3 p-5">
                  <p className="text-body-sm text-slate-600">{g.aiTriage.summary}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pill tone="neutral" icon={CATEGORY_ICONS[g.aiTriage.category]}>
                      {CATEGORY_LABELS[g.aiTriage.category]}
                    </Pill>
                    <Pill tone="ai">Confidence {Math.round((g.aiTriage.confidence || 0) * 100)}%</Pill>
                    <Pill tone="neutral">Sentiment: {g.aiTriage.sentiment}</Pill>
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
                  {g.aiTriage.overriddenAt && (
                    <InlineAlert tone="warning">
                      An officer overrode this recommendation. Reason: {g.aiTriage.overrideReason}
                    </InlineAlert>
                  )}
                </div>
              </Card>
            )}

            <Card>
              <CardHeader icon="history" title="Case timeline" />
              <CaseTimeline events={timeline} />
            </Card>
          </div>
        </div>
      </div>

      <Modal
        open={ratingOpen}
        onClose={() => setRatingOpen(false)}
        title="Rate the resolution"
        subtitle={`How well was ${g.referenceId} handled?`}
        footer={
          <>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setRatingOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-accent btn-sm" onClick={submitFeedback} disabled={busy}>
              {busy && <Spinner size={15} className="border-white/40 border-t-white" />} Submit rating
            </button>
          </>
        }
      >
        <Field label="Your rating" required>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                className="rounded p-1 text-amber-400"
              >
                <Icon name={n <= rating ? 'star' : 'star_border'} size={28} filled={n <= rating} />
              </button>
            ))}
            <span className="ml-2 text-body-sm text-slate-500">{rating} / 5</span>
          </div>
        </Field>
        <Field label="Comments (optional)" className="mt-4">
          <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell us what worked and what did not." />
        </Field>
      </Modal>
    </>
  );
}
