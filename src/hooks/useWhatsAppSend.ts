import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sendTemplate, sendText } from '@/lib/heyy/client';
import { getTemplate, isPlaceholderTemplate } from '@/lib/heyy/templates';
import type {
  HeyySendResult,
  WhatsAppReminderKind,
} from '@/lib/heyy/types';

export interface SendReminderInput {
  reminderKind: WhatsAppReminderKind;
  phone: string;
  orderId?: string;
  params: Record<string, string>;
  triggeredBy?: string;
}

export interface SendCustomTextInput {
  phone: string;
  body: string;
  orderId?: string;
  triggeredBy?: string;
}

export function useSendReminder() {
  const qc = useQueryClient();
  return useMutation<HeyySendResult, Error, SendReminderInput>({
    mutationFn: async (input) => {
      const tpl = getTemplate(input.reminderKind);
      return sendTemplate({
        phone: input.phone,
        templateId: tpl.templateId,
        parameters: tpl.buildParams(input.params),
        orderId: input.orderId,
        reminderKind: input.reminderKind,
        triggeredBy: input.triggeredBy,
      });
    },
    onSuccess: (result, input) => {
      const tpl = getTemplate(input.reminderKind);
      if (!result.ok) {
        toast.error(`שליחה נכשלה: ${result.statusDetail ?? 'שגיאה'}`);
        return;
      }
      const demoNote = result.isDemo || isPlaceholderTemplate(tpl.templateId) ? ' (מצב דמו)' : '';
      toast.success(`✅ ${tpl.label} נשלחה${demoNote}`);
      qc.invalidateQueries({ queryKey: ['whatsappOutbound'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err) => {
      toast.error(`שגיאה: ${err.message}`);
    },
  });
}

export function useSendCustomText() {
  const qc = useQueryClient();
  return useMutation<HeyySendResult, Error, SendCustomTextInput>({
    mutationFn: (input) =>
      sendText({
        phone: input.phone,
        body: input.body,
        orderId: input.orderId,
        reminderKind: 'custom',
        triggeredBy: input.triggeredBy,
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(`שליחה נכשלה: ${result.statusDetail ?? 'שגיאה'}`);
        return;
      }
      toast.success(`✅ הודעה נשלחה${result.isDemo ? ' (מצב דמו)' : ''}`);
      qc.invalidateQueries({ queryKey: ['whatsappOutbound'] });
    },
    onError: (err) => {
      toast.error(`שגיאה: ${err.message}`);
    },
  });
}
