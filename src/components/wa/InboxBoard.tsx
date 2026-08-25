import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { TemplateSendDialog } from '@/components/wa/TemplateSendDialog';
import { CustomerCardButton } from '@/components/customer/CustomerCardSheet';
import { searchCustomers, customerSearchKey } from '@/lib/customer-card';
import { surveyMark, SURVEY_TONE } from '@/lib/survey-badge';
import {
  Search,
  Clock,
  Paperclip,
  Send,
  Lock,
  Loader2,
  FileText,
  Image as ImageIcon,
  Film,
  Mic,
  Link2,
  Copy,
  Check,
  PhoneOff,
} from 'lucide-react';
import {
  fetchInbox,
  fetchThread,
  sendText,
  markThreadRead,
  attachmentUrl,
  authorLabel,
  waitLabel,
  type InboxItem,
  type WaMessage,
  type WaAttachment,
  type WaButton,
} from '@/lib/wa-inbox';
import {
  inboxKey,
  threadKey,
  WA_INBOX_KEY,
  WA_INBOX_POLL_MS,
  WA_THREAD_POLL_MS,
  WA_LIST_FOCUS_STALE_MS,
} from '@/lib/wa-inbox-query';

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

/**
 * ⭐ **הכתובת החתומה נשמרת במטמון של react-query ולא נמשכת בכל ציור.**
 * השרשור מתרענן כל כמה שניות, ובלי מטמון כל רענון היה מבקש חתימה חדשה
 * לכל תמונה, והתמונה הייתה מהבהבת. החתימה חיה חמש דקות, ולכן היא נחשבת
 * טרייה ארבע: העדכון תמיד מקדים את הפקיעה.
 */
const MEDIA_STALE_MS = 4 * 60 * 1000;

function useAttachmentUrl(messageId: string, index: number, enabled: boolean) {
  return useQuery({
    queryKey: ['wa-media', messageId, index],
    queryFn: () => attachmentUrl(messageId, index),
    enabled,
    staleTime: MEDIA_STALE_MS,
    gcTime: MEDIA_STALE_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

const KIND_ICON = {
  pdf: FileText,
  image: ImageIcon,
  video: Film,
  audio: Mic,
  file: Paperclip,
} as const;

function AttachmentPill({ messageId, att }: { messageId: string; att: WaAttachment }) {
  const [busy, setBusy] = useState(false);
  const Icon = KIND_ICON[att.kind] ?? Paperclip;

  async function open() {
    setBusy(true);
    try {
      const url = await attachmentUrl(messageId, att.index);
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
      title={att.ready ? 'פתח את הקובץ' : 'הקובץ לא הועתק אלינו'}
      className={`mt-1.5 flex w-full items-center gap-1.5 rounded-lg border border-slate-900/10 px-2 py-1 text-xs transition hover:bg-white disabled:opacity-60 ${
        att.ready ? 'bg-white/70' : 'bg-white/40 text-muted-foreground'
      }`}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3 shrink-0" />}
      <bdi className="truncate">{att.name}</bdi>
    </button>
  );
}

/**
 * תמונה מוצגת קטנה בתוך הבועה, ולא כשורת אטב.
 *
 * 🔴 **"קובץ מצורף" על תמונה הוא מסך שמסתיר את מה שהלקוח שלח.** לקוח
 * ששולח צילום של תקלה, של מד מונה או של חתימה מצפה שיראו אותו, ולחיצה
 * שפותחת לשונית חדשה בשביל כל תמונה היא מס על כל שיחה.
 *
 * ⭐ ואם החתימה נכשלה או שהתמונה לא נטענה, יורדים חזרה לשורת האטב.
 * ריבוע שבור הוא בדיוק סוג הכשל השקט שמלמד לא לסמוך על המסך.
 */
function ImageThumb({ messageId, att }: { messageId: string; att: WaAttachment }) {
  const [broken, setBroken] = useState(false);
  const { data: url, isError } = useAttachmentUrl(messageId, att.index, !broken);

  if (isError || broken) return <AttachmentPill messageId={messageId} att={att} />;
  if (!url) return <div className="mt-1.5 h-28 w-40 animate-pulse rounded-lg bg-slate-900/5" />;

  return (
    <button
      onClick={() => window.open(url, '_blank', 'noopener')}
      title="פתח בגודל מלא"
      className="mt-1.5 block overflow-hidden rounded-lg border border-slate-900/10 transition hover:opacity-90"
    >
      <img
        src={url}
        alt={att.name}
        loading="lazy"
        onError={() => setBroken(true)}
        className="max-h-56 w-auto max-w-full object-contain"
      />
    </button>
  );
}

/**
 * הקישור שהלקוח קיבל, מוצג ולא לחיץ.
 *
 * 🔴🔴 **ובכוונה לא לחיץ.** קישור הסקר נושא טוקן אישי, ו-`GET /api/survey`
 * חותם `opened_at` בפעם הראשונה שהוא נפתח. מנהל שלוחץ מכאן כדי "לראות
 * מה הלקוח קיבל" היה מסמן שהלקוח פתח את הסקר, והופך את המדד היחיד
 * שאומר אם הוא בכלל נגע בו לשקר. [[render_is_not_a_user_event]]
 *
 * ⭐ לכן יש העתקה במקום פתיחה: מי שבאמת רוצה לפתוח יעשה זאת במודע.
 */
function ButtonLink({ b }: { b: WaButton }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!b.url) return;
    try {
      await navigator.clipboard.writeText(b.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('לא הצלחתי להעתיק');
    }
  }

  return (
    <div className="mt-1.5 rounded-lg border border-slate-900/10 bg-white/70 px-2 py-1.5 text-xs">
      <div className="flex items-center gap-1.5 font-medium text-slate-700">
        <Link2 className="h-3 w-3 shrink-0" />
        <span className="truncate">{b.text}</span>
      </div>
      {b.url && (
        <div className="mt-1 flex items-center gap-1.5">
          <bdi
            dir="ltr"
            className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground"
            title={b.url}
          >
            {b.url}
          </bdi>
          <button
            onClick={copy}
            title="העתק · פתיחה מכאן הייתה מסמנת שהלקוח פתח את הסקר"
            className="shrink-0 rounded p-0.5 text-muted-foreground transition hover:bg-slate-900/5 hover:text-slate-700"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      )}
    </div>
  );
}

function Bubble({ m }: { m: WaMessage }) {
  const out = m.direction === 'out';
  const atts = Array.isArray(m.attachments) ? m.attachments : [];
  const btns = Array.isArray(m.buttons) ? m.buttons : [];
  const who = out ? authorLabel(m.author) : '';

  return (
    <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          out ? 'rounded-ee-sm bg-emerald-100' : 'rounded-es-sm bg-white'
        }`}
      >
        {who && <div className="mb-0.5 text-[11px] font-semibold text-emerald-700">{who}</div>}
        {m.body && <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>}
        {atts.map((a) =>
          a.kind === 'image' && a.ready ? (
            <ImageThumb key={a.index} messageId={m.id} att={a} />
          ) : (
            <AttachmentPill key={a.index} messageId={m.id} att={a} />
          ),
        )}
        {btns.map((b) => (
          <ButtonLink key={b.index} b={b} />
        ))}
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

/**
 * החיווי שהלקוח ענה על הסקר.
 *
 * 🔴 **לא סמיילי אחיד.** 20 מתוך 23 התשובות הראשונות היו 5, ואחת הייתה
 * 2. סימן זהה לכולם היה קובר בדיוק את זו שצריך לטפל בה.
 * ההכרעה ב-`src/lib/survey-badge.ts`, בלי ייבוא ולכן נבדקת ביחידה.
 */
function SurveyPill({ survey }: { survey?: InboxItem['survey'] }) {
  const mark = surveyMark(survey);
  if (!mark) return null;
  return (
    <span
      title={mark.title}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-md border px-1 py-px text-[10px] font-semibold leading-none ${SURVEY_TONE[mark.tone]}`}
    >
      <span aria-hidden>{mark.emoji}</span>
      {mark.label}
      <span className="sr-only">{mark.title}</span>
    </span>
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
        <span className="flex min-w-0 items-baseline gap-1">
          <span className="truncate text-sm font-semibold text-slate-900">{item.title}</span>
          {/*
            ⭐ **החיווי צמוד לשם ולא בשורת התגיות.** מי שסורק את הרשימה
            סורק שמות, ותג בשורה השלישית נבלע. והציון עצמו מוצג, כי
            "ענה" בלי הציון מחזיר אותנו לשאלה שבגללה נכנסים.
          */}
          <SurveyPill survey={item.survey} />
        </span>
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
  const [templateOpen, setTemplateOpen] = useState(false);
  // 🔴 מתג חד-פעמי. בלעדיו כל רענון של הרשימה היה מחזיר את הלשונית
  // ל"כל השיחות" גם אחרי שהעובד בחר במפורש "ממתינים", וזה נקרא כמו מסך
  // שנלחם בך. מעבר אוטומטי הוא עזרה בפתיחה, לא כלל שרץ כל הזמן.
  const autoSwitched = useRef(false);
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 🔴 **אותו מפתח בדיוק שהכפתור הצף משתמש בו.** קודם היו שני מפתחות
  // לאותם נתונים, ולכן יצאו שתי בקשות זהות לשרת על כל סבב.
  const inbox = useQuery({
    queryKey: inboxKey(tab, q),
    queryFn: () => fetchInbox(tab, q),
    refetchInterval: WA_INBOX_POLL_MS,
    // ⭐ ראה את ההערה על השרשור. הרשימה מתרעננת גם היא בחזרה לחלון,
    // אבל רק אם עברה חצי דקה, כי סדר השורות משתנה לאט.
    refetchOnWindowFocus: true,
    staleTime: WA_LIST_FOCUS_STALE_MS,
  });

  /**
   * ⭐⭐ **לקוחות שעדיין לא דיברנו איתם.**
   *
   * עידן, 25/08/2026: "ומה לגבי לקוחות שעדיין לא נשלחה להם הודעה?"
   * הוא חיפש "שלומי" וקיבל "אין שיחה שמתאימה לחיפוש".
   *
   * 🔴 **והוא חשב שצריך למשוך נתונים, אבל הם כבר כאן.** התיבה מחפשת
   * בתוך 42 השיחות בלבד, בזמן ש-`customer_search` מכירה **25,772
   * לקוחות**. זו הייתה שאלה על נתונים, והתשובה הייתה מסך.
   *
   * 🔴 **חיפוש קצר מדי לא נשלח:** אות אחת מחזירה מאות שורות ומייצרת
   * בקשה על כל הקלדה.
   */
  const people = useQuery({
    queryKey: customerSearchKey(q),
    queryFn: () => searchCustomers(q),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
  });

  // ⭐⭐ **השרשור מרוענן מהר, וברגע שחוזרים לחלון הוא נשאל מיד.**
  //
  // 🔴 נתפס אצל עידן 24/08/2026: הוא שלח הודעה מהטלפון, חזר לדשבורד,
  // ונאלץ לרענן את הדף ביד. בחלונית שבתוך פריוריטי זה הופיע לבד, ולכן
  // זה נראה כאילו הדשבורד שבור.
  //
  // השורש לא היה הקצב אלא `refetchOnWindowFocus: false` שמוגדר גלובלית
  // ב-`App.tsx`. ההגדרה הזאת נכונה לכל שאר המסכים, ושגויה בדיוק במסך
  // אחד: זה שבו אדם יושב ומחכה לתשובה של לקוח.
  //
  // 🔴 **ו-`staleTime: 0` הוא חלק מהתיקון ולא קישוט.** `refetchOnWindowFocus`
  // מרענן רק שאילתה **מיושנת**, ו-`staleTime` הגלובלי הוא דקה. בלי
  // האיפוס, חזרה לחלון בתוך אותה דקה לא הייתה עושה כלום, וזה בדיוק
  // המקרה של מי שקופץ לטלפון ובחזרה.
  //
  // ⭐ והמחיר זול: רענון בחזרה לחלון קורה רק כשאדם באמת מסתכל, ולכן הוא
  // חסום על ידי התנהגות אנושית ולא על ידי טיימר. זה גם למה לא קיצרתי
  // את הקצב עצמו, שנקבע אחרי שהחשבון נאכל ב-348 קריאות בשעה.
  const thread = useQuery({
    queryKey: threadKey(selected),
    queryFn: () => fetchThread(selected as string),
    enabled: Boolean(selected),
    refetchInterval: WA_THREAD_POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  /**
   * פנייה יזומה ללקוח שאין לו שיחה בכלל.
   *
   * ⭐ **אותו דיאלוג תבניות בדיוק**, רק על טלפון אחר. עידן, 25/08/2026:
   * "איך אני מוציא שיחה?" עד עכשיו התשובה הייתה שאי אפשר מכאן, כי
   * "שלח תבנית" יושב בתוך שרשור קיים, כלומר רק אחרי שהלקוח כתב לנו.
   *
   * 🔴 **המפתח הוא `threadKey` ולא מפתח משלו**, ולכן מה שנטען כאן משרת
   * גם את פתיחת השיחה מיד אחרי השליחה, בלי משיכה שנייה.
   */
  const [outreach, setOutreach] = useState<{ phone: string; name: string } | null>(null);
  const outreachThread = useQuery({
    queryKey: threadKey(outreach?.phone ?? null),
    queryFn: () => fetchThread(outreach!.phone),
    enabled: Boolean(outreach?.phone),
    staleTime: 0,
  });

  // ⭐ ממומו, אחרת `??` מייצר מערך חדש בכל ציור ומריץ מחדש כל תלות בו.
  const items = useMemo(() => inbox.data?.items ?? [], [inbox.data]);

  // 🔴 **לקוח שכבר מופיע כשיחה לא מוצג פעמיים.** הרשימה השנייה נועדה
  // להשלים את הראשונה, לא לשכפל אותה.
  const otherPeople = useMemo(() => {
    const seen = new Set(items.map((i) => i.phone).filter(Boolean));
    return (people.data ?? []).filter((c) => !c.phone_local || !seen.has(c.phone_local));
  }, [people.data, items]);
  const counts = inbox.data?.counts ?? { waiting: 0, all: 0 };

  // ⭐ **אם אין מי שמחכה, אין טעם להציג לשונית ריקה.** נפתחים על כל
  // השיחות, פעם אחת, ורק כשהתשובה מהשרת כבר הגיעה.
  useEffect(() => {
    if (autoSwitched.current || inbox.isLoading || !inbox.data) return;
    autoSwitched.current = true;
    if (inbox.data.counts.waiting === 0 && tab === 'waiting') setTab('all');
  }, [inbox.isLoading, inbox.data, tab]);

  // ⭐ בחירה אוטומטית של הראשון, כדי שהמסך לא ייפתח ריק בצד אחד.
  useEffect(() => {
    if (!selected && items.length) setSelected(items[0].phone);
  }, [items, selected]);

  /**
   * פתיחת שיחה בלחיצה, ולא בחירה אוטומטית.
   *
   * 🔴 **הסימון תלוי כאן ולא ב-`selected`.** השורה הראשונה נבחרת לבד
   * כשהמסך נפתח, ובחירה כזאת אינה קריאה. סימון על כל `selected` היה
   * מוריד מרשימת הממתינים בדיוק את השיחה הוותיקה ביותר, בכל פתיחה של
   * המסך, בלי שאיש הסתכל עליה.
   */
  const openConversation = (phone: string | null) => {
    setSelected(phone);
    if (!phone) return;
    void markThreadRead(phone).then(() => {
      // ⭐ הרשימה נשאלת מחדש כדי שהתג הכתום והמונה ירדו מיד.
      void qc.invalidateQueries({ queryKey: [WA_INBOX_KEY] });
    });
  };

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
      await qc.invalidateQueries({ queryKey: threadKey(selected) });
      await qc.invalidateQueries({ queryKey: [WA_INBOX_KEY] });
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
                onClick={() => openConversation(i.phone)}
              />
            ))}

            {/* ⭐ לקוחות שאין איתם שיחה. מה שהופך את החיפוש מחיפוש
                בתיבה לחיפוש בכל בסיס הלקוחות. */}
            {q.trim().length >= 2 && otherPeople.length > 0 && (
              <div className="pt-2">
                <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  לקוחות בלי שיחה ({otherPeople.length})
                </div>
                <div className="space-y-1">
                  {otherPeople.map((c) => (
                    <div
                      key={`${c.customer_number ?? ''}-${c.phone_local ?? ''}`}
                      className="flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-slate-900">
                          {c.customer_name || 'לקוח'}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {c.customer_number && <>לקוח <bdi>{c.customer_number}</bdi></>}
                          {c.phone_local && <> · <bdi>{c.phone_local}</bdi></>}
                          {c.city && <> · {c.city}</>}
                        </div>
                        {/*
                          🔴 **"אין טלפון" נאמר, ולא מוסק מהיעדר כפתור.**
                          נמדד 25/08/2026: 1,897 מתוך 42,757 הלקוחות (4.4%)
                          בלי שום מספר בהזמנות, בקריאות ובאיסופים. שורה
                          שנראית כמו כל השאר ופשוט אין בה כפתור נקראת
                          כתקלה במסך. [[empty_state_must_speak]]
                        */}
                        {!c.phone_local && (
                          <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-800">
                            <PhoneOff className="h-3 w-3" />
                            אין מספר טלפון, אי אפשר לשלוח
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {c.phone_local && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-[11px]"
                            onClick={() =>
                              setOutreach({
                                phone: c.phone_local as string,
                                name: c.customer_name || '',
                              })
                            }
                          >
                            <Send className="h-3 w-3" />
                            שלח תבנית
                          </Button>
                        )}
                        <CustomerCardButton
                          customerNumber={c.customer_number}
                          phone={c.phone_local}
                          name={c.customer_name}
                          compact
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                  <div className="flex items-center gap-1 font-semibold text-slate-900">
                    {current.title}
                    {/* ⭐ מי כתב, ומה פתוח אצלו. אותו כרטיס בדיוק שבמסך הייעודי. */}
                    <CustomerCardButton
                      customerNumber={current.customerNumber}
                      phone={current.phone}
                      name={current.title}
                    />
                  </div>
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
                    <Button
                      variant="outline"
                      onClick={() => setTemplateOpen(true)}
                      title="שליחת תבנית מאושרת"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
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
                  /* 🔴 **מבוי סתום נאמר עם מוצא, ועכשיו גם עם כפתור.** עד
                     23/08/2026 הפסקה הזאת אמרה "אפשר לשלוח רק תבנית מאושרת"
                     ולא נתנה דרך לשלוח אותה. רק תבנית שדורשת מסמך חדש בכל
                     הודעה זקוקה לסשן של פריוריטי; השאר נשלחות מכאן. */
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-100 px-3 py-2">
                    <span className="text-xs text-slate-600">
                      עברו <bdi>24</bdi> שעות מההודעה האחרונה של הלקוח, ולכן אפשר לשלוח רק תבנית
                      מאושרת. שליחת תעודה או חשבונית נעשית מהחלונית שבתוך הפריוריטי, כי המסמך
                      מופק משם.
                    </span>
                    <Button size="sm" onClick={() => setTemplateOpen(true)}>
                      <FileText className="me-1 h-4 w-4" />
                      שלח תבנית
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <TemplateSendDialog
        templates={thread.data?.templates}
        loading={thread.isLoading}
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        phone={selected}
        customerName={current?.title}
        onSent={() => {
          void qc.invalidateQueries({ queryKey: threadKey(selected) });
          void qc.invalidateQueries({ queryKey: [WA_INBOX_KEY] });
        }}
      />

      {/*
        פנייה יזומה ללקוח בלי שיחה.
        ⭐ **אחרי השליחה נפתחת השיחה שלו**, אחרת ההודעה נעלמת מהעין: שיחה
        שנפתחה מהודעה יוצאת נשארת סגורה אצל heyy ואינה קופצת לראש הרשימה.
        [[heyy_outbound_chat_stays_closed]]
      */}
      <TemplateSendDialog
        templates={outreachThread.data?.templates}
        loading={outreachThread.isLoading}
        open={Boolean(outreach)}
        onOpenChange={(v) => { if (!v) setOutreach(null); }}
        phone={outreach?.phone ?? null}
        customerName={outreach?.name || undefined}
        onSent={() => {
          const phone = outreach?.phone ?? null;
          void qc.invalidateQueries({ queryKey: [WA_INBOX_KEY] });
          if (phone) {
            void qc.invalidateQueries({ queryKey: threadKey(phone) });
            setTab('all');
            setSelected(phone);
          }
        }}
      />
    </>
  );
}
