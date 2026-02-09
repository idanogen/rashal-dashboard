import { useState } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { useOrderStats } from '@/hooks/useOrderStats';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { OrderFilters, type OrderFiltersState } from '@/components/orders/OrderFilters';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DashboardPage() {
  const { data: orders, isLoading, error, refetch } = useOrders();
  const stats = useOrderStats(orders ?? []);
  const [filters, setFilters] = useState<OrderFiltersState>({
    search: '',
    orderStatus: '',
    worker: '',
    city: '',
  });

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

  return (
    <div className="space-y-6">
      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Filters + Table */}
      <div className="space-y-4">
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
