import { useQuery } from '@tanstack/react-query';
import { fetchAllDeliveryNotes, fetchAllInvoices, fetchAllConsolidatedInvoices } from '@/lib/documents';

export function useDeliveryNotes() {
  return useQuery({
    queryKey: ['deliveryNotes'],
    queryFn: fetchAllDeliveryNotes,
    staleTime: 60 * 1000,
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: fetchAllInvoices,
    staleTime: 60 * 1000,
  });
}

/** חשבוניות מרכזות — מקור החיוב האמיתי, מה שהכרטיס בדשבורד מציג. */
export function useConsolidatedInvoices() {
  return useQuery({
    queryKey: ['consolidatedInvoices'],
    queryFn: fetchAllConsolidatedInvoices,
    staleTime: 60 * 1000,
  });
}
