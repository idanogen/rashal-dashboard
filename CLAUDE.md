# [לקוח] Rashal Dashboard: דשבורד תפעולי לר.שעל ציוד רפואי

## זיהוי פרויקט
- **פרויקט:** rashal-dashboard · **נתיב:** `/Users/idanogen/Projects/rashal-dashboard`
- **סוג:** לקוח (ר.שעל ציוד רפואי) · **פריסה:** https://rashal-dashboard.vercel.app · **Dev:** http://localhost:3000
- **אתה עובד רק על הפרויקט הזה. אסור לשנות קבצים מחוץ לתיקייה הזו.**

## ⚠️ פרויקט לקוח: ר.שעל
- אסור לשתף קוד מהפרויקט הזה עם פרויקטים אחרים
- אסור לשנות בלי הוראה מפורשת מהמשתמש
- לוודא כל פעולה הרסנית (delete, reset, force push)
- לפני מסירה: `npm run build` לבד ובדיקת exit code (לא בתוך pipe), ו-`npm test`. אימות ויזואלי הוא צילום, לא "מתקמפל".

## 🔵 רוני: חלק מצוות הפרויקט הזה
הפרויקט נוגע ב-Priority ERP, לכן רוני בצוות כאן בכל סשן (סקיל גלובלי `roni-priority`).
- **לפני כיוון או שינוי שנוגע בפריוריטי:** היוועץ בבית הידע `~/Idan-HQ/knowledge/priority/` (לפחות `odata-api.md` + כרטיס ר.שעל ב-`clients.md`).
- **כל לקח חדש על פריוריטי** חוזר לבית הידע (`learnings.md` / `clients.md`). לא ללמוד פעמיים.
- **הקשר:** ר.שעל = חברת `shaal` על Priority Connect. הסנכרון רץ בקוד שלנו (`supabase/functions/rashal-sync`, pg_cron) מאז 04/08/2026, לא דרך Make. תוכנית המקור: `docs/SYNC-PULL-PLAN.md`.

## איפה מה
| מה | איפה |
|---|---|
| סטטוס שוטף, מה פתוח, מה נעשה היום | `STATUS.md` (המקור היחיד; רשומה חדשה מחליפה את הקודמת, לא נערמת) |
| היסטוריית השינויים המלאה עד 13/09/2026 | `archive/claude-history.md` |
| תיאור טכני מפורט (מסכים, רכיבים, hooks, טיפוסים) | `docs/ARCHITECTURE.md` |
| תוכניות ומסמכים טכניים | `docs/` (SYNC-PULL-PLAN · heyy-limits · heyy-setup · PICKUPS-PLAN · MAKE-MIGRATION-PLAN) |
| מסמכים ללקוח, דוחות, סיכומי פגישות | `~/Idan-HQ/meetings/rashal/` |
| ידע פריוריטי (כרטיס ר.שעל, לקחים, OData) | `~/Idan-HQ/knowledge/priority/{clients,learnings,odata-api}.md` |
| התוסף לכרום (חלונית וואטסאפ בתוך פריוריטי) | `~/Idan-HQ/company/wa-priority-rashal/` (ריפו ogen-wa-priority) |

## סטאק
React 19 · TypeScript 5.9 · Vite 7 · React Router 7 · Tailwind 4 + Shadcn/Radix · Lucide · @dnd-kit · Leaflet · TanStack Query 5 · Supabase (Postgres + Auth + Realtime + Storage + Edge Functions + pg_cron) · Recharts · Sonner · date-fns · xlsx.
פונקציות שרת ב-`api/` (Vercel, `tsconfig.api.json`, לא strict). בדיקות: `node --test` על `test/*.test.mjs` (53 קבצים).

## הגדרות סביבה
```env
VITE_SUPABASE_URL=https://kukstfxtznymfkirdmty.supabase.co
VITE_SUPABASE_ANON_KEY=<anon / publishable key>
VITE_GEO_SERVICE_URL=https://ogen-geo-service.vercel.app
```
- Supabase project `kukstfxtznymfkirdmty`, eu-central-1. משתני `VITE_*` נצרבים בזמן build: להגדיר ב-Vercel לפני deploy ולאמת שה-bundle מכיל אותם.
- Service Role Key לעולם לא בצד לקוח. סודות פריוריטי, heyy ו-Resend הם Edge Function secrets / Vercel env, לא בריפו.
- RLS מופעל בכל הטבלאות (כ-79 מדיניויות). תפקידים דרך `current_user_role()`, `is_admin_or_dispatcher()`, `is_management()`, `is_office_staff()`.

## הוראות הרצה
```bash
npm install && npm run dev      # http://localhost:3000
npm run build                   # tsc -b && vite build. להריץ לבד ולבדוק exit code
npm test                        # test/*.test.mjs
npx vercel --prod --yes         # פריסה
```
Edge Functions ב-`supabase/functions/` (rashal-sync · rashal-watchdog · rashal-surveys · rashal-morning-report · ...), מיגרציות ב-`supabase/migrations/`. כל טבלה שהקוד ניגש אליה חייבת קובץ מיגרציה (יש בדיקה). מיגרציה שהוחלה דרך כלי נשמרת כקובץ מיד.

## מבנה בקצרה
```
src/pages       Dashboard · Dispatch (/dispatch, מסך הסדרן המאוחד; /routes /service-calls /pickups מפנים אליו) · DriverDashboard (/driver)
                Customer (/customer) · Inbox · Collections (/collections, הנהלה) · Surveys · MorningReport · Inspections · Admin (users/team/permissions/wa-*)
src/components  dispatch/ (UnscheduledPanel, DispatchFilterBar, items) · deliveries/ (DeliveryCalendar, DayMapDialog, דיאלוגים) · customer/ · timeline/
                whatsapp/ · wa/ · crane/ · inspections/ · orders/ · service-calls/ · pickups/ · customers/ · management/ · ui/
src/hooks       React Query: useOrders · useServiceCalls · usePickups · useNewCustomers · useCalendarStops · useScheduleStop · useResolveStop
                useRescheduleStop · useDeleteStop · useAssignees · useRealtimeSync · useDeduped*
src/lib         supabase · orders · service-calls · calendar-stops · customers · geocoding · directions · perf · heyy/ · קבצים טהורים (בלי ייבוא) לבדיקות
src/types       order · service-call · calendar-stop · delivery · assignee · zone · crane
api/            פונקציות Vercel: wa-send · heyy-webhook · conversation · priority-context · priority-sync · priority-push · admin-users · survey · _lib/
supabase/       functions/ · migrations/ (83)
```

## מודל הנתונים בשורה
- מקור האמת לשיבוץ: `calendar_stops` (סוגים: delivery · service · pickup · task · customer · inspection). `orders.delivery_date` ריק ולא בשימוש. טבלת `routes`, `RouteBuilderDialog` ו-`useApproveRoute*` הם קוד מת.
- ישויות מפריוריטי: `orders` · `service_calls` · `pickups` · `priority_customers` · חשבוניות (CINVOICES). כולן נמשכות ב-`rashal-sync`.
- צוות השטח בטבלת `assignees` (לא בקוד). תפקידים: admin · management · team_manager · dispatcher · driver · view-only.
- וואטסאפ דרך heyy.io: `wa_conversations`, `whatsapp_messages_outbound/inbound`, סקרים ותורי שליחה.

## 🔴 מלכודות של הפרויקט (שורה לכל אחת, הסיפור המלא בארכיון)
### פריוריטי וסנכרון
- הסטטוס של פריוריטי הוא ערוץ הסגירה היחיד. `ORDER_TERMINAL` = `מבוטלת` בלבד: `בוצעה` הוא סטטוס חיוב ולא אספקה. `שובצה` לא ממופה בכוונה.
- אספקה ברשעל נשענת לרוב על פתיחת לקוח חדש ולא על הזמנה. לקוח חדש בלי הזמנה הוא עבודה (טאב "לקוחות חדשים").
- כל המשיכות דלתא בלבד. עריכת לקוח לא מזיזה `CREATEDDATE`, לכן סריקת לקוחות מלאה ב-1 וב-15 לחודש, מפוצלת לשתיים. `reconcile-daily` (ראשון עד חמישי) משווה תוכן, כי ה-watchdog סופר ריצות ולא תוכן.
- לפני כתיבה הסנכרון משווה ערכים (`sameValue`): jsonb בסדר מפתחות קנוני, תאריכים לפי הרגע. אחרת כל ריצה דוחפת realtime לכל הלקוחות הפתוחים.
- פריוריטי מחזיר שעון ישראל עם סיומת `Z`. לשם לקוח אין סדר קבוע בין פרטי למשפחה: חיפוש לפי כל המילים בכל סדר.
- מספר לקוח קיים רק בכ-59% מההזמנות. כרטיס לקוח מתאים לפי מספר, אחרת טלפון מנורמל, אחרת שם מדויק. רשומה עם מספר לקוח אחר שייכת למישהו אחר.
- חשבוניות: משיכה על `IVDATE` לא רואה פירעון, לכן משיכה שנייה על `IVRECONDATE`. גיול החובות שלנו קירוב ולא הספר, וזה כתוב בראש המסך.
- כתובת חסרה בהזמנה אינה ניתנת להשלמה מהלקוח. אנשי קשר (`CUSTPERSONNEL_SUBFORM`) לא מסונכרנים.
- שמות שדות לא מנחשים: `$select` עם שדה לא קיים מחזיר 400. גילוי דרך `{"job":"probe-fields"}` ב-`rashal-sync`.
- כתיבה לפריוריטי חותמת `STATUSDATE` ב-UTC, שלוש שעות מאחורי סימן-המים שבשעון ישראל: הדלתא לא תחזיר את מה שכתבנו. הכותב מעדכן את העותק שלנו בעצמו (`rashal-call-status`, 15/09).
- 🔴 מ-15/09 מה שהטכנאי רושם על קריאת שירות נכתב גם לקריאה בפריוריטי, ליד כרטיס הלקוח: הערות צ'אט של `driver` וסיבת "לא בוצע"/"להמשך טיפול" → `DOCTEXT_Q_SUBFORM` (APPEND), תמונות → `EXTFILES_SUBFORM`. בחירה: `priority_call_push_candidates` (רצפת זמן בקוד הפונקציה = המתג, מ-15/09 00:00 שעון ישראל), יומן `priority_call_push_log`, קידומת `call:` ב-ack של `api/priority-push`. בדיקה של קריאה אחת: `rashal-push` עם `{"docno":"SC…"}`. עריכת `resolution_note` אחרי שנכתב = שורה נוספת (המפתח כולל md5 של הטקסט).
- 🔴 קריאה בסטטוס נעול (`סופית` · `מבוטלת` · `טופל טכנאי`) דוחה כתיבה לתת-טופס ב-400 ("מסך טקסט DOCTEXT_Q הינו לקריאה בלבד"), בכל ריצה לנצח. התור מסנן אותה מראש (`priority_call_push_queue.blocked_reason`), וכתיבה שנדחתה ב-4xx (חוץ מ-401/408/429) נעצרת ביומן עם הנוסח (`priority_call_push_log.failed_at`) במקום להחזיק את `push-chat` באדום. מה שנעצר לא נעלם: הוואצ'דוג מתריע עליו בערוץ נפרד (`push-parked`), כי עצירה היא איבוד מידע.
- 🔴 מסך לבן (15/09): `index.html` מכיל סקריפט רגיל שמציג הסבר כש-`#root` ריק (דפדפן ישן, שגיאת טעינה, 20 שניות), ו-`AppErrorBoundary` עוטף את `App`. המערכת דורשת Chrome 93+ (`??=`, `Object.hasOwn`). לא להסיר, ולא להפוך את הסקריפט ל-module (הוא חייב לרוץ גם כשה-module נופל בפענוח).
- ⭐ כרטיס הקריאה (תאור, מדיה, הודעות, הערת משרד) נבנה רק ב-`call_info_payload(call)`. `stop_call_info` (נהג, לפי עצירה) ו-`service_call_info` (משרד, לפי קריאה) רק בודקות הרשאה ועוטפות. שדה חדש לכרטיס = שינוי במקום אחד. בווב: `StopCallInfoSheet` עם `stop` או `call`.
- ⭐ רמזור קריאות שירות (15/09): הצבע מ-`service_call_lights()` בלבד, לא לחשב שוב בלקוח. סדר: צהוב (`call_type`=פרונטלית) · כתום (ביקור אחרון `follow_up`) · ירוק (מדיה מהלקוח או `service_call_manual_green`) · אדום. אדום/צהוב לא משובצים (`filterSchedulableCalls`, `isSchedulable`). ירוק ידני רק דרך `mark_service_call_green`. `pull-core` כולל `calls_udate` (UDATE, 3 שעות, שעון ישראל), כי שינוי סוג קריאה לא מזיז STATUSDATE.
- 🔴 שינוי `status`/`resolution_kind` בעצירת שירות נכתב לפריוריטי (טריגר `trg_enqueue_call_status` → קרון `rashal-call-status-from-stops`): בוצע → בוצעה, המשך טיפול → להמשך טיפול. סקריפט המוני על `calendar_stops` הוא כתיבה המונית לפריוריטי: לכבות את הקרון או לבדוק קודם.
- כפילויות מפריוריטי: טריגר מסמן `duplicate_of`, `useDeduped*` מסתיר, באדג' `×N`. גיל אינו מסנן טוב יותר מסטטוס, רק פחות גרוע.
- "תאור התקלה" = `service_calls.fault_text`, מ-`$expand=DOCTEXT_Q_2_SUBFORM` ב-`service_calls`/`calls_recent` בלבד (לא בהיסטוריה). מכווץ ב-`shrinkFaultText` לפני ה-inbox (תקרת 4.5MB), מנוקה ב-`api/_lib/priority-text.ts`. `undefined` = לא התבקש ולא נוגעים; ריק = null. `fault_desc` הוא MALFDES, משהו אחר. השלמה לפי מספרים: job `refresh-calls`.
### מסד ו-PostgREST
- תקרת 1,000 השורות של PostgREST חלה גם על RPC. לעמד עם `.range` או לצבור ב-SQL (`security invoker` מוריש RLS).
- חלון הנתונים: רשומה ישנה נשארת רק אם נגעו בה בחלון וגם אינה סגורה (`ORDER_CLOSED`/`CALL_CLOSED`/`PICKUP_CLOSED`). ערכים בעברית ב-`not.in` דורשים מרכאות כפולות; `or=(a,and(b,c))` עובד.
- RLS: פונקציה במדיניות עוטפים `(select f())`, אחרת היא רצה לכל שורה (6 שניות מול 14ms). מדיניויות מתירות מצטרפות ב-או: מחמירה לצד מתירנית לא מגנה. שכתוב מדיניות בקוד עם snapshot, לא ביד.
- שינוי טיפוס של עמודה שמדיניות משווה אליה נחסם: לשמור מ-`pg_policies`, להוריד, לשנות, להחזיר בלולאה, לאמת md5.
- `calendar_stops_no_active_dup`: מפתח הזהות הוא שם+טלפון+כתובת+עיר+סוג. ללקוח לכל היותר עצירה פעילה אחת לסוג, בלי חסם תאריך.
- `profiles`: הטריגר `trg_profiles_guard` חוסם שינוי `role/disabled/linked_driver/...` מכל מי שאינו service role. עדכון שתפס אפס שורות אינו שגיאה: לספור שורות.
- ב-plpgsql `if not <null>` לא מרים חריגה: לכתוב `is not true`.
- `resolution_note` נפרד מ-`notes` (תיאור המשימה, לא לדרוס). `resolution_kind` עמודה ולא סטטוס שישי (22 קבצים מסתעפים על הסטטוס).
- דגל "נשלח"/`alerted_at` נכתב רק אחרי שהשליחה הצליחה. "succeeded" של pg_cron לא אומר שנכתב משהו.
- תזכורות יומיות ב-18:30 שעון ישראל ראשון עד חמישי, כי 68% מהשיבוצים נעשים יום מראש בין 16:00 ל-18:00.
### קוד ו-UI
- הוספת סוג עצירה נוגעת בשני constraints במסד ובשבע מפות סוגים (`grep 'SOURCE_META\|SOURCE_CONFIG\|sourceConfig\|sourceIconInPopup'`), כולל אפליקציית הנהג.
- `dragId`/`dragData` ב-`DispatchPage` הם חוזה: `order-<id>` · `servicecall-<id>` · `pickup.id` · `customer.customerNumber`. מפתחות localStorage `collapse:*` ו-`rashal:calendarTypeFilter` נשארים.
- צבע עובד נשמר כמפתח פלטה (`types/assignee.ts`) ולא כמחלקת Tailwind: מחרוזת מהמסד לא תיווצר ב-build. `assigneeStyle` נשען על מטמון שמזין `useAssignees`.
- אין מחיקת עובד או משתמש, השבתה בלבד. השם הוא המפתח של העצירות ההיסטוריות. `team_manager` לא מוחק, לא נוגע במנהל מערכת ולא מעניק admin (`api/_lib/user-admin-policy.ts`).
- דגמי מנוף הם משפחה `/^G\d{3}E?$/` (`src/lib/crane-identity.ts`), לא רשימה. קריאה חוזרת נספרת רק פרונטלית, לא טלפונית.
- בטאב "הכל" לכל רשימה מצב טעינה ושגיאה משלה. רשימה שנכשלה לא מציגה "אין הזמנות".
- טעינת מסך נמדדת (`src/lib/perf.ts` → `screen_load_log`). השליפות מקבילות, לכן הקובע הוא מי נגמרה אחרונה.
- תאריכים מקומיים דרך `toLocalDateStr`, לא `toISOString().split('T')`.
- Leaflet נותן לפקדים `z-index:1000`: `isolate` על כרטיס המפה. קו מסלול מ-`getRoadRoute` עם fallback לקו מקווקו. geocoding דרך השירות המרכזי, `CITY_COORDINATES` הוא fallback.
- RTL: `end-4` ולא `right-4` לכפתור סגירה, `text-start` בטבלאות. נקודות השבירה של Tailwind נמדדות מול החלון ולא מול המיכל.
- Tailwind v4: `animate-in` דורש `tw-animate-css` ב-`index.css`. קריאת state בתוך סגור של אירוע (SignaturePad) מחזירה ערך ישן: ref.
- לוגיקה עסקית בקבצים טהורים בלי ייבוא (`src/lib/*.ts`, `api/_lib/*.ts`) כדי שתיבדק. גבול שחי בשני צדדים (דליי גיול) נבדק מול קובץ המיגרציה.
- `preview.html` + `src/preview/` מרנדרים רכיב אמיתי בלי התחברות, לצילום. לבקש מעידן להתחבר מוקדם כשצריך את המסך החי.
### וואטסאפ (heyy.io)
- 🔴 API v2 של heyy נסגר 01/11/2026. מנוע הסקרים והתזכורת עדיין על `api/v2.0`: להגר ל-v3 עד סוף ספטמבר (`docs/heyy-limits.md`).
- 100 בקשות לדקה, דלי משותף ל-v2/v3, גם בקשה שנכשלת נספרת. 429 → `retryable` וחזרה ל-pending. 5xx על שליחה לעולם לא נשלח שוב.
- כל שולח עובר את רשימת המושתקים (`api/_lib/suppression.ts`, הבדיקה סורקת את כל הקוראים). שליחה מהדשבורד רק דרך `api/wa-send`.
- 🔴 מ-15/09: `wa_messages`/`wa_conversations` קריאים למשרד בלבד (`is_office_staff`). נהג רואה מה שהלקוח שלח רק דרך `stop_call_info`/`stops_call_info_counts`, וחותם קבצים מ-`wa-media` רק של לקוח עם עצירה שלו ב-30 הימים האחרונים (`wa_media_object_visible`). התצוגה `wa_messages_classified` היא `security_invoker`: תצוגה חדשה על הטבלאות האלה חייבת אותו דבר, אחרת היא עוקפת את ה-RLS.
- heyy משבית וובהוק שנכשל ברצף בלי סימן: `rashal-watchdog/heyy-health.ts` בודק. מחזיר `success:true` גם כשחלון 24 השעות סגור.
- מזהי תבנית `DEMO-*` הם דמו ומעולם לא שלחו. מאושרת: `rashal_visit_coordination` (4 משתנים, כפתורים "מתאים לי"/"לא מתאים"). `WA_REMINDERS_ENABLED` כבוי כברירת מחדל.
- כפתורי תבנית מגיעים ב-`attachments`: `describeAttachments` בשרת מכריע, המטען הגולמי לא נוסע לדפדפן. "נקרא" (`read_at`) נרשם רק מלחיצת אדם.
- סקר: ציון 3 ומטה = התרעה פנימית עם ההערה, רשומות בדיקה מסוננות. הודעה ללקוח על ציון נמוך לא נבנתה (ממתין לשלומי).
### תשתית
- Vercel: תקרת הפונקציות ב-`api/` מלאה. לוגיקה חדשה כ-RPC ב-Supabase או רכיבה על נתיב קיים. `vercel metrics`: ממדים ב-camelCase (`requestPath`, `clientIp`).
- Edge Function חיה כ-150 שניות: עבודה ארוכה מפוצלת. Make: כשל שקט כיבה את סנכרון ההזמנות 9 ימים, לכן הסנכרון בקוד עם watchdog במייל (Resend).
- Realtime: צבירת אירועים 1.5 שניות, `refetchOnWindowFocus:false`, `staleTime` 60 שניות. הרעננות מגיעה מה-realtime ומ-`sync_freshness()`.
- ווידג'ט המשוב הוסר מהדשבורד (26/08) לבקשת עידן. לא להחזיר בלי לשאול.
