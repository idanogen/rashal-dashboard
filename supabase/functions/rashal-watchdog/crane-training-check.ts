// אספקת מנוף שנסגרה בלי אישור הדרכה חתום.
//
// 25/10/2026, עמי על לוזון: המנוף סופק, העצירה נסגרה, וטופס ההדרכה לא מולא.
// הטופס בכוונה לא חוסם סגירה (נהג שהלקוח לא בבית חייב לסגור), ולכן החוסר
// שקוף, וזה בדיוק סוג הפער שצריך פעמון. האיתור ב-`crane_training_missing`
// במסד (אותו כלל זיהוי מנוף כמו `lib/crane-identity.ts`), שעתיים חסד אחרי
// הסגירה, חלון של שבוע אחורה.
//
// ⭐ כל עצירה מדווחת פעם אחת: המזהים שכבר דווחו שמורים ב-detail של
// `sync_alerts`, וההתראה הבאה יוצאת רק כשיש חדשות (הישנות מצורפות לרשימה).

export const CRANE_JOB = "crane-training";

interface MissingRow {
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
  sendEmail: (subject: string, html: string) => Promise<void>;
  wrap: (inner: string, color: string) => string;
}

function rowLine(r: MissingRow, isNew: boolean): string {
  const when = r.delivery_date ? r.delivery_date.split("-").reverse().join("/") : "";
  const cust = r.customer_number ? ` (<bdi>${r.customer_number}</bdi>)` : "";
  const order = r.order_docno ? `, הזמנה <bdi>${r.order_docno}</bdi>` : "";
  const driver = r.driver ? ` ע"י ${r.driver}` : "";
  return `• <b>${r.customer_name ?? "?"}</b>${cust} — ${r.crane_model ?? "מנוף"}${order}` +
    `, סופק ${when}${driver}${isNew ? " 🆕" : ""}`;
}

export async function checkCraneTraining(
  now: Date,
  prev: Record<string, unknown> | undefined,
  { sb, sendEmail, wrap }: Deps,
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

  const lines = rows.map((r) => rowLine(r, !alerted.has(r.stop_id)));
  const subject = fresh.length === 1
    ? "🟠 מנוף סופק בלי אישור הדרכה חתום"
    : `🟠 ${fresh.length} מנופים סופקו בלי אישור הדרכה חתום`;
  await sendEmail(
    subject,
    wrap(
      `<b style="font-size:16px">אספקת מנוף נסגרה בלי טופס הדרכה</b><br><br>` +
      lines.join("<br>") +
      `<br><br>הלקוח חייב אישור הדרכה חתום על מנוף. אפשר להשלים מול הנהג, או להחתים בביקור הבא. ` +
      `הטופס באפליקציית הנהג, בכרטיס העצירה. ביומן הסדרן העצירות האלה מסומנות "⚠️ בלי הדרכה".`,
      "#d98324",
    ),
  );
  // 🔴 הדגל נכתב רק אחרי שהמייל יצא, ושומר גם את הישנים כדי לא לדווח פעמיים.
  await sb.from("sync_alerts").upsert({
    job: CRANE_JOB, state: "alerting", last_alerted_at: now.toISOString(),
    detail: [...alerted, ...fresh.map((r) => r.stop_id)].slice(-80).join(" · "),
    updated_at: now.toISOString(),
  });
  return `ALERT sent (${fresh.length} new, ${rows.length} total)`;
}
