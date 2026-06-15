import { supabase } from '@/lib/supabase';
import type { FeedbackThread, FeedbackMessage, FeedbackStatus } from '@/types/feedback';

const BUCKET = 'feedback-attachments';

interface ProfileLite {
  id: string;
  name: string;
  isAdmin: boolean;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('לא מחובר');
  return id;
}

/** id → display name + admin flag, for resolving authors. */
async function fetchProfileMap(): Promise<Map<string, ProfileLite>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, role, disabled');
  if (error) throw error;
  const map = new Map<string, ProfileLite>();
  for (const p of data ?? []) {
    map.set(p.id, {
      id: p.id,
      name: p.full_name ?? p.username ?? 'משתמש',
      isAdmin: p.role === 'admin' && !p.disabled,
    });
  }
  return map;
}

export async function fetchThreads(): Promise<FeedbackThread[]> {
  const [{ data: threads, error: tErr }, { data: msgs, error: mErr }, profiles] = await Promise.all([
    supabase.from('feedback_threads').select('*').order('updated_at', { ascending: false }),
    supabase
      .from('feedback_messages')
      .select('thread_id, body, image_path, created_at')
      .order('created_at', { ascending: true }),
    fetchProfileMap(),
  ]);
  if (tErr) throw tErr;
  if (mErr) throw mErr;

  const byThread = new Map<string, { count: number; lastBody?: string; lastImage?: boolean; lastAt?: string }>();
  for (const m of msgs ?? []) {
    const agg = byThread.get(m.thread_id) ?? { count: 0 };
    agg.count += 1;
    agg.lastBody = m.body ?? agg.lastBody;
    agg.lastImage = !!m.image_path;
    agg.lastAt = m.created_at;
    byThread.set(m.thread_id, agg);
  }

  return (threads ?? []).map((t) => {
    const agg = byThread.get(t.id);
    const preview = agg?.lastBody?.trim()
      ? agg.lastBody.trim()
      : agg?.lastImage
        ? '📷 תמונה'
        : undefined;
    return {
      id: t.id,
      createdBy: t.created_by,
      subject: t.subject ?? undefined,
      status: t.status as FeedbackStatus,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      authorName: profiles.get(t.created_by)?.name ?? 'משתמש',
      messageCount: agg?.count ?? 0,
      lastMessagePreview: preview,
      lastMessageAt: agg?.lastAt,
    };
  });
}

export async function fetchMessages(threadId: string): Promise<FeedbackMessage[]> {
  const [{ data, error }, profiles] = await Promise.all([
    supabase
      .from('feedback_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true }),
    fetchProfileMap(),
  ]);
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    threadId: m.thread_id,
    authorId: m.author_id,
    body: m.body ?? undefined,
    imagePath: m.image_path ?? undefined,
    createdAt: m.created_at,
    authorName: profiles.get(m.author_id)?.name ?? 'משתמש',
    authorIsAdmin: profiles.get(m.author_id)?.isAdmin ?? false,
  }));
}

/** Upload a screenshot and return its storage path. */
export async function uploadAttachment(file: File): Promise<string> {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/png',
  });
  if (error) throw error;
  return path;
}

/** Resolve a storage path to a temporary signed URL for display. */
export async function signedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function createThread(input: {
  subject?: string;
  body?: string;
  imagePath?: string;
}): Promise<string> {
  const uid = await currentUserId();
  const { data: thread, error } = await supabase
    .from('feedback_threads')
    .insert({ created_by: uid, subject: input.subject?.trim() || null })
    .select('id')
    .single();
  if (error) throw error;
  const { error: mErr } = await supabase.from('feedback_messages').insert({
    thread_id: thread.id,
    author_id: uid,
    body: input.body?.trim() || null,
    image_path: input.imagePath ?? null,
  });
  if (mErr) throw mErr;
  return thread.id;
}

export async function addMessage(input: {
  threadId: string;
  body?: string;
  imagePath?: string;
}): Promise<void> {
  const uid = await currentUserId();
  const { error } = await supabase.from('feedback_messages').insert({
    thread_id: input.threadId,
    author_id: uid,
    body: input.body?.trim() || null,
    image_path: input.imagePath ?? null,
  });
  if (error) throw error;
}

export async function setThreadStatus(id: string, status: FeedbackStatus): Promise<void> {
  const { error } = await supabase.from('feedback_threads').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteThread(id: string): Promise<void> {
  const { error } = await supabase.from('feedback_threads').delete().eq('id', id);
  if (error) throw error;
}
