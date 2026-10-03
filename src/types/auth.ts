export type UserRole = 'citizen' | 'authority';
export type AuthorityType = 'engineer' | 'supervisor' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  authority_type?: AuthorityType; // 'engineer' (R. Murthy), 'supervisor' (J. Khan), 'admin' (Central Ops)
  department?: string; // For authority accounts (e.g. Roads & Infrastructure)
  employee_id?: string; // For authority accounts
  created_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export function getAuthorityType(user: User): AuthorityType {
  if (user.authority_type) return user.authority_type;
  const name = user.name.toLowerCase();
  const email = user.email.toLowerCase();
  if (name.includes('engineer') || email.includes('rmurthy')) return 'engineer';
  if (name.includes('supervisor') || email.includes('jkhan')) return 'supervisor';
  return 'admin';
}
