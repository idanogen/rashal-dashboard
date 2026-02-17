import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ApprovedRoute, RouteStatus } from '@/types/route';
import { ROUTE_STATUS_OPTIONS } from '@/types/route';
import { useUpdateRoute } from '@/hooks/useUpdateRoute';
import { updateOrder } from '@/lib/airtable';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Truck,
  MapPin,
  Clock,
  Navigation,
  ChevronDown,
  ChevronUp,
  Phone,
  CheckCircle,
  XCircle,
  Play,
  Calendar,
  User,
  Loader2,
  PackageOpen,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

interface ApprovedRoutesListProps {
  routes: ApprovedRoute[];
  isLoading: boolean;
}

function getStatusColor(status: RouteStatus): string {
  const option = ROUTE_STATUS_OPTIONS.find((o) => o.value === status);
  if (!option) return 'bg-gray-100 text-gray-700';
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
  };
  return colors[option.color] || 'bg-gray-100 text-gray-700';
}

function getStatusIcon(status: RouteStatus) {
  switch (status) {
    case 'מאושר':
      return <CheckCircle className="h-3.5 w-3.5" />;
    case 'בביצוע':
      return <Play className="h-3.5 w-3.5" />;
    case 'הושלם':
      return <CheckCircle className="h-3.5 w-3.5" />;
    case 'בוטל':
      return <XCircle className="h-3.5 w-3.5" />;
  }
}

export function ApprovedRoutesList({
  routes,
  isLoading,
}: ApprovedRoutesListProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updateRoute = useUpdateRoute();
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [returningOrderId, setReturningOrderId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>טוען מסלולים...</span>
      </div>
    );
  }

  // סינון מסלולים בוטלים + מיון לפי תאריך (חדש קודם)
  const sortedRoutes = [...routes]
    .sort(
      (a, b) =>
        new Date(b.created).getTime() - new Date(a.created).getTime()
    );

  if (sortedRoutes.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-muted-foreground">
        <PackageOpen className="h-12 w-12 opacity-40" />
        <p className="text-sm">אין מסלולים מאושרים</p>
        <p className="text-xs">
          בנה מסלול מההזמנות הממתינות ואשר אותו
        </p>
      </div>
    );
  }

  const handleStartRoute = (route: ApprovedRoute) => {
    updateRoute.mutate({ id: route.id, fields: { status: 'בביצוע' } });
    // נווט לדף ניווט עם נתוני המסלול
    const routeOrders = route.stops.map((stop) => ({
      id: stop.id,
      customerName: stop.customerName,
      address: stop.address,
      city: stop.city,
      phone: stop.phone,
      created: '',
    }));
    navigate('/route-navigation', {
      state: {
        route: routeOrders,
        routeName: route.routeName,
      },
    });
  };

  const handleCompleteRoute = (routeId: string) => {
    updateRoute.mutate({ id: routeId, fields: { status: 'הושלם' } });
  };

  const handleCancelRoute = (routeId: string) => {
    updateRoute.mutate({ id: routeId, fields: { status: 'בוטל' } });
  };

  const handleReturnOrder = async (route: ApprovedRoute, stopId: string) => {
    setReturningOrderId(stopId);
    try {
      // 1. החזרת ההזמנה ל"ממתין לתאום"
      await updateOrder(stopId, { orderStatus: 'ממתין לתאום' });

      // 2. הסרת העצירה מהמסלול
      const newStops = route.stops
        .filter((s) => s.id !== stopId)
        .map((s, idx) => ({ ...s, sequence: idx + 1 }));
      const newOrderIds = route.orderIds.filter((id) => id !== stopId);

      await updateRoute.mutateAsync({
        id: route.id,
        fields: {
          stops: newStops,
          orderIds: newOrderIds,
          stopCount: newStops.length,
        },
      });

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('ההזמנה הוחזרה לממתינות');
    } catch (err) {
      console.error('[returnOrder] Error:', err);
      toast.error('שגיאה בהחזרת ההזמנה');
    } finally {
      setReturningOrderId(null);
    }
  };

  return (
    <div className="space-y-3">
      {sortedRoutes.map((route) => {
        const isExpanded = expandedRouteId === route.id;

        return (
          <Collapsible
            key={route.id}
            open={isExpanded}
            onOpenChange={(open) =>
              setExpandedRouteId(open ? route.id : null)
            }
          >
            <Card className="overflow-hidden">
              {/* Header */}
              <CollapsibleTrigger className="w-full cursor-pointer">
                <div className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
                  {/* Route info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold truncate">
                        {route.routeName}
                      </h3>
                      <Badge
                        variant="outline"
                        className={`gap-1 text-xs ${getStatusColor(route.status)}`}
                      >
                        {getStatusIcon(route.status)}
                        {route.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {route.driver}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {route.deliveryDate
                          ? new Date(route.deliveryDate).toLocaleDateString('he-IL')
                          : '—'}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {route.stopCount} עצירות
                      </span>
                      {route.estimatedDistance > 0 && (
                        <span className="flex items-center gap-1">
                          <Navigation className="h-3 w-3" />
                          {route.estimatedDistance} ק"מ
                        </span>
                      )}
                      {route.estimatedTime > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.floor(route.estimatedTime / 60)} ש׳{' '}
                          {route.estimatedTime % 60} דק׳
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand icon */}
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>

              {/* Expanded content */}
              <CollapsibleContent>
                <div className="border-t px-4 py-3">
                  {/* Stops list */}
                  <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
                    עצירות ({route.stops.length})
                  </h4>
                  <div className="space-y-2 mb-4">
                    {route.stops.map((stop) => (
                      <div
                        key={stop.id}
                        className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 text-sm"
                      >
                        <Badge
                          variant="secondary"
                          className="h-5 w-5 flex-shrink-0 justify-center rounded-full p-0 text-xs"
                        >
                          {stop.sequence}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-sm">
                            {stop.customerName}
                          </p>
                          {(stop.address || stop.city) && (
                            <p className="truncate text-xs text-muted-foreground">
                              {[stop.address, stop.city]
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          )}
                        </div>
                        {stop.phone && (
                          <a
                            href={`tel:${stop.phone}`}
                            className="flex-shrink-0 text-muted-foreground hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {(route.status === 'מאושר' || route.status === 'בביצוע') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReturnOrder(route, stop.id);
                            }}
                            disabled={returningOrderId === stop.id}
                            className="flex-shrink-0 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 hover:border-amber-400 transition-colors disabled:opacity-50"
                            title="החזר הזמנה לממתינות"
                          >
                            {returningOrderId === stop.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              'החזר'
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    {route.status === 'מאושר' && (
                      <>
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleStartRoute(route)}
                        >
                          <Truck className="h-3.5 w-3.5" />
                          התחל מסלול
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1.5"
                          onClick={() => handleCancelRoute(route.id)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          בטל מסלול
                        </Button>
                      </>
                    )}
                    {route.status === 'בביצוע' && (
                      <Button
                        size="sm"
                        className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleCompleteRoute(route.id)}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        סמן כהושלם
                      </Button>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
