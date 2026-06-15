import type { TimelineEvent, TimelineEventType } from '@/types/timeline';
import { supabase } from './supabase';

// Per-source chat / timeline. A row is linked to an order OR a service call.

/** What a chat/timeline is attached to. */
export type ChatSourceKind = 'order' | 'service';
export interface ChatSourceRef {
  kind: ChatSourceKind;
  id: string;
}

type TimelineEventRow = {
  id: string;
  order_id: string | null;
  service_call_id: string | null;
  type: string;
  user_id: string | null;
  user_name: string | null;
  content: string | null;
  files: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function rowToEvent(row: TimelineEventRow): TimelineEvent {
  return {
    id: row.id,
    orderId: row.order_id ?? undefined,
    serviceCallId: row.service_call_id ?? undefined,
    type: row.type as TimelineEventType,
    userId: row.user_id ?? 'current-user',
    userName: row.user_name ?? 'משתמש',
    content: row.content ?? undefined,
    files: row.files ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
  };
}

/** Column on timeline_events for a given source kind. */
function sourceColumn(kind: ChatSourceKind): 'order_id' | 'service_call_id' {
  return kind === 'order' ? 'order_id' : 'service_call_id';
}

export interface PersistTimelineEventInput {
  id: string;
  source: ChatSourceRef;
  type: TimelineEventType;
  userId?: string;
  userName?: string;
  content?: string;
  files?: string[];
  metadata?: Record<string, unknown>;
}

export async function persistTimelineEvent(event: PersistTimelineEventInput): Promise<void> {
  const { error } = await supabase.from('timeline_events').insert({
    id: event.id,
    order_id: event.source.kind === 'order' ? event.source.id : null,
    service_call_id: event.source.kind === 'service' ? event.source.id : null,
    type: event.type,
    user_id: event.userId ?? 'current-user',
    user_name: event.userName ?? 'משתמש נוכחי',
    content: event.content ?? null,
    files: event.files ?? null,
    metadata: event.metadata ?? null,
  });
  if (error) throw new Error(`persistTimelineEvent: ${error.message}`);
}

export async function getTimelineEvents(source: ChatSourceRef): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from('timeline_events')
    .select('*')
    .eq(sourceColumn(source.kind), source.id)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`getTimelineEvents: ${error.message}`);
  return ((data as TimelineEventRow[] | null) ?? []).map(rowToEvent);
}

/**
 * Uploads files to the `timeline-files` bucket under `{sourceId}/...`.
 * Returns original file names and public URLs (URLs only for images).
 */
export async function uploadTimelineFiles(
  sourceId: string,
  files: File[]
): Promise<{ fileNames: string[]; imageUrls: string[] }> {
  const fileNames: string[] = [];
  const imageUrls: string[] = [];

  for (const file of files) {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${sourceId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage.from('timeline-files').upload(path, file);
    if (error) {
      console.error('[uploadTimelineFiles] failed for', file.name, error.message);
      continue;
    }

    const { data: urlData } = supabase.storage.from('timeline-files').getPublicUrl(path);
    fileNames.push(file.name);
    if (file.type.startsWith('image/')) {
      imageUrls.push(urlData.publicUrl);
    }
  }

  return { fileNames, imageUrls };
}

/**
 * Comment counts per source id (order OR service call) — for the chat-button badge.
 * Keys are source uuids (no collision across the two columns). Paginated.
 */
export async function getCommentCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const PAGE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('timeline_events')
      .select('order_id, service_call_id')
      .eq('type', 'comment')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`getCommentCounts: ${error.message}`);
    const rows = (data as { order_id: string | null; service_call_id: string | null }[] | null) ?? [];
    for (const row of rows) {
      const key = row.order_id ?? row.service_call_id;
      if (key) counts[key] = (counts[key] || 0) + 1;
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return counts;
}
