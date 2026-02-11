import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Order } from '@/types/order';
import { getDaysColor } from '@/lib/utils';

interface DraggableRouteListProps {
  /** הזמנות במסלול */
  orders: Order[];
  /** קריאה חוזרת לשינוי סדר */
  onReorder: (newOrders: Order[]) => void;
  /** קריאה חוזרת להסרת הזמנה */
  onRemove: (orderId: string) => void;
}

/**
 * רשימת הזמנות עם גרירה לסידור מחדש
 */
export function DraggableRouteList({
  orders,
  onReorder,
  onRemove,
}: DraggableRouteListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = orders.findIndex((order) => order.id === active.id);
      const newIndex = orders.findIndex((order) => order.id === over.id);

      const newOrders = arrayMove(orders, oldIndex, newIndex);
      onReorder(newOrders);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={orders.map((o) => o.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {orders.map((order, index) => (
            <SortableRouteItem
              key={order.id}
              order={order}
              index={index}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

/**
 * פריט בודד ברשימה (ניתן לגרירה)
 */
function SortableRouteItem({
  order,
  index,
  onRemove,
}: {
  order: Order;
  index: number;
  onRemove: (orderId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const days = order.created
    ? Math.floor(
        (Date.now() - new Date(order.created).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;
  const daysColor = getDaysColor(days);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border bg-background p-3 transition-colors hover:bg-muted/30"
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="גרור לסידור מחדש"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* מספר */}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {index + 1}
      </span>

      {/* פרטי הזמנה */}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-semibold text-sm">{order.customerName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {order.address}, {order.city}
        </p>
      </div>

      {/* Badge ימים */}
      {days !== null && (
        <Badge
          variant="outline"
          className={`shrink-0 text-xs ${daysColor}`}
        >
          {days}
        </Badge>
      )}

      {/* כפתור הסרה */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(order.id)}
        className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
        aria-label="הסר מהמסלול"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
