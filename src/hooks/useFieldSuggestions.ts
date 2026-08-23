import { useQuery } from '@tanstack/react-query';
import { fetchFieldSuggestions, EMPTY_SUGGESTIONS, type FieldSuggestions } from '@/lib/suggestions';

export const FIELD_SUGGESTIONS_KEY = ['fieldSuggestions'] as const;

/**
 * נטען פעם אחת לסשן. הרשימות קטנות (כמה עשרות קילובייט) ומשתנות לאט,
 * ולכן שאילתה לכל הקלדה הייתה עלות בלי תמורה.
 */
export function useFieldSuggestions(): FieldSuggestions {
  const { data } = useQuery({
    queryKey: FIELD_SUGGESTIONS_KEY,
    queryFn: fetchFieldSuggestions,
    staleTime: 30 * 60 * 1000,
    // נהג לא מורשה לקרוא לזה, ואין טעם לנסות שוב.
    retry: false,
  });
  return data ?? EMPTY_SUGGESTIONS;
}
