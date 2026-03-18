import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DRIVERS, type DriverName } from '@/types/route';
import { Truck, Package } from 'lucide-react';

interface DriverSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectDriver: (driver: DriverName) => void;
  orderInfo?: string;
  customerName?: string;
}

const driverConfig: Record<DriverName, {
  icon: typeof Truck;
  gradient: string;
  border: string;
  iconColor: string;
  ring: string;
}> = {
  'רודי דויד': {
    icon: Truck,
    gradient: 'from-blue-500/10 to-blue-600/5',
    border: 'border-blue-200',
    iconColor: 'text-blue-600',
    ring: 'hover:ring-blue-300',
  },
  'נהג חיצוני מועלם': {
    icon: Truck,
    gradient: 'from-purple-500/10 to-purple-600/5',
    border: 'border-purple-200',
    iconColor: 'text-purple-600',
    ring: 'hover:ring-purple-300',
  },
};

export function DriverSelector({
  open,
  onClose,
  onSelectDriver,
  orderInfo,
  customerName,
}: DriverSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-base">בחר נהג למשלוח</DialogTitle>
        </DialogHeader>

        {orderInfo && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{orderInfo}</div>
              {customerName && (
                <div className="truncate text-xs text-muted-foreground">
                  {customerName}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 py-2">
          {DRIVERS.map((driver) => {
            const config = driverConfig[driver];
            const Icon = config.icon;
            return (
              <button
                key={driver}
                className={`
                  group relative flex flex-col items-center justify-center gap-2.5
                  h-24 rounded-xl border bg-gradient-to-br transition-all duration-200
                  hover:ring-2 hover:shadow-md active:scale-[0.97]
                  ${config.gradient} ${config.border} ${config.ring}
                `}
                onClick={() => {
                  onSelectDriver(driver);
                }}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border bg-background/80 shadow-sm transition-transform group-hover:scale-110 ${config.iconColor}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium">{driver}</span>
              </button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          onClick={onClose}
          className="w-full text-muted-foreground hover:text-foreground"
        >
          ביטול
        </Button>
      </DialogContent>
    </Dialog>
  );
}
