import type { Order } from '@/types/order';

/**
 * קואורדינטות גיאוגרפיות (latitude, longitude)
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * הזמנה עם קואורדינטות גיאוגרפיות
 */
export interface GeocodedOrder extends Order {
  coordinates?: Coordinates;
}

/**
 * מאגר קואורדינטות של ערים ישראליות (מרכז העיר)
 * מקור: Google Maps / OpenStreetMap
 */
const CITY_COORDINATES: Record<string, Coordinates> = {
  // ─── גוש דן ───────────────────────────────────────
  'תל אביב': { lat: 32.0853, lng: 34.7818 },
  'תל אביב יפו': { lat: 32.0853, lng: 34.7818 },
  'תל-אביב': { lat: 32.0853, lng: 34.7818 },
  'תל אביב-יפו': { lat: 32.0853, lng: 34.7818 },
  'רמת גן': { lat: 32.0719, lng: 34.8237 },
  'גבעתיים': { lat: 32.0726, lng: 34.8119 },
  'בני ברק': { lat: 32.0809, lng: 34.8338 },
  'חולון': { lat: 32.0113, lng: 34.7725 },
  'בת ים': { lat: 32.0167, lng: 34.7500 },
  'אור יהודה': { lat: 32.0258, lng: 34.8581 },
  'יהוד': { lat: 32.0303, lng: 34.8881 },
  'יהוד מונוסון': { lat: 32.0303, lng: 34.8881 },
  'קרית אונו': { lat: 32.0583, lng: 34.8556 },
  'קריית אונו': { lat: 32.0583, lng: 34.8556 },
  'אזור': { lat: 32.0286, lng: 34.7914 },
  'גני תקווה': { lat: 32.0558, lng: 34.8714 },

  // ─── פתח תקווה ומזרח ─────────────────────────────
  'פתח תקווה': { lat: 32.0878, lng: 34.8878 },
  'פתח תקוה': { lat: 32.0878, lng: 34.8878 },
  'ראש העין': { lat: 32.0947, lng: 34.9597 },
  'אלעד': { lat: 32.0525, lng: 34.9511 },
  'שוהם': { lat: 31.9989, lng: 34.9467 },

  // ─── שרון ──────────────────────────────────────────
  'נתניה': { lat: 32.3340, lng: 34.8556 },
  'הרצליה': { lat: 32.1656, lng: 34.8433 },
  'כפר סבא': { lat: 32.1758, lng: 34.9076 },
  'רעננה': { lat: 32.1850, lng: 34.8706 },
  'הוד השרון': { lat: 32.1519, lng: 34.8894 },
  'רמת השרון': { lat: 32.1461, lng: 34.8394 },
  'כפר יונה': { lat: 32.3167, lng: 34.9333 },
  'אבן יהודה': { lat: 32.2728, lng: 34.8867 },
  'קדימה': { lat: 32.2783, lng: 34.8500 },
  'קדימה צורן': { lat: 32.2783, lng: 34.8500 },
  'צורן': { lat: 32.2783, lng: 34.8500 },
  'פרדס חנה': { lat: 32.4728, lng: 34.9694 },
  'פרדס חנה כרכור': { lat: 32.4728, lng: 34.9694 },
  'כרכור': { lat: 32.4728, lng: 34.9694 },
  'חדרה': { lat: 32.4408, lng: 34.9197 },
  'זכרון יעקב': { lat: 32.5714, lng: 34.9514 },

  // ─── רחובות-נס ציונה ──────────────────────────────
  'ראשון לציון': { lat: 31.9730, lng: 34.7925 },
  'רחובות': { lat: 31.8947, lng: 34.8081 },
  'נס ציונה': { lat: 31.9306, lng: 34.7992 },

  // ─── לוד-רמלה-מודיעין ─────────────────────────────
  'רמלה': { lat: 31.9297, lng: 34.8722 },
  'לוד': { lat: 31.9514, lng: 34.8897 },
  'מודיעין': { lat: 31.8969, lng: 35.0106 },
  'מודיעין מכבים רעות': { lat: 31.8969, lng: 35.0106 },
  'מודיעין עילית': { lat: 31.9333, lng: 35.0428 },

  // ─── ירושלים והסביבה ──────────────────────────────
  'ירושלים': { lat: 31.7683, lng: 35.2137 },
  'בית שמש': { lat: 31.7520, lng: 34.9890 },
  'מעלה אדומים': { lat: 31.7769, lng: 35.2975 },
  'גבעת זאב': { lat: 31.8561, lng: 35.1675 },
  'ביתר עילית': { lat: 31.6994, lng: 35.1194 },
  'אפרת': { lat: 31.6597, lng: 35.1508 },
  'מבשרת ציון': { lat: 31.8000, lng: 35.1500 },
  'אריאל': { lat: 32.1056, lng: 35.1764 },

  // ─── חיפה והקריות ─────────────────────────────────
  'חיפה': { lat: 32.7940, lng: 34.9896 },
  'קריית אתא': { lat: 32.8019, lng: 35.1025 },
  'קרית אתא': { lat: 32.8019, lng: 35.1025 },
  'קריית ביאליק': { lat: 32.8353, lng: 35.0886 },
  'קרית ביאליק': { lat: 32.8353, lng: 35.0886 },
  'קריית ים': { lat: 32.8397, lng: 35.0719 },
  'קרית ים': { lat: 32.8397, lng: 35.0719 },
  'קריית מוצקין': { lat: 32.8361, lng: 35.0764 },
  'קרית מוצקין': { lat: 32.8361, lng: 35.0764 },
  'טירת כרמל': { lat: 32.7600, lng: 34.9714 },
  'טירת הכרמל': { lat: 32.7600, lng: 34.9714 },
  'נשר': { lat: 32.7722, lng: 35.0375 },
  'קריית שמונה': { lat: 33.2086, lng: 35.5714 },
  'קרית שמונה': { lat: 33.2086, lng: 35.5714 },

  // ─── צפון - עכו, נהריה, גליל ─────────────────────
  'עכו': { lat: 32.9272, lng: 35.0831 },
  'נהריה': { lat: 33.0083, lng: 35.0950 },
  'כרמיאל': { lat: 32.9183, lng: 35.2969 },
  'טבריה': { lat: 32.7914, lng: 35.5308 },
  'צפת': { lat: 32.9656, lng: 35.4978 },
  'עפולה': { lat: 32.6078, lng: 35.2897 },
  'מגדל העמק': { lat: 32.6750, lng: 35.2417 },
  'נצרת': { lat: 32.7000, lng: 35.3000 },
  'נצרת עילית': { lat: 32.7167, lng: 35.3167 },
  'נוף הגליל': { lat: 32.7167, lng: 35.3167 },
  'יקנעם': { lat: 32.6597, lng: 35.1089 },
  'יקנעם עילית': { lat: 32.6597, lng: 35.1089 },
  'בית שאן': { lat: 32.4975, lng: 35.4972 },

  // ─── דרום ──────────────────────────────────────────
  'באר שבע': { lat: 31.2530, lng: 34.7915 },
  'אשדוד': { lat: 31.8044, lng: 34.6553 },
  'אשקלון': { lat: 31.6688, lng: 34.5742 },
  'קריית גת': { lat: 31.6100, lng: 34.7642 },
  'קרית גת': { lat: 31.6100, lng: 34.7642 },
  'יבנה': { lat: 31.8778, lng: 34.7397 },
  'גן יבנה': { lat: 31.7889, lng: 34.7081 },
  'גדרה': { lat: 31.8142, lng: 34.7756 },
  'קרית מלאכי': { lat: 31.7306, lng: 34.7472 },
  'קריית מלאכי': { lat: 31.7306, lng: 34.7472 },
  'נתיבות': { lat: 31.4197, lng: 34.5906 },
  'אילת': { lat: 29.5569, lng: 34.9517 },
  'שדרות': { lat: 31.5250, lng: 34.5964 },
  'אופקים': { lat: 31.3167, lng: 34.6167 },
  'דימונה': { lat: 31.0700, lng: 35.0300 },
  'ערד': { lat: 31.2589, lng: 35.2131 },
};

/**
 * המרת הזמנה לקואורדינטות לפי העיר
 * @param order - הזמנה
 * @returns הזמנה עם קואורדינטות (אם נמצאה העיר)
 */
export function geocodeOrderByCity(order: Order): GeocodedOrder {
  const city = order.city?.trim();

  if (!city) {
    return order;
  }

  // חיפוש ישיר
  let coords = CITY_COORDINATES[city];

  // נרמול רווחים
  if (!coords) {
    const normalizedCity = city.replace(/\s+/g, ' ').trim();
    coords = CITY_COORDINATES[normalizedCity];
  }

  // ללא מקפים
  if (!coords) {
    const noDash = city.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    coords = CITY_COORDINATES[noDash];
  }

  // חיפוש חלקי - אם העיר מכילה שם ידוע או להפך
  if (!coords) {
    const cityNorm = city.replace(/[-\s]+/g, ' ').trim();
    const keys = Object.keys(CITY_COORDINATES);
    const found = keys.find((key) => {
      const keyNorm = key.replace(/[-\s]+/g, ' ').trim();
      return cityNorm.includes(keyNorm) || keyNorm.includes(cityNorm);
    });
    if (found) {
      coords = CITY_COORDINATES[found];
    }
  }

  return {
    ...order,
    coordinates: coords,
  };
}

/**
 * מחזיר רשימת הזמנות שלא נמצאו להן קואורדינטות
 */
export function getUnmappedOrders(orders: Order[]): Order[] {
  return orders.filter((o) => !geocodeOrderByCity(o).coordinates);
}

/**
 * חישוב מרחק בין שתי נקודות גיאוגרפיות בק"מ
 * משתמש בנוסחת Haversine
 * @param coord1 - קואורדינטות נקודה 1
 * @param coord2 - קואורדינטות נקודה 2
 * @returns מרחק בק"מ
 */
export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371; // רדיוס כדור הארץ בק"מ

  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) *
      Math.cos(toRadians(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * המרת מעלות לרדיאנים
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * בדיקה האם לעיר יש קואורדינטות במאגר
 * @param city - שם העיר
 * @returns true אם העיר קיימת במאגר
 */
export function hasCityCoordinates(city: string): boolean {
  if (!city) return false;

  const normalizedCity = city.trim();
  return !!CITY_COORDINATES[normalizedCity];
}

/**
 * קבלת רשימת כל הערים הזמינות במאגר
 * @returns מערך שמות ערים
 */
export function getAvailableCities(): string[] {
  return Object.keys(CITY_COORDINATES).sort();
}
