import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { Truck, Wrench, PackageOpen } from 'lucide-react';
import type { Order } from '@/types/order';
import type { ServiceCall } from '@/types/service-call';
import type { Pickup } from '@/types/pickup';
import type { CalendarStop } from '@/types/calendar-stop';
import { getCityCoordinates } from '@/lib/geocoding';

type Pt = [number, number, number];
type Bucket = Map<string, { lat: number; lng: number; count: number }>;
type Cat = 'deliveries' | 'service' | 'pickups';

const ISRAEL_BOUNDS = L.latLngBounds([29.45, 34.2], [33.35, 35.95]);

function FitIsrael() {
  const map = useMap();
  useEffect(() => { map.fitBounds(ISRAEL_BOUNDS, { padding: [8, 8] }); }, [map]);
  return null;
}

function HeatLayer({ points }: { points: Pt[] }) {
  const map = useMap();
  useEffect(() => {
    const layer = L.heatLayer(points, {
      radius: 18, blur: 14, max: 1.0, maxZoom: 12, minOpacity: 0.22,
      gradient: { 0.1: '#22c55e', 0.3: '#84cc16', 0.5: '#eab308', 0.75: '#f97316', 1.0: '#dc2626' },
    }).addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map, points]);
  return null;
}

function bump(b: Bucket, lat: number, lng: number) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cur = b.get(key);
  if (cur) cur.count++;
  else b.set(key, { lat, lng, count: 1 });
}

export function ActivityHeatMap({
  orders, serviceCalls, pickups, stops,
}: {
  orders: Order[]; serviceCalls: ServiceCall[]; pickups: Pickup[]; stops: CalendarStop[];
}) {
  const [active, setActive] = useState<Record<Cat, boolean>>({ deliveries: true, service: true, pickups: true });
  const toggle = (c: Cat) => setActive((a) => ({ ...a, [c]: !a[c] }));

  // דלי נפרד לכל סוג — כדי שהבורר יסנן. מיקום מדויק מהיומן, אחרת מרכז-עיר.
  const buckets = useMemo(() => {
    const b: Record<Cat, Bucket> = { deliveries: new Map(), service: new Map(), pickups: new Map() };
    const seen = new Set<string>();
    for (const s of stops) {
      const cat: Cat | null = s.sourceType === 'delivery' ? 'deliveries'
        : s.sourceType === 'service' ? 'service' : s.sourceType === 'pickup' ? 'pickups' : null;
      if (cat && s.coordinates) bump(b[cat], s.coordinates.lat, s.coordinates.lng);
      if (s.orderId) seen.add(`o:${s.orderId}`);
      if (s.serviceCallId) seen.add(`c:${s.serviceCallId}`);
      if (s.pickupId) seen.add(`p:${s.pickupId}`);
    }
    const byCity = (cat: Cat, city: string | undefined, key: string) => {
      if (seen.has(key)) return;
      const c = getCityCoordinates(city);
      if (c) bump(b[cat], c.lat, c.lng);
    };
    for (const o of orders) if (!o.duplicateOf) byCity('deliveries', o.city, `o:${o.id}`);
    for (const c of serviceCalls) if (!c.duplicateOf) byCity('service', c.city, `c:${c.id}`);
    for (const p of pickups) if (!p.duplicateOf) byCity('pickups', p.city, `p:${p.id}`);
    return b;
  }, [orders, serviceCalls, pickups, stops]);

  // מיזוג הסוגים הפעילים + נרמול sqrt
  const { points, total } = useMemo(() => {
    const merged = new Map<string, { lat: number; lng: number; count: number }>();
    (Object.keys(active) as Cat[]).forEach((cat) => {
      if (!active[cat]) return;
      for (const [key, v] of buckets[cat]) {
        const cur = merged.get(key);
        if (cur) cur.count += v.count;
        else merged.set(key, { lat: v.lat, lng: v.lng, count: v.count });
      }
    });
    const arr = [...merged.values()];
    const denom = Math.sqrt(Math.max(...arr.map((x) => x.count), 1));
    const pts: Pt[] = arr.map((x) => [x.lat, x.lng, Math.max(Math.sqrt(x.count) / denom, 0.12)]);
    return { points: pts, total: arr.reduce((s, x) => s + x.count, 0) };
  }, [buckets, active]);

  const items: { cat: Cat; label: string; icon: React.ReactNode; color: string }[] = [
    { cat: 'deliveries', label: 'אספקות', icon: <Truck className="h-4 w-4" />, color: '#16a34a' },
    { cat: 'service', label: 'קריאות שירות', icon: <Wrench className="h-4 w-4" />, color: '#2b6cb0' },
    { cat: 'pickups', label: 'איסופים', icon: <PackageOpen className="h-4 w-4" />, color: '#7c5cf0' },
  ];

  return (
    /*
      🔴🔴 **`isolate` ולא הורדת z-index של הרכיבים.** עידן, 25/08/2026:
      "המפה עולה על הכותרת." Leaflet נותן לפקדים שלו `z-index: 1000`
      משלו, והמקרא והבורר כאן יושבים על `z-[500]`, בזמן שכותרת האתר
      היא `sticky z-50`. כלומר כל דבר במפה גבוה מהכותרת.
      ⭐ `isolation: isolate` יוצר הקשר ערימה משלו, וכל ה-z-index
      שבפנים נמדדים **בתוכו**. הכרטיס כולו יושב אז ברמה הטבעית של
      הדף, מתחת לכותרת, בלי לגעת ברכיבים הפנימיים ובלי להילחם ב-CSS
      של Leaflet בכל שדרוג גרסה.
    */
    <div className="isolate rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#eef1f6' }}>
      <div className="mb-4 flex items-center gap-2">
        <span style={{ color: '#14223a' }}>📍</span>
        <h3 className="text-sm font-bold" style={{ color: '#14223a' }}>מפת פעילות ארצית</h3>
        <span className="ms-auto text-[11px] text-slate-400">{total.toLocaleString()} פעילויות · {points.length} מוקדים</span>
      </div>
      <div className="relative">
        <div className="h-[360px] w-full overflow-hidden rounded-xl" dir="ltr">
          <MapContainer
            center={[31.6, 34.95]} zoom={7}
            scrollWheelZoom={false} zoomControl={false} doubleClickZoom
            style={{ height: '100%', width: '100%', background: '#eef4ef' }}
            attributionControl={false} maxBounds={ISRAEL_BOUNDS.pad(0.6)}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            <ZoomControl position="topleft" />
            <FitIsrael />
            <HeatLayer points={points} />
          </MapContainer>
        </div>

        {/* מקרא לחיץ — בורר בין הסוגים */}
        <div className="absolute start-3 top-3 z-[500] rounded-xl border bg-white/95 p-1.5 shadow-sm" style={{ borderColor: '#eef1f6' }} dir="rtl">
          {items.map((it) => {
            const on = active[it.cat];
            return (
              <button key={it.cat} onClick={() => toggle(it.cat)} type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors hover:bg-slate-50"
                style={{ color: on ? '#14223a' : '#b3bccb', fontWeight: on ? 600 : 400 }}>
                <span className="flex h-4 w-4 items-center justify-center rounded border" style={{ borderColor: on ? it.color : '#d3d9e4', background: on ? it.color : 'transparent' }}>
                  {on && <span className="text-[10px] leading-none text-white">✓</span>}
                </span>
                <span style={{ color: on ? it.color : '#c2c9d6' }}>{it.icon}</span>
                {it.label}
              </button>
            );
          })}
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
