import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { supabase, uniqueChannelName } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  fetchInbound,
  fetchOutbound,
  fetchOutboundForOrder,
  markInboundProcessed,
  simulateInbound,
} from '@/lib/heyy/db';

export function useInboundMessages() {
  const qc = useQueryClient();
  const { loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const channel = supabase
      .channel(uniqueChannelName('whatsapp-inbound-realtime'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_inbound' },
        () => {
          qc.invalidateQueries({ queryKey: ['whatsappInbound'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, loading]);

  return useQuery({
    queryKey: ['whatsappInbound'],
    queryFn: () => fetchInbound(200),
    staleTime: 30 * 1000,
  });
}

export function useOutboundMessages() {
  const qc = useQueryClient();
  const { loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const channel = supabase
      .channel(uniqueChannelName('whatsapp-outbound-realtime'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_outbound' },
        () => {
          qc.invalidateQueries({ queryKey: ['whatsappOutbound'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, loading]);

  return useQuery({
    queryKey: ['whatsappOutbound'],
    queryFn: () => fetchOutbound(200),
    staleTime: 30 * 1000,
  });
}

export function useOutboundForOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ['whatsappOutbound', 'order', orderId],
    queryFn: () => (orderId ? fetchOutboundForOrder(orderId) : Promise.resolve([])),
    enabled: !!orderId,
    staleTime: 30 * 1000,
  });
}

export function useMarkInboundProcessed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => markInboundProcessed(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsappInbound'] });
      toast.success('סומן כטופל');
    },
    onError: (err: Error) => {
      toast.error(`שגיאה: ${err.message}`);
    },
  });
}

export function useSimulateInbound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: simulateInbound,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsappInbound'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('תשובת לקוח דמה נוספה');
    },
    onError: (err: Error) => {
      toast.error(`שגיאה: ${err.message}`);
    },
  });
}
