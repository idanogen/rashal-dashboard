/**
 * GlobalChatContext — lets any component open the chat sheet for a given order
 * without rendering its own button. Adapted from parcel-story.
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { OrderChatSheet } from '@/components/OrderChatSheet';
import type { Order } from '@/types/order';

interface GlobalChatContextValue {
  openChatForOrder: (orderId: string) => void;
}

const GlobalChatContext = createContext<GlobalChatContextValue | null>(null);

export function GlobalChatProvider({ children }: { children: ReactNode }) {
  const { data: orders = [] } = useOrders();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  const openChatForOrder = useCallback(
    (orderId: string) => {
      const order = orders.find((o) => o.id === orderId);
      if (order) setActiveOrder(order);
    },
    [orders]
  );

  const handleOpenChange = (next: boolean) => {
    if (!next) setActiveOrder(null);
  };

  return (
    <GlobalChatContext.Provider value={{ openChatForOrder }}>
      {children}
      {activeOrder && (
        <OrderChatSheet order={activeOrder} open onOpenChange={handleOpenChange} />
      )}
    </GlobalChatContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGlobalChat() {
  const ctx = useContext(GlobalChatContext);
  if (!ctx) throw new Error('useGlobalChat must be used within GlobalChatProvider');
  return ctx;
}
