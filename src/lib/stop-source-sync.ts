import { updateOrder } from './orders';
import { updateServiceCall } from './service-calls';
import { updatePickup } from './pickups';
import type { StopSourceType } from '@/types/calendar-stop';

/**
 * סנכרון סטטוס המקור (order / service_call / pickup) בעקבות פעולה ביומן.
 *
 * מרכז את כל מחרוזות הסטטוס במקום אחד, ומאפשר rollback דטרמיניסטי:
 * לכל סוג מקור יש שלושה מצבים, וניתן להחזיר את המקור לכל אחד מהם
 * אם כתיבה שנייה נכשלת (ראה ה-hooks של שיבוץ/מחיקה/ביצוע/העברה).
 *
 * task → אין source, no-op.
 */
export type SourceState = 'scheduled' | 'done' | 'waiting';

export interface SourceRef {
  sourceType: StopSourceType;
  orderId?: string | null;
  serviceCallId?: string | null;
  pickupId?: string | null;
}

const STATUS = {
  delivery: { scheduled: 'תואמה אספקה', done: 'סופק', waiting: 'ממתין לתאום' },
  service: { scheduled: 'תואם ביקור', done: 'בוצע', waiting: 'קריאה חדשה' },
  pickup: { scheduled: 'תואם איסוף', done: 'נאסף', waiting: 'ממתין לתאום' },
} as const;

/** מעדכן את סטטוס המקור למצב המבוקש. task/ללא-מזהה → no-op. */
export async function setSourceState(ref: SourceRef, state: SourceState): Promise<void> {
  if (ref.sourceType === 'delivery' && ref.orderId) {
    await updateOrder(ref.orderId, { orderStatus: STATUS.delivery[state] });
  } else if (ref.sourceType === 'service' && ref.serviceCallId) {
    await updateServiceCall(ref.serviceCallId, { serviceCallStatus: STATUS.service[state] });
  } else if (ref.sourceType === 'pickup' && ref.pickupId) {
    await updatePickup(ref.pickupId, { pickupStatus: STATUS.pickup[state] });
  }
}
