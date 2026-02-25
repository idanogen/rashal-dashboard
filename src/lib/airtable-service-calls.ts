import type { ServiceCall } from '@/types/service-call';
import { SERVICE_CALL_FIELD_MAP, REVERSE_SERVICE_CALL_FIELD_MAP } from './constants';

const PAT = import.meta.env.VITE_AIRTABLE_PAT;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;
const TABLE_ID = import.meta.env.VITE_AIRTABLE_SERVICE_CALLS_TABLE_ID;

const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

const headers = {
  Authorization: `Bearer ${PAT}`,
  'Content-Type': 'application/json',
};

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

function mapRecord(record: AirtableRecord): ServiceCall {
  const call: Record<string, unknown> = {
    id: record.id,
    created: record.createdTime,
  };

  for (const [hebrewName, englishName] of Object.entries(SERVICE_CALL_FIELD_MAP)) {
    if (englishName === 'created') continue;

    const value = record.fields[hebrewName];
    if (value !== undefined && value !== null) {
      call[englishName] = value;
    }
  }

  return call as unknown as ServiceCall;
}

function mapFieldsToAirtable(fields: Partial<ServiceCall>): Record<string, unknown> {
  const airtableFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    const hebrewName = REVERSE_SERVICE_CALL_FIELD_MAP[key];
    if (hebrewName && key !== 'id') {
      airtableFields[hebrewName] = value;
    }
  }

  return airtableFields;
}

export async function fetchAllServiceCalls(): Promise<ServiceCall[]> {
  const allRecords: ServiceCall[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(BASE_URL);
    if (offset) url.searchParams.set('offset', offset);
    url.searchParams.set('pageSize', '100');

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Airtable API error (${response.status}): ${error}`);
    }

    const data: AirtableResponse = await response.json();
    allRecords.push(...data.records.map(mapRecord));
    offset = data.offset;
  } while (offset);

  return allRecords;
}

export async function updateServiceCall(
  recordId: string,
  fields: Partial<Omit<ServiceCall, 'id'>>
): Promise<ServiceCall> {
  const body = {
    records: [
      {
        id: recordId,
        fields: mapFieldsToAirtable(fields),
      },
    ],
    typecast: true,
  };

  console.log('[airtable-service-calls] PATCH', recordId, body.records[0].fields);

  const response = await fetch(BASE_URL, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[airtable-service-calls] Update failed:', response.status, error);
    throw new Error(`Airtable update error (${response.status}): ${error}`);
  }

  const data: AirtableResponse = await response.json();
  return mapRecord(data.records[0]);
}

export async function updateMultipleServiceCalls(
  records: Array<{ id: string; fields: Partial<Omit<ServiceCall, 'id'>> }>
): Promise<ServiceCall[]> {
  const results: ServiceCall[] = [];

  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);

    const response = await fetch(BASE_URL, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        records: batch.map((r) => ({
          id: r.id,
          fields: mapFieldsToAirtable(r.fields),
        })),
        typecast: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Airtable batch update error (${response.status}): ${error}`);
    }

    const data: AirtableResponse = await response.json();
    results.push(...data.records.map(mapRecord));
  }

  return results;
}
