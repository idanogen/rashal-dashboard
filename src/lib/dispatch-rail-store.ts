// ─── מסילת הניווט של מסך הסדרן: מה יש על המסך, ומה סגור ──────────────
//
// עידן, 06/09/2026: "המערכת מאוד ארוכה והמשתמשים מתלוננים שהם גוללים
// המון", ו"כל המקומות במסך שיכולים להיות סגורים, בדגל הקיים".
//
// ⭐ **המסילה נבנית מהאזורים, לא מרשימה קבועה.** כל אזור רושם את עצמו
// כאן (כותרת, ספירה, מצב הקיפול והמתג שלו), והמסילה רק מציירת. אזור שלא
// קיים בלשונית הנוכחית לא מופיע, והספירות הן אותן ספירות שעל הכותרות.
// 🔴 מצב הקיפול נשאר בבעלות האזור (`usePersistedCollapse`, נזכר לכל
// משתמש). המסילה מחזיקה רק הפניה למתג, ולכן אין שני מקורות אמת.

import { useSyncExternalStore } from 'react';

export type RailTone = 'amber' | 'slate' | 'red' | 'blue' | 'teal' | 'violet' | 'emerald';

export interface RailSection {
  id: string;
  title: string;
  /** כותרת קצרה למסילה, כשהמלאה לא נכנסת בשורה */
  short?: string;
  /** סדר במסך, מלמעלה למטה */
  order: number;
  tone: RailTone;
  /** lucide icon name, נפתר במסילה */
  icon: 'alert' | 'search' | 'gauge' | 'undo' | 'package' | 'wrench' | 'pickup' | 'user' | 'calendar';
  count?: number | null;
  /** ריק כשהאזור לא נסגר (למשל היומן) */
  collapsed?: boolean;
  toggle?: () => void;
}

export interface RailDay {
  date: string; // YYYY-MM-DD
  label: string;
  count: number;
  isToday: boolean;
}

type Listener = () => void;

const sections = new Map<string, RailSection>();
let days: RailDay[] = [];
let snapshot: { sections: RailSection[]; days: RailDay[] } = { sections: [], days: [] };
const listeners = new Set<Listener>();

function emit() {
  snapshot = {
    sections: Array.from(sections.values()).sort((a, b) => a.order - b.order),
    days,
  };
  for (const l of listeners) l();
}

export function railRegister(section: RailSection) {
  const prev = sections.get(section.id);
  // 🔴 בלי שידור על עדכון זהה: הרישום רץ בכל render של האזור.
  if (
    prev &&
    prev.title === section.title &&
    prev.short === section.short &&
    prev.count === section.count &&
    prev.collapsed === section.collapsed &&
    prev.order === section.order &&
    prev.toggle === section.toggle
  ) return;
  sections.set(section.id, section);
  emit();
}

export function railUnregister(id: string) {
  if (sections.delete(id)) emit();
}

export function railSetDays(next: RailDay[]) {
  const same =
    next.length === days.length &&
    next.every((d, i) => d.date === days[i].date && d.count === days[i].count && d.isToday === days[i].isToday);
  if (same) return;
  days = next;
  emit();
}

export function useRail() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => snapshot,
    () => snapshot,
  );
}

/** מזהה ה-DOM של אזור: המסילה גוללת אליו וקוראת את מיקומו. */
export const railAnchorId = (id: string) => `rail-${id}`;

/** גלילה לאזור, מתחת לכותרת הדביקה וללשוניות. */
export function railScrollTo(id: string) {
  const el = document.getElementById(railAnchorId(id));
  if (!el) return;
  const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--app-header-h')) || 61;
  const top = el.getBoundingClientRect().top + window.scrollY - headerH - 64;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

/** קפיצה לעמודת יום ביומן: היומן מאזין ומביא את העמודה לתצוגה. */
export const RAIL_DAY_EVENT = 'rashal:rail-day';
export function railJumpToDay(date: string) {
  railScrollTo('calendar');
  window.dispatchEvent(new CustomEvent(RAIL_DAY_EVENT, { detail: { date } }));
}
