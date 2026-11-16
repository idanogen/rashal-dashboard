/**
 * לאיזו ישות נרשמת הודעת מערכת של עצירה בציר הזמן (טהור, בלי ייבוא).
 *
 * 🔴 16/11/2026: העברת איסוף של ברוך זינבול נרשמה עם מזהה האיסוף בעמודת
 * ההזמנה (`order_id`) ונפלה על מפתח זר, והמשרד קיבל שגיאה אחרי שההעברה
 * כבר נקלטה. רק אספקה היא הזמנה; שירות הוא קריאה; כל השאר (איסוף, לקוח חדש,
 * בדיקה, משימה) נרשמים על העצירה עצמה.
 */
export type TimelineSourceKind = 'order' | 'service' | 'stop';

export function timelineSourceForStop(stop: {
  stopId: string;
  sourceType: string;
  sourceId?: string | null;
}): { kind: TimelineSourceKind; id: string } {
  if (stop.sourceType === 'delivery' && stop.sourceId) return { kind: 'order', id: stop.sourceId };
  if (stop.sourceType === 'service' && stop.sourceId) return { kind: 'service', id: stop.sourceId };
  return { kind: 'stop', id: stop.stopId };
}
