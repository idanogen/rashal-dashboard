import { supabase } from './supabase';
import { CRANE_CHECKLIST_VERSION, type CraneVerdict } from './crane-checklist';

/**
 * שמירת טופס מנוף חתום.
 *
 * 🔴 **אין כאן `update` ואין `delete`, וגם ה-RLS אינו מרשה אותם.** טופס
 * בטיחות חתום שאפשר לערוך אחרי החתימה אינו טופס חתום. תיקון נעשה במילוי
 * חדש, וההיסטוריה נשארת שלמה.
 */
export interface CraneFormInput {
  formType: 'inspection' | 'training';
  craneSerial?: string | null;
  customerName?: string | null;
  customerNumber?: string | null;
  stopId?: string | null;
  serviceCallId?: string | null;
  orderId?: string | null;
  answers: Record<string, boolean>;
  verdict: CraneVerdict | null;
  notes?: string;
  technicianName?: string | null;
  recipientName: string;
  recipientIdNumber?: string;
  recipientRelation?: string;
  recipientSignature?: string | null;
  slingManufacturer?: string;
  slingProductionDate?: string;
  slingSerial?: string;
}

export async function saveCraneForm(input: CraneFormInput): Promise<string> {
  const { data, error } = await supabase
    .from('crane_forms')
    .insert({
      form_type: input.formType,
      // ⭐ הגרסה נשמרת עם המילוי, ולכן טופס שנחתם לפני שנה נשאר קריא
      // בדיוק כפי שנחתם גם אחרי שהנוסח יתעדכן.
      checklist_version: CRANE_CHECKLIST_VERSION,
      crane_serial: input.craneSerial ?? null,
      customer_name: input.customerName ?? null,
      customer_number: input.customerNumber ?? null,
      stop_id: input.stopId ?? null,
      service_call_id: input.serviceCallId ?? null,
      order_id: input.orderId ?? null,
      answers: input.answers,
      verdict: input.verdict,
      notes: input.notes?.trim() || null,
      technician_name: input.technicianName ?? null,
      recipient_name: input.recipientName.trim(),
      recipient_id_number: input.recipientIdNumber?.trim() || null,
      recipient_relation: input.recipientRelation?.trim() || null,
      recipient_signature: input.recipientSignature ?? null,
      sling_manufacturer: input.slingManufacturer?.trim() || null,
      sling_production_date: input.slingProductionDate?.trim() || null,
      sling_serial: input.slingSerial?.trim() || null,
    })
    .select('id')
    .single();

  if (error) throw new Error(`saveCraneForm: ${error.message}`);
  return (data as { id: string }).id;
}

/** הטפסים של מנוף מסוים, החדש קודם. */
export async function fetchCraneForms(serial: string) {
  const { data, error } = await supabase
    .from('crane_forms')
    .select('*')
    .eq('crane_serial', serial)
    .order('submitted_at', { ascending: false });
  if (error) throw new Error(`fetchCraneForms: ${error.message}`);
  return data ?? [];
}
