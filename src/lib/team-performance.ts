import { supabase } from './supabase';
import type { TeamPerson } from './team-metrics';

/**
 * שליפת מדדי הצוות.
 *
 * ⭐ **קריאה אחת ל-`team_performance`**, שמחשבת הכל במסד. חלופה שמושכת
 * את כל העצירות לדפדפן הייתה גוררת אלף שורות בכל פתיחה כדי להציג שמונה,
 * וזה בדיוק מה שכבר נשך במסך הסדרן. [[new_customers_rpc]]
 */
export interface TeamPerformance {
  windowDays: number;
  from: string;
  to: string;
  people: TeamPerson[];
  reasons: { reason: string; n: number }[];
  /**
   * זמן מהזמנה עד אספקה.
   * 🔴 `n` הוא המכנה האמיתי, והוא קטן מ-`ofCompleted`: רק אספקה שמקושרת
   * להזמנה יודעת מתי ההזמנה נפתחה. המסך מציג את שני המספרים.
   */
  leadTime: {
    n: number; median: number | null; p90: number | null;
    d0_2: number; d3_7: number; d8_14: number; over14: number; ofCompleted: number;
  };
  /** ביקורים חוזרים אצל אותו לקוח בתוך החלון */
  repeat: { customers: number; withRepeat: number; visits: number; closedWithCustomer: number };
  /** עומס לפי יום בשבוע. 0 = ראשון */
  byDow: { dow: number; stops: number; completed: number }[];
  totals: {
    stops: number;
    completed: number;
    notCompleted: number;
    openFromPast: number;
    closedSameDay: number;
    withArrival: number;
  };
}

export async function fetchTeamPerformance(days: number): Promise<TeamPerformance> {
  const { data, error } = await supabase.rpc('team_performance', { p_days: days });
  if (error) throw error;
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    windowDays: Number(d.window_days ?? days),
    from: String(d.from ?? ''),
    to: String(d.to ?? ''),
    people: (d.people ?? []) as TeamPerson[],
    reasons: (d.reasons ?? []) as { reason: string; n: number }[],
    leadTime: (d.leadTime ?? {
      n: 0, median: null, p90: null, d0_2: 0, d3_7: 0, d8_14: 0, over14: 0, ofCompleted: 0,
    }) as TeamPerformance['leadTime'],
    repeat: (d.repeat ?? { customers: 0, withRepeat: 0, visits: 0, closedWithCustomer: 0 }) as TeamPerformance['repeat'],
    byDow: (d.byDow ?? []) as TeamPerformance['byDow'],
    totals: (d.totals ?? {
      stops: 0, completed: 0, notCompleted: 0, openFromPast: 0, closedSameDay: 0, withArrival: 0,
    }) as TeamPerformance['totals'],
  };
}
