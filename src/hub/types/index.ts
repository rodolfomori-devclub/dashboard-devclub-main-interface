export type Role = 'gestor' | 'vendedor' | 'pre-vendedor' | 'financeiro';

export function isSeller(role: Role): boolean {
  return role === 'vendedor' || role === 'pre-vendedor';
}

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  active: boolean;
  individual_goal: number;
  created_at: string;
}

export interface Sale {
  id: string;
  seller_id: string;
  amount: number;
  date: string;
  product: string;
  origin: string;
  note: string;
  client_name: string;
  temperature: string;
  created_at: string;
}

export interface TeamSettings {
  id: string;
  team_goal: number;
  products: ProductConfig[];
  origins: string[];
}

export interface ProductConfig {
  name: string;
  commission_rate: number; // percentage e.g. 10 = 10%
}

export interface Material {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
  type: string;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author_id: string;
  created_at: string;
}

export interface DailyKpi {
  id: string;
  seller_id: string;
  date: string;
  leads: number;
  leads_disqualified: number;
  calls_scheduled: number;
  calls_completed: number;
  sales: number;
  sales_scheduled: number;
  follows: number;
  rejections: number;
  created_at: string;
  updated_at: string;
}

export interface DailyTargets {
  id: string;
  target_leads_per_day: number;
  target_calls_scheduled: number;
  target_calls_completed: number;
  target_sales_per_day: number;
}

export interface SalesLink {
  id: string;
  seller_id: string;
  product_name: string;
  link_url: string;
  created_at: string;
}

export const SALE_ORIGINS = [
  'LinkedIn',
  'Forms',
  'Social Selling',
  'Launch',
] as const;

export const SALE_TEMPERATURES = [
  { value: 'hot', label: 'Quente (já conhecia a empresa)' },
  { value: 'cold', label: 'Frio (não conhecia a empresa)' },
] as const;

export const MATERIAL_CATEGORIES = [
  'Playbooks',
  'Trainings',
  'Top Calls',
  'Spreadsheets and Materials',
  'Onboarding',
] as const;
