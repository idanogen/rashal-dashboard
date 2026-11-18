import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * סוג הלקוח (CTYPENAME, הקופה) לפי מספר לקוח, לסינון לפי קופה במסך הסדרן (04/11/2026).
 * לאיסופים, לעצירות ביומן וללקוחות חדשים אין קופה על הרשומה, וכרטיס הלקוח
 * מחזיק אותה ב-`customer_type` (98% מהאיסופים הממתינים, 87% מעצירות השבוע).
 * 🔴 תקרת 1,000 השורות של PostgREST וגם אורך ה-URL: המספרים נשלחים במנות של 150.
 */
const CHUNK = 150;

/**
 * ⭐ 18/11/2026: הקופה של הלקוח מ-`customer_fund_lookup`: המשלם במסמך האחרון שלו (קריאה
 * או הזמנה), אחרת סוג הלקוח כשהוא קופה. "משרד הבריאות" כסוג לקוח אינו קופה ולא חוזר.
 */
async function fetchCustomerTypes(numbers: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < numbers.length; i += CHUNK) {
    const { data, error } = await supabase.rpc('customer_fund_lookup', { p_numbers: numbers.slice(i, i + CHUNK) });
    if (error) throw error;
    for (const r of (data ?? []) as { customer_number: string; fund: string | null }[]) {
      if (r.fund) out.set(r.customer_number, r.fund);
    }
  }
  return out;
}

export function useCustomerTypes(customerNumbers: Iterable<string | undefined | null>) {
  const numbers = useMemo(() => {
    const s = new Set<string>();
    for (const n of customerNumbers) if (n && n.trim()) s.add(n.trim());
    return [...s].sort();
  }, [customerNumbers]);
  return useQuery({
    queryKey: ['customer-types', numbers.join(',')],
    queryFn: () => fetchCustomerTypes(numbers),
    enabled: numbers.length > 0,
    staleTime: 10 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}
