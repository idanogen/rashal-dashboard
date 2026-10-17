import { supabase } from './supabase';
import type { PhoneBookRow } from './contact-phone';

/** ספר הטלפונים של הלקוח (`customer_phone_book`): המשרד, ונהג רק על לקוח שלו. */
export async function fetchPhoneBook(customerNumber: string): Promise<PhoneBookRow[]> {
  const { data, error } = await supabase.rpc('customer_phone_book', { p_customer: customerNumber });
  if (error) throw new Error(error.message);
  return (data ?? []) as PhoneBookRow[];
}

export interface AddContactResult {
  result: 'added' | 'already_linked' | 'is_main_phone' | string;
  phone_local: string;
}

/** הוספת נייד ללקוח ביד (`customer_add_contact`). השגיאות: 'not a mobile number' · 'not authorized'. */
export async function addCustomerContact(customerNumber: string, phone: string, label: string | null): Promise<AddContactResult> {
  const { data, error } = await supabase.rpc('customer_add_contact', {
    p_customer: customerNumber,
    p_phone: phone,
    p_label: label && label.trim() ? label.trim() : null,
  });
  if (error) throw new Error(error.message);
  return data as AddContactResult;
}

/**
 * המתג "מקבל הודעות אוטומטיות" (`customer_set_auto_messages`, 13/10/2026).
 * השגיאות: 'last recipient' · 'not authorized' · 'not a mobile number'.
 */
export async function setAutoMessages(customerNumber: string, phone: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('customer_set_auto_messages', {
    p_customer: customerNumber,
    p_phone: phone,
    p_enabled: enabled,
  });
  if (error) throw new Error(error.message);
}
