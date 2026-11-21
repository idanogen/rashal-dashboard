// פעמון פעם אחת לכל פריט (push-parked, driver-name, stuck-actions) כתב "alerting" ולא חזר ל-"ok"
// כשהבדיקה נקייה. מ-19/11 מרכז השירות בדנה פותח כרטיס על התראה שתקועה 48 שעות, ולכן ארבע
// התראות ישנות נפתחו ככרטיסים (#595-#598, 21/11) למרות שהתקלה עברה. last_alerted_at נשאר:
// הוא סימן-המים של "דווח פעם אחת", והמצב לבדו לא משפיע על מי ידווח.
// קובץ טהור בלי ייבוא, כדי שייבדק ב-node (`test/watchdog-alert-state.test.mjs`).

export function shouldMarkOk(result: string, prev: Record<string, unknown> | undefined): boolean {
  return result === "ok" && prev?.state === "alerting";
}
