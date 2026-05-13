import type { Crane, CraneStatus } from '@/types/crane';
import { supabase } from './supabase';

type CraneRow = {
  id: string;
  device_number: string;
  model: string;
  customer_id_number: string | null;
  customer_name: string | null;
  customer_type: string | null;
  customer_type_code: string | null;
  phone: string | null;
  sticker_number: string | null;
  install_date: string | null;
  opened_date: string | null;
  warranty_start: string | null;
  warranty_end: string | null;
  cancelled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function rowToCrane(row: CraneRow): Crane {
  return {
    id: row.id,
    deviceNumber: row.device_number,
    model: row.model,
    customerIdNumber: row.customer_id_number ?? undefined,
    customerName: row.customer_name ?? undefined,
    customerType: row.customer_type ?? undefined,
    customerTypeCode: row.customer_type_code ?? undefined,
    phone: row.phone ?? undefined,
    stickerNumber: row.sticker_number ?? undefined,
    installDate: row.install_date ?? undefined,
    openedDate: row.opened_date ?? undefined,
    warrantyStart: row.warranty_start ?? undefined,
    warrantyEnd: row.warranty_end ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchAllCranes(): Promise<Crane[]> {
  const PAGE = 1000;
  const all: Crane[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('cranes')
      .select('*')
      .order('device_number', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Supabase fetchAllCranes: ${error.message}`);
    const rows = (data as CraneRow[]) ?? [];
    all.push(...rows.map(rowToCrane));
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function updateCrane(
  id: string,
  fields: Partial<Omit<Crane, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Crane> {
  const row: Record<string, unknown> = {};
  if ('deviceNumber' in fields) row.device_number = fields.deviceNumber;
  if ('model' in fields) row.model = fields.model;
  if ('customerIdNumber' in fields) row.customer_id_number = fields.customerIdNumber;
  if ('customerName' in fields) row.customer_name = fields.customerName;
  if ('customerType' in fields) row.customer_type = fields.customerType;
  if ('phone' in fields) row.phone = fields.phone;
  if ('stickerNumber' in fields) row.sticker_number = fields.stickerNumber;
  if ('installDate' in fields) row.install_date = fields.installDate || null;
  if ('cancelledAt' in fields) row.cancelled_at = fields.cancelledAt || null;
  if ('notes' in fields) row.notes = fields.notes;

  const { data, error } = await supabase
    .from('cranes')
    .update(row)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Supabase updateCrane: ${error.message}`);
  return rowToCrane(data as CraneRow);
}

/**
 * Compute next-inspection-due + urgency for a crane given its inspections.
 * Logic:
 *   - If the crane has any 'completed' inspection → next_due = max(completed.inspection_date) + 3 years
 *     (or the inspection's explicit next_due_date if set).
 *   - Else if install_date present → next_due = install_date + 3 years.
 *   - Else → unknown.
 */
const TWO_MONTHS_DAYS = 60;

export function computeCraneStatus(
  crane: Crane,
  inspections: Array<{ inspectionDate: string; nextDueDate?: string; status: string }>
): CraneStatus {
  const completed = inspections
    .filter((i) => i.status === 'completed')
    .sort((a, b) => b.inspectionDate.localeCompare(a.inspectionDate));

  const last = completed[0];
  let nextDue: string | undefined;
  let lastInspection: string | undefined;

  if (last) {
    lastInspection = last.inspectionDate;
    nextDue = last.nextDueDate ?? addYears(last.inspectionDate, 3);
  } else if (crane.installDate) {
    nextDue = addYears(crane.installDate, 3);
  }

  if (!nextDue) {
    return {
      craneId: crane.id,
      lastInspectionDate: lastInspection,
      nextDueDate: undefined,
      daysUntilDue: null,
      urgency: 'unknown',
    };
  }

  const days = diffInDays(nextDue, todayStr());
  let urgency: CraneStatus['urgency'];
  if (days < 0) urgency = 'overdue';
  else if (days <= TWO_MONTHS_DAYS) urgency = 'due_soon';
  else urgency = 'ok';

  return {
    craneId: crane.id,
    lastInspectionDate: lastInspection,
    nextDueDate: nextDue,
    daysUntilDue: days,
    urgency,
  };
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addYears(isoDate: string, years: number): string {
  const d = new Date(isoDate + 'T00:00:00');
  d.setFullYear(d.getFullYear() + years);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function diffInDays(targetIso: string, fromIso: string): number {
  const a = new Date(targetIso + 'T00:00:00').getTime();
  const b = new Date(fromIso + 'T00:00:00').getTime();
  return Math.round((a - b) / 86400000);
}
