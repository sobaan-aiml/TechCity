import { User } from '../src/types/auth.js';

interface StoredUser extends User {
  passwordHash: string;
}

export const USERS: StoredUser[] = [
  // 1. Pre-seeded Citizens
  {
    id: 'user_cit_1',
    name: 'Vikram Sharma',
    email: 'vikram@techcity.org',
    phone: '+91 98450 11223',
    role: 'citizen',
    passwordHash: 'citizen123',
    created_at: '2026-09-15T08:00:00.000Z',
  },
  {
    id: 'user_cit_2',
    name: 'Anita Deshmukh',
    email: 'anita@techcity.org',
    phone: '+91 98450 12345',
    role: 'citizen',
    passwordHash: 'citizen123',
    created_at: '2026-09-18T10:30:00.000Z',
  },
  {
    id: 'user_cit_3',
    name: 'Rahul Sen',
    email: 'rahul@techcity.org',
    phone: '+91 98450 99887',
    role: 'citizen',
    passwordHash: 'citizen123',
    created_at: '2026-09-20T14:15:00.000Z',
  },

  // 2. Pre-seeded Municipal Authorities
  {
    id: 'user_auth_1',
    name: 'Engineer R. Murthy',
    email: 'rmurthy@techcity.gov',
    phone: '+91 98200 44556',
    role: 'authority',
    department: 'Roads & Infrastructure',
    employee_id: 'TC-ROADS-401',
    passwordHash: 'admin123',
    created_at: '2026-08-01T09:00:00.000Z',
  },
  {
    id: 'user_auth_2',
    name: 'Supervisor J. Khan',
    email: 'jkhan@techcity.gov',
    phone: '+91 98200 77889',
    role: 'authority',
    department: 'Solid Waste Management',
    employee_id: 'TC-SWM-805',
    passwordHash: 'admin123',
    created_at: '2026-08-05T09:00:00.000Z',
  },
  {
    id: 'user_auth_3',
    name: 'Central Operations Dispatch',
    email: 'admin@techcity.gov',
    phone: '+91 80 2233 4455',
    role: 'authority',
    department: 'General Municipal Administration',
    employee_id: 'TC-HQ-001',
    passwordHash: 'admin123',
    created_at: '2026-07-01T09:00:00.000Z',
  },
];

export function authenticateUser(
  email: string,
  password?: string,
  intendedRole?: 'citizen' | 'authority'
): User | null {
  const cleanEmail = email.trim().toLowerCase();
  const user = USERS.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!user) return null;

  // Strict role check if specified
  if (intendedRole && user.role !== intendedRole) {
    return null;
  }

  // Prototype password verification
  if (password && password !== user.passwordHash) {
    return null;
  }

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export function registerUser(data: {
  name: string;
  email: string;
  password?: string;
  role: 'citizen' | 'authority';
  phone?: string;
  department?: string;
  employee_id?: string;
}): User {
  const cleanEmail = data.email.trim().toLowerCase();
  const existing = USERS.find((u) => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    throw new Error('An account with this email address already exists.');
  }

  const newUser: StoredUser = {
    id: `user_${data.role}_${Date.now()}`,
    name: data.name.trim(),
    email: cleanEmail,
    phone: data.phone?.trim() || undefined,
    role: data.role,
    department: data.role === 'authority' ? data.department || 'General Municipal Administration' : undefined,
    employee_id: data.role === 'authority' ? data.employee_id || `TC-AUTH-${Math.floor(100 + Math.random() * 900)}` : undefined,
    passwordHash: data.password || (data.role === 'authority' ? 'admin123' : 'citizen123'),
    created_at: new Date().toISOString(),
  };

  USERS.push(newUser);
  const { passwordHash, ...safeUser } = newUser;
  return safeUser;
}
