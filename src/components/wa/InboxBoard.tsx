import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Search,
  Clock,
  Paperclip,
  Send,
  Lock,
  Loader2,
} from 'lucide-react';
import {
  fetchInbox,
  fetchThread,
  sendText,
  attachmentUrl,
  authorLabel,
  waitLabel,
  type InboxItem,
  type WaMessage,
} from '@/lib/wa-inbox';

/**
 * תיבת השיחות של ר.שעל.
 *
 * ⭐ **מסך הפתיחה הוא "מי מחכה לתשובה", לא רשימת צ'אטים לפי זמן.**
 * רשימה לפי זמן היא מה שוואטסאפ ווב כבר עושה, בחינם ויותר טוב. מה שאין
 * לו מקבילה הוא רשימת הלקוחות שכתבו ולא נענו, לפי כמה זמן הם מחכים.
 *
 * 🔴 **מה שלא נמצא כאן במכוון: שליחת תבנית עם מסמך.** המסמך מופק מתוך
 * הסשן של פריוריטי בדפדפן של העובד, ואי אפשר להפיק אותו מכאן. ניסיון
 * לחקות זאת היה מייצר כפתור שנראה עובד ונכשל, וזה גרוע מכפתור שלא קיים.
 * לכן כאן יש מענה בטקסט חופשי כשהחלון פתוח, וכשהוא סגור המסך אומר
 * במפורש שצריך לעבור לחלונית שבפריוריטי.
 */

const POLL_MS = 30_000;

function timeText(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const yest = new Date(today.getTime() - 86400000);
  if (d.toDateString() === yest.toDateString()) return 'אתמול';
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'היום';
  const yest = new Date(today.getTime() - 86400000);
  if (d.toDateString() === yest.toDateString()) return 'אתמול';
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const STATUS_TEXT: Record<string, string> = {
  pending: 'ממתין',
  sent: 'נשלח',
  delivered: 'נמסר',
  read: 'נקרא',
  failed: 'נכשל',
};

function AttachmentButton({ message }: { message: WaMessage }) {
  const [busy, setBusy] = useState(false);
  const label = message.entity_key ? `${message.entity_key}.pdf` : 'קובץ מצורף';

  async function open() {
    setBusy(true);
    try {
      const url = await attachmentUrl(message.id, 0);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'לא הצלחתי לפתוח את הקובץ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={open}
      disabled={busy}
      className="mt-1.5 flex w-full items-center gap-1.5 rounded-lg border border-slate-900/10 bg-white/70 px-2 py-1 text-xs transition hover:bg-white disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
      <span className="truncate">{label}</span>
    </button>
  );
}

function Bubble({ m }: { m: WaMessage }) {
  const out = m.direction === 'out';
  const atts = Array.isArray(m.attachments) ? m.attachments : [];
  const who = out ? authorLabel(m.author) : '';

  return (
    <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          out ? 'rounded-ee-sm bg-emerald-100' : 'rounded-es-sm bg-white'
        }`}
      >
        {who && <div className="mb-0.5 text-[11px] font-semibold text-emerald-700">{who}</div>}
        <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>
        {atts.length > 0 && <AttachmentButton message={m} />}
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>{timeText(m.sent_at)}</span>
          {out && m.status && <span>· {STATUS_TEXT[m.status] ?? m.status}</span>}
          {m.entity_key && atts.length === 0 && (
            <span className="rounded-full bg-blue-100 px-1.5 text-blue-700">
              על <bdi>{m.entity_key}</bdi>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  item,
  active,
  onClick,
}: {
  item: InboxItem;
  active: boolean;
  onClick: () => void;
}) {
  const waiting = item.waitingMinutes != null;
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border px-3 py-2.5 text-start transition ${
        active
          ? 'border-emerald-300 bg-emerald-50/70'
          : waiting
            ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50'
            : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold text-slate-900">{item.title}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {timeText(item.lastMessageAt)}
        </span>
      </div>
      <div className="truncate text-xs text-muted-foreground">{item.preview || ' '}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {waiting && (
          <Badge variant="outline" className="border-amber-300 bg-amber-100 text-[10px] text-amber-800">
            מחכה {waitLabel(item.waitingMinutes)}
          </Badge>
        )}
        <Badge
          variant="outline"
          className={`text-[10px] ${
            item.window.open
              ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
              : 'border-slate-300 bg-slate-100 text-slate-600'
          }`}
        >
          {item.window.open ? 'חלון פתוח' : 'חלון סגור'}
        </Badge>
        {/* 🔴 "לא מזוהה" נאמר בגלוי. שיחה בלי לקוח בפריוריטי היא בדיוק זו
            שאי אפשר לקשר למסמך, ועדיף לדעת את זה מהרשימה. */}
        {item.unidentified && (
          <Badge variant="outline" className="border-slate-300 text-[10px] text-slate-500">
            לא מזוהה
          </Badge>
        )}
      </div>
    </button>
  );
}


/**
 * לוח השיחות: הרשימה מימין, השרשור משמאל.
 *
 * ⭐ **מודול אחד לשני המקומות.** הדף `/inbox` והחלונית הצפה מרנדרים את
 * אותו רכיב, ולכן אי אפשר שאחד מהם יתקן באג והשני יישאר איתו. זה אותו
 * כלל שכבר עבד כאן: המסך והשולח חולקים מודול אחד.
 */
export interface InboxBoardProps {
  /** גובה הלוח. הדף מקבל את גובה המסך, החלונית את גובה המגירה. */
  heightClass?: string;
}

export const HEIGHT_PAGE = 'lg:h-[calc(100vh-13rem)]';
export const HEIGHT_DOCK = 'h-[calc(100vh-6rem)]';

export function InboxBoard({ heightClass = HEIGHT_PAGE }: InboxBoardProps) {
  const [tab, setTab] = useState<'waiting' | 'all'>('waiting');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const inbox = useQuery({
    queryKey: ['wa-inbox', tab, q],
    queryFn: () => fetchInbox(tab, q),
    refetchInterval: POLL_MS,
  });

  const thread = useQuery({
    queryKey: ['wa-thread', selected],
    queryFn: () => fetchThread(selected as string),
    enabled: Boolean(selected),
    refetchInterval: POLL_MS,
  });

  const items = inbox.data?.items ?? [];
  const counts = inbox.data?.counts ?? { waiting: 0, all: 0 };

  // ⭐ בחירה אוטומטית של הראשון, כדי שהמסך לא ייפתח ריק בצד אחד.
  useEffect(() => {
    if (!selected && items.length) setSelected(items[0].phone);
  }, [items, selected]);

  const current = useMemo(
    () => items.find((i) => i.phone === selected) ?? null,
    [items, selected],
  );

  const messages = thread.data?.messages ?? [];
  const win = thread.data?.window;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, selected]);

  async function reply() {
    const text = draft.trim();
    if (!text || !selected || sending) return;
    setSending(true);
    try {
      await sendText(selected, text);
      setDraft('');
      toast.success('יצא אל heyy. הסטטוס יתעדכן כאן.');
      await qc.invalidateQueries({ queryKey: ['wa-thread', selected] });
      await qc.invalidateQueries({ queryKey: ['wa-inbox'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'השליחה נכשלה');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className={`flex flex-col gap-3 lg:flex-row ${heightClass}`}>
        {/* הרשימה. ב-RTL הילד הראשון יושב בימין. */}
        <div className="flex w-full flex-col gap-2 lg:w-[360px] lg:shrink-0">
          <div className="flex w-fit gap-1 rounded-xl border bg-slate-50 p-1">
            {(['waiting', 'all'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  tab === t ? 'bg-white text-emerald-700 shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {t === 'waiting' ? 'ממתינים' : 'כל השיחות'}
                <span
                  className={`rounded-full px-1.5 text-[11px] ${
                    tab === t ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200'
                  }`}
                >
                  {t === 'waiting' ? counts.waiting : counts.all}
                </span>
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute inset-inline-start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="שם, מספר לקוח, טלפון או תוכן"
              className="ps-8"
            />
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto pe-1">
            {inbox.isLoading && (
              <div className="p-4 text-center text-sm text-muted-foreground">טוען…</div>
            )}
            {!inbox.isLoading && items.length === 0 && (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {tab === 'waiting'
                  ? 'אף לקוח לא מחכה לתשובה.'
                  : q
                    ? 'אין שיחה שמתאימה לחיפוש.'
                    : 'עוד אין שיחות.'}
              </div>
            )}
            {items.map((i) => (
              <Row
                key={i.id}
                item={i}
                active={i.phone === selected}
                onClick={() => setSelected(i.phone)}
              />
            ))}
          </div>
        </div>

        {/* השרשור */}
        <div className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-xl border bg-slate-50">
          {!current && (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              בחר שיחה מהרשימה
            </div>
          )}

          {current && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-4 py-2.5">
                <div>
                  <div className="font-semibold text-slate-900">{current.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {current.customerNumber && (
                      <>
                        לקוח <bdi>{current.customerNumber}</bdi> ·{' '}
                      </>
                    )}
                    <bdi>{current.phone}</bdi>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    win?.open
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-slate-300 bg-slate-100 text-slate-600'
                  }
                >
                  {win?.open ? (
                    <>
                      <Clock className="me-1 h-3 w-3" />
                      אפשר לכתוב חופשי עוד {waitLabel(win.minutesLeft)}
                    </>
                  ) : (
                    <>
                      <Lock className="me-1 h-3 w-3" />
                      חלון סגור
                    </>
                  )}
                </Badge>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
                {thread.isLoading && (
                  <div className="text-center text-sm text-muted-foreground">טוען שיחה…</div>
                )}
                {messages.map((m, idx) => {
                  const prev = messages[idx - 1];
                  const newDay =
                    !prev || new Date(prev.sent_at).toDateString() !== new Date(m.sent_at).toDateString();
                  return (
                    <div key={m.id}>
                      {newDay && (
                        <div className="my-2 text-center text-[11px] text-muted-foreground">
                          {dayLabel(m.sent_at)}
                        </div>
                      )}
                      <Bubble m={m} />
                    </div>
                  );
                })}
                {!thread.isLoading && messages.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground">
                    עוד לא דיברתם איתו בוואטסאפ.
                  </div>
                )}
              </div>

              <div className="border-t bg-white p-3">
                {win?.open ? (
                  <div className="flex items-end gap-2">
                    <Textarea
                      dir="rtl"
                      rows={2}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="כתוב תשובה…"
                      className="resize-none"
                    />
                    <Button onClick={reply} disabled={sending || !draft.trim()}>
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      שלח
                    </Button>
                  </div>
                ) : (
                  /* 🔴 מבוי סתום נאמר עם מוצא. תבנית עם מסמך דורשת את הסשן
                     של פריוריטי, ולכן היא נשלחת מהחלונית ולא מכאן. */
                  <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
                    עברו <bdi>24</bdi> שעות מההודעה האחרונה של הלקוח, ולכן אפשר לשלוח רק תבנית
                    מאושרת. שליחת תבנית עם מסמך נעשית מהחלונית שבתוך הפריוריטי, כי המסמך מופק
                    משם.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
