import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Order } from '@/types/order';
import {
  geocodeOrderByCity,
  calculateDistance,
  type GeocodedOrder,
  type Coordinates,
} from '@/lib/geocoding';
import { buildRouteUrl, MAX_GOOGLE_MAPS_STOPS } from '@/lib/maps';
import { exportRouteToCSV } from '@/lib/export';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Truck,
  Zap,
  MapPin,
  Clock,
  Navigation,
  ExternalLink,
  Download,
  Loader2,
  X,
  GripVertical,
  Phone,
  AlertTriangle,
  CheckCircle,
  UserCircle,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DRIVERS, type DriverName } from '@/types/route';
import { useApproveRoute } from '@/hooks/useApproveRoute';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';

// ─── Types ─────────────────────────────────────────────────
interface RouteBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
}

// ─── Sortable Stop Item ────────────────────────────────────
function SortableStop({
  order,
  index,
  onRemove,
}: {
  order: Order;
  index: number;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border bg-card p-2 text-sm"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Badge
        variant="secondary"
        className="h-6 w-6 flex-shrink-0 justify-center rounded-full p-0 text-xs"
      >
        {index + 1}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{order.customerName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {order.address}, {order.city}
        </p>
      </div>
      {order.phone && (
        <a
          href={`tel:${order.phone}`}
          className="flex-shrink-0 text-muted-foreground hover:text-primary"
        >
          <Phone className="h-3.5 w-3.5" />
        </a>
      )}
      <button
        onClick={() => onRemove(order.id)}
        className="flex-shrink-0 text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Numbered Map Icon ─────────────────────────────────────
function createStopIcon(number: number): L.DivIcon {
  return L.divIcon({
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background-color: #3b82f6;
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: 12px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        ${number}
      </div>
    `,
    className: 'route-stop-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// ─── Office Starting Point ──────────────────────────────────
const OFFICE_COORDINATES: Coordinates = { lat: 31.9730, lng: 34.7925 }; // משה שרת 15, ראשון לציון
const OFFICE_LABEL = 'משרדי רשעל — משה שרת 15, ראשון לציון';

// ─── Route Optimization (Nearest Neighbor) ─────────────────
function optimizeOrderRoute(orders: Order[]): {
  optimized: Order[];
  unmapped: Order[];
  totalDistance: number;
} {
  const geocoded = orders.map(geocodeOrderByCity);
  const withCoords = geocoded.filter((o) => o.coordinates);
  const unmapped = orders.filter((o) => !geocodeOrderByCity(o).coordinates);

  if (withCoords.length === 0) {
    return { optimized: [], unmapped, totalDistance: 0 };
  }

  if (withCoords.length === 1) {
    const dist = calculateDistance(OFFICE_COORDINATES, withCoords[0].coordinates!);
    return {
      optimized: withCoords.map(({ coordinates, ...order }) => order as Order),
      unmapped,
      totalDistance: Math.round(dist),
    };
  }

  // Nearest-Neighbor algorithm — start from office
  const route: GeocodedOrder[] = [];
  const unvisited = [...withCoords];
  let totalDistance = 0;

  // Find nearest order to the office as first stop
  let currentCoords = OFFICE_COORDINATES;

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = calculateDistance(
        currentCoords,
        unvisited[i].coordinates!
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIndex = i;
      }
    }

    const nearest = unvisited.splice(nearestIndex, 1)[0];
    route.push(nearest);
    totalDistance += nearestDist;
    currentCoords = nearest.coordinates!;
  }

  const optimized = route.map(
    ({ coordinates, ...order }) => order as Order
  );

  return { optimized, unmapped, totalDistance: Math.round(totalDistance) };
}

// ─── Office Map Icon ────────────────────────────────────────
function createOfficeIcon(): L.DivIcon {
  return L.divIcon({
    html: `
      <div style="
        width: 34px;
        height: 34px;
        background-color: #16a34a;
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      ">
        🏢
      </div>
    `,
    className: 'office-marker',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

// ─── Map Updater (re-fits bounds when stops change) ────────
function MapUpdater({ bounds }: { bounds?: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [map, bounds]);
  return null;
}

// ─── Main Component ────────────────────────────────────────
export function RouteBuilderDialog({
  open,
  onOpenChange,
  orders,
}: RouteBuilderDialogProps) {
  const navigate = useNavigate();
  const [stops, setStops] = useState<Order[]>([]);
  const [unmappedOrders, setUnmappedOrders] = useState<Order[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverName | ''>('');
  const approveRoute = useApproveRoute();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Auto-optimize on open
  useEffect(() => {
    if (open && orders.length > 0) {
      handleOptimize();
    }
  }, [open, orders]);

  const handleOptimize = useCallback(() => {
    setIsOptimizing(true);
    setTimeout(() => {
      const { optimized, unmapped, totalDistance: dist } =
        optimizeOrderRoute(orders);
      setStops(optimized);
      setUnmappedOrders(unmapped);
      setTotalDistance(dist);
      setIsOptimizing(false);
    }, 200);
  }, [orders]);

  const handleRemoveStop = (orderId: string) => {
    const newStops = stops.filter((s) => s.id !== orderId);
    setStops(newStops);
    if (newStops.length > 1) {
      const { totalDistance: dist } = optimizeOrderRoute(newStops);
      setTotalDistance(dist);
    } else {
      setTotalDistance(0);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stops.findIndex((s) => s.id === active.id);
    const newIndex = stops.findIndex((s) => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newStops = arrayMove(stops, oldIndex, newIndex);
      setStops(newStops);
      // Recalculate distance for new order (including office → first stop)
      const geocoded = newStops
        .map(geocodeOrderByCity)
        .filter((o) => o.coordinates);
      let dist = 0;
      if (geocoded.length > 0) {
        dist += calculateDistance(OFFICE_COORDINATES, geocoded[0].coordinates!);
        for (let i = 1; i < geocoded.length; i++) {
          dist += calculateDistance(
            geocoded[i - 1].coordinates!,
            geocoded[i].coordinates!
          );
        }
      }
      setTotalDistance(Math.round(dist));
    }
  };

  const handleOpenGoogleMaps = () => {
    const url = buildRouteUrl(stops);
    if (url) window.open(url, '_blank');
  };

  const handleExportCSV = () => {
    exportRouteToCSV(stops);
    toast.success('קובץ CSV יוצא בהצלחה');
  };

  const handleStartNavigation = () => {
    navigate('/route-navigation', {
      state: {
        route: stops,
        routeName: `מסלול ${new Date().toLocaleDateString('he-IL')}`,
      },
    });
    onOpenChange(false);
  };

  const handleApproveRoute = async () => {
    if (!selectedDriver || stops.length === 0) return;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const deliveryDate = tomorrow.toISOString().split('T')[0];

    try {
      await approveRoute.mutateAsync({
        orders: stops,
        driver: selectedDriver as DriverName,
        deliveryDate,
        totalDistance,
        estimatedTime: estimatedDuration,
      });
      onOpenChange(false);
    } catch {
      // שגיאה מטופלת ב-hook
    }
  };

  // Geocoded stops for map — offset duplicates so markers don't overlap
  const geocodedStops = useMemo(() => {
    const mapped = stops.map(geocodeOrderByCity).filter((o) => o.coordinates);
    // Count how many orders share the same city coords and offset them
    const seen = new Map<string, number>();
    return mapped.map((order) => {
      const key = `${order.coordinates!.lat},${order.coordinates!.lng}`;
      const count = seen.get(key) || 0;
      seen.set(key, count + 1);
      if (count === 0) return order;
      // Offset by ~200m per duplicate in a circle pattern
      const angle = (count * 60 * Math.PI) / 180;
      const offset = 0.002 * count; // ~200m per step
      return {
        ...order,
        coordinates: {
          lat: order.coordinates!.lat + offset * Math.cos(angle),
          lng: order.coordinates!.lng + offset * Math.sin(angle),
        },
      };
    });
  }, [stops]);

  const polylinePositions = useMemo(() => {
    const stopPositions = geocodedStops.map(
      (o) => [o.coordinates!.lat, o.coordinates!.lng] as [number, number]
    );
    // Start from office
    return [
      [OFFICE_COORDINATES.lat, OFFICE_COORDINATES.lng] as [number, number],
      ...stopPositions,
    ];
  }, [geocodedStops]);

  const mapBounds = useMemo(() => {
    if (geocodedStops.length === 0) return undefined;
    const allLats = [OFFICE_COORDINATES.lat, ...geocodedStops.map((o) => o.coordinates!.lat)];
    const allLngs = [OFFICE_COORDINATES.lng, ...geocodedStops.map((o) => o.coordinates!.lng)];
    return [
      [Math.min(...allLats), Math.min(...allLngs)],
      [Math.max(...allLats), Math.max(...allLngs)],
    ] as L.LatLngBoundsExpression;
  }, [geocodedStops]);

  const estimatedDuration = Math.round(totalDistance * 1.5 + stops.length * 10); // rough: 1.5 min/km + 10 min/stop

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[100vh] w-screen max-w-[100vw] sm:max-w-[100vw] flex-col rounded-none border-0 p-0"
        dir="rtl"
      >
        {/* Header */}
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-xl">בניית מסלול משלוח</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {orders.length} הזמנות נבחרו • סדר, ערוך ונווט
          </p>
        </DialogHeader>

        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row">
          {/* Left Panel - Stops */}
          <div className="flex max-h-[400px] flex-col gap-4 overflow-y-auto lg:w-1/3 lg:max-h-full">
            {/* Actions */}
            <Card className="space-y-3 p-4">
              <Button
                onClick={handleOptimize}
                disabled={isOptimizing || orders.length === 0}
                className="w-full gap-2"
                variant="outline"
              >
                <Zap className="h-4 w-4" />
                {isOptimizing ? 'מאופטם...' : 'אופטימיזציית מסלול'}
              </Button>
            </Card>

            {/* Driver Selection */}
            <Card className="space-y-3 p-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <UserCircle className="h-4 w-4" />
                שיוך נהג
              </h4>
              <Select
                value={selectedDriver}
                onValueChange={(v) => setSelectedDriver(v as DriverName)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="בחר נהג למסלול..." />
                </SelectTrigger>
                <SelectContent>
                  {DRIVERS.map((driver) => (
                    <SelectItem key={driver} value={driver}>
                      {driver}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>

            {/* Metrics */}
            {stops.length > 0 && (
              <Card className="p-4">
                <h4 className="mb-3 flex items-center gap-2 font-semibold">
                  <Navigation className="h-4 w-4" />
                  מטריקות מסלול
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">עצירות:</span>
                    <Badge variant="secondary">{stops.length}</Badge>
                  </div>
                  {totalDistance > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        מרחק משוער:
                      </span>
                      <span className="font-semibold">
                        {totalDistance} ק"מ
                      </span>
                    </div>
                  )}
                  {totalDistance > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        זמן משוער:
                      </span>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span className="font-semibold">
                          {Math.floor(estimatedDuration / 60)} ש׳{' '}
                          {estimatedDuration % 60} דק׳
                        </span>
                      </div>
                    </div>
                  )}
                  {stops.length > MAX_GOOGLE_MAPS_STOPS && (
                    <p className="text-xs text-amber-600">
                      ⚠️ Google Maps תומך בעד {MAX_GOOGLE_MAPS_STOPS} עצירות
                    </p>
                  )}
                </div>
              </Card>
            )}

            {/* Unmapped Orders Warning */}
            {unmappedOrders.length > 0 && (
              <Card className="border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  {unmappedOrders.length} הזמנות ללא מיקום ידוע
                </h4>
                <div className="space-y-1">
                  {unmappedOrders.map((order) => (
                    <p
                      key={order.id}
                      className="text-xs text-amber-600 dark:text-amber-500"
                    >
                      {order.customerName} — {order.city || 'ללא עיר'}
                    </p>
                  ))}
                </div>
              </Card>
            )}

            {/* Stops List */}
            <Card className="flex min-h-[250px] flex-1 flex-col overflow-hidden p-4">
              <h4 className="mb-3 flex items-center gap-2 font-semibold">
                <MapPin className="h-4 w-4" />
                עצירות (ניתן לגרור) • {stops.length}
              </h4>
              {isOptimizing ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מאופטם מסלול...
                </div>
              ) : stops.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  אין עצירות במסלול
                </div>
              ) : (
                <div className="flex-1 space-y-2 overflow-y-auto">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={stops.map((s) => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {stops.map((order, idx) => (
                        <SortableStop
                          key={order.id}
                          order={order}
                          index={idx}
                          onRemove={handleRemoveStop}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </Card>
          </div>

          {/* Right Panel - Map */}
          <div className="flex min-h-[600px] flex-1 flex-col overflow-hidden lg:min-h-0">
            <Card className="flex h-full flex-col p-4">
              <h4 className="mb-3 flex items-center gap-2 font-semibold">
                <Navigation className="h-4 w-4" />
                מפת מסלול
              </h4>
              <div className="min-h-[600px] flex-1">
                {isOptimizing ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                    טוען מפה...
                  </div>
                ) : geocodedStops.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    אין קואורדינטות זמינות
                  </div>
                ) : (
                  <MapContainer
                    bounds={mapBounds}
                    boundsOptions={{ padding: [40, 40] }}
                    className="h-full w-full rounded-md"
                    scrollWheelZoom
                    zoomControl
                  >
                    <MapUpdater bounds={mapBounds} />
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {/* Office starting point */}
                    <Marker
                      position={[OFFICE_COORDINATES.lat, OFFICE_COORDINATES.lng]}
                      icon={createOfficeIcon()}
                    >
                      <Popup>
                        <div className="text-sm" dir="rtl">
                          <p className="font-bold">🏢 נקודת מוצא</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {OFFICE_LABEL}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                    {polylinePositions.length > 1 && (
                      <Polyline
                        positions={polylinePositions}
                        color="#3b82f6"
                        weight={3}
                        opacity={0.7}
                      />
                    )}
                    {geocodedStops.map((order, idx) => (
                      <Marker
                        key={`${order.id}-${idx}`}
                        position={[
                          order.coordinates!.lat,
                          order.coordinates!.lng,
                        ]}
                        icon={createStopIcon(idx + 1)}
                      >
                        <Popup>
                          <div className="text-sm" dir="rtl">
                            <p className="font-bold">
                              #{idx + 1} - {order.customerName}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {order.address}, {order.city}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex-wrap gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={stops.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            ייצוא CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenGoogleMaps}
            disabled={stops.length === 0}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            פתח ב-Google Maps
          </Button>
          <Button
            onClick={handleApproveRoute}
            disabled={stops.length === 0 || !selectedDriver || approveRoute.isPending}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            {approveRoute.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            {approveRoute.isPending ? 'מאשר מסלול...' : 'אשר מסלול'}
          </Button>
          <Button
            onClick={handleStartNavigation}
            disabled={stops.length === 0}
            className="gap-2"
          >
            <Truck className="h-4 w-4" />
            התחל ניווט
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
