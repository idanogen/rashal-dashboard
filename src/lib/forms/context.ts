import { supabase } from '@/lib/supabase';
import type { CalendarStop } from '@/types/calendar-stop';
import type { Order, OrderItem } from '@/types/order';
import type { ServiceCall } from '@/types/service-call';
import type { FormContext, FormKind } from './types';
import { EMPTY_CONTEXT } from './types';
import { buildContextFromOrder, buildContextFromServiceCall } from './prefill';

/**
 * בניית הקשר הטופס מתוך עצירה ביומן.
 *
 * העצירה לבדה מספיקה כדי לפתוח טופס: היא נושאת שם, כתובת, עיר, טלפון ומספר
 * לקוח. הישות המלאה (הזמנה או קריאת שירות) מוסיפה את פרטי המכשיר, וזה מה
 * שהופך את טופס התיקון לכזה שמתמלא כמעט לבד.
 *
 * 🔑 המשיכה של הישות המלאה עוטפת בכשל רך במכוון. ה-RLS של הנהג נבדק על
 * עדכון, לא על קריאה, ואם הוא לא יחזיר את השורה הטופס עדיין ייפתח עם מה
 * שיש בעצירה. נהג שעומד מול לקוח לא אמור להיתקע בגלל מדיניות הרשאות.
 */

function baseFromStop(stop: CalendarStop, driverName: string): FormContext {
  const parts = stop.customerName.trim().split(/\s+/).filter(Boolean);
  const addressMatch = (stop.address ?? '').trim().match(/^(.*?)[\s,]+(\d+[א-ת]?)\s*$/);
  const now = new Date();

  return {
    ...EMPTY_CONTEXT,
    customerName: stop.customerName,
    lastName: parts[0] ?? '',
    firstName: parts.slice(1).join(' '),
    phone: stop.phone ?? '',
    address: addressMatch ? addressMatch[1].trim() : (stop.address ?? ''),
    houseNumber: addressMatch ? addressMatch[2] : '',
    city: stop.city ?? '',
    customerNumber: stop.customerNumber ?? '',
    driverName,
    today: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  };
}

export interface LoadedFormContext {
  context: FormContext;
  /** הקופה שקובעת איזה טופס ייפתח. מגיעה מהישות, לא מהעצירה. */
  healthFund?: string;
  customerNumber?: string;
  /** האם הצלחנו למשוך את הישות המלאה, או שנפלנו לנתוני העצירה בלבד. */
  enriched: boolean;
}

export async function loadFormContext(
  stop: CalendarStop,
  driverName: string,
): Promise<LoadedFormContext> {
  const fallback = baseFromStop(stop, driverName);

  try {
    if (stop.sourceType === 'delivery' && stop.orderId) {
      const { data } = await supabase
        .from('orders')
        .select('id, customer_name, phone, address, city, health_fund, customer_number, items')
        .eq('id', stop.orderId)
        .maybeSingle();

      if (data) {
        const order: Order = {
          id: data.id as string,
          customerName: (data.customer_name as string) ?? stop.customerName,
          phone: (data.phone as string) ?? undefined,
          address: (data.address as string) ?? undefined,
          city: (data.city as string) ?? undefined,
          healthFund: (data.health_fund as string) ?? undefined,
          customerNumber: (data.customer_number as string) ?? undefined,
          items: (data.items as OrderItem[] | null) ?? undefined,
          created: '',
        };
        return {
          context: buildContextFromOrder(order, driverName),
          healthFund: order.healthFund,
          customerNumber: order.customerNumber,
          enriched: true,
        };
      }
    }

    if (stop.sourceType === 'service' && stop.serviceCallId) {
      const { data } = await supabase
        .from('service_calls')
        .select(
          'id, customer_name, phone, address, city, health_fund, customer_number, device_serial, device_name, device_desc, install_date, warranty_until, fault_desc, symptom_desc',
        )
        .eq('id', stop.serviceCallId)
        .maybeSingle();

      if (data) {
        const call: ServiceCall = {
          id: data.id as string,
          customerName: (data.customer_name as string) ?? stop.customerName,
          phone: (data.phone as string) ?? undefined,
          address: (data.address as string) ?? undefined,
          city: (data.city as string) ?? undefined,
          healthFund: (data.health_fund as string) ?? undefined,
          customerNumber: (data.customer_number as string) ?? undefined,
          deviceSerial: (data.device_serial as string) ?? undefined,
          deviceName: (data.device_name as string) ?? undefined,
          deviceDesc: (data.device_desc as string) ?? undefined,
          installDate: (data.install_date as string) ?? undefined,
          warrantyUntil: (data.warranty_until as string) ?? undefined,
          faultDesc: (data.fault_desc as string) ?? undefined,
          symptomDesc: (data.symptom_desc as string) ?? undefined,
          created: '',
        };
        return {
          context: buildContextFromServiceCall(call, driverName),
          healthFund: call.healthFund,
          customerNumber: call.customerNumber,
          enriched: true,
        };
      }
    }
  } catch (e) {
    console.error('[loadFormContext] falling back to stop data:', e);
  }

  return {
    context: fallback,
    healthFund: undefined,
    customerNumber: stop.customerNumber,
    enriched: false,
  };
}

/** סוג הטופס שנדרש לסגירת עצירה, לפי סוג המקור. */
export function formKindForStop(stop: CalendarStop): FormKind | null {
  if (stop.sourceType === 'delivery' || stop.sourceType === 'customer') return 'delivery';
  if (stop.sourceType === 'service') return 'repair';
  if (stop.sourceType === 'pickup') return 'return';
  return null; // משימה — אין טופס
}
