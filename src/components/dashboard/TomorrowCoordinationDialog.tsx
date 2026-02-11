import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';
import type { Order } from '@/types/order';
import { useRouteOptimizer, type OptimizedRoute } from '@/hooks/useRouteOptimizer';
import { buildRouteUrl } from '@/lib/maps';
import { exportRouteToCSV } from '@/lib/export';

// Import step components
import {
  QuantityInputStep,
  type RouteConfig,
} from '@/components/tomorrow-coordination/QuantityInputStep';
import { RouteProposalStep } from '@/components/tomorrow-coordination/RouteProposalStep';
import { RouteAdjustmentStep } from '@/components/tomorrow-coordination/RouteAdjustmentStep';
import { RouteExportStep } from '@/components/tomorrow-coordination/RouteExportStep';

interface TomorrowCoordinationDialogProps {
  orders: Order[];
}

type Step = 'quantity' | 'proposal' | 'adjustment' | 'export';

export function TomorrowCoordinationDialog({
  orders,
}: TomorrowCoordinationDialogProps) {
  // Dialog state
  const [open, setOpen] = useState(false);

  // Multi-step wizard state
  const [step, setStep] = useState<Step>('quantity');
  const [routeConfig, setRouteConfig] = useState<RouteConfig | null>(null);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [finalRoute, setFinalRoute] = useState<Order[]>([]);

  // Run optimizer only when routeConfig is set
  const currentOptimizedRoute = useRouteOptimizer(
    orders,
    routeConfig?.targetCount ?? 5,
    routeConfig?.startingAddress
  );

  // Update optimizedRoute when config changes
  useEffect(() => {
    if (routeConfig && step === 'proposal') {
      setOptimizedRoute(currentOptimizedRoute);
      setFinalRoute(currentOptimizedRoute.orders);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeConfig, step]);

  // Calculate available orders count
  const availableCount = useMemo(() => {
    return orders.filter(
      (o) =>
        o.orderStatus === 'ממתין לתאום' &&
        o.address &&
        o.city
    ).length;
  }, [orders]);

  // Don't show button if no orders available
  if (availableCount === 0) {
    return null;
  }

  // Reset wizard when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset to initial state when dialog closes
      setTimeout(() => {
        setStep('quantity');
        setRouteConfig(null);
        setOptimizedRoute(null);
        setFinalRoute([]);
      }, 200);
    }
  };

  // Step 1: Quantity Input → Step 2: Proposal
  const handleQuantitySubmit = (config: RouteConfig) => {
    setRouteConfig(config);
    setStep('proposal');
  };

  // Step 2: Proposal → Skip to Export
  const handleProposalAccept = () => {
    setStep('export');
  };

  // Step 2: Proposal → Step 3: Adjustment
  const handleProposalEdit = () => {
    setStep('adjustment');
  };

  // Step 2: Back to Step 1
  const handleProposalBack = () => {
    setStep('quantity');
  };

  // Step 3: Adjustment → Step 4: Export
  const handleAdjustmentNext = (route: Order[]) => {
    setFinalRoute(route);
    setStep('export');
  };

  // Export CSV
  const handleExportCSV = () => {
    exportRouteToCSV(finalRoute);
  };

  // Open Google Maps
  const handleOpenMaps = () => {
    const url = buildRouteUrl(
      finalRoute,
      routeConfig?.startingAddress
    );
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <div className="flex justify-center">
        <Button
          onClick={() => setOpen(true)}
          variant="outline"
          size="lg"
          className="gap-2 border-primary/30 hover:border-primary hover:bg-primary/5"
        >
          <Calendar className="h-5 w-5" />
          המלצות לתיאום מחר
          <Badge variant="secondary" className="mr-2">
            {availableCount} הזמנות
          </Badge>
        </Button>
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              המלצות לתיאום מחר
            </DialogTitle>
            <DialogDescription>
              {step === 'quantity' &&
                'בחר כמה נקודות אתה רוצה לספק מחר והמערכת תצור עבורך מסלול אופטימלי'}
              {step === 'proposal' &&
                'סקור את המסלול המוצע ובחר אם לאשר או לערוך'}
              {step === 'adjustment' &&
                'ערוך את המסלול: שנה סדר, הוסף או הסר הזמנות'}
              {step === 'export' &&
                'המסלול שלך מוכן! ייצא לקובץ או פתח בניווט'}
            </DialogDescription>
          </DialogHeader>

          {/* Conditional Rendering based on step */}
          <div className="mt-2">
            {step === 'quantity' && (
              <QuantityInputStep
                maxAvailable={availableCount}
                onSubmit={handleQuantitySubmit}
              />
            )}

            {step === 'proposal' && optimizedRoute && (
              <RouteProposalStep
                route={optimizedRoute}
                onAccept={handleProposalAccept}
                onEdit={handleProposalEdit}
                onBack={handleProposalBack}
              />
            )}

            {step === 'adjustment' && (
              <RouteAdjustmentStep
                initialRoute={finalRoute}
                allOrders={orders}
                onNext={handleAdjustmentNext}
              />
            )}

            {step === 'export' && (
              <RouteExportStep
                route={finalRoute}
                totalDistance={optimizedRoute?.totalDistance}
                onExportCSV={handleExportCSV}
                onOpenMaps={handleOpenMaps}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Note: This component now uses useRouteOptimizer instead of useTomorrowCoordinationRecommendations
// The old hook can be kept for reference or removed if not needed elsewhere
