import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase, uniqueChannelName } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  fetchThreads,
  fetchMessages,
  createThread,
  addMessage,
  setThreadStatus,
  deleteThread,
} from '@/lib/feedback';
import type { FeedbackStatus } from '@/types/feedback';

/** Live subscription on both feedback tables → refresh threads + open conversation. */
function useFeedbackRealtime() {
  const qc = useQueryClient();
  const { loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    const channel = supabase
      .channel(uniqueChannelName('feedback-realtime'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_threads' }, () => {
        qc.invalidateQueries({ queryKey: ['feedbackThreads'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_messages' }, () => {
        qc.invalidateQueries({ queryKey: ['feedbackThreads'] });
        qc.invalidateQueries({ queryKey: ['feedbackMessages'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, loading]);
}

export function useFeedbackThreads() {
  useFeedbackRealtime();
  return useQuery({
    queryKey: ['feedbackThreads'],
    queryFn: fetchThreads,
    staleTime: 15 * 1000,
  });
}

export function useThreadMessages(threadId: string | undefined) {
  return useQuery({
    queryKey: ['feedbackMessages', threadId],
    queryFn: () => (threadId ? fetchMessages(threadId) : Promise.resolve([])),
    enabled: !!threadId,
    staleTime: 10 * 1000,
  });
}

export function useCreateThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createThread,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedbackThreads'] });
      toast.success('ההערה נוספה');
    },
    onError: (e: Error) => toast.error(`שגיאה: ${e.message}`),
  });
}

export function useAddMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addMessage,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['feedbackMessages', vars.threadId] });
      qc.invalidateQueries({ queryKey: ['feedbackThreads'] });
    },
    onError: (e: Error) => toast.error(`שגיאה: ${e.message}`),
  });
}

export function useSetThreadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: FeedbackStatus }) => setThreadStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedbackThreads'] });
      toast.success('הסטטוס עודכן');
    },
    onError: (e: Error) => toast.error(`שגיאה: ${e.message}`),
  });
}

export function useDeleteThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteThread,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedbackThreads'] });
      toast.success('ההערה נמחקה');
    },
    onError: (e: Error) => toast.error(`שגיאה: ${e.message}`),
  });
}
