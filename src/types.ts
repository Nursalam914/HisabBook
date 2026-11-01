export enum NavSection {
  DASHBOARD = 'dashboard',
  ADD_EXPENSE = 'add-expense',
  ADD_INCOME = 'add-income',
  TRANSACTIONS = 'transactions',
  REPORTS = 'reports',
  BUDGET = 'budget',
  CATEGORIES = 'categories',
  SETTINGS = 'settings',
}

export type Language = 'en' | 'hi';
export type ThemeMode = 'light' | 'dark';
export type TransactionType = 'expense' | 'income';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  language: Language;
  theme: ThemeMode;
  created_at: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  name_hi: string;
  type: TransactionType;
  color: string;
  is_default: number;
  created_at: string;
}

export interface TransactionItem {
  id: string;
  type: TransactionType;
  amount: number;
  title: string;
  category: string;
  date: string; // YYYY-MM-DD
  payment_method: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetItem {
  id: string;
  month_key: string; // YYYY-MM
  category: string; // 'OVERALL' or category name
  limit_amount: number;
  updated_at: string;
}

export interface SyncPayload {
  user: UserProfile;
  categories: CategoryItem[];
  transactions: TransactionItem[];
  budgets: BudgetItem[];
  syncedAt: string;
}

export interface BackupFilePayload {
  app: 'HisabBook';
  version: number;
  exportedAt: string;
  account: {
    name: string;
    email: string;
  };
  data: {
    categories: CategoryItem[];
    transactions: TransactionItem[];
    budgets: BudgetItem[];
  };
}

export const EXPENSE_PAYMENT_METHODS = [
  'UPI',
  'Cash',
  'Debit Card',
  'Credit Card',
  'Net Banking',
] as const;

export const INCOME_PAYMENT_METHODS = [
  'Bank Transfer',
  'UPI',
  'Cash',
  'Cheque',
] as const;

export const ALL_PAYMENT_METHODS = [
  'UPI',
  'Cash',
  'Debit Card',
  'Credit Card',
  'Net Banking',
  'Bank Transfer',
  'Cheque',
] as const;
