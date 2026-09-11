import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldCheck, ShieldX, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

/**
 * המסך שנפתח מקישור האיפוס שנשלח בוואטסאפ.
 *
 * 🔴 **נפתח בלי משתמש מחובר**, כמו מסך הסקר, ולכן הוא חייב לשבת מעל
 * ה-catch-all ב-`App.tsx`. אחרת השומר זורק את מי שנעול בחוץ למסך
 * ההתחברות, כלומר בדיוק למקום שהוא לא יכול לעבור.
 *
 * ⭐ **המסך לא מכריע דבר.** הוא שואל את השרת אם האסימון תקף ומציג את מה
 * שהשרת אמר. כל ההכרעות ב-`api/password-reset.ts`.
 */

const MIN_PASSWORD = 8;

type State =
  | { phase: 'checking' }
  | { phase: 'invalid'; message: string }
  | { phase: 'form'; username: string; fullName: string | null }
  | { phase: 'done'; username: string };

export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ phase: 'checking' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/password-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify', token }),
        });
        const body = await res.json();
        if (!alive) return;
        if (!res.ok || body.ok === false) {
          setState({ phase: 'invalid', message: body.error ?? 'הקישור אינו תקף.' });
          return;
        }
        setState({ phase: 'form', username: body.username, fullName: body.fullName ?? null });
      } catch {
        if (alive) setState({ phase: 'invalid', message: 'לא הצלחנו לבדוק את הקישור. נסה שוב בעוד רגע.' });
      }
    })();
    return () => { alive = false; };
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`הסיסמה חייבת להיות באורך ${MIN_PASSWORD} תווים לפחות.`);
      return;
    }
    if (password !== confirm) {
      setError('שתי הסיסמאות אינן זהות.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', token, password }),
      });
      const body = await res.json();
      setSaving(false);
      if (!res.ok || body.ok === false) {
        setError(body.error ?? 'לא הצלחנו לעדכן את הסיסמה.');
        return;
      }
      setState({ phase: 'done', username: body.username });
    } catch {
      setSaving(false);
      setError('לא הצלחנו לעדכן את הסיסמה. נסה שוב.');
    }
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <img
            src="/rashal-logo.png"
            alt="ר.שעל ציוד רפואי"
            className="mx-auto mb-2 h-20 w-auto object-contain"
          />
          <CardTitle className="text-xl text-center">בחירת סיסמה חדשה</CardTitle>
        </CardHeader>

        <CardContent>
          {state.phase === 'checking' && (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              בודק את הקישור
            </div>
          )}

          {state.phase === 'invalid' && (
            <div className="py-6 text-center space-y-4">
              <ShieldX className="mx-auto h-10 w-10 text-red-500" />
              <p className="text-sm text-slate-700">{state.message}</p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
                חזרה למסך ההתחברות
              </Button>
            </div>
          )}

          {state.phase === 'done' && (
            <div className="py-6 text-center space-y-4">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="text-sm text-slate-700">
                הסיסמה עודכנה. אפשר להתחבר עם שם המשתמש
                {' '}
                <span className="font-mono font-semibold" dir="auto">{state.username}</span>
                {' '}
                והסיסמה החדשה.
              </p>
              <Button className="w-full" onClick={() => navigate('/login')}>
                למסך ההתחברות
              </Button>
            </div>
          )}

          {state.phase === 'form' && (
            <form onSubmit={submit} className="space-y-4">
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>
                  הקישור תקף. בחירת סיסמה עבור
                  {' '}
                  <span className="font-mono font-semibold" dir="auto">{state.username}</span>
                </span>
              </div>

              <div>
                <Label htmlFor="pw">סיסמה חדשה</Label>
                <div className="relative">
                  <Input
                    id="pw"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    dir="ltr"
                    className="pe-10 font-mono"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute inset-y-0 end-2 flex items-center text-slate-400"
                    aria-label={show ? 'הסתר סיסמה' : 'הצג סיסמה'}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">לפחות {MIN_PASSWORD} תווים.</p>
              </div>

              <div>
                <Label htmlFor="pw2">שוב, לאימות</Label>
                <Input
                  id="pw2"
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  dir="ltr"
                  className="font-mono"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'שמור סיסמה חדשה'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
