import type { CategoryItem, Language } from './types';

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const inrExactFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(amount: number, forceDecimals = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  if (forceDecimals || Math.round(safe * 100) % 100 !== 0) {
    return inrExactFormatter.format(safe);
  }
  return inrFormatter.format(safe);
}

/**
 * Formats ISO YYYY-MM-DD into Indian DD/MM/YYYY format
 */
export function formatIndianDate(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Formats ISO YYYY-MM-DD into readable DD MMM YYYY (e.g. 01 Nov 2026)
 */
export function formatReadableIndianDate(isoDate: string, lang: Language = 'en'): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [yyyy, mm, dd] = isoDate.split('-').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Returns local today's date as YYYY-MM-DD (avoids UTC midnight shift)
 */
export function getLocalTodayISO(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns current local month key as YYYY-MM
 */
export function getLocalCurrentMonthKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function getMonthName(monthIndex1Based: number, lang: Language = 'en'): string {
  const d = new Date(2026, monthIndex1Based - 1, 1);
  return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long' });
}

export function getShortMonthName(monthIndex1Based: number, lang: Language = 'en'): string {
  const d = new Date(2026, monthIndex1Based - 1, 1);
  return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'short' });
}

export function getCategoryDisplayName(
  categoryName: string,
  categories: CategoryItem[],
  lang: Language
): string {
  if (lang === 'en') return categoryName;
  const found = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
  if (found && found.name_hi) return found.name_hi;
  return categoryName;
}

export const PAYMENT_METHOD_HI: Record<string, string> = {
  UPI: 'यूपीआई (UPI)',
  Cash: 'नकद (Cash)',
  'Debit Card': 'डेबिट कार्ड',
  'Credit Card': 'क्रेडिट कार्ड',
  'Net Banking': 'नेट बैंकिंग',
  'Bank Transfer': 'बैंक ट्रांसफर',
  Cheque: 'चेक',
};

export function formatPaymentMethod(method: string, lang: Language): string {
  if (lang === 'hi' && PAYMENT_METHOD_HI[method]) {
    return PAYMENT_METHOD_HI[method];
  }
  return method;
}

export const TRANSLATIONS = {
  en: {
    appName: 'HisabBook',
    tagline: 'Personal Expense & Budget Ledger',
    nav: {
      dashboard: 'Dashboard',
      addExpense: 'Add Expense',
      addIncome: 'Add Income',
      transactions: 'Transactions',
      reports: 'Monthly Reports',
      budget: 'Budget',
      categories: 'Categories',
      settings: 'Settings',
    },
    kpi: {
      totalIncome: 'Total Income',
      totalExpenses: 'Total Expenses',
      availableBalance: 'Available Balance',
      todayExpenses: "Today's Expenses",
      monthExpenses: "This Month's Expenses",
    },
    common: {
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      search: 'Search by title or notes...',
      exportPdf: 'Export PDF',
      exportExcel: 'Export Excel',
      syncNow: 'Sync Data',
      signOut: 'Sign Out',
      amountInr: 'Amount (₹ INR)',
      title: 'Title',
      category: 'Category',
      date: 'Date',
      paymentMethod: 'Payment Method',
      description: 'Description / Notes',
      expense: 'Expense',
      income: 'Income',
      all: 'All',
    },
  },
  hi: {
    appName: 'HisabBook',
    tagline: 'व्यक्तिगत खर्च और बजट खाता',
    nav: {
      dashboard: 'डैशबोर्ड',
      addExpense: 'खर्च जोड़ें',
      addIncome: 'आय जोड़ें',
      transactions: 'लेन-देन इतिहास',
      reports: 'मासिक रिपोर्ट',
      budget: 'बजट प्रबंधन',
      categories: 'श्रेणियाँ',
      settings: 'सेटिंग्स',
    },
    kpi: {
      totalIncome: 'कुल आय',
      totalExpenses: 'कुल खर्च',
      availableBalance: 'उपलब्ध शेष राशि',
      todayExpenses: 'आज का खर्च',
      monthExpenses: 'इस महीने का खर्च',
    },
    common: {
      save: 'सहेजें',
      cancel: 'रद्द करें',
      edit: 'संपादित करें',
      delete: 'हटाएं',
      search: 'शीर्षक या विवरण से खोजें...',
      exportPdf: 'PDF डाउनलोड',
      exportExcel: 'Excel डाउनलोड',
      syncNow: 'सिंक करें',
      signOut: 'लॉग आउट',
      amountInr: 'राशि (₹ रुपये)',
      title: 'शीर्षक',
      category: 'श्रेणी',
      date: 'तारीख',
      paymentMethod: 'भुगतान माध्यम',
      description: 'विवरण / नोट्स',
      expense: 'खर्च',
      income: 'आय',
      all: 'सभी',
    },
  },
} as const;
