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

async function fetchCustomerTypes(numbers: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < numbers.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('priority_customers')
      .select('custname, customer_type')
      .in('custname', numbers.slice(i, i + CHUNK));
    if (error) throw error;
    for (const r of (data ?? []) as { custname: string; customer_type: string | null }[]) {
      if (r.customer_type) out.set(r.custname, r.customer_type);
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
