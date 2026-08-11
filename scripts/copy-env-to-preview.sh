#!/usr/bin/env bash
# העתקת משתני שרת מ-production ל-preview.
#
# פונקציות ה-API בסביבת הדמו קרסו (FUNCTION_INVOKATION_FAILED) כי המשתנים
# של Supabase מוגדרים ב-production בלבד. הצד הלקוח דווקא עבד, כי Vite קורא
# את קובץ .env המקומי בזמן הבנייה — מה שהסתיר את הפער עד שנקראה פונקציה.
#
# הערכים עוברים דרך קובץ זמני ומצינור, ואינם מודפסים. הקובץ נמחק בסוף.
set -u
cd "$(dirname "$0")/.." || exit 1

VARS="${*:-SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_ANON_KEY}"
TMP="$(mktemp -t vercelenv)"
trap 'rm -f "$TMP"' EXIT

echo "מושך את משתני production…"
npx vercel env pull "$TMP" --environment=production --yes >/dev/null 2>&1 || {
  echo "❌ משיכת production נכשלה"; exit 1; }

for name in $VARS; do
  value="$(grep -m1 "^${name}=" "$TMP" | cut -d= -f2- | tr -d '\r' | sed 's/^"//; s/"$//')"
  if [ -z "$value" ]; then
    echo "⏭️  ${name} — לא קיים ב-production, מדלג"
    continue
  fi
  npx vercel env rm "$name" preview --yes >/dev/null 2>&1
  if printf '%s' "$value" | npx vercel env add "$name" preview >/dev/null 2>&1; then
    echo "✅ ${name} הועתק ל-preview (מסתיים ב-...${value: -4})"
  else
    echo "❌ ${name} נכשל"
  fi
done

echo ""
echo "preview מכיל עכשיו:"
npx vercel env ls preview 2>/dev/null | grep -E "SUPABASE|HEYY" || echo "(ריק)"
