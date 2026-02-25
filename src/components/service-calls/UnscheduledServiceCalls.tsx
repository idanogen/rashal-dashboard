import { useState, useMemo } from 'react';
import type { ServiceCall } from '@/types/service-call';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Wrench, Phone, MapPin, Clock, Truck, X, Undo2, RotateCcw, ChevronDown, ChevronLeft, ChevronsUpDown } from 'lucide-react';
import { ZoneFilter } from '@/components/deliveries/ZoneFilter';
import { RouteBuilderDialog } from '@/components/deliveries/RouteBuilderDialog';
import { getZoneById, ZONES } from '@/types/zone';
import { getDaysSinceCreated, getDaysColor, cn } from '@/lib/utils';
import type { Order } from '@/types/order';

// ─── Service Call Card ────────────────────────────────────────
interface ServiceCallCardProps {
  call: ServiceCall;
  isExcluded?: boolean;
  onExclude?: (id: string) => void;
  onRestore?: (id: string) => void;
}

function ServiceCallCard({ call, isExcluded, onExclude, onRestore }: ServiceCallCardProps) {
  const days = getDaysSinceCreated(call.created);
  const daysColor = getDaysColor(days);

  return (
    <Card
      className={cn(
        'relative transition-all',
        isExcluded
          ? 'opacity-40 border-dashed'
          : 'hover:shadow-md'
      )}
    >
      <CardContent className="p-3">
        {isExcluded ? (
          <button
            onClick={() => onRestore?.(call.id)}
            className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            title="החזר למסלול"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={() => onExclude?.(call.id)}
            className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
            title="הסר מהמסלול"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="mb-2 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'truncate text-sm font-semibold',
                isExcluded && 'line-through'
              )}
            >
              {call.customerName}
            </p>
            {call.phone && (
              <div className="mt-1 flex items-center gap-1">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <a
                  href={`tel:${call.phone}`}
                  className="text-xs text-muted-foreground hover:text-primary"
                  dir="ltr"
                >
                  {call.phone}
                </a>
              </div>
            )}
          </div>
          {days !== null && (
            <Badge variant="outline" className={`text-xs ${daysColor}`}>
              <Clock className="ml-1 h-3 w-3" />
              {days}d
            </Badge>
          )}
        </div>
        {call.city && (
          <div className="flex items-center gap-1 border-t pt-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{call.city}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Adapter: ServiceCall → Order-like shape for RouteBuilderDialog ───
function serviceCallToOrder(call: ServiceCall): Order {
  return {
    id: call.id,
    customerName: call.customerName,
    phone: call.phone,
    customerStatus: call.customerStatus,
    healthFund: call.healthFund,
    openedBy: call.openedBy,
    city: call.city,
    address: call.city, // use city as address for service calls
    created: call.created,
  };
}

// ─── Main Component ────────────────────────────────────────
interface UnscheduledServiceCallsProps {
  calls: ServiceCall[];
  callCountByZone: Map<string, number>;
  callZoneMap: Map<string, string>;
}

export function UnscheduledServiceCalls({
  calls,
  callCountByZone,
  callZoneMap,
}: UnscheduledServiceCallsProps) {
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'grouped'>('all');
  const [isRouteBuilderOpen, setIsRouteBuilderOpen] = useState(false);
  const [excludedCallIds, setExcludedCallIds] = useState<Set<string>>(new Set());
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());

  const handleZoneToggle = (zoneId: string) => {
    setSelectedZones((prev) =>
      prev.includes(zoneId)
        ? prev.filter((id) => id !== zoneId)
        : [...prev, zoneId]
    );
  };

  const handleClearAllZones = () => {
    setSelectedZones([]);
    setExcludedCallIds(new Set());
  };

  const handleExcludeCall = (callId: string) => {
    setExcludedCallIds((prev) => new Set(prev).add(callId));
  };

  const handleRestoreCall = (callId: string) => {
    setExcludedCallIds((prev) => {
      const next = new Set(prev);
      next.delete(callId);
      return next;
    });
  };

  const handleResetExcluded = () => {
    setExcludedCallIds(new Set());
  };

  const handleToggleZone = (zoneId: string) => {
    setExpandedZones((prev) => {
      const next = new Set(prev);
      next.has(zoneId) ? next.delete(zoneId) : next.add(zoneId);
      return next;
    });
  };

  const filteredCalls =
    selectedZones.length > 0
      ? calls.filter((c) => {
          const zone = callZoneMap.get(c.id);
          return zone && selectedZones.includes(zone);
        })
      : calls;

  const activeCalls = filteredCalls.filter(
    (c) => !excludedCallIds.has(c.id)
  );

  const excludedCount = filteredCalls.length - activeCalls.length;

  const groupedByZone = useMemo(() => {
    const map = new Map<string, ServiceCall[]>();
    for (const call of filteredCalls) {
      const zoneId = callZoneMap.get(call.id) || 'unassigned';
      const group = map.get(zoneId) || [];
      group.push(call);
      map.set(zoneId, group);
    }
    const sorted = new Map<string, ServiceCall[]>();
    const zoneOrder = ZONES.map((z) => z.id);
    Array.from(map.entries())
      .sort(([a], [b]) => {
        const idxA = a === 'unassigned' ? Infinity : zoneOrder.indexOf(a);
        const idxB = b === 'unassigned' ? Infinity : zoneOrder.indexOf(b);
        return (idxA === -1 ? Infinity : idxA) - (idxB === -1 ? Infinity : idxB);
      })
      .forEach(([k, v]) => sorted.set(k, v));
    return sorted;
  }, [filteredCalls, callZoneMap]);

  const handleToggleAllZones = () => {
    const allZoneIds = Array.from(groupedByZone.keys());
    const allExpanded = allZoneIds.every((id) => expandedZones.has(id));
    if (allExpanded) {
      setExpandedZones(new Set());
    } else {
      setExpandedZones(new Set(allZoneIds));
    }
  };

  const allZonesExpanded = useMemo(() => {
    const allZoneIds = Array.from(groupedByZone.keys());
    return allZoneIds.length > 0 && allZoneIds.every((id) => expandedZones.has(id));
  }, [groupedByZone, expandedZones]);

  // Convert active service calls to Order shape for RouteBuilderDialog
  const activeOrdersForDialog = useMemo(
    () => activeCalls.map(serviceCallToOrder),
    [activeCalls]
  );

  if (calls.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed bg-muted/30 p-6 text-center">
        <Wrench className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          אין קריאות שירות חדשות
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Zone Filter */}
      <ZoneFilter
        selectedZones={selectedZones}
        onZoneToggle={handleZoneToggle}
        onClearAll={handleClearAllZones}
        orderCountByZone={callCountByZone}
      />

      {/* Main Panel */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-bold">קריאות שירות חדשות</h3>
              <Badge variant="secondary">{filteredCalls.length}</Badge>
              {excludedCount > 0 && (
                <>
                  <Badge variant="outline" className="text-destructive border-destructive/30">
                    {excludedCount} הוסרו
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetExcluded}
                    className="h-7 gap-1 text-xs"
                  >
                    <RotateCcw className="h-3 w-3" />
                    אפס בחירה
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="default"
                variant="default"
                onClick={() => setIsRouteBuilderOpen(true)}
                disabled={activeCalls.length === 0}
                className="gap-2"
              >
                <Truck className="h-4 w-4" />
                בנה מסלול ({activeCalls.length})
              </Button>
              <Select
                value={viewMode}
                onValueChange={(v) => setViewMode(v as 'all' | 'grouped')}
              >
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">תצוגה רגילה</SelectItem>
                  <SelectItem value="grouped">קיבוץ לפי אזור</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Content */}
        {viewMode === 'all' ? (
          <div className="grid max-h-[500px] grid-cols-1 gap-3 overflow-y-auto p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredCalls.map((call) => (
              <div key={call.id} className="group">
                <ServiceCallCard
                  call={call}
                  isExcluded={excludedCallIds.has(call.id)}
                  onExclude={handleExcludeCall}
                  onRestore={handleRestoreCall}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-[600px] space-y-2 overflow-y-auto p-4">
            <div className="mb-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleAllZones}
                className="h-7 gap-1 text-xs text-muted-foreground"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
                {allZonesExpanded ? 'סגור הכל' : 'פתח הכל'}
              </Button>
            </div>
            {Array.from(groupedByZone.entries()).map(
              ([zoneId, zoneCalls]) => {
                const zone = getZoneById(zoneId);
                const activeInZone = zoneCalls.filter(
                  (c) => !excludedCallIds.has(c.id)
                ).length;
                const isExpanded = expandedZones.has(zoneId);
                return (
                  <div key={zoneId} className="overflow-hidden rounded-lg border">
                    <button
                      onClick={() => handleToggleZone(zoneId)}
                      className={cn(
                        'flex w-full items-center gap-2 px-4 py-3 text-right transition-colors hover:bg-muted/50',
                        isExpanded && 'border-b bg-muted/30'
                      )}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronLeft className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      )}
                      {zone?.color && (
                        <span className={cn('h-3 w-3 flex-shrink-0 rounded-full', zone.color)} />
                      )}
                      <span className="font-semibold">
                        {zone?.name || 'ללא אזור'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {activeInZone}/{zoneCalls.length}
                      </Badge>
                    </button>
                    {isExpanded && (
                      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {zoneCalls.map((call) => (
                          <div key={call.id} className="group">
                            <ServiceCallCard
                              call={call}
                              isExcluded={excludedCallIds.has(call.id)}
                              onExclude={handleExcludeCall}
                              onRestore={handleRestoreCall}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* Route Builder Dialog — using same dialog with routeType */}
      <RouteBuilderDialog
        open={isRouteBuilderOpen}
        onOpenChange={setIsRouteBuilderOpen}
        orders={activeOrdersForDialog}
        routeType="service"
      />
    </div>
  );
}
