/**
 * צוות השטח: נהגי חלוקה וטכנאי שירות.
 *
 * 🔴 **עד 23/08/2026 הרשימה הזאת ישבה בקוד** (טיפוס `driver_name` במסד
 * ושלושה קבצים), ולכן קליטת עובד חדש בשטח הייתה פריסה שלנו. עכשיו היא
 * טבלה, ומסך הצוות מנהל אותה.
 */

export type AssigneeKind = 'driver' | 'technician' | 'both';

/** מפתחות הפלטה. חייבים להתאים ל-CHECK על `assignees.color` במסד. */
export type AssigneeColor =
  | 'blue' | 'emerald' | 'purple' | 'amber' | 'cyan' | 'rose'
  | 'indigo' | 'teal' | 'orange' | 'fuchsia' | 'lime' | 'sky' | 'slate';

export interface Assignee {
  name: string;
  kind: AssigneeKind;
  phone?: string;
  color: AssigneeColor;
  active: boolean;
  sortOrder: number;
}

export interface AssigneeStyle {
  label: string;
  color: string;
  borderColor: string;
  badgeColor: string;
}

export const KIND_LABELS: Record<AssigneeKind, string> = {
  driver: 'נהג חלוקה',
  technician: 'טכנאי שירות',
  both: 'נהג וטכנאי',
};

/**
 * 🔴 **הצבע נשמר כמפתח ולא כמחלקת Tailwind.** Tailwind סורק את הקוד
 * בזמן הבנייה ומייצר רק מחלקות שהוא ראה כטקסט. מחרוזת שמגיעה מהמסד
 * לא תיווצר לעולם, והתוצאה הייתה כרטיס בלי צבע בכלל.
 */
const PALETTE: Record<AssigneeColor, Omit<AssigneeStyle, 'label'>> = {
  blue:    { color: 'bg-blue-100 text-blue-700',       borderColor: 'border-s-blue-500',    badgeColor: 'bg-blue-500' },
  emerald: { color: 'bg-emerald-100 text-emerald-700', borderColor: 'border-s-emerald-500', badgeColor: 'bg-emerald-500' },
  purple:  { color: 'bg-purple-100 text-purple-700',   borderColor: 'border-s-purple-500',  badgeColor: 'bg-purple-500' },
  amber:   { color: 'bg-amber-100 text-amber-700',     borderColor: 'border-s-amber-500',   badgeColor: 'bg-amber-500' },
  cyan:    { color: 'bg-cyan-100 text-cyan-700',       borderColor: 'border-s-cyan-500',    badgeColor: 'bg-cyan-500' },
  rose:    { color: 'bg-rose-100 text-rose-700',       borderColor: 'border-s-rose-500',    badgeColor: 'bg-rose-500' },
  indigo:  { color: 'bg-indigo-100 text-indigo-700',   borderColor: 'border-s-indigo-500',  badgeColor: 'bg-indigo-500' },
  teal:    { color: 'bg-teal-100 text-teal-700',       borderColor: 'border-s-teal-500',    badgeColor: 'bg-teal-500' },
  orange:  { color: 'bg-orange-100 text-orange-700',   borderColor: 'border-s-orange-500',  badgeColor: 'bg-orange-500' },
  fuchsia: { color: 'bg-fuchsia-100 text-fuchsia-700', borderColor: 'border-s-fuchsia-500', badgeColor: 'bg-fuchsia-500' },
  lime:    { color: 'bg-lime-100 text-lime-700',       borderColor: 'border-s-lime-500',    badgeColor: 'bg-lime-500' },
  sky:     { color: 'bg-sky-100 text-sky-700',         borderColor: 'border-s-sky-500',     badgeColor: 'bg-sky-500' },
  slate:   { color: 'bg-slate-100 text-slate-700',     borderColor: 'border-s-slate-500',   badgeColor: 'bg-slate-500' },
};

export const PALETTE_KEYS = Object.keys(PALETTE) as AssigneeColor[];

export function styleForColor(color: AssigneeColor | string, label: string): AssigneeStyle {
  const p = PALETTE[color as AssigneeColor] ?? PALETTE.slate;
  return { label, ...p };
}

/** צבע פנוי הבא, כדי ששני עובדים לא ייראו זהים ביומן. */
export function nextFreeColor(taken: Iterable<string>): AssigneeColor {
  const used = new Set(taken);
  return PALETTE_KEYS.find((c) => c !== 'slate' && !used.has(c)) ?? 'slate';
}
