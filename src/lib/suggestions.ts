import { supabase } from './supabase';

/**
 * ההצעות לשדות החופשיים במסך "משימה חדשה".
 *
 * 🔴 **מה שהיה פעם היה זיכרון הטפסים של הדפדפן, לא פיצ'ר שלנו.** הוא
 * פר-מכשיר, פר-פרופיל, ונמחק עם ניקוי היסטוריה, ולכן הוא "נעלם" בלי
 * שאיש נגע בו. כאן הרשימה מגיעה מהנתונים שלנו: משותפת לכל העובדים,
 * שורדת החלפת מחשב, ונשענת על אלפי רשומות אמיתיות ולא על מה שאדם אחד
 * הקליד במקרה.
 */
export interface FieldSuggestions {
  cities: string[];
  customers: string[];
  addresses: string[];
  devices: string[];
  notes: string[];
}

const EMPTY: FieldSuggestions = { cities: [], customers: [], addresses: [], devices: [], notes: [] };

export async function fetchFieldSuggestions(): Promise<FieldSuggestions> {
  const { data, error } = await supabase.rpc('field_suggestions');
  if (error) throw error;
  const d = (data ?? {}) as Partial<FieldSuggestions>;
  return {
    cities: d.cities ?? [],
    customers: d.customers ?? [],
    addresses: d.addresses ?? [],
    devices: d.devices ?? [],
    notes: d.notes ?? [],
  };
}

export const EMPTY_SUGGESTIONS = EMPTY;

export { filterSuggestions } from './suggestion-filter';
