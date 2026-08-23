import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** מקבל מייל אמיתי או שם משתמש חשוף (הדומיין הסינתטי נוסף לבד). */
  signIn: (handle: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

/**
 * ⭐ **ההקשר יושב בקובץ משלו ולא לצד `AuthProvider`**, כי קובץ שמייצא גם
 * רכיב וגם ערך שאינו רכיב שובר את ה-Fast Refresh של Vite. ההפרדה גם
 * מאפשרת לרנדר רכיבים שתלויים בהתחברות מחוץ לאפליקציה, בתצוגה מקדימה
 * או בבדיקה, בלי להרים סשן אמיתי.
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
