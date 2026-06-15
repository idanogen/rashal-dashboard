import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { supabase, uniqueChannelName } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  callAdminApi,
  fetchAllProfiles,
  fetchProfile,
  updateOwnProfile,
  type AdminAction,
  type AdminResponse,
} from '@/lib/profiles';

export function useCurrentProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => (user?.id ? fetchProfile(user.id) : Promise.resolve(null)),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });
}

export function useIsAdmin(): boolean {
  const { data: profile } = useCurrentProfile();
  return profile?.role === 'admin' && !profile.disabled;
}

export function useAllProfiles() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(uniqueChannelName('profiles-realtime'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => qc.invalidateQueries({ queryKey: ['profiles'] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // Depend on the stable user id, not the `user` object — auth-context hands
    // back a fresh `session.user` reference on every token refresh / tab focus,
    // which would otherwise resubscribe the channel and churn the realtime
    // socket ("WebSocket is closed before the connection is established").
  }, [qc, userId]);

  return useQuery({
    queryKey: ['profiles'],
    queryFn: fetchAllProfiles,
    enabled: !!user,
    staleTime: 30 * 1000,
  });
}

export function useUpdateOwnProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (fields: { fullName?: string }) => {
      if (!user?.id) throw new Error('לא מחובר');
      return updateOwnProfile(user.id, fields);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      toast.success('פרופיל עודכן');
    },
    onError: (err: Error) => toast.error(`שגיאה: ${err.message}`),
  });
}

/**
 * Generic admin mutation — returns the AdminResponse so the caller can show
 * the temp password (for invite/create/reset_password).
 */
export function useAdminMutation() {
  const qc = useQueryClient();
  return useMutation<AdminResponse, Error, AdminAction>({
    mutationFn: callAdminApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] });
    },
    // Don't fire a default toast — actions need different copy
    onError: (err) => toast.error(`שגיאה: ${err.message}`),
  });
}
