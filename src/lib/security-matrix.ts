import { supabase } from './supabase';
import type { TableRow } from './policy-audience';

/** צילום כללי האבטחה מהמסד. ראה `security_matrix()` במיגרציה. */
export async function fetchSecurityMatrix(): Promise<TableRow[]> {
  const { data, error } = await supabase.rpc('security_matrix');
  if (error) throw error;
  return (data ?? []) as TableRow[];
}
