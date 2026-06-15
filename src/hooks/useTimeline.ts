import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useCurrentProfile } from '@/hooks/useProfile';
import {
  getCommentCounts,
  getTimelineEvents,
  persistTimelineEvent,
  uploadTimelineFiles,
  type ChatSourceRef,
} from '@/lib/timeline';
import type { TimelineEvent } from '@/types/timeline';

/** Timeline events for one source (order/service). Fetches only while `enabled`. */
export function useTimeline(source: ChatSourceRef | undefined, enabled = true) {
  return useQuery({
    queryKey: ['timeline', source?.id],
    queryFn: () => getTimelineEvents(source as ChatSourceRef),
    enabled: !!source?.id && enabled,
    staleTime: 15 * 1000,
  });
}

/** Comment counts keyed by source id (order or service call). */
export function useCommentCounts() {
  return useQuery({
    queryKey: ['commentCounts'],
    queryFn: getCommentCounts,
    staleTime: 60 * 1000,
  });
}

/** Current user's identity for stamping comments / system events. */
export function useChatAuthor() {
  const { user } = useAuth();
  const { data: profile } = useCurrentProfile();
  const userId = user?.id ?? 'current-user';
  const userName = profile?.fullName || profile?.username || user?.email || 'משתמש';
  return { userId, userName };
}

/** Add a comment with optimistic insert into the cached timeline. */
export function useAddComment(source: ChatSourceRef) {
  const qc = useQueryClient();
  const { userId, userName } = useChatAuthor();

  return useMutation({
    mutationFn: async ({ content, mentions }: { content: string; mentions: string[] }) => {
      const event: TimelineEvent = {
        id: `event-${Date.now()}`,
        orderId: source.kind === 'order' ? source.id : undefined,
        serviceCallId: source.kind === 'service' ? source.id : undefined,
        type: 'comment',
        userId,
        userName,
        content,
        metadata: mentions.length > 0 ? { mentions } : undefined,
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData<TimelineEvent[]>(['timeline', source.id], (old = []) => [...old, event]);
      await persistTimelineEvent({
        id: event.id,
        source,
        type: 'comment',
        userId,
        userName,
        content,
        metadata: event.metadata,
      });
      return event;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['timeline', source.id] });
      qc.invalidateQueries({ queryKey: ['commentCounts'] });
    },
    onError: (err) => {
      console.error('[useAddComment]', err);
      toast.error('שגיאה בשליחת ההודעה');
    },
  });
}

/** Upload files with optimistic blob previews, then swap to permanent URLs. */
export function useUploadFiles(source: ChatSourceRef) {
  const qc = useQueryClient();
  const { userId, userName } = useChatAuthor();

  return useMutation({
    mutationFn: async ({ files }: { files: File[] }) => {
      const id = `event-${Date.now()}`;
      const localImageUrls = files
        .filter((f) => f.type.startsWith('image/'))
        .map((f) => URL.createObjectURL(f));

      const optimistic: TimelineEvent = {
        id,
        orderId: source.kind === 'order' ? source.id : undefined,
        serviceCallId: source.kind === 'service' ? source.id : undefined,
        type: 'file_upload',
        userId,
        userName,
        content: `הועלו ${files.length} קבצים`,
        files: files.map((f) => f.name),
        metadata: localImageUrls.length > 0 ? { imageUrls: localImageUrls } : undefined,
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData<TimelineEvent[]>(['timeline', source.id], (old = []) => [...old, optimistic]);

      try {
        const { fileNames, imageUrls } = await uploadTimelineFiles(source.id, files);
        await persistTimelineEvent({
          id,
          source,
          type: 'file_upload',
          userId,
          userName,
          content: `הועלו ${files.length} קבצים`,
          files: fileNames,
          metadata: imageUrls.length > 0 ? { imageUrls } : undefined,
        });
        localImageUrls.forEach((url) => URL.revokeObjectURL(url));
      } catch (err) {
        localImageUrls.forEach((url) => URL.revokeObjectURL(url));
        throw err;
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['timeline', source.id] });
      qc.invalidateQueries({ queryKey: ['commentCounts'] });
    },
    onError: (err) => {
      console.error('[useUploadFiles]', err);
      toast.error('שגיאה בהעלאת הקבצים');
    },
  });
}
