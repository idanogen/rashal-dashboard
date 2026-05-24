/**
 * heyy webhook handler — extracts the actually-useful bits from
 * the TWO possible payload shapes:
 *
 *   Format A — Channel Webhook ("WhatsApp Message Received"):
 *     { event: "message.received", data: { id, sender, content: { body }, contact: { phoneNumber }, handle: { value } } }
 *
 *   Format B — Automation Flow → HTTP node (we control the body):
 *     { from, text, id? }
 */

export interface ExtractedMessage {
  rawPhone: string | null;
  rawText: string | null;
  providerId: string | null;
  isOutboundEcho: boolean;
  ignoredReason: string | null;
}

interface ChannelWebhookPayload {
  event?: string;
  data?: {
    id?: string;
    sender?: 'inbound' | 'outbound' | string;
    content?: { body?: string };
    contact?: { phoneNumber?: string };
    handle?: { value?: string };
  };
}

interface AutomationFlowPayload {
  from?: string;
  text?: string;
  body?: string;
  id?: string;
  message?: {
    from?: string;
    text?: string;
    body?: string;
    id?: string;
  };
}

type AnyPayload = ChannelWebhookPayload & AutomationFlowPayload;

export function extractMessage(payload: AnyPayload | null | undefined): ExtractedMessage {
  if (!payload || typeof payload !== 'object') {
    return {
      rawPhone: null,
      rawText: null,
      providerId: null,
      isOutboundEcho: false,
      ignoredReason: 'empty payload',
    };
  }

  // Format A — channel webhook
  if (payload.event) {
    if (payload.event !== 'message.received') {
      return {
        rawPhone: null,
        rawText: null,
        providerId: null,
        isOutboundEcho: false,
        ignoredReason: `event=${payload.event}`,
      };
    }
    const data = payload.data ?? {};
    if (data.sender === 'outbound') {
      return {
        rawPhone: null,
        rawText: null,
        providerId: data.id ?? null,
        isOutboundEcho: true,
        ignoredReason: 'outbound echo',
      };
    }
    return {
      rawPhone: data.contact?.phoneNumber ?? data.handle?.value ?? null,
      rawText: data.content?.body ?? null,
      providerId: data.id ?? null,
      isOutboundEcho: false,
      ignoredReason: null,
    };
  }

  // Format B — automation flow → HTTP node
  const msg = payload.message ?? {};
  return {
    rawPhone: msg.from ?? payload.from ?? null,
    rawText: msg.text ?? msg.body ?? payload.text ?? payload.body ?? null,
    providerId: msg.id ?? payload.id ?? null,
    isOutboundEcho: false,
    ignoredReason: null,
  };
}

/**
 * Parses a Hebrew customer reply into a structured status.
 * Deterministic — no AI. Returns null when we can't classify confidently.
 */
export function parseCustomerReply(text: string | null | undefined): {
  status: 'מתאים' | 'לא מתאים' | 'בקשת שינוי' | null;
  requestedTime: string | null;
} {
  if (!text) return { status: null, requestedTime: null };
  const normalized = text.trim().toLowerCase();

  // Positive
  const positivePatterns = [
    /^כן/, /^בסדר/, /^מאשר/, /^מתאים/, /^אישור/, /^אוקיי/, /^אוקי/, /^okay/, /^ok\b/, /^👍/, /^✅/, /^v$/,
  ];
  if (positivePatterns.some((p) => p.test(normalized))) {
    return { status: 'מתאים', requestedTime: null };
  }

  // Negative without alternative
  const negativePatterns = [
    /^לא$/, /^לא תודה/, /^בטל/, /^ביטול/, /^לא מתאים$/, /^אי אפשר$/, /^❌/,
  ];
  if (negativePatterns.some((p) => p.test(normalized))) {
    return { status: 'לא מתאים', requestedTime: null };
  }

  // Change request — anything mentioning time/date/day → treat as scheduling change
  const changeIndicators = [
    /מחר/, /אחה"צ/, /אחר.?הצהריים/, /בוקר/, /ערב/, /שעה/, /\d{1,2}[:.]\d{2}/, /\d{1,2}\s*-\s*\d{1,2}/,
    /יום\s+(א|ב|ג|ד|ה|ו|ש)/, /ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת/,
  ];
  if (changeIndicators.some((p) => p.test(text))) {
    return { status: 'בקשת שינוי', requestedTime: text.trim() };
  }

  return { status: null, requestedTime: null };
}
