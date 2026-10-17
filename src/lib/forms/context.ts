import type { SupabaseClient } from '@supabase/supabase-js';
import { formsClient } from './client.ts';
import type { FormContext, FormLine } from './types.ts';
import { buildContext } from './prefill.ts';

/**
 * מה שהטופס צריך לדעת על העצירה, ממקור אחד: `stop_form_context` במסד.
 *
 * ⭐ פונקציה במסד ולא שליפות מהטבלאות, כי הנהג לא קורא את `orders`,
 * `service_calls` ו-`pickups` ישירות (RLS), ובחירת הקופה צריכה להיות
 * זהה בכל מקום שפותח טופס: הקופה של ההזמנה או הקריאה, ואם ריקה אז
 * סוג הלקוח בכרטיס (שניהם CTYPENAME בפריוריטי).
 */

export interface SignedFormRef {
  id: string;
  formKey: string;
  signedAt: string;
  signedBy: string | null;
}

export interface LoadedFormContext {
  stopId: string;
  sourceType: string;
  driver: string;
  customerNumber: string | null;
  healthFund: string | null;
  docNumber: string | null;
  context: FormContext;
  lines: FormLine[];
  /** טפסים שכבר נחתמו על העצירה הזו. */
  signed: SignedFormRef[];
  orderId: string | null;
  serviceCallId: string | null;
  /** מנוף בעצירה: קריאה על מנוף = בדיקה, אספקת מנוף = הדרכה. null = אין. */
  crane: { kind: 'inspection' | 'training'; serial: string | null; model: string | null } | null;
  /** טפסי מנוף שכבר נחתמו על העצירה. */
  craneSigned: { id: string; formType: string; submittedAt: string }[];
}

interface Raw {
  stop_id: string;
  source_type: string;
  driver: string | null;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  customer_number: string | null;
  health_fund: string | null;
  doc_number: string | null;
  device_name: string | null;
  device_desc: string | null;
  device_serial: string | null;
  install_date: string | null;
  warranty_until: string | null;
  fault_desc: string | null;
  lines: FormLine[] | null;
  signed: { id: string; form_key: string; signed_at: string; signed_by: string | null }[] | null;
  order_id: string | null;
  service_call_id: string | null;
  crane: { kind: 'inspection' | 'training'; serial: string | null; model: string | null } | null;
  crane_signed: { id: string; form_type: string; submitted_at: string }[] | null;
}

export async function loadFormContext(
  stopId: string,
  driverName?: string,
  client: SupabaseClient = formsClient(),
): Promise<LoadedFormContext | null> {
  const { data, error } = await client.rpc('stop_form_context', { p_stop_id: stopId });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as Raw;
  const lines = (r.lines ?? []).filter((l) => l.name || l.serial);
  const driver = driverName ?? r.driver ?? '';

  return {
    stopId: r.stop_id,
    sourceType: r.source_type,
    driver,
    customerNumber: r.customer_number,
    healthFund: r.health_fund,
    docNumber: r.doc_number,
    lines,
    orderId: r.order_id,
    serviceCallId: r.service_call_id,
    crane: r.crane,
    craneSigned: (r.crane_signed ?? []).map((c) => ({ id: c.id, formType: c.form_type, submittedAt: c.submitted_at })),
    signed: (r.signed ?? []).map((s) => ({
      id: s.id, formKey: s.form_key, signedAt: s.signed_at, signedBy: s.signed_by,
    })),
    context: buildContext(
      {
        customerName: r.customer_name ?? '',
        phone: r.phone,
        address: r.address,
        city: r.city,
        customerNumber: r.customer_number,
        healthFund: r.health_fund,
        docNumber: r.doc_number,
        deviceName: r.device_name,
        deviceDesc: r.device_desc,
        deviceSerial: r.device_serial,
        installDate: r.install_date,
        warrantyUntil: r.warranty_until,
        faultDesc: r.fault_desc,
        lines,
      },
      driver,
    ),
  };
}

export { formKindForStop } from './registry.ts';
