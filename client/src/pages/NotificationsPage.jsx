import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/AppShell.jsx';
import {
  Card,
  ErrorState,
  EmptyState,
  Icon,
  LoadingBlock,
  Pagination,
  Pill,
  StatCard,
  TabStrip,
  useToast,
} from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatDateTime, relativeTime } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'status', label: 'Status' },
  { value: 'message', label: 'Officer replies' },
  { value: 'clarification', label: 'Clarification' },
  { value: 'escalation', label: 'Escalations' },
];

const TYPE_META = {
  status: { icon: 'published_with_changes', tone: 'ai' },
  message: { icon: 'chat', tone: 'neutral' },
  clarification: { icon: 'help_center', tone: 'pending' },
  assignment: { icon: 'person_add', tone: 'ai' },
  escalation: { icon: 'alt_route', tone: 'urgent' },
  sla: { icon: 'timer_off', tone: 'urgent' },
  system: { icon: 'info', tone: 'neutral' },
};

export default function NotificationsPage() {
  const { role } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, pages: 1 });
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = { page, limit: 15 };
    if (tab === 'unread') params.unread = 'true';
    api
      .listNotifications(params)
      .then((res) => {
        setItems(res.items);
        setPagination({ total: res.total, page: res.page, limit: res.limit, pages: res.pages });
        setUnread(res.unread);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    if (['all', 'unread'].includes(tab)) return items;
    return items.filter((n) => n.type === tab);
  }, [items, tab]);

  const markRead = async (n) => {
    if (n.read) return;
    try {
      await api.markNotificationRead(n._id);
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const markAll = async () => {
    try {
      await api.markAllNotificationsRead();
      toast.success('All notifications marked as read');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const caseLink = (n) => {
    if (!n.grievance) return null;
    return role === 'passenger' ? `/passenger/grievances/${n.grievance}` : `/officer/cases/${n.grievance}`;
  };

  return (
    <>
      <PageHeader
        icon="notifications"
        breadcrumb={['Home', 'Notifications']}
        title="Notifications & activity stream"
        description="Status changes, officer replies, clarification requests, assignments and SLA alerts."
        meta={<Pill tone="ai" icon="sync">Live feed</Pill>}
        actions={
          <button type="button" className="btn-secondary btn-sm" onClick={markAll} disabled={!unread}>
            <Icon name="done_all" size={16} /> Mark all as read
          </button>
        }
      />

      <div className="mx-auto w-full max-w-[1200px] space-y-5 px-gutter py-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total alerts" value={pagination.total} icon="inbox" hint="In this stream" tone="ai" />
          <StatCard label="Unread" value={unread} icon="mark_email_unread" hint="Needs attention" tone={unread ? 'pending' : 'neutral'} />
          <StatCard
            label="Escalations"
            value={items.filter((n) => n.type === 'escalation').length}
            icon="alt_route"
            hint="On this page"
            tone={items.some((n) => n.type === 'escalation') ? 'urgent' : 'neutral'}
          />
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
            <TabStrip tabs={TABS} value={tab} onChange={(v) => { setTab(v); setPage(1); }} />
            <button type="button" className="btn-ghost btn-sm" onClick={load}>
              <Icon name="refresh" size={16} /> Refresh
            </button>
          </div>

          {error ? (
            <ErrorState message={error} onRetry={load} />
          ) : loading ? (
            <LoadingBlock label="Loading notifications…" />
          ) : visible.length === 0 ? (
            <EmptyState
              icon="notifications_off"
              title="No notifications here"
              description="When something changes on your grievances it will appear in this stream."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map((n) => {
                const meta = TYPE_META[n.type] || TYPE_META.system;
                const link = caseLink(n);
                return (
                  <li
                    key={n._id}
                    className={`flex items-start gap-3 px-5 py-4 transition-colors ${n.read ? '' : 'bg-sky-50/50'}`}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <Icon name={meta.icon} size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`text-body-md ${n.read ? 'text-slate-700' : 'font-semibold text-primary'}`}>
                          {n.title}
                        </p>
                        <Pill tone={meta.tone}>{n.type}</Pill>
                        {!n.read && <Pill tone="ai">New</Pill>}
                        {n.referenceId && <span className="font-mono text-label-sm text-slate-400">{n.referenceId}</span>}
                      </div>
                      {n.body && <p className="mt-0.5 text-body-sm text-slate-500">{n.body}</p>}
                      <p className="mt-1 text-label-sm text-slate-400" title={formatDateTime(n.createdAt)}>
                        {relativeTime(n.createdAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {link && (
                          <Link to={link} className="btn-secondary btn-sm" onClick={() => markRead(n)}>
                            <Icon name="open_in_new" size={14} /> Open case
                          </Link>
                        )}
                        {!n.read && (
                          <button type="button" className="btn-ghost btn-sm" onClick={() => markRead(n)}>
                            <Icon name="check" size={14} /> Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Pagination {...pagination} onChange={setPage} />
        </Card>
      </div>
    </>
  );
}
