import { useQuery } from '@tanstack/react-query';
import {
  Truck, Wrench, PackageOpen, FileText, MessageSquare, Star,
  Loader2, AlertTriangle, User, MapPin, Phone,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CustomerPhoneBook } from '@/components/customer/CustomerPhoneBook';
import { LastVisitBadge } from '@/components/customer/LastVisitBadge';
import { Section, MatchTag } from '@/components/customer/CardParts';
import { StockPanel } from '@/components/customer/CustomerStockPanel';
import { CustomerTimeline } from '@/components/customer/CustomerTimeline';
import {
  fetchCustomerCard, customerCardKey,
  type CustomerCardData,
} from '@/lib/customer-card';
import {
  answerLine, mismatchNote, certaintyNote, agoLabel, dayLabel, windowLabel, identityNote,
  type OpenItem,
} from '@/lib/customer-answer';

/**
 * כרטיס הלקוח.
 *
 * ⭐ **רכיב אחד, שלוש נקודות כניסה** (מסך ייעודי · מגירה מכל רשימה ·
 * החלונית שבפריוריטי). זה מה שכבר עבד לנו בתיבת השיחות: אי אפשר שאחד
 * יתקן באג והשני יישאר איתו.
 *
 * 🔴 **המסך קורא בלבד.** אין כאן שום כתיבה, לא לפריוריטי ולא אצלנו.
 */

const money = (n: number | null | undefined) =>
  n == null ? '' : `₪${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

/** שורה אחת של פריט פתוח. */
function OpenRow({ item, icon: Icon }: { item: OpenItem; icon: typeof Truck }) {
  const note = mismatchNote(item);
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        item.scheduled ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/50'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        {item.ref && <bdi className="font-mono text-xs font-semibold text-slate-800">{item.ref}</bdi>}
        <span className="text-xs text-muted-foreground">{item.status}</span>
        {item.archived && (
          <span
            className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
            title="הרשומה אורכבה בניקוי ההיסטוריה, ועדיין יש לה עצירה ביומן"
          >
            מאורכב
          </span>
        )}
        <MatchTag kind={item.match} />
      </div>

      <div className="mt-1 text-[13px]">
        {item.scheduled ? (
          <span className="font-semibold text-emerald-800">
            {dayLabel(item.date)}
            {item.driver ? ` · ${item.driver}` : ''}
            {windowLabel(item.winStart, item.winEnd) ? ` · ${windowLabel(item.winStart, item.winEnd)}` : ''}
          </span>
        ) : (
          <span className="font-semibold text-amber-800">
            לא שובץ · נפתח {agoLabel(item.created)}
          </span>
        )}
      </div>

      {item.device && <div className="text-xs text-muted-foreground">{item.device}{item.fault ? ` · ${item.fault}` : ''}</div>}

      {/* 🔴 הפער בין הסטטוס ליומן נאמר, ולא נבלע. */}
      {note && (
        <div className="mt-1 flex items-start gap-1 text-[11px] text-red-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{note}</span>
        </div>
      )}
    </div>
  );
}

/**
 * 🔴 **המגירה צרה, אבל נקודות השבירה של Tailwind נמדדות מול חלון
 * הדפדפן ולא מול המיכל.** במסך 1284 פיקסלים `lg:` חל גם בתוך מגירה
 * ברוחב 764, ולכן שתי העמודות נדחסו שם. `layout` הוא מה שמכריע, ולא
 * הרוחב שנראה על המסך. [[responsive_breakpoint_silently_reverts_feature]]
 */
export function CustomerCardBody({
  data, layout = 'page', focus,
}: { data: CustomerCardData; layout?: 'page' | 'drawer'; focus?: string | null }) {
  const c = data.customer;
  const orders = data.open?.orders ?? [];
  const calls = data.open?.calls ?? [];
  const pickups = data.open?.pickups ?? [];
  // ⭐ התשובה מכירה גם בציוד, כדי שלא תסתור את הרצועה שמתחתיה.
  const answer = answerLine(orders, calls, undefined, data.stock);
  const certainty = certaintyNote(data.match);
  const identity = identityNote(c);
  // הביקור האחרון שקרה בפועל, מתוך אירועי ה'stop' שכבר יושבים על הציר.
  // ref = הנהג, הכותרת מבדילה בוצע מ'לא בוצע' (כך הפונקציה במסד כותבת).
  const lastVisit = (data.timeline ?? [])
    .filter((e) => e.kind === 'stop' && e.at)
    .reduce<(typeof data.timeline)[number] | null>(
      (best, e) => (best && best.at >= e.at ? best : e),
      null
    );

  return (
    <div className="space-y-3">
      {/* ── מי הלקוח ── */}
      <div className="rounded-xl border bg-white p-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-lg font-extrabold text-slate-900">{c.name || 'לא מזוהה'}</span>
          {c.customerNumber && (
            <span className="font-mono text-xs text-muted-foreground">
              לקוח <bdi>{c.customerNumber}</bdi>
            </span>
          )}
          {c.phone && (
            <a href={`tel:${c.phone}`} className="flex items-center gap-1 font-mono text-xs text-blue-700 hover:underline">
              <Phone className="h-3 w-3" />
              <bdi>{c.phone}</bdi>
            </a>
          )}
        </div>
        {(c.address || c.city) && (
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {[c.address, c.city].filter(Boolean).join(', ')}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.healthFund && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[11px] text-blue-800">{c.healthFund}</Badge>}
          {c.agent && (
            <Badge variant="outline" className="text-[11px]">
              <User className="me-1 h-3 w-3" /> {c.agent}
            </Badge>
          )}
        </div>
        {/* ⭐ ספר הטלפונים עם דלת ידנית (עמי, 06-07/10/2026). הכרטיס נשאר קורא בלבד
            כלפי פריוריטי: מספר שנוסף כאן הוא איש קשר אצלנו, שנכתב לתת-הטופס. */}
        {c.customerNumber && (
          <div className="mt-3 border-t pt-2">
            <div className="mb-1 text-[12.5px] font-bold text-slate-800">טלפונים</div>
            <CustomerPhoneBook customerNumber={c.customerNumber} mainPhone={c.phone} />
          </div>
        )}
      </div>

      {/* ── התשובה ללקוח ── */}
      <div
        className={`rounded-xl border-2 p-3 ${
          answer.tone === 'ok'
            ? 'border-emerald-300 bg-emerald-50/70'
            : answer.tone === 'warn'
              ? 'border-amber-300 bg-amber-50/70'
              : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          התשובה ללקוח
        </div>
        <div className="mt-0.5 text-[15px] font-bold text-slate-900">{answer.text}</div>
        {lastVisit && (
          <LastVisitBadge
            date={lastVisit.at.slice(0, 10)}
            driver={lastVisit.ref}
            outcome={lastVisit.title === 'בוצע בשטח' ? 'completed' : 'not_completed'}
          />
        )}
      </div>

      {/* 🔴 הטלפון שכותב אינו הטלפון שרשום בפריוריטי. נאמר לפני הציוד,
          כי הנציגה עומדת להקריא ללקוח היסטוריה שחוברה אליו לפי שם. */}
      {identity && (
        <div className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>{identity}</span>
        </div>
      )}

      {/* ⭐ מה יש אצל הלקוח, מיד אחרי התשובה ולפני כל השאר. */}
      <StockPanel stock={data.stock} />

      {/* 🔴 כמה מההיסטוריה כאן אינה ודאית. מוצג רק כשזה נכון. */}
      {certainty && (
        <div className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>{certainty} הן מוצגות כאן ומסומנות בנפרד.</span>
        </div>
      )}

      {/* ── פתוחים ── */}
      {(orders.length > 0 || calls.length > 0 || pickups.length > 0) && (
        <div className={`grid gap-2 ${layout === 'page' ? 'md:grid-cols-2' : ''}`}>
          {orders.length > 0 && (
            <Section title="משלוחים פתוחים" icon={Truck} count={orders.length}>
              <div className="space-y-2">{orders.map((o) => <OpenRow key={o.id} item={o} icon={Truck} />)}</div>
            </Section>
          )}
          {calls.length > 0 && (
            <Section title="קריאות שירות פתוחות" icon={Wrench} count={calls.length}>
              <div className="space-y-2">{calls.map((o) => <OpenRow key={o.id} item={o} icon={Wrench} />)}</div>
            </Section>
          )}
          {pickups.length > 0 && (
            <Section title="איסופים פתוחים" icon={PackageOpen} count={pickups.length}>
              <div className="space-y-2">{pickups.map((o) => <OpenRow key={o.id} item={o} icon={PackageOpen} />)}</div>
            </Section>
          )}
        </div>
      )}

      <div className={`grid gap-2 ${layout === 'page' ? 'lg:grid-cols-[1.6fr_1fr]' : ''}`}>
        <CustomerTimeline events={data.timeline ?? []} focus={focus} />

        {/* ── העמודה הצדדית ── */}
        <div className="space-y-2">
          {data.wa && (
            <Section title="וואטסאפ" icon={MessageSquare} count={data.wa.messageCount ?? undefined}>
              <div className="space-y-1.5">
                {(data.wa.messages ?? []).slice(-4).map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-2 py-1 text-[11.5px] ${
                      m.direction === 'out' ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50'
                    }`}
                  >
                    {m.body || <span className="text-muted-foreground">קובץ</span>}
                  </div>
                ))}
                <a
                  href={`/inbox?phone=${encodeURIComponent(data.wa.phone ?? '')}`}
                  className="block pt-1 text-center text-[11px] text-blue-700 hover:underline"
                >
                  פתח את השיחה
                </a>
              </div>
            </Section>
          )}


          {(data.surveys ?? []).length > 0 && (
            <Section title="סקרי שביעות רצון" icon={Star} count={data.surveys.length}>
              <div className="space-y-1.5">
                {data.surveys.map((s, i) => (
                  <div key={i} className="rounded-lg bg-amber-50/60 px-2 py-1.5 text-[11.5px]">
                    <div className="font-semibold text-amber-900">
                      {s.q1 ?? '—'} מתוך 5 · <bdi>{new Date(s.at).toLocaleDateString('he-IL')}</bdi>
                    </div>
                    {s.comment && <div className="text-muted-foreground">"{s.comment}"</div>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {((data.documents?.notes ?? []).length > 0 || (data.documents?.invoices ?? []).length > 0) && (
            <Section title="מסמכים" icon={FileText}>
              <div className="space-y-1">
                {(data.documents?.notes ?? []).slice(0, 6).map((n, i) => (
                  <div key={`n${i}`} className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="flex items-center gap-1.5">
                      <bdi className="font-mono text-blue-700">{n.ref}</bdi>
                      <span className="text-muted-foreground">תעודה</span>
                    </span>
                    <span className="text-muted-foreground">
                      <bdi>{n.date ? new Date(n.date).toLocaleDateString('he-IL') : ''}</bdi>
                    </span>
                  </div>
                ))}
                {(data.documents?.invoices ?? []).slice(0, 6).map((v, i) => (
                  <div key={`i${i}`} className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="flex items-center gap-1.5">
                      <bdi className="font-mono text-blue-700">{v.ref}</bdi>
                      <span className="text-muted-foreground">חשבונית</span>
                    </span>
                    <span className="text-muted-foreground"><bdi>{money(v.total)}</bdi></span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * העטיפה שמושכת את הנתונים.
 *
 * ⭐ נטענת רק כשיש למי לטעון, ולכן פתיחת מגירה היא הדבר שמתחיל את
 * העבודה, לא ציור המסך. [[render_must_not_start_work]]
 */
export function CustomerCard({
  customerNumber, phone, layout = 'page', focus,
}: { customerNumber: string | null; phone: string | null; layout?: 'page' | 'drawer'; focus?: string | null }) {
  const q = useQuery({
    queryKey: customerCardKey(customerNumber, phone),
    queryFn: () => fetchCustomerCard(customerNumber, phone),
    enabled: Boolean(customerNumber || phone),
    staleTime: 30 * 1000,
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> טוען את הכרטיס…
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        לא הצלחתי לטעון את הכרטיס. {q.error instanceof Error ? q.error.message : ''}
      </div>
    );
  }
  if (!q.data || q.data.ok === false) {
    return (
      <div className="rounded-xl border bg-slate-50 p-4 text-sm text-muted-foreground">
        {q.data?.error === 'need customer or phone' ? 'בחר לקוח כדי לראות את הכרטיס.' : 'לא נמצא לקוח.'}
      </div>
    );
  }
  return <CustomerCardBody data={q.data} layout={layout} focus={focus} />;
}
