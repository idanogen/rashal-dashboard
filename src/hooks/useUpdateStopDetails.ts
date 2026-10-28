import { useMutation, useQueryClient } from '@tanstack/react-query';
import { geocodeStopAddress } from '@/lib/calendar-stops';
import { supabase } from '@/lib/supabase';
import {
  buildStopDetailsPatch, summarizeStopDetailsResult,
  type StopDetailsChangeResult, type StopDetailsCurrent, type StopDetailsForm, type StopDetailsScope,
} from '@/lib/stop-details';
import type { StopSourceType } from '@/types/calendar-stop';
import { toast } from 'sonner';

export interface StopDetailsRef extends StopDetailsCurrent {
  stopId: string;
  sourceId: string;
  sourceType: StopSourceType;
}

/**
 * עריכת פרטי עצירה אחרי שיבוץ. מ-28/10/2026 הכתיבה היא במסד
 * (`stop_details_change`): אותה פונקציה משרתת את האפליקציה, והיא כותבת את
 * העצירה, את הודעת המערכת בצ'אט, את יומן השינויים והמייל למשרד, ובקבוע גם
 * את ההוספה לפריוריטי. כאן נשאר רק המיקום מחדש על המפה (שירות המיפוי זמין
 * לדפדפן) והרענון.
 */
export function useUpdateStopDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stop, form, scope }: { stop: StopDetailsRef; form: StopDetailsForm; scope: StopDetailsScope }) => {
      const patch = buildStopDetailsPatch(stop, form);
      if (patch.empty) return { changed: false } as StopDetailsChangeResult;
      const { data, error } = await supabase.rpc('stop_details_change', {
        p_stop_id: stop.stopId, p_address: form.address, p_city: form.city, p_phone: form.phone, p_scope: scope,
      });
      if (error) throw new Error(error.message);
      const result = (data ?? { changed: false }) as StopDetailsChangeResult;
      if (result.changed && result.relocate) {
        // מיקום חדש על המפה, ואז רענון כדי שהסיכה תזוז. השרת משלים אם הדפדפן לא הספיק.
        const address = 'address' in patch.fields ? patch.fields.address : stop.address ?? undefined;
        const city = 'city' in patch.fields ? patch.fields.city : stop.city ?? undefined;
        void geocodeStopAddress({ id: stop.stopId, address, city })
          .then(() => queryClient.invalidateQueries({ queryKey: ['calendarStops'] }));
      }
      return result;
    },
    onSuccess: (result, vars) => {
      if (!result.changed) return;
      queryClient.invalidateQueries({ queryKey: ['calendarStops'] });
      if (vars.stop.sourceId) queryClient.invalidateQueries({ queryKey: ['timeline', vars.stop.sourceId] });
      toast.success('פרטי העצירה עודכנו', { description: summarizeStopDetailsResult(result) });
    },
    onError: (err) => {
      toast.error('העדכון נכשל', { description: err instanceof Error ? err.message : undefined });
    },
  });
}
