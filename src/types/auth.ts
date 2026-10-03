export type UserRole = 'citizen' | 'authority';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  department?: string; // For authority accounts (e.g. Roads & Infrastructure)
  employee_id?: string; // For authority accounts
  created_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
