/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  FolderKanban,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MinusCircle,
  PiggyBank,
  Plus,
  PlusCircle,
  Settings,
  X,
} from 'lucide-react';
import { ApiError, api, getStoredToken, setStoredToken } from './api';
import {
  NavSection,
  type BudgetItem,
  type CategoryItem,
  type Language,
  type ThemeMode,
  type TransactionItem,
  type TransactionType,
  type UserProfile,
} from './types';
import { TRANSLATIONS } from './i18n';
import { AuthScreen } from './components/AuthScreen';
import { DashboardView } from './components/DashboardView';
import { EntryFormView } from './components/EntryFormView';
import { TransactionsView } from './components/TransactionsView';
import { ReportsView } from './components/ReportsView';
import { BudgetView } from './components/BudgetView';
import { CategoriesView } from './components/CategoriesView';
import { SettingsView } from './components/SettingsView';
import { DeleteConfirmModal, EditTransactionModal } from './components/TransactionModal';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem('hisabbook_lang') === 'hi' ? 'hi' : 'en';
    } catch {
      return 'en';
    }
  });

  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      return localStorage.getItem('hisabbook_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const [activeSection, setActiveSection] = useState<NavSection>(NavSection.DASHBOARD);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [deletingTx, setDeletingTx] = useState<TransactionItem | null>(null);

  // Sync `.dark` class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('hisabbook_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem('hisabbook_lang', language);
    } catch {
      // ignore
    }
  }, [language]);

  const syncData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setBooting(false);
      return;
    }

    try {
      const payload = await api.sync();
      setUser(payload.user);
      setCategories(payload.categories);
      setTransactions(payload.transactions);
      setBudgets(payload.budgets);
      setLastSyncedAt(payload.syncedAt);
      if (payload.user.language === 'hi' || payload.user.language === 'en') {
        setLanguage(payload.user.language);
      }
      if (payload.user.theme === 'dark' || payload.user.theme === 'light') {
        setTheme(payload.user.theme);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setStoredToken(null);
        setUser(null);
      }
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    syncData();
  }, [syncData]);

  // Automatic background synchronization on tab focus
  useEffect(() => {
    if (!user) return;
    const onFocus = () => {
      syncData();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, syncData]);

  const handleAuthenticated = async (authedUser: UserProfile) => {
    setUser(authedUser);
    if (authedUser.language) setLanguage(authedUser.language);
    if (authedUser.theme) setTheme(authedUser.theme);
    await syncData();
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout network failure
    } finally {
      setStoredToken(null);
      setUser(null);
      setTransactions([]);
      setCategories([]);
      setBudgets([]);
      setActiveSection(NavSection.DASHBOARD);
    }
  };

  const handleUpdateUser = (updated: UserProfile) => {
    setUser(updated);
    setLanguage(updated.language);
    setTheme(updated.theme);
  };

  // --- CRUD Handlers with Immediate State Update ---
  const handleAddTransaction = async (payload: {
    type: TransactionType;
    amount: number;
    title: string;
    category: string;
    date: string;
    payment_method: string;
    description: string;
  }) => {
    const res = await api.createTransaction(payload);
    setTransactions((prev) =>
      [res.transaction, ...prev].sort((a, b) =>
        b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
      )
    );
    setLastSyncedAt(new Date().toISOString());
  };

  const handleEditTransactionSave = async (
    id: string,
    payload: {
      type: TransactionType;
      amount: number;
      title: string;
      category: string;
      date: string;
      payment_method: string;
      description: string;
    }
  ) => {
    const res = await api.updateTransaction(id, payload);
    setTransactions((prev) =>
      prev
        .map((t) => (t.id === id ? res.transaction : t))
        .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
    );
    setLastSyncedAt(new Date().toISOString());
  };

  const handleDeleteTransactionConfirm = async (id: string) => {
    await api.deleteTransaction(id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setLastSyncedAt(new Date().toISOString());
  };

  const handleSaveBudget = async (payload: {
    month_key: string;
    category: string;
    limit_amount: number;
  }) => {
    const res = await api.saveBudget(payload);
    setBudgets((prev) => {
      const idx = prev.findIndex(
        (b) => b.month_key === res.budget.month_key && b.category === res.budget.category
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = res.budget;
        return next;
      }
      return [res.budget, ...prev];
    });
    setLastSyncedAt(new Date().toISOString());
  };

  const handleDeleteBudget = async (id: string) => {
    await api.deleteBudget(id);
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    setLastSyncedAt(new Date().toISOString());
  };

  const handleCreateCategory = async (payload: {
    name: string;
    name_hi?: string;
    type: TransactionType;
    color: string;
  }) => {
    const res = await api.createCategory(payload);
    setCategories((prev) => [...prev, res.category]);
    setLastSyncedAt(new Date().toISOString());
  };

  const handleUpdateCategory = async (
    id: string,
    payload: { name: string; name_hi?: string; color: string }
  ) => {
    await api.updateCategory(id, payload);
    await syncData();
  };

  const handleDeleteCategory = async (id: string) => {
    await api.deleteCategory(id);
    await syncData();
  };

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Loading HisabBook...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onAuthenticated={handleAuthenticated}
        language={language}
        onToggleLanguage={() => setLanguage((prev) => (prev === 'en' ? 'hi' : 'en'))}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
      />
    );
  }

  const t = TRANSLATIONS[language];
  const isHi = language === 'hi';

  const navItems: { id: NavSection; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: NavSection.DASHBOARD, label: t.nav.dashboard, icon: LayoutDashboard },
    { id: NavSection.ADD_EXPENSE, label: t.nav.addExpense, icon: MinusCircle },
    { id: NavSection.ADD_INCOME, label: t.nav.addIncome, icon: PlusCircle },
    { id: NavSection.TRANSACTIONS, label: t.nav.transactions, icon: History },
    { id: NavSection.REPORTS, label: t.nav.reports, icon: BarChart3 },
    { id: NavSection.BUDGET, label: t.nav.budget, icon: PiggyBank },
    { id: NavSection.CATEGORIES, label: t.nav.categories, icon: FolderKanban },
    { id: NavSection.SETTINGS, label: t.nav.settings, icon: Settings },
  ];

  const activeNavObj = navItems.find((item) => item.id === activeSection) || navItems[0];

  const selectSection = (sec: NavSection) => {
    setActiveSection(sec);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar (260px Workspace Canvas) */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            HisabBook
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Sidebar Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectSection(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="px-2">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.common.signOut}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[82vw] bg-white dark:bg-slate-900 h-full flex flex-col border-r border-slate-200 dark:border-slate-800">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-700 text-white flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <span className="text-base font-bold text-slate-900 dark:text-white">HisabBook</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectSection(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {user.name}
              </p>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t.common.signOut}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Strict SaaS Top Header: Breadcrumb on Left, Single Primary Action on Right */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-4 sm:px-6 lg:px-8 py-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                HisabBook
              </span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
                /
              </span>
              <h1 className="font-bold text-slate-900 dark:text-white truncate">
                {activeNavObj.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() =>
                selectSection(
                  activeSection === NavSection.ADD_EXPENSE
                    ? NavSection.ADD_INCOME
                    : NavSection.ADD_EXPENSE
                )
              }
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-700 hover:bg-blue-800 text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {activeSection === NavSection.ADD_EXPENSE
                  ? isHi
                    ? 'आय जोड़ें'
                    : 'Add Income'
                  : isHi
                  ? 'खर्च जोड़ें'
                  : 'Add Expense'}
              </span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {activeSection === NavSection.DASHBOARD && (
            <DashboardView
              transactions={transactions}
              categories={categories}
              budgets={budgets}
              language={language}
              theme={theme}
              onNavigate={selectSection}
              onEditTransaction={setEditingTx}
              onDeleteTransaction={setDeletingTx}
            />
          )}

          {activeSection === NavSection.ADD_EXPENSE && (
            <EntryFormView
              mode="expense"
              categories={categories}
              transactions={transactions}
              language={language}
              onAddTransaction={handleAddTransaction}
              onEditTransaction={setEditingTx}
              onDeleteTransaction={setDeletingTx}
            />
          )}

          {activeSection === NavSection.ADD_INCOME && (
            <EntryFormView
              mode="income"
              categories={categories}
              transactions={transactions}
              language={language}
              onAddTransaction={handleAddTransaction}
              onEditTransaction={setEditingTx}
              onDeleteTransaction={setDeletingTx}
            />
          )}

          {activeSection === NavSection.TRANSACTIONS && (
            <TransactionsView
              transactions={transactions}
              categories={categories}
              userName={user.name}
              language={language}
              onEditTransaction={setEditingTx}
              onDeleteTransaction={setDeletingTx}
            />
          )}

          {activeSection === NavSection.REPORTS && (
            <ReportsView
              transactions={transactions}
              categories={categories}
              budgets={budgets}
              userName={user.name}
              language={language}
              theme={theme}
            />
          )}

          {activeSection === NavSection.BUDGET && (
            <BudgetView
              budgets={budgets}
              transactions={transactions}
              categories={categories}
              language={language}
              onSaveBudget={handleSaveBudget}
              onDeleteBudget={handleDeleteBudget}
            />
          )}

          {activeSection === NavSection.CATEGORIES && (
            <CategoriesView
              categories={categories}
              transactions={transactions}
              language={language}
              onCreateCategory={handleCreateCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          )}

          {activeSection === NavSection.SETTINGS && (
            <SettingsView
              user={user}
              transactions={transactions}
              categories={categories}
              budgets={budgets}
              language={language}
              theme={theme}
              lastSyncedAt={lastSyncedAt}
              onUpdateUser={handleUpdateUser}
              onSyncNow={syncData}
            />
          )}
        </main>
      </div>

      {/* Edit & Delete Modals */}
      <EditTransactionModal
        transaction={editingTx}
        categories={categories}
        language={language}
        onClose={() => setEditingTx(null)}
        onSave={handleEditTransactionSave}
      />

      <DeleteConfirmModal
        transaction={deletingTx}
        language={language}
        onClose={() => setDeletingTx(null)}
        onConfirm={handleDeleteTransactionConfirm}
      />
    </div>
  );
}
