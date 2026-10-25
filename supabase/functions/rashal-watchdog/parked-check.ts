// כתיבות שנעצרו לצמיתות. הופרד מ-index.ts ב-25/10/2026 (תקרת 500 שורות).
//
// 🔴🔴 **הפער שזה סוגר (18/09/2026).** הערה של טכנאי על קריאה שכבר "סופית"
// בפריוריטי נדחית ב-400 בכל ריצה, לנצח. מהיום הפריט נעצר ביומן, וה-job
// חוזר לירוק, אבל עצירה היא איבוד מידע ולכן הפעמון כאן, פעם אחת לכל פריט.
// [[log_without_a_bell_is_not_monitoring]]
//
// 🔴 25/10/2026 (עידן: "הודעות מערכת שלא אהבתי"): המייל מנה שורה לכל פריט,
// כך ש-SC2603292 הופיעה ארבע פעמים בלי שם ובלי תוכן, וכתב "לא ייכנס
// לפריוריטי" על הערות ותמונות שכן נכנסו לכרטיס הלקוח. מעכשיו שורה לכל
// קריאה עם הלקוח, הטכנאי ומה שנכתב, ואזהרה בראש כשהקריאה מבוטלת בפריוריטי.

export const PARKED_JOB = "push-parked";

export interface ParkedRow { key: string; docno: string | null; fail_reason: string | null; last_error: string | null; failed_at: string }
export interface CallFacts { customer_name: string | null; priority_status: string | null }
export interface EventFacts { type: string | null; user_name: string | null; content: string | null; on_card: boolean }
export interface NoteFacts { driver: string | null; note: string | null }

export interface ParkedGroup {
  docno: string;
  call: CallFacts | null;
  people: string[];
  photos: number;
  photosOnCard: number;
  comments: { text: string; onCard: boolean }[];
  notes: string[];
  other: string[];
}

const REASON: Record<string, string> = {
  call_locked: "הקריאה נעולה לשינויים בפריוריטי",
  read_only_subform: "תת-הטופס בפריוריטי לקריאה בלבד",
  priority_rejected: "פריוריטי דחה את התוכן",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clip = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n)}…` : s);

// מפתח היומן: `event:<timeline id>` או `note:<stop id>:<md5>`.
export function groupParked(
  rows: ParkedRow[],
  calls: Map<string, CallFacts>,
  events: Map<string, EventFacts>,
  notes: Map<string, NoteFacts>,
): ParkedGroup[] {
  const groups = new Map<string, ParkedGroup>();
  for (const r of rows) {
    const docno = r.docno ?? r.key;
    let g = groups.get(docno);
    if (!g) {
      g = { docno, call: calls.get(docno) ?? null, people: [], photos: 0, photosOnCard: 0, comments: [], notes: [], other: [] };
      groups.set(docno, g);
    }
    const [kind, id] = r.key.split(":");
    const ev = kind === "event" ? events.get(id) : undefined;
    const nt = kind === "note" ? notes.get(id) : undefined;
    const who = ev?.user_name ?? nt?.driver;
    if (who && !g.people.includes(who)) g.people.push(who);
    if (ev?.type === "file_upload") {
      g.photos++;
      if (ev.on_card) g.photosOnCard++;
    } else if (ev?.content) {
      g.comments.push({ text: ev.content, onCard: ev.on_card });
    } else if (nt?.note) {
      g.notes.push(nt.note);
    } else {
      g.other.push(REASON[r.fail_reason ?? ""] ?? r.fail_reason ?? "לא ידוע");
    }
  }
  return [...groups.values()];
}

export const isCancelled = (g: ParkedGroup) => g.call?.priority_status === "מבוטלת";

function groupLine(g: ParkedGroup): string {
  const name = g.call?.customer_name ? `<b>${esc(g.call.customer_name)}</b> ` : "";
  const status = g.call?.priority_status
    ? (isCancelled(g) ? ` <b style="color:#c0392b">מבוטלת בפריוריטי</b>` : `, ${esc(g.call.priority_status)} בפריוריטי`)
    : "";
  const who = g.people.length ? ` · ${esc(g.people.join(", "))}` : "";
  const parts: string[] = [];
  if (g.photos) {
    parts.push(g.photosOnCard === g.photos
      ? `${g.photos === 1 ? "תמונה אחת" : `${g.photos} תמונות`} (נכנסו לכרטיס הלקוח)`
      : `${g.photos} תמונות (${g.photosOnCard} בכרטיס הלקוח)`);
  }
  for (const c of g.comments) {
    parts.push(`הערה: "${esc(clip(c.text))}"${c.onCard ? " (נכנסה לכרטיס הלקוח)" : ""}`);
  }
  for (const n of g.notes) parts.push(`סיבת "לא בוצע": "${esc(clip(n))}" <b>(נשארה רק אצלנו)</b>`);
  for (const o of new Set(g.other)) parts.push(esc(o));
  return `• ${name}(<bdi>${esc(g.docno)}</bdi>${status})${who}` +
    parts.map((p) => `<br>&nbsp;&nbsp;${p}`).join("");
}

export function parkedDigest(groups: ParkedGroup[], cardLines: string[]): { subject: string; inner: string } {
  const cancelled = groups.filter(isCancelled);
  const subject = cancelled.length
    ? `🟠 טכנאי עבד על קריאה מבוטלת: ${cancelled.map((g) => g.call?.customer_name ?? g.docno).join(", ")}`
    : groups.length
      ? (groups.length === 1
        ? `🟠 רישום טכנאי על קריאה סגורה: ${groups[0].call?.customer_name ?? groups[0].docno}`
        : `🟠 רישומי טכנאי על ${groups.length} קריאות סגורות בפריוריטי`)
      : (cardLines.length === 1 ? "🟠 פריט אחד לא נכנס לפריוריטי" : `🟠 ${cardLines.length} פריטים לא נכנסו לפריוריטי`);
  const head = cancelled.length
    ? `<b style="font-size:16px;color:#c0392b">טכנאי עבד על קריאה שמבוטלת בפריוריטי</b><br>` +
      `שווה לבדוק אם הקריאה בוטלה בטעות, או שהטכנאי נשלח לקריאה שכבר לא קיימת.<br><br>`
    : `<b style="font-size:16px">רישומי טכנאי על קריאות שנסגרו בפריוריטי</b><br><br>`;
  const foot = groups.length
    ? `<br><br>הקריאה בפריוריטי נעולה, ולכן מה שנרשם לא נכנס לתוך הקריאה עצמה. ` +
      `תמונות והערות צ'אט נכנסות גם לכרטיס הלקוח, כמסומן למעלה. סיבת "לא בוצע" נשארת רק בדשבורד, ` +
      `וכדי להכניס אותה לקריאה צריך לפתוח אותה לשינויים בפריוריטי.`
    : "";
  const cardFoot = cardLines.length
    ? `<br><br>מה שנדחה בכרטיס הלקוח (למשל תמונה בפורמט שפריוריטי לא מקבל) אפשר לצרף ידנית מתוך הדשבורד.`
    : "";
  return { subject, inner: head + [...groups.map(groupLine), ...cardLines].join("<br><br>") + foot + cardFoot };
}

type Row = Record<string, unknown>;
// המשטח המינימלי של supabase-js שמוזרק מ-index.ts.
interface Query extends PromiseLike<{ data: Row[] | null; error: { message: string } | null }> {
  select(cols: string): Query;
  gt(col: string, v: string): Query;
  or(filter: string): Query;
  in(col: string, v: string[]): Query;
  order(col: string, o: { ascending: boolean }): Query;
  limit(n: number): Query;
}

interface Deps {
  sb: { from(table: string): Query & { upsert(row: Row): PromiseLike<unknown> } };
  sendEmail: (subject: string, html: string) => Promise<boolean>;
  wrap: (inner: string, color: string) => string;
}

export async function checkParkedPushes(
  now: Date,
  prev: Record<string, unknown> | undefined,
  { sb, sendEmail, wrap }: Deps,
): Promise<string> {
  // 🔴 18/09/2026: הגבול התחתון הוא **ההתראה הקודמת**, ולכן כל פריט מדווח
  // בדיוק פעם אחת, בלי חנק שמבליע פריט חדש.
  const alertedAt = prev?.last_alerted_at ? new Date(prev.last_alerted_at as string).getTime() : 0;
  const since = new Date(Math.max(alertedAt, now.getTime() - 24 * 3600000)).toISOString();
  const { data, error } = await sb.from("priority_call_push_log")
    .select("key,docno,fail_reason,last_error,failed_at")
    .gt("failed_at", since)
    // test_form נעצר ביד ובכוונה. neq לבד מפיל גם שורות עם fail_reason ריק, לכן or.
    .or("fail_reason.is.null,fail_reason.neq.test_form")
    .order("failed_at", { ascending: false })
    .limit(50);
  if (error) return `query failed: ${error.message}`;
  const rows = (data ?? []) as unknown as ParkedRow[];
  // כרטיס הלקוח (23/09/2026): תמונה או הערה שפריוריטי דחה נעצרת על השורה שלה.
  const { data: card, error: cardErr } = await sb.from("timeline_events")
    .select("id,customer_number,push_fail_reason,push_failed_at")
    .gt("push_failed_at", since)
    .order("push_failed_at", { ascending: false })
    .limit(50);
  if (cardErr) return `card query failed: ${cardErr.message}`;
  const cardRows = (card ?? []) as unknown as { id: string; customer_number: string | null; push_fail_reason: string | null }[];
  if (!rows.length && !cardRows.length) return "ok";

  // ההקשר: הלקוח והסטטוס, מה נכתב ומי, והאם זה נכנס לכרטיס הלקוח.
  const docnos = [...new Set(rows.map((r) => r.docno).filter(Boolean))] as string[];
  const eventIds = rows.filter((r) => r.key.startsWith("event:")).map((r) => r.key.split(":")[1]);
  const stopIds = rows.filter((r) => r.key.startsWith("note:")).map((r) => r.key.split(":")[1]);
  const none = { data: [] as Row[] };
  const [c, e, s] = await Promise.all([
    docnos.length
      ? sb.from("service_calls").select("priority_call_id,customer_name,priority_status").in("priority_call_id", docnos)
      : none,
    eventIds.length
      ? sb.from("timeline_events").select("id,type,user_name,content,pushed_to_priority_at").in("id", eventIds)
      : none,
    stopIds.length
      ? sb.from("calendar_stops").select("id,driver,resolution_note").in("id", stopIds)
      : none,
  ]);
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const calls = new Map<string, CallFacts>();
  for (const x of c.data ?? []) {
    calls.set(String(x.priority_call_id), { customer_name: str(x.customer_name), priority_status: str(x.priority_status) });
  }
  const events = new Map<string, EventFacts>();
  for (const x of e.data ?? []) {
    events.set(String(x.id), {
      type: str(x.type), user_name: str(x.user_name), content: str(x.content), on_card: !!x.pushed_to_priority_at,
    });
  }
  const notes = new Map<string, NoteFacts>();
  for (const x of s.data ?? []) notes.set(String(x.id), { driver: str(x.driver), note: str(x.resolution_note) });

  const groups = groupParked(rows, calls, events, notes);
  const cardLines = cardRows.map((r) =>
    `• כרטיס לקוח${r.customer_number ? ` <bdi>${r.customer_number}</bdi>` : ""}: פריוריטי דחה את התוכן` +
    (r.push_fail_reason ? `<br>&nbsp;&nbsp;<span style="color:#6b7688">${esc(r.push_fail_reason.slice(0, 160))}</span>` : "")
  );
  const { subject, inner } = parkedDigest(groups, cardLines);
  const ok = await sendEmail(subject, wrap(inner, groups.some(isCancelled) ? "#c0392b" : "#d98324"));
  if (!ok) return "email failed";
  await sb.from("sync_alerts").upsert({
    job: PARKED_JOB, state: "alerting", last_alerted_at: now.toISOString(),
    detail: [...rows.map((r) => `${r.docno ?? r.key}: ${r.fail_reason}`),
             ...cardRows.map((r) => `card ${r.customer_number ?? r.id}`)].join(" · ").slice(0, 400),
    updated_at: now.toISOString(),
  });
  return `ALERT sent (${groups.length} calls, ${rows.length + cardRows.length} items)`;
}
