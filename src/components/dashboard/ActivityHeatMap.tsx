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

// גבולות ישראל למיקוד המפה (מונע תצוגת סוריה/מצרים/ירדן)
const ISRAEL_BOUNDS = L.latLngBounds([29.45, 34.2], [33.35, 35.95]);

function FitIsrael() {
  const map = useMap();
  useEffect(() => { map.fitBounds(ISRAEL_BOUNDS, { padding: [8, 8] }); }, [map]);
  return null;
}

/** שכבת החום — מקובצת ומנורמלת כדי שיהיו נקודות חמות מובחנות, לא כתם אחד. */
function HeatLayer({ points }: { points: Pt[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const layer = L.heatLayer(points, {
      radius: 18,
      blur: 14,
      max: 1.0,          // הנקודות כבר מנורמלות ל-0..1
      maxZoom: 12,
      minOpacity: 0.22,
      gradient: { 0.1: '#22c55e', 0.3: '#84cc16', 0.5: '#eab308', 0.75: '#f97316', 1.0: '#dc2626' },
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
  const { points, total } = useMemo(() => {
    // 1) מקבצים כל פעילות לדלי לפי מיקום (עיגול ~1 ק"מ), סופרים.
    const buckets = new Map<string, { lat: number; lng: number; count: number }>();
    const seen = new Set<string>();
    const add = (lat: number, lng: number) => {
      const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
      const b = buckets.get(key);
      if (b) b.count++;
      else buckets.set(key, { lat, lng, count: 1 });
    };
    // יומן: מיקום מדויק כשקיים, וגם מסמן שהמקור כבר נספר
    for (const s of stops) {
      if (s.coordinates) add(s.coordinates.lat, s.coordinates.lng);
      if (s.orderId) seen.add(`o:${s.orderId}`);
      if (s.serviceCallId) seen.add(`c:${s.serviceCallId}`);
      if (s.pickupId) seen.add(`p:${s.pickupId}`);
    }
    const addByCity = (city: string | undefined, key: string) => {
      if (seen.has(key)) return;
      const c = getCityCoordinates(city);
      if (c) add(c.lat, c.lng);
    };
    for (const o of orders) if (!o.duplicateOf) addByCity(o.city, `o:${o.id}`);
    for (const c of serviceCalls) if (!c.duplicateOf) addByCity(c.city, `c:${c.id}`);
    for (const p of pickups) if (!p.duplicateOf) addByCity(p.city, `p:${p.id}`);

    // 2) נרמול: sqrt(count)/sqrt(max) — מפזר כך שערים גדולות אדומות והשאר בגווני ביניים ולא הכל רווי.
    const arr = [...buckets.values()];
    const maxCount = Math.max(...arr.map((b) => b.count), 1);
    const denom = Math.sqrt(maxCount);
    const pts: Pt[] = arr.map((b) => [b.lat, b.lng, Math.max(Math.sqrt(b.count) / denom, 0.12)]);
    const total = arr.reduce((s, b) => s + b.count, 0);
    return { points: pts, total };
  }, [orders, serviceCalls, pickups, stops]);

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#eef1f6' }}>
      <div className="mb-4 flex items-center gap-2">
        <span style={{ color: '#14223a' }}>📍</span>
        <h3 className="text-sm font-bold" style={{ color: '#14223a' }}>מפת פעילות ארצית</h3>
        <span className="ms-auto text-[11px] text-slate-400">{total.toLocaleString()} פעילויות · {points.length} מוקדים</span>
      </div>
      <div className="relative">
        <div className="h-[360px] w-full overflow-hidden rounded-xl" dir="ltr">
          <MapContainer
            center={[31.6, 34.95]}
            zoom={7}
            scrollWheelZoom={false}
            zoomControl={false}
            dragging={false}
            doubleClickZoom={false}
            style={{ height: '100%', width: '100%', background: '#eef4ef' }}
            attributionControl={false}
            maxBounds={ISRAEL_BOUNDS.pad(0.4)}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            <FitIsrael />
            <HeatLayer points={points} />
          </MapContainer>
        </div>
        <div className="absolute start-3 top-3 z-[500] rounded-xl border bg-white/95 px-3 py-2 shadow-sm" style={{ borderColor: '#eef1f6' }} dir="rtl">
          <LegendRow icon={<Truck className="h-4 w-4" />} label="אספקות" color="#16a34a" />
          <div className="my-1" />
          <LegendRow icon={<Wrench className="h-4 w-4" />} label="קריאות שירות" color="#2b6cb0" />
          <div className="my-1" />
          <LegendRow icon={<PackageOpen className="h-4 w-4" />} label="איסופים" color="#7c5cf0" />
        </div>
        <div className="absolute bottom-3 end-3 z-[500] flex items-center gap-2 rounded-lg bg-white/95 px-2 py-1 text-[10px] shadow-sm" dir="rtl">
          <span className="text-slate-500">גבוה</span>
          <span className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(to left,#dc2626,#f97316,#eab308,#22c55e)' }} />
          <span className="text-slate-500">נמוך</span>
        </div>
      </div>
    </div>
  );
}
