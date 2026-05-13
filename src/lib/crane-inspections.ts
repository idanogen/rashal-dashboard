import type { CraneInspection, InspectionStatus } from '@/types/crane';
import { supabase } from './supabase';

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
