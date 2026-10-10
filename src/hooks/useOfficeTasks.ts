import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useCurrentProfile } from '@/hooks/useProfile';
import { createOfficeTask, fetchOfficeTasks, setOfficeTaskStatus, updateOfficeTask, type NewOfficeTask } from '@/lib/office-tasks-api';

export const OFFICE_TASKS_KEY = ['officeTasks'] as const;

/**
 * משימות המשרד. ⭐ מסך משותף: מתרענן בחזרה לחלון וכל דקה, כי מנהל פותח
 * משימה במחשב אחד והעובד רואה אותה במחשב אחר. [[shared_screen_must_refresh_itself]]
 */
export function useOfficeTasks(enabled = true) {
  return useQuery({
    queryKey: OFFICE_TASKS_KEY,
    queryFn: fetchOfficeTasks,
    enabled,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

function useMe() {
  const { user } = useAuth();
  const { data: profile } = useCurrentProfile();
  const name = profile?.fullName?.trim() || profile?.username || user?.email || 'משתמש';
  return { id: user?.id ?? '', name, role: profile?.role };
}

export function useOfficeTaskMutations() {
  const qc = useQueryClient();
  const me = useMe();
  const refresh = () => qc.invalidateQueries({ queryKey: OFFICE_TASKS_KEY });

  const create = useMutation({
    mutationFn: (input: NewOfficeTask) => createOfficeTask(input, me),
    onSuccess: (t) => { void refresh(); toast.success(`המשימה נפתחה ל${t.assigneeName}`); },
    onError: (e) => toast.error('פתיחת המשימה נכשלה', { description: e instanceof Error ? e.message : undefined }),
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<NewOfficeTask> }) => updateOfficeTask(id, patch),
    onSuccess: () => { void refresh(); toast.success('המשימה עודכנה'); },
    onError: (e) => toast.error('העדכון נכשל', { description: e instanceof Error ? e.message : undefined }),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: 'open' | 'done' | 'cancelled'; note?: string | null }) =>
      setOfficeTaskStatus(id, status, me, note),
    onSuccess: (t) => {
      void refresh();
      toast.success(t.status === 'done' ? 'סומן כבוצע' : t.status === 'cancelled' ? 'המשימה בוטלה' : 'המשימה נפתחה מחדש');
    },
    onError: (e) => toast.error('השינוי נכשל', { description: e instanceof Error ? e.message : undefined }),
  });
  return { me, create, update, setStatus };
}
