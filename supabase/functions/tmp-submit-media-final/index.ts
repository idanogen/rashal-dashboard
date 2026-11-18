// זמנית (18/11/2026): הגשת התבנית rashal_media_final למטא דרך heyy, בלי שהמפתח יוצא מהענן.
// מטען קבוע, מצבים dry | status | submit. למחוק אחרי האישור: `supabase functions delete tmp-submit-media-final`.
// ההודעה האחרונה ברצף "שלח תזכורת לתמונה" (20261118_media_nudges.sql), בנוסח שעידן אישר.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const KEY = Deno.env.get("HEYY_API_KEY") ?? "";
const CHANNEL = Deno.env.get("HEYY_CHANNEL_ID") ?? "";
const NAME = "rashal_media_final";

const payload = {
  channelId: CHANNEL,
  name: NAME,
  type: "whatsapp",
  messageContent: {
    code: NAME,
    header: "",
    footer: "",
    body: "להזכירך, נפתחה עבורך קריאת שירות בחברת ר.שעל עבור המוצר: {{var.product}}.\n" +
      "לצערנו לא נוכל לטפל בבקשה עד לקבלת תמונה או סרטון של התקלה בוואטסאפ.\n" +
      "אפשר לשלוח אותם בתשובה להודעה הזאת.",
    attachments: [],
  },
  vendorDetails: { type: "whatsapp", language: "en", category: "utility" },
};

async function heyy(path: string, body: unknown) {
  const r = await fetch(`https://api.heyy.io/v3${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch((e) => ({ parse_error: String(e).slice(0, 120) })) };
}

Deno.serve(async (req: Request) => {
  let mode = "dry";
  try {
    mode = String((await req.json())?.mode ?? "dry");
  } catch (e) {
    console.log("no body, dry mode", String(e).slice(0, 80));
  }
  if (!KEY || !CHANNEL) return Response.json({ ok: false, error: "missing HEYY_API_KEY / HEYY_CHANNEL_ID" }, { status: 500 });
  if (mode === "submit") return Response.json(await heyy("/message_templates", payload));
  if (mode === "status") {
    const res = await heyy("/message_templates/search", { pagination: { page: 0, limit: 100 } });
    const list = ((res.body as { data?: unknown[] })?.data ?? []) as Array<Record<string, unknown>>;
    const hit = list.filter((t) => t.name === NAME).map((t) => ({ id: t.id, status: t.status, category: t.category }));
    return Response.json({ status: res.status, hit });
  }
  return Response.json({ mode: "dry", payload: { ...payload, channelId: "(set)" } });
});
