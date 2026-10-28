import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Check, ClipboardList, GripVertical, Trash2, X } from 'lucide-react';
import type { CalendarDelivery, CalendarStop } from '@/types/delivery';
import { ReturnedNote } from '@/components/ReturnedNote';
import { CoordinationStatusBadge } from '@/components/whatsapp/CoordinationStatusBadge';
import { OrderChatButton } from '@/components/OrderChatButton';
import { StopDocChip } from '@/components/deliveries/StopDocChip';
import { StopCardContact } from '@/components/deliveries/StopCardContact';
import { StopCardActions } from '@/components/deliveries/StopCardActions';
import type { StopDocState } from '@/hooks/useStopDocs';
import { stopDocChips } from '@/lib/stop-docs';
import { infoButtonLabel } from '@/lib/call-info';
import { SOURCE_META } from '@/lib/calendar-meta';

/**
 * כרטיס עצירה ביומן. הוצא מ-`DeliveryCalendar.tsx` ב-28/10/2026 (הקובץ היה
 * 1,057 שורות). פרטי הקשר ב-`StopCardContact`, כפתורי הפעולה ב-`StopCardActions`.
 */
export interface StopCardProps {
  stop: CalendarStop;
  delivery: CalendarDelivery;
  onRemove?: (stopId: string) => void;
  onResolve?: (stopId: string, status: 'completed' | 'not_completed') => void;
  onCoordinate?: (stop: CalendarStop) => void;
  onMoveStop?: (stopId: string) => void;
  /** כרטיס שירות: פתיחת כרטיס הקריאה (פריוריטי + מה שהלקוח שלח). */
  onOpenInfo?: (stop: CalendarStop) => void;
  /** יש טופס קריאה מהמייל (עידן, 19/10/2026: "שיהיה חיווי לקובץ"). */
  hasDoc?: boolean;
  /** תעודת משלוח וטפסים חתומים על העצירה (עידן, 21/10/2026). */
  docs?: StopDocState;
  /** עריכת כתובת, עיר וטלפון של העצירה (עמי, 07/10/2026). */
  onEditDetails?: (stop: CalendarStop) => void;
}

export function CalendarStopCard({ stop, delivery, onRemove, onResolve, onCoordinate, onMoveStop, onOpenInfo, onEditDetails, hasDoc, docs }: StopCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const prevCoordRef = useRef<typeof stop.coordinationStatus>(stop.coordinationStatus);

  // Confetti + flash when status transitions to customer_confirmed
  useEffect(() => {
    const prev = prevCoordRef.current;
    if (stop.coordinationStatus === 'customer_confirmed' && prev !== 'customer_confirmed') {
      const el = cardRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        confetti({
          particleCount: 60,
          spread: 50,
          startVelocity: 25,
          origin: {
            x: (rect.left + rect.width / 2) / window.innerWidth,
            y: (rect.top + rect.height / 2) / window.innerHeight,
          },
          colors: ['#10b981', '#34d399', '#6ee7b7', '#fef08a'],
          scalar: 0.8,
        });
      }
    }
    prevCoordRef.current = stop.coordinationStatus;
  }, [stop.coordinationStatus]);

  // Sortable — sortable-drag רק כשעוצמת ה-stop לא resolved
  const isResolved = stop.status === 'completed' || stop.status === 'not_completed';
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: stop.stopId,
    data: {
      type: 'stop',
      stopId: stop.stopId,
      deliveryDate: delivery.date,
      driver: delivery.driver,
    },
    disabled: isResolved,
  });

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // אייקון + צבע + פס-צד לפי סוג מקור
  const src = SOURCE_META[stop.sourceType] ?? SOURCE_META.delivery;
  const SrcIcon = src.Icon;

  // רקע לפי סטטוס
  const isCustomerConfirmed = stop.coordinationStatus === 'customer_confirmed';
  const isCustomerRejected = stop.coordinationStatus === 'customer_rejected';
  // עצירה מתואמת ששובצה מחדש — צריך לבטל את התיאום מול הלקוח.
  const needsCancel = !!stop.coordinationNeedsCancel && !isResolved;
  const statusBg =
    stop.status === 'completed'
      ? 'bg-emerald-50/80 dark:bg-emerald-900/20'
      : stop.status === 'not_completed'
        ? 'bg-red-50/60 dark:bg-red-900/20'
        : isCustomerConfirmed
          ? 'bg-emerald-100/80 ring-2 ring-emerald-400/60 dark:bg-emerald-900/40'
          : isCustomerRejected
            ? 'bg-red-50/70 ring-1 ring-red-300/60 dark:bg-red-900/30'
            : 'bg-background/60';
  // "לא בוצע" מסומן כבר ע"י ה-X האדום והרקע הוורוד — בלי קו חוצה על השם,
  // כדי שהשם יישאר קריא.
  const nameClass =
    stop.status === 'not_completed'
      ? 'text-muted-foreground'
      : '';

  // Combine the sortable ref + our own ref (for confetti positioning)
  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    cardRef.current = node;
  };

  // ⭐ עידן, 15/09/2026: לחיצה על כרטיס שירות ביומן פותחת את כל מה שיש על הקריאה,
  // כמו אצל הנהג. גרירה מתחילה רק אחרי 6 פיקסלים, ולכן לחיצה לא מתנגשת בה.
  // 08/10/2026 (עמי): גם אספקה ואיסוף פותחים כרטיס (מה לספק, מה לאסוף).
  const infoLabel = infoButtonLabel(stop.sourceType, !!stop.sourceId && stop.sourceId !== stop.stopId);
  const openInfo = infoLabel && onOpenInfo ? () => onOpenInfo(stop) : undefined;
  const docChips = stopDocChips({
    sourceType: stop.sourceType,
    noteDocno: docs?.noteDocno,
    signedCount: docs?.signed.length,
    hasCallDoc: hasDoc,
    craneKind: docs?.craneKind,
    craneSigned: docs?.craneSigned,
    completed: stop.status === 'completed',
  });

  return (
    <div
      ref={setRefs}
      onClick={openInfo}
      style={sortableStyle}
      className={`
        group relative rounded-lg border-s-[5px] ${src.border} border ${statusBg}
        p-3 transition-all duration-300 hover:shadow-md
        ${needsCancel ? 'ring-2 ring-amber-500/80 bg-amber-50/70 dark:bg-amber-900/25' : ''}
        ${isCustomerConfirmed && !needsCancel ? 'shadow-md shadow-emerald-200/50' : ''}
        ${!isResolved ? 'cursor-grab active:cursor-grabbing' : ''}
      `}
      {...(isResolved ? {} : { ...listeners, ...attributes })}
    >
      {/* Needs-cancel ribbon — overrides the confirmed ribbon */}
      {needsCancel ? (
        <div className="absolute top-0 start-0 flex items-center gap-1 rounded-tr-lg rounded-es-lg bg-amber-500
          px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
          ⚠ יש לבטל תיאום
        </div>
      ) : (
        isCustomerConfirmed && (
          <div className="absolute top-0 start-0 flex items-center gap-1 rounded-tr-lg rounded-es-lg bg-emerald-500
            px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            <Check className="h-2.5 w-2.5" />
            הלקוח אישר
          </div>
        )
      )}
      {/* Top row: source icon + customer name + driver badge + action buttons */}
      <div className={`flex items-center justify-between gap-1.5 ${isCustomerConfirmed || needsCancel ? 'mt-3' : ''}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${src.bg} ${src.color} flex-shrink-0`}
            title={src.label}
          >
            <SrcIcon className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {(() => {
            // אותה לוגיקת עוגן כמו אצל הנהג: משלוח/שירות → הישות; משימה/איסוף
            // → calendar_stop (kind='stop'), כדי שהשיחה תהיה משותפת בשני הצדדים.
            const isService = stop.sourceType === 'service' && !!stop.sourceId;
            const isDelivery = stop.sourceType === 'delivery' && !!stop.sourceId;
            const chatKind = isService ? 'service' : isDelivery ? 'order' : 'stop';
            const chatId = isService || isDelivery ? stop.sourceId! : stop.stopId;
            return (
              <span onClick={(e) => e.stopPropagation()}>
                <OrderChatButton
                  order={{
                    id: chatId,
                    kind: chatKind,
                    customerName: stop.customerName,
                    city: stop.city,
                  }}
                />
              </span>
            );
          })()}
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(stop.stopId);
              }}
              className="h-6 w-6 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
              title="הסר מהיומן"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          )}
        </div>
      </div>

      {/* שם הלקוח — שורה נפרדת ברוחב מלא, כדי שלא יידחס ע"י התג/הפעולות */}
      <div className="flex items-center gap-1.5 min-w-0 mt-1 mb-1.5">
        <span
          className={`font-semibold text-sm truncate min-w-0 ${nameClass}`}
          title={stop.customerName}
        >
          {stop.customerName}
        </span>
        {stop.status === 'completed' && (
          <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" aria-label="בוצע" />
        )}
        {stop.status === 'not_completed' && (
          <X className="h-4 w-4 text-red-600 flex-shrink-0" aria-label="לא בוצע" />
        )}
      </div>

      <StopCardContact stop={stop} isResolved={isResolved} onEditDetails={onEditDetails} />

      {openInfo && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openInfo();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700 hover:bg-orange-100"
          title="תאור התקלה מפריוריטי, תמונות וסרטונים מהלקוח והערת המשרד"
        >
          <ClipboardList className="h-3 w-3" />
          {infoLabel}
        </button>
      )}

      {/* מסמכים מצורפים: תעודה, טופס חתום, טופס קריאה */}
      {docChips.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {docChips.map((c) => (
            <StopDocChip key={c.kind} chip={c} stopId={stop.stopId} docs={docs} onOpenCallInfo={openInfo} />
          ))}
        </div>
      )}

      {/* Scheduling stamp — who scheduled / rescheduled */}
      {(stop.scheduledBy || stop.rescheduledBy) && (
        <p className="mt-1 truncate text-[10px] text-muted-foreground/70">
          {stop.scheduledBy && `שובץ ע״י ${stop.scheduledBy}`}
          {stop.rescheduledBy && ` · ↻ ${stop.rescheduledBy}`}
        </p>
      )}

      {/* Coordination status indicators */}
      {((stop.coordinationStatus && !isCustomerConfirmed) ||
        (stop.timeWindowStart && stop.timeWindowEnd)) && (
        <div className="flex items-center flex-wrap gap-1.5 mt-2">
          {stop.coordinationStatus && !isCustomerConfirmed && (
            <CoordinationStatusBadge status={stop.coordinationStatus} showLabel className="text-[11px] py-0.5" />
          )}
          {stop.timeWindowStart && stop.timeWindowEnd && (
            <span
              className={`text-xs font-medium ${
                isCustomerConfirmed ? 'text-emerald-700 font-bold' : 'text-muted-foreground'
              }`}
              dir="ltr"
            >
              🕐 {stop.timeWindowStart}–{stop.timeWindowEnd}
            </span>
          )}
        </div>
      )}

      <StopCardActions stop={stop} isResolved={isResolved} onCoordinate={onCoordinate} onResolve={onResolve} />

      {/* הסיבה שהעצירה לא בוצעה, צמודה לאיקס שהיא מסבירה. בלי זה המנהל
          רואה איקס אדום וחוזר לטלפן לנהג ולשאול למה. */}
      {stop.status === 'not_completed' && (
        <ReturnedNote
          info={{
            stopId: stop.stopId,
            note: stop.resolutionNote ?? null,
            driver: stop.driver,
            deliveryDate: stop.deliveryDate,
            kind: stop.resolutionKind,
          }}
        />
      )}

      {/* עצירה שלא בוצעה — אפשר להעביר ליום אחר (נעולה לגרירה) */}
      {stop.status === 'not_completed' && onMoveStop && (
        <div className="mt-2.5 pt-2 border-t border-border/40">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveStop(stop.stopId);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full flex items-center justify-center gap-1 rounded-md bg-blue-500/10 px-2 py-1.5 text-xs font-semibold text-blue-700
              hover:bg-blue-500/20
              dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors"
            title="העבר את הקריאה ליום אחר"
          >
            <Calendar className="h-3.5 w-3.5" />
            העבר ליום אחר
          </button>
        </div>
      )}
    </div>
  );
}
