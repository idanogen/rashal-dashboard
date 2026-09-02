import { Search, X } from 'lucide-react';

const NAVY = '#14223a';

/**
 * חיפוש לפי שם הלקוח שכתב את חוות הדעת (בקשת עידן, <bdi>02/09/2026</bdi>).
 *
 * ⭐ **יושב בראש המסך ולא בתוך פאנל אחד.** מי שמחפש אדם רוצה לראות את
 * כל מה שהוא כתב, ולא לנחש באיזה משלושת הפאנלים הוא נמצא.
 *
 * ⚠️ ההתאמה עצמה נעשית ב-`matchesSearch`, אותו מנוע של רשימות הסדרן,
 * ולכן סדר המילים והאותיות הסופיות מתנהגים כאן בדיוק כמו בכל שאר
 * המערכת. שם בפריוריטי נכתב "משפחה פרטי" והמשתמש מקליד הפוך.
 */
export function SurveySearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 start-3" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="חיפוש לפי שם הלקוח שכתב"
        aria-label="חיפוש לפי שם הלקוח שכתב את חוות הדעת"
        className="w-full rounded-xl border bg-white py-2 ps-9 pe-9 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300"
        style={{ borderColor: '#eef1f6', color: NAVY }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="ניקוי החיפוש"
          className="absolute top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 end-2"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
