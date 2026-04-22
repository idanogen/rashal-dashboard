import { useMemo, useState } from 'react';
import type { CalendarStop } from '@/types/delivery';
import { DRIVER_CONFIG } from '@/types/delivery';
import type { DriverName } from '@/types/route';
import { RouteMap } from './RouteMap';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Navigation,
  XCircle,
  Truck,
  MapPin,
  Phone,
  Package,
  Wrench,
  ClipboardList,
  Wand2,
  Sparkles,
} from 'lucide-react';
import { buildWazeUrl, buildTelUrl } from '@/lib/navigation';
import { getCityCoordinates } from '@/lib/geocoding';
import { optimizeStops } from '@/lib/stopOptimizer';
import { motion, AnimatePresence } from 'framer-motion';
import { RouteCelebration } from './RouteCelebration';

interface DayMapDialogProps {
  open: boolean;
  onClose: () => void;
  date: string | null;
  /** All calendar stops for the selected date (both drivers, both types). */
  stops: CalendarStop[];
  /**
   * Called when user clicks "אופטימיזציה" — receives the active driver
   * and the new ordered list of stopIds (nearest-neighbour from warehouse).
   */
  onOptimize?: (driver: DriverName, orderedIds: string[]) => void;
}

const DRIVER_ORDER: DriverName[] = ['רודי דויד', 'נהג חיצוני מועלם'];

const sourceConfig = {
  delivery: { Icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', label: 'משלוח' },
  service: { Icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50', label: 'שירות' },
  task: { Icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', label: 'משימה' },
} as const;

export function DayMapDialog({ open, onClose, date, stops, onOptimize }: DayMapDialogProps) {
  const [activeDriver, setActiveDriver] = useState<DriverName>('רודי דויד');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [celebration, setCelebration] = useState<{
    show: boolean;
    distance: number;
    unresolvableCount: number;
  }>({ show: false, distance: 0, unresolvableCount: 0 });

  // Group stops for this day by driver, filtering cancelled.
  const stopsByDriver = useMemo(() => {
    const map = new Map<DriverName, CalendarStop[]>();
    DRIVER_ORDER.forEach((d) => map.set(d, []));
    stops
      .filter((s) => s.status !== 'cancelled')
      .sort((a, b) => {
        // Keep sequence ordering — stops is expected to carry the field,
        // but our view-level CalendarStop doesn't include it. Rely on input
        // order (the page sorts by sequence already).
        return 0;
      })
      .forEach((s) => {
        const list = map.get(s.driver as DriverName);
        if (list) list.push(s);
      });
    return map;
  }, [stops]);

  // Auto-select a driver that has stops.
  const effectiveDriver = useMemo(() => {
    if ((stopsByDriver.get(activeDriver)?.length ?? 0) > 0) return activeDriver;
    for (const d of DRIVER_ORDER) {
      if ((stopsByDriver.get(d)?.length ?? 0) > 0) return d;
    }
    return activeDriver;
  }, [activeDriver, stopsByDriver]);

  const activeStops = stopsByDriver.get(effectiveDriver) ?? [];

  const formattedDate = useMemo(() => {
    if (!date) return '';
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [date]);

  // First non-resolved stop — for the "navigate to next" primary action.
  const nextStop = useMemo(() => {
    return activeStops.find(
      (s) => s.status !== 'completed' && s.status !== 'not_completed',
    );
  }, [activeStops]);

  const nextStopWazeUrl = useMemo(() => {
    if (!nextStop) return null;
    const coords = getCityCoordinates(nextStop.city);
    return buildWazeUrl({
      address: nextStop.address ?? nextStop.city ?? null,
      coordinates: coords ?? null,
    });
  }, [nextStop]);

  const handleOptimize = () => {
    if (!onOptimize || activeStops.length < 2 || isOptimizing) return;

    setIsOptimizing(true);
    const result = optimizeStops(activeStops);

    // 1. Beetle hits the road IMMEDIATELY on click
    setCelebration({
      show: true,
      distance: result.totalDistance,
      unresolvableCount: result.unresolvableCount,
    });

    // 2. Trigger DB update in parallel — stops reorder in the background
    //    while the Beetle drives its 4-second run. By the time the reveal
    //    appears, the list on the left has already settled.
    onOptimize(effectiveDriver, result.orderedIds);

    // 3. Release the button shortly — celebration manages its own lifecycle
    setTimeout(() => setIsOptimizing(false), 400);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="!max-w-none w-[96vw] h-[95vh] lg:h-[92vh] flex flex-col p-0 gap-0 [&>button:last-child]:hidden"
        dir="rtl"
        aria-describedby={undefined}
      >
        {/* Header */}
        <div className="z-10 flex flex-shrink-0 items-center justify-between gap-2 border-b p-3">
          <div className="flex min-w-0 items-center gap-2">
            <Navigation className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="truncate text-sm font-bold">{formattedDate}</span>
          </div>

          {/* Driver tabs */}
          <div className="flex flex-shrink-0 items-center gap-1">
            {DRIVER_ORDER.map((driver) => {
              const cfg = DRIVER_CONFIG[driver];
              const count = stopsByDriver.get(driver)?.length ?? 0;
              const isActive = effectiveDriver === driver;
              return (
                <button
                  key={driver}
                  onClick={() => setActiveDriver(driver)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                    isActive
                      ? `${cfg.color} ring-1 ring-current/20 shadow-sm`
                      : 'text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <div
                    className={`h-2 w-2 rounded-full ${cfg.badgeColor}`}
                  />
                  <span>{driver}</span>
                  <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border hover:bg-muted/60"
            title="סגור"
          >
            <XCircle className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Action bar: Optimize + primary CTA */}
        <div className="mx-3 mt-2 flex flex-shrink-0 items-center gap-2">
          {/* Optimize button — with live pulsing + sparkle animation when active */}
          {onOptimize && activeStops.length >= 2 && (
            <motion.button
              onClick={handleOptimize}
              disabled={isOptimizing}
              whileHover={!isOptimizing ? { scale: 1.04 } : {}}
              whileTap={!isOptimizing ? { scale: 0.96 } : {}}
              animate={
                isOptimizing
                  ? {
                      boxShadow: [
                        '0 0 0 0 rgba(16, 185, 129, 0.6)',
                        '0 0 0 12px rgba(16, 185, 129, 0)',
                      ],
                    }
                  : {}
              }
              transition={
                isOptimizing
                  ? { duration: 1, repeat: Infinity, ease: 'easeOut' }
                  : { type: 'spring', stiffness: 400, damping: 20 }
              }
              className="relative flex items-center gap-1.5 overflow-hidden rounded-lg border border-emerald-300 bg-gradient-to-l from-emerald-50 to-emerald-100 px-3.5 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition-colors hover:from-emerald-100 hover:to-emerald-200 disabled:cursor-wait dark:border-emerald-800 dark:from-emerald-950/50 dark:to-emerald-900/30 dark:text-emerald-400"
            >
              {/* Shimmer sweep when optimizing */}
              {isOptimizing && (
                <motion.span
                  className="absolute inset-0 bg-gradient-to-l from-transparent via-white/60 to-transparent dark:via-white/10"
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                />
              )}
              <motion.span
                animate={
                  isOptimizing
                    ? { rotate: [0, 360] }
                    : { rotate: 0 }
                }
                transition={
                  isOptimizing
                    ? { duration: 1.2, repeat: Infinity, ease: 'linear' }
                    : {}
                }
                className="relative z-10 flex"
              >
                {isOptimizing ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
              </motion.span>
              <span className="relative z-10">
                {isOptimizing ? 'מסדר…' : 'סדר מחדש מהמחסן'}
              </span>
            </motion.button>
          )}

          {/* Primary CTA — navigate to next stop */}
          {nextStop && nextStopWazeUrl && (
            <a
              href={nextStopWazeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-between gap-2 rounded-xl bg-gradient-to-l from-sky-500 to-sky-600 px-4 py-2.5 text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white text-sky-600 shadow-sm">
                  <Navigation className="h-6 w-6" />
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-[10px] font-medium opacity-90">
                    נווט לעצירה הבאה ב-Waze
                  </div>
                  <div className="truncate text-sm font-bold">
                    {nextStop.customerName}
                  </div>
                </div>
              </div>
            </a>
          )}
        </div>

        {/* Content: map + stops list */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          {/* Map */}
          <div className="flex-shrink-0 lg:flex-1">
            <RouteMap
              stops={activeStops}
              height={
                typeof window !== 'undefined' && window.innerWidth >= 1024
                  ? 'calc(92vh - 110px)'
                  : '50vh'
              }
            />
          </div>

          {/* Side panel — stops list */}
          <div className="flex-1 overflow-y-auto border-t lg:w-80 lg:flex-none lg:border-s lg:border-t-0 xl:w-96">
            <div className="flex flex-col gap-2 p-3">
              {DRIVER_ORDER.map((driver) => {
                const cfg = DRIVER_CONFIG[driver];
                const ds = stopsByDriver.get(driver) ?? [];
                const isActive = effectiveDriver === driver;
                if (!isActive) return null;
                return (
                  <div key={driver} className="space-y-1.5">
                    <div
                      className={`flex items-center justify-between rounded-md px-2.5 py-1.5 ${cfg.color}`}
                    >
                      <div className="flex items-center gap-2">
                        <Truck className="h-3.5 w-3.5" />
                        <span className="text-xs font-bold">{driver}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {ds.length} עצירות
                      </Badge>
                    </div>
                    {ds.length === 0 ? (
                      <div className="py-6 text-center text-xs text-muted-foreground/60">
                        אין עצירות
                      </div>
                    ) : (
                      <motion.div className="space-y-1" layout>
                        <AnimatePresence initial={false}>
                          {ds.map((stop, idx) => (
                            <motion.div
                              key={stop.stopId}
                              layout
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 8 }}
                              transition={{
                                type: 'spring',
                                stiffness: 350,
                                damping: 28,
                              }}
                            >
                              <SideStopItem stop={stop} index={idx + 1} />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="hidden flex-shrink-0 justify-end border-t p-2 lg:flex">
          <Button variant="ghost" size="sm" onClick={onClose}>
            סגור
          </Button>
        </div>
      </DialogContent>

      {/* Celebration overlay — renders OUTSIDE DialogContent so it covers the whole screen */}
      <RouteCelebration
        show={celebration.show}
        distance={celebration.distance}
        unresolvableCount={celebration.unresolvableCount}
        onComplete={() => setCelebration((c) => ({ ...c, show: false }))}
      />
    </Dialog>
  );
}

function SideStopItem({ stop, index }: { stop: CalendarStop; index: number }) {
  const coords = getCityCoordinates(stop.city);
  const wazeUrl = buildWazeUrl({
    address: stop.address ?? stop.city ?? null,
    coordinates: coords ?? null,
  });
  const telUrl = buildTelUrl(stop.phone);
  const src = sourceConfig[stop.sourceType];
  const SrcIcon = src.Icon;
  const isDelivered = stop.status === 'completed';
  const isNotDelivered = stop.status === 'not_completed';

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background/80 p-2 text-xs transition-all hover:shadow-sm">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
        {index}
      </div>
      <span
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md ${src.bg} ${src.color}`}
        title={src.label}
      >
        <SrcIcon className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate font-medium ${isNotDelivered ? 'text-muted-foreground line-through' : ''}`}
        >
          {stop.customerName}
          {isDelivered && <span className="ms-1 text-emerald-600">✓</span>}
        </div>
        {(stop.address || stop.city) && (
          <p className="mt-0.5 flex items-center gap-0.5 truncate text-[10px] text-muted-foreground">
            <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
            {stop.address}
            {stop.address && stop.city ? ', ' : ''}
            {stop.city}
          </p>
        )}
      </div>

      {telUrl && (
        <a
          href={telUrl}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20"
          title={`חייג ללקוח${stop.phone ? ` — ${stop.phone}` : ''}`}
        >
          <Phone className="h-3.5 w-3.5" />
        </a>
      )}

      {wazeUrl && (
        <a
          href={wazeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 transition-colors hover:bg-sky-500/20 ${
            isDelivered ? 'opacity-40 grayscale' : ''
          }`}
          title="נווט ב-Waze"
        >
          <Navigation className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
