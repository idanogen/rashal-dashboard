import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useOrders } from '@/hooks/useOrders';
import { useOrderStats } from '@/hooks/useOrderStats';
import { StaleOrdersAlert } from '@/components/dashboard/StaleOrdersAlert';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { DailyOrdersChart } from '@/components/dashboard/DailyOrdersChart';
import { HealthFundChart } from '@/components/dashboard/HealthFundChart';
import { OrderFilters, type OrderFiltersState } from '@/components/orders/OrderFilters';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { Loader2, AlertCircle, Truck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function DashboardPage() {
  const { data: orders, isLoading, error, refetch } = useOrders();
  const stats = useOrderStats(orders ?? []);
  const [filters, setFilters] = useState<OrderFiltersState>({
    search: '',
    orderStatus: '',
    worker: '',
    city: '',
  });
  const tableRef = useRef<HTMLDivElement>(null);

  const handleShowStale = () => {
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">טוען הזמנות...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">שגיאה בטעינת הנתונים</p>
        <p className="max-w-md text-center text-xs text-muted-foreground">
          {error instanceof Error ? error.message : 'שגיאה לא ידועה'}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          נסה שוב
        </Button>
      </div>
    );
  }

  const waitingCount = (orders ?? []).filter(
    (o) => o.orderStatus === 'ממתין לתאום'
  ).length;

  return (
    <div className="space-y-6">
      {/* Stale Orders Alert */}
      <StaleOrdersAlert orders={orders ?? []} onShowStale={handleShowStale} />

      {/* Delivery Summary Card */}
      {waitingCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Truck className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold">
                  {waitingCount} הזמנות ממתינות לתיאום משלוח
                </p>
                <p className="text-sm text-muted-foreground">
                  עבור לדף משלוחים כדי לסנן לפי אזור ולבנות מסלול
                </p>
              </div>
            </div>
            <Link to="/routes">
              <Button variant="default" className="gap-2">
                למשלוחים
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DailyOrdersChart orders={orders ?? []} />
        <HealthFundChart orders={orders ?? []} />
      </div>

      {/* Filters + Table */}
      <div ref={tableRef} className="space-y-4">
        <OrderFilters
          filters={filters}
          onChange={setFilters}
          cities={stats.uniqueCities}
        />
        <OrdersTable orders={orders ?? []} filters={filters} />
      </div>
    </div>
  );
}
