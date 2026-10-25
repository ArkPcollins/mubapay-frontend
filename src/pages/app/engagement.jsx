import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Flag, Ban } from 'lucide-react';
import { get, post } from '../../lib/api';
import { dateTime, humanize, naira } from '../../lib/format';
import { joinRoom, leaveRoom, getSocket } from '../../lib/socket';
import { Button, EmptyState, ErrorState, Input, KeyValue, Notice, PageHeader, Pagination, Panel, Select, Spinner, Status, Table, Textarea } from '../../components/ui';
import { ConfirmDialog, Dialog } from '../../components/ui/dialog';
import { toast, toastError } from '../../components/ui/toast';
import { StatusTimeline, useFinancialAction } from '../../components/domain';
import { RefundDialog, DisputeDialog } from './commerce';

// ---------------------------------------------------------------- viewings
export function AppointmentsPage({ as = 'customer' }) {
  const q = useQuery({ queryKey: ['appointments', as], queryFn: () => get(`/realestate/appointments?as=${as}`) });
  return (
    <>
      <PageHeader title={as === 'provider' ? 'Viewing requests' : 'My viewings'} description={as === 'customer' ? 'Viewings you’ve requested. Cancel at least 24 hours before for a full refund of any viewing fee.' : undefined} />
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} /> : (
        <Table caption="Viewings" rows={q.data} empty={<EmptyState title="No viewings yet" action={as === 'customer' && <Button to="/real-estate">Find a property</Button>} />} columns={[
          { header: 'Property', render: (a) => <Link className="link" to={`${as === 'provider' ? '/app/provider/appointments' : '/app/appointments'}/${a.id}`}>{a.property?.title}</Link> },
          { header: 'When', render: (a) => (a.scheduledAt ? dateTime(a.scheduledAt) : `Requested: ${a.requestedSlots.map((s) => dateTime(s)).join(' or ')}`) },
          { header: 'Fee', render: (a) => (a.fee.amountKobo ? `${naira(a.fee.amountKobo)} (${humanize(a.fee.status)})` : 'Free') },
          { header: 'Status', render: (a) => <Status value={a.status} /> },
        ]} />
      )}
    </>
  );
}

export function AppointmentDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['appointment', id], queryFn: () => get(`/realestate/appointments/${id}`), refetchInterval: 20000 });
  const [dlg, setDlg] = useState(null);
  const [slots, setSlots] = useState(['']);
  const refresh = () => qc.invalidateQueries({ queryKey: ['appointment', id] });
  const act = useMutation({ mutationFn: ({ path, body }) => post(`/realestate/appointments/${id}/${path}`, body), onSuccess: () => { refresh(); setDlg(null); }, onError: toastError });
  const pay = useFinancialAction((method, key) => post(`/realestate/appointments/${id}/pay`, { method }, { idempotencyKey: key }), { invalidate: [['appointment', id], ['wallet']], onSuccess: (r) => (r.authorizationUrl ? window.location.assign(r.authorizationUrl) : toast({ tone: 'success', title: 'Viewing confirmed' })) });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const a = q.data;
  const isProvider = a.viewerRole === 'provider';
  const past = a.scheduledAt && new Date(a.scheduledAt) < new Date();
  const hoursLeft = a.scheduledAt ? (new Date(a.scheduledAt) - Date.now()) / 3600e3 : null;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`Viewing ${a.reference}`} actions={a.conversationId && <Button variant="secondary" to={`/app/messages/${a.conversationId}`}>Messages</Button>} />
      <Panel>
        <KeyValue items={[['Status', <Status key="s" value={a.status} />], ['Time', a.scheduledAt ? dateTime(a.scheduledAt) : 'Not confirmed yet'], ['Viewing fee', a.fee.amountKobo ? `${naira(a.fee.amountKobo)} (${humanize(a.fee.status)})` : 'None'], a.cancellation?.reason && ['Cancellation', `${a.cancellation.reason} — ${humanize(a.cancellation.policyApplied)}`]]} />
      </Panel>
      {isProvider && a.status === 'requested' && (
        <Panel title="Respond to this request">
          <p className="mb-2 text-sm">Confirm one of the requested times:</p>
          <div className="flex flex-wrap gap-2">{a.requestedSlots.map((s) => <Button key={s} variant="secondary" onClick={() => act.mutate({ path: 'respond', body: { action: 'confirm', slot: s } })}>{dateTime(s)}</Button>)}</div>
          <p className="mb-2 mt-5 text-sm">Or propose other times:</p>
          {slots.map((s, i) => <input key={i} type="datetime-local" aria-label={`Proposed time ${i + 1}`} className="field mb-2" value={s} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? e.target.value : x)))} />)}
          <div className="flex gap-2">
            {slots.length < 3 && <Button variant="ghost" onClick={() => setSlots([...slots, ''])}>Add time</Button>}
            <Button variant="secondary" disabled={!slots.some(Boolean)} onClick={() => act.mutate({ path: 'respond', body: { action: 'propose', slots: slots.filter(Boolean).map((s) => new Date(s).toISOString()) } })}>Propose times</Button>
            <Button variant="ghost" onClick={() => setDlg('decline')}>Decline</Button>
          </div>
        </Panel>
      )}
      {!isProvider && a.status === 'proposed' && (
        <Panel title="The landlord or agent proposed new times">
          <div className="flex flex-wrap gap-2">{a.proposedSlots.map((s) => <Button key={s} variant="secondary" onClick={() => act.mutate({ path: 'accept', body: { slot: s } })}>{dateTime(s)}</Button>)}</div>
        </Panel>
      )}
      {!isProvider && a.status === 'awaiting_payment' && (
        <Panel title={`Pay the viewing fee of ${naira(a.fee.amountKobo)}`}>
          <p className="text-sm text-muted">Your viewing is confirmed once the fee is paid. It’s held by MubaPay and released to the landlord or agent after the viewing. If they cancel or don’t show up, you get it back.</p>
          <div className="mt-3 flex gap-2"><Button loading={pay.isPending} onClick={() => pay.mutate('wallet')}>Pay from wallet</Button><Button variant="secondary" loading={pay.isPending} onClick={() => pay.mutate('paystack')}>Pay with card</Button></div>
        </Panel>
      )}
      {a.status === 'confirmed' && (
        <Panel title="Viewing day">
          <div className="flex flex-wrap gap-2">
            {past && <Button onClick={() => act.mutate({ path: 'attendance' })}>Confirm the viewing happened</Button>}
            {past && <Button variant="secondary" onClick={() => setDlg('noshow')}>Report a no-show</Button>}
            {!past && <Button variant="secondary" onClick={() => setDlg('cancel')}>Cancel viewing</Button>}
          </div>
          {!past && !isProvider && a.fee.status === 'paid' && <p className="mt-2 text-sm text-muted">{hoursLeft >= a.fee.cancellationHours ? `Cancelling now gets you a full refund of ${naira(a.fee.amountKobo)}.` : `It’s less than ${a.fee.cancellationHours} hours before the viewing, so cancelling now is not refunded.`}</p>}
        </Panel>
      )}
      {['requested', 'proposed', 'awaiting_payment'].includes(a.status) && <Button variant="ghost" onClick={() => setDlg('cancel')}>Cancel request</Button>}
      {!isProvider && a.fee.status === 'paid' && ['completed', 'no_show_customer'].includes(a.status) && <Button variant="ghost" onClick={() => setDlg('dispute')}>Open a dispute</Button>}
      <Panel title="History"><StatusTimeline items={a.history} /></Panel>
      <ConfirmDialog open={dlg === 'cancel'} onClose={() => setDlg(null)} danger title="Cancel this viewing?" requireReason confirmLabel="Cancel viewing" loading={act.isPending} onConfirm={(reason) => act.mutate({ path: 'cancel', body: { reason } })} />
      <ConfirmDialog open={dlg === 'decline'} onClose={() => setDlg(null)} danger title="Decline this request?" requireReason confirmLabel="Decline" loading={act.isPending} onConfirm={(reason) => act.mutate({ path: 'respond', body: { action: 'decline', reason } })} />
      <ConfirmDialog open={dlg === 'noshow'} onClose={() => setDlg(null)} title="Report a no-show" body={isProvider ? 'Report that the customer didn’t attend.' : 'Report that the landlord or agent didn’t attend. Any viewing fee will be refunded to your wallet.'} requireReason reasonLabel="What happened?" loading={act.isPending} onConfirm={(note) => act.mutate({ path: 'no-show', body: { note } })} />
      <DisputeDialog open={dlg === 'dispute'} onClose={() => setDlg(null)} subjectType="appointment" subjectId={a.id} />
      <RefundDialog open={false} onClose={() => {}} />
    </div>
  );
}

// ---------------------------------------------------------------- messages
export function MessagesPage() {
  const q = useQuery({ queryKey: ['conversations'], queryFn: () => get('/messages'), refetchInterval: 30000 });
  return (
    <>
      <PageHeader title="Messages" description="Conversations about properties, viewings and orders. Contact details stay hidden until a viewing is confirmed." />
      {q.isLoading ? <Spinner /> : q.data?.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {q.data.map((c) => (
            <li key={c.id}><Link to={`/app/messages/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ink/5">
              <span><span className={c.unread ? 'font-bold' : 'font-medium'}>{c.with.map((w) => w.displayName).join(', ')}</span><span className="block text-sm text-muted">{c.subject || humanize(c.contextType)}</span></span>
              <span className="text-right text-xs text-muted">{dateTime(c.lastMessageAt)}{c.unread ? <span className="mt-1 block rounded-full bg-palm px-2 text-palm-ink">{c.unread} new</span> : null}</span>
            </Link></li>
          ))}
        </ul>
      ) : <EmptyState title="No conversations yet" body="Ask a question on any property listing to start one." />}
    </>
  );
}

export function ConversationPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['conversation', id], queryFn: () => get(`/messages/${id}`), refetchInterval: 15000 });
  const [text, setText] = useState('');
  const [dlg, setDlg] = useState(null);
  const endRef = useRef(null);
  useEffect(() => {
    joinRoom(`conversation:${id}`);
    return () => leaveRoom(`conversation:${id}`);
  }, [id]);
  useEffect(() => endRef.current?.scrollIntoView({ block: 'end' }), [q.data?.messages?.length]);
  const send = useMutation({ mutationFn: () => post(`/messages/${id}/messages`, { body: text }), onSuccess: (m) => { setText(''); if (m.notice) toast({ title: 'Contact details hidden', body: m.notice }); qc.invalidateQueries({ queryKey: ['conversation', id] }); }, onError: toastError });
  const other = q.data?.messages?.find((m) => !m.mine)?.senderId;
  const report = useMutation({ mutationFn: (details) => post('/messages/report', { targetUserId: other, conversationId: id, reason: 'harassment', details }), onSuccess: () => { setDlg(null); toast({ tone: 'success', title: 'Report sent to our team' }); }, onError: toastError });
  const block = useMutation({ mutationFn: () => post('/messages/block', { targetUserId: other, block: true }), onSuccess: () => { setDlg(null); toast({ title: 'User blocked', body: 'They can no longer message you.' }); }, onError: toastError });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const { conversation, messages } = q.data;
  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <PageHeader title={conversation.subject || 'Conversation'} actions={other && <><Button variant="ghost" size="sm" onClick={() => setDlg('report')}><Flag className="h-4 w-4" aria-hidden /> Report</Button><Button variant="ghost" size="sm" onClick={() => setDlg('block')}><Ban className="h-4 w-4" aria-hidden /> Block</Button></>} />
      <Notice tone="warn">Keep payments on MubaPay. Never send rent, deposits or fees through a link or account number shared in chat.</Notice>
      <ol className="mt-4 flex flex-col gap-2" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.mine ? 'self-end bg-palm text-palm-ink' : 'self-start border border-line bg-surface'}`}>
            <p className="whitespace-pre-line">{m.hidden ? 'This message was hidden by a moderator.' : m.body}</p>
            <p className={`mt-1 text-xs ${m.mine ? 'opacity-80' : 'text-muted'}`}>{dateTime(m.createdAt)}</p>
          </li>
        ))}
        <li ref={endRef} />
      </ol>
      {conversation.status === 'open' ? (
        <form className="sticky bottom-0 mt-4 flex gap-2 bg-paper py-3" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send.mutate(); }}>
          <label htmlFor="msg" className="sr-only">Message</label>
          <textarea id="msg" className="field" rows={1} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) send.mutate(); } }} />
          <Button type="submit" loading={send.isPending} aria-label="Send"><Send className="h-4 w-4" /></Button>
        </form>
      ) : <Notice>This conversation is closed.</Notice>}
      <ConfirmDialog open={dlg === 'report'} onClose={() => setDlg(null)} title="Report this person" requireReason reasonLabel="What happened?" confirmLabel="Send report" loading={report.isPending} onConfirm={(r) => report.mutate(r)} />
      <ConfirmDialog open={dlg === 'block'} onClose={() => setDlg(null)} danger title="Block this person?" body="They won’t be able to message you or send you money." confirmLabel="Block" loading={block.isPending} onConfirm={() => block.mutate()} />
    </div>
  );
}

// ---------------------------------------------------------------- notifications
export function NotificationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['notifications', page], queryFn: () => get(`/notifications?page=${page}`) });
  const read = useMutation({ mutationFn: (ids) => post('/notifications/read', { ids }), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const nav = useNavigate();
  return (
    <>
      <PageHeader title="Notifications" actions={<Button variant="secondary" onClick={() => read.mutate('all')}>Mark all as read</Button>} />
      {q.isLoading ? <Spinner /> : q.data?.data?.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {q.data.data.map((n) => (
            <li key={n._id}>
              <button className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-ink/5" onClick={() => { if (!n.readAt) read.mutate([n._id]); if (n.link) nav(n.link); }}>
                <span aria-hidden className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-palm'}`} />
                <span className="flex-1"><span className={n.readAt ? '' : 'font-semibold'}>{n.title}</span>{!n.readAt && <span className="sr-only"> (unread)</span>}{n.body && <span className="block text-sm text-muted">{n.body}</span>}<span className="block text-xs text-muted">{dateTime(n.createdAt)}</span></span>
              </button>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="No notifications" />}
      <Pagination meta={q.data?.meta} onPage={setPage} />
    </>
  );
}

// ---------------------------------------------------------------- support
const CATS = [['financial', 'Money, payments or withdrawals'], ['security', 'Account security'], ['dispute', 'A dispute'], ['order', 'An order'], ['delivery', 'A delivery'], ['property', 'A property or viewing'], ['account', 'My account or verification'], ['general', 'Something else']];

export function SupportPage() {
  const q = useQuery({ queryKey: ['tickets'], queryFn: () => get('/support/tickets') });
  const ch = useQuery({ queryKey: ['support-channels'], queryFn: () => get('/support/channels') });
  const nav = useNavigate();
  const chat = useMutation({ mutationFn: () => post('/support/live-chat', {}), onSuccess: (t) => nav(`/app/support/${t.id}`), onError: toastError });
  return (
    <>
      <PageHeader title="Support" description="Money and security problems are handled first." actions={<><Button to="/app/support/new">New request</Button><Button variant="secondary" loading={chat.isPending} onClick={() => chat.mutate()}>Chat with us</Button></>} />
      {ch.data && <p className="mb-4 text-sm text-muted">You can also email {ch.data.email.address}{ch.data.whatsapp.available ? ' or message us on WhatsApp' : ''}.</p>}
      {q.isLoading ? <Spinner /> : <Table caption="Support requests" rows={q.data || []} empty={<EmptyState title="No support requests" />} columns={[
        { header: 'Request', render: (t) => <Link className="link" to={`/app/support/${t.id}`}>{t.subject}</Link> },
        { header: 'Reference', key: 'reference' },
        { header: 'Updated', render: (t) => dateTime(t.updatedAt) },
        { header: 'Status', render: (t) => <Status value={t.status} /> },
      ]} />}
    </>
  );
}

export function SupportNewPage() {
  const nav = useNavigate();
  const [f, setF] = useState({ category: 'general', subject: '', body: '' });
  const m = useMutation({ mutationFn: () => post('/support/tickets', f), onSuccess: (t) => nav(`/app/support/${t.id}`), onError: toastError });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New support request" />
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <Select label="What’s it about?" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={CATS.map(([value, label]) => ({ value, label }))} />
        <Input label="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} required />
        <Textarea label="Tell us what happened" rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} required hint="Include any transaction or order reference. Never share your password or one-time codes." />
        <Button type="submit" loading={m.isPending}>Send request</Button>
      </form>
    </div>
  );
}

export function TicketPage({ staff = false }) {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['ticket', id], queryFn: () => get(`/support/tickets/${id}`), refetchInterval: 20000 });
  const [text, setText] = useState('');
  useEffect(() => {
    joinRoom(`ticket:${id}`);
    const s = getSocket();
    const h = () => qc.invalidateQueries({ queryKey: ['ticket', id] });
    s?.on('ticket:message', h);
    return () => {
      s?.off('ticket:message', h);
      leaveRoom(`ticket:${id}`);
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = useMutation({ mutationFn: () => post(`/support/tickets/${id}/messages`, { body: text }), onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['ticket', id] }); }, onError: toastError });
  const status = useMutation({ mutationFn: (s) => post(`/support/tickets/${id}/status`, { status: s }), onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', id] }), onError: toastError });
  const rate = useMutation({ mutationFn: (score) => post(`/support/tickets/${id}/rating`, { score }), onSuccess: () => toast({ tone: 'success', title: 'Thanks for your feedback' }) });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const t = q.data;
  const closed = ['resolved', 'closed'].includes(t.status);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.subject} description={`${t.reference}, ${humanize(t.category)}, via ${humanize(t.channel)}`} actions={!closed ? <Button variant="secondary" onClick={() => status.mutate('resolved')}>{staff ? 'Mark resolved' : 'My issue is solved'}</Button> : null} />
      <Status value={t.status} />
      {staff && t.contact && <p className="mt-2 text-sm text-muted">Contact: {t.contact.email || t.contact.phone || '—'}</p>}
      <ol className="mt-4 space-y-3" aria-live="polite">
        {t.messages.map((m, i) => (
          <li key={i} className={`rounded-xl border p-3 ${m.authorType === 'system' ? 'border-dashed border-line text-sm text-muted' : m.authorType === 'staff' ? 'border-palm/40 bg-palm-soft/50' : 'border-line bg-surface'}`}>
            <p className="text-xs font-semibold text-muted">{m.authorType === 'staff' ? 'MubaPay support' : m.authorType === 'customer' ? (staff ? 'Customer' : 'You') : 'Update'}, {dateTime(m.at)}{m.delivery?.status && staff ? ` — delivery: ${m.delivery.status}${m.delivery.error ? ` (${m.delivery.error})` : ''}` : ''}</p>
            <p className="mt-1 whitespace-pre-line">{m.body}</p>
          </li>
        ))}
      </ol>
      {!closed ? (
        <form className="mt-4" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
          <Textarea label={staff ? 'Reply to customer' : 'Your message'} value={text} onChange={(e) => setText(e.target.value)} />
          <Button className="mt-2" type="submit" loading={send.isPending} disabled={!text.trim()}>Send</Button>
        </form>
      ) : !staff && !t.satisfaction?.score && (
        <Panel title="How did we do?" className="mt-6"><div className="flex gap-2">{[1, 2, 3, 4, 5].map((n) => <Button key={n} variant="secondary" size="sm" onClick={() => rate.mutate(n)} aria-label={`${n} out of 5`}>{n}</Button>)}</div></Panel>
      )}
    </div>
  );
}

export { Dialog };
