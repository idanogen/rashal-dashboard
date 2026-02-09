import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ORDER_STATUS_OPTIONS, TASK_STATUS_OPTIONS } from '@/lib/constants';
import { useUpdateOrder } from '@/hooks/useUpdateOrder';

interface StatusDropdownProps {
  orderId: string;
  currentValue: string | undefined;
  type: 'orderStatus' | 'status';
}

export function StatusDropdown({ orderId, currentValue, type }: StatusDropdownProps) {
  const { mutate } = useUpdateOrder();

  const options = type === 'orderStatus' ? ORDER_STATUS_OPTIONS : TASK_STATUS_OPTIONS;

  function handleChange(value: string) {
    if (value !== currentValue) {
      mutate({ id: orderId, fields: { [type]: value } as Record<string, string> });
    }
  }

  return (
    <Select value={currentValue || ''} onValueChange={handleChange}>
      <SelectTrigger className="h-7 w-[130px] text-xs border-dashed">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
