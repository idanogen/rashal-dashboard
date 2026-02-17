export type RegionType = 'north' | 'center' | 'south';

export interface Zone {
  id: string;
  name: string;
  region: RegionType;
  color: string;
}

export const ZONES: Zone[] = [
  // צפון (4 אזורים)
  { id: 'haifa', name: 'חיפה', region: 'north', color: 'bg-blue-500' },
  { id: 'krayot', name: 'קריות', region: 'north', color: 'bg-blue-600' },
  { id: 'akko-nahariya', name: 'עכו-נהריה', region: 'north', color: 'bg-cyan-500' },
  { id: 'galil-valleys', name: 'גליל-עמקים', region: 'north', color: 'bg-cyan-600' },

  // מרכז (7 אזורים)
  { id: 'gush-dan', name: 'גוש דן', region: 'center', color: 'bg-purple-500' },
  { id: 'south-tlv', name: 'דרום תל אביב', region: 'center', color: 'bg-purple-600' },
  { id: 'sharon', name: 'שרון', region: 'center', color: 'bg-violet-500' },
  { id: 'petah-tikva-east', name: 'פ"ת-מזרח', region: 'center', color: 'bg-violet-600' },
  { id: 'rehovot-area', name: 'רחובות-נס ציונה', region: 'center', color: 'bg-violet-700' },
  { id: 'lod-modiin', name: 'לוד-רמלה-מודיעין', region: 'center', color: 'bg-indigo-500' },
  { id: 'jerusalem', name: 'ירושלים', region: 'center', color: 'bg-indigo-600' },

  // דרום (3 אזורים)
  { id: 'ashdod-ashkelon', name: 'אשדוד-אשקלון', region: 'south', color: 'bg-amber-500' },
  { id: 'south-center', name: 'דרום מרכז', region: 'south', color: 'bg-amber-600' },
  { id: 'beer-sheva-eilat', name: 'באר שבע-אילת', region: 'south', color: 'bg-amber-700' },
];

/**
 * מיפוי ערים לאזורים - כל הערים מ-CITY_COORDINATES בגיאוקודינג
 */
export const CITY_TO_ZONE: Record<string, string> = {
  // גוש דן
  'תל אביב': 'gush-dan',
  'תל אביב יפו': 'gush-dan',
  'תל-אביב': 'gush-dan',
  'תל אביב-יפו': 'gush-dan',
  'רמת גן': 'gush-dan',
  'גבעתיים': 'gush-dan',
  'בני ברק': 'gush-dan',
  'אזור': 'gush-dan',
  'גני תקווה': 'gush-dan',

  // דרום תל אביב
  'חולון': 'south-tlv',
  'בת ים': 'south-tlv',

  // שרון
  'נתניה': 'sharon',
  'הרצליה': 'sharon',
  'כפר סבא': 'sharon',
  'רעננה': 'sharon',
  'הוד השרון': 'sharon',
  'רמת השרון': 'sharon',
  'כפר יונה': 'sharon',
  'אבן יהודה': 'sharon',
  'קדימה': 'sharon',
  'קדימה צורן': 'sharon',
  'צורן': 'sharon',
  'פרדס חנה': 'sharon',
  'פרדס חנה כרכור': 'sharon',
  'כרכור': 'sharon',
  'חדרה': 'sharon',
  'זכרון יעקב': 'sharon',

  // פ"ת-מזרח
  'פתח תקווה': 'petah-tikva-east',
  'פתח תקוה': 'petah-tikva-east',
  'ראש העין': 'petah-tikva-east',
  'אור יהודה': 'petah-tikva-east',
  'יהוד': 'petah-tikva-east',
  'יהוד מונוסון': 'petah-tikva-east',
  'קרית אונו': 'petah-tikva-east',
  'קריית אונו': 'petah-tikva-east',
  'אלעד': 'petah-tikva-east',
  'שוהם': 'petah-tikva-east',

  // רחובות-נס ציונה
  'ראשון לציון': 'rehovot-area',
  'רחובות': 'rehovot-area',
  'נס ציונה': 'rehovot-area',

  // לוד-רמלה-מודיעין
  'רמלה': 'lod-modiin',
  'לוד': 'lod-modiin',
  'מודיעין': 'lod-modiin',
  'מודיעין מכבים רעות': 'lod-modiin',
  'מודיעין עילית': 'lod-modiin',

  // ירושלים
  'ירושלים': 'jerusalem',
  'בית שמש': 'jerusalem',
  'מעלה אדומים': 'jerusalem',
  'גבעת זאב': 'jerusalem',
  'ביתר עילית': 'jerusalem',
  'אפרת': 'jerusalem',
  'מבשרת ציון': 'jerusalem',
  'אריאל': 'jerusalem',

  // חיפה
  'חיפה': 'haifa',
  'טירת כרמל': 'haifa',
  'טירת הכרמל': 'haifa',
  'נשר': 'haifa',

  // קריות
  'קריית אתא': 'krayot',
  'קרית אתא': 'krayot',
  'קריית ביאליק': 'krayot',
  'קרית ביאליק': 'krayot',
  'קריית ים': 'krayot',
  'קרית ים': 'krayot',
  'קריית מוצקין': 'krayot',
  'קרית מוצקין': 'krayot',

  // עכו-נהריה
  'עכו': 'akko-nahariya',
  'נהריה': 'akko-nahariya',
  'קריית שמונה': 'akko-nahariya',
  'קרית שמונה': 'akko-nahariya',

  // גליל-עמקים
  'כרמיאל': 'galil-valleys',
  'טבריה': 'galil-valleys',
  'צפת': 'galil-valleys',
  'עפולה': 'galil-valleys',
  'מגדל העמק': 'galil-valleys',
  'נצרת': 'galil-valleys',
  'נצרת עילית': 'galil-valleys',
  'נוף הגליל': 'galil-valleys',
  'יקנעם': 'galil-valleys',
  'יקנעם עילית': 'galil-valleys',
  'בית שאן': 'galil-valleys',

  // אשדוד-אשקלון
  'אשדוד': 'ashdod-ashkelon',
  'אשקלון': 'ashdod-ashkelon',
  'יבנה': 'ashdod-ashkelon',
  'גן יבנה': 'ashdod-ashkelon',
  'גדרה': 'ashdod-ashkelon',

  // דרום מרכז
  'קריית גת': 'south-center',
  'קרית גת': 'south-center',
  'קרית מלאכי': 'south-center',
  'קריית מלאכי': 'south-center',
  'נתיבות': 'south-center',
  'שדרות': 'south-center',
  'אופקים': 'south-center',

  // באר שבע-אילת
  'באר שבע': 'beer-sheva-eilat',
  'אילת': 'beer-sheva-eilat',
  'דימונה': 'beer-sheva-eilat',
  'ערד': 'beer-sheva-eilat',
};

/**
 * חיפוש אזור לפי שם עיר (עם נרמול)
 */
export function getZoneForCity(city: string | undefined): string | undefined {
  if (!city) return undefined;

  const trimmed = city.trim();

  // חיפוש ישיר
  let zoneId = CITY_TO_ZONE[trimmed];
  if (zoneId) return zoneId;

  // נרמול רווחים
  const normalized = trimmed.replace(/\s+/g, ' ');
  zoneId = CITY_TO_ZONE[normalized];
  if (zoneId) return zoneId;

  // חיפוש חלקי - אם שם העיר מכיל אחד מהמפתחות
  const keys = Object.keys(CITY_TO_ZONE);
  const found = keys.find(
    (key) => normalized.includes(key) || key.includes(normalized)
  );
  if (found) return CITY_TO_ZONE[found];

  return undefined;
}

// Helper functions
export const getZoneById = (id: string): Zone | undefined =>
  ZONES.find((z) => z.id === id);

export const getZonesByRegion = (region: RegionType): Zone[] =>
  ZONES.filter((z) => z.region === region);

export const REGION_LABELS: Record<RegionType, string> = {
  north: 'צפון',
  center: 'מרכז',
  south: 'דרום',
};
