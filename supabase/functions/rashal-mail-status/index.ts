// ─── מה קרה למייל ששלחנו ─────────────────────────────────────────────
//
// הרקע (01/09/2026): שלומי ועמי לא קיבלו את התראת הדירוג הנמוך,
// והשאלה "נמסרה או נדחתה" דרשה לפתוח דשבורד של ספק חיצוני.
// 🔴 מערכת ששולחת התראות ולא יודעת אם הן הגיעו היא מערכת עיוורת,
// וזו אותה משפחה של כשלים שכבר תפסנו הבוקר: מנגנון שרץ, מדווח
// הצלחה, ואפס תוצאה בעולם.
//
// 🔴🔴 23/09/2026: נכנס לריפו (היה פרוס בלי קוד) ומאחורי שער הסוד. עד היום
// כל מי שהחזיק את המפתח הציבורי קיבל את רשימת המיילים: נמענים ונושאים.
//
// קריאה בלבד, ולא שולחת כלום:
//   {}                       ← רשימת ההודעות האחרונות ומצב כל אחת
//   {"id":"<uuid>"}          ← הודעה אחת לפי מזהה
import { requireSecret } from "../_shared/require-secret.ts";

const KEY = () => Deno.env.get("RESEND_API_KEY") ?? "";

async function call(path: string) {
  const res = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${KEY()}` },
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 400); }
  return { path, status: res.status, body };
}

Deno.serve(async (req) => {
  const denied = requireSecret(req);
  if (denied) return denied;
  if (!KEY()) return json({ ok: false, error: "no RESEND_API_KEY" }, 500);

  const b = await req.json().catch(() => ({}));
  const id: string | undefined = b?.id;

  if (id) return json({ ok: true, result: await call(`/emails/${id}`) });

  // 🔴 לא כל גרסה של ה-API חושפת רשימה, ולכן מנסים ומדווחים מה חזר
  // במקום להניח. תשובה של 404 היא ממצא בפני עצמה ולא תקלה.
  const attempts = [];
  for (const p of ["/emails?limit=25", "/emails"]) {
    const r = await call(p);
    attempts.push(r);
    if (r.status === 200) break;
  }
  return json({ ok: true, attempts });
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
}
