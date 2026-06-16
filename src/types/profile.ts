import type { AssigneeName } from './route';

export type UserRole = 'admin' | 'dispatcher' | 'driver' | 'viewer';

export const ALLOWED_ROLES: UserRole[] = ['admin', 'dispatcher', 'driver', 'viewer'];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'מנהל מערכת',
  dispatcher: 'שולח (מנהל משלוחים)',
  driver: 'נהג',
  viewer: 'צפייה בלבד',
};

export interface Profile {
  id: string;
  email: string;
  /** Admin-managed handle used for login (Hebrew or English). Maps to a synthetic
   *  ASCII email under the hood — see `usernameToEmail` in src/lib/username.ts. */
  username?: string;
  fullName?: string;
  role: UserRole;
  disabled: boolean;
  /** When role='driver', links this user to a driver_name enum value (delivery driver or service technician). */
  linkedDriver?: AssigneeName;
  createdAt: string;
  updatedAt?: string;
}

/** Domain used for synthetic emails behind username-based logins. */
export const USERNAME_EMAIL_DOMAIN = 'rashal.internal';
/** 3-30 chars: Latin letters, Hebrew letters (א-ת incl. finals), digits, . _ - (no spaces). */
export const USERNAME_PATTERN = /^[a-zA-Z0-9._א-ת-]{3,30}$/u;
