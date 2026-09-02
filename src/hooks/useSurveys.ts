import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchSurveys, searchAnsweredSurveys, setSurveyHandled } from '@/lib/surveys';

export function useSurveys(days = 30) {
  return useQuery({
    queryKey: ['surveys', days],
    queryFn: () => fetchSurveys(days),
    staleTime: 60 * 1000,
  });
}

/**
 * חיפוש בכל ההיסטוריה, ולא רק בחלון שהמסך טוען.
 *
 * ⭐ נדלק רק כש-`enabled`, כלומר רק כשהחיפוש בחלון לא מצא כלום. בשימוש
 * הרגיל השאילתה הזאת לא רצה בכלל.
 */
export function useAllAnsweredSurveys(enabled: boolean) {
  return useQuery({
    queryKey: ['surveys', 'all-answered'],
    queryFn: searchAnsweredSurveys,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * סימון "טופל" על דירוג נמוך.
 *
 * 🔴 בלי עדכון אופטימי. השם והשעה נקבעים בשרת, ולכן ציור מקומי של "טופל
 * · <שם>" לפני התשובה היה מציג ניחוש; ההמתנה כאן היא מאות מילישניות.
 */
export function useSetSurveyHandled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, handled }: { id: string; handled: boolean }) =>
      setSurveyHandled(id, handled),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['surveys'] });
      toast.success(vars.handled ? 'סומן כטופל' : 'הסימון בוטל');
    },
    onError: (err: Error) => toast.error(`לא נשמר: ${err.message}`),
  });
}
