import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  MapPin,
  Wrench,
  User,
  Building2,
  Calendar,
  Cpu,
  Hash,
  ShieldCheck,
  AlertTriangle,
  Tag,
} from 'lucide-react';
import type { ServiceCall } from '@/types/service-call';
import { CustomerHistoryButton } from '@/components/CustomerHistoryButton';
import { OrderChatButton } from '@/components/OrderChatButton';
import { getDaysSinceCreated, getDaysColor } from '@/lib/utils';

interface ServiceCallDetailDialogProps {
  call: ServiceCall | null;
  open: boolean;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  'קריאה חדשה': 'bg-amber-100 text-amber-800',
  'תואם ביקור': 'bg-blue-100 text-blue-800',
  'בוצע': 'bg-green-100 text-green-800',
  'בוטל': 'bg-gray-100 text-gray-600',
};

function fmtDate(v?: string) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString('he-IL');
}

export function ServiceCallDetailDialog({ call, open, onClose }: ServiceCallDetailDialogProps) {
  if (!call) return null;

  const googleMapsUrl = call.address || call.city
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${call.address ?? ''}${call.address && call.city ? ', ' : ''}${call.city ?? ''}`
      )}`
    : null;

  const hasFault = call.faultDesc || call.symptomDesc || call.callType || call.serviceType;
  const hasDevice =
    call.deviceName || call.deviceSerial || call.deviceDesc || call.warrantyUntil || call.installDate;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
              <Wrench className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate">{call.customerName}</span>
            {call.serviceCallStatus && (
              <Badge
                variant="outline"
                className={`border-0 text-xs ${STATUS_COLORS[call.serviceCallStatus] ?? 'bg-gray-100 text-gray-700'}`}
              >
                {call.serviceCallStatus}
              </Badge>
            )}
          </DialogTitle>
          {call.customerNumber && (
            <p className="ps-10 text-xs text-muted-foreground" dir="ltr">
              מס' לקוח: {call.customerNumber}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* תקלה */}
          {hasFault && (
            <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/10">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                פרטי התקלה
              </h3>
              <div className="space-y-2">
                {call.faultDesc && (
                  <InfoRow icon={AlertTriangle} label="תקלה">
                    {call.faultDesc}
                  </InfoRow>
                )}
                {call.symptomDesc && (
                  <InfoRow icon={AlertTriangle} label="תסמין">
                    {call.symptomDesc}
                  </InfoRow>
                )}
                {call.callType && (
                  <InfoRow icon={Tag} label="סוג קריאה">
                    {call.callType}
                  </InfoRow>
                )}
                {call.serviceType && (
                  <InfoRow icon={Tag} label="סוג שירות">
                    {call.serviceType}
                  </InfoRow>
                )}
              </div>
            </section>
          )}

          {/* מכשיר */}
          {hasDevice && (
            <section className="rounded-lg border bg-muted/30 p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Cpu className="h-3.5 w-3.5" />
                פרטי המכשיר
              </h3>
              <div className="space-y-2">
                {call.deviceName && (
                  <InfoRow icon={Cpu} label="דגם">
                    <bdi>{call.deviceName}</bdi>
                  </InfoRow>
                )}
                {call.deviceSerial && (
                  <InfoRow icon={Hash} label="סריאלי">
                    <bdi dir="ltr">{call.deviceSerial}</bdi>
                  </InfoRow>
                )}
                {call.deviceDesc && (
                  <InfoRow icon={Cpu} label="תיאור">
                    {call.deviceDesc}
                  </InfoRow>
                )}
                {call.warrantyUntil && (
                  <InfoRow icon={ShieldCheck} label="אחריות עד">
                    <span dir="ltr">{fmtDate(call.warrantyUntil)}</span>
                  </InfoRow>
                )}
                {call.installDate && (
                  <InfoRow icon={Calendar} label="תאריך התקנה">
                    <span dir="ltr">{fmtDate(call.installDate)}</span>
                  </InfoRow>
                )}
              </div>
            </section>
          )}

          {/* פרטי לקוח וקשר */}
          <section className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              פרטי לקוח
            </h3>
            {call.phone && (
              <InfoRow icon={Phone} label="טלפון">
                <a
                  href={`tel:${call.phone}`}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  dir="ltr"
                >
                  {call.phone}
                </a>
              </InfoRow>
            )}
            {(call.address || call.city) && (
              <InfoRow icon={MapPin} label="כתובת">
                <div className="flex items-center gap-2">
                  <span>
                    {call.address}
                    {call.address && call.city ? ', ' : ''}
                    {call.city}
                  </span>
                  {googleMapsUrl && (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs text-primary hover:underline"
                    >
                      מפה ↗
                    </a>
                  )}
                </div>
              </InfoRow>
            )}
            {call.healthFund && (
              <InfoRow icon={Building2} label="קופ״ח">
                {call.healthFund}
              </InfoRow>
            )}
            {call.customerStatus && (
              <InfoRow icon={User} label="סוג לקוח">
                <Badge variant="outline" className="text-xs">
                  {call.customerStatus}
                </Badge>
              </InfoRow>
            )}
            {call.openedBy && (
              <InfoRow icon={User} label="נפתח ע״י">
                {call.openedBy}
              </InfoRow>
            )}
            {call.created && (
              <InfoRow icon={Calendar} label="תאריך פתיחה">
                {fmtDate(call.created)}
                {(() => {
                  const days = getDaysSinceCreated(call.created);
                  if (days === null) return null;
                  return (
                    <span className={`me-1 font-semibold ${getDaysColor(days)}`}>
                      ({days === 0 ? 'היום' : `לפני ${days} ימים`})
                    </span>
                  );
                })()}
              </InfoRow>
            )}
          </section>

          {/* פעולות */}
          <div className="flex items-center justify-end gap-2 border-t pt-3">
            <span className="me-auto text-xs text-muted-foreground">היסטוריה ושיחה:</span>
            <CustomerHistoryButton
              size="md"
              customer={{
                currentId: call.id,
                customerNumber: call.customerNumber,
                customerName: call.customerName,
              }}
            />
            <OrderChatButton
              size="md"
              order={{ id: call.id, customerName: call.customerName, city: call.city, kind: 'service' }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <span className="text-muted-foreground">{label}: </span>
        <span>{children}</span>
      </div>
    </div>
  );
}
