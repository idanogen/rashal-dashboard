import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, MapPin, FileText, User, Building2, Calendar, Clock } from 'lucide-react';
import type { Order } from '@/types/order';
import { OrderStatusBadge } from './OrderStatusBadge';
import { StatusDropdown } from './StatusDropdown';
import { getTaskStatusLabel } from '@/lib/constants';
import { getDaysSinceCreated, getDaysColor } from '@/lib/utils';

interface OrderDetailDialogProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
}

export function OrderDetailDialog({ order, open, onClose }: OrderDetailDialogProps) {
  if (!order) return null;

  const googleMapsUrl = order.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${order.address}${order.city ? ', ' + order.city : ''}`
      )}`
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            {order.customerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Status Section */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                סטטוס הזמנה
              </label>
              <StatusDropdown
                orderId={order.id}
                currentValue={order.orderStatus}
                type="orderStatus"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                סטטוס טיפול
              </label>
              <StatusDropdown
                orderId={order.id}
                currentValue={order.status}
                type="status"
              />
            </div>
          </div>

          {/* Info Grid */}
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            {/* Phone */}
            {order.phone && (
              <InfoRow icon={Phone} label="טלפון">
                <a
                  href={`tel:${order.phone}`}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  dir="ltr"
                >
                  {order.phone}
                </a>
              </InfoRow>
            )}

            {/* Address */}
            {(order.address || order.city) && (
              <InfoRow icon={MapPin} label="כתובת">
                <div className="flex items-center gap-2">
                  <span>
                    {order.address}
                    {order.address && order.city ? ', ' : ''}
                    {order.city}
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

            {/* Health Fund */}
            {order.healthFund && (
              <InfoRow icon={Building2} label="קופ״ח">
                {order.healthFund}
              </InfoRow>
            )}

            {/* Customer Status */}
            {order.customerStatus && (
              <InfoRow icon={User} label="סוג לקוח">
                <Badge variant="outline" className="text-xs">
                  {order.customerStatus}
                </Badge>
              </InfoRow>
            )}

            {/* Opened By */}
            {order.openedBy && (
              <InfoRow icon={User} label="נפתח ע״י">
                {order.openedBy}
              </InfoRow>
            )}

            {/* Agent */}
            {order.agent && (
              <InfoRow icon={User} label="סוכן">
                {order.agent}
              </InfoRow>
            )}

            {/* Fax */}
            {order.fax && (
              <InfoRow icon={FileText} label="פקס">
                <span dir="ltr">{order.fax}</span>
              </InfoRow>
            )}

            {/* Created */}
            {order.created && (
              <InfoRow icon={Calendar} label="תאריך יצירה">
                {new Date(order.created).toLocaleDateString('he-IL')}
                {(() => {
                  const days = getDaysSinceCreated(order.created);
                  if (days === null) return null;
                  return (
                    <span className={`mr-1 font-semibold ${getDaysColor(days)}`}>
                      ({days === 0 ? 'היום' : `לפני ${days} ימים`})
                    </span>
                  );
                })()}
              </InfoRow>
            )}
          </div>

          {/* Documents */}
          {order.documents && order.documents.length > 0 && (
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">
                מסמכים ({order.documents.length})
              </label>
              <div className="space-y-1.5">
                {order.documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md border bg-card p-2 text-sm hover:bg-accent transition-colors"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate flex-1">{doc.filename}</span>
                    <span className="text-xs text-muted-foreground">
                      {(doc.size / 1024).toFixed(0)} KB
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
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
