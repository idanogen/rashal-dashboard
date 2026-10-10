import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase, uniqueChannelName } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useCurrentProfile } from '@/hooks/useProfile';
import { fetchStaffMessages, fetchStaffPeople, fetchStaffPrefs, markStaffRead, saveStaffPrefs, sendStaffMessage } from '@/lib/staff-chat-api';
import { EMPTY_PREFS, notificationText, rowToMessage, totalUnread, type StaffListPrefs, type StaffMessageRow, type StaffPerson } from '@/lib/staff-chat';

export const STAFF_MESSAGES_KEY = ['staffMessages'] as const;
export const STAFF_PEOPLE_KEY = ['staffPeople'] as const;

export function useStaffMe() {
  const { user } = useAuth();
  const { data: profile } = useCurrentProfile();
  const name = profile?.fullName?.trim() || profile?.username || user?.email || 'משתמש';
  return { id: user?.id ?? '', name, role: profile?.role };
}

/**
 * ההודעות שלי, חיות. ⭐ זמן אמת על `staff_messages` (RLS מסנן לשלי), ובנוסף
 * רענון בחזרה לחלון וכל דקה, כי ערוץ חי לבד קופא (לקח ר.שעל, 07/09).
 * הודעה חדשה אליי כשהלשונית ברקע = התראת דפדפן, אם המשתמש אישר.
 */
export function useStaffMessages(enabled = true) {
  const qc = useQueryClient();
  const me = useStaffMe();
  const q = useQuery({
    queryKey: STAFF_MESSAGES_KEY,
    queryFn: fetchStaffMessages,
    enabled: enabled && !!me.id,
    staleTime: 20 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!enabled || !me.id) return;
    const ch = supabase
      .channel(uniqueChannelName('staff-messages'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_messages' }, (payload) => {
        void qc.invalidateQueries({ queryKey: STAFF_MESSAGES_KEY });
        if (payload.eventType !== 'INSERT') return;
        const m = rowToMessage(payload.new as StaffMessageRow);
        if (m.recipientId !== me.id) return;
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const t = notificationText(m);
          try { new Notification(t.title, { body: t.body, tag: `staff-${m.senderId}` }); } catch { /* דפדפן בלי תמיכה */ }
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [enabled, me.id, qc]);

  const unread = useMemo(() => totalUnread(q.data ?? [], me.id), [q.data, me.id]);
  return { ...q, unread, me };
}

export function useStaffPeople(enabled = true) {
  return useQuery({ queryKey: STAFF_PEOPLE_KEY, queryFn: fetchStaffPeople, enabled, staleTime: 5 * 60 * 1000 });
}

export function useStaffChatActions() {
  const qc = useQueryClient();
  const me = useStaffMe();
  const send = useMutation({
    mutationFn: ({ to, body }: { to: StaffPerson; body: string }) => sendStaffMessage(me, to, body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: STAFF_MESSAGES_KEY }); },
    onError: (e) => toast.error('ההודעה לא נשלחה', { description: e instanceof Error ? e.message : undefined }),
  });
  const markRead = useMutation({
    mutationFn: (peerId: string) => markStaffRead(peerId),
    onSuccess: (n) => { if (n > 0) void qc.invalidateQueries({ queryKey: STAFF_MESSAGES_KEY }); },
  });
  return { me, send, markRead };
}

// ─── סדר ונעיצה לכל עובד (09/10/2026) ───────────────────────────────────
export const STAFF_PREFS_KEY = ['staffChatPrefs'] as const;

export function useStaffPrefs() {
  const qc = useQueryClient();
  const me = useStaffMe();
  const q = useQuery({
    queryKey: [...STAFF_PREFS_KEY, me.id],
    queryFn: () => fetchStaffPrefs(me.id),
    enabled: !!me.id,
    staleTime: 60 * 1000,
  });
  const save = useMutation({
    mutationFn: (prefs: StaffListPrefs) => saveStaffPrefs(me.id, prefs),
    // ⭐ אופטימי: הגרירה והנעיצה נראות מיד, והשמירה רצה ברקע.
    onMutate: async (prefs) => {
      await qc.cancelQueries({ queryKey: [...STAFF_PREFS_KEY, me.id] });
      const prev = qc.getQueryData<StaffListPrefs>([...STAFF_PREFS_KEY, me.id]);
      qc.setQueryData([...STAFF_PREFS_KEY, me.id], prefs);
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData([...STAFF_PREFS_KEY, me.id], ctx.prev);
      toast.error('הסדר לא נשמר', { description: e instanceof Error ? e.message : undefined });
    },
  });
  return { prefs: q.data ?? EMPTY_PREFS, isLoading: q.isLoading, save };
}
