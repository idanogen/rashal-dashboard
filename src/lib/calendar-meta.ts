import { ClipboardList, Package, Undo2, UserPlus, Wrench } from 'lucide-react';

/**
 * מטא-דאטה של היומן, משותף לכרטיס העצירה, למקרא ולעמודת היום. הוצא מ-
 * `DeliveryCalendar.tsx` ב-28/10/2026 כשהקובץ פוצל (1,057 שורות).
 * הוספת סוג עצירה נוגעת גם כאן (ראה `grep SOURCE_META` ב-CLAUDE.md).
 */
// פורמט תאריך מקומי (לא UTC) למניעת באגי timezone
export const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// מטא-דאטה לכל סוג עצירה — אייקון, צבע, פס-צד, ותווית. משמש גם את הכרטיס וגם את המקרא.
export const SOURCE_META = {
  delivery: { Icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-s-blue-500', dot: 'bg-blue-500', label: 'משלוח' },
  service: { Icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-s-orange-500', dot: 'bg-orange-500', label: 'שירות' },
  pickup: { Icon: Undo2, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-s-teal-500', dot: 'bg-teal-500', label: 'איסוף' },
  task: { Icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-s-amber-500', dot: 'bg-amber-500', label: 'משימה' },
  customer: { Icon: UserPlus, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-s-violet-500', dot: 'bg-violet-500', label: 'לקוח חדש' },
} as const;
export const SOURCE_ORDER =['delivery', 'service', 'pickup', 'task', 'customer'] as const;
