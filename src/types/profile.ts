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
  fullName?: string;
  role: UserRole;
  disabled: boolean;
  createdAt: string;
  updatedAt?: string;
}
