// Duplicated from src/lib/heyy/extract.ts — see note in api/_lib/phone.ts.

export interface ExtractedMessage {
  rawPhone: string | null;
  rawText: string | null;
  providerId: string | null;
  isOutboundEcho: boolean;
  ignoredReason: string | null;
}

export function extractMessage(payload: any): ExtractedMessage {
  if (!payload || typeof payload !== 'object') {
    return { rawPhone: null, rawText: null, providerId: null, isOutboundEcho: false, ignoredReason: 'empty payload' };
  }

  if (payload.event) {
    if (payload.event !== 'message.received') {
      return { rawPhone: null, rawText: null, providerId: null, isOutboundEcho: false, ignoredReason: `event=${payload.event}` };
    }
    const data = payload.data ?? {};
    if (data.sender === 'outbound') {
      return { rawPhone: null, rawText: null, providerId: data.id ?? null, isOutboundEcho: true, ignoredReason: 'outbound echo' };
    }
    return {
      rawPhone: data.contact?.phoneNumber ?? data.handle?.value ?? null,
      rawText: data.content?.body ?? null,
      providerId: data.id ?? null,
      isOutboundEcho: false,
      ignoredReason: null,
    };
  }

  const msg = payload.message ?? {};
  return {
    rawPhone: msg.from ?? payload.from ?? null,
    rawText: msg.text ?? msg.body ?? payload.text ?? payload.body ?? null,
    providerId: msg.id ?? payload.id ?? null,
    isOutboundEcho: false,
    ignoredReason: null,
  };
}

export function parseCustomerReply(text: string | null | undefined): {
  status: 'מתאים' | 'לא מתאים' | 'בקשת שינוי' | null;
  requestedTime: string | null;
} {
  if (!text) return { status: null, requestedTime: null };
  const normalized = text.trim().toLowerCase();

  const positive = [/^כן/, /^בסדר/, /^מאשר/, /^מתאים/, /^אישור/, /^אוקיי/, /^אוקי/, /^okay/, /^ok\b/, /^👍/, /^✅/, /^v$/];
  if (positive.some((p) => p.test(normalized))) return { status: 'מתאים', requestedTime: null };

  const negative = [/^לא$/, /^לא תודה/, /^בטל/, /^ביטול/, /^לא מתאים$/, /^אי אפשר$/, /^❌/];
  if (negative.some((p) => p.test(normalized))) return { status: 'לא מתאים', requestedTime: null };

  const changeIndicators = [
    /מחר/, /אחה"צ/, /אחר.?הצהריים/, /בוקר/, /ערב/, /שעה/, /\d{1,2}[:.]\d{2}/, /\d{1,2}\s*-\s*\d{1,2}/,
    /יום\s+(א|ב|ג|ד|ה|ו|ש)/, /ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת/,
  ];
  if (changeIndicators.some((p) => p.test(text))) return { status: 'בקשת שינוי', requestedTime: text.trim() };

  return { status: null, requestedTime: null };
}
