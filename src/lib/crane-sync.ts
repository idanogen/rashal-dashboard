import type { Crane, CraneSyncHistory } from '@/types/crane';
import { supabase } from './supabase';

type SyncRow = {
  id: string;
  synced_at: string;
  source_filename: string | null;
  total_rows_in_file: number;
  new_cranes_count: number;
  updated_cranes_count: number;
  unchanged_count: number;
  missing_in_file_count: number;
  conflict_summary: Record<string, unknown> | null;
  performed_by: string | null;
  notes: string | null;
};

export function rowToSyncHistory(row: SyncRow): CraneSyncHistory {
  return {
    id: row.id,
    syncedAt: row.synced_at,
    sourceFilename: row.source_filename ?? undefined,
    totalRowsInFile: row.total_rows_in_file,
    newCranesCount: row.new_cranes_count,
    updatedCranesCount: row.updated_cranes_count,
    unchangedCount: row.unchanged_count,
    missingInFileCount: row.missing_in_file_count,
    conflictSummary: row.conflict_summary ?? undefined,
    performedBy: row.performed_by ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export async function fetchLatestSync(): Promise<CraneSyncHistory | null> {
  const { data, error } = await supabase
    .from('crane_sync_history')
    .select('*')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Supabase fetchLatestSync: ${error.message}`);
  if (!data) return null;
  return rowToSyncHistory(data as SyncRow);
}

export async function fetchAllSyncs(): Promise<CraneSyncHistory[]> {
  const { data, error } = await supabase
    .from('crane_sync_history')
    .select('*')
    .order('synced_at', { ascending: false });
  if (error) throw new Error(`Supabase fetchAllSyncs: ${error.message}`);
  return (data as SyncRow[]).map(rowToSyncHistory);
}

/**
 * One parsed row from the monthly Excel report.
 * Field names mirror the Excel columns directly.
 */
export interface ParsedExcelRow {
  deviceNumber: string;
  model: string;
  customerIdNumber?: string;
  customerName?: string;
  customerType?: string;
  customerTypeCode?: string;
  phone?: string;
  stickerNumber?: string;
  installDate?: string;
  openedDate?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  cancelledAt?: string;
}

export interface SyncDiff {
  newCranes: ParsedExcelRow[];
  /** Cranes that match an existing device_number but have at least one field changed */
  updates: Array<{
    crane: Crane;
    row: ParsedExcelRow;
    changes: Array<{ field: string; before: string | undefined; after: string | undefined }>;
  }>;
  unchanged: number;
  /** Existing cranes that no longer appear in the new file */
  missingInFile: Crane[];
}

const COMPARABLE_FIELDS: Array<[keyof Crane, keyof ParsedExcelRow]> = [
  ['model', 'model'],
  ['customerIdNumber', 'customerIdNumber'],
  ['customerName', 'customerName'],
  ['customerType', 'customerType'],
  ['customerTypeCode', 'customerTypeCode'],
  ['phone', 'phone'],
  ['stickerNumber', 'stickerNumber'],
  ['installDate', 'installDate'],
  ['openedDate', 'openedDate'],
  ['warrantyStart', 'warrantyStart'],
  ['warrantyEnd', 'warrantyEnd'],
  ['cancelledAt', 'cancelledAt'],
];

export function diffAgainstExisting(
  existing: Crane[],
  parsedRows: ParsedExcelRow[]
): SyncDiff {
  const existingByDevice = new Map(existing.map((c) => [c.deviceNumber, c]));
  const parsedByDevice = new Map(parsedRows.map((r) => [r.deviceNumber, r]));

  const newCranes: ParsedExcelRow[] = [];
  const updates: SyncDiff['updates'] = [];
  let unchanged = 0;

  for (const row of parsedRows) {
    const found = existingByDevice.get(row.deviceNumber);
    if (!found) {
      newCranes.push(row);
      continue;
    }
    const changes: SyncDiff['updates'][number]['changes'] = [];
    for (const [craneField, rowField] of COMPARABLE_FIELDS) {
      const before = (found[craneField] as string | undefined) ?? undefined;
      const after = (row[rowField] as string | undefined) ?? undefined;
      if ((before ?? '') !== (after ?? '')) {
        changes.push({ field: String(craneField), before, after });
      }
    }
    if (changes.length === 0) {
      unchanged += 1;
    } else {
      updates.push({ crane: found, row, changes });
    }
  }

  const missingInFile = existing.filter((c) => !parsedByDevice.has(c.deviceNumber));

  return { newCranes, updates, unchanged, missingInFile };
}

export async function applySyncDiff(
  diff: SyncDiff,
  meta: { sourceFilename: string; totalRowsInFile: number; performedBy?: string; notes?: string }
): Promise<CraneSyncHistory> {
  // 1. Insert new cranes
  if (diff.newCranes.length > 0) {
    const rows = diff.newCranes.map(rowToInsert);
    const { error } = await supabase.from('cranes').insert(rows);
    if (error) throw new Error(`Insert new cranes: ${error.message}`);
  }

  // 2. Update changed cranes (one per row — could be batched with upsert, but updates are usually few)
  for (const u of diff.updates) {
    const patch: Record<string, unknown> = {};
    for (const c of u.changes) {
      const dbCol = fieldToColumn(c.field);
      if (!dbCol) continue;
      const isDate = ['install_date', 'opened_date', 'warranty_start', 'warranty_end', 'cancelled_at'].includes(dbCol);
      patch[dbCol] = c.after ? (isDate ? c.after : c.after) : null;
    }
    if (Object.keys(patch).length === 0) continue;
    const { error } = await supabase.from('cranes').update(patch).eq('id', u.crane.id);
    if (error) throw new Error(`Update crane ${u.crane.deviceNumber}: ${error.message}`);
  }

  // 3. Record the sync
  const conflictSummary: Record<string, string[]> = {};
  for (const u of diff.updates) {
    for (const c of u.changes) {
      conflictSummary[c.field] ??= [];
      conflictSummary[c.field].push(u.crane.deviceNumber);
    }
  }

  const { data, error } = await supabase
    .from('crane_sync_history')
    .insert({
      source_filename: meta.sourceFilename,
      total_rows_in_file: meta.totalRowsInFile,
      new_cranes_count: diff.newCranes.length,
      updated_cranes_count: diff.updates.length,
      unchanged_count: diff.unchanged,
      missing_in_file_count: diff.missingInFile.length,
      conflict_summary: conflictSummary,
      performed_by: meta.performedBy ?? null,
      notes: meta.notes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`Insert sync history: ${error.message}`);
  return rowToSyncHistory(data as SyncRow);
}

function rowToInsert(r: ParsedExcelRow): Record<string, unknown> {
  return {
    device_number: r.deviceNumber,
    model: r.model,
    customer_id_number: r.customerIdNumber ?? null,
    customer_name: r.customerName ?? null,
    customer_type: r.customerType ?? null,
    customer_type_code: r.customerTypeCode ?? null,
    phone: r.phone ?? null,
    sticker_number: r.stickerNumber ?? null,
    install_date: r.installDate ?? null,
    opened_date: r.openedDate ?? null,
    warranty_start: r.warrantyStart ?? null,
    warranty_end: r.warrantyEnd ?? null,
    cancelled_at: r.cancelledAt ?? null,
  };
}

function fieldToColumn(field: string): string | null {
  const map: Record<string, string> = {
    model: 'model',
    customerIdNumber: 'customer_id_number',
    customerName: 'customer_name',
    customerType: 'customer_type',
    customerTypeCode: 'customer_type_code',
    phone: 'phone',
    stickerNumber: 'sticker_number',
    installDate: 'install_date',
    openedDate: 'opened_date',
    warrantyStart: 'warranty_start',
    warrantyEnd: 'warranty_end',
    cancelledAt: 'cancelled_at',
  };
  return map[field] ?? null;
}
