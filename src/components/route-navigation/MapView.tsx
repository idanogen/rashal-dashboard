import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Order } from '@/types/order';
import { geocodeOrderByCity } from '@/lib/geocoding';
import { getRoadRoute, type RoadRoute } from '@/lib/directions';

interface MapViewProps {
  /** רשימת הזמנות במסלול */
  route: Order[];
  /** אינדקס ההזמנה הנוכחית */
  currentIndex: number;
  /** IDs של הזמנות שהושלמו */
  completedIds: Set<string>;
}

// תיקון בעיית האייקונים של Leaflet (ברירת המחדל לא עובדת עם Vite)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/**
 * יצירת אייקון מותאם אישית עם מספר
 */
function createNumberedIcon(
  number: number,
  isCurrent: boolean,
  isCompleted: boolean
): L.DivIcon {
  const bgColor = isCompleted ? '#22c55e' : isCurrent ? '#3b82f6' : '#64748b';
  const size = isCurrent ? 36 : 30;

  return L.divIcon({
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${bgColor};
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: ${isCurrent ? '16px' : '14px'};
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        ${isCompleted ? '✓' : number}
      </div>
    `,
    className: 'numbered-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * קומפוננטת מפה אינטראקטיבית עם Leaflet
 *
 * מציגה:
 * - נקודות ממוספרות לכל הזמנה
 * - קו מחבר בין הנקודות
 * - הדגשת ההזמנה הנוכחית
 * - סימון הזמנות שהושלמו
 */
export function MapView({ route, currentIndex, completedIds }: MapViewProps) {
  // גיאוקודינג של כל ההזמנות
  const geocodedRoute = useMemo(() => {
    return route
      .map(geocodeOrderByCity)
      .filter((order) => order.coordinates !== undefined);
  }, [route]);

  // חישוב גבולות המפה (bounds) כדי להציג את כל הנקודות
  const bounds = useMemo(() => {
    if (geocodedRoute.length === 0) return undefined;

    const latitudes = geocodedRoute.map((o) => o.coordinates!.lat);
    const longitudes = geocodedRoute.map((o) => o.coordinates!.lng);

    return [
      [Math.min(...latitudes), Math.min(...longitudes)],
      [Math.max(...latitudes), Math.max(...longitudes)],
    ] as L.LatLngBoundsExpression;
  }, [geocodedRoute]);

  // מרכז ברירת מחדל (תל אביב) במקרה שאין נקודות
  const defaultCenter: [number, number] = [32.0853, 34.7818];
  const defaultZoom = 8;

  // קואורדינטות הקו המחבר
  const polylinePositions = useMemo(() => {
    return geocodedRoute.map((order) => [
      order.coordinates!.lat,
      order.coordinates!.lng,
    ]) as [number, number][];
  }, [geocodedRoute]);

  // מסלול לפי כבישים מהשירות המרכזי. null עד שנטען / כשלא זמין → fallback לקו ישר.
  const [roadRoute, setRoadRoute] = useState<RoadRoute | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (polylinePositions.length < 2) {
      setRoadRoute(null);
      return;
    }
    getRoadRoute(polylinePositions).then((r) => {
      if (!cancelled) setRoadRoute(r);
    });
    return () => {
      cancelled = true;
    };
  }, [polylinePositions]);

  // אם אין נקודות עם קואורדינטות - הצג הודעה
  if (geocodedRoute.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted/20">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">לא ניתן להציג מפה</p>
          <p className="text-xs mt-1">אין קואורדינטות זמינות להזמנות במסלול</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [50, 50] }}
      className="h-full w-full"
      scrollWheelZoom={true}
      zoomControl={true}
    >
      {/* שכבת המפה מ-OpenStreetMap */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* קו מחבר — מסלול לפי כבישים אם זמין, אחרת קו ישר מקווקו (fallback) */}
      {roadRoute && roadRoute.path.length > 1 ? (
        <Polyline positions={roadRoute.path} color="#3b82f6" weight={4} opacity={0.8} />
      ) : (
        polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            color="#3b82f6"
            weight={3}
            opacity={0.6}
            dashArray="6 8"
          />
        )
      )}

      {/* Markers ממוספרים */}
      {geocodedRoute.map((order, index) => {
        const isCurrent = index === currentIndex;
        const isCompleted = completedIds.has(order.id);
        const originalIndex = route.findIndex((o) => o.id === order.id);

        return (
          <Marker
            key={order.id}
            position={[order.coordinates!.lat, order.coordinates!.lng]}
            icon={createNumberedIcon(originalIndex + 1, isCurrent, isCompleted)}
          >
            <Popup>
              <div className="text-sm" dir="rtl">
                <p className="font-bold">#{originalIndex + 1} - {order.customerName}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {order.address}, {order.city}
                </p>
                {order.phone && (
                  <p className="text-xs mt-1">
                    📞 {order.phone}
                  </p>
                )}
                {isCurrent && (
                  <p className="text-xs mt-2 font-semibold text-blue-600">
                    ← עצירה נוכחית
                  </p>
                )}
                {isCompleted && (
                  <p className="text-xs mt-2 font-semibold text-green-600">
                    ✓ הושלם
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>

      {/* תווית מרחק/זמן (רק כשיש מסלול כבישים אמיתי) */}
      {roadRoute && (
        <div className="absolute top-3 left-3 z-[1000] rounded-full bg-background/95 px-3 py-1 text-xs font-semibold shadow-lg backdrop-blur">
          {roadRoute.distanceKm.toFixed(1)} ק״מ · {Math.round(roadRoute.durationMin)} דק׳
        </div>
      )}
    </div>
  );
}
