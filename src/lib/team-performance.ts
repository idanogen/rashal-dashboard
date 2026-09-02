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
    totals: (d.totals ?? {
      stops: 0, completed: 0, notCompleted: 0, openFromPast: 0, closedSameDay: 0, withArrival: 0,
    }) as TeamPerformance['totals'],
  };
}
