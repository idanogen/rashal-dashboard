# תוכנית יישום: מסך "איסופים" (Priority `DOCUMENTS_N` + `TRANSORDER_N`)

> נכתב: 08/07/2026 · רוני (מומחה Priority) + עידן
> סטטוס: **🟢 קוד מלא נבנה (08/07) — DB חי, שכבת נתונים, endpoint, ומסך `/pickups` מלא. build עובר. נותר: פריסה + תרחיש Make.**
> נשען על: [`SYNC-PULL-PLAN.md`](./SYNC-PULL-PLAN.md) (תשתית ה-pull החיה) · בית הידע של רוני

---

## 1. מה זה, ואיך זה מתחבר למה שכבר יש

**איסופים** = מסך חדש למערכת. המקור בפריוריטי:
- **`DOCUMENTS_N`** — מסמך האב (איסוף). זה ה-DOCUMENTS_x השלישי שאנחנו מושכים אצל רשל, אחרי:
  - `DOCUMENTS_Q` = קריאות שירות (כבר חי)
  - (וגם `DOCUMENTS_p` = פרויקטים אצל MetalPress — אותו דפוס בדיוק)
- **`TRANSORDER_N`** — מסך-בן (שורות/פירוט האיסוף).

**השערה עסקית (לאימות):** רשל מספקת ציוד רפואי ומנופים, ואיסוף = החזרת ציוד מהלקוח למחסן. זה מתאים ל-`TRANSORDER` שהיא ישות "העברה בין מחסנים" בפריוריטי — כלומר `DOCUMENTS_N` הוא כותרת האיסוף ו-`TRANSORDER_N` הן שורות הפריטים שחוזרים. **זו השערה — שלב 0 מאמת.**

**המזל שלנו:** תשתית ה-pull כבר חיה בפרודקשן (04/07). לא בונים מאפס:
```
Make (חשבון רשל, org Mishal, eu2) --GET OData--> Priority Connect (shaal)
        |
        +--POST upsert--> api/priority-sync.ts (Vercel) --> Supabase
```
מוסיפים ישות אחת לזרימה קיימת + טבלה + מסך. זהו.

---

## 2. שלב 0 — גילוי סכימה ✅ הושלם (08/07, אומת חי מול shaal)

הגילוי רץ דרך תרחיש הבדיקה `OGEN - test-priority-pull` (9478112) בחשבון ה-Make של רשל, GET קריאה-בלבד עם keychain 195591 → כתיבה ל-`sync_debug`. (הוחזר למצב מקורי + כובה בסיום.)

**מה `DOCUMENTS_N` באמת:** מסמך **החזרה/איסוף ציוד** (DOCNO בפורמט `RT...`, `TYPE='N'`), העברה למחסן. מקושר להזמנת מקור (`ORDNAME`) ולתעודת משלוח (`ODOCNO`). ההשערה אושרה.

**המסך-בן `TRANSORDER_N`:** ב-Priority זה שם המסך, אבל **ב-OData הוא לא ישות עצמאית (404) ולא nav-property בשם הזה**. הוא **subform של `DOCUMENTS_N` בשם `TRANSORDER_N_SUBFORM`** (התגלה דרך `$expand=*`; היה חסום ל-API עד שעידן פתח אותו ידנית ב-08/07). כלומר משיכה אחת עם `$expand` מביאה אב+בן יחד.

**כל תת-הטפסים של `DOCUMENTS_N`** (מ-`$expand=*`): `TRANSORDER_N_SUBFORM` (שורות), `DOCUMENTS_DCONT_SUBFORM` (כתובת+טלפון!), `DOCUMENTSTEXT_SUBFORM`, `INTERNALDIALOGTEXT_SUBFORM`, `EXTFILES_SUBFORM`, `DOCTODOLISTLOG_SUBFORM` (לוג סטטוס), ועוד.

### שדות שאומתו — האב `DOCUMENTS_N`
| שדה | ערך לדוגמה | תפקיד |
|------|-----------|--------|
| `DOCNO` | `RT2601396` | **מפתח טבעי** (string) |
| `DOC` | `303664` | מפתח מספרי חלופי (int) |
| `UDATE` | `2026-07-08T09:17:00Z` | **שדה דלתא — גרנולריות דקה** (DateTimeOffset, בלי גרשיים) |
| `STATDES` | `טיוטא` / `סופית` | **סטטוס** (קיים כאן, בניגוד ל-ORDERS!) |
| `CUSTNAME` | `31200451` | מספר לקוח |
| `CDES` | `בוהדנה דניאל` | שם לקוח |
| `CURDATE` | `2026-07-08T00:00:00Z` | תאריך מסמך (יום) |
| `ORDNAME` | `SO2504408` | הזמנת מקור |
| `ODOCNO` | `SH2602184` | תעודת משלוח מקושרת |
| `REFERENCE` | `25PO14715` | אסמכתא |
| `TOWARHSDES` | `מחסן ראשי` | מחסן יעד (לאן אוספים) |
| `AGENTNAME` / `OWNERLOGIN` | `אבי דוראב` / `יעל` | סוכן / אחראי |
| `TOTQUANT` / `TOTPRICE` | `1` / `33058` | כמות/סכום כולל |

### שדות שאומתו — הבן `TRANSORDER_N_SUBFORM` (שורות האיסוף)
| שדה | ערך לדוגמה | תפקיד |
|------|-----------|--------|
| `TRANS` | `609743` | **מפתח שורה** (int) |
| `KLINE` | `1` | מספר שורה במסמך |
| `PARTNAME` | `R-TRAK` | מק"ט |
| `PDES` | `כסא גלגלים ממונע דגם R-TRAK` | תיאור פריט |
| `TQUANT` / `QUANT` | `1` | כמות |
| `TUNITNAME` | `יח'` | יחידה |
| `BARCODE` | `R-TRAK` | ברקוד |
| `ORDNAME` + `OLINE` | `SO2504408` + `1` | שורת הזמנת מקור |
| `RETREASONDES` | null | סיבת החזרה |
| `PRICE` / `QPRICE` | `28015.25` | מחיר |

### שדות שאומתו — כתובת `DOCUMENTS_DCONT_SUBFORM` (⭐ ליומן/מפה)
| שדה | ערך לדוגמה | תפקיד |
|------|-----------|--------|
| `ADRS` | `ת.ד. 565 העליה 58 א` | כתובת |
| `STATE` | `נהריה` | עיר |
| `PHONE` | `04-9923905` | טלפון |
| `FAX` | `050-6857576` | פקס |
| `DOCNO` | `RT2601396` | קישור לאב |

**מסקנה למשיכה:** קריאה אחת מביאה הכל —
`GET DOCUMENTS_N?$filter=UDATE ge {since}&$expand=TRANSORDER_N_SUBFORM,DOCUMENTS_DCONT_SUBFORM`
(אב + שורות + כתובת/טלפון). אין צורך בהעשרה מ-`priority_customers` — הכתובת של המסמך יושבת ב-DCONT.

---

## 3. שלב 1 — DB

שדות אמיתיים משלב 0. **השורות נשמרות כ-`jsonb` על שורת האב** (כמו `orders.items`) — הן תמיד מגיעות ביחד עם האב ב-`$expand`, אין צורך בטבלה נפרדת.
```sql
CREATE TABLE public.pickups (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  priority_pickup_id text,          -- DOCNO (RT...) — מפתח טבעי
  priority_doc       int,           -- DOC (מזהה מספרי)
  customer_number    text,          -- CUSTNAME
  customer_name      text,          -- CDES
  phone text, address text, city text,   -- מ-DOCUMENTS_DCONT_SUBFORM
  status             text,          -- STATDES (טיוטא/סופית/...)
  pickup_date        date,          -- CURDATE
  source_order       text,          -- ORDNAME (הזמנת מקור)
  delivery_note      text,          -- ODOCNO
  reference          text,          -- REFERENCE
  to_warehouse       text,          -- TOWARHSDES
  agent text, opened_by text,       -- AGENTNAME / OWNERLOGIN
  total_qty numeric, total_price numeric,
  lines              jsonb,         -- TRANSORDER_N_SUBFORM → [{trans,kline,part,desc,qty,unit,barcode,ret_reason}]
  priority_udate     timestamptz,   -- UDATE — watermark לדלתא
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX pickups_priority_id_key ON public.pickups (priority_pickup_id) WHERE priority_pickup_id IS NOT NULL;
```
- **watermark חדש:** מפתח `pickups` בטבלת `sync_state` (fallback 90 יום כמו השאר).
- **RLS + realtime** כמו שאר הטבלאות (policy `authenticated`, publication `supabase_realtime`).
- **חוזה בעלות על עמודות** (קריטי, כמו ב-SYNC-PULL-PLAN §4.2): ב-UPDATE מפריוריטי לעדכן **רק** שדות שפריוריטי הבעלים שלהם. שדות תפעוליים שהמשתמש עורך (שיבוץ/סטטוס פנימי) — לעולם לא לדרוס. הגנה **פר-שדה**, לא חסימת שורה גורפת (לקח MetalPress 3.7).

---

## 4. שלב 2 — Types + lib + hooks (reuse מלא של הדפוסים הקיימים)

מראה מדויק של `orders` / `service_calls` / `cranes`:
- `src/types/pickup.ts` — `Pickup`, `PickupLine`, סטטוסים.
- `src/lib/pickups.ts` — `fetchAllPickups` (עם `.range()` pagination — **מלכודת ה-1,000 של PostgREST הכתה כבר פעמיים בפרויקט הזה**), `updatePickup`.
- `src/hooks/usePickups.ts` (+ `useUpdatePickup`, ואם רלוונטי `useZonedPickups`/`useDedupedPickups`).

---

## 5. שלב 3 — סנכרון (הרחבת התשתית החיה)

1. **`api/priority-sync.ts`** — להוסיף טיפול בישות pickups: watermark ב-GET, upsert ב-POST (עם חוזה הבעלות + אימוץ אם צריך).
2. **Make** — **לא בונים תרחיש ביד** (לקח נצרב: ~11 ניסיונות כושלים). **משכפלים את תרחיש ה-pull הקיים** (`9479125`) ומוסיפים 2 מודולים: `GET DOCUMENTS_N?$filter=UDATE ge {since}&$expand=TRANSORDER_N_SUBFORM,DOCUMENTS_DCONT_SUBFORM` (אב+שורות+כתובת בקריאה אחת) + `POST` ל-`/api/priority-sync?kind=pickups`.
3. מלכודות Make שכבר מטופלות: User-Agent חובה · רווח ב-`$filter` = `%20` · `timeout: 120` · אצוות 200 · אחרי כל PATCH ל-scenario: `name` → `/start` → אימות `nextExec`.
4. **backfill** חד-פעמי בהתחלה (X ימים אחורה לפי שדה הדלתא/CREATEDDATE).

---

## 6. שלב 4 — UI (מסך "איסופים")

- `src/pages/PickupsPage.tsx` + route `/pickups` + לינק ב-`AppHeader` ("📦 איסופים" או אייקון מתאים).
- טבלה responsive (table/cards) בסגנון `OrdersTable`/`ServiceCallsTable`: שם לקוח + מס' לקוח + טלפון + עיר + סטטוס + תאריך.
- `PickupDetailDialog` — פרטי האב **+ רשימת שורות `TRANSORDER_N`** (המסך-בן) בתוך הדיאלוג.
- חיפוש (שם/מס' לקוח/טלפון) + סינון סטטוס, reuse מהמסכים הקיימים.
- אפשר צ'אט פר-רשומה (`timeline_events`) כמו בהזמנות/קריאות, אם רוצים.

---

## 7. 🔴 החלטת סקופ פתוחה (משפיעה מהותית על הגודל)

**✅ הוחלט (08/07): גם משובץ ביומן** (כמו משלוחים/קריאות שירות). נהג נשלח לאסוף ציוד ביום מסוים.
- דורש הרחבת `calendar_stops.source_type` לערך `'pickup'` (כמו שהוכן `'inspection'`) + FK `pickup_id` (עמודה חדשה, עדכון ה-CHECK constraint) + חיבור לכל זרימת הגרירה / DriverSelector / DragOverlay / מפה / מיון-לפי-שעה.
- reuse מלא: `useScheduleStop` / `useResolveStop` / `useDeleteStop` / `useReorderStops` כבר polymorphic — צריך רק שיכירו ב-`source_type='pickup'`.
- אייקון מקור חדש ביומן (📦 משלוח / 🔧 שירות / 📋 משימה → צריך אייקון לאיסוף).

---

## 8. סדר עבודה — מצב ביצוע (08/07)

0. ✅ **גילוי סכימה** — הושלם (§2).
1. ✅ עדכון התוכנית + החלטת הסקופ (משובץ ביומן).
2. ✅ **DB** — טבלת `pickups` + `calendar_stops.pickup_id` + source_check. **חי ב-Supabase.** migration: `supabase/migrations/20260708_pickups_documents_n.sql`.
3. ✅ **Types + lib + hooks** — `types/pickup.ts`, `lib/pickups.ts`, `usePickups`, `useUpdatePickup`.
4. ✅ **חוזה בעלות + חיבור יומן** — `useScheduleStop`/`useResolveStop`/`useDeleteStop` מסנכרנים `pickup_status`; calendar-stops lib מכיר `pickup_id`.
5. ✅ **סנכרון (endpoint)** — `api/priority-sync.ts` `kind=pickups` (watermark `UDATE` + upsert + מיפוי שורות/כתובת). **טרם נפרס.**
6. ✅ **UI** — `pages/PickupsPage.tsx` + `components/pickups/{UnscheduledPickups,PickupDetailDialog}` + לינק "איסופים" + route `/pickups` + אייקון `Undo2` טורקיז ביומן/מפה/דשבורד-נהג. `build` עובר נקי.
7. ✅ 3 איסופים אמיתיים הוזנו לטבלה (RT2601396/5/4) — המסך מדגים מיד.

### נותר (דורש אישור — פעולות פרודקשן/קרדיטים)
- **פריסה ל-Vercel** — כדי שה-endpoint יגיש `kind=pickups`.
- **תרחיש Make** — שכפול תרחיש ה-pull הקיים + הוספת `GET DOCUMENTS_N?$expand=...` + `POST kind=pickups`, backfill, והחלטת תדירות (מודעות לתקציב הקרדיטים).

---

## 9. פתוח / לאמת
- ✅ ~~`DOCUMENTS_N` חשוף~~ — כן. ~~`TRANSORDER_N`~~ — subform `TRANSORDER_N_SUBFORM` (עידן פתח ל-API 08/07).
- ✅ ~~מפתח/דלתא/סטטוס/שדות~~ — אומתו (§2).
- ✅ ~~subform או ישות נפרדת~~ — subform דרך `$expand`.
- ✅ ~~החלטת §7~~ — משובץ ביומן.
- **פתוח:** האם pull של DOCUMENTS_N פולט כפילויות (כמו ORDERS) → אם כן, אותו מנגנון אימוץ/`duplicate_of`. לאמת בריצת ה-backfill.
- **פתוח:** אילו ערכי `STATDES` קיימים (ראינו טיוטא/סופית) — למפות לתצוגה/סינון. למשוך `$select=STATDES` distinct בריצה ראשונה.
- **פתוח:** האם לשבץ ביומן רק איסופים בסטטוס מסוים (למשל לא "טיוטא")? החלטת מוצר לעידן.
