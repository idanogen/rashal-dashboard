import { supabase } from './supabase';
import { rowToTask, type OfficeTask, type OfficeTaskPriority, type OfficeTaskRow } from './office-tasks';

/** משימות המשרד: כל מה שפתוח, וסגורות מ-60 הימים האחרונים. RLS: צוות המשרד. */
export async function fetchOfficeTasks(): Promise<OfficeTask[]> {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('office_tasks')
    .select('*')
    .or(`status.eq.open,updated_at.gte.${since}`)
    .order('created_at', { ascending: false })
    .range(0, 999);
  if (error) throw new Error(`office_tasks: ${error.message}`);
  return ((data ?? []) as OfficeTaskRow[]).map(rowToTask);
}

export interface NewOfficeTask {
  title: string;
  details?: string | null;
  customerNumber?: string | null;
  customerName?: string | null;
  assigneeId: string;
  assigneeName: string;
  dueDate?: string | null;
  priority: OfficeTaskPriority;
}

export async function createOfficeTask(input: NewOfficeTask, me: { id: string; name: string }): Promise<OfficeTask> {
  const { data, error } = await supabase
    .from('office_tasks')
    .insert({
      title: input.title.trim(),
      details: input.details?.trim() || null,
      customer_number: input.customerNumber || null,
      customer_name: input.customerName?.trim() || null,
      assignee_id: input.assigneeId,
      assignee_name: input.assigneeName,
      created_by: me.id,
      created_by_name: me.name,
      due_date: input.dueDate || null,
      priority: input.priority,
    })
    .select()
    .single();
  if (error) throw new Error(`office_tasks insert: ${error.message}`);
  return rowToTask(data as OfficeTaskRow);
}

export async function updateOfficeTask(id: string, patch: Partial<NewOfficeTask>): Promise<OfficeTask> {
  const row: Record<string, unknown> = {};
  if ('title' in patch && patch.title != null) row.title = patch.title.trim();
  if ('details' in patch) row.details = patch.details?.trim() || null;
  if ('customerNumber' in patch) row.customer_number = patch.customerNumber || null;
  if ('customerName' in patch) row.customer_name = patch.customerName?.trim() || null;
  if ('assigneeId' in patch && patch.assigneeId) row.assignee_id = patch.assigneeId;
  if ('assigneeName' in patch && patch.assigneeName) row.assignee_name = patch.assigneeName;
  if ('dueDate' in patch) row.due_date = patch.dueDate || null;
  if ('priority' in patch && patch.priority) row.priority = patch.priority;
  const { data, error } = await supabase.from('office_tasks').update(row).eq('id', id).select().single();
  if (error) throw new Error(`office_tasks update: ${error.message}`);
  return rowToTask(data as OfficeTaskRow);
}

/** סגירה (בוצע או בוטל) עם מי ומתי, ופתיחה מחדש. */
export async function setOfficeTaskStatus(
  id: string,
  status: 'open' | 'done' | 'cancelled',
  me: { name: string },
  note?: string | null,
): Promise<OfficeTask> {
  const row = status === 'open'
    ? { status, done_at: null, done_by: null, done_note: null }
    : { status, done_at: new Date().toISOString(), done_by: me.name, done_note: note?.trim() || null };
  const { data, error } = await supabase.from('office_tasks').update(row).eq('id', id).select().single();
  if (error) throw new Error(`office_tasks status: ${error.message}`);
  return rowToTask(data as OfficeTaskRow);
}
