import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useCurrentProfile } from '@/hooks/useProfile';
import {
  applyPartsAction,
  decideFollowup,
  fetchCallFollowups,
  fetchFollowupDesks,
  type DecisionInput,
  type PartsAction,
} from '@/lib/call-followups-api';
import { DESK_LABEL, KIND_TAG, isBuy, type FollowupDesk } from '@/lib/call-followups';

export const CALL_FOLLOWUPS_KEY = ['callFollowups'] as const;

/**
 * הכרעות ורכש לקריאות שחזרו. ⭐ מסך משותף: עמי מכריע במחשב אחד ואלכס רואה
 * במחשב אחר, לכן רענון בחזרה לחלון וכל דקה. [[shared_screen_must_refresh_itself]]
 */
export function useCallFollowups(enabled = true) {
  return useQuery({
    queryKey: CALL_FOLLOWUPS_KEY,
    queryFn: fetchCallFollowups,
    enabled,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useFollowupDesks(enabled = true) {
  return useQuery({ queryKey: ['callFollowupDesks'], queryFn: fetchFollowupDesks, enabled, staleTime: 10 * 60 * 1000 });
}

function useMe() {
  const { user } = useAuth();
  const { data: profile } = useCurrentProfile();
  const name = profile?.fullName?.trim() || profile?.username || user?.email || 'משתמש';
  return { id: user?.id ?? '', name, role: profile?.role };
}

/** השולחנות של המשתמש הנוכחי (מחסן / בית מלאכה), לפי call_followup_desks. */
export function useMyDesks(enabled = true): FollowupDesk[] {
  const { user } = useAuth();
  const { data } = useFollowupDesks(enabled);
  return useMemo(
    () => (data ?? []).filter((d) => d.profileId && d.profileId === user?.id).map((d) => d.desk),
    [data, user?.id],
  );
}

export function useCallFollowupMutations() {
  const qc = useQueryClient();
  const me = useMe();
  const refresh = () => qc.invalidateQueries({ queryKey: CALL_FOLLOWUPS_KEY });

  const decide = useMutation({
    mutationFn: (input: DecisionInput) => decideFollowup(input, me),
    onSuccess: (f) => {
      void refresh();
      toast.success(isBuy(f.kind) ? `נשלח לרכש ${DESK_LABEL[f.kind === 'buy_warehouse' ? 'warehouse' : 'workshop']}` : `סומן: ${KIND_TAG[f.kind]}`);
    },
    onError: (e) => toast.error('השמירה נכשלה', { description: e instanceof Error ? e.message : undefined }),
  });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: PartsAction }) => applyPartsAction(id, action, me),
    onSuccess: (f) => {
      void refresh();
      const msg = f.status === 'arrived' ? 'סומן הגיע, הקריאה חזרה למשרד לשיבוץ'
        : f.status === 'unavailable' ? 'הוחזר למשרד עם ההערה'
        : f.status === 'ordered' ? 'סומן הוזמן' : 'עודכן';
      toast.success(msg);
    },
    onError: (e) => toast.error('העדכון נכשל', { description: e instanceof Error ? e.message : undefined }),
  });

  return { me, decide, act };
}
