// אספקת מנוף שנסגרה בלי אישור הדרכה חתום.
//
// 25/10/2026, עמי על לוזון: המנוף סופק, העצירה נסגרה, וטופס ההדרכה לא מולא.
// הטופס בכוונה לא חוסם סגירה (נהג שהלקוח לא בבית חייב לסגור), ולכן החוסר
// שקוף, וזה בדיוק סוג הפער שצריך פעמון. האיתור ב-`crane_training_missing`
// במסד (אותו כלל זיהוי מנוף כמו `lib/crane-identity.ts`), שעתיים חסד אחרי
// הסגירה, חלון של שבוע אחורה.
//
// ⭐ כל עצירה מדווחת פעם אחת: המזהים שכבר דווחו שמורים ב-detail של
// `sync_alerts`.
// 🔴 25/10/2026, אחרי הריצה הראשונה (עידן: "הודעות מערכת שלא אהבתי"): מייל
// שני בכותרת "2 מנופים" הציג מחדש את כל ה-18. מעכשיו סיכום אחד ביום אחרי
// DIGEST_HOUR_IL, רק החדשים, והישנים בשורה אחת.

export const CRANE_JOB = "crane-training";
export const DIGEST_HOUR_IL = 18;

export interface MissingRow {
  stop_id: string;
  customer_name: string | null;
  customer_number: string | null;
  driver: string | null;
  delivery_date: string | null;
  completed_at: string | null;
  order_docno: string | null;
  crane_model: string | null;
}

interface Deps {
  sb: {
    rpc(fn: string): PromiseLike<{ data: unknown; error: { message: string } | null }>;
    from(table: string): { upsert(row: Record<string, unknown>): PromiseLike<unknown> };
  };
  sendEmail: (subject: string, html: string, extraTo?: string[]) => Promise<boolean>;
  wrap: (inner: string, color: string) => string;
  extraTo?: string[];
}

// התאריך והשעה בישראל, בלי תלות באזור הזמן של השרת.
export function israelParts(d: Date): { date: string; hour: number } {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

export function digestDue(now: Date, lastAlertedAt: string | null | undefined): boolean {
  const today = israelParts(now);
  if (today.hour < DIGEST_HOUR_IL) return false;
  if (!lastAlertedAt) return true;
  return israelParts(new Date(lastAlertedAt)).date !== today.date;
}

function rowLine(r: MissingRow): string {
  const when = r.delivery_date ? r.delivery_date.split("-").reverse().join("/") : "";
  const cust = r.customer_number ? ` (<bdi>${r.customer_number}</bdi>)` : "";
  const order = r.order_docno ? `, הזמנה <bdi>${r.order_docno}</bdi>` : "";
  const driver = r.driver ? ` ע"י ${r.driver}` : "";
  return `• <b>${r.customer_name ?? "?"}</b>${cust}, ${r.crane_model ?? "מנוף"}${order}, סופק ${when}${driver}`;
}

// גוף המייל: רק החדשים, ספירה לפי נהג, והישנים בשורה אחת.
export function craneDigest(fresh: MissingRow[], olderCount: number): { subject: string; inner: string } {
  const byDriver = new Map<string, number>();
  for (const r of fresh) byDriver.set(r.driver ?? "לא ידוע", (byDriver.get(r.driver ?? "לא ידוע") ?? 0) + 1);
  const drivers = [...byDriver].sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d} ${n}`).join(", ");
  const subject = fresh.length === 1
    ? "🟠 מנוף סופק היום בלי אישור הדרכה חתום"
    : `🟠 ${fresh.length} מנופים סופקו בלי אישור הדרכה חתום`;
  const older = olderCount
    ? `<br><br><span style="color:#6b7688">ועוד ${olderCount} מהשבוע האחרון שכבר דווחו ועדיין בלי טופס.</span>`
    : "";
  const inner =
    `<b style="font-size:16px">אספקות מנוף שנסגרו בלי טופס הדרכה</b><br>` +
    `<span style="color:#6b7688">לפי נהג: ${drivers}</span><br><br>` +
    fresh.map(rowLine).join("<br>") + older +
    `<br><br>הלקוח חייב אישור הדרכה חתום על מנוף. אפשר להשלים מול הנהג, או להחתים בביקור הבא. ` +
    `הטופס באפליקציית הנהג, בכרטיס העצירה. ביומן הסדרן העצירות האלה מסומנות "⚠️ בלי הדרכה".`;
  return { subject, inner };
}

export async function checkCraneTraining(
  now: Date,
  prev: Record<string, unknown> | undefined,
  { sb, sendEmail, wrap, extraTo }: Deps,
): Promise<string> {
  const { data, error } = await sb.rpc("crane_training_missing");
  if (error) return `query failed: ${error.message}`;
  const rows = (data ?? []) as MissingRow[];
  const alerted = new Set(((prev?.detail as string) ?? "").split(" · ").filter(Boolean));
  const fresh = rows.filter((r) => !alerted.has(r.stop_id));
  if (!rows.length) {
    if ((prev?.state as string) === "alerting") {
      await sb.from("sync_alerts").upsert({ job: CRANE_JOB, state: "ok", detail: null, updated_at: now.toISOString() });
    }
    return "ok";
  }
  if (!fresh.length) return `${rows.length} missing (already alerted)`;
  if (!digestDue(now, prev?.last_alerted_at as string | undefined)) {
    return `${fresh.length} new, waiting for the ${DIGEST_HOUR_IL}:00 digest`;
  }

  const { subject, inner } = craneDigest(fresh, rows.length - fresh.length);
  const ok = await sendEmail(subject, wrap(inner, "#d98324"), extraTo);
  if (!ok) return "email failed";
  // 🔴 הדגל נכתב רק אחרי שהמייל יצא, ושומר גם את הישנים כדי לא לדווח פעמיים.
  await sb.from("sync_alerts").upsert({
    job: CRANE_JOB, state: "alerting", last_alerted_at: now.toISOString(),
    detail: [...alerted, ...fresh.map((r) => r.stop_id)].slice(-80).join(" · "),
    updated_at: now.toISOString(),
  });
  return `ALERT sent (${fresh.length} new, ${rows.length} total)`;
}
