export type WhatsAppDirection = 'inbound' | 'outbound';
export type WhatsAppMessageKind = 'text' | 'template';
export type WhatsAppOutboundStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type WhatsAppInboundStatus = 'received' | 'processed' | 'failed' | 'ignored';
export type CustomerReplyStatus = 'ממתין' | 'מתאים' | 'לא מתאים' | 'בקשת שינוי';
export type WhatsAppReminderKind =
  | 'delivery_reminder'
  | 'schedule_request'
  | 'schedule_coordination'
  | 'team_notification'
  | 'custom';

export interface WhatsAppInbound {
  id: string;
  providerMessageId?: string;
  phoneE164: string;
  phoneLocal?: string;
  bodyText?: string;
  rawPayload?: unknown;
  status: WhatsAppInboundStatus;
  orderId?: string;
  parsedReplyStatus?: CustomerReplyStatus;
  notes?: string;
  isDemo: boolean;
  receivedAt: string;
  processedAt?: string;
  createdAt: string;
}

export interface WhatsAppOutbound {
  id: string;
  waMessageId?: string;
  phoneE164: string;
  messageKind: WhatsAppMessageKind;
  templateId?: string;
  templateParams?: string[];
  bodyText?: string;
  reminderKind?: WhatsAppReminderKind;
  status: WhatsAppOutboundStatus;
  statusDetail?: string;
  orderId?: string;
  triggeredBy?: string;
  isDemo: boolean;
  sentAt: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface SendTextParams {
  phone: string;
  body: string;
  orderId?: string;
  reminderKind?: WhatsAppReminderKind;
  triggeredBy?: string;
}

export interface SendTemplateParams {
  phone: string;
  templateId: string;
  parameters: string[];
  orderId?: string;
  reminderKind?: WhatsAppReminderKind;
  triggeredBy?: string;
}

export interface HeyySendResult {
  ok: boolean;
  waMessageId?: string;
  status: WhatsAppOutboundStatus;
  statusDetail?: string;
  isDemo: boolean;
}
