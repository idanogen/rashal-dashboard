import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, MapPin, Clock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Order } from '@/types/order';
import { useRouteRecommendations } from '@/hooks/useRouteRecommendations';

interface RouteRecommendationProps {
  orders: Order[];
}

export function RouteRecommendation({ orders }: RouteRecommendationProps) {
  const navigate = useNavigate();
  const recommendations = useRouteRecommendations(orders);

  if (recommendations.length === 0) return null;

  return (
    <Card className="border shadow-sm overflow-hidden">
      <CardContent className="p-4">
        {/* Header */}
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Truck className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">המלצות מסלול להיום</h3>
            <p className="text-xs text-muted-foreground">
              לפי ריכוז הזמנות ודחיפות
            </p>
          </div>
        </div>

        {/* Recommendations */}
        <div className="space-y-2">
          {recommendations.map((rec) => (
            <div
              key={rec.city}
              className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center gap-3 min-w-0">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{rec.city}</span>
                    <Badge variant="secondary" className="text-xs">
                      {rec.totalCount} הזמנות
                    </Badge>
                    {rec.oldCount > 0 && (
                      <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">
                        <Clock className="ml-1 h-3 w-3" />
                        {rec.oldCount} ותיקות
                      </Badge>
                    )}
                  </div>
                  {rec.oldestDays > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ההזמנה הכי ותיקה: {rec.oldestDays} ימים
                    </p>
                  )}
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1"
                onClick={() =>
                  navigate('/routes', { state: { preSelectCity: rec.city } })
                }
              >
                צור מסלול
                <ArrowLeft className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
