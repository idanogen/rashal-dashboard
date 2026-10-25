// מסכים שנכשלו אצל משתמשים: הופרד מ-index.ts ב-25/10/2026 (תקרת 500 שורות).
// התלויות מוזרקות מ-index.ts, כמו ב-crane-training-check.ts.

interface Deps {
  // deno-lint-ignore-file -- אותו לקוח של supabase-js שמוזרק מ-index.ts.
  sb: {
    from(table: string): {
      select(cols: string): {
        gt(col: string, v: string): {
          order(col: string, o: { ascending: boolean }): {
            limit(n: number): PromiseLike<{ data: unknown; error: { message: string } | null }>;
          };
        };
        in(col: string, vals: string[]): PromiseLike<{ data: unknown }>;
      };
      upsert(row: Record<string, unknown>): PromiseLike<unknown>;
    };
  };
  sendEmail: (subject: string, html: string) => Promise<void>;
  wrap: (inner: string, color: string) => string;
  realertHours: number;
}

// ── מסכים שנכשלו אצל משתמשים ────────────────────────────
//
// 🔴🔴 **הפער שזה סוגר (עידן, 10/09/2026): "למה אני לא מקבל התראה על תקלה
// כזאת?".** מסך הסדרן נכשל שלוש פעמים בשליפת האיסופים, הכשל נרשם יפה
// ל-`screen_load_log`, ואף אחד לא קרא את הטבלה. בנינו מדחום בלי פעמון.
//
// ⭐ **המייל אומר מה קרה בפועל ולא מה אנחנו מנחשים שקרה:** כמה טעינות
// נכשלו, אצל מי, ונוסח השגיאה **כפי שנרשם**, לא ניסוח משוחזר.
// [[alert_email_hardcodes_last_incidents_diagnosis]]
//
// 🔴 **ובלי מייל "חזר לתקינות".** הטבלה נכתבת רק כשטעינה נכשלה או הייתה
// איטית, ולכן שעה בלי שורות היא גם "תוקן" וגם "אף אחד לא עבד". אי אפשר
// להבדיל, אז לא מצהירים. השעה השקטה רק מאפסת את המצב בשקט.
// [[silence_needs_a_positive_control]]
export const SCREEN_JOB = "screen-loads";
const APP_URL = Deno.env.get("APP_URL") ?? "https://rashal.vercel.app";

/** מה הגרסה שבאוויר עכשיו. `null` = לא הצלחנו לשאול, ואז פשוט לא מזכירים. */
async function liveBuildId(): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(`${APP_URL}/version.json?t=${Date.now()}`, {
        headers: { "Cache-Control": "no-store" },
        signal: ctrl.signal,
      });
      if (!r.ok) return null;
      const j = await r.json();
      return typeof j?.build === "string" ? j.build : null;
    } finally { clearTimeout(timer); }
  } catch { return null; }
}

interface LoadRow {
  created_at: string; screen: string; failures: string[] | null;
  created_by: string | null; build_id: string | null;
}

export async function checkScreenLoads(
  now: Date,
  prev: Record<string, unknown> | undefined,
  { sb, sendEmail, wrap, realertHours }: Deps,
): Promise<string> {
  const since = new Date(now.getTime() - 65 * 60000).toISOString();
  const { data, error } = await sb.from("screen_load_log")
    .select("created_at,screen,failures,created_by,build_id")
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return `query failed: ${error.message}`;

  const failed = ((data ?? []) as LoadRow[]).filter((r) => (r.failures ?? []).length > 0);
  const prevState = (prev?.state as string) ?? "ok";

  if (failed.length === 0) {
    if (prevState !== "ok") {
      await sb.from("sync_alerts").upsert({
        job: SCREEN_JOB, state: "ok", detail: null, updated_at: now.toISOString(),
      });
      return "quiet hour (state cleared, no email)";
    }
    return "ok";
  }

  const alertedAt = prev?.last_alerted_at ? new Date(prev.last_alerted_at as string) : null;
  const hoursSinceAlert = alertedAt ? (now.getTime() - alertedAt.getTime()) / 3600000 : Infinity;
  if (prevState === "alerting" && hoursSinceAlert < realertHours) return "failures (throttled)";

  // שמות, כדי שהמייל יגיד "שורה" ולא מזהה משתמש.
  const ids = [...new Set(failed.map((r) => r.created_by).filter((v): v is string => !!v))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await sb.from("profiles").select("id,full_name").in("id", ids);
    for (const p of (profs ?? []) as { id: string; full_name: string | null }[]) {
      if (p.full_name) names.set(p.id, p.full_name);
    }
  }
  const who = [...new Set(failed.map((r) => (r.created_by && names.get(r.created_by)) || "משתמש לא מזוהה"))];

  // נוסחי השגיאה כפי שנרשמו, מקובצים לפי כמות.
  const tally = new Map<string, number>();
  for (const r of failed) for (const f of r.failures ?? []) tally.set(f, (tally.get(f) ?? 0) + 1);
  const messages = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const screens = [...new Set(failed.map((r) => r.screen))];
  const live = await liveBuildId();

  /**
   * 🔴🔴 **שלושה מצבים ולא שניים.** דיווח בלי `build_id` (כל מה שנרשם לפני
   * 10/09/2026, וכל לשונית שעדיין מריצה קוד ישן מלפני העמודה) אינו "הגרסה
   * תואמת". שדה חסר אינו היעדר. גרסה 1 של הבדיקה הזאת הייתה מדווחת על
   * דיווח בלי גרסה כאילו "זה לא לשונית ישנה", וזה בדיוק ההפך מהאמת במקרה
   * שהוליד אותה. [[missing_attribute_is_not_absence]]
   */
  const known = [...new Set(failed.map((r) => r.build_id).filter((b): b is string => !!b))];
  const missing = failed.some((r) => !r.build_id);
  const staleTabs = live ? known.filter((b) => b !== live) : [];

  let versionLine = "";
  if (!live) {
    versionLine = `<b>גרסה:</b> לא הצלחתי לשאול מה הגרסה שבאוויר, אז אין השוואה.<br>`;
  } else if (staleTabs.length) {
    versionLine = `<b>גרסה:</b> הלשונית הריצה <bdi>${staleTabs.join(", ")}</bdi> בזמן שבאוויר ` +
      `<bdi>${live}</bdi>. כלומר סביר שרענון הדף פותר את זה.<br>`;
  } else if (missing) {
    versionLine = `<b>גרסה:</b> הדיווח הגיע בלי מזהה גרסה, ולכן אי אפשר לדעת אם זו לשונית ישנה. ` +
      `לשונית שעדיין מריצה קוד מלפני <bdi>10/09/2026</bdi> לא שולחת מזהה, וזה עצמו סימן.<br>`;
  } else {
    versionLine = `<b>גרסה:</b> הלשונית הריצה את הגרסה שבאוויר (<bdi>${live}</bdi>), ` +
      `כלומר זו אינה לשונית ישנה והתקלה במקום אחר.<br>`;
  }

  await sendEmail(
    `🔴 מסך נכשל אצל משתמש בר.שעל: ${screens.join(", ")}`,
    wrap(
      `<b style="font-size:16px">` +
      `${failed.length === 1 ? "טעינת מסך אחת נכשלה" : `${failed.length} טעינות מסך נכשלו`}` +
      ` בשעה האחרונה</b><br><br>` +
      `<b>אצל:</b> ${who.join(", ")}<br>` +
      `<b>מסך:</b> ${screens.join(", ")}<br>` +
      `<b>האחרונה:</b> ${new Date(failed[0].created_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}<br>` +
      versionLine +
      `<br><b>נוסח השגיאה כפי שנרשם:</b><br>` +
      messages.map(([m, n]) => `<span dir="ltr" style="display:inline-block;direction:ltr;text-align:left">${m}</span> <b>(×${n})</b>`).join("<br>") +
      `<br><br>המשמעות למשתמש היא שהמסך הציג פחות ממה שיש במערכת, ולא שהוא נראה שבור. ` +
      `מייל נוסף רק אם זה נמשך מעבר ל-${realertHours} שעות.`,
      "#c0392b",
    ),
  );
  await sb.from("sync_alerts").upsert({
    job: SCREEN_JOB, state: "alerting", last_alerted_at: now.toISOString(),
    detail: messages.map(([m, n]) => `${m} (x${n})`).join(" · ").slice(0, 400),
    updated_at: now.toISOString(),
  });
  return `ALERT sent (${failed.length} failed loads)`;
}

