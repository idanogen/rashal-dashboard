// add-users.mjs — יצירת משתמשים מהטרמינל, באותו מסלול של מסך המשתמשים.
//
// ⭐ מחקה בדיוק את `api/admin-users.ts` (create): אותו מיפוי משם משתמש למייל
// סינתטי, אותו פרופיל, אותה סיסמה זמנית. מיועד למקרה שצריך לפתוח כמה
// משתמשים בבת אחת בלי לעבור על המסך אחד-אחד.
//
// הרצה (מתיקיית הפרויקט, המפתח מקובץ הסביבה ולא מהשורה):
//   node --env-file=.env.local scripts/add-users.mjs --role dispatcher שורה אילונה שלומית
//   node --env-file=.env.local scripts/add-users.mjs --role driver --driver "דוד חסידים" דוד
//
// הפלט: שורה לכל משתמש עם שם המשתמש והסיסמה הזמנית. לא נשמר לשום מקום.

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const opt = (name, def = null) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const role = opt("--role", "dispatcher");
const linkedDriver = opt("--driver");
const names = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--role" && args[i - 1] !== "--driver");

const ALLOWED = ["admin", "management", "team_manager", "dispatcher", "driver", "viewer"];
if (!ALLOWED.includes(role)) { console.error("תפקיד לא מוכר: " + role); process.exit(2); }
if (!names.length) { console.error("לא ניתנו שמות"); process.exit(2); }

const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
if (!url || !key) { console.error("חסר SUPABASE_URL או SUPABASE_SERVICE_ROLE_KEY בסביבה"); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

// 🔴 חייב להישאר זהה ל-usernameToEmail ב-api/admin-users.ts וב-src/lib/username.ts
const DOMAIN = "rashal.internal";
const ASCII = /^[a-zA-Z0-9._-]+$/;
const PATTERN = /^[a-zA-Z0-9._א-ת-]{3,30}$/u;
const toEmail = (u) => ASCII.test(u) ? `${u}@${DOMAIN}` : `u${createHash("sha256").update(u, "utf8").digest("hex").slice(0, 40)}@${DOMAIN}`;
const tempPassword = () => {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let o = ""; for (let i = 0; i < 10; i++) o += c[Math.floor(Math.random() * c.length)]; return o;
};

for (const raw of names) {
  const username = raw.trim().normalize("NFC").toLowerCase();
  if (!PATTERN.test(username)) { console.log(`✗ ${raw}: שם משתמש לא תקין (3-30 תווים, אותיות, ספרות, . _ -)`); continue; }
  const { data: taken } = await sb.from("profiles").select("id").ilike("username", username).limit(1);
  if (taken && taken.length) { console.log(`✗ ${username}: כבר קיים`); continue; }
  const password = tempPassword();
  const email = toEmail(username);
  const { data, error } = await sb.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: raw.trim(), role, username },
  });
  if (error) { console.log(`✗ ${username}: ${error.message}`); continue; }
  const { error: pe } = await sb.from("profiles").upsert(
    { id: data.user.id, email, username, full_name: raw.trim(), role, linked_driver: role === "driver" ? linkedDriver : null },
    { onConflict: "id" },
  );
  if (pe) { console.log(`✗ ${username}: המשתמש נוצר אבל הפרופיל נכשל: ${pe.message}`); continue; }
  console.log(`✓ ${username}  תפקיד: ${role}  סיסמה זמנית: ${password}`);
}
