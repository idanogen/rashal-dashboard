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
  // מרכז
  'תל אביב': { lat: 32.0853, lng: 34.7818 },
  'תל אביב יפו': { lat: 32.0853, lng: 34.7818 },
  'תל-אביב': { lat: 32.0853, lng: 34.7818 },
  'רמת גן': { lat: 32.0719, lng: 34.8237 },
  'גבעתיים': { lat: 32.0726, lng: 34.8119 },
  'בני ברק': { lat: 32.0809, lng: 34.8338 },
  'חולון': { lat: 32.0113, lng: 34.7725 },
  'בת ים': { lat: 32.0167, lng: 34.7500 },
  'פתח תקווה': { lat: 32.0878, lng: 34.8878 },
  'ראשון לציון': { lat: 31.9730, lng: 34.7925 },
  'רחובות': { lat: 31.8947, lng: 34.8081 },
  'נס ציונה': { lat: 31.9306, lng: 34.7992 },
  'רמלה': { lat: 31.9297, lng: 34.8722 },
  'לוד': { lat: 31.9514, lng: 34.8897 },
  'מודיעין': { lat: 31.8969, lng: 35.0106 },
  'מודיעין מכבים רעות': { lat: 31.8969, lng: 35.0106 },

  // שרון
  'נתניה': { lat: 32.3340, lng: 34.8556 },
  'הרצליה': { lat: 32.1656, lng: 34.8433 },
  'כפר סבא': { lat: 32.1758, lng: 34.9076 },
  'רעננה': { lat: 32.1850, lng: 34.8706 },
  'הוד השרון': { lat: 32.1519, lng: 34.8894 },
  'ראש העין': { lat: 32.0947, lng: 34.9597 },
  'אור יהודה': { lat: 32.0258, lng: 34.8581 },
  'יהוד': { lat: 32.0303, lng: 34.8881 },
  'קרית אונו': { lat: 32.0583, lng: 34.8556 },

  // ירושלים והסביבה
  'ירושלים': { lat: 31.7683, lng: 35.2137 },
  'בית שמש': { lat: 31.7520, lng: 34.9890 },
  'מעלה אדומים': { lat: 31.7769, lng: 35.2975 },
  'גבעת זאב': { lat: 31.8561, lng: 35.1675 },

  // חיפה והצפון
  'חיפה': { lat: 32.7940, lng: 34.9896 },
  'קריית אתא': { lat: 32.8019, lng: 35.1025 },
  'קריית ביאליק': { lat: 32.8353, lng: 35.0886 },
  'קריית ים': { lat: 32.8397, lng: 35.0719 },
  'קריית מוצקין': { lat: 32.8361, lng: 35.0764 },
  'עכו': { lat: 32.9272, lng: 35.0831 },
  'נהריה': { lat: 33.0083, lng: 35.0950 },
  'כרמיאל': { lat: 32.9183, lng: 35.2969 },
  'טבריה': { lat: 32.7914, lng: 35.5308 },
  'צפת': { lat: 32.9656, lng: 35.4978 },
  'עפולה': { lat: 32.6078, lng: 35.2897 },

  // דרום
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

  // אם לא נמצא, נסה ללא רווחים ותווים מיוחדים
  if (!coords) {
    const normalizedCity = city.replace(/\s+/g, ' ').trim();
    coords = CITY_COORDINATES[normalizedCity];
  }

  // אם עדיין לא נמצא, נסה באותיות קטנות (case-insensitive)
  if (!coords) {
    const cityLower = city.toLowerCase();
    const foundKey = Object.keys(CITY_COORDINATES).find(
      (key) => key.toLowerCase() === cityLower
    );
    if (foundKey) {
      coords = CITY_COORDINATES[foundKey];
    }
  }

  return {
    ...order,
    coordinates: coords,
  };
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
