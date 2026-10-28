import { Icon } from './ui.jsx';
import { formatDateTime, relativeTime } from '../lib/format.js';

const TYPE_ICONS = {
  created: 'add_circle',
  ai_triage: 'psychology',
  assigned: 'person_add',
  reassigned: 'swap_horiz',
  status_change: 'published_with_changes',
  message: 'chat',
  clarification_requested: 'help_center',
  clarification_responded: 'reply',
  escalated: 'alt_route',
  resolved: 'task_alt',
  closed: 'done_all',
  rejected: 'cancel',
  feedback: 'star',
  sla_breach: 'timer_off',
};

const TYPE_TONES = {
  escalated: 'bg-red-100 text-red-600',
  sla_breach: 'bg-red-100 text-red-600',
  resolved: 'bg-emerald-100 text-emerald-600',
  closed: 'bg-emerald-100 text-emerald-600',
  ai_triage: 'bg-sky-100 text-brand-blue',
  feedback: 'bg-amber-100 text-amber-600',
};

export function CaseTimeline({ events = [], onRequestClarification }) {
  if (!events.length) {
    return <p className="px-5 py-8 text-center text-body-sm text-slate-400">No timeline events recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-4 px-5 py-5">
      <span className="absolute left-[38px] top-8 bottom-8 w-0.5 bg-slate-200" aria-hidden="true" />
      {events.map((event) => (
        <li key={event._id} className="relative flex gap-3">
          <span
            className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
              TYPE_TONES[event.type] || 'bg-slate-100 text-slate-500'
            }`}
          >
            <Icon name={TYPE_ICONS[event.type] || 'circle'} size={15} />
          </span>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-body-sm font-semibold text-primary">{event.title}</p>
              <span className="text-label-sm text-slate-400" title={formatDateTime(event.createdAt)}>
                {relativeTime(event.createdAt)}
              </span>
            </div>
            {event.description && (
              <p className="mt-0.5 whitespace-pre-wrap text-body-sm text-slate-500">{event.description}</p>
            )}
            {event.actor?.name && (
              <p className="mt-0.5 text-label-sm text-slate-400">
                {event.actor.name} · {event.actorRole}
              </p>
            )}
            {event.type === 'clarification_requested' && onRequestClarification && (
              <button type="button" className="btn-ghost btn-sm mt-1 -ml-3 text-brand-blue" onClick={onRequestClarification}>
                <Icon name="reply" size={15} /> Reply now
              </button>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
