import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ZONES, REGION_LABELS, type RegionType } from '@/types/zone';
import { MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoneFilterProps {
  selectedZones: string[];
  onZoneToggle: (zoneId: string) => void;
  onClearAll: () => void;
  orderCountByZone: Map<string, number>;
}

export function ZoneFilter({
  selectedZones,
  onZoneToggle,
  onClearAll,
  orderCountByZone,
}: ZoneFilterProps) {
  const regions: RegionType[] = ['north', 'center', 'south'];

  const zonesByRegion = regions.reduce(
    (acc, region) => {
      acc[region] = ZONES.filter((z) => z.region === region);
      return acc;
    },
    {} as Record<RegionType, typeof ZONES>
  );

  const totalSelected = selectedZones.length;

  return (
    <div className="mb-4 space-y-4 rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <h4 className="font-semibold">סינון לפי אזור</h4>
          {totalSelected > 0 && (
            <Badge variant="secondary">{totalSelected} נבחרו</Badge>
          )}
        </div>
        {totalSelected > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-8 gap-1"
          >
            <X className="h-3 w-3" />
            נקה הכל
          </Button>
        )}
      </div>

      {/* Zone badges by region */}
      <div className="space-y-3">
        {regions.map((region) => {
          const regionZones = zonesByRegion[region];
          const regionHasSelection = regionZones.some((z) =>
            selectedZones.includes(z.id)
          );

          return (
            <div key={region} className="space-y-2">
              {/* Region label */}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-sm font-medium',
                    regionHasSelection && 'text-primary'
                  )}
                >
                  {REGION_LABELS[region]}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Zone badges */}
              <div className="flex flex-wrap gap-2">
                {regionZones.map((zone) => {
                  const count = orderCountByZone.get(zone.id) || 0;
                  const isSelected = selectedZones.includes(zone.id);
                  const hasOrders = count > 0;

                  return (
                    <Badge
                      key={zone.id}
                      variant={isSelected ? 'default' : 'outline'}
                      className={cn(
                        'transition-all hover:scale-105',
                        hasOrders
                          ? 'cursor-pointer'
                          : 'cursor-not-allowed opacity-30',
                        isSelected && zone.color
                      )}
                      onClick={() => hasOrders && onZoneToggle(zone.id)}
                    >
                      {zone.name}
                      {count > 0 && (
                        <span
                          className={cn(
                            'mr-1.5 text-xs font-bold',
                            isSelected
                              ? 'text-white'
                              : 'text-muted-foreground'
                          )}
                        >
                          ({count})
                        </span>
                      )}
                    </Badge>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
