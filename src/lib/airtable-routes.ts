import type { ApprovedRoute, RouteStatus, DriverName } from '@/types/route';

const PAT = import.meta.env.VITE_AIRTABLE_PAT;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;
const ROUTES_TABLE_ID = import.meta.env.VITE_AIRTABLE_ROUTES_TABLE_ID;

const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}/${ROUTES_TABLE_ID}`;

const headers = {
  Authorization: `Bearer ${PAT}`,
  'Content-Type': 'application/json',
};

// מיפוי שדות עברית ← אנגלית
const ROUTE_FIELD_MAP: Record<string, string> = {
  'שם מסלול': 'routeName',
  'נהג': 'driver',
  'תאריך משלוח': 'deliveryDate',
  'סטטוס מסלול': 'status',
  'הזמנות': 'orderIds',
  'פרטי עצירות': 'stops',
  'מספר עצירות': 'stopCount',
  'מרחק משוער': 'estimatedDistance',
  'זמן משוער': 'estimatedTime',
  'הערות': 'notes',
};

// מיפוי הפוך: אנגלית ← עברית
const REVERSE_ROUTE_FIELD_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(ROUTE_FIELD_MAP).map(([k, v]) => [v, k])
);

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

function mapRouteRecord(record: AirtableRecord): ApprovedRoute {
  const route: Record<string, unknown> = {
    id: record.id,
    created: record.createdTime,
  };

  for (const [hebrewName, englishName] of Object.entries(ROUTE_FIELD_MAP)) {
    const value = record.fields[hebrewName];
    if (value !== undefined && value !== null) {
      // JSON fields
      if (englishName === 'orderIds' || englishName === 'stops') {
        try {
          route[englishName] = JSON.parse(value as string);
        } catch {
          route[englishName] = englishName === 'orderIds' ? [] : [];
        }
      } else {
        route[englishName] = value;
      }
    }
  }

  // ברירות מחדל
  if (!route.orderIds) route.orderIds = [];
  if (!route.stops) route.stops = [];
  if (!route.stopCount) route.stopCount = 0;

  return route as unknown as ApprovedRoute;
}

function mapFieldsToAirtable(fields: Record<string, unknown>): Record<string, unknown> {
  const airtableFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    const hebrewName = REVERSE_ROUTE_FIELD_MAP[key];
    if (hebrewName && key !== 'id') {
      // JSON fields
      if (key === 'orderIds' || key === 'stops') {
        airtableFields[hebrewName] = JSON.stringify(value);
      } else {
        airtableFields[hebrewName] = value;
      }
    }
  }

  return airtableFields;
}

// שליפת כל המסלולים עם pagination
export async function fetchAllRoutes(): Promise<ApprovedRoute[]> {
  const allRecords: ApprovedRoute[] = [];
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
    allRecords.push(...data.records.map(mapRouteRecord));
    offset = data.offset;
  } while (offset);

  return allRecords;
}

// יצירת מסלול חדש
export async function createRoute(
  routeData: Omit<ApprovedRoute, 'id' | 'created'>
): Promise<ApprovedRoute> {
  const airtableFields = mapFieldsToAirtable(routeData as unknown as Record<string, unknown>);

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      records: [{ fields: airtableFields }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[airtable-routes] Create failed:', response.status, error);
    throw new Error(`Airtable create error (${response.status}): ${error}`);
  }

  const data: AirtableResponse = await response.json();
  return mapRouteRecord(data.records[0]);
}

// עדכון מסלול (סטטוס, הערות וכו')
export async function updateRoute(
  recordId: string,
  fields: Partial<Pick<ApprovedRoute, 'status' | 'notes' | 'stops' | 'orderIds' | 'stopCount'>>
): Promise<ApprovedRoute> {
  const airtableFields = mapFieldsToAirtable(fields as unknown as Record<string, unknown>);

  const response = await fetch(BASE_URL, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      records: [{ id: recordId, fields: airtableFields }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[airtable-routes] Update failed:', response.status, error);
    throw new Error(`Airtable update error (${response.status}): ${error}`);
  }

  const data: AirtableResponse = await response.json();
  return mapRouteRecord(data.records[0]);
}
