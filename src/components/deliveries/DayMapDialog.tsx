import { useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin,
  Phone,
  Navigation,
  Edit3,
  Truck,
  Building2,
  Route as RouteIcon,
} from 'lucide-react';
import type { ApprovedRoute, RouteStop } from '@/types/route';
import { geocodeOrderByCity, calculateDistance, type Coordinates } from '@/lib/geocoding';

// ─── משרדי החברה ─────────────────────────────────────
const OFFICE_COORDINATES: Coordinates = { lat: 31.9730, lng: 34.7925 };
const OFFICE_LABEL = 'משרדי רשעל — משה שרת 15, ראשון לציון';

// ─── צבעי נהג למפה ───────────────────────────────────
const DRIVER_MAP_COLORS: Record<string, { hex: string; tailwind: string; label: string }> = {
  'רודי דויד': { hex: '#3b82f6', tailwind: 'bg-blue-500', label: 'רודי דויד' },
  'נהג חיצוני מועלם': { hex: '#a855f7', tailwind: 'bg-purple-500', label: 'נהג חיצוני' },
};

function getDriverColor(driver: string): { hex: string; tailwind: string; label: string } {
  return DRIVER_MAP_COLORS[driver] ?? { hex: '#64748b', tailwind: 'bg-slate-500', label: driver };
}

// ─── מרקר ממוספר ──────────────────────────────────────
function createNumberedIcon(number: number, color: string): L.DivIcon {
  return L.divIcon({
    html: `
      <div style="
        width: 30px;
        height: 30px;
        background-color: ${color};
        border: 2.5px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: 13px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      ">${number}</div>
    `,
    className: 'day-map-stop-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// ─── אייקון משרד ──────────────────────────────────────
const officeIcon = L.divIcon({
  html: `
    <div style="
      width: 34px;
      height: 34px;
      background-color: #10b981;
      border: 2.5px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    ">🏢</div>
  `,
  className: 'day-map-office-marker',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

// ─── המרת RouteStop ל-GeocodedStop ──────────────────
interface GeocodedStop extends RouteStop {
  coordinates?: Coordinates;
}

function geocodeStop(stop: RouteStop): GeocodedStop {
  // geocodeOrderByCity מצפה ל-Order shape, אז נתאים לו
  const fakeOrder = {
    id: stop.id,
    customerName: stop.customerName,
    address: stop.address,
    city: stop.city,
    phone: stop.phone,
    created: '',
  };
  const result = geocodeOrderByCity(fakeOrder);
  return { ...stop, coordinates: result.coordinates };
}

// ─── Map Updater — fit bounds כשהמסלולים משתנים ──────
function MapFitter({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
      // טריגר invalidate size אחרי שהדיאלוג נפתח לגמרי
      setTimeout(() => map.invalidateSize(), 200);
    }
  }, [map, bounds]);
  return null;
}

// ─── Types ────────────────────────────────────────────
interface DayMapDialogProps {
  open: boolean;
  onClose: () => void;
  date: string | null; // YYYY-MM-DD
  routes: ApprovedRoute[];
  onEditRoute?: (route: ApprovedRoute) => void;
}

interface RouteWithGeo {
  route: ApprovedRoute;
  stops: GeocodedStop[];
  mappedStops: GeocodedStop[];
  unmappedCount: number;
  totalDistance: number;
  polylinePoints: [number, number][];
}

// ─── Main Component ───────────────────────────────────
export function DayMapDialog({
  open,
  onClose,
  date,
  routes,
  onEditRoute,
}: DayMapDialogProps) {
  // Geocode + חישוב polyline ומרחק לכל מסלול
  const routesWithGeo: RouteWithGeo[] = useMemo(() => {
    return routes.map((route) => {
      const sorted = [...route.stops].sort((a, b) => a.sequence - b.sequence);
      const geocoded = sorted.map(geocodeStop);
      const mapped = geocoded.filter((s) => s.coordinates);
      const unmappedCount = geocoded.length - mapped.length;

      // נקודות ל-polyline: משרד → עצירה 1 → עצירה 2 → ...
      const polylinePoints: [number, number][] = [];
      if (mapped.length > 0) {
        polylinePoints.push([OFFICE_COORDINATES.lat, OFFICE_COORDINATES.lng]);
        for (const s of mapped) {
          polylinePoints.push([s.coordinates!.lat, s.coordinates!.lng]);
        }
      }

      // חישוב מרחק כולל (office → first → ... → last)
      let dist = 0;
      if (mapped.length > 0) {
        dist += calculateDistance(OFFICE_COORDINATES, mapped[0].coordinates!);
        for (let i = 1; i < mapped.length; i++) {
          dist += calculateDistance(
            mapped[i - 1].coordinates!,
            mapped[i].coordinates!
          );
        }
      }

      return {
        route,
        stops: geocoded,
        mappedStops: mapped,
        unmappedCount,
        totalDistance: Math.round(dist),
        polylinePoints,
      };
    });
  }, [routes]);

  // חישוב bounds כולל לכל הנקודות
  const combinedBounds = useMemo(() => {
    const allPoints: [number, number][] = [[OFFICE_COORDINATES.lat, OFFICE_COORDINATES.lng]];
    for (const r of routesWithGeo) {
      for (const s of r.mappedStops) {
        allPoints.push([s.coordinates!.lat, s.coordinates!.lng]);
      }
    }
    if (allPoints.length < 2) return null;
    return L.latLngBounds(allPoints);
  }, [routesWithGeo]);

  // סיכומים
  const totalStops = routesWithGeo.reduce((sum, r) => sum + r.stops.length, 0);
  const totalDistance = routesWithGeo.reduce((sum, r) => sum + r.totalDistance, 0);

  const formattedDate = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[95vw] p-0 gap-0 sm:max-w-[95vw] lg:max-w-[90vw] h-[90vh]"
        dir="rtl"
      >
        {/* Header */}
        <DialogHeader className="border-b px-5 py-3 shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <RouteIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-base font-bold">{formattedDate}</div>
              <div className="mt-0.5 flex items-center gap-3 text-xs font-normal text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  {routes.length} {routes.length === 1 ? 'מסלול' : 'מסלולים'}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {totalStops} {totalStops === 1 ? 'עצירה' : 'עצירות'}
                </span>
                {totalDistance > 0 && (
                  <span className="flex items-center gap-1">
                    <Navigation className="h-3 w-3" />
                    {totalDistance} ק"מ
                  </span>
                )}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Body: Map + Side Panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Map */}
          <div className="flex-1 relative bg-muted">
            <MapContainer
              center={[OFFICE_COORDINATES.lat, OFFICE_COORDINATES.lng]}
              zoom={10}
              className="h-full w-full"
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapFitter bounds={combinedBounds} />

              {/* Office marker */}
              <Marker
                position={[OFFICE_COORDINATES.lat, OFFICE_COORDINATES.lng]}
                icon={officeIcon}
              >
                <Popup>
                  <strong>{OFFICE_LABEL}</strong>
                </Popup>
              </Marker>

              {/* Routes: polylines + numbered markers per route */}
              {routesWithGeo.map(({ route, mappedStops, polylinePoints }) => {
                const color = getDriverColor(route.driver).hex;
                return (
                  <div key={route.id}>
                    {polylinePoints.length > 1 && (
                      <Polyline
                        positions={polylinePoints}
                        pathOptions={{
                          color,
                          weight: 4,
                          opacity: 0.75,
                          dashArray: route.status === 'בביצוע' ? undefined : '8,6',
                        }}
                      />
                    )}
                    {mappedStops.map((stop, idx) => (
                      <Marker
                        key={`${route.id}-${stop.id}`}
                        position={[stop.coordinates!.lat, stop.coordinates!.lng]}
                        icon={createNumberedIcon(idx + 1, color)}
                      >
                        <Popup>
                          <div className="space-y-1 text-right" dir="rtl">
                            <div className="font-bold">{stop.customerName}</div>
                            <div className="text-xs text-gray-600">
                              {stop.address}
                              {stop.city ? `, ${stop.city}` : ''}
                            </div>
                            <div className="text-xs" style={{ color }}>
                              {route.driver} · עצירה {idx + 1}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </div>
                );
              })}
            </MapContainer>
          </div>

          {/* Side Panel: Routes */}
          <div className="w-[340px] border-s bg-card flex flex-col overflow-hidden shrink-0">
            <div className="border-b px-4 py-2.5 bg-muted/30 shrink-0">
              <h3 className="text-sm font-bold">מסלולי היום</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {routesWithGeo.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Truck className="mb-2 h-10 w-10 opacity-30" />
                  <p className="text-sm">אין מסלולים ליום זה</p>
                </div>
              ) : (
                routesWithGeo.map(({ route, stops, unmappedCount, totalDistance }) => {
                  const driverColor = getDriverColor(route.driver);
                  return (
                    <div
                      key={route.id}
                      className="rounded-lg border bg-background overflow-hidden"
                    >
                      {/* Route header */}
                      <div
                        className="flex items-center justify-between px-3 py-2 border-b"
                        style={{ borderInlineStartWidth: 4, borderInlineStartColor: driverColor.hex }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold truncate">
                              {driverColor.label}
                            </span>
                            <Badge
                              variant="outline"
                              className="h-4 px-1 text-[10px]"
                            >
                              {route.status}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {stops.length} עצירות
                            {totalDistance > 0 && ` · ${totalDistance} ק"מ`}
                            {unmappedCount > 0 && ` · ${unmappedCount} ללא מיקום`}
                          </div>
                        </div>
                        {onEditRoute && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={() => onEditRoute(route)}
                            title="ערוך מסלול"
                          >
                            <Edit3 className="h-3 w-3" />
                            ערוך
                          </Button>
                        )}
                      </div>

                      {/* Stops list */}
                      <div className="divide-y">
                        {stops.map((stop, idx) => (
                          <div
                            key={stop.id}
                            className="flex items-start gap-2 px-3 py-2 text-xs hover:bg-muted/40"
                          >
                            <div
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white mt-0.5"
                              style={{ backgroundColor: driverColor.hex }}
                            >
                              {idx + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold truncate">
                                {stop.customerName}
                              </div>
                              {(stop.address || stop.city) && (
                                <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground truncate">
                                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                                  <span className="truncate">
                                    {stop.address}
                                    {stop.city ? `, ${stop.city}` : ''}
                                  </span>
                                </div>
                              )}
                              {!stop.coordinates && (
                                <div className="text-[10px] text-amber-600 mt-0.5">
                                  ⚠ לא זוהה מיקום
                                </div>
                              )}
                            </div>
                            {stop.phone && (
                              <a
                                href={`tel:${stop.phone}`}
                                className="shrink-0 text-muted-foreground hover:text-primary"
                                title={stop.phone}
                              >
                                <Phone className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer legend */}
            <div className="border-t bg-muted/20 px-3 py-2 shrink-0">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Building2 className="h-3 w-3 text-emerald-600" />
                <span>משרד</span>
                <span className="mx-1">·</span>
                <span>
                  קו רציף = בביצוע · קו מקווקו = מאושר
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
