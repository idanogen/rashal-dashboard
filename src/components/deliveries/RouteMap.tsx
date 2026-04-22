import { useEffect, useMemo, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CalendarStop } from '@/types/delivery';
import { Card } from '@/components/ui/card';
import { Package, MapPin, Wrench, ClipboardList, Warehouse } from 'lucide-react';
import { WAREHOUSE_LOCATION } from '@/lib/maps';
import { getCityCoordinates } from '@/lib/geocoding';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Numbered pin icon (with colour by status)
const createNumberedMarker = (number: number, color: string, muted = false) => {
  const html = `
    <div style="
      background: ${color};
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      font-family: system-ui, -apple-system, sans-serif;
      ${muted ? 'opacity: 0.55;' : ''}
    ">${number}</div>
  `;
  return L.divIcon({
    html,
    className: 'numbered-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });
};

// Warehouse icon
const warehouseIcon = L.divIcon({
  html: `
    <div style="
      background: #10b981;
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 4px solid white;
      box-shadow: 0 4px 8px rgba(0,0,0,0.4);
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/>
        <path d="M6 18h12"/><path d="M6 14h12"/><path d="m6 10 6-3 6 3"/>
      </svg>
    </div>
  `,
  className: 'warehouse-marker',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

// Auto-fit bounds when positions change
function AutoFitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [positions, map]);
  return null;
}

interface StopWithCoords {
  stop: CalendarStop;
  coords: { lat: number; lng: number };
  /** sequence number as shown in the UI (1-based) */
  index: number;
}

/**
 * Spread markers that share the same coordinates (e.g. multiple stops in the
 * same city, where we only have city-level geocoding).
 * - Same city + same address → micro-offset ~30m around a common point.
 * - Same city + different addresses → larger spread ~400m across the city.
 */
function spreadCoords(items: StopWithCoords[]): Map<string, { lat: number; lng: number }> {
  const result = new Map<string, { lat: number; lng: number }>();
  const coordGroups = new Map<string, StopWithCoords[]>();

  items.forEach((it) => {
    const key = `${it.coords.lat.toFixed(5)},${it.coords.lng.toFixed(5)}`;
    if (!coordGroups.has(key)) coordGroups.set(key, []);
    coordGroups.get(key)!.push(it);
  });

  coordGroups.forEach((group) => {
    if (group.length === 1) {
      result.set(group[0].stop.stopId, group[0].coords);
      return;
    }

    const addressGroups = new Map<string, StopWithCoords[]>();
    group.forEach((it) => {
      const addr = (it.stop.address || '').trim().toLowerCase();
      if (!addressGroups.has(addr)) addressGroups.set(addr, []);
      addressGroups.get(addr)!.push(it);
    });

    const uniqueAddresses = Array.from(addressGroups.values());
    const { lat: baseLat, lng: baseLng } = group[0].coords;

    if (uniqueAddresses.length === 1) {
      // All same address — tiny offset so markers don't fully overlap
      const microOffset = 0.0003; // ~30m
      group.forEach((it, i) => {
        if (i === 0) {
          result.set(it.stop.stopId, it.coords);
          return;
        }
        const angle = (2 * Math.PI * i) / group.length;
        result.set(it.stop.stopId, {
          lat: baseLat + microOffset * Math.cos(angle),
          lng: baseLng + microOffset * Math.sin(angle),
        });
      });
    } else {
      // Different addresses in same city — spread by address group
      const radius = 0.004; // ~400m
      uniqueAddresses.forEach((sub, i) => {
        const angle = (2 * Math.PI * i) / uniqueAddresses.length;
        const basePos = {
          lat: baseLat + radius * Math.cos(angle),
          lng: baseLng + radius * Math.sin(angle),
        };
        const microOffset = 0.0003;
        sub.forEach((it, j) => {
          if (j === 0) {
            result.set(it.stop.stopId, basePos);
            return;
          }
          const a2 = (2 * Math.PI * j) / sub.length;
          result.set(it.stop.stopId, {
            lat: basePos.lat + microOffset * Math.cos(a2),
            lng: basePos.lng + microOffset * Math.sin(a2),
          });
        });
      });
    }
  });

  return result;
}

const statusColor = (status: CalendarStop['status']): { color: string; muted: boolean } => {
  switch (status) {
    case 'completed':
      return { color: '#10b981', muted: true }; // emerald
    case 'not_completed':
      return { color: '#ef4444', muted: true }; // red
    case 'in_progress':
      return { color: '#8b5cf6', muted: false }; // purple
    case 'cancelled':
      return { color: '#6b7280', muted: true }; // gray
    case 'planned':
    default:
      return { color: '#3b82f6', muted: false }; // blue
  }
};

const sourceIconInPopup: Record<CalendarStop['sourceType'], typeof Package> = {
  delivery: Package,
  service: Wrench,
  task: ClipboardList,
};

interface RouteMapProps {
  /** Stops of the currently-selected driver, in the sequence they should be driven. */
  stops: CalendarStop[];
  height?: string;
}

export function RouteMap({ stops, height = '500px' }: RouteMapProps) {
  const mapRef = useRef<L.Map>(null);

  // Resolve coords for each stop via city lookup.
  const stopsWithCoords: StopWithCoords[] = useMemo(() => {
    const out: StopWithCoords[] = [];
    stops.forEach((stop, i) => {
      const coords = getCityCoordinates(stop.city);
      if (!coords) return;
      out.push({ stop, coords, index: i + 1 });
    });
    return out;
  }, [stops]);

  const positionsById = useMemo(() => spreadCoords(stopsWithCoords), [stopsWithCoords]);

  // Positions for auto-fit bounds (includes warehouse)
  const allPositions: [number, number][] = useMemo(() => {
    const list: [number, number][] = [[WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng]];
    stopsWithCoords.forEach((it) => {
      const p = positionsById.get(it.stop.stopId);
      if (p) list.push([p.lat, p.lng]);
    });
    return list;
  }, [stopsWithCoords, positionsById]);

  // Full route path: warehouse → stops in order → warehouse
  const routePath: [number, number][] = useMemo(() => {
    const pts = stopsWithCoords
      .map((it) => positionsById.get(it.stop.stopId))
      .filter((p): p is { lat: number; lng: number } => !!p)
      .map((p) => [p.lat, p.lng] as [number, number]);
    if (pts.length === 0) return [];
    return [
      [WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng],
      ...pts,
      [WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng],
    ];
  }, [stopsWithCoords, positionsById]);

  const defaultCenter: [number, number] = [32.0853, 34.7818]; // Tel Aviv

  if (stopsWithCoords.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-6 text-center" style={{ height }}>
        <MapPin className="h-10 w-10 mb-2 text-muted-foreground" />
        <h3 className="font-semibold mb-1">אין עצירות להצגה</h3>
        <p className="text-xs text-muted-foreground">
          אף עצירה בעלת עיר מוכרת לא נמצאה ליום זה
        </p>
      </Card>
    );
  }

  return (
    <div className="relative">
      <MapContainer
        ref={mapRef}
        center={allPositions[0] || defaultCenter}
        zoom={10}
        style={{ height, width: '100%', borderRadius: '8px' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <AutoFitBounds positions={allPositions} />

        {/* Polyline — warehouse → stops → warehouse */}
        {routePath.length > 1 && (
          <Polyline
            positions={routePath}
            pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.7 }}
          />
        )}

        {/* Warehouse marker */}
        <Marker
          position={[WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng]}
          icon={warehouseIcon}
        >
          <Popup>
            <div className="text-right min-w-[160px]" dir="rtl">
              <div className="mb-2 flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-emerald-600" />
                <strong className="text-sm">{WAREHOUSE_LOCATION.name}</strong>
              </div>
              <p className="text-xs text-muted-foreground">
                נקודת התחלה וסיום של כל מסלול
              </p>
            </div>
          </Popup>
        </Marker>

        {/* Stop markers */}
        {stopsWithCoords.map(({ stop, index }) => {
          const pos = positionsById.get(stop.stopId);
          if (!pos) return null;
          const { color, muted } = statusColor(stop.status);
          const SrcIcon = sourceIconInPopup[stop.sourceType];
          return (
            <Marker
              key={stop.stopId}
              position={[pos.lat, pos.lng]}
              icon={createNumberedMarker(index, color, muted)}
            >
              <Popup>
                <div className="min-w-[180px] text-right" dir="rtl">
                  <div className="mb-2 flex items-center gap-2">
                    <SrcIcon className="h-4 w-4" />
                    <strong className="text-sm">{stop.customerName}</strong>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div>
                      <span className="text-muted-foreground">עצירה: </span>
                      <span className="font-semibold">#{index}</span>
                    </div>
                    {stop.address && (
                      <div>
                        <span className="text-muted-foreground">כתובת: </span>
                        <span>{stop.address}</span>
                      </div>
                    )}
                    {stop.city && (
                      <div>
                        <span className="text-muted-foreground">עיר: </span>
                        <span>{stop.city}</span>
                      </div>
                    )}
                    {stop.phone && (
                      <div>
                        <span className="text-muted-foreground">טלפון: </span>
                        <span dir="ltr">{stop.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] rounded-lg bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
        <div className="mb-2 font-semibold">מקרא:</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 border-b pb-1 mb-1">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="font-semibold">מחסן</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span>מתוכננת</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-purple-500" />
            <span>בביצוע</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-emerald-500 opacity-55" />
            <span>בוצעה</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500 opacity-55" />
            <span>לא בוצעה</span>
          </div>
          {routePath.length > 1 && (
            <div className="flex items-center gap-2 border-t pt-1 mt-1">
              <div className="h-0.5 w-8 bg-blue-500" />
              <span>מסלול</span>
            </div>
          )}
        </div>
      </div>

      {/* Stop count badge */}
      <div className="absolute top-4 right-4 z-[1000] rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground shadow-lg">
        {stopsWithCoords.length} יעדים
      </div>
    </div>
  );
}
