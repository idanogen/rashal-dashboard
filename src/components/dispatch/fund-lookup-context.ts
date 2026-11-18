import { createContext } from 'react';
import type { HealthFundKey } from '@/lib/health-fund';

/** הקופה לפי מספר לקוח, שמסך הסדרן מציב לכל הכרטיסים שבתוכו (FundBadge, 18/11/2026). */
export const FundLookupContext = createContext<((customerNumber: string | undefined | null) => HealthFundKey) | null>(null);
