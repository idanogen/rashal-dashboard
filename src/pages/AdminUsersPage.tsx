import { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Loader2,
  Search,
  Trash2,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  Copy,
  AlertCircle,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAllProfiles, useAdminMutation, useCurrentProfile } from '@/hooks/useProfile';
import { ALLOWED_ROLES, ROLE_LABELS, type UserRole } from '@/types/profile';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Profile } from '@/types/profile';

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  admin: 'bg-purple-50 text-purple-700 border-purple-200',
  dispatcher: 'bg-blue-50 text-blue-700 border-blue-200',
  driver: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  viewer: 'bg-gray-50 text-gray-600 border-gray-200',
};

export function AdminUsersPage() {
  const { data: profiles, isLoading } = useAllProfiles();
  const { data: currentProfile } = useCurrentProfile();
  const adminMutation = useAdminMutation();
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resultDialog, setResultDialog] = useState<{ email: string; password: string } | null>(null);

  const filtered = useMemo(() => {
    const items = profiles ?? [];
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (p) =>
        p.email.toLowerCase().includes(q) ||
        (p.fullName ?? '').toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  async function handleSetRole(userId: string, role: UserRole) {
    const res = await adminMutation.mutateAsync({ action: 'set_role', userId, role });
    if (res.ok) toast.success('תפקיד עודכן');
  }

  async function handleToggleDisabled(userId: string, currentlyDisabled: boolean) {
    const res = await adminMutation.mutateAsync({
      action: 'set_disabled',
      userId,
      disabled: !currentlyDisabled,
    });
    if (res.ok) toast.success(currentlyDisabled ? 'משתמש הופעל' : 'משתמש הושבת');
  }

  async function handleResetPassword(userId: string, email: string) {
    if (!confirm(`לאפס סיסמה עבור ${email}? תקבל סיסמה זמנית חדשה.`)) return;
    const res = await adminMutation.mutateAsync({ action: 'reset_password', userId });
    if (res.ok && res.tempPassword) {
      setResultDialog({ email, password: res.tempPassword });
    }
  }

  async function handleDelete(userId: string, email: string) {
    if (!confirm(`למחוק את ${email}? פעולה לא הפיכה.`)) return;
    const res = await adminMutation.mutateAsync({ action: 'delete', userId });
    if (res.ok) toast.success(`${email} נמחק`);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
            <Users className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ניהול משתמשים</h1>
            <p className="text-sm text-muted-foreground">
              הוספה, השבתה, איפוס סיסמאות ושינוי תפקידים
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          הוסף משתמש
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="relative w-64">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי אימייל / שם / תפקיד..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 ps-7"
              />
            </div>
            {profiles && (
              <span className="text-xs text-muted-foreground">
                {filtered.length} מתוך {profiles.length} משתמשים
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {profiles?.length ? 'לא נמצאו משתמשים לפי הסינון' : 'אין משתמשים — הוסף את הראשון'}
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs font-semibold">משתמש</TableHead>
                    <TableHead className="text-xs font-semibold">תפקיד</TableHead>
                    <TableHead className="text-xs font-semibold">סטטוס</TableHead>
                    <TableHead className="text-xs font-semibold">נוצר</TableHead>
                    <TableHead className="text-xs font-semibold text-center">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <UserRow
                      key={p.id}
                      profile={p}
                      isSelf={p.id === currentProfile?.id}
                      busy={adminMutation.isPending}
                      onChangeRole={(role) => handleSetRole(p.id, role)}
                      onToggleDisabled={() => handleToggleDisabled(p.id, p.disabled)}
                      onResetPassword={() => handleResetPassword(p.id, p.email)}
                      onDelete={() => handleDelete(p.id, p.email)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={(email, password) => setResultDialog({ email, password })}
      />
      <CredentialsDialog result={resultDialog} onClose={() => setResultDialog(null)} />
    </div>
  );
}

interface UserRowProps {
  profile: Profile;
  isSelf: boolean;
  busy: boolean;
  onChangeRole: (role: UserRole) => void;
  onToggleDisabled: () => void;
  onResetPassword: () => void;
  onDelete: () => void;
}

function UserRow({ profile, isSelf, busy, onChangeRole, onToggleDisabled, onResetPassword, onDelete }: UserRowProps) {
  return (
    <TableRow className={profile.disabled ? 'opacity-50' : ''}>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-semibold text-sm">{profile.fullName || '—'}</span>
          <span className="text-xs text-muted-foreground" dir="ltr">
            {profile.email}
          </span>
          {isSelf && (
            <Badge variant="outline" className="w-fit mt-1 text-[10px] bg-blue-50 text-blue-700 border-blue-200">
              זה אתה
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Select value={profile.role} onValueChange={(v) => onChangeRole(v as UserRole)} disabled={busy}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue>
              <Badge variant="outline" className={`text-[11px] ${ROLE_BADGE_STYLES[profile.role]}`}>
                {ROLE_LABELS[profile.role]}
              </Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ALLOWED_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        {profile.disabled ? (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[11px]">
            <ShieldOff className="h-2.5 w-2.5 me-1" /> מושבת
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]">
            <ShieldCheck className="h-2.5 w-2.5 me-1" /> פעיל
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {new Date(profile.createdAt).toLocaleDateString('he-IL')}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetPassword}
            disabled={busy || profile.disabled}
            title="אפס סיסמה"
          >
            <KeyRound className="h-3.5 w-3.5 text-amber-600" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleDisabled}
            disabled={busy || isSelf}
            title={profile.disabled ? 'הפעל' : 'השבת'}
          >
            {profile.disabled ? (
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <ShieldOff className="h-3.5 w-3.5 text-orange-600" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={busy || isSelf}
            title="מחק"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-600" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (email: string, password: string) => void;
}

function CreateUserDialog({ open, onOpenChange, onCreated }: CreateUserDialogProps) {
  const adminMutation = useAdminMutation();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [mode, setMode] = useState<'create' | 'invite'>('create');

  function reset() {
    setEmail('');
    setFullName('');
    setRole('viewer');
    setMode('create');
  }

  async function handleSubmit() {
    if (!email.trim()) return;
    const trimmedEmail = email.trim();
    const action: Parameters<typeof adminMutation.mutateAsync>[0] = mode === 'invite'
      ? { action: 'invite', email: trimmedEmail, fullName: fullName.trim() || undefined, role }
      : { action: 'create', email: trimmedEmail, fullName: fullName.trim() || undefined, role };

    const res = await adminMutation.mutateAsync(action);
    if (!res.ok) return;

    if (mode === 'invite') {
      toast.success(`הזמנה נשלחה ל-${trimmedEmail}`);
    } else if (res.tempPassword) {
      onCreated(trimmedEmail, res.tempPassword);
    }
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-purple-600" />
            הוסף משתמש חדש
          </DialogTitle>
          <DialogDescription>
            בחר אם לייצר משתמש עם סיסמה זמנית (העתק ידני אליו) או לשלוח לו הזמנה ב-email.
          </DialogDescription>
        </DialogHeader>

        {/* Mode tabs */}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === 'create' ? 'default' : 'outline'}
            onClick={() => setMode('create')}
            className="flex-1"
          >
            צור עם סיסמה זמנית
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'invite' ? 'default' : 'outline'}
            onClick={() => setMode('invite')}
            className="flex-1"
          >
            שלח הזמנה ב-email
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-email" className="text-xs">אימייל *</Label>
            <Input
              id="new-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-name" className="text-xs">שם מלא (אופציונלי)</Label>
            <Input
              id="new-name"
              placeholder="ישראל ישראלי"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">תפקיד</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALLOWED_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={!email.trim() || adminMutation.isPending}>
            {adminMutation.isPending ? 'שולח...' : mode === 'invite' ? 'שלח הזמנה' : 'צור משתמש'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CredentialsDialogProps {
  result: { email: string; password: string } | null;
  onClose: () => void;
}

function CredentialsDialog({ result, onClose }: CredentialsDialogProps) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    if (!result) return;
    const text = `אימייל: ${result.email}\nסיסמה: ${result.password}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={!!result} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertCircle className="h-5 w-5" />
            סיסמה זמנית
          </DialogTitle>
          <DialogDescription>
            <strong>זה התצוגה היחידה של הסיסמה.</strong> העתק ושלח למשתמש מיידית. הוא יוכל לשנות אותה אחרי ההתחברות הראשונה.
          </DialogDescription>
        </DialogHeader>
        {result && (
          <div className="rounded-lg border bg-amber-50/50 p-3 space-y-2 font-mono text-sm" dir="ltr">
            <div>
              <span className="text-xs text-muted-foreground">Email:</span>
              <div className="font-semibold">{result.email}</div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Password:</span>
              <div className="font-semibold text-lg select-all">{result.password}</div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={copyAll} className="gap-1.5">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'הועתק!' : 'העתק שניהם'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            סגור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
