import { useState, useMemo, useEffect } from 'react';
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
  Pencil,
  Eye,
  EyeOff,
  RefreshCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAllProfiles, useAdminMutation, useCurrentProfile } from '@/hooks/useProfile';
import { ALLOWED_ROLES, ROLE_LABELS, USERNAME_PATTERN, type UserRole } from '@/types/profile';
import { normalizeUsername } from '@/lib/username';
import { DRIVERS, type DriverName } from '@/types/route';
import { Truck } from 'lucide-react';
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

/** Display handle for a profile — prefers username, falls back to email for legacy seed users. */
function displayHandle(p: Profile): string {
  return p.username ?? p.email;
}

export function AdminUsersPage() {
  const { data: profiles, isLoading } = useAllProfiles();
  const { data: currentProfile } = useCurrentProfile();
  const adminMutation = useAdminMutation();
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resultDialog, setResultDialog] = useState<{ username: string; password: string; title?: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<Profile | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Profile | null>(null);

  const filtered = useMemo(() => {
    const items = profiles ?? [];
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (p) =>
        (p.username ?? '').toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.fullName ?? '').toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  async function handleSetRole(userId: string, role: UserRole) {
    const res = await adminMutation.mutateAsync({ action: 'set_role', userId, role });
    if (res.ok) toast.success('תפקיד עודכן');
  }

  async function handleSetLinkedDriver(userId: string, driver: DriverName | null) {
    const res = await adminMutation.mutateAsync({ action: 'set_linked_driver', userId, linkedDriver: driver });
    if (res.ok) toast.success(driver ? `נקשר לנהג: ${driver}` : 'בוטל הקישור לנהג');
  }

  /** Drivers that aren't yet linked to an active user. */
  const availableDrivers = useMemo(() => {
    const taken = new Set(
      (profiles ?? [])
        .filter((p) => p.linkedDriver && !p.disabled)
        .map((p) => p.linkedDriver as DriverName)
    );
    return DRIVERS.filter((d) => !taken.has(d));
  }, [profiles]);

  async function handleToggleDisabled(userId: string, currentlyDisabled: boolean) {
    const res = await adminMutation.mutateAsync({
      action: 'set_disabled',
      userId,
      disabled: !currentlyDisabled,
    });
    if (res.ok) toast.success(currentlyDisabled ? 'משתמש הופעל' : 'משתמש הושבת');
  }

  async function handleDelete(profile: Profile) {
    if (!confirm(`למחוק את ${displayHandle(profile)}? פעולה לא הפיכה.`)) return;
    const res = await adminMutation.mutateAsync({ action: 'delete', userId: profile.id });
    if (res.ok) toast.success(`${displayHandle(profile)} נמחק`);
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
              הוספה, השבתה, ניהול סיסמאות ושינוי תפקידים — עם שמות משתמש (ללא תלות באימייל)
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
            <div className="relative w-72">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי שם משתמש / שם מלא / תפקיד..."
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
                    <TableHead className="text-xs font-semibold">נהג מקושר</TableHead>
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
                      availableDrivers={availableDrivers}
                      onChangeRole={(role) => handleSetRole(p.id, role)}
                      onChangeLinkedDriver={(d) => handleSetLinkedDriver(p.id, d)}
                      onToggleDisabled={() => handleToggleDisabled(p.id, p.disabled)}
                      onRename={() => setRenameTarget(p)}
                      onSetPassword={() => setPasswordTarget(p)}
                      onDelete={() => handleDelete(p)}
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
        onCreated={(username, password) =>
          setResultDialog({ username, password, title: 'משתמש נוצר' })
        }
      />
      <RenameUserDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
      />
      <SetPasswordDialog
        target={passwordTarget}
        onClose={() => setPasswordTarget(null)}
        onChanged={(username, password) =>
          setResultDialog({ username, password, title: 'סיסמה עודכנה' })
        }
      />
      <CredentialsDialog result={resultDialog} onClose={() => setResultDialog(null)} />
    </div>
  );
}

interface UserRowProps {
  profile: Profile;
  isSelf: boolean;
  busy: boolean;
  availableDrivers: DriverName[];
  onChangeRole: (role: UserRole) => void;
  onChangeLinkedDriver: (driver: DriverName | null) => void;
  onToggleDisabled: () => void;
  onRename: () => void;
  onSetPassword: () => void;
  onDelete: () => void;
}

function UserRow({
  profile,
  isSelf,
  busy,
  availableDrivers,
  onChangeRole,
  onChangeLinkedDriver,
  onToggleDisabled,
  onRename,
  onSetPassword,
  onDelete,
}: UserRowProps) {
  const driverChoices = profile.linkedDriver && !availableDrivers.includes(profile.linkedDriver)
    ? [...availableDrivers, profile.linkedDriver]
    : availableDrivers;
  const NONE_VALUE = '__none__';
  return (
    <TableRow className={profile.disabled ? 'opacity-50' : ''}>
      <TableCell>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-semibold" dir="ltr">
              {profile.username ?? '—'}
            </span>
            {profile.username && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRename}
                disabled={busy}
                title="שנה שם משתמש"
                className="h-5 w-5 p-0"
              >
                <Pencil className="h-3 w-3 text-slate-400" />
              </Button>
            )}
          </div>
          {profile.fullName && (
            <span className="text-xs text-muted-foreground">{profile.fullName}</span>
          )}
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
        {profile.role === 'driver' ? (
          <Select
            value={profile.linkedDriver ?? NONE_VALUE}
            onValueChange={(v) => onChangeLinkedDriver(v === NONE_VALUE ? null : (v as DriverName))}
            disabled={busy}
          >
            <SelectTrigger className="h-8 w-44">
              <SelectValue>
                {profile.linkedDriver ? (
                  <span className="inline-flex items-center gap-1 text-[11px]">
                    <Truck className="h-3 w-3 text-emerald-600" />
                    {profile.linkedDriver}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">— לא מקושר —</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>— לא מקושר —</SelectItem>
              {driverChoices.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        )}
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
            onClick={onSetPassword}
            disabled={busy || profile.disabled}
            title="שנה סיסמה"
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
  onCreated: (username: string, password: string) => void;
}

function generateClientPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function CreateUserDialog({ open, onOpenChange, onCreated }: CreateUserDialogProps) {
  const adminMutation = useAdminMutation();
  const { data: profiles } = useAllProfiles();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [linkedDriver, setLinkedDriver] = useState<DriverName | ''>('');

  const usernameOk = !username || USERNAME_PATTERN.test(normalizeUsername(username));
  const usernameTaken = useMemo(() => {
    if (!username) return false;
    const u = normalizeUsername(username);
    return (profiles ?? []).some((p) => normalizeUsername(p.username ?? '') === u);
  }, [profiles, username]);

  const availableDrivers = useMemo(() => {
    const taken = new Set(
      (profiles ?? [])
        .filter((p) => p.linkedDriver && !p.disabled)
        .map((p) => p.linkedDriver as DriverName)
    );
    return DRIVERS.filter((d) => !taken.has(d));
  }, [profiles]);

  function reset() {
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setFullName('');
    setRole('viewer');
    setLinkedDriver('');
  }

  async function handleSubmit() {
    const u = normalizeUsername(username);
    if (!USERNAME_PATTERN.test(u) || usernameTaken) return;
    const driver = role === 'driver' && linkedDriver ? linkedDriver : undefined;
    const trimmedPassword = password.trim();
    const res = await adminMutation.mutateAsync({
      action: 'create',
      username: u,
      password: trimmedPassword || undefined,
      fullName: fullName.trim() || undefined,
      role,
      linkedDriver: driver,
    });
    if (!res.ok || !res.password) return;
    onCreated(u, res.password);
    reset();
    onOpenChange(false);
  }

  const submitDisabled =
    !username.trim() ||
    !usernameOk ||
    usernameTaken ||
    (role === 'driver' && !linkedDriver) ||
    adminMutation.isPending;

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
            שם משתמש לכניסה למערכת. אין צורך באימייל.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-username" className="text-xs">שם משתמש *</Label>
            <Input
              id="new-username"
              placeholder="rudi / רודי"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              dir="auto"
              className="h-9 font-mono"
              autoComplete="off"
            />
            {username && !usernameOk && (
              <p className="text-xs text-red-600">
                שם משתמש חייב להיות 3-30 תווים: אותיות (עברית או אנגלית), ספרות, נקודה, קו תחתון או מקף — בלי רווחים.
              </p>
            )}
            {usernameTaken && (
              <p className="text-xs text-red-600">שם המשתמש כבר תפוס.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-xs">סיסמה</Label>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="השאר ריק לסיסמה אקראית"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  className="h-9 font-mono pe-8"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPassword(generateClientPassword());
                  setShowPassword(true);
                }}
                title="הגרל סיסמה אקראית"
                className="h-9 px-2"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              לפחות 6 תווים. אם תשאיר ריק — תיוצר סיסמה אקראית.
            </p>
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
            <Select
              value={role}
              onValueChange={(v) => {
                setRole(v as UserRole);
                if (v !== 'driver') setLinkedDriver('');
              }}
            >
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

          {role === 'driver' && (
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Truck className="h-3 w-3" /> איזה נהג? *
              </Label>
              {availableDrivers.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  ⚠ כל הנהגים כבר מקושרים למשתמשים פעילים. השבת משתמש קיים כדי לשחרר נהג, או בחר תפקיד אחר.
                </p>
              ) : (
                <Select value={linkedDriver} onValueChange={(v) => setLinkedDriver(v as DriverName)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="-- בחר נהג --" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDrivers.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                המשתמש יקושר לנהג הזה — הוא יוכל לראות ולעדכן רק את המסלולים שלו.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={submitDisabled}>
            {adminMutation.isPending ? 'יוצר...' : 'צור משתמש'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RenameDialogProps {
  target: Profile | null;
  onClose: () => void;
}

function RenameUserDialog({ target, onClose }: RenameDialogProps) {
  const adminMutation = useAdminMutation();
  const { data: profiles } = useAllProfiles();
  const [value, setValue] = useState('');

  const open = !!target;
  useEffect(() => {
    if (target) setValue(target.username ?? '');
  }, [target]);

  const u = normalizeUsername(value);
  const formatOk = !u || USERNAME_PATTERN.test(u);
  const taken = useMemo(() => {
    if (!target || !u) return false;
    return (profiles ?? []).some(
      (p) => p.id !== target.id && normalizeUsername(p.username ?? '') === u
    );
  }, [profiles, target, u]);

  async function handleSubmit() {
    if (!target || !u || !formatOk || taken) return;
    const res = await adminMutation.mutateAsync({
      action: 'set_username',
      userId: target.id,
      username: u,
    });
    if (res.ok) {
      toast.success(`שם משתמש שונה ל-${u}`);
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-slate-500" />
            שנה שם משתמש
          </DialogTitle>
          <DialogDescription>
            המשתמש יתחבר עם השם החדש בפעם הבאה. הסיסמה לא משתנה.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="rename-input" className="text-xs">שם משתמש חדש</Label>
          <Input
            id="rename-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            dir="auto"
            className="h-9 font-mono"
            autoFocus
          />
          {value && !formatOk && (
            <p className="text-xs text-red-600">3-30 תווים: אותיות (עברית/אנגלית), ספרות, נקודה, קו תחתון או מקף — בלי רווחים.</p>
          )}
          {taken && <p className="text-xs text-red-600">שם המשתמש כבר תפוס.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !u || !formatOk || taken || adminMutation.isPending || u === (target?.username ?? '').toLowerCase()
            }
          >
            {adminMutation.isPending ? 'שומר...' : 'שמור'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SetPasswordDialogProps {
  target: Profile | null;
  onClose: () => void;
  onChanged: (username: string, password: string) => void;
}

function SetPasswordDialog({ target, onClose, onChanged }: SetPasswordDialogProps) {
  const adminMutation = useAdminMutation();
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);

  const open = !!target;
  useEffect(() => {
    if (target) {
      setValue('');
      setShow(false);
    }
  }, [target]);

  async function handleSubmit() {
    if (!target) return;
    const trimmed = value.trim();
    if (trimmed && trimmed.length < 6) return;
    const res = await adminMutation.mutateAsync({
      action: 'set_password',
      userId: target.id,
      password: trimmed || undefined,
    });
    if (res.ok && res.password) {
      onChanged(displayHandle(target), res.password);
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-600" />
            שנה סיסמה
          </DialogTitle>
          <DialogDescription>
            הסיסמה הקיימת תוחלף מיד. תופיע פעם אחת לאחר השמירה — העתק ושלח למשתמש.
          </DialogDescription>
        </DialogHeader>
        {target && (
          <div className="rounded bg-slate-50 border px-3 py-2 text-xs" dir="ltr">
            <span className="text-slate-500">משתמש:</span>{' '}
            <span className="font-mono font-semibold">{displayHandle(target)}</span>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="setpw-input" className="text-xs">סיסמה חדשה</Label>
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Input
                id="setpw-input"
                type={show ? 'text' : 'password'}
                placeholder="השאר ריק להגרלת סיסמה אקראית"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                dir="ltr"
                className="h-9 font-mono pe-8"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setValue(generateClientPassword());
                setShow(true);
              }}
              title="הגרל סיסמה אקראית"
              className="h-9 px-2"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
          {value.trim() && value.trim().length < 6 && (
            <p className="text-xs text-red-600">סיסמה חייבת להיות לפחות 6 תווים.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              adminMutation.isPending || (value.trim().length > 0 && value.trim().length < 6)
            }
          >
            {adminMutation.isPending ? 'מעדכן...' : 'שמור סיסמה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CredentialsDialogProps {
  result: { username: string; password: string; title?: string } | null;
  onClose: () => void;
}

function CredentialsDialog({ result, onClose }: CredentialsDialogProps) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    if (!result) return;
    const text = `שם משתמש: ${result.username}\nסיסמה: ${result.password}`;
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
            {result?.title ?? 'סיסמה זמנית'}
          </DialogTitle>
          <DialogDescription>
            <strong>זה התצוגה היחידה של הסיסמה.</strong> העתק ושלח למשתמש מיידית.
          </DialogDescription>
        </DialogHeader>
        {result && (
          <div className="rounded-lg border bg-amber-50/50 p-3 space-y-2 font-mono text-sm" dir="ltr">
            <div>
              <span className="text-xs text-muted-foreground">Username:</span>
              <div className="font-semibold">{result.username}</div>
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
