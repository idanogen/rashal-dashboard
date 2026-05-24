import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useSimulateInbound } from '@/hooks/useWhatsAppMessages';
import { useOrders } from '@/hooks/useOrders';
import { toE164 } from '@/lib/heyy/phone';
import { Bot } from 'lucide-react';

// Quick-pick scripted replies — helps the user demo all 3 customer-reply paths.
const SCRIPTED_REPLIES = [
  { label: '✅ "מתאים" (חיובי)', text: 'מתאים, תודה' },
  { label: '❌ "לא מתאים" (שלילי)', text: 'לא מתאים' },
  { label: '✏ "מחר אחה"צ" (בקשת שינוי)', text: 'אפשר מחר אחה"צ?' },
  { label: 'טקסט חופשי', text: '' },
];

export function DemoSimulator() {
  const { data: orders } = useOrders();
  const simulate = useSimulateInbound();
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [customPhone, setCustomPhone] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [scriptedIdx, setScriptedIdx] = useState<string>('0');

  const ordersWithPhone = (orders ?? []).filter((o) => o.phone && o.customerName);

  const selectedOrder = ordersWithPhone.find((o) => o.id === selectedOrderId);
  const effectivePhone = selectedOrder?.phone ?? customPhone;
  const phoneE164 = toE164(effectivePhone);

  function applyScript(idx: string) {
    setScriptedIdx(idx);
    const scripted = SCRIPTED_REPLIES[Number(idx)];
    if (scripted && scripted.text) setBodyText(scripted.text);
  }

  async function handleSimulate() {
    if (!phoneE164 || !bodyText.trim()) return;
    await simulate.mutateAsync({ phoneE164, bodyText: bodyText.trim() });
    setBodyText('');
  }

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4 text-amber-600" />
          סמלץ תשובת לקוח
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
            מצב דמו
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          מדמה הודעה נכנסת מ-WhatsApp כפי שהיא תגיע מ-heyy. הקוד הולך דרך
          <code className="mx-1 px-1 py-0.5 rounded bg-muted text-[10px]">/api/heyy-webhook</code>
          ומתנהג בדיוק כמו ב-production.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">בחר לקוח (או הזן טלפון ידני)</Label>
            <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="-- בחר הזמנה --" />
              </SelectTrigger>
              <SelectContent>
                {ordersWithPhone.slice(0, 50).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.customerName} ({o.phone})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedOrderId && (
              <Input
                placeholder="0523694547"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                dir="ltr"
                className="h-9"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">תרחיש מהיר</Label>
            <Select value={scriptedIdx} onValueChange={applyScript}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCRIPTED_REPLIES.map((s, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">תוכן ההודעה</Label>
          <Input
            placeholder='הקלד תשובה — לדוגמה "מתאים", "אחה"צ עדיף", "בטל"'
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {phoneE164 ? (
              <span>שולח כ-<span dir="ltr" className="font-mono">{phoneE164}</span></span>
            ) : (
              <span className="text-red-600">מספר טלפון חסר</span>
            )}
          </p>
          <Button
            onClick={handleSimulate}
            disabled={!phoneE164 || !bodyText.trim() || simulate.isPending}
            size="sm"
          >
            {simulate.isPending ? 'שולח...' : 'סמלץ תשובה'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
