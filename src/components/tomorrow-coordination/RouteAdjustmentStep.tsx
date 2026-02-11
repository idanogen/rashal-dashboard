import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Download, ArrowLeft } from 'lucide-react';
import type { Order } from '@/types/order';
import { DraggableRouteList } from './DraggableRouteList';
import { AvailableOrdersPanel } from './AvailableOrdersPanel';
import { buildRouteUrl, MAX_GOOGLE_MAPS_STOPS } from '@/lib/maps';
import { exportRouteToCSV } from '@/lib/export';

interface RouteAdjustmentStepProps {
  /** המסלול ההתחלתי */
  initialRoute: Order[];
  /** כל ההזמנות */
  allOrders: Order[];
  /** קריאה חוזרת להמשך */
  onNext: (finalRoute: Order[]) => void;
}

/**
 * שלב 3: התאמה ידנית של המסלול
 *
 * מאפשר:
 * - Drag & Drop לשינוי סדר
 * - הסרת הזמנות מהמסלול
 * - הוספת הזמנות מהפאנל הזמין
 * - ייצוא ישיר ל-CSV / Google Maps
 */
export function RouteAdjustmentStep({
  initialRoute,
  allOrders,
  onNext,
}: RouteAdjustmentStepProps) {
  const [selectedOrders, setSelectedOrders] = useState<Order[]>(initialRoute);

  const handleReorder = (newOrders: Order[]) => {
    setSelectedOrders(newOrders);
  };

  const handleRemove = (orderId: string) => {
    setSelectedOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const handleAdd = (orderId: string) => {
    const orderToAdd = allOrders.find((o) => o.id === orderId);
    if (orderToAdd) {
      setSelectedOrders((prev) => [...prev, orderToAdd]);
    }
  };

  const selectedIds = selectedOrders.map((o) => o.id);
  const routeUrl = buildRouteUrl(selectedOrders);
  const overLimit = selectedOrders.length > MAX_GOOGLE_MAPS_STOPS;

  // סינון הזמנות זמינות - רק "ממתין לתאום"
  const waitingOrders = allOrders.filter(
    (order) => order.orderStatus === 'ממתין לתאום'
  );

  return (
    <div className="space-y-4 py-4">
      {/* Grid: שתי עמודות */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* עמודה שמאלית: המסלול */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>המסלול שלי</span>
              <span className="text-sm font-normal text-muted-foreground">
                {selectedOrders.length} עצירות
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedOrders.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                המסלול ריק. הוסף הזמנות מהרשימה מימין
              </div>
            ) : (
              <div className="max-h-[400px] space-y-2 overflow-y-auto">
                <DraggableRouteList
                  orders={selectedOrders}
                  onReorder={handleReorder}
                  onRemove={handleRemove}
                />
              </div>
            )}

            {/* אזהרה - מעל הלימיט */}
            {overLimit && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Google Maps תומך עד {MAX_GOOGLE_MAPS_STOPS} עצירות. חלק
                מהכתובות לא ייכללו בניווט.
              </p>
            )}
          </CardContent>
        </Card>

        {/* עמודה ימנית: הזמנות זמינות */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">הזמנות זמינות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <AvailableOrdersPanel
                orders={waitingOrders}
                selectedIds={selectedIds}
                onAdd={handleAdd}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* פעולות */}
      <div className="flex flex-col gap-2">
        {/* כפתורים ראשיים */}
        <div className="flex gap-2">
          <Button
            onClick={() => window.open(routeUrl, '_blank')}
            disabled={selectedOrders.length === 0}
            className="flex-1 gap-2"
            size="lg"
          >
            <ExternalLink className="h-4 w-4" />
            פתח ב-Google Maps
          </Button>

          <Button
            onClick={() => exportRouteToCSV(selectedOrders)}
            disabled={selectedOrders.length === 0}
            variant="outline"
            className="flex-1 gap-2"
            size="lg"
          >
            <Download className="h-4 w-4" />
            ייצוא ל-CSV
          </Button>
        </div>

        {/* כפתור המשך */}
        <Button
          onClick={() => onNext(selectedOrders)}
          disabled={selectedOrders.length === 0}
          variant="secondary"
          size="lg"
          className="w-full gap-2"
        >
          סיום ועבור לייצוא
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
