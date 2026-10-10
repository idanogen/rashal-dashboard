import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addCustomerContact, fetchPhoneBook } from '@/lib/customer-contacts';

export const phoneBookKey = (customerNumber: string | null | undefined) => ['customerPhoneBook', customerNumber ?? ''];

export function useCustomerPhoneBook(customerNumber: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: phoneBookKey(customerNumber),
    queryFn: () => fetchPhoneBook(customerNumber!),
    enabled: enabled && !!customerNumber,
    staleTime: 60 * 1000,
  });
}

export function useAddCustomerContact(customerNumber: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phone, label }: { phone: string; label: string | null }) =>
      addCustomerContact(customerNumber!, phone, label),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: phoneBookKey(customerNumber) });
      // כרטיס הלקוח וה-inbox מציגים את אותו קישור.
      void qc.invalidateQueries({ queryKey: ['customer-card'] });
    },
  });
}
