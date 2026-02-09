import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navigation, Trash2, ExternalLink, X } from 'lucide-react';
import { buildRouteUrl, MAX_GOOGLE_MAPS_STOPS } from '@/lib/maps';
import type { Order } from '@/types/order';

interface RouteSelectedPanelProps {
  selectedOrders: Order[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function RouteSelectedPanel({
  selectedOrders,
  onRemove,
  onClear,
}: RouteSelectedPanelProps) {
  const routeUrl = buildRouteUrl(selectedOrders);
  const overLimit = selectedOrders.length > MAX_GOOGLE_MAPS_STOPS;

  return (
    <div className="sticky top-20 space-y-4">
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Navigation className="h-4 w-4 text-primary" />
              מסלול נבחר
              {selectedOrders.length > 0 && (
                <Badge variant="secondary">{selectedOrders.length}</Badge>
              )}
            </h3>
            {selectedOrders.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="h-7 gap-1 text-xs text-muted-foreground"
              >
                <Trash2 className="h-3 w-3" />
                נקה
              </Button>
            )}
          </div>

          {/* Empty state */}
          {selectedOrders.length === 0 ? (
            <div className="py-10 text-center">
              <Navigation className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                בחר הזמנות מהרשימה כדי לבנות מסלול
              </p>
            </div>
          ) : (
            <>
              {/* Numbered stop list */}
              <ol className="mb-4 space-y-2">
                {selectedOrders.map((order, idx) => (
                  <li
                    key={order.id}
                    className="flex items-center gap-2 rounded-lg border p-2 text-sm"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{order.customerName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {order.address}, {order.city}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(order.id)}
                      className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ol>

              {/* Over-limit warning */}
              {overLimit && (
                <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Google Maps תומך עד {MAX_GOOGLE_MAPS_STOPS} עצירות בקישור. חלק
                  מהכתובות לא ייכללו בניווט. שקול לפצל למספר מסלולים.
                </p>
              )}

              {/* Open in Google Maps CTA */}
              <Button className="w-full gap-2" asChild>
                <a href={routeUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  פתח ב-Google Maps
                </a>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
