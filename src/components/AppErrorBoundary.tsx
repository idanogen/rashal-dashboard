import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * 🔴 בלי גבול שגיאות, קריסה אחת בזמן ציור מסירה את כל העץ ב-React 19,
 * והמשתמש רואה מסך לבן בלי שום הסבר (טאבלט במשרד, 15/09/2026). כאן
 * מוצגים הסבר, השגיאה וגרסת הדפדפן, כדי שצילום מסך יספיק לאבחון.
 */
interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div dir="rtl" className="mx-auto my-10 max-w-xl rounded-2xl border bg-white p-6 text-slate-800 shadow-sm">
        <h2 className="mb-2 text-xl font-bold text-slate-900">משהו השתבש בטעינת המסך</h2>
        <p className="mb-4 text-sm">נסו לרענן. אם זה חוזר, צלמו את המסך הזה ושלחו, כי הפרטים למטה מספיקים כדי למצוא את הבעיה.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white"
        >
          רענון
        </button>
        <div dir="ltr" className="mt-4 break-all text-left text-xs text-slate-500">
          {error.name}: {error.message}
          <br />
          Browser: {navigator.userAgent}
          <br />
          Device time: {new Date().toString()}
          <br />
          Build: {typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'}
        </div>
      </div>
    );
  }
}
