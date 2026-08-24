/**
 * תצוגה מקדימה לצילום, בלי התחברות ובלי מסד.
 *
 * 🔴 **מסך ההתחברות חוסם צילום אוטומטי**, ולכן הרכיב האמיתי מרונדר כאן
 * לבדו מול ה-CSS המהודר. זה מה שמאפשר לראות עיצוב לפני מסירה במקום
 * לשלוח אותו לעידן ולגלות ממנו. [[screenshot_behind_a_login]]
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { CustomerCardBody } from '@/components/customer/CustomerCard';
import { FIXTURE } from '@/preview/customer-fixture';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">
        <CustomerCardBody data={FIXTURE} />
      </div>
    </div>
  </StrictMode>,
);
