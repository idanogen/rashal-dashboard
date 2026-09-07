import type { CustomerCardData } from '@/lib/customer-card';

/** הכרטיס של נמני רחמים (10406775) כפי שהמסד החזיר ב-07/09/2026, אחרי
 *  שהשרשור נכנס לציר: ביקור עם הודעה ותמונה של דוד, ותמונה של רודי על ההזמנה. */
export const CARD_FIXTURE = {
 "counts": {
  "calls": 0,
  "notes": 3,
  "orders": 3,
  "pickups": 2,
  "stops": 1
 },
 "customer": {
  "address": "רחוב הדוגמה 1",
  "agent": "משרד",
  "city": "בת ים",
  "customerNumber": "10406775",
  "healthFund": "כללית הנדסה רפואית בעמ",
  "identifiedBy": "number",
  "identifiedHint": null,
  "name": "נמני רחמים",
  "phone": "0500000000"
 },
 "documents": {
  "invoices": [],
  "notes": [
   {
    "date": "2026-07-08",
    "invoiced": true,
    "ref": "303670",
    "status": "סופית",
    "total": 1631
   },
   {
    "date": "2026-07-08",
    "invoiced": true,
    "ref": "303677",
    "status": "סופית",
    "total": 1590
   },
   {
    "date": "2025-04-24",
    "invoiced": true,
    "ref": "278056",
    "status": "סופית",
    "total": 1469
   }
  ]
 },
 "match": {
  "byName": 0,
  "byNumber": 5,
  "byPhone": 0
 },
 "ok": true,
 "open": {
  "calls": [],
  "notes": [],
  "orders": [
   {
    "archived": false,
    "coordination": null,
    "created": "2026-07-05T08:03:33.153492+00:00",
    "date": null,
    "driver": null,
    "id": "9f22ef6e-c028-42e9-abef-b45560246550",
    "items": [
     {
      "desc": "כרית ויסקו 40X40",
      "part": "JEV1616F",
      "qty": 1,
      "serial": null
     }
    ],
    "match": "number",
    "mismatch": false,
    "ref": "SO2602420",
    "scheduled": false,
    "status": "ממתין לתאום",
    "winEnd": null,
    "winStart": null
   },
   {
    "archived": false,
    "coordination": null,
    "created": "2026-07-05T08:05:17.300631+00:00",
    "date": null,
    "driver": null,
    "id": "2f241704-514b-4733-802e-101507d5bfac",
    "items": [
     {
      "desc": "\"מנוף חשמלי SUNRISE MEDICAL  למשקל עד 175 ק\"\"ג\"",
      "part": "G175",
      "qty": 1,
      "serial": null
     },
     {
      "desc": "ערסל למנוף עם תמיכת ראש מידה M",
      "part": "SL 1063P",
      "qty": 1,
      "serial": null
     }
    ],
    "match": "number",
    "mismatch": false,
    "ref": "SO2602432",
    "scheduled": false,
    "status": "ממתין לתאום",
    "winEnd": null,
    "winStart": null
   }
  ],
  "pickups": []
 },
 "stock": {
  "accessories": [
   {
    "desc": "זוג רצועות שוקיים בנוסף לרצועות שוקיים",
    "installedAt": null,
    "lastSeen": "2025-04-24",
    "match": "number",
    "part": "CLRSHLEC2259",
    "qty": 1,
    "serials": [],
    "sources": [
     "delivery"
    ],
    "warrantyEnd": null
   }
  ],
  "devices": [],
  "returned": [
   {
    "at": "2026-07-07",
    "desc": "גרדיאן שלמות רוחב מושב 40 תוצרת SUNRISE MEDICAL",
    "part": "216RAFPS"
   }
  ],
  "since": "2014-01-01"
 },
 "surveys": [],
 "timeline": [
  {
   "at": "2026-09-06T05:34:40.147+00:00",
   "by": "דוד חסידים",
   "detail": null,
   "kind": "stop",
   "match": "number",
   "messages": [
    {
     "at": "2026-09-06T05:32:05.10969+00:00",
     "by": "דוד",
     "text": "איסוף מנוף"
    }
   ],
   "photos": [
    "https://kukstfxtznymfkirdmty.supabase.co/storage/v1/object/public/timeline-files/374c1092-4e35-491b-abb2-2a4d0dd84d0c/1788672738335-dnlmudo5uc.jpg"
   ],
   "ref": "דוד חסידים",
   "title": "בוצע בשטח"
  },
  {
   "at": "2026-09-03T14:00:06.968317+00:00",
   "detail": "נאסף · משרד הבריאות",
   "kind": "pickup",
   "match": "number",
   "ref": "305935",
   "title": "איסוף נפתח"
  },
  {
   "at": "2026-07-09T10:05:10.360947+00:00",
   "by": "רודי",
   "detail": null,
   "kind": "photo",
   "match": "number",
   "photos": [
    "https://kukstfxtznymfkirdmty.supabase.co/storage/v1/object/public/timeline-files/9f22ef6e-c028-42e9-abef-b45560246550/1783591509624-ear7j9gvjj.jpg"
   ],
   "ref": null,
   "title": "תמונה מהשטח"
  },
  {
   "at": "2026-07-08T09:33:50.198057+00:00",
   "detail": "נאסף · משרד הבריאות",
   "kind": "pickup",
   "match": "number",
   "ref": "303647",
   "title": "איסוף נפתח"
  },
  {
   "at": "2026-07-08T00:00:00+00:00",
   "detail": "סופית · חויבה",
   "kind": "note",
   "match": "number",
   "ref": "303677",
   "title": "אספקה"
  },
  {
   "at": "2026-07-08T00:00:00+00:00",
   "detail": "סופית · חויבה",
   "kind": "note",
   "match": "number",
   "ref": "303670",
   "title": "אספקה"
  },
  {
   "at": "2026-07-07T00:00:00+00:00",
   "detail": "גרדיאן שלמות רוחב מושב 40 תוצרת SUNRISE MEDICAL",
   "kind": "returned",
   "match": "number",
   "ref": null,
   "title": "נאסף בחזרה: 216RAFPS"
  },
  {
   "at": "2026-07-05T08:05:17.300631+00:00",
   "detail": "ממתין לתאום · משרד",
   "kind": "order",
   "match": "number",
   "ref": "SO2602432",
   "title": "הזמנה נפתחה"
  },
  {
   "at": "2026-07-05T08:03:33.153492+00:00",
   "detail": "ממתין לתאום · משרד",
   "kind": "order",
   "match": "number",
   "ref": "SO2602420",
   "title": "הזמנה נפתחה"
  },
  {
   "at": "2025-04-24T00:00:00+00:00",
   "detail": "סופית · חויבה",
   "kind": "note",
   "match": "number",
   "ref": "278056",
   "title": "אספקה"
  },
  {
   "at": "2025-04-24T00:00:00+00:00",
   "detail": "סופק · משרד",
   "kind": "order",
   "match": "number",
   "ref": "SO2501538",
   "title": "הזמנה נפתחה"
  },
  {
   "at": "2025-04-24T00:00:00+00:00",
   "detail": "זוג רצועות שוקיים בנוסף לרצועות שוקיים",
   "kind": "equipment",
   "match": "number",
   "ref": null,
   "title": "מכשיר אצל הלקוח: CLRSHLEC2259"
  }
 ],
 "wa": null
} as unknown as CustomerCardData;
