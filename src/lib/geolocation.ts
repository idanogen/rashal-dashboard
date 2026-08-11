/**
 * מיקום נוכחי, בכשל רך.
 *
 * לעולם לא דוחה: נהג שדחה את הרשאת המיקום, או שנמצא במרתף בלי GPS, חייב
 * להמשיך לעבוד. חוסר מיקום הוא נתון חסר, לא שגיאה.
 */
export async function getCurrentPosition(
  timeoutMs = 6000,
): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: { lat: number; lng: number } | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };

    // גיבוי משלנו: בחלק מהדפדפנים בטלפון ה-timeout המובנה לא נורה כשההרשאה
    // תלויה ועומדת, והבטחה שלא נפתרת הייתה תוקעת את לחיצת "הגעתי".
    const timer = setTimeout(() => finish(null), timeoutMs + 500);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        finish({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        finish(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}
