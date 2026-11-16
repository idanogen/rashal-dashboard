import type { CraneInspection, InspectionStatus } from '@/types/crane';
import { supabase } from './supabase';
import { fieldInspectionDocInput, type FieldInspectionDocRow } from './field-inspection-doc';
import { rowToFieldInspection, type FieldInspection, type FieldInspectionRow } from './field-inspections';

type InspectionRow = {
  id: string;
  crane_id: string;
  inspection_date: string;
  next_due_date: string | null;
  status: InspectionStatus;
  technician: string | null;
  result: string | null;
  defects: string | null;
  certificate_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function rowToInspection(row: InspectionRow): CraneInspection {
  return {
    id: row.id,
    craneId: row.crane_id,
    inspectionDate: row.inspection_date,
    nextDueDate: row.next_due_date ?? undefined,
    status: row.status,
    technician: row.technician ?? undefined,
    result: row.result ?? undefined,
    defects: row.defects ?? undefined,
    certificateNumber: row.certificate_number ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fieldsToRow(
  fields: Partial<Omit<CraneInspection, 'id' | 'createdAt' | 'updatedAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ('craneId' in fields) row.crane_id = fields.craneId;
  if ('inspectionDate' in fields) row.inspection_date = fields.inspectionDate;
  if ('nextDueDate' in fields) row.next_due_date = fields.nextDueDate || null;
  if ('status' in fields) row.status = fields.status;
  if ('technician' in fields) row.technician = fields.technician || null;
  if ('result' in fields) row.result = fields.result || null;
  if ('defects' in fields) row.defects = fields.defects || null;
  if ('certificateNumber' in fields) row.certificate_number = fields.certificateNumber || null;
  if ('notes' in fields) row.notes = fields.notes || null;
  return row;
}

export async function fetchAllInspections(): Promise<CraneInspection[]> {
  const { data, error } = await supabase
    .from('crane_inspections')
    .select('*')
    .order('inspection_date', { ascending: false });
  if (error) throw new Error(`Supabase fetchAllInspections: ${error.message}`);
  return (data as InspectionRow[]).map(rowToInspection);
}

export async function fetchInspectionsByCrane(craneId: string): Promise<CraneInspection[]> {
  const { data, error } = await supabase
    .from('crane_inspections')
    .select('*')
    .eq('crane_id', craneId)
    .order('inspection_date', { ascending: false });
  if (error) throw new Error(`Supabase fetchInspectionsByCrane: ${error.message}`);
  return (data as InspectionRow[]).map(rowToInspection);
}

export async function createInspection(
  fields: Omit<CraneInspection, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CraneInspection> {
  const { data, error } = await supabase
    .from('crane_inspections')
    .insert(fieldsToRow(fields))
    .select()
    .single();
  if (error) throw new Error(`Supabase createInspection: ${error.message}`);
  return rowToInspection(data as InspectionRow);
}

export async function updateInspection(
  id: string,
  fields: Partial<Omit<CraneInspection, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<CraneInspection> {
  const { data, error } = await supabase
    .from('crane_inspections')
    .update(fieldsToRow(fields))
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Supabase updateInspection: ${error.message}`);
  return rowToInspection(data as InspectionRow);
}

export async function deleteInspection(id: string): Promise<void> {
  const { error } = await supabase.from('crane_inspections').delete().eq('id', id);
  if (error) throw new Error(`Supabase deleteInspection: ${error.message}`);
}

/**
 * בדיקות הטכנאים מהשטח (`crane_forms`, מנוף וכיסא ממונע). מעומד בדפים של 1,000
 * כי זו תקרת PostgREST, ומספר שנחתך היה מציג פחות בדיקות ממה שנעשו.
 */
export async function fetchFieldInspections(): Promise<FieldInspection[]> {
  const out: FieldInspection[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('crane_forms')
      .select('id, form_type, crane_serial, customer_name, technician_name, verdict, notes, submitted_at, created_at, stop_id, service_call_id')
      .in('form_type', ['inspection', 'chair_inspection'])
      .order('created_at', { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(`Supabase fetchFieldInspections: ${error.message}`);
    out.push(...(data as FieldInspectionRow[]).map(rowToFieldInspection));
    if ((data ?? []).length < 1000) return out;
  }
}

/**
 * פותח את המסמך החתום של בדיקת טכנאי בלשונית חדשה (16/11/2026). לכיסא יש PDF
 * מהאפליקציה; למנוף אין, ולכן הוא נבנה כאן מהנתונים השמורים באותה תבנית.
 * ⭐ הלשונית נפתחת לפני ההמתנה, אחרת חוסם החלונות של הדפדפן עוצר אותה.
 */
export async function openFieldInspectionDoc(formId: string): Promise<void> {
  const win = window.open('', '_blank');
  try {
    win?.document.write('<p dir="rtl" style="font-family:sans-serif;padding:24px">טוען את הטופס החתום…</p>');
    const url = await fieldInspectionDocUrl(formId);
    if (win) win.location.href = url;
    else window.open(url, '_blank');
  } catch (e) {
    win?.close();
    throw e;
  }
}

async function fieldInspectionDocUrl(formId: string): Promise<string> {
  const { data: row, error } = await supabase
    .from('crane_forms')
    .select('form_type, checklist_version, crane_serial, customer_name, customer_number, answers, verdict, notes, '
      + 'technician_name, recipient_name, recipient_signature, submitted_at, created_at, pdf_path, service_call_id')
    .eq('id', formId)
    .single();
  if (error) throw new Error(`הטופס לא נטען: ${error.message}`);
  const r = row as unknown as FieldInspectionDocRow & { pdf_path: string | null; service_call_id: string | null };
  if (r.pdf_path) {
    const { data, error: urlErr } = await supabase.storage.from('signed-forms').createSignedUrl(r.pdf_path, 600);
    if (urlErr || !data?.signedUrl) throw new Error(urlErr?.message ?? 'לא ניתן לפתוח את הקובץ');
    return data.signedUrl;
  }
  const [call, crane] = await Promise.all([
    r.service_call_id
      ? supabase.from('service_calls').select('priority_call_id').eq('id', r.service_call_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    r.crane_serial
      ? supabase.from('cranes').select('model').eq('device_number', r.crane_serial).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const { checklistLayout } = await import('./forms/layouts/checklist');
  const { renderHtmlToPdf } = await import('./forms/render');
  const html = checklistLayout(fieldInspectionDocInput(r, {
    docNumber: (call.data as { priority_call_id?: string | null } | null)?.priority_call_id ?? null,
    deviceModel: (crane.data as { model?: string | null } | null)?.model ?? null,
  }));
  return URL.createObjectURL(await renderHtmlToPdf(html));
}
