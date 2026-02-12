import type { Order } from '@/types/order';
import { FIELD_MAP, REVERSE_FIELD_MAP } from './constants';

const PAT = import.meta.env.VITE_AIRTABLE_PAT;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;
const TABLE_ID = import.meta.env.VITE_AIRTABLE_TABLE_ID;

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

// Map Airtable record to typed Order
function mapRecord(record: AirtableRecord): Order {
  const order: Record<string, unknown> = {
    id: record.id,
    created: record.createdTime // שימוש ב-createdTime המובנה של Airtable
  };

  for (const [hebrewName, englishName] of Object.entries(FIELD_MAP)) {
    // דלג על 'created' כי כבר הוספנו אותו מ-createdTime
    if (englishName === 'created') continue;

    const value = record.fields[hebrewName];
    if (value !== undefined && value !== null) {
      order[englishName] = value;
    }
  }

  return order as unknown as Order;
}

// Map Order fields back to Airtable Hebrew field names
function mapFieldsToAirtable(fields: Partial<Order>): Record<string, unknown> {
  const airtableFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    const hebrewName = REVERSE_FIELD_MAP[key];
    if (hebrewName && key !== 'id') {
      airtableFields[hebrewName] = value;
    }
  }

  return airtableFields;
}

// Fetch all orders with pagination
export async function fetchAllOrders(): Promise<Order[]> {
  const allRecords: Order[] = [];
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

// Update a single order
export async function updateOrder(
  recordId: string,
  fields: Partial<Omit<Order, 'id'>>
): Promise<Order> {
  const body = {
    records: [
      {
        id: recordId,
        fields: mapFieldsToAirtable(fields),
      },
    ],
  };

  console.log('[airtable] PATCH', recordId, body.records[0].fields);

  const response = await fetch(BASE_URL, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[airtable] Update failed:', response.status, error);
    throw new Error(`Airtable update error (${response.status}): ${error}`);
  }

  const data: AirtableResponse = await response.json();
  return mapRecord(data.records[0]);
}

// Batch update multiple orders (max 10 per request)
export async function updateMultipleOrders(
  records: Array<{ id: string; fields: Partial<Omit<Order, 'id'>> }>
): Promise<Order[]> {
  const results: Order[] = [];

  // Split into batches of 10
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
