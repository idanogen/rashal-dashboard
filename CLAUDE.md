# [לקוח] Rashal Dashboard — דשבורד הזמנות לראש"ל ציוד רפואי

## זיהוי פרויקט
- **פרויקט:** rashal-dashboard
- **נתיב:** `/Users/idanogen/Projects/rashal-dashboard`
- **סוג:** לקוח (ראש"ל ציוד רפואי)
- **אתה עובד רק על הפרויקט הזה.**
- **אסור לשנות קבצים מחוץ לתיקייה הזו.**

## ⚠️ פרויקט לקוח — ראש"ל
- אסור לשתף קוד מהפרויקט הזה עם פרויקטים אחרים
- אסור לשנות בלי הוראה מפורשת מהמשתמש
- לוודא כל פעולה הרסנית (delete, reset, force push)

---

## מידע כללי

**שם הפרויקט:** rashal-dashboard
**גרסה:** 0.0.0
**תיאור:** דשבורד לניהול הזמנות, משלוחים לפי אזורים, ובניית מסלולים
**פריסה:** https://rashal-dashboard.vercel.app
**Dev Server:** http://localhost:3000

---

## סטאק טכנולוגי

### Core
- **React** 19.2.0 - ספריית UI
- **TypeScript** 5.9 - שפת פיתוח
- **Vite** 7.3.1 - כלי בנייה מהיר
- **React Router** 7.13.0 - ניתוב

### UI & Styling
- **Tailwind CSS** 4.1 - עיצוב utility-first
- **Shadcn/ui** - קומפוננטות UI מוכנות
- **Radix UI** - קומפוננטות נגישות
- **Lucide React** - אייקונים
- **@dnd-kit** - Drag & Drop (sortable, core, utilities)
- **Leaflet + React Leaflet** - מפות אינטראקטיביות

### State & Data
- **TanStack React Query** 5.90.20 - ניהול state וcaching
- **Supabase** (PostgreSQL + Auth + Realtime + Storage) - מסד הנתונים של המערכת
- **`useRealtimeSync`** - מאזין ל-postgres_changes על `orders`, `routes`, `service_calls` ומעדכן את ה-cache אוטומטית

### Charts & Visualization
- **Recharts** 3.7.0 - תרשימים

### Other
- **Sonner** - toast notifications
- **date-fns** - פורמט תאריכים

---

## מבנה הפרויקט

```
/src
├── /components
│   ├── /layout                    # AppShell, AppHeader
│   ├── /dashboard                 # StatsCards, Charts, Alerts
│   ├── /deliveries ⭐             # ZoneFilter, DeliveryStatusBar, UnscheduledOrders, RouteBuilderDialog, ApprovedRoutesList
│   ├── /orders                    # OrdersTable, OrderFilters, OrderDetailDialog
│   ├── /route-navigation          # MapView - מפה אינטראקטיבית עם Leaflet
│   └── /ui                        # Shadcn components (Button, Dialog, Card...)
├── /hooks                         # React Query hooks + useZonedOrders
├── /lib                           # Supabase client + API (orders/routes/service-calls), utilities, Maps, Geocoding, Export
├── /pages                         # DashboardPage, DeliveriesPage, RouteNavigationPage
├── /types                         # TypeScript interfaces (order.ts, zone.ts, route.ts)
├── /assets                        # תמונות, לוגו
├── App.tsx                        # React Router setup
└── main.tsx                       # Entry point + Leaflet CSS

Config:
├── vite.config.ts           # Vite configuration (port 3000, @ alias)
├── tsconfig.app.json        # TypeScript strict mode
├── tailwind.config.js       # Tailwind + Shadcn
└── vercel.json              # Vercel SPA rewrite rules
```

---

## הגדרות סביבה

צור קובץ `.env` בשורש הפרויקט:

```env
VITE_SUPABASE_URL=https://kukstfxtznymfkirdmty.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable / anon key>
```

**Supabase project:** `kukstfxtznymfkirdmty` (ref), region eu-central-1.

**איך לקבל את המפתחות:**
1. Supabase Dashboard → Project `rashal-dashboard` → Settings → API
2. העתק את `Project URL` ואת ה-`anon / publishable key`
3. הוסף לקובץ `.env` **וגם ל-Vercel Environment Variables**
4. Service Role Key — **לעולם לא בצד לקוח**. רק עבור scripts/Edge Functions.

**RLS:** מופעל בכל 5 הטבלאות (`profiles`, `orders`, `service_calls`, `routes`, `order_documents`). וודא שה-policies מתאימים לצורך ה-app (כרגע auth דרך Supabase Auth — ראה `src/lib/auth-context.tsx`).

---

## הוראות הרצה

```bash
cd /Users/idanogen/Projects/rashal-dashboard
npm install
npm run dev        # http://localhost:3000
npm run build      # Output: dist/
npm run preview    # Preview production build
npm run lint       # Linting
```

---

## דפים (Pages)

### `DashboardPage` (/)
- `StaleOrdersAlert` - אזהרה על הזמנות ישנות
- `StatsCards` - 4 כרטיסי סטטיסטיקה
- Charts Grid - `DailyOrdersChart` + `HealthFundChart`
- Filters + Table - `OrderFilters` + `OrdersTable`
- **State:** `filters: { search, orderStatus, worker, city }`

### `DeliveriesPage` (/routes) ⭐ חדש!
- **מטרה:** ניהול משלוחים לפי אזורים גיאוגרפיים
- **Layout:** סרגל סטטוס עליון + **Tabs** (הזמנות ממתינות / מסלולים מאושרים)
- **Components:**
  - `DeliveryStatusBar` - סטטוס כמויות לפי קטגוריה
  - `ZoneFilter` - סינון לפי אזור (צפון/מרכז/דרום) ואזור משנה (14 אזורים)
  - `UnscheduledOrders` - רשימת הזמנות עם checkbox לבחירה + כפתור "בנה מסלול"
  - `RouteBuilderDialog` - דיאלוג fullscreen לבניית מסלול עם מפה + **בחירת נהג** + **כפתור אישור מסלול**
  - `ApprovedRoutesList` - תצוגת מסלולים מאושרים עם פירוט עצירות + פעולות (התחל/השלם/בטל/החזר הזמנה)
- **Hooks:** `useZonedOrders`, `useRoutes`, `useApproveRoute`, `useUpdateRoute`

### `RouteNavigationPage` (/route-navigation)
- דף ניהול מסלול משלוחים במהלך הנסיעה
- מפה אינטראקטיבית עם Leaflet
- Current Order Card + כפתורי Waze/Google Maps
- מצב עריכה: drag & drop + הוסף/הסר הזמנות

---

## מערכת אזורים ומשלוחים ⭐⭐

### `zone.ts` - הגדרת אזורים
**קובץ:** `/src/types/zone.ts`

**14 אזורים ב-3 אזורי-על:**
- **צפון (4):** חיפה, קריות, עכו-נהריה, גליל-עמקים
- **מרכז (7):** גוש דן, דרום תל אביב, שרון, פ"ת-מזרח, רחובות-נס ציונה, לוד-רמלה-מודיעין, ירושלים
- **דרום (3):** אשדוד-אשקלון, דרום מרכז, באר שבע-אילת

**exports:**
- `ZONES: Zone[]` - מערך האזורים עם id, name, region, color
- `CITY_TO_ZONE: Record<string, string>` - מיפוי ~100 ערים לאזורים
- `getZoneForCity(city)` - חיפוש אזור עם fuzzy matching
- `getZoneById(id)`, `getZonesByRegion(region)`, `REGION_LABELS`

### `useZonedOrders` Hook
**קובץ:** `/src/hooks/useZonedOrders.ts`

- מקבל `orders: Order[]` ו-`enabledZoneIds: Set<string>`
- מסנן הזמנות לפי אזורים פעילים
- **fuzzy matching:** חיפוש חלקי + נרמול רווחים/מקפים

### `geocoding.ts` - גיאוקודינג
**קובץ:** `/src/lib/geocoding.ts`

- ~100 ערים ישראליות עם קואורדינטות (lat/lng)
- כתיב חלופי: קרית/קריית, פתח תקווה/תקוה, etc.
- **Fuzzy matching:** חיפוש ישיר -> נרמול רווחים -> ללא מקפים -> חיפוש חלקי
- `geocodeOrderByCity(order)` - המרת Order ל-GeocodedOrder
- `calculateDistance(coord1, coord2)` - Haversine distance בק"מ
- `getUnmappedOrders(orders)` - הזמנות בלי קואורדינטות

---

## RouteBuilderDialog ⭐⭐ (המרכזי!)
**קובץ:** `/src/components/deliveries/RouteBuilderDialog.tsx`

### נקודת מוצא
- **תמיד** מתחיל מ-**משה שרת 15, ראשון לציון** (משרדי החברה)
- `OFFICE_COORDINATES = { lat: 31.9730, lng: 34.7925 }`
- מרקר ירוק 🏢 על המפה

### אופטימיזציית מסלול
- **אלגוריתם:** Nearest Neighbor מהמשרד
- מתחיל מ-OFFICE_COORDINATES, מוצא את ההזמנה הקרובה ביותר, ממשיך עד סוף
- הזמנות בלי קואורדינטות (`unmapped`) מוצגות באזהרה נפרדת

### מפה (Leaflet)
- `MapContainer` עם `MapUpdater` (useMap) לעדכון bounds בזמן אמת
- מרקרים ממוספרים (כחולים) עם offset לנקודות כפולות באותה עיר
- Polyline מהמשרד דרך כל העצירות
- `key={order.id}-${idx}` על Marker — מאלץ re-mount בגרירה

### Drag & Drop
- @dnd-kit עם `PointerSensor` (activationConstraint: 8px)
- גרירת עצירות → מעדכנת מפה + מרחק + מספרי מרקרים בזמן אמת
- חישוב מרחק כולל office-to-first-stop

### שיוך נהג + אישור מסלול ⭐
- **נהגים:** רודי דויד, נהג חיצוני מועלם (`DRIVERS` ב-`route.ts`)
- `Select` לבחירת נהג בפאנל השמאלי
- כפתור **"אשר מסלול"** (ירוק) בפוטר
- אישור → שמירה בטבלת `routes` ב-Supabase + עדכון הזמנות ל"תואמה אספקה"
- תאריך משלוח = מחר (אוטומטי)
- שם מסלול = `מסלול DD/MM - {שם נהג}`

### ייצוא
- Google Maps URL (buildRouteUrl, עד 11 עצירות)
- CSV (exportRouteToCSV, תמיכה בעברית BOM)
- התחל ניווט → RouteNavigationPage

---

## מערכת מסלולים מאושרים ⭐⭐

### טבלת Supabase: `public.routes`
- **Primary key:** `id` (uuid)
- **עמודות:**
  - `route_name text`, `driver driver_name enum` (`רודי דויד` / `נהג חיצוני מועלם`)
  - `delivery_date date`, `status route_status enum` (`מאושר` / `בביצוע` / `הושלם` / `בוטל`)
  - `stops jsonb` (מערך RouteStop — id, customerName, address, city, phone, sequence)
  - `order_ids text[]`, `stop_count int`
  - `estimated_distance_km numeric`, `estimated_time_minutes int`
  - `notes text`, `created_at timestamptz`, `updated_at timestamptz`
- **RLS:** מופעל.

### טבלאות נוספות ב-Supabase
| טבלה | תיאור | Primary key |
|------|--------|-------------|
| `public.orders` | הזמנות (600 רשומות) | uuid |
| `public.service_calls` | קריאות שירות (658 רשומות) | uuid |
| `public.calendar_stops` ⭐ | עצירות ביומן (משלוח / שירות / משימה) — מקור האמת ליומן | uuid |
| `public.routes` | מסלולים מאושרים (לא בשימוש בזרימה החדשה — ראה "עדכונים אחרונים") | uuid |
| `public.order_documents` | קבצי הזמנה (Supabase Storage) | uuid, FK → orders.id |
| `public.profiles` | פרופילי משתמשים | uuid, FK → auth.users.id |

**Enums ב-Postgres:** `customer_status`, `task_status`, `order_status`, `service_call_status`, `driver_name`, `route_status`.

### `route.ts` - טיפוסים
- `DriverName` = 'רודי דויד' | 'נהג חיצוני מועלם'
- `RouteStatus` = 'מאושר' | 'בביצוע' | 'הושלם' | 'בוטל'
- `RouteStop` interface (id, customerName, address, city, phone, sequence)
- `ApprovedRoute` interface

### `src/lib/routes.ts` - API
- `fetchAllRoutes()` — `supabase.from('routes').select('*').order('delivery_date', desc)`
- `createRoute()` — INSERT עם המרת camelCase → snake_case
- `updateRoute()` — UPDATE עם eq('id', …)

### `ApprovedRoutesList` - תצוגה
- כרטיסים מתקפלים (Collapsible) עם פרטי מסלול
- Badge סטטוס צבעוני (מאושר=כחול, בביצוע=כתום, הושלם=ירוק, בוטל=אדום)
- כפתור **"החזר"** ליד כל עצירה — מחזיר הזמנה ל"ממתין לתאום" ומסיר מהמסלול
- כפתורי פעולה: התחל מסלול, סמן כהושלם, בטל מסלול

### זרימה
1. בונים מסלול → בוחרים נהג → לוחצים "אשר מסלול"
2. המסלול נשמר + הזמנות מתעדכנות ל"תואמה אספקה"
3. בטאב "מסלולים מאושרים" → רואים את המסלול
4. "התחל מסלול" → סטטוס "בביצוע" + ניווט ל-RouteNavigationPage
5. "סמן כהושלם" → סטטוס "הושלם"
6. "החזר" על עצירה → ההזמנה חוזרת לממתינות

---

## Components מרכזיים

### Dashboard (`/components/dashboard/`)
- `StatsCards` - 4 כרטיסי סטטיסטיקה (פתוחות, ממתין לתאום, אין במלאי, סופקו השבוע)
- `StaleOrdersAlert` - אזהרה על הזמנות 7+ ימים
- `DailyOrdersChart` - Bar chart 14 ימים אחרונים
- `HealthFundChart` - Pie chart לפי קופ"ח

### Deliveries (`/components/deliveries/`) ⭐
- `ZoneFilter` - סינון לפי אזור-על ואזור משנה, toggles צבעוניים
- `DeliveryStatusBar` - מונה סטטוסים (ממתין, תואם, אין במלאי, סופק)
- `UnscheduledOrders` - רשימת הזמנות עם checkboxes + כפתור "בנה מסלול" + תצוגת קיבוץ לפי אזור (collapsible, ממוין צפון→דרום)
- `RouteBuilderDialog` - דיאלוג fullscreen עם מפה + drag & drop

### Orders (`/components/orders/`)
- `OrdersTable` - טבלה responsive (table desktop / cards mobile)
- `OrderFilters` - חיפוש + סינון (סטטוס, עובד, עיר)
- `OrderStatusBadge` - Badge צבעוני לסטטוס
- `StatusDropdown` - עדכון סטטוס ישירות מהטבלה
- `OrderDetailDialog` - מודאל פרטים + מסמכים

### Route Navigation (`/components/route-navigation/`)
- `MapView` - מפת Leaflet עם markers, polyline, popups

---

## Hooks

### Calendar stops ⭐ (המודל החדש)
| Hook | קובץ | תיאור |
|------|-------|--------|
| `useCalendarStops()` | hooks/useCalendarStops.ts | כל העצירות (משלוח + שירות + משימה) ⭐ |
| `useScheduleStop()` | hooks/useScheduleStop.ts | יצירת stop + עדכון source ל"תואמה אספקה"/"תואם ביקור" |
| `useResolveStop()` | hooks/useResolveStop.ts | סימון completed/not_completed + סנכרון source |
| `useReorderStops()` | hooks/useReorderStops.ts | סידור עצירות באותו יום × נהג |
| `useDeleteStop()` | hooks/useDeleteStop.ts | מחיקה + החזרת source לממתינים |

### Orders
| Hook | קובץ | תיאור |
|------|-------|--------|
| `useOrders()` | hooks/useOrders.ts | כל ההזמנות מ-Supabase (staleTime 30s) |
| `useUpdateOrder()` | hooks/useUpdateOrder.ts | Mutation + optimistic update |
| `useOrderStats(orders)` | hooks/useOrderStats.ts | סטטיסטיקה מחושבת |
| `useZonedOrders(orders, zoneIds)` | hooks/useZonedOrders.ts | סינון לפי אזורים |

### Service calls
| Hook | קובץ | תיאור |
|------|-------|--------|
| `useServiceCalls()` | hooks/useServiceCalls.ts | כל קריאות השירות מ-Supabase |
| `useUpdateServiceCall()` | hooks/useUpdateServiceCall.ts | Mutation + optimistic update |
| `useZonedServiceCalls()` | hooks/useZonedServiceCalls.ts | סינון קריאות לפי אזור |

### Routes (dead code — ראה "עדכונים אחרונים" 22/04/2026)
| Hook | קובץ | תיאור |
|------|-------|--------|
| `useRoutes()` | hooks/useRoutes.ts | כל המסלולים מ-Supabase (לא בשימוש בזרימה החדשה) |
| `useApproveRoute()` | hooks/useApproveRoute.ts | ⚠ לא בשימוש — הוחלף ב-`useScheduleStop` |
| `useUpdateRoute()` | hooks/useUpdateRoute.ts | ⚠ לא בשימוש |
| `useApproveServiceRoute()` | hooks/useApproveServiceRoute.ts | ⚠ לא בשימוש — הוחלף ב-`useScheduleStop` |

### Utilities
| Hook | קובץ | תיאור |
|------|-------|--------|
| `useRealtimeSync()` | hooks/useRealtimeSync.ts | Supabase channel על 4 הטבלאות → invalidate cache |
| `useRouteOptimizer()` | hooks/useRouteOptimizer.ts | Nearest Neighbor מהמשרד |

---

## Lib & Utils

| Module | קובץ | תיאור |
|--------|-------|--------|
| `supabase.ts` | lib/supabase.ts | createClient + persistSession — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| `orders.ts` | lib/orders.ts | fetchAllOrders, updateOrder, updateMultipleOrders, createOrder — טבלת `orders` |
| `calendar-stops.ts` ⭐ | lib/calendar-stops.ts | CRUD ליומן המשולב — fetchAll, fetchByDateRange, create, update, delete, reorder, resolve |
| `routes.ts` | lib/routes.ts | fetchAllRoutes, createRoute, updateRoute — טבלת `routes` (לא בשימוש בזרימה החדשה) |
| `service-calls.ts` | lib/service-calls.ts | fetchAllServiceCalls, updateServiceCall, updateMultipleServiceCalls, createServiceCall — טבלת `service_calls` |
| `auth-context.tsx` | lib/auth-context.tsx | AuthProvider + useAuth — Supabase Auth session |
| `constants.ts` | lib/constants.ts | ORDER_STATUS_OPTIONS, TASK_STATUS_OPTIONS, CUSTOMER_STATUS_OPTIONS, SERVICE_CALL_STATUS_OPTIONS, WORKERS |
| `geocoding.ts` | lib/geocoding.ts | ~100 ערים, fuzzy match, Haversine distance ⭐ |
| `maps.ts` | lib/maps.ts | buildRouteUrl, MAX_GOOGLE_MAPS_STOPS=11 |
| `export.ts` | lib/export.ts | exportRouteToCSV (BOM עברית) |
| `utils.ts` | lib/utils.ts | cn(), getDaysSinceCreated(), getDaysColor() |

---

## Types

### `Order` Interface (`/src/types/order.ts`)
```typescript
interface Order {
  id: string                    // Supabase UUID
  customerName: string          // שם הלקוח
  phone?: string
  customerStatus?: 'לקוח חדש' | 'לקוח קיים'
  status?: 'Todo' | 'In progress' | 'Done'
  orderStatus?: 'ממתין לליקוט' | 'ממתין לתאום' | 'תואמה אספקה' | 'אין במלאי' | 'סופק'
  healthFund?: string
  openedBy?: string             // שורה / אילונה
  address?: string
  city?: string
  agent?: string
  documents?: OrderDocument[]   // נטענים בנפרד מ-order_documents (לא חלק מ-fetchAllOrders)
  created: string               // ISO — מ-orders.created_at
}
```

### `Zone` Interface (`/src/types/zone.ts`)
```typescript
type RegionType = 'north' | 'center' | 'south';
interface Zone {
  id: string;
  name: string;
  region: RegionType;
  color: string;
}
```

---

## עדכונים אחרונים

### 22/04/2026 — יומן משולב (משלוחים + שירות) על מודל `calendar_stops` חדש ⭐⭐⭐⭐

**שינוי ארכיטקטורלי מרכזי**: הוחלף המודל `routes` (מסלול = 1 נהג × 1 יום × סוג מסלול אחד) במודל גמיש של `calendar_stops` — כל עצירה היא שורה נפרדת ב-DB עם FK polymorphic למקור (`orders` או `service_calls`). משמעות: **נהג אחד יכול לבצע גם משלוחים וגם קריאות שירות באותו יום**, והכל מוצג ביומן אחד משולב.

#### הסכמה החדשה — `public.calendar_stops`

```sql
CREATE TABLE public.calendar_stops (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Scheduling
  delivery_date   date          NOT NULL,
  driver          driver_name   NOT NULL,
  sequence        int           NOT NULL DEFAULT 0,
  -- Optional FK ל-routes (תקציר יום × נהג — לא חובה)
  route_id        uuid          REFERENCES public.routes(id) ON DELETE SET NULL,
  -- Polymorphic source (בדיוק אחד מלא, אלא אם task)
  source_type     text          NOT NULL
                  CHECK (source_type IN ('delivery','service','task')),
  order_id        uuid          REFERENCES public.orders(id) ON DELETE CASCADE,
  service_call_id uuid          REFERENCES public.service_calls(id) ON DELETE CASCADE,
  -- Cached stop data (נשמר בעת התיזמון, יכול לסטות אם נערך)
  customer_name   text          NOT NULL,
  address         text,
  city            text,
  phone           text,
  -- Status של ה-stop עצמו (נפרד מסטטוס ה-source)
  status          text          NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned','in_progress','completed','not_completed','cancelled')),
  completed_at    timestamptz,
  notes           text,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  -- Constraint — FK אחד בלבד לפי source_type
  CONSTRAINT calendar_stops_source_check CHECK (
    (source_type = 'delivery' AND order_id IS NOT NULL AND service_call_id IS NULL) OR
    (source_type = 'service'  AND service_call_id IS NOT NULL AND order_id IS NULL) OR
    (source_type = 'task'     AND order_id IS NULL AND service_call_id IS NULL)
  )
);
```

**Indexes:** `(delivery_date, driver, sequence)`, `(order_id)`, `(service_call_id)`, `(route_id)`, `(status)`.
**RLS:** מופעל, policy `authenticated_all_calendar_stops` (אותה מדיניות כמו שאר הטבלאות).
**Realtime:** הוסף ל-publication `supabase_realtime`.
**Trigger:** `set_updated_at` לעדכון אוטומטי של `updated_at`.

#### סנכרון סטטוס דו-כיווני (S2 — אפליקציה, לא DB triggers)

| פעולה | stop.status | source.status |
|---|---|---|
| שיבוץ (drag → driver) | `planned` | delivery → `'תואמה אספקה'` / service → `'תואם ביקור'` |
| סימון כבוצע (`useResolveStop`) | `completed` | delivery → `'סופק'` / service → `'בוצע'` |
| סימון כלא בוצע | `not_completed` | delivery → `'ממתין לתאום'` / service → `'קריאה חדשה'` |
| הסרה מהיומן (`useDeleteStop`) | נמחק | delivery → `'ממתין לתאום'` / service → `'קריאה חדשה'` |

**סיבה:** app-side sync ברור, קל לדבג, הגיון עסקי גלוי בקוד (ולא מוסתר ב-DB triggers).

#### קבצים חדשים

| קובץ | תפקיד |
|---|---|
| `src/types/calendar-stop.ts` | `CalendarStop`, `StopSourceType`, `StopStatus`, `ScheduleStopInput`, labels |
| `src/lib/calendar-stops.ts` | CRUD — fetchAll, fetchByDateRange, fetchByOrder/Service, create, update, delete, reorder, resolve |
| `src/hooks/useCalendarStops.ts` | Query — כל ה-stops (staleTime 30s) |
| `src/hooks/useScheduleStop.ts` | Mutation — יצירת stop + עדכון source status |
| `src/hooks/useResolveStop.ts` | Mutation — סימון completed/not_completed + סנכרון source |
| `src/hooks/useReorderStops.ts` | Mutation — סידור עצירות באותו יום × נהג |
| `src/hooks/useDeleteStop.ts` | Mutation — מחיקת stop + החזרת source לממתינים |

#### זרימת UI חדשה (Y flow — parcel-story style)

**גרירה זריזה במקום RouteBuilderDialog fullscreen:**

1. משתמש גורר הזמנה/קריאת שירות ליום ביומן
2. **`DriverSelector`** קטן קופץ (2 כפתורים: רודי דויד / נהג חיצוני)
3. לחיצה על נהג → `useScheduleStop` יוצר `calendar_stop` + מעדכן את ה-source
4. העצירה מופיעה ביומן מיד (דרך realtime subscription)

**ה-RouteBuilderDialog fullscreen עדיין קיים** אבל כבר לא נפתח אוטומטית בגרירה — הוא מוכן לשימוש עתידי בתור "ערוך מסלול" מתוך יום.

#### יומן משולב + קיבוץ לפי נהג

`DeliveryCalendar` (שמתוכנן לעתיד להיקרא `UnifiedCalendar`) מציג את שני סוגי העצירות יחד:
- **אייקון לפי סוג מקור:** 📦 משלוח (כחול), 🔧 שירות (כתום), 📋 משימה (ענבר)
- **צבע נהג:** border-left של הכרטיס + badge
- **קיבוץ תוך יום:** כל יום מחולק לקבוצות לפי נהג (רודי דויד ראשון, אחר כך חיצוני), עם subheader צבעוני + ספירה
- **דרופ זון אחד** לכל יום — גרירה משני הסוגים עובדת אותו דבר

`DeliveryCalendar` מוצג עכשיו **בשני הדפים:**
- `/routes` — טאב "הזמנות ממתינות" (יחד עם רשימת הממתינים)
- `/service-calls` — טאב חדש "יומן משולב" + גם בתוך "קריאות ממתינות"

#### טיפוס `CalendarStop` (בקובץ `delivery.ts`) — תאימות עם הקומפוננטה הקיימת

```typescript
export type CalendarStopSource = 'delivery' | 'service' | 'task';
export interface CalendarStop {
  stopId: string;     // calendar_stops.id — מזהה יחיד
  sourceId: string;   // orderId או serviceCallId — לפי sourceType
  sourceType: CalendarStopSource;
  customerName: string;
  address?: string;
  city?: string;
  phone?: string;
}
```

הערה: יש **שני טיפוסים שנקראים `CalendarStop`** בקוד — אחד ב-`types/delivery.ts` (ה-view-level, משמש את הקומפוננטה) ואחד ב-`types/calendar-stop.ts` (ה-DB-level, המלא). ה-DeliveriesPage/ServiceCallsPage בונים adapter ממני לשני.

#### סטטוס של dead code (נשאר בקוד, לא בשימוש בזרימה הראשית)

- `RouteBuilderDialog.tsx` — לא מופעל בגרירה עכשיו. זמין כ-JSX ב-DeliveriesPage לעריכת route (מ-DayMapDialog).
- `useApproveRoute`, `useApproveServiceRoute` — hooks ישנים שיוצרים רשומת `routes` עם `stops jsonb` — **לא בשימוש בזרימה החדשה** (הגרירה יוצרת `calendar_stops` ישירות).
- טבלת `public.routes` עצמה נשארת כטבלת "תקציר יום × נהג" (עבור שם מסלול, הערות, מרחק משוער). כרגע 0 שורות, לא פעיל בזרימה.
- שדות ב-`routes` שבשימוש בעבר (`stops jsonb`, `order_ids text[]`, `stop_count int`) — לא נמחקו, אבל לא נכתבים עוד.

#### Milestones שנעשו

1. ✅ סכמת DB (`calendar_stops` + RLS + realtime + triggers)
2. ✅ Types + lib/calendar-stops.ts
3. ✅ 5 hooks חדשים
4. ✅ חיבור ל-DeliveriesPage (גרירה → DriverSelector → `useScheduleStop`)
5. ✅ חיבור ל-ServiceCallsPage + יומן משולב
6. ✅ קיבוץ עצירות לפי נהג בתא יום

#### Milestones פתוחים

- 7 — ניקוי dead code (RouteBuilderDialog, useApproveRoute, useApproveServiceRoute)
- 8 — משימות עצמאיות לנהג (`source_type='task'` + UI)
- 10 — Reorder של עצירות דרך drag בתוך יום (ה-hook מוכן)
- 11 — Resolve מ-UI (כפתורי ✓/✗ על כרטיס — ה-hook מוכן)

---

### 22/04/2026 — מעבר מלא מ-Airtable ל-Supabase ⭐⭐⭐

**המערכת הועברה לניהול מלא ב-Supabase** (project ref: `kukstfxtznymfkirdmty`, region `eu-central-1`). כבר בעבר (Sprint קודם) המעבר *התחיל* — ה-env והcreateClient היו מוגדרים, וה-`useRealtimeSync` האזין ל-`orders/routes/service_calls`, אבל השמות של קבצי ה-lib והטיפוסים עדיין נשאו את המותג "Airtable" והיו מבלבלים.

**מה השתנה בסיבוב הזה:**
- **rename של 3 קבצי lib:**
  - `src/lib/airtable.ts` → `src/lib/orders.ts`
  - `src/lib/airtable-routes.ts` → `src/lib/routes.ts`
  - `src/lib/airtable-service-calls.ts` → `src/lib/service-calls.ts`
- **עדכון 10 imports** בכל ה-hooks (`useOrders`, `useUpdateOrder`, `useRoutes`, `useUpdateRoute`, `useApproveRoute`, `useServiceCalls`, `useUpdateServiceCall`, `useApproveServiceRoute`) ובקומפוננטה `ApprovedRoutesList.tsx`
- **`src/types/order.ts`** — הטיפוס `AirtableAttachment` שונה ל-`OrderDocument` כדי להתאים לטבלת `order_documents` ב-Supabase (שדות: `id`, `orderId`, `storagePath`, `filename`, `sizeBytes`, `mimeType`, `created`). שדה `documents` נשאר optional — נטען בנפרד מ-`order_documents` (לא חלק מ-fetchAllOrders כיום)
- **`src/components/orders/OrderDetailDialog.tsx`** — התצוגה של קבצים הותאמה לשדות החדשים (`sizeBytes` במקום `size`, הוסר `href={doc.url}` עד שיוטמע Supabase Storage `getPublicUrl`)
- **`src/lib/constants.ts`** — הוסרו `FIELD_MAP`, `REVERSE_FIELD_MAP`, `SERVICE_CALL_FIELD_MAP`, `REVERSE_SERVICE_CALL_FIELD_MAP` — היו dead code מתקופת Airtable (לא היו שימושים)
- **`.env`** — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (הוסרו `VITE_AIRTABLE_*` מהתיעוד)
- **`CLAUDE.md`** — עודכן בהתאם: tech stack, ENV, tables, hooks, lib

**סכמת Supabase (snapshot 22/04/2026):**
| טבלה | שורות | תיאור |
|------|-------|--------|
| `public.orders` | 600 | הזמנות |
| `public.service_calls` | 658 | קריאות שירות |
| `public.routes` | 0 | מסלולים מאושרים |
| `public.order_documents` | 0 | קבצי הזמנה (FK → orders) |
| `public.profiles` | 1 | פרופילים (FK → auth.users) |

**Enums:** `customer_status`, `task_status`, `order_status`, `service_call_status`, `driver_name`, `route_status`.

**הערה חשובה:** ה-`order_status` ב-DB מכיל 5 ערכים — נוסף `'ממתין לליקוט'` (מעבר ל-4 שהיו באיירטייבל), וגם תוקן ה-typo הישן `'איו במלאי'` → `'אין במלאי'`. הטיפוס `Order['orderStatus']` עודכן בהתאם.

**בדיקה:** `npm run build` ✅ עובר נקי (2662 modules, 2s).

**קבצים ששונה שמם:** airtable.ts, airtable-routes.ts, airtable-service-calls.ts → orders.ts, routes.ts, service-calls.ts
**קבצים ששונו:** 10 hooks, OrderDetailDialog.tsx, constants.ts, RouteNavigationPage.tsx (comment), types/order.ts, CLAUDE.md

---

### 06/04/2026 - תזמון bulk בלחיצה + DayMapDialog + תיקון timezone ⭐⭐⭐

**קובצים חדשים:**
- **DatePickerDialog.tsx** — דיאלוג לבחירת תאריך משלוח לתזמון bulk. משתמש ב-`<input type="date">` native (אפס תלויות חדשות), חוסם שישי/שבת/עבר עם הודעת שגיאה, ברירת מחדל חכמה (מחר, או ראשון הבא אם מחר = סופ"ש)
- **DayMapDialog.tsx** — דיאלוג fullscreen להצגת כל המסלולים של יום שלם על מפת Leaflet אחת. כולל:
  - מפה מרכזית עם מרקר משרד ירוק 🏢, מרקרים ממוספרים לכל עצירה צבועים לפי נהג, polylines מקווקו למסלולים "מאושר" ורציף ל"בביצוע", auto-fit bounds
  - פאנל צד (340px) עם כרטיס לכל מסלול: header צבעוני, badge סטטוס, מרחק, רשימת עצירות ממוספרת עם כתובת ואייקון טלפון, כפתור "ערוך" (פותח RouteBuilderDialog במצב עריכה)
  - Header עם תאריך עברית מלא + סיכום (מסלולים · עצירות · מרחק כולל)
  - Legend בפוטר

**שינויים מרכזיים:**
- **UnscheduledOrders** — sticky action bar משודרג: במקום טקסט פסיבי "גרור אחת ליומן" עכשיו יש **כפתור אקטיבי "תזמן X הזמנות"** עם אייקון CalendarDays שמפעיל את DatePickerDialog. גרירה עדיין עובדת כמסלול חלופי
- **DeliveriesPage** — שתי זרימות חדשות:
  1. **תזמון bulk בלחיצה:** בחירה מרובה → כפתור "תזמן" → DatePickerDialog → RouteBuilderDialog עם התאריך שנבחר
  2. **תצוגת יום על מפה:** לחיצה על אייקון מפה ביום ביומן → DayMapDialog (במקום ישר RouteBuilderDialog או driver-picker) → כפתור "ערוך" מעביר ל-RouteBuilderDialog במצב עריכה
- **RouteBuilderDialog** — הוספת `initialDate?: string` prop. לפני: התאריך היה hardcoded למחר, גם הגרירה ליום ביומן הייתה מתעלמת מהיום שנבחר (באג סמוי). אחרי: שתי הזרימות (גרירה + DatePicker) מעבירות את התאריך בפועל
- **DeliveryCalendar** — תיקון באג timezone: החלפת `date.toISOString().split('T')[0]` ב-helper `toLocalDateStr(d)` שמחשב מקומית, ב-7 מקומות. מנע off-by-one-day באזור הזמן ישראלי (בעיקר בלילות)
- **הסרת dead code:** driver-picker-dialog הישן הוסר (מיותר — DayMapDialog מציג את כל הנהגים יחד), יחד עם ייבואים מיותרים ב-DeliveriesPage (Dialog, Map, User, DRIVER_CONFIG, Button)

**זרימות חדשות:**
- **בחירה מרובה → תזמון בלחיצה:** לחיצה על כרטיסי הזמנות מסמנת אותם (ring + CheckCircle) → sticky bar עם ספירה → כפתור "תזמן X הזמנות" → DatePicker עם בחירת תאריך → RouteBuilderDialog נפתח עם כל ההזמנות והתאריך
- **תצוגת יום על מפה (preview לפני commit):** יום ביומן עם מסלולים מאושרים → אייקון מפה → DayMapDialog רואה הכל יחד (כל הנהגים, כל העצירות, מרחק כולל) → אם רוצה לערוך → "ערוך" בכרטיס המסלול → RouteBuilderDialog במצב עריכה

**קבצים חדשים:** DatePickerDialog.tsx, DayMapDialog.tsx
**קבצים ששונו:** DeliveriesPage.tsx, UnscheduledOrders.tsx, RouteBuilderDialog.tsx, DeliveryCalendar.tsx

---

### 18/03/2026 - יומן משלוחים עם גרירה + שיפור מסך בניית מסלול ⭐⭐⭐

**קומפוננטות חדשות:**
- **DeliveryCalendar.tsx** — יומן שבועי (ראשון-חמישי) עם drop zones לכל יום, ניווט שבועי, כרטיסי עצירות צבעוניים לפי נהג
- **DriverSelector.tsx** — דיאלוג בחירת נהג (רודי דויד / נהג חיצוני מועלם) עם כפתורים ויזואליים
- **delivery.ts** — טיפוסים: CalendarDelivery, CalendarStop, DRIVER_CONFIG

**שינויים מרכזיים:**
- **UnscheduledOrders** — כרטיסי הזמנות ניתנים לגרירה (useDraggable מ-@dnd-kit) + סימון מרובה בלחיצה + strip תחתון "גרור אחת ליומן כדי לשבץ את כולן"
- **DeliveriesPage** — עטיפה ב-DndContext עם closestCenter collision detection, גרירה ליום ביומן → פתיחת RouteBuilderDialog ישירות
- **RouteBuilderDialog layout חדש** — Header עם שיוך נהג + מטריקות + אופטימיזציה (במקום בצד), רשימת עצירות על כל צד ימין לצד המפה
- **הסרת "התחל ניווט"** מ-RouteBuilderDialog (לא רלוונטי לשלב בניית מסלול במשרד)
- **הסרת כפתורים מיותרים** — "בנה מסלול ישיר", "תזמן הזמנות"

**זרימת עבודה חדשה:**
1. סמן הזמנות (אופציונלי, לגרירה קבוצתית)
2. גרור ליום ביומן → ישר נפתח מסך מפה
3. סדר עצירות (drag & drop) + בחר נהג
4. אשר מסלול → נשמר ב-Supabase + הזמנות מתעדכנות ל"תואמה אספקה"
5. היומן מציג מסלולים מאושרים עם צבע לפי נהג

**קבצים חדשים:** delivery.ts, DeliveryCalendar.tsx, DriverSelector.tsx
**קבצים ששונו:** DeliveriesPage.tsx, UnscheduledOrders.tsx, RouteBuilderDialog.tsx

---

### 17/02/2026 - מערכת אישור מסלולים + שיוך נהגים ⭐⭐⭐
- **טבלת מסלולים** (`public.routes` ב-Supabase) — שמירת מסלולים עם `stops jsonb`
- **שיוך נהגים:** Select בחירת נהג (רודי דויד / נהג חיצוני מועלם) ב-RouteBuilderDialog
- **כפתור "אשר מסלול"** — שומר ב-Supabase + מעדכן הזמנות ל"תואמה אספקה"
- **טאב "מסלולים מאושרים"** ב-DeliveriesPage עם Shadcn Tabs
- **ApprovedRoutesList** — כרטיסים מתקפלים עם פרטי מסלול + כפתורי פעולה
- **כפתור "החזר"** ליד כל עצירה — מחזיר הזמנה ל"ממתין לתאום" ומעדכן מסלול
- **6 קבצים חדשים:** route.ts, routes.ts (lib), useRoutes.ts, useApproveRoute.ts, useUpdateRoute.ts, ApprovedRoutesList.tsx

### 17/02/2026 - מערכת משלוחים חדשה עם אזורים ⭐⭐

**שינויים מבניים:**
- **מחיקת 12 קבצים ישנים:** RoutePlannerPage, RouteRecommendation, TomorrowCoordinationDialog, RouteCityGroups, RouteSelectedPanel, QuantityInputStep, RouteAdjustmentStep, RouteExportStep, RouteProposalStep, useDeliverableOrders, useRouteRecommendations, useTomorrowCoordinationRecommendations
- **הוספת 6 קבצים חדשים:** zone.ts, useZonedOrders.ts, ZoneFilter.tsx, DeliveryStatusBar.tsx, UnscheduledOrders.tsx, RouteBuilderDialog.tsx, DeliveriesPage.tsx

**פיצ'רים חדשים:**
- מערכת אזורים גיאוגרפיים (14 אזורים, 3 אזורי-על)
- מיפוי ~100 ערים ישראליות לאזורים + קואורדינטות
- דף משלוחים חדש (DeliveriesPage) עם סינון אזורי
- RouteBuilderDialog: מפת Leaflet fullscreen עם Nearest Neighbor מהמשרד
- נקודת מוצא קבועה: משה שרת 15, ראשון לציון (מרקר ירוק 🏢)
- Drag & drop עצירות מעדכן מפה בזמן אמת (MapUpdater + useMap)
- Offset לנקודות כפולות באותה עיר
- Fuzzy matching לשמות ערים בעברית
- אזהרה על הזמנות ללא מיקום ידוע
- תצוגת קיבוץ לפי אזור עם דקלים (collapsible sections)
- מיון אזורים מצפון לדרום (חיפה → ירושלים → באר שבע → ללא אזור)
- כפתור "פתח הכל" / "סגור הכל"

### 12/02/2026 - מעבר לבסיס Airtable חדש
- מעבר מבסיס `appppG6raO3MzBku0` לבסיס חדש `appe17N3EbbGYogGK`
- תיקון תאריכים: שימוש ב-`createdTime` המובנה של Airtable
- תיקון גרף יומי: השוואת תאריכים ב-DailyOrdersChart

### 11/02/2026 - ניהול מסלולים מתקדם
- RouteNavigationPage עם מפה אינטראקטיבית
- מצב עריכה: drag & drop + הוסף/הסר הזמנות
- אינטגרציה עם Waze/Google Maps

---

**עודכן לאחרונה:** 22 באפריל 2026 (יומן משולב + `calendar_stops` + מעבר מלא ל-Supabase)
**מפתחים:** צוות Rashal + Claude Code
