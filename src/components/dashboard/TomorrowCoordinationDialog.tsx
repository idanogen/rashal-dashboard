import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Calendar,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  Phone,
  Navigation,
} from 'lucide-react';
import type { Order } from '@/types/order';
import { useTomorrowCoordinationRecommendations } from '@/hooks/useTomorrowCoordinationRecommendations';
import { getDaysSinceCreated, getDaysColor } from '@/lib/utils';
import { buildRouteUrl } from '@/lib/maps';

interface TomorrowCoordinationDialogProps {
  orders: Order[];
}

export function TomorrowCoordinationDialog({
  orders,
}: TomorrowCoordinationDialogProps) {
  const [open, setOpen] = useState(false);
  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const recommendations = useTomorrowCoordinationRecommendations(orders);

  if (recommendations.length === 0) {
    return null; // Don't show button if no recommendations
  }

  const toggleCity = (city: string) => {
    setExpandedCity(expandedCity === city ? null : city);
  };

  const totalOrders = recommendations.reduce(
    (sum, rec) => sum + rec.totalCount,
    0
  );

  return (
    <>
      {/* Trigger Button */}
      <div className="flex justify-center">
        <Button
          onClick={() => setOpen(true)}
          variant="outline"
          size="lg"
          className="gap-2 border-primary/30 hover:border-primary hover:bg-primary/5"
        >
          <Calendar className="h-5 w-5" />
          המלצות לתיאום מחר
          <Badge variant="secondary" className="mr-2">
            {totalOrders} הזמנות
          </Badge>
        </Button>
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              המלצות לתיאום מחר
            </DialogTitle>
            <DialogDescription>
              הזמנות בסטטוס "ממתין לתאום" מקובצות לפי ריכוז גיאוגרפי והזמנות ותיקות
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {recommendations.map((rec) => (
              <Card key={rec.city} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* City Header - Clickable */}
                  <button
                    onClick={() => toggleCity(rec.city)}
                    className="w-full flex items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-colors text-right"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <MapPin className="h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold">
                            {rec.city}
                          </span>
                          <Badge variant="secondary">
                            {rec.totalCount} הזמנות
                          </Badge>
                          {rec.oldCount > 0 && (
                            <Badge className="bg-red-50 text-red-700 border-red-200">
                              <Clock className="ml-1 h-3 w-3" />
                              {rec.oldCount} ותיקות
                            </Badge>
                          )}
                        </div>
                        {rec.oldestDays > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ההזמנה הכי ותיקה: {rec.oldestDays} ימים
                          </p>
                        )}
                      </div>
                    </div>
                    {expandedCity === rec.city ? (
                      <ChevronUp className="h-5 w-5 shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0" />
                    )}
                  </button>

                  {/* Expanded Orders List */}
                  {expandedCity === rec.city && (
                    <div className="border-t bg-muted/10">
                      <div className="divide-y">
                        {rec.orders.map((order) => {
                          const days = getDaysSinceCreated(order.created);
                          const daysColor = getDaysColor(days);

                          return (
                            <div
                              key={order.id}
                              className="p-3 hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1 space-y-1">
                                  <p className="font-semibold text-sm">
                                    {order.customerName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {order.address}
                                  </p>
                                  {order.phone && (
                                    <a
                                      href={`tel:${order.phone}`}
                                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                      <Phone className="h-3 w-3" />
                                      {order.phone}
                                    </a>
                                  )}
                                </div>
                                <div className="shrink-0 text-left">
                                  <Badge variant="outline" className={daysColor}>
                                    <Clock className="ml-1 h-3 w-3" />
                                    {days !== null ? `${days} ימים` : 'לא ידוע'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Google Maps Button */}
                      <div className="p-3 border-t bg-background">
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => {
                            const url = buildRouteUrl(rec.orders);
                            if (url) window.open(url, '_blank');
                          }}
                        >
                          <Navigation className="h-4 w-4" />
                          פתח מסלול ב-Google Maps
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
