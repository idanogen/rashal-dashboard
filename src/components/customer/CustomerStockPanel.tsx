import { Boxes } from 'lucide-react';
import {
  stockLine, warrantyState, itemTitle, itemSubtitle, sourceLabels,
  type StockItem, type CustomerStock,
} from '@/lib/customer-answer';
import { MatchTag } from '@/components/customer/CardParts';

/** "מה יש אצל הלקוח עכשיו", פוצל מ-CustomerCard.tsx (24/11/2026) בלי שינוי התנהגות. */

const monthYear = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

/* ───────────────────────────────────────────────────────────
 * מה יש אצל הלקוח עכשיו
 * ─────────────────────────────────────────────────────────── */

/**
 * שורת פריט.
 *
 * 🔴 **הצבע כאן הוא סף ולא קישוט.** אחריות בתוקף היא המצב הרגיל של רוב
 * הפריטים; לו הייתה נצבעת, כל הרשימה הייתה ירוקה ושום דבר לא היה בולט.
 * נצבע רק מה שדורש פעולה: אחריות שנגמרת בתוך 60 יום, או שכבר פגה.
 * [[color_on_everything_is_not_color]]
 */
function StockRow({ item, strong }: { item: StockItem; strong: boolean }) {
  const w = warrantyState(item.warrantyEnd);
  const sub = itemSubtitle(item);
  const srcs = sourceLabels(item.sources);
  const warrantyClass =
    w.tone === 'expired' ? 'text-slate-500'
      : w.tone === 'ending' ? 'font-semibold text-amber-700'
        : 'text-emerald-700';

  return (
    <div className={`rounded-lg px-2.5 ${strong ? 'bg-slate-50/80 py-2' : 'bg-slate-50/50 py-1.5'}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <bdi className={strong ? 'text-[13.5px] font-bold text-slate-900' : 'text-[12.5px] font-semibold text-slate-800'}>
          {itemTitle(item)}
        </bdi>
        {item.qty > 1 && <span className="text-[11px] text-muted-foreground">×{item.qty}</span>}
        <MatchTag kind={item.match} />
      </div>

      {sub && <div className="text-[11.5px] leading-snug text-muted-foreground">{sub}</div>}

      {/* ⭐ המספר הסידורי הוא מה שהנציגה מקריאה לטכנאי, ולכן הוא ניתן לבחירה. */}
      {item.serials.length > 0 && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {item.serials.map((sn) => (
            <bdi key={sn} className="select-all rounded bg-white px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600 ring-1 ring-slate-200">
              {sn}
            </bdi>
          ))}
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
        {w.text && <span className={warrantyClass}>{w.text}</span>}
        {/* 🔴 `he-IL` מתעלם מ-`month: '2-digit'` ומחזיר "1.2026", שנראה
            שבור ליד "12.01.2028" בשורה שלידו. */}
        {item.installedAt && (
          <span className="text-muted-foreground">
            הותקן <bdi>{monthYear(item.installedAt)}</bdi>
          </span>
        )}
        {/* 🔴 מאיפה אנחנו יודעים. פריט בלי מקור הוא בדיוק מה שנציגה
            תגיד בביטחון ותיפול עליו. */}
        {srcs.length > 0 && (
          <span className="text-slate-400" title="מאיפה הפריט ידוע לנו">
            {srcs.join(' · ')}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * ⭐⭐ **מה שעידן ביקש שיקפוץ לנציגה מיד:** "כמעט לכל לקוח יש מוצר של
 * החברה. הייתי רוצה שישר יקפוץ לנציגה איזה מוצר יש ללקוח."
 *
 * 🔴 **והרכיב הזה מצייר גם כשאין כלום.** רשימה שלא מצוירת נראית בדיוק
 * כמו פיצ'ר שלא הותקן, וזו בדיוק הטעות שנפלה כאן פעם. [[empty_state_must_speak]]
 */
export function StockPanel({ stock }: { stock: CustomerStock | null | undefined }) {
  const devices = stock?.devices ?? [];
  const accessories = stock?.accessories ?? [];
  const returned = stock?.returned ?? [];
  const line = stockLine(stock);
  const nothing = devices.length === 0 && accessories.length === 0;

  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-slate-800">
        <Boxes className="h-4 w-4 text-slate-500" />
        מה יש אצל הלקוח
        {devices.length + accessories.length > 0 && (
          <span className="text-xs font-medium text-muted-foreground">
            ({devices.length + accessories.length})
          </span>
        )}
      </div>

      {/* 🔴 **המשפט נאמר רק כשהוא מוסיף.** כשיש מכשירים, "התשובה ללקוח"
          שמעל כבר אמרה אותם, והשורות שמתחת מפרטות. חזרה שלישית על אותה
          עובדה היא בדיוק מה שעידן קרא לו "מידע מיותר". */}
      {(nothing || returned.length > 0 || accessories.length > 0) && devices.length === 0 && (
        <div className="text-[13px] text-muted-foreground">{line.text}</div>
      )}

      {devices.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {devices.map((d, i) => <StockRow key={`${d.part}-${i}`} item={d} strong />)}
        </div>
      )}

      {accessories.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            תוספות ואביזרים
          </div>
          <div className="space-y-0.5">
            {accessories.map((a, i) => <StockRow key={`${a.part}-${i}`} item={a} strong={false} />)}
          </div>
        </div>
      )}

      {/* 🔴 מה שכבר חזר למחסן. בלי זה, "אין ציוד" ו"הכל נאסף" נראים זהים. */}
      {returned.length > 0 && (
        <div className="mt-2 border-t pt-1.5 text-[11px] text-muted-foreground">
          נאסף בחזרה: {returned.slice(0, 4).map((r) => itemTitle(r)).join(' · ')}
          {returned.length > 4 ? ` ועוד ${returned.length - 4}` : ''}
        </div>
      )}
    </div>
  );
}
