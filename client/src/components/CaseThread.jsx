import { useState } from 'react';
import { Avatar, Icon, InlineAlert, Pill, Spinner, Textarea, useToast } from './ui.jsx';
import { api, downloadAttachment } from '../lib/api.js';
import { classNames, formatDateTime, relativeTime } from '../lib/format.js';

const KIND_META = {
  clarification_request: { label: 'Clarification requested', icon: 'help_center', tone: 'pending' },
  clarification_response: { label: 'Passenger clarification', icon: 'reply', tone: 'ai' },
  system_note: { label: 'System note', icon: 'info', tone: 'neutral' },
  message: { label: 'Message', icon: 'chat', tone: 'neutral' },
};

export function MessageBubble({ message, currentUserId, onOpenAttachment }) {
  const mine = String(message.sender?._id || message.sender) === String(currentUserId);
  const meta = KIND_META[message.kind] || KIND_META.message;
  const isSystem = message.senderRole === 'system' || message.senderRole === 'ai';

  return (
    <li className={classNames('flex gap-3', mine && 'flex-row-reverse')}>
      <Avatar name={message.sender?.name || (isSystem ? 'System' : 'User')} size={34} />
      <div className={classNames('min-w-0 max-w-[85%]', mine && 'items-end text-right')}>
        <div className={classNames('flex flex-wrap items-center gap-2', mine && 'justify-end')}>
          <span className="text-body-sm font-semibold text-primary">
            {message.sender?.name || (isSystem ? 'GrievanceAI' : 'User')}
          </span>
          {message.sender?.designation && (
            <span className="text-label-sm text-slate-400">{message.sender.designation}</span>
          )}
          <Pill tone={meta.tone} icon={meta.icon}>
            {meta.label}
          </Pill>
          <span className="text-label-sm text-slate-400" title={formatDateTime(message.createdAt)}>
            {relativeTime(message.createdAt)}
          </span>
        </div>

        <div
          className={classNames(
            'mt-1.5 rounded-lg border px-3.5 py-2.5 text-body-sm',
            message.kind === 'clarification_request'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : mine
                ? 'border-sky-200 bg-sky-50 text-slate-700'
                : 'border-slate-200 bg-white text-slate-700'
          )}
        >
          <p className="whitespace-pre-wrap">{message.body}</p>
          {message.attachments?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {message.attachments.map((a) => (
                <li key={a.filename}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-label-md text-brand-blue hover:underline"
                    onClick={() =>
                      onOpenAttachment
                        ? onOpenAttachment(a)
                        : downloadAttachment(message.grievance, a.filename, a.originalName)
                    }
                  >
                    <Icon name="attach_file" size={14} /> {a.originalName || a.filename}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Two-way case conversation. Passengers may send normal messages (and answer
 * clarification requests); officers may additionally request clarification.
 */
export function CaseThread({ grievanceId, messages, currentUserId, role, onSent, disabled }) {
  const toast = useToast();
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('message');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isOfficer = role === 'officer' || role === 'admin';

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.postMessage(grievanceId, { body: body.trim(), kind });
      setBody('');
      setKind('message');
      onSent?.();
      toast.success('Message sent');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const awaitingClarification = messages.some((m) => m.kind === 'clarification_request');

  return (
    <div className="flex flex-col">
      <ul className="max-h-[520px] space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <li className="py-8 text-center text-body-sm text-slate-400">
            No messages yet. Start the conversation below.
          </li>
        )}
        {messages.map((m) => (
          <MessageBubble key={m._id} message={m} currentUserId={currentUserId} />
        ))}
      </ul>

      <form onSubmit={send} className="border-t border-slate-100 p-4">
        {error && <InlineAlert tone="error" className="mb-3">{error}</InlineAlert>}

        {!isOfficer && awaitingClarification && (
          <InlineAlert tone="pending" icon="help_center" className="mb-3">
            An officer has asked for more detail. Reply with <strong>Answer clarification</strong> selected.
          </InlineAlert>
        )}

        <div className="flex flex-wrap items-center gap-2 pb-2">
          <label className="text-label-md text-slate-500" htmlFor="msg-kind">
            Message type
          </label>
          <select
            id="msg-kind"
            className="rounded-lg border border-slate-300 px-2 py-1 text-label-md"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            disabled={disabled}
          >
            <option value="message">Message</option>
            {!isOfficer && <option value="clarification_response">Answer clarification</option>}
            {isOfficer && <option value="clarification_request">Request clarification</option>}
            {isOfficer && <option value="system_note">Internal system note</option>}
          </select>
        </div>

        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={isOfficer ? 'Update the passenger or request more detail…' : 'Add your reply…'}
          disabled={disabled || busy}
          maxLength={4000}
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-label-sm text-slate-400">{body.length}/4000</span>
          <button type="submit" className="btn-accent btn-sm" disabled={busy || !body.trim() || disabled}>
            {busy ? <Spinner size={15} className="border-white/40 border-t-white" /> : <Icon name="send" size={16} />}
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

export function AttachmentList({ grievance, attachments = [] }) {
  const [busyId, setBusyId] = useState(null);

  const open = async (a) => {
    setBusyId(a._id);
    try {
      await downloadAttachment(grievance, a._id, a.originalName);
    } catch {
      // Surfaced by the caller's toast in most cases; keep the UI responsive.
    } finally {
      setBusyId(null);
    }
  };

  if (!attachments.length) {
    return (
      <p className="px-5 py-6 text-body-sm text-slate-400">
        No files attached. Evidence is private to the passenger and the handling wing.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {attachments.map((a) => (
        <li key={a._id} className="flex items-center gap-3 px-5 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Icon name={a.mimetype?.startsWith('image/') ? 'image' : 'description'} size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-sm font-medium text-primary">{a.originalName || a.filename}</p>
            <p className="text-label-sm text-slate-400">
              {a.mimetype} · {Math.max(1, Math.round((a.size || 0) / 1024))} KB · {relativeTime(a.uploadedAt)}
            </p>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => open(a)} disabled={busyId === a._id}>
            {busyId === a._id ? <Spinner size={14} /> : <Icon name="visibility" size={15} />} View
          </button>
        </li>
      ))}
    </ul>
  );
}
