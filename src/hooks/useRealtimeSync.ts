import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
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
  }, [queryClient]);
}
