import { useState } from 'react';
import { Undo2, MapPin, X } from 'lucide-react';
import type { ServiceCall } from '@/types/service-call';
import { OrderChatButton } from '@/components/OrderChatButton';
import { DoubleConfirmDialog } from '@/components/DoubleConfirmDialog';
import { useUpdateServiceCall } from '@/hooks/useUpdateServiceCall';
import { useActivityLogger } from '@/hooks/useActivityLogger';

interface ReturnedServiceCallsSectionProps {
  /** Service calls that came back from the route (a not_completed stop exists). */
  calls: ServiceCall[];
}

/**
 * "חזרו מהקו" עבור קריאות שירות — מקביל ל-ReturnedFromRouteSection של הזמנות.
 * קריאות שסומנו "לא בוצע" וחזרו לממתינות. כל כרטיס עם ביטול (אישור כפול).
 */
export function ReturnedServiceCallsSection({ calls }: ReturnedServiceCallsSectionProps) {
  const [cancelTarget, setCancelTarget] = useState<ServiceCall | null>(null);
  const updateServiceCall = useUpdateServiceCall();
  const log = useActivityLogger();

  if (calls.length === 0) return null;

  const handleCancel = () => {
    if (!cancelTarget) return;
    const call = cancelTarget;
    log('service_call_cancelled', {
      entityType: 'service_call',
      entityId: call.id,
      customerName: call.customerName,
    });
    updateServiceCall.mutate(
      { id: call.id, fields: { serviceCallStatus: 'בוטל' } },
      { onSuccess: () => setCancelTarget(null) }
    );
  };

  return (
    <div className="rounded-lg border border-red-300 bg-red-50/60 p-3 shadow-sm dark:border-red-900 dark:bg-red-950/10">
      <div className="mb-2 flex items-center gap-2">
        <Undo2 className="h-4 w-4 text-red-600" />
        <h3 className="text-sm font-bold text-red-700 dark:text-red-400">
          חזרו מהקו ({calls.length})
        </h3>
        <span className="text-[11px] text-red-600/70">
          סומנו "לא בוצע" — ממתינות לשיבוץ מחדש
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {calls.map((call) => (
          <div
            key={call.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-background/80 p-2 dark:border-red-900/50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{call.customerName}</p>
              {(call.address || call.city) && (
                <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                  <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                  <span className="truncate">
                    {call.address}
                    {call.address && call.city ? ', ' : ''}
                    {call.city}
                  </span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <OrderChatButton
                order={{ id: call.id, customerName: call.customerName, city: call.city, kind: 'service' }}
              />
              <button
                onClick={() => setCancelTarget(call)}
                title="בטל קריאת שירות (לא רלוונטית)"
                className="flex h-7 w-7 items-center justify-center rounded-md text-red-600 transition-colors hover:bg-red-100 dark:hover:bg-red-950/40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <DoubleConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => {
          if (!o) setCancelTarget(null);
        }}
        itemName={cancelTarget?.customerName}
        message="האם לבטל את קריאת השירות? היא תסומן כבוטלה ותוסר מהרשימות הפעילות."
        confirmLabel="כן, בטל קריאה"
        submitting={updateServiceCall.isPending}
        onConfirm={handleCancel}
      />
    </div>
  );
}
