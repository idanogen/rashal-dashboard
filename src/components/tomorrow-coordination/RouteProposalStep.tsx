import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Edit, CheckCircle2, AlertCircle } from 'lucide-react';
import type { OptimizedRoute } from '@/hooks/useRouteOptimizer';
import { MAX_GOOGLE_MAPS_STOPS } from '@/lib/maps';
import { getDaysColor } from '@/lib/utils';

interface RouteProposalStepProps {
  /** המסלול המוצע */
  route: OptimizedRoute;
  /** קריאה חוזרת לאישור */
  onAccept: () => void;
  /** קריאה חוזרת לעריכה */
  onEdit: () => void;
  /** קריאה חוזרת לחזרה */
  onBack: () => void;
}

/**
 * שלב 2: הצגת המסלול המוצע
 *
 * מציג את המסלול שנוצר על ידי האלגוריתם
 * ומאפשר למשתמש לאשר או לעבור לעריכה
 */
export function RouteProposalStep({
  route,
  onAccept,
  onEdit,
  onBack,
}: RouteProposalStepProps) {
  const { orders, totalDistance, hasGeocoding } = route;
  const overLimit = orders.length > MAX_GOOGLE_MAPS_STOPS;

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-semibold">המסלול המומלץ שלך</h3>
        <div className="flex items-center justify-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {orders.length} עצירות
          </Badge>
          {hasGeocoding && totalDistance > 0 && (
            <Badge variant="outline" className="text-sm">
              ~{totalDistance} ק״מ
            </Badge>
          )}
        </div>
      </div>

      {/* Warnings */}
      {!hasGeocoding && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            לא הצלחנו למקם חלק מהכתובות, המסלול מסודר לפי עדיפות (הזמנות
            ותיקות) ולא לפי קרבה גיאוגרפית.
          </p>
        </div>
      )}

      {overLimit && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Google Maps תומך עד {MAX_GOOGLE_MAPS_STOPS} עצירות בקישור. חלק
            מהכתובות לא ייכללו בניווט. שקול לפצל למספר מסלולים.
          </p>
        </div>
      )}

      {/* Numbered Route List */}
      <div className="max-h-[400px] space-y-2 overflow-y-auto rounded-lg border p-3">
        {orders.map((order, index) => {
          const days = order.created
            ? Math.floor(
                (Date.now() - new Date(order.created).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : null;
          const daysColor = getDaysColor(days);

          return (
            <div
              key={order.id}
              className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30"
            >
              {/* מספר */}
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {index + 1}
              </span>

              {/* פרטי הזמנה */}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold">{order.customerName}</p>
                <p className="text-sm text-muted-foreground">
                  {order.address}, {order.city}
                </p>
                {order.phone && (
                  <p className="text-xs text-muted-foreground">
                    {order.phone}
                  </p>
                )}
              </div>

              {/* Badge ימים */}
              {days !== null && (
                <Badge
                  variant="outline"
                  className={`shrink-0 text-xs ${daysColor}`}
                >
                  {days} ימים
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {/* כפתור ראשי - עריכה */}
        <Button onClick={onEdit} size="lg" className="w-full gap-2">
          <Edit className="h-4 w-4" />
          נראה טוב! עבור לעריכה
        </Button>

        {/* כפתור משני - אישור ישיר */}
        <Button
          onClick={onAccept}
          variant="outline"
          size="lg"
          className="w-full gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          מושלם - דלג לייצוא
        </Button>

        {/* לינק חזרה */}
        <Button
          onClick={onBack}
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground"
        >
          <ArrowRight className="h-3 w-3 rotate-180" />
          חזרה לבחירת כמות
        </Button>
      </div>
    </div>
  );
}
