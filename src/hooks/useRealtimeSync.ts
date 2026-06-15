import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, uniqueChannelName } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

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
    const channel = supabase
      .channel(uniqueChannelName('db-changes'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => queryClient.invalidateQueries({ queryKey: ['orders'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'routes' },
        () => queryClient.invalidateQueries({ queryKey: ['routes'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_calls' },
        () => queryClient.invalidateQueries({ queryKey: ['serviceCalls'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_stops' },
        () => queryClient.invalidateQueries({ queryKey: ['calendarStops'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, loading]);
}
