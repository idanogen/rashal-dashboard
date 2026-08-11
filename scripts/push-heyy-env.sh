#!/usr/bin/env bash
# העלאת מפתחות heyy מ-.env.local אל Vercel (production בלבד).
#
# הערכים עוברים דרך צינור ואינם מודפסים בשום שלב — לא למסך, לא ללוג,
# ולא לצ'אט. מה שמוצג הוא רק ארבעת התווים האחרונים, כדי שתוכל לוודא
# שהודבק הערך הנכון.
set -u
cd "$(dirname "$0")/.." || exit 1

if [ ! -f .env.local ]; then
  echo "❌ אין קובץ .env.local"
  exit 1
fi

TARGET="${1:-production}"

push_var() {
  local name="$1"
  local value
  value="$(grep -m1 "^${name}=" .env.local | cut -d= -f2- | tr -d '\r' | xargs)"

  if [ -z "$value" ]; then
    echo "⏭️  ${name} — ריק בקובץ, מדלג"
    return
  fi

  # מסירים ערך קודם אם קיים, אחרת ההוספה נכשלת
  npx vercel env rm "$name" "$TARGET" --yes >/dev/null 2>&1

  if printf '%s' "$value" | npx vercel env add "$name" "$TARGET" >/dev/null 2>&1; then
    echo "✅ ${name} הועלה (מסתיים ב-...${value: -4})"
  else
    echo "❌ ${name} נכשל"
  fi
}

push_var HEYY_API_KEY
push_var HEYY_CHANNEL_ID

echo ""
echo "המצב הנוכחי ב-Vercel ($TARGET):"
npx vercel env ls "$TARGET" 2>/dev/null | grep -E "HEYY" || echo "(לא נמצאו משתני HEYY)"
