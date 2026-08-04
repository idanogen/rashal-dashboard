import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { Truck, Wrench, PackageOpen } from 'lucide-react';
import type { Order } from '@/types/order';
import type { ServiceCall } from '@/types/service-call';
import type { Pickup } from '@/types/pickup';
import type { CalendarStop } from '@/types/calendar-stop';
import { getCityCoordinates } from '@/lib/geocoding';

type Pt = [number, number, number];

/** שכבת החום בתוך המפה — נטענת דרך useMap כי leaflet.heat אינו רכיב react. */
function HeatLayer({ points }: { points: Pt[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const layer = L.heatLayer(points, {
      radius: 22,
      blur: 18,
      maxZoom: 11,
      minOpacity: 0.35,
      gradient: { 0.2: '#22c55e', 0.45: '#eab308', 0.7: '#f97316', 1.0: '#dc2626' },
    }).addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map, points]);
  return null;
}

function LegendRow({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[12.5px]" style={{ color: '#14223a' }}>
      <span style={{ color }}>{icon}</span> {label}
    </div>
  );
}

export function ActivityHeatMap({
  orders, serviceCalls, pickups, stops,
}: {
  orders: Order[]; serviceCalls: ServiceCall[]; pickups: Pickup[]; stops: CalendarStop[];
}) {
  // כל פעילות → נקודת חום. מיקום מדויק מהיומן אם יש, אחרת מרכז-העיר.
  const points = useMemo<Pt[]>(() => {
    const pts: Pt[] = [];
    const stopIds = new Set<string>();
    for (const s of stops) {
      if (s.coordinates) { pts.push([s.coordinates.lat, s.coordinates.lng, 0.9]); }
      if (s.orderId) stopIds.add(`o:${s.orderId}`);
      if (s.serviceCallId) stopIds.add(`c:${s.serviceCallId}`);
      if (s.pickupId) stopIds.add(`p:${s.pickupId}`);
    }
    const addByCity = (city: string | undefined, key: string, w: number) => {
      if (stopIds.has(key)) return; // כבר נספר עם קואורדינטה מדויקת מהיומן
      const c = getCityCoordinates(city);
      if (c) pts.push([c.lat, c.lng, w]);
    };
    for (const o of orders) if (!o.duplicateOf) addByCity(o.city, `o:${o.id}`, 0.5);
    for (const c of serviceCalls) if (!c.duplicateOf) addByCity(c.city, `c:${c.id}`, 0.5);
    for (const p of pickups) if (!p.duplicateOf) addByCity(p.city, `p:${p.id}`, 0.6);
    return pts;
  }, [orders, serviceCalls, pickups, stops]);

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#eef1f6' }}>
      <div className="mb-4 flex items-center gap-2">
        <span style={{ color: '#14223a' }}>📍</span>
        <h3 className="text-sm font-bold" style={{ color: '#14223a' }}>מפת פעילות ארצית</h3>
        <span className="ms-auto text-[11px] text-slate-400">{points.length.toLocaleString()} נקודות</span>
      </div>
      <div className="relative">
        <div className="h-[340px] w-full overflow-hidden rounded-xl" dir="ltr">
          <MapContainer
            center={[31.6, 34.95]}
            zoom={7}
            scrollWheelZoom={false}
            style={{ height: '100%', width: '100%', background: '#eef4ef' }}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            <HeatLayer points={points} />
          </MapContainer>
        </div>
        {/* מקרא צף בסגנון המוקאפ */}
        <div className="absolute end-3 top-3 z-[500] rounded-xl border bg-white/95 px-3 py-2 shadow-sm" style={{ borderColor: '#eef1f6' }} dir="rtl">
          <LegendRow icon={<Truck className="h-4 w-4" />} label="אספקות" color="#16a34a" />
          <div className="my-1" />
          <LegendRow icon={<Wrench className="h-4 w-4" />} label="קריאות שירות" color="#2b6cb0" />
          <div className="my-1" />
          <LegendRow icon={<PackageOpen className="h-4 w-4" />} label="איסופים" color="#7c5cf0" />
        </div>
        {/* פס גרדיאנט נמוך→גבוה */}
        <div className="absolute bottom-3 end-3 z-[500] flex items-center gap-2 rounded-lg bg-white/95 px-2 py-1 text-[10px] shadow-sm" dir="rtl">
          <span className="text-slate-500">גבוה</span>
          <span className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(to left,#dc2626,#f97316,#eab308,#22c55e)' }} />
          <span className="text-slate-500">נמוך</span>
        </div>
      </div>
    </div>
  );
}
