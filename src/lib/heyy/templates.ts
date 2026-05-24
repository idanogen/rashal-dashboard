/**
 * Centralized registry of all WhatsApp templates used in the app.
 *
 * Until heyy approval comes in, `templateId` here is a placeholder ('DEMO-<kind>').
 * In demo mode the /api/heyy-send function logs the simulated send to DB and returns OK.
 *
 * AFTER heyy approval:
 *   1. Create the template in heyy UI → Tools → Create new template
 *   2. Submit to Meta (24-48h approval)
 *   3. Replace the templateId below with the real UUID from heyy
 *   4. Set HEYY_MODE=real in Vercel ENV
 */

import type { WhatsAppReminderKind } from './types';

export interface TemplateDef {
  kind: WhatsAppReminderKind;
  /** heyy templateId — replace 'DEMO-*' with real UUID after Meta approval. */
  templateId: string;
  /** Hebrew label shown in the dashboard. */
  label: string;
  /** Preview body with placeholders — used for display only, not sent. */
  bodyPreview: string;
  /** Parameter labels in order (UI shows these next to inputs). */
  paramLabels: string[];
  /** Build the actual parameters array sent to heyy. */
  buildParams: (input: Record<string, string>) => string[];
}

export const TEMPLATES: Record<WhatsAppReminderKind, TemplateDef> = {
  delivery_reminder: {
    kind: 'delivery_reminder',
    templateId: 'DEMO-delivery-reminder',
    label: 'תזכורת משלוח',
    bodyPreview:
      'שלום {{1}},\nתזכורת על משלוח של ראש"ל ציוד רפואי היום בין השעות {{2}}-{{3}}.\nכתובת: {{4}}\nלשאלות: 03-XXXXXXX',
    paramLabels: ['שם הלקוח', 'שעת התחלה', 'שעת סיום', 'כתובת'],
    buildParams: (i) => [i.customerName ?? '', i.timeStart ?? '08:00', i.timeEnd ?? '18:00', i.address ?? ''],
  },
  schedule_request: {
    kind: 'schedule_request',
    templateId: 'DEMO-schedule-request',
    label: 'בקשת תיאום משלוח',
    bodyPreview:
      'שלום {{1}},\nנשמח לתאם איתכם משלוח של ראש"ל ציוד רפואי.\nמתי נוח לכם לקבל? נא לענות אחת מהאפשרויות:\nבוקר / צהריים / אחה"צ / ערב',
    paramLabels: ['שם הלקוח'],
    buildParams: (i) => [i.customerName ?? ''],
  },
  team_notification: {
    kind: 'team_notification',
    templateId: 'DEMO-team-notification',
    label: 'הודעה לצוות',
    bodyPreview: 'שלום {{1}},\n{{2}}',
    paramLabels: ['שם', 'תוכן ההודעה'],
    buildParams: (i) => [i.recipientName ?? '', i.body ?? ''],
  },
  custom: {
    kind: 'custom',
    templateId: 'DEMO-custom',
    label: 'הודעה מותאמת',
    bodyPreview: '{{1}}',
    paramLabels: ['תוכן'],
    buildParams: (i) => [i.body ?? ''],
  },
};

export function getTemplate(kind: WhatsAppReminderKind): TemplateDef {
  return TEMPLATES[kind];
}

/** Returns true if the template hasn't been swapped to a real heyy ID yet. */
export function isPlaceholderTemplate(templateId: string): boolean {
  return templateId.startsWith('DEMO-');
}
