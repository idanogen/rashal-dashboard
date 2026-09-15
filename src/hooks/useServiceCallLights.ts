import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { parseLights, type ManualReason, type ServiceCallLight } from '@/lib/service-call-light';

/**
 * רמזור קריאות השירות (15/09/2026): צבע לכל קריאה פתוחה, מהמסד.
 * 🔴 תמונה מהלקוח לא מגיעה ב-realtime של הטבלאות שהמסך מאזין להן, ולכן
 * רענון כל שתי דקות: קריאה שקיבלה תמונה הופכת לירוקה בלי לרענן את הדף.
 */
export function useServiceCallLights() {
  return useQuery({
    queryKey: ['service-call-lights'],
    queryFn: async (): Promise<Map<string, ServiceCallLight>> => {
      const { data, error } = await supabase.rpc('service_call_lights');
      if (error) throw new Error(`service_call_lights: ${error.message}`);
      return parseLights(data);
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

/** סימון ירוק ידני: סיבה, פירוט, וחתימה של המשתמש המחובר (במסד). */
export function useMarkServiceCallGreen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { callId: string; reason: ManualReason; note?: string }) => {
      const { data, error } = await supabase.rpc('mark_service_call_green', {
        p_call: vars.callId,
        p_reason: vars.reason,
        p_note: vars.note?.trim() || null,
      });
      if (error) throw new Error(error.message);
      return data as { ok: boolean; by: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-call-lights'] });
      qc.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
}
