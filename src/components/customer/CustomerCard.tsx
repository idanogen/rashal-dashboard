import { useQuery } from '@tanstack/react-query';
import {
  Truck, Wrench, PackageOpen, FileText, MessageSquare, Star, Boxes,
  Loader2, AlertTriangle, Clock, User, MapPin, Phone,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  fetchCustomerCard, customerCardKey,
  type CustomerCardData, type TimelineEvent,
} from '@/lib/customer-card';
import {
  answerLine, mismatchNote, matchLabel, certaintyNote, agoLabel, dayLabel, windowLabel,
  stockLine, warrantyState, itemTitle, itemSubtitle, sourceLabels, identityNote,
  type OpenItem, type StockItem, type CustomerStock,
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

const KIND_ICON: Record<TimelineEvent['kind'], typeof Truck> = {
  order: Truck,
  call: Wrench,
  pickup: PackageOpen,
  stop: MapPin,
  note: FileText,
  survey: Star,
  wa: MessageSquare,
};

const KIND_COLOR: Record<TimelineEvent['kind'], string> = {
  order: 'bg-blue-500',
  call: 'bg-orange-500',
  pickup: 'bg-teal-500',
  stop: 'bg-emerald-600',
  note: 'bg-slate-400',
  survey: 'bg-amber-500',
  wa: 'bg-violet-500',
};

function MatchTag({ kind }: { kind: OpenItem['match'] }) {
  const label = matchLabel(kind);
  if (!label) return null;
  return (
    <span
      className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
      title="הרשומה חוברה ללקוח בלי מספר לקוח, ולכן זו התאמה ולא ודאות"
    >
      {label}
    </span>
  );
}

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
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500" title="הרשומה אורכבה בניקוי ההיסטוריה, ועדיין יש לה עצירה ביומן">
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

const monthYear = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

/* ───────────────────────────────────────────────────────────
 * מה יש אצל הלקוח עכשיו
 * ─────────────────────────────────────────────────────────── */

/**
 * שורת פריט.
 *
 * 🔴 **הצבע כאן הוא סף ולא קישוט.** אחריות בתוקף היא המצב הרגיל של רוב
 * הפריטים; לו הייתה נצבעת, כל הרשימה הייתה ירוקה ושום דבר לא היה בולט.
 * נצבע רק מה שדורש פעולה: אחריות שנגמרת בתוך 60 יום, או שכבר פגה.
 * [[color_on_everything_is_not_color]]
 */
function StockRow({ item, strong }: { item: StockItem; strong: boolean }) {
  const w = warrantyState(item.warrantyEnd);
  const sub = itemSubtitle(item);
  const srcs = sourceLabels(item.sources);
  const warrantyClass =
    w.tone === 'expired' ? 'text-slate-500'
      : w.tone === 'ending' ? 'font-semibold text-amber-700'
        : 'text-emerald-700';

  return (
    <div className={`rounded-lg px-2.5 ${strong ? 'bg-slate-50/80 py-2' : 'bg-slate-50/50 py-1.5'}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <bdi className={strong ? 'text-[13.5px] font-bold text-slate-900' : 'text-[12.5px] font-semibold text-slate-800'}>
          {itemTitle(item)}
        </bdi>
        {item.qty > 1 && <span className="text-[11px] text-muted-foreground">×{item.qty}</span>}
        <MatchTag kind={item.match} />
      </div>

      {sub && <div className="text-[11.5px] leading-snug text-muted-foreground">{sub}</div>}

      {/* ⭐ המספר הסידורי הוא מה שהנציגה מקריאה לטכנאי, ולכן הוא ניתן לבחירה. */}
      {item.serials.length > 0 && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {item.serials.map((sn) => (
            <bdi key={sn} className="select-all rounded bg-white px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600 ring-1 ring-slate-200">
              {sn}
            </bdi>
          ))}
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
        {w.text && <span className={warrantyClass}>{w.text}</span>}
        {/* 🔴 `he-IL` מתעלם מ-`month: '2-digit'` ומחזיר "1.2026", שנראה
            שבור ליד "12.01.2028" בשורה שלידו. */}
        {item.installedAt && (
          <span className="text-muted-foreground">
            הותקן <bdi>{monthYear(item.installedAt)}</bdi>
          </span>
        )}
        {/* 🔴 מאיפה אנחנו יודעים. פריט בלי מקור הוא בדיוק מה שנציגה
            תגיד בביטחון ותיפול עליו. */}
        {srcs.length > 0 && (
          <span className="text-slate-400" title="מאיפה הפריט ידוע לנו">
            {srcs.join(' · ')}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * ⭐⭐ **מה שעידן ביקש שיקפוץ לנציגה מיד:** "כמעט לכל לקוח יש מוצר של
 * החברה. הייתי רוצה שישר יקפוץ לנציגה איזה מוצר יש ללקוח."
 *
 * 🔴 **והרכיב הזה מצייר גם כשאין כלום.** רשימה שלא מצוירת נראית בדיוק
 * כמו פיצ'ר שלא הותקן, וזו בדיוק הטעות שנפלה כאן פעם. [[empty_state_must_speak]]
 */
function StockPanel({ stock }: { stock: CustomerStock | null | undefined }) {
  const devices = stock?.devices ?? [];
  const accessories = stock?.accessories ?? [];
  const returned = stock?.returned ?? [];
  const line = stockLine(stock);
  const nothing = devices.length === 0 && accessories.length === 0;

  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-slate-800">
        <Boxes className="h-4 w-4 text-slate-500" />
        מה יש אצל הלקוח
        {devices.length + accessories.length > 0 && (
          <span className="text-xs font-medium text-muted-foreground">
            ({devices.length + accessories.length})
          </span>
        )}
      </div>

      {/* המשפט שנאמר בטלפון, לפני הרשימה. */}
      <div className={`text-[13px] ${nothing ? 'text-muted-foreground' : 'font-semibold text-slate-900'}`}>
        {line.text}
      </div>

      {devices.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {devices.map((d, i) => <StockRow key={`${d.part}-${i}`} item={d} strong />)}
        </div>
      )}

      {accessories.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            תוספות ואביזרים
          </div>
          <div className="space-y-0.5">
            {accessories.map((a, i) => <StockRow key={`${a.part}-${i}`} item={a} strong={false} />)}
          </div>
        </div>
      )}

      {/* 🔴 מה שכבר חזר למחסן. בלי זה, "אין ציוד" ו"הכל נאסף" נראים זהים. */}
      {returned.length > 0 && (
        <div className="mt-2 border-t pt-1.5 text-[11px] text-muted-foreground">
          נאסף בחזרה: {returned.slice(0, 4).map((r) => itemTitle(r)).join(' · ')}
          {returned.length > 4 ? ` ועוד ${returned.length - 4}` : ''}
        </div>
      )}
    </div>
  );
}

function Section({
  title, icon: Icon, count, children,
}: { title: string; icon: typeof Truck; count?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-800">
        <Icon className="h-4 w-4 text-slate-500" />
        {title}
        {count != null && <span className="text-xs font-medium text-muted-foreground">({count})</span>}
      </div>
      {children}
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
  data, layout = 'page',
}: { data: CustomerCardData; layout?: 'page' | 'drawer' }) {
  const c = data.customer;
  const orders = data.open?.orders ?? [];
  const calls = data.open?.calls ?? [];
  const pickups = data.open?.pickups ?? [];
  const answer = answerLine(orders, calls);
  const certainty = certaintyNote(data.match);
  const identity = identityNote(c);

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
        {/* ── ציר הפעילות ── */}
        <Section title="ציר הפעילות" icon={Clock} count={data.timeline?.length ?? 0}>
          {(data.timeline ?? []).length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">אין עדיין פעילות רשומה.</div>
          ) : (
            <div className="max-h-[420px] space-y-0 overflow-y-auto border-s-2 border-slate-100 ps-3">
              {(data.timeline ?? []).map((e, i) => {
                const Icon = KIND_ICON[e.kind] ?? FileText;
                return (
                  <div key={`${e.at}-${i}`} className="relative py-1.5">
                    <span className={`absolute -start-[19px] top-3 h-2 w-2 rounded-full ring-2 ring-white ${KIND_COLOR[e.kind] ?? 'bg-slate-300'}`} />
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-mono text-[10.5px] text-muted-foreground">
                        {new Date(e.at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </span>
                      <Icon className="h-3 w-3 text-slate-400" />
                      <span className="text-[12.5px] font-semibold text-slate-800">{e.title}</span>
                      {e.ref && <bdi className="font-mono text-[11px] text-blue-700">{e.ref}</bdi>}
                      <MatchTag kind={e.match} />
                    </div>
                    {e.detail && <div className="text-[11.5px] leading-snug text-muted-foreground">{e.detail}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

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
                <a href={`/inbox?phone=${encodeURIComponent(data.wa.phone ?? '')}`} className="block pt-1 text-center text-[11px] text-blue-700 hover:underline">
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
  customerNumber, phone, layout = 'page',
}: { customerNumber: string | null; phone: string | null; layout?: 'page' | 'drawer' }) {
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
  return <CustomerCardBody data={q.data} layout={layout} />;
}
