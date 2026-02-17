# Rashal Dashboard - דשבורד ניהול הזמנות

> מערכת ניהול הזמנות לרשעל ציוד רפואי עם אינטגרציה ל-Airtable

---

## מידע כללי

**שם הפרויקט:** rashal-dashboard
**גרסה:** 0.0.0
**תיאור:** דשבורד לניהול הזמנות, משלוחים לפי אזורים, ובניית מסלולים
**פריסה:** https://rashal-dashboard.vercel.app
**Dev Server:** http://localhost:3001 (port 3000 משמש לפרויקטים אחרים)

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
- **Airtable API** - מסד נתונים (REST)

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
│   ├── /deliveries ⭐             # ZoneFilter, DeliveryStatusBar, UnscheduledOrders, RouteBuilderDialog
│   ├── /orders                    # OrdersTable, OrderFilters, OrderDetailDialog
│   ├── /route-navigation          # MapView - מפה אינטראקטיבית עם Leaflet
│   └── /ui                        # Shadcn components (Button, Dialog, Card...)
├── /hooks                         # React Query hooks + useZonedOrders
├── /lib                           # Airtable API, utilities, constants, Maps, Geocoding, Export
├── /pages                         # DashboardPage, DeliveriesPage, RouteNavigationPage
├── /types                         # TypeScript interfaces (order.ts, zone.ts)
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
VITE_AIRTABLE_PAT=your_personal_access_token_here
VITE_AIRTABLE_BASE_ID=appe17N3EbbGYogGK
VITE_AIRTABLE_TABLE_ID=tblRskogYbE0RoCz0
```

**איך לקבל Airtable PAT:**
1. היכנס ל-Airtable -> Account -> Developer Hub -> Personal Access Tokens
2. Create new token עם הרשאות: `data.records:read`, `data.records:write`, `schema.bases:read`
3. בחר את הבסיס הספציפי (appe17N3EbbGYogGK)
4. העתק את ה-token ל-`.env` **וגם ל-Vercel Environment Variables**

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
- **Layout:** סרגל סטטוס עליון + פילטר אזורים + רשימת הזמנות לא מתוזמנות
- **Components:**
  - `DeliveryStatusBar` - סטטוס כמויות לפי קטגוריה
  - `ZoneFilter` - סינון לפי אזור (צפון/מרכז/דרום) ואזור משנה (14 אזורים)
  - `UnscheduledOrders` - רשימת הזמנות עם checkbox לבחירה + כפתור "בנה מסלול"
  - `RouteBuilderDialog` - דיאלוג fullscreen לבניית מסלול עם מפה
- **Hook:** `useZonedOrders` - סינון הזמנות לפי אזורים נבחרים

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

### ייצוא
- Google Maps URL (buildRouteUrl, עד 11 עצירות)
- CSV (exportRouteToCSV, תמיכה בעברית BOM)
- התחל ניווט → RouteNavigationPage

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
- `UnscheduledOrders` - רשימת הזמנות עם checkboxes + כפתור "בנה מסלול"
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

| Hook | קובץ | תיאור |
|------|-------|--------|
| `useOrders()` | hooks/useOrders.ts | כל ההזמנות מ-Airtable (staleTime 30s, refetch 60s) |
| `useUpdateOrder()` | hooks/useUpdateOrder.ts | Mutation + optimistic update |
| `useOrderStats(orders)` | hooks/useOrderStats.ts | סטטיסטיקה מחושבת |
| `useZonedOrders(orders, zoneIds)` | hooks/useZonedOrders.ts | סינון לפי אזורים ⭐ |

---

## Lib & Utils

| Module | קובץ | תיאור |
|--------|-------|--------|
| `airtable.ts` | lib/airtable.ts | fetchAllOrders, updateOrder, mapRecord (createdTime) |
| `constants.ts` | lib/constants.ts | FIELD_MAP, ORDER_STATUS_OPTIONS, WORKERS |
| `geocoding.ts` | lib/geocoding.ts | ~100 ערים, fuzzy match, Haversine distance ⭐ |
| `maps.ts` | lib/maps.ts | buildRouteUrl, MAX_GOOGLE_MAPS_STOPS=11 |
| `export.ts` | lib/export.ts | exportRouteToCSV (BOM עברית) |
| `utils.ts` | lib/utils.ts | cn(), getDaysSinceCreated(), getDaysColor() |

---

## Types

### `Order` Interface (`/src/types/order.ts`)
```typescript
interface Order {
  id: string                    // Airtable record ID
  customerName: string          // שם הלקוח
  phone?: string
  customerStatus?: 'לקוח חדש' | 'לקוח קיים'
  status?: 'Todo' | 'In progress' | 'Done'
  orderStatus?: 'ממתין לתאום' | 'תואמה אספקה ' | 'איו במלאי' | 'סופק'
  healthFund?: string
  openedBy?: string             // שורה / אילונה
  address?: string
  city?: string
  agent?: string
  documents?: AirtableAttachment[]
  created: string               // ISO timestamp (createdTime)
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

### 12/02/2026 - מעבר לבסיס Airtable חדש
- מעבר מבסיס `appppG6raO3MzBku0` לבסיס חדש `appe17N3EbbGYogGK`
- תיקון תאריכים: שימוש ב-`createdTime` המובנה של Airtable
- תיקון גרף יומי: השוואת תאריכים ב-DailyOrdersChart

### 11/02/2026 - ניהול מסלולים מתקדם
- RouteNavigationPage עם מפה אינטראקטיבית
- מצב עריכה: drag & drop + הוסף/הסר הזמנות
- אינטגרציה עם Waze/Google Maps

---

**עודכן לאחרונה:** 17 בפברואר 2026
**מפתחים:** צוות Rashal + Claude Code
