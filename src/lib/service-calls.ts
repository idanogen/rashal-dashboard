import type { ServiceCall, ServiceCallStatus } from '@/types/service-call';
import { supabase } from './supabase';

type ServiceCallRow = {
  id: string;
  customer_name: string;
  phone: string | null;
  customer_status: ServiceCall['customerStatus'] | null;
  health_fund: string | null;
  opened_by: string | null;
  city: string | null;
  service_call_status: ServiceCallStatus | null;
  duplicate_of: string | null;
  created_at: string;
};

function rowToServiceCall(row: ServiceCallRow): ServiceCall {
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone ?? undefined,
    customerStatus: row.customer_status ?? undefined,
    healthFund: row.health_fund ?? undefined,
    openedBy: row.opened_by ?? undefined,
    city: row.city ?? undefined,
    serviceCallStatus: row.service_call_status ?? undefined,
    duplicateOf: row.duplicate_of ?? undefined,
    created: row.created_at,
  };
}

function fieldsToRow(fields: Partial<Omit<ServiceCall, 'id'>>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ('customerName' in fields) row.customer_name = fields.customerName;
  if ('phone' in fields) row.phone = fields.phone;
  if ('customerStatus' in fields) row.customer_status = fields.customerStatus;
  if ('healthFund' in fields) row.health_fund = fields.healthFund;
  if ('openedBy' in fields) row.opened_by = fields.openedBy;
  if ('city' in fields) row.city = fields.city;
  if ('serviceCallStatus' in fields) row.service_call_status = fields.serviceCallStatus;
  return row;
}

export async function fetchAllServiceCalls(): Promise<ServiceCall[]> {
  // PostgREST defaults max-rows to 1000. Paginate so we always get every row.
  const PAGE = 1000;
  const all: ServiceCall[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('service_calls')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Supabase fetchAllServiceCalls: ${error.message}`);
    const rows = (data as ServiceCallRow[]) ?? [];
    all.push(...rows.map(rowToServiceCall));
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function updateServiceCall(
  id: string,
  fields: Partial<Omit<ServiceCall, 'id'>>
): Promise<ServiceCall> {
  const { data, error } = await supabase
    .from('service_calls')
    .update(fieldsToRow(fields))
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Supabase updateServiceCall: ${error.message}`);
  return rowToServiceCall(data as ServiceCallRow);
}

export async function updateMultipleServiceCalls(
  records: Array<{ id: string; fields: Partial<Omit<ServiceCall, 'id'>> }>
): Promise<ServiceCall[]> {
  const results: ServiceCall[] = [];
  for (const r of records) {
    results.push(await updateServiceCall(r.id, r.fields));
  }
  return results;
}

export async function createServiceCall(
  fields: Partial<Omit<ServiceCall, 'id' | 'created'>> & { customerName: string }
): Promise<ServiceCall> {
  const { data, error } = await supabase
    .from('service_calls')
    .insert(fieldsToRow(fields))
    .select()
    .single();

  if (error) throw new Error(`Supabase createServiceCall: ${error.message}`);
  return rowToServiceCall(data as ServiceCallRow);
}
