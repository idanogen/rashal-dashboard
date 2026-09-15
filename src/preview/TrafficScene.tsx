import { useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import { DispatchCard } from '@/components/dispatch/UnscheduledPanel';
import { ServiceTrafficLight } from '@/components/dispatch/ServiceTrafficLight';
import { buildServiceCallItems } from '@/components/dispatch/items';
import { compareByLight, parseLights, type ServiceLight } from '@/lib/service-call-light';
import type { ServiceCall } from '@/types/service-call';
import type { MediaRequestState } from '@/hooks/useMediaRequests';

/**
 * ?view=lights: רמזור קריאות השירות (15/09/2026). הקריאות, הנהגים והמספרים
 * אמיתיים מ-15/09; הסימון הירוק הידני הוא דוגמה.
 */
const call = (id: string, name: string, city: string, device: string, created: string): ServiceCall =>
  ({ id, customerName: name, city, address: '', deviceName: device, created, serviceCallStatus: 'קריאה חדשה' }) as unknown as ServiceCall;

const CALLS: ServiceCall[] = [
  call('o1', 'כהן יונתן יוסף', 'רמלה', 'Q300 MINI', '2026-09-09T12:45:00Z'),
  call('o2', 'חובב יואב', 'מבשרת ציון', 'SUNRISE 175', '2026-08-25T14:04:00Z'),
  call('g1', 'גוליזדה פורן', 'פתח תקווה', 'SUNRISE 175', '2026-09-15T08:00:00Z'),
  call('g2', 'אמיגה לירז', 'קרית מוצקין', 'Q400R', '2026-09-14T08:00:00Z'),
  call('g3', 'דוגמה: ירוק ידני', 'חיפה', 'Q6-EDGE', '2026-09-14T09:00:00Z'),
  call('r1', 'סבוני חביב', 'אשקלון', 'SRQ400M', '2026-09-15T10:35:00Z'),
  call('r2', 'בורשטיין אביטל', 'מודיעין עילית', 'IRIS', '2026-09-09T08:00:00Z'),
  call('y1', 'גרגירי יהודית', 'גני תקווה', 'Q6-EDGE', '2026-09-09T08:00:00Z'),
];

const LIGHTS = parseLights([
  { service_call_id: 'o1', light: 'orange', opened_at: '2026-09-09T12:45:00Z', touch_driver: 'אולג', touch_date: '2026-09-14', touch_status: 'not_completed', touch_kind: 'follow_up', touch_note: 'חסר חלק, צריך להזמין' },
  { service_call_id: 'o2', light: 'orange', opened_at: '2026-08-25T14:04:00Z', touch_driver: 'ישראל', touch_date: '2026-08-30', touch_status: 'not_completed', touch_kind: 'follow_up', touch_note: 'צריך ערסל L עם תמיכת ראש. דחוף' },
  { service_call_id: 'g1', light: 'green', opened_at: '2026-09-15T08:00:00Z', images: 0, videos: 1 },
  { service_call_id: 'g2', light: 'green', opened_at: '2026-09-14T08:00:00Z', images: 1, videos: 1 },
  { service_call_id: 'g3', light: 'green', opened_at: '2026-09-14T09:00:00Z', manual_by: 'עמי גז', manual_at: '2026-09-15T11:20:00Z', manual_reason: 'phone_described' },
  { service_call_id: 'r1', light: 'red', opened_at: '2026-09-15T10:35:00Z' },
  { service_call_id: 'r2', light: 'red', opened_at: '2026-09-09T08:00:00Z', touch_driver: 'אולג', touch_date: '2026-09-14', touch_status: 'not_completed', touch_kind: 'not_done', touch_note: 'הלקוח לא היה בבית' },
  { service_call_id: 'y1', light: 'yellow', opened_at: '2026-09-09T08:00:00Z' },
]);

const MEDIA = new Map<string, MediaRequestState>([
  ['r1', { serviceCallId: 'r1', state: 'first_sent', mediaReceivedAt: null }],
]);

export function TrafficScene() {
  const [selected, setSelected] = useState<Set<ServiceLight>>(new Set());
  const items = buildServiceCallItems(CALLS, new Map(), undefined, MEDIA, LIGHTS, () => {})
    .filter((vm) => selected.size === 0 || selected.has(LIGHTS.get(vm.id)!.light))
    .sort((a, b) => compareByLight(LIGHTS.get(a.id), LIGHTS.get(b.id)));
  return (
    <DndContext>
      <div dir="rtl" className="min-h-screen space-y-4 bg-slate-50 p-4">
        <div className="mx-auto max-w-6xl space-y-4">
          <ServiceTrafficLight
            counts={{ red: 371, green: 29, orange: 2, yellow: 26, redWeek: 29, redLastWeek: 19, redOld: 323 }}
            selected={selected}
            onToggle={(l) => setSelected((p) => { const n = new Set(p); if (n.has(l)) n.delete(l); else n.add(l); return n; })}
            showOldRed={false}
            onToggleOldRed={() => {}}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((vm) => (
              <DispatchCard key={vm.id} vm={vm} accentBorder={vm.accentBorder ?? 'border-s-orange-500'} />
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
