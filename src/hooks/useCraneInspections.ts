import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createInspection,
  deleteInspection,
  fetchAllInspections,
  fetchInspectionsByCrane,
  updateInspection,
} from '@/lib/crane-inspections';
import type { CraneInspection } from '@/types/crane';

export function useCraneInspections() {
  return useQuery({
    queryKey: ['craneInspections'],
    queryFn: fetchAllInspections,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useInspectionsByCrane(craneId: string | null) {
  return useQuery({
    queryKey: ['craneInspections', 'byCrane', craneId],
    queryFn: () => (craneId ? fetchInspectionsByCrane(craneId) : Promise.resolve([])),
    enabled: !!craneId,
    staleTime: 30 * 1000,
  });
}

export function useCreateInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fields: Omit<CraneInspection, 'id' | 'createdAt' | 'updatedAt'>) =>
      createInspection(fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['craneInspections'] });
      toast.success('הבדיקה נוצרה');
    },
    onError: (e: Error) => toast.error(`שגיאה ביצירת בדיקה: ${e.message}`),
  });
}

export function useUpdateInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; fields: Partial<Omit<CraneInspection, 'id' | 'createdAt' | 'updatedAt'>> }) =>
      updateInspection(input.id, input.fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['craneInspections'] });
      toast.success('הבדיקה עודכנה');
    },
    onError: (e: Error) => toast.error(`שגיאה בעדכון בדיקה: ${e.message}`),
  });
}

export function useDeleteInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInspection(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['craneInspections'] });
      toast.success('הבדיקה נמחקה');
    },
    onError: (e: Error) => toast.error(`שגיאה במחיקת בדיקה: ${e.message}`),
  });
}
