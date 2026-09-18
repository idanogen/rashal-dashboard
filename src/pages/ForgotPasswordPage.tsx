import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MessageCircle, ArrowRight } from 'lucide-react';

/**
 * "שכחתי סיסמה": האדם מקיש את הנייד שלו ומקבל קישור בוואטסאפ.
 *
 * 🔴 **נפתח בלי משתמש מחובר**, כמו `ResetPasswordPage`, ולכן הוא חייב
 * לשבת מעל ה-catch-all ב-`App.tsx`.
 *
 * ⭐ **המסך לא מכריע דבר ולא יודע מי קיים במערכת.** הוא שולח מספר
 * ומציג את המשפט שהשרת החזיר. כל ההכרעות (תקרות, קיום משתמש, שליחה)
 * ב-`api/password-reset.ts` וב-`api/_lib/reset-request.ts`.
 *
 * ⭐ **זיהוי לפי טלפון ולא לפי שם משתמש** (החלטת עידן, 18/09/2026):
 * שמות המשתמש כאן הם שמות פרטיים בעברית, ומי ששכח סיסמה סביר ששכח גם
 * אותם. שם המשתמש מוצג לאדם בסוף התהליך, במסך בחירת הסיסמה.
 */

export function ForgotPasswordPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', phone }),
      });
      const body = await res.json();
      setResult({ ok: body.ok === true, message: body.message ?? 'משהו השתבש. אפשר לנסות שוב.' });
    } catch {
      setResult({ ok: false, message: 'אין חיבור לשרת כרגע. אפשר לנסות שוב בעוד רגע.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <img
            src="/rashal-logo.png"
            alt="ר.שעל ציוד רפואי"
            className="mx-auto mb-2 h-24 w-auto object-contain"
          />
          <CardTitle className="text-2xl text-center">שכחתי סיסמה</CardTitle>
          <p className="text-center text-sm text-slate-500 mt-2">
            נשלח לך קישור בוואטסאפ לנייד הרשום במערכת, ותבחר סיסמה חדשה בעצמך.
          </p>
        </CardHeader>
        <CardContent>
          {result?.ok ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <MessageCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm text-slate-700">{result.message}</p>
              <p className="text-xs text-slate-500">
                לא הגיעה הודעה? אפשר לבדוק את הוואטסאפ של המספר שהוקש, ואם היא לא שם לפנות למנהל.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">
                  <ArrowRight className="w-4 h-4 ms-1" />
                  חזרה למסך ההתחברות
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="phone">מספר הנייד שלך</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
                  dir="ltr"
                  className="text-left font-mono"
                  placeholder="0541234567"
                />
              </div>
              {result && !result.ok && (
                <p className="text-sm text-red-600">{result.message}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שלחו לי קישור'}
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/login">חזרה למסך ההתחברות</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
