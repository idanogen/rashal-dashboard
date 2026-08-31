// rashal-driver-notify — שולחת התראות דחיפה לטלפוני הנהגים (rashal-driver).
//
// הזרימה: טריגר במסד רושם ל-driver_notify_queue ומקפיץ לכאן דרך pg_net;
// קרון כל 5 דקות הוא רשת הביטחון. ההזמנה מהטריגר ממתינה 30 שניות לפני
// העיבוד, כדי ששיבוץ מרובה של הסדרן יתקבץ להתראה מסכמת אחת.
//
// השליחה דרך שירות ההתראות של Expo (exp.host). הטוקנים בטבלת
// driver_devices, שהאפליקציה מעדכנת בכל התחברות.

import { createClient } from "npm:@supabase/supabase-js@2";

const GROUP_WAIT_MS = 30_000;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** מעל הסף הזה, עדכוני סידור מתקבצים להתראה אחת. */
const SUMMARY_THRESHOLD = 3;

type QueueRow = {
  id: number;
  driver_name: string;
  kind: string;
  title: string;
  body: string | null;
  stop_id: string | null;
};

type PushMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  channelId: "default";
  data: { stopId?: string };
};

Deno.serve(async (req: Request) => {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const payload = await req.json().catch(() => ({}));

  // הקפצה מטריגר: חלון קיבוץ. קרון מרים מיד את מה שכבר התיישן.
  if (payload?.trigger === "db") {
    await new Promise((r) => setTimeout(r, GROUP_WAIT_MS));
  }

  const { data: settings } = await sb
    .from("driver_push_settings")
    .select("enabled")
    .eq("id", true)
    .maybeSingle();

  // תפיסת כל השורות הפתוחות. עדכון אטומי: הרצה מקבילה תקבל אפס שורות.
  const { data: claimed, error: claimErr } = await sb
    .from("driver_notify_queue")
    .update({ sent_at: new Date().toISOString(), result: "claimed" })
    .is("sent_at", null)
    .select("id, driver_name, kind, title, body, stop_id");

  if (claimErr) {
    return json({ error: claimErr.message }, 500);
  }
  const rows = (claimed ?? []) as QueueRow[];
  if (rows.length === 0) {
    return json({ processed: 0 });
  }

  if (settings && settings.enabled === false) {
    await markAll(sb, rows, "disabled");
    return json({ processed: rows.length, result: "disabled" });
  }

  // קיבוץ לפי נהג.
  const byDriver = new Map<string, QueueRow[]>();
  for (const row of rows) {
    const list = byDriver.get(row.driver_name) ?? [];
    list.push(row);
    byDriver.set(row.driver_name, list);
  }

  const drivers = [...byDriver.keys()];
  const { data: devices } = await sb
    .from("driver_devices")
    .select("driver_name, expo_push_token")
    .in("driver_name", drivers);

  const tokensByDriver = new Map<string, string[]>();
  for (const d of devices ?? []) {
    const list = tokensByDriver.get(d.driver_name) ?? [];
    list.push(d.expo_push_token);
    tokensByDriver.set(d.driver_name, list);
  }

  const messages: PushMessage[] = [];
  const summary: Record<string, string> = {};

  for (const [driver, driverRows] of byDriver.entries()) {
    const tokens = tokensByDriver.get(driver) ?? [];
    if (tokens.length === 0) {
      await markAll(sb, driverRows, "no_device");
      summary[driver] = "no_device";
      continue;
    }

    const scheduleRows = driverRows.filter((r) =>
      ["new_stop", "schedule_change", "removed"].includes(r.kind)
    );
    const chatRows = driverRows.filter((r) => ["chat", "photo"].includes(r.kind));

    const toSend: { title: string; body: string; stopId?: string }[] = [];
    if (scheduleRows.length > SUMMARY_THRESHOLD) {
      toSend.push({
        title: "עודכן הסידור שלך",
        body: `${scheduleRows.length} עדכונים בסידור. פתחו לרשימה המעודכנת.`,
      });
    } else {
      for (const r of scheduleRows) {
        toSend.push({ title: r.title, body: r.body ?? "", stopId: r.stop_id ?? undefined });
      }
    }
    if (chatRows.length > SUMMARY_THRESHOLD) {
      toSend.push({
        title: "הודעות חדשות",
        body: `${chatRows.length} הודעות ותמונות חדשות על הביקורים שלך.`,
      });
    } else {
      for (const r of chatRows) {
        toSend.push({ title: r.title, body: r.body ?? "", stopId: r.stop_id ?? undefined });
      }
    }

    for (const msg of toSend) {
      for (const token of tokens) {
        messages.push({
          to: token,
          title: msg.title,
          body: msg.body,
          sound: "default",
          channelId: "default",
          data: msg.stopId ? { stopId: msg.stopId } : {},
        });
      }
    }
    summary[driver] = `queued:${toSend.length}x${tokens.length}`;
  }

  // שליחה במקבצים של עד 100, כדרישת Expo.
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        failed += chunk.length;
        errors.push(`http ${res.status}`);
        continue;
      }
      const tickets: { status: string; message?: string }[] = body?.data ?? [];
      for (const t of tickets) {
        if (t.status === "ok") sent++;
        else {
          failed++;
          if (t.message) errors.push(t.message.slice(0, 120));
        }
      }
    } catch (err) {
      failed += chunk.length;
      errors.push(String(err).slice(0, 120));
    }
  }

  const sentRows = rows.filter((r) => summary[r.driver_name]?.startsWith("queued"));
  await markAll(
    sb,
    sentRows,
    failed === 0 ? "sent" : `sent:${sent} failed:${failed} ${errors[0] ?? ""}`.trim()
  );

  return json({ processed: rows.length, pushSent: sent, pushFailed: failed, summary });
});

async function markAll(
  sb: ReturnType<typeof createClient>,
  rows: QueueRow[],
  result: string
): Promise<void> {
  if (rows.length === 0) return;
  await sb
    .from("driver_notify_queue")
    .update({ result })
    .in("id", rows.map((r) => r.id));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
