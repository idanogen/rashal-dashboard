import { supabase } from './supabase';
import type { Assignee, AssigneeColor, AssigneeKind } from '@/types/assignee';

/** קריאה וכתיבה לטבלת הצוות. הכתיבה נאכפת ב-RLS (`can_manage_team`). */

interface Row {
  name: string;
  kind: AssigneeKind;
  phone: string | null;
  color: AssigneeColor;
  active: boolean;
  sort_order: number;
}

const toAssignee = (r: Row): Assignee => ({
  name: r.name,
  kind: r.kind,
  phone: r.phone ?? undefined,
  color: r.color,
  active: r.active,
  sortOrder: r.sort_order,
});

export async function fetchAssignees(): Promise<Assignee[]> {
  const { data, error } = await supabase
    .from('assignees')
    .select('name, kind, phone, color, active, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(toAssignee);
}

export async function createAssignee(input: {
  name: string;
  kind: AssigneeKind;
  phone?: string;
  color: AssigneeColor;
}): Promise<Assignee> {
  const name = input.name.trim();
  const { data, error } = await supabase
    .from('assignees')
    .insert({
      name,
      kind: input.kind,
      phone: input.phone?.trim() || null,
      color: input.color,
      // חדשים בסוף הרשימה, כדי שסדר היומן הקיים לא יזוז מתחת לידיים של הסדרן.
      sort_order: 100,
    })
    .select('name, kind, phone, color, active, sort_order')
    .single();
  if (error) throw error;
  return toAssignee(data as Row);
}

export async function updateAssignee(
  name: string,
  fields: Partial<{ kind: AssigneeKind; phone: string | null; color: AssigneeColor; active: boolean }>,
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('kind' in fields) patch.kind = fields.kind;
  if ('phone' in fields) patch.phone = fields.phone?.trim() || null;
  if ('color' in fields) patch.color = fields.color;
  if ('active' in fields) patch.active = fields.active;

  const { error } = await supabase.from('assignees').update(patch).eq('name', name);
  if (error) throw error;
}

/**
 * 🔴 **אין מחיקה, וזה מכוון.** השם הוא המפתח שכל העצירות ההיסטוריות
 * מחזיקות, ומחיקה הייתה הופכת חודשים של יומן לשורות בלי בעלים. עובד
 * שעזב מסומן לא פעיל: הוא יורד מכל בוררי השיבוץ, וההיסטוריה נשארת.
 */
export async function deactivateAssignee(name: string): Promise<void> {
  return updateAssignee(name, { active: false });
}
