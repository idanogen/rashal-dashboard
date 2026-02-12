# Rashal Dashboard - דשבורד ניהול הזמנות

> מערכת ניהול הזמנות לרשעל ציוד רפואי עם אינטגרציה ל-Airtable

---

## 📋 מידע כללי

**שם הפרויקט:** rashal-dashboard
**גרסה:** 0.0.0
**תיאור:** דשבורד לניהול הזמנות, המלצות מסלולים, ותכנון משלוחים
**פריסה:** https://rashal-dashboard.vercel.app
**Dev Server:** http://localhost:3001 (port 3000 משמש לפרויקטים אחרים)

---

## 🛠️ סטאק טכנולוגי

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

## 📁 מבנה הפרויקט

```
/src
├── /components
│   ├── /layout                    # AppShell, AppHeader
│   ├── /dashboard                 # StatsCards, Charts, Alerts, Recommendations
│   ├── /orders                    # OrdersTable, OrderFilters, OrderDetailDialog
│   ├── /routes                    # RouteCityGroups, RouteSelectedPanel
│   ├── /tomorrow-coordination ⭐  # Wizard: Quantity, Proposal, Adjustment, Export, DraggableList, AvailableOrders
│   ├── /route-navigation ⭐       # MapView - מפה אינטראקטיבית עם Leaflet
│   └── /ui                        # Shadcn components (Button, Dialog, Card...)
├── /hooks                         # React Query hooks + custom logic
├── /lib                           # Airtable API, utilities, constants, Maps, Geocoding ⭐, Export ⭐
├── /pages                         # DashboardPage, RoutePlannerPage, RouteNavigationPage ⭐
├── /types                         # TypeScript interfaces
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

## 🔑 הגדרות סביבה

צור קובץ `.env` בשורש הפרויקט:

```env
VITE_AIRTABLE_PAT=your_personal_access_token_here
VITE_AIRTABLE_BASE_ID=appe17N3EbbGYogGK
VITE_AIRTABLE_TABLE_ID=tblRskogYbE0RoCz0
```

**איך לקבל Airtable PAT:**
1. היכנס ל-Airtable → Account → Developer Hub → Personal Access Tokens
2. Create new token עם הרשאות:
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`
3. בחר את הבסיס הספציפי (appe17N3EbbGYogGK)
4. העתק את ה-token ל-`.env` **וגם ל-Vercel Environment Variables**

**חשוב:** ודא שה-PAT מחובר לבסיס הנכון ב-Airtable!

---

## 🚀 הוראות הרצה

### התקנה
```bash
cd /Users/idanogen/Projects/rashal-dashboard
npm install
```

### הרצה מקומית (Dev)
```bash
npm run dev
# פתח: http://localhost:3000
```

### בנייה לפרודקשן
```bash
npm run build
# Output: dist/
```

### Preview Production Build
```bash
npm run preview
```

### Linting
```bash
npm run lint
```

### Deployment ל-Vercel
```bash
# דחיפה ל-Git אוטומטית מפעילה deployment
git add .
git commit -m "Your message"
git push

# או באמצעות Vercel CLI:
vercel deploy
```

---

## 📦 Components מרכזיים

### Layout Components (`/components/layout/`)

#### `AppShell.tsx`
- Layout wrapper כללי עם header קבוע
- תמיכה ב-RTL (right-to-left)
- max-width: 7xl

#### `AppHeader.tsx`
- Header sticky עם לוגו וניווט
- 2 דפים: "/" (דשבורד), "/routes" (תכנון מסלולים)
- כפתור רענון עם "עודכן לפני X דקות"

---

### Dashboard Components (`/components/dashboard/`)

#### `StatsCards.tsx`
4 כרטיסי סטטיסטיקה:
1. **סה"כ פתוחות** - Total - Delivered
2. **ממתין לתאום** - סטטוס "ממתין לתאום"
3. **אין במלאי** - סטטוס "איו במלאי"
4. **סופקו השבוע** - סופקו ב-7 הימים האחרונים

#### `RouteRecommendation.tsx`
- **מטרה:** המלצות לתכנון מסלול היום
- **לוגיקה:**
  - מסנן הזמנות: "ממתין לתאום" או "תואמה אספקה"
  - מקבץ לפי עיר
  - חישוב ניקוד: `oldCount × 3 + totalCount × 1 + oldestDays × 0.5`
  - TOP 3 ערים
- **פעולה:** כפתור "צור מסלול" → ניווט ל-`/routes` עם pre-selection

#### `TomorrowCoordinationDialog.tsx` ⭐⭐ (מתקדם!)
- **מטרה:** Wizard רב-שלבי לתכנון מסלול מחר עם אופטימיזציה גיאוגרפית
- **Wizard בן 4 שלבים:**

**שלב 1: קלט כמות (`QuantityInputStep`)**
  - בחירת כמות נקודות לספק (5 ברירת מחדל)
  - שדה אופציונלי: כתובת התחלה
  - כפתורים +/- לשינוי כמות

**שלב 2: הצעת מסלול (`RouteProposalStep`)**
  - אופטימיזציה אוטומטית עם `useRouteOptimizer`
  - אלגוריתם: Greedy Nearest-Neighbor + Priority Scoring
  - גיאוקודינג ברמת עיר (50+ ערים ישראליות)
  - הצגת מסלול ממוספר (1-N) עם סה"כ מרחק
  - אפשרויות: אישור / עריכה / חזרה

**שלב 3: התאמה ידנית (`RouteAdjustmentStep`)**
  - **שתי עמודות:**
    - שמאל: `DraggableRouteList` - drag & drop לשינוי סדר
    - ימין: `AvailableOrdersPanel` - הוספת הזמנות
  - חיפוש/סינון הזמנות זמינות
  - קיבוץ לפי עיר (collapsible)
  - כפתורי ייצוא: Google Maps, CSV

**שלב 4: ייצוא ופעולות (`RouteExportStep`)**
  - סיכום המסלול (X עצירות, ~Y ק"מ)
  - כפתור ראשי: **"התחל ניווט במערכת"** ⭐
  - כפתורים משניים: Google Maps, CSV Export
  - טיפים למשתמש

- **קומפוננטות עזר:**
  - `DraggableRouteList` - רשימה ניתנת לסידור עם @dnd-kit
  - `AvailableOrdersPanel` - פאנל חיפוש והוספת הזמנות

#### `StaleOrdersAlert.tsx`
- אזהרה על הזמנות ישנות (7+ ימים) שלא סופקו
- כפתור scroll לטבלה

#### `DailyOrdersChart.tsx` & `HealthFundChart.tsx`
- **DailyOrdersChart:** Bar chart - מספר הזמנות ליום (14 ימים אחרונים)
- **HealthFundChart:** Pie chart - התפלגות לפי קופת חולים

---

### Orders Components (`/components/orders/`)

#### `OrdersTable.tsx`
- טבלה responsive:
  - Desktop: table מלא
  - Mobile: cards
- עמודות: #, שם, טלפון, עיר, כתובת, קופ"ח, סוכן, סטטוס הזמנה, נפתח ע"י, תאריך, ימים
- Sorting על כל עמודה
- Click על שורה → פותח `OrderDetailDialog`
- מציג "מוצג X מתוך Y הזמנות"

#### `OrderFilters.tsx`
- חיפוש טקסט חופשי (שם לקוח, טלפון)
- סינון לפי:
  - סטטוס הזמנה
  - עובד (שורה / אילונה)
  - עיר

#### `OrderStatusBadge.tsx`
- Badge צבעוני לסטטוס:
  - כחול: ממתין לתאום
  - סגול: תואמה אספקה
  - צהוב: אין במלאי
  - ירוק: סופק

#### `StatusDropdown.tsx`
- Dropdown לשינוי סטטוס הזמנה ישירות מהטבלה
- עובד עם `useUpdateOrder` hook

#### `OrderDetailDialog.tsx`
- מודאל עם כל פרטי ההזמנה
- הצגת מסמכים מצורפים (documents)
- אפשרות להוריד קבצים

---

### Tomorrow Coordination Components (`/components/tomorrow-coordination/`) ⭐

#### `QuantityInputStep.tsx`
- שלב 1 של wizard
- Input מספר נקודות (+ / - buttons)
- שדה אופציונלי: כתובת התחלה
- Validation: min=1, max=availableCount

#### `RouteProposalStep.tsx`
- שלב 2 של wizard
- הצגת מסלול מוצע (read-only)
- Badge: X עצירות, ~Y ק"מ
- Warning: אם אין גיאוקודינג או >11 עצירות
- כפתורים: אישור / עריכה / חזרה

#### `RouteAdjustmentStep.tsx`
- שלב 3 של wizard
- Two-column layout:
  - שמאל: DraggableRouteList
  - ימין: AvailableOrdersPanel
- כפתורי ייצוא: Google Maps, CSV
- כפתור "סיום ועבור לייצוא"

#### `RouteExportStep.tsx`
- שלב 4 של wizard
- Summary card עם רשימת הזמנות
- כפתור ראשי: **"התחל ניווט במערכת"** (→ RouteNavigationPage)
- כפתורים משניים: Google Maps, CSV Export
- Success state אחרי ייצוא

#### `DraggableRouteList.tsx`
- רשימה ניתנת לסידור מחדש
- @dnd-kit/sortable
- GripVertical handle
- כפתור delete לכל item
- מספור אוטומטי (1, 2, 3...)
- Keyboard + Touch support

#### `AvailableOrdersPanel.tsx`
- פאנל הזמנות זמינות להוספה
- חיפוש/סינון (שם, עיר, כתובת)
- קיבוץ לפי עיר (collapsible)
- Badge עם ימים + צבע
- כפתור + להוספה למסלול
- סינון אוטומטי של הזמנות שכבר נבחרו

---

### Routes Components (`/components/routes/`)

#### `RouteCityGroups.tsx`
- רשימת ערים עם הזמנות מוכנות למשלוח ("תואמה אספקה")
- Grouping לפי עיר, sorted לפי כמות הזמנות
- Collapsible sections
- Checkbox לכל הזמנה + "Select All" לעיר
- קישור ל-Google Maps לכל כתובת
- קישור טלפון לכל לקוח

#### `RouteSelectedPanel.tsx`
- Sidebar sticky עם הזמנות נבחרות
- מציג:
  - מספר הזמנות נבחרות
  - רשימת הזמנות ממוספרות
- כפתורים:
  - "נקה הכל"
  - "פתח ב-Google Maps" - בונה מסלול מלא

---

### Route Navigation Components (`/components/route-navigation/`) ⭐⭐

#### `MapView.tsx`
**מפה אינטראקטיבית עם Leaflet**

**Props:**
```typescript
{
  route: Order[]
  currentIndex: number
  completedIds: Set<string>
}
```

**תכונות:**
- **MapContainer** עם bounds אוטומטי
- **TileLayer** מ-OpenStreetMap
- **Polyline** כחול המחבר את הנקודות
- **Markers ממוספרים:**
  - DivIcon מותאם אישית
  - צבעים: ירוק (completed), כחול (current), אפור (pending)
  - גודל: current גדול יותר (36px vs 30px)
  - תוכן: מספר (1-N) או ✓ להושלם
- **Popup** בלחיצה עם פרטי לקוח
- תמיכה ב-RTL (עברית)

**טכני:**
- תיקון אייקונים: `L.Icon.Default` עם CDN
- גיאוקודינג ברמת עיר (50+ ערים)
- Haversine distance calculation
- Fallback למרכז ברירת מחדל (תל אביב) אם אין קואורדינטות

---

## 🪝 Hooks

### `useOrders()`
**קובץ:** `/src/hooks/useOrders.ts`

- משיגה את **כל ההזמנות** מ-Airtable
- React Query:
  - `staleTime: 30s`
  - `refetchInterval: 60s`
  - `refetchOnWindowFocus: true`
- מחזירה: `{ data: Order[], isLoading, error, refetch }`

### `useUpdateOrder()`
**קובץ:** `/src/hooks/useUpdateOrder.ts`

- Mutation לעדכון הזמנה בודדת
- **Optimistic update** - עדכון מיידי לפני תשובת שרת
- Rollback במקרה של שגיאה
- Toast notifications (success/error)
- Invalidates `orders` query אחרי עדכון

### `useOrderStats(orders)`
**קובץ:** `/src/hooks/useOrderStats.ts`

- מחשבת סטטיסטיקה מנתוני הזמנות
- מחזירה:
```typescript
{
  total: number
  byOrderStatus: { waiting, outOfStock, delivered }
  byWorker: Record<string, number>
  byStatus: { todo, inProgress, done }
  uniqueCities: string[]
  todayCount: number
  thisWeekDelivered: number
}
```

### `useRouteRecommendations(orders)`
**קובץ:** `/src/hooks/useRouteRecommendations.ts`

- מחזירה **עד 3 המלצות עיר** לתכנון מסלול
- **פילטר:** "ממתין לתאום" או "תואמה אספקה" + יש כתובת
- **ניקוד:** `oldCount × 3 + cityCount × 1 + oldestDays × 0.5`
- **סדר:** לפי ניקוד יורד

### `useTomorrowCoordinationRecommendations(orders)` (מיושן)
**קובץ:** `/src/hooks/useTomorrowCoordinationRecommendations.ts`

- דומה ל-`useRouteRecommendations` אבל **רק** "ממתין לתאום"
- אותו חישוב ניקוד
- **הוחלף ב-`useRouteOptimizer`** במימוש החדש

### `useRouteOptimizer(orders, targetCount, startingAddress?)` ⭐⭐
**קובץ:** `/src/hooks/useRouteOptimizer.ts`

- **אלגוריתם אופטימיזציה גיאוגרפית** למסלולים
- **לוגיקה:**
  1. סינון: רק "ממתין לתאום" + כתובת + עיר
  2. ניקוד: `(oldCount × 3) + (days × 0.5)`
  3. גיאוקודינג: המרה לקואורדינטות (רמת עיר)
  4. Greedy Nearest-Neighbor:
     - התחל עם הזמנה בעלת ציון גבוה
     - בכל שלב: בחר הקרובה ביותר (Haversine distance)
     - המשך עד N הזמנות
- **מחזיר:**
```typescript
{
  orders: Order[]          // הזמנות בסדר אופטימלי
  totalDistance: number    // סה"כ מרחק בק"מ
  hasGeocoding: boolean    // האם הצליח גיאוקודינג
}
```
- **Optimization:** `useMemo()` עם תלות ב-`[orders, targetCount, startingAddress]`

### `useDeliverableOrders()`
**קובץ:** `/src/hooks/useDeliverableOrders.ts`

- משיגה הזמנות עם סטטוס **"תואמה אספקה"** בלבד
- מקבצת לפי עיר, sorted לפי כמות
- מחזירה:
```typescript
{
  deliverable: Order[]
  cityGroups: { city: string, orders: Order[] }[]
  isLoading, error, totalOrders
}
```

---

## 📄 Pages

### `DashboardPage` (/)
**קובץ:** `/src/pages/DashboardPage.tsx`

**תצוגה:**
1. `StaleOrdersAlert` - אזהרה על הזמנות ישנות
2. `RouteRecommendation` - המלצות מסלול להיום
3. `TomorrowCoordinationDialog` - המלצות לתיאום מחר ⭐
4. `StatsCards` - 4 כרטיסי סטטיסטיקה
5. Charts Grid - `DailyOrdersChart` + `HealthFundChart`
6. Filters + Table - `OrderFilters` + `OrdersTable`

**State:**
- filters: `{ search, orderStatus, worker, city }`

### `RoutePlannerPage` (/routes)
**קובץ:** `/src/pages/RoutePlannerPage.tsx`

**Layout:**
- **Left Panel (2/3):** `RouteCityGroups` - רשימת ערים עם checkboxes
- **Right Panel (1/3):** `RouteSelectedPanel` - sidebar sticky

**State:**
- `selectedIds: Set<string>` - IDs של הזמנות נבחרות

**Pre-selection:**
- אם נכנסים מ-`RouteRecommendation` עם `state.preSelectCity`, בוחר אוטומטית את כל ההזמנות של העיר

---

### `RouteNavigationPage` (/route-navigation) ⭐⭐ **חדש!**
**קובץ:** `/src/pages/RouteNavigationPage.tsx`

**מטרה:** דף ניהול מסלול משלוחים במהלך הנסיעה

**Layout:**
- **Left Side (מפה):** `MapView` - מפה אינטראקטיבית עם Leaflet
- **Right Side (פאנל):** תצוגה דינמית עם 2 מצבים

**מצב 1: ניווט (Navigation Mode)**
- **Current Order Card:**
  - פרטי לקוח: שם, כתובת, טלפון
  - כפתורים: פתח ב-Waze, פתח ב-Google Maps
  - כפתור "סיימתי - הבא" (ירוק)
  - ניווט: הקודם / הבא
- **Orders List:**
  - כל ההזמנות במסלול
  - סימון ויזואלי: completed (ירוק ✓), current (כחול), pending (אפור)
  - clickable - קפיצה להזמנה
- **Progress Bar:** X/Y הושלמו
- **כפתור "ערוך מסלול"** ⭐

**מצב 2: עריכה (Edit Mode)** ⭐⭐
- **Header:** כפתורים "שמור" ו-"ביטול"
- **המסלול שלי:**
  - `DraggableRouteList` - drag & drop לשינוי סדר
  - מחיקת הזמנות
  - מספור אוטומטי
- **הוסף הזמנות:**
  - `AvailableOrdersPanel` - חיפוש והוספה
  - סינון אוטומטי של הזמנות שכבר במסלול
- **עדכון המפה בזמן אמת** במהלך עריכה

**State Management:**
```typescript
const [routeOrders, setRouteOrders] = useState<Order[]>(initialRoute)
const [currentIndex, setCurrentIndex] = useState(0)
const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
const [isEditMode, setIsEditMode] = useState(false)
const [tempRoute, setTempRoute] = useState<Order[]>(routeOrders)
```

**Logic חכם:**
- `handleSaveEdit()` - שומר שינויים + עוקב אחרי current order (לפי ID)
- `handleCancelEdit()` - מבטל שינויים (tempRoute → routeOrders)
- `handleAddOrder()` - מוסיף הזמנה מ-Airtable
- `handleRemoveOrder()` - מסיר הזמנה מהמסלול
- `handleComplete()` - מסמן הזמנה כהושלמה
- `handleOpenWaze()` / `handleOpenGoogleMaps()` - פתיחת אפליקציות ניווט

**Entry Point:**
- נכנסים מ-`RouteExportStep` (שלב 4 של wizard)
- מעביר `route` + `routeName` ב-navigation state

---

## 🔧 Lib & Utils

### `airtable.ts`
**קובץ:** `/src/lib/airtable.ts`

**פונקציות:**
- `fetchAllOrders()` - משיגה כל ההזמנות עם pagination אוטומטי
- `updateOrder(recordId, fields)` - עדכון הזמנה בודדת
- `updateMultipleOrders(records)` - batch update (עד 10)
- `mapRecord(record)` - Airtable record → `Order` interface
  - **חשוב:** משתמש ב-`record.createdTime` (שדה מובנה של Airtable) במקום שדה "Created" ידני
  - זה מבטיח תאריכים מדויקים ואוטומטיים
- `mapFieldsToAirtable(fields)` - English → Airtable Hebrew fields

### `constants.ts`
**קובץ:** `/src/lib/constants.ts`

**קבועים:**
- `FIELD_MAP` - מיפוי שדות Airtable (עברית → אנגלית)
- `REVERSE_FIELD_MAP` - אנגלית → עברית
- `ORDER_STATUS_OPTIONS` - [ממתין לתאום, תואמה אספקה, איו במלאי, סופק]
- `TASK_STATUS_OPTIONS` - [Todo, In progress, Done]
- `CUSTOMER_STATUS_OPTIONS` - [לקוח חדש, לקוח קיים]
- `WORKERS` - ['שורה', 'אילונה']

### `utils.ts`
**קובץ:** `/src/lib/utils.ts`

**פונקציות:**
- `cn(...inputs)` - merge Tailwind classes (clsx + twMerge)
- `getDaysSinceCreated(created)` - חישוב ימים מאז יצירה
- `getDaysColor(days)` - צבע לפי גיל:
  - ירוק: 0-3 ימים
  - כתום: 4-7 ימים
  - אדום: 8+ ימים

### `maps.ts`
**קובץ:** `/src/lib/maps.ts`

**פונקציות:**
- `buildSingleMapUrl(order)` - Google Maps search URL לכתובת
- `buildRouteUrl(orders, originAddress?)` - Google Maps directions URL
  - Format: `origin → waypoint1 | waypoint2 → destination`
  - **מגבלה:** עד 11 עצירות (1 origin + 9 waypoints + 1 destination)

**קבועים:**
- `MAX_GOOGLE_MAPS_STOPS = 11`

---

### `geocoding.ts` ⭐
**קובץ:** `/src/lib/geocoding.ts`

**מטרה:** גיאוקודינג ברמת עיר (ללא API, חינמי)

**פונקציות:**
- `geocodeOrderByCity(order)` - המרת Order ל-GeocodedOrder עם קואורדינטות
- `calculateDistance(coord1, coord2)` - נוסחת Haversine למרחק בק"מ

**Types:**
```typescript
interface Coordinates {
  lat: number
  lng: number
}

interface GeocodedOrder extends Order {
  coordinates?: Coordinates
}
```

**ערים נתמכות:** 50+ ערים ישראליות:
- מרכז: תל אביב, רמת גן, פתח תקווה, נתניה, הרצליה...
- דרום: באר שבע, אשדוד, אשקלון...
- צפון: חיפה, נהריה, כרמיאל, עפולה...

---

### `export.ts` ⭐
**קובץ:** `/src/lib/export.ts`

**פונקציות:**
- `exportRouteToCSV(orders, filename?)` - ייצוא מסלול לקובץ CSV

**תכונות:**
- תמיכה בעברית (BOM: `\ufeff`)
- עמודות: מספר, שם לקוח, טלפון, כתובת, עיר, סטטוס, ימים מאז יצירה
- שם קובץ: `route-YYYY-MM-DD.csv`
- Download אוטומטי לתיקיית ההורדות

---

## 🎯 פיצ'רים עיקריים

### 1. דשבורד הזמנות
- תצוגה כללית של כל ההזמנות
- סטטיסטיקה real-time:
  - סה"כ פתוחות
  - ממתין לתאום
  - אין במלאי
  - סופקו השבוע
- תרשימים:
  - Daily Orders Distribution (14 ימים)
  - Health Fund Distribution (pie chart)

### 2. ניהול הזמנות
- טבלה interactive:
  - Sorting (כל עמודה)
  - Searching (שם, טלפון)
  - Filtering (סטטוס, עובד, עיר)
- עדכון סטטוס בזמן-אמת (dropdown בטבלה)
- Dialog עם פרטים מלאים + מסמכים
- Responsive (table → cards במובייל)

### 3. המלצות מסלול (Route Recommendations)
- אלגוריתם חכם:
  - עדיפות להזמנות ותיקות (7+ ימים): משקל 3
  - עדיפות לריכוז גיאוגרפי: משקל 1
  - עדיפות לגיל ההזמנה הוותיקה: משקל 0.5
- TOP 3 ערים מומלצות
- כפתור "צור מסלול" → ניווט מהיר ל-RoutePlannerPage

### 4. אופטימיזציית מסלולים חכמה ⭐⭐ (מתקדם!)
**"המלצות לתיאום מחר"** - Wizard רב-שלבי

**Workflow מלא:**
1. **קלט:** בחירת כמות נקודות (5 ברירת מחדל) + כתובת התחלה אופציונלית
2. **אופטימיזציה:**
   - אלגוריתם Greedy Nearest-Neighbor
   - גיאוקודינג ברמת עיר (50+ ערים)
   - נוסחת Haversine למרחקים
   - ניקוד לפי גיל הזמנה וריכוז גיאוגרפי
3. **עריכה:**
   - Drag & Drop לשינוי סדר (@dnd-kit)
   - הוספה/הסרה של הזמנות
   - חיפוש וסינון (שם, עיר, כתובת)
   - קיבוץ לפי עיר
4. **ייצוא:**
   - CSV להורדה (תמיכה בעברית)
   - Google Maps URL (עד 11 עצירות)
   - **ניווט במערכת** ← כפתור חדש!

**יתרונות:**
- שליטה מלאה במסלול
- אופטימיזציה גיאוגרפית אמיתית
- גמישות (drag & drop, הוסף/הסר)
- ייצוא נוח (CSV, Maps)

### 5. תכנון מסלול (Route Planner)
- בחירת הזמנות מוכנות למשלוח ("תואמה אספקה")
- Grouping לפי עיר
- Multi-selection עם checkboxes
- Sidebar עם סיכום:
  - מספר הזמנות נבחרות
  - רשימה ממוספרת
- Integration עם Google Maps:
  - Single address links
  - Multi-stop route (עד 11 עצירות)

### 6. ניהול מסלול בזמן אמת ⭐⭐ **חדש!**
**`RouteNavigationPage`** - דף ניווט אינטראקטיבי

**תכונות מרכזיות:**
- **מפה חיה:**
  - Leaflet + OpenStreetMap
  - Markers ממוספרים (1-N)
  - הדגשת עצירה נוכחית (כחול, גדול יותר)
  - סימון עצירות שהושלמו (ירוק עם ✓)
  - קו מחבר בין כל הנקודות
  - Popup עם פרטי לקוח בלחיצה

- **פאנל ניווט:**
  - Current Order Card: פרטי לקוח, כתובת, טלפון
  - כפתורי ניווט: Waze, Google Maps (פתיחת אפליקציה)
  - כפתור "סיימתי - הבא"
  - Progress bar (X/Y הושלמו)
  - רשימת כל ההזמנות עם סטטוס

- **מצב עריכה:**
  - לחיצה על "ערוך מסלול" ← מעבר למצב עריכה
  - Drag & Drop לשינוי סדר
  - הוספה/הסרה של הזמנות (מ-Airtable)
  - המפה מתעדכנת בזמן אמת
  - שמירה/ביטול שינויים
  - Logic חכם: currentIndex עוקב אחרי אותו לקוח גם אחרי שינויים

**Use Cases:**
- נהג משתמש בזה במהלך הנסיעה
- אפשר לשנות סדר בזמן אמת (תנועה, זמינות לקוח)
- פתיחה מהירה של Waze/Maps לכל כתובת
- מעקב התקדמות ויזואלי

---

## 📊 Types

### `Order` Interface
**קובץ:** `/src/types/order.ts`

```typescript
interface Order {
  id: string                    // Airtable record ID
  customerName: string          // שם הלקוח
  phone?: string                // טלפון
  customerStatus?: 'לקוח חדש' | 'לקוח קיים'
  status?: 'Todo' | 'In progress' | 'Done'
  orderStatus?: 'ממתין לתאום' | 'תואמה אספקה ' | 'איו במלאי' | 'סופק'
  healthFund?: string           // קופת חולים
  openedBy?: string             // עובד שפתח (שורה / אילונה)
  fax?: string
  address?: string              // כתובת
  city?: string                 // עיר
  agent?: string                // סוכן
  documents?: AirtableAttachment[]
  created: string               // ISO timestamp
}
```

### `OrderStats` Interface
```typescript
interface OrderStats {
  total: number
  byOrderStatus: {
    waiting: number
    outOfStock: number
    delivered: number
  }
  byWorker: Record<string, number>
  byStatus: {
    todo: number
    inProgress: number
    done: number
  }
  uniqueCities: string[]
  todayCount: number
  thisWeekDelivered: number
}
```

---

## 🔐 אבטחה

- **API Key בסביבה:** משתמשים ב-`.env` ולא commit מידע רגיש
- **Client-side only:** כל הקריאות ל-Airtable מהצד של הלקוח
- **Vercel Environment Variables:** הגדר את המשתנים ב-Vercel Dashboard

---

## 🎨 עיצוב

- **RTL Support:** כל הפרויקט בעברית מימין לשמאל
- **Responsive Design:**
  - Desktop: layouts רחבים, טבלאות מלאות
  - Tablet: 2 columns → 1 column
  - Mobile: cards במקום טבלאות
- **Accessibility:**
  - Shadcn/ui + Radix UI מספקים נגישות מובנית
  - Keyboard navigation
  - Screen reader friendly

---

## 📝 הערות לפיתוח

### React Query Caching
- `staleTime: 30s` - נתונים נשארים "טריים" ל-30 שניות
- `refetchInterval: 60s` - רענון אוטומטי כל דקה
- `refetchOnWindowFocus: true` - רענון כשחוזרים לחלון

### Optimistic Updates
- עדכון הזמנות מיידי לפני תשובת שרת
- Rollback במקרה של שגיאה
- Toast notifications למשוב למשתמש

### TypeScript Strict Mode
- הפרויקט ב-`strict: true`
- ממליץ להשתמש ב-types מפורשים
- `eslint` מוגדר לזהות בעיות

### Tailwind + Shadcn
- משתמשים ב-`cn()` utility למיזוג classes
- Shadcn components ב-`/components/ui/`
- ניתן להתאים ב-`tailwind.config.js`

### Drag & Drop (@dnd-kit)
- Keyboard accessible
- Touch support
- Smooth animations עם CSS transforms
- `arrayMove()` utility לשינוי סדר

### Maps (Leaflet)
- Import CSS ב-`main.tsx`: `import 'leaflet/dist/leaflet.css'`
- תיקון אייקונים: fix ל-`L.Icon.Default` עם CDN URLs
- Tiles מ-OpenStreetMap (חינמי)
- `DivIcon` למספור מותאם אישית

---

## 🐛 Debugging

### בעיות נפוצות:

**שגיאת Airtable API:**
- בדוק שה-PAT תקף ב-`.env`
- וודא שיש הרשאות `data.records:read` ו-`data.records:write`
- בדוק ש-BASE_ID ו-TABLE_ID נכונים

**הזמנות לא מתעדכנות:**
- פתח DevTools → Network → בדוק בקשות ל-Airtable
- בדוק React Query DevTools (אם מותקן)
- נסה לרענן ידנית עם כפתור הרענון

**Build נכשל:**
```bash
npm run build
# בדוק שגיאות TypeScript
npm run lint
# תקן שגיאות linting
```

---

## 🤝 תרומה

1. צור branch חדש:
```bash
git checkout -b feature/my-feature
```

2. עשה שינויים וcommit:
```bash
git add .
git commit -m "Add: My new feature"
```

3. דחוף ל-GitHub:
```bash
git push origin feature/my-feature
```

4. פתח Pull Request ב-GitHub

---

## 📞 תמיכה

- **בעיות טכניות:** פתח Issue ב-GitHub
- **שאלות:** צור Discussion ב-GitHub
- **דחוף:** צור קשר עם מנהל הפרויקט

---

## 📜 רישיון

הפרויקט הוא פרטי ומיועד לשימוש פנימי בלבד.

---

## 🎉 תודות

- **Shadcn/ui** - קומפוננטות UI מעוצבות
- **Radix UI** - primitives נגישים
- **TanStack Query** - ניהול state מתקדם
- **Recharts** - תרשימים יפים
- **@dnd-kit** - Drag & Drop נגיש ומהיר
- **Leaflet** - מפות אינטראקטיביות open-source
- **OpenStreetMap** - נתוני מפות חינמיים

---

## 🚀 עדכונים אחרונים

### 12/02/2026 - מעבר לבסיס Airtable חדש ⭐
- **עדכון חיבור:** מעבר מבסיס `appppG6raO3MzBku0` לבסיס חדש `appe17N3EbbGYogGK`
- **תיקון תאריכים:** שימוש ב-`createdTime` המובנה של Airtable במקום שדה Created ידני
  - מבטיח תאריכים מדויקים אוטומטיים
  - פתרון לבעיית תאריכים שגויים (-293 ימים, -79 ימים)
- **תיקון גרף יומי:** תיקון השוואת תאריכים ב-`DailyOrdersChart`
  - הוספת extraction של חלק התאריך מ-ISO timestamp
  - הגרף עכשיו מציג נכון את כמות ההזמנות ליום
- **ניקוי קוד:**
  - הסרת console.log זמניים מ-`utils.ts`
  - הסרת מיפוי "Created" מיותר מ-`constants.ts`
- **עדכון Vercel:** משתני סביבה חדשים + PAT עם הרשאות מלאות

### 11/02/2026 - ניהול מסלולים מתקדם

### אופטימיזציית מסלולים ⭐⭐
- Wizard רב-שלבי (4 שלבים) ל"המלצות לתיאום מחר"
- אלגוריתם Greedy Nearest-Neighbor לאופטימיזציה גיאוגרפית
- גיאוקודינג ברמת עיר (50+ ערים ישראליות)
- Drag & Drop לעריכת מסלולים
- חיפוש והוספת הזמנות בזמן אמת

### ניהול מסלול בזמן אמת ⭐⭐
- דף RouteNavigationPage עם מפה אינטראקטיבית
- Markers ממוספרים עם הדגשת עצירה נוכחית
- אינטגרציה עם Waze/Google Maps (פתיחת אפליקציה)
- מצב עריכה: drag & drop + הוסף/הסר הזמנות
- עדכון מפה בזמן אמת במהלך עריכה
- Logic חכם: currentIndex עוקב אחרי לקוח גם אחרי שינויים

### קומפוננטות חדשות
- 6 קומפוננטות wizard: Quantity, Proposal, Adjustment, Export, DraggableList, AvailableOrders
- MapView עם Leaflet: markers, polyline, popup, geocoding
- DraggableRouteList עם @dnd-kit: keyboard + touch support

### Libraries חדשות
- `@dnd-kit` (core, sortable, utilities) - Drag & Drop
- `leaflet` + `react-leaflet` - מפות
- `@types/leaflet` - TypeScript support

---

**עודכן לאחרונה:** 12 בפברואר 2026
**מפתחים:** צוות Rashal + Claude Code

---

## 📌 Troubleshooting

### בעיות חיבור ל-Airtable
אם הדשבורד לא טוען נתונים:
1. בדוק שה-PAT תקף ב-`.env` (ו-Vercel)
2. ודא שה-PAT מחובר לבסיס `appe17N3EbbGYogGK`
3. ודא הרשאות: `data.records:read`, `data.records:write`, `schema.bases:read`
4. נסה ליצור PAT חדש אם יש בעיה

### תאריכים לא נכונים
אם התאריכים מוצגים באופן שגוי:
- הקוד אמור להשתמש ב-`record.createdTime` אוטומטית
- ודא שקובץ `airtable.ts` עדכני (commit eb865e2 ומעלה)
