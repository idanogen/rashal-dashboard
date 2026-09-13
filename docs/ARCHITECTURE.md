# ארכיטקטורה: rashal-dashboard (תמונת מצב מ-CLAUDE.md, 13/09/2026)

> התיאור הטכני המפורט שישב ב-`CLAUDE.md` עד 13/09/2026: מסכים, מערכת האזורים,
> בונה המסלולים, מסלולים מאושרים, רכיבים, hooks, ספריות וטיפוסים. הועבר לכאן כמו
> שהוא. חלקים ממנו מתארים קוד מת (מודל `routes`, `RouteBuilderDialog`,
> `useApproveRoute`), וזה מסומן במקום. המקור לסטטוס שוטף הוא `STATUS.md`, וההיסטוריה
> המלאה של השינויים ב-`archive/claude-history.md`. לפני שמסתמכים על פרט כאן, לאמת
> מול הקוד: התיאור לא מתעדכן אוטומטית.

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
- **`useRealtimeSync`** - שלוש שכבות רענון (07/09/2026): ערוץ postgres_changes על 5 הטבלאות עם חיבור מחדש, בדיקת שינויים כל דקה ובחזרה לחלון דרך `sync_freshness()` (רק מפתח שזז נטען), וחיווי "סונכרן מפריוריטי לפני X" + "משוך עכשיו" בכותרת (`src/lib/sync-freshness.ts`)

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

### Dispatch (`/components/dispatch/`) ⭐⭐
- `UnscheduledPanel` - **רשימת הממתינים המשותפת לארבעת הסוגים** (משלוחים, שירות, איסופים, לקוחות חדשים). מחזיק את הפאנל ואת הכרטיס; כל סוג רק ממפה את עצמו ל-`DispatchItemVM`. ראה עדכון 12/08/2026.

### Deliveries (`/components/deliveries/`) ⭐
- `ZoneFilter` - סינון לפי אזור-על ואזור משנה, toggles צבעוניים
- `DeliveryStatusBar` - מונה סטטוסים (ממתין, תואם, אין במלאי, סופק)
- `UnscheduledOrders` - מתאם דק מעל `UnscheduledPanel` (VM + דיאלוג פרטי ההזמנה)
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
| `useRealtimeSync()` | hooks/useRealtimeSync.ts | ערוץ על 5 טבלאות + חיבור מחדש + בדיקת שינויים כל דקה (`sync_freshness`) → invalidate רק מה שזז |
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

