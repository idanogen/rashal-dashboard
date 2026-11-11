import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { useCoordinationNote } from '@/hooks/useCoordinationNote';

/** שדה ההערה בדיאלוג התיאום. ההיגיון והסיפור ב-`useCoordinationNote`. */
export function CoordinationNoteField({ note, setNote, dirty, save, saving }: ReturnType<typeof useCoordinationNote>) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="note" className="text-xs">הערה לטכנאי (לא נשלחת ללקוח, מופיעה לו באדום)</Label>
        {dirty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void save()}
            disabled={saving}
            className="h-6 px-2 text-[11px] text-blue-700"
          >
            שמור הערה
          </Button>
        )}
      </div>
      <Textarea
        id="note"
        placeholder='לדוגמה: "לא בבית, הטיפול בבית הספר"'
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="min-h-0 text-sm"
      />
    </div>
  );
}
