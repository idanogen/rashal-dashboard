import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, uniqueChannelName } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

// A sync run touches many rows at once, so postgres_changes arrives as a burst.
// Invalidating per event refetched whole tables repeatedly; coalesce the burst
// into one invalidation per query key.
const COALESCE_MS = 1500;

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const { loading } = useAuth();

  useEffect(() => {
    // Wait until the auth session has resolved before opening the socket.
    // Subscribing earlier connects with the anon apikey, then supabase-js swaps
    // in the user JWT once the session loads and reconnects — closing the
    // still-connecting socket ("WebSocket is closed before the connection is
    // established"). Gating on `loading` lets the socket connect once, already
    // authenticated.
    if (loading) return;

    const pendingKeys = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleInvalidate = (key: string) => {
      pendingKeys.add(key);
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        const keys = [...pendingKeys];
        pendingKeys.clear();
        for (const k of keys) queryClient.invalidateQueries({ queryKey: [k] });
      }, COALESCE_MS);
    };

    const channel = supabase
      .channel(uniqueChannelName('db-changes'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => scheduleInvalidate('orders')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'routes' },
        () => scheduleInvalidate('routes')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_calls' },
        () => scheduleInvalidate('serviceCalls')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_stops' },
        () => scheduleInvalidate('calendarStops')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pickups' },
        () => scheduleInvalidate('pickups')
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient, loading]);
}
