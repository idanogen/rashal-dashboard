import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InboundMessagesPanel } from '@/components/whatsapp/InboundMessagesPanel';
import { OutboundLog } from '@/components/whatsapp/OutboundLog';
import { DemoSimulator } from '@/components/whatsapp/DemoSimulator';
import { FullFlowDemo } from '@/components/whatsapp/FullFlowDemo';
import { TEMPLATES, isPlaceholderTemplate } from '@/lib/heyy/templates';
import { isDemoMode } from '@/lib/heyy/client';
import { MessageCircle, AlertTriangle, FileText, Play } from 'lucide-react';
import { useState } from 'react';

export function WhatsAppPage() {
  const demo = isDemoMode();
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  async function triggerDailyCron() {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch('/api/cron-daily-reminders', { method: 'POST' });
      const json = await res.json();
      setTriggerResult(JSON.stringify(json, null, 2));
    } catch (err) {
      setTriggerResult(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">WhatsApp — מרכז הודעות</h1>
            <p className="text-sm text-muted-foreground">
              תקשורת ישירה עם לקוחות דרך WhatsApp Business (heyy.io)
            </p>
          </div>
        </div>
        {demo && (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            🚧 מצב דמו פעיל — אין שליחה אמיתית
          </Badge>
        )}
      </div>

      {demo && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold">המערכת רצה במצב דמו</p>
              <p className="text-muted-foreground">
                כל "שליחה" נשמרת כלוג בלבד ולא יוצאת ל-WhatsApp. כשתקבל אישור heyy + templates מאושרים מ-Meta:
                <br />
                1. הגדר ב-Vercel: <code className="px-1 py-0.5 rounded bg-muted text-xs">HEYY_MODE=real</code>
                + <code className="px-1 py-0.5 rounded bg-muted text-xs">HEYY_API_KEY</code> + <code className="px-1 py-0.5 rounded bg-muted text-xs">HEYY_CHANNEL_ID</code>
                <br />
                2. עדכן את ה-templateId-ים האמיתיים ב-<code className="px-1 py-0.5 rounded bg-muted text-xs">src/lib/heyy/templates.ts</code>
                <br />
                3. הגדר ב-heyy UI את ה-webhook להצביע על <code className="px-1 py-0.5 rounded bg-muted text-xs">/api/heyy-webhook</code>
                <br />
                <span className="text-xs italic">פירוט מלא ב-<code className="px-1 py-0.5 rounded bg-muted text-xs">docs/heyy-setup.md</code></span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={demo ? 'flow' : 'inbox'} dir="rtl">
        <TabsList>
          {demo && <TabsTrigger value="flow">🎬 דמו מלא</TabsTrigger>}
          <TabsTrigger value="inbox">📥 הודעות נכנסות</TabsTrigger>
          <TabsTrigger value="sent">📤 יוצאות</TabsTrigger>
          <TabsTrigger value="templates">📝 Templates</TabsTrigger>
          <TabsTrigger value="cron">⏰ תזכורת יומית</TabsTrigger>
        </TabsList>

        {demo && (
          <TabsContent value="flow" className="space-y-4">
            <FullFlowDemo />
            <p className="text-xs text-muted-foreground text-center">
              ↑ אחרי שתסיים את הדמו, עבור לטאב "📤 יוצאות" כדי לראות את הלוג של הבקשה ששלחת, ו-"📥 הודעות נכנסות" לתשובה.
            </p>
          </TabsContent>
        )}

        <TabsContent value="inbox" className="space-y-4">
          {demo && <DemoSimulator />}
          <InboundMessagesPanel />
        </TabsContent>

        <TabsContent value="sent" className="space-y-4">
          <OutboundLog />
        </TabsContent>

        <TabsContent value="templates" className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>Templates רשומים במערכת</span>
              </div>
              <p className="text-xs text-muted-foreground">
                כל template צריך להירשם ב-heyy UI ולקבל אישור מ-Meta (24-48h). אחרי האישור, עדכן את ה-templateId כאן: <code className="px-1 py-0.5 rounded bg-muted text-xs">src/lib/heyy/templates.ts</code>
              </p>
              <div className="space-y-2">
                {Object.values(TEMPLATES).map((t) => {
                  const placeholder = isPlaceholderTemplate(t.templateId);
                  return (
                    <div key={t.kind} className="rounded-lg border p-3 bg-card">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-semibold text-sm">{t.label}</span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]" dir="ltr">{t.kind}</Badge>
                          {placeholder ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                              ממתין לאישור Meta
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                              פעיל
                            </Badge>
                          )}
                        </div>
                      </div>
                      <pre className="text-xs whitespace-pre-wrap bg-muted/40 rounded p-2 font-sans">{t.bodyPreview}</pre>
                      <div className="mt-2 text-xs text-muted-foreground">
                        פרמטרים: {t.paramLabels.map((l, i) => `{{${i + 1}}}=${l}`).join(' • ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cron" className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold mb-1">תזכורת יומית אוטומטית</p>
                <p className="text-xs text-muted-foreground">
                  רצה כל יום ב-06:00 UTC (~08:00–09:00 ישראל) דרך Vercel Cron. שולחת template <code className="px-1 rounded bg-muted text-[10px]">delivery_reminder</code>
                  לכל הזמנה עם <code className="px-1 rounded bg-muted text-[10px]">delivery_date = today</code> וסטטוס ≠ "סופק"/"אין במלאי".
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={triggerDailyCron} disabled={triggering} size="sm" className="gap-1.5">
                  <Play className="h-3.5 w-3.5" />
                  {triggering ? 'מריץ...' : 'הרץ עכשיו ידנית'}
                </Button>
                <span className="text-xs text-muted-foreground">בודק את הזרימה בלי לחכות ל-08:00</span>
              </div>
              {triggerResult && (
                <pre className="text-xs bg-muted/40 rounded p-2 max-h-64 overflow-auto" dir="ltr">
                  {triggerResult}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
