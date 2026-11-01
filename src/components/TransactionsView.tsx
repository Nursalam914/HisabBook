import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Pencil, RotateCcw, Search, Trash2 } from 'lucide-react';
import {
  ALL_PAYMENT_METHODS,
  type CategoryItem,
  type Language,
  type TransactionItem,
} from '../types';
import {
  formatIndianDate,
  formatINR,
  formatPaymentMethod,
  getCategoryDisplayName,
  getLocalCurrentMonthKey,
  getLocalTodayISO,
} from '../i18n';
import { exportLedgerToExcel, exportTransactionsToPDF } from '../utils/exportReports';

interface TransactionsViewProps {
  transactions: TransactionItem[];
  categories: CategoryItem[];
  userName: string;
  language: Language;
  onEditTransaction: (tx: TransactionItem) => void;
  onDeleteTransaction: (tx: TransactionItem) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  categories,
  userName,
  language,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const isHi = language === 'hi';

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const uniqueCategoryNames = useMemo(() => {
    const names = new Set<string>();
    for (const c of categories) names.add(c.name);
    for (const t of transactions) names.add(t.category);
    return Array.from(names).sort();
  }, [categories, transactions]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (categoryFilter !== 'ALL' && tx.category !== categoryFilter) return false;
      if (methodFilter !== 'ALL' && tx.payment_method !== methodFilter) return false;
      if (fromDate && tx.date < fromDate) return false;
      if (toDate && tx.date > toDate) return false;
      if (q) {
        const matchTitle = tx.title.toLowerCase().includes(q);
        const matchDesc = (tx.description || '').toLowerCase().includes(q);
        const matchCat = tx.category.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchCat) return false;
      }
      return true;
    });
  }, [transactions, searchQuery, typeFilter, categoryFilter, methodFilter, fromDate, toDate]);

  const filteredTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of filteredTransactions) {
      if (tx.type === 'income') income += tx.amount;
      else expense += tx.amount;
    }
    return { income, expense, net: income - expense };
  }, [filteredTransactions]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setCategoryFilter('ALL');
    setMethodFilter('ALL');
    setFromDate('');
    setToDate('');
  };

  const applyTodayPreset = () => {
    const today = getLocalTodayISO();
    setFromDate(today);
    setToDate(today);
  };

  const applyThisMonthPreset = () => {
    const mKey = getLocalCurrentMonthKey();
    const [y, m] = mKey.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    setFromDate(`${mKey}-01`);
    setToDate(`${mKey}-${String(lastDay).padStart(2, '0')}`);
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    typeFilter !== 'all' ||
    categoryFilter !== 'ALL' ||
    methodFilter !== 'ALL' ||
    fromDate !== '' ||
    toDate !== '';

  return (
    <div className="space-y-6">
      {/* Filter Controls Card */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isHi
                  ? 'शीर्षक, विवरण या श्रेणी से खोजें...'
                  : 'Search transactions by title, notes, or category...'
              }
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Type Segmented Control + Export Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['all', 'expense', 'income'] as const).map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setTypeFilter(tp)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    typeFilter === tp
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tp === 'all'
                    ? isHi
                      ? 'सभी'
                      : 'All'
                    : tp === 'expense'
                    ? isHi
                      ? 'खर्च'
                      : 'Expenses'
                    : isHi
                    ? 'आय'
                    : 'Income'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                exportTransactionsToPDF({
                  title: 'Filtered Transaction History',
                  subtitle: `Records: ${filteredTransactions.length} | Generated ${formatIndianDate(getLocalTodayISO())}`,
                  userName,
                  transactions: filteredTransactions,
                  filename: `HisabBook_Transactions_${getLocalTodayISO()}.pdf`,
                })
              }
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={() =>
                exportLedgerToExcel({
                  filename: `HisabBook_Transactions_${getLocalTodayISO()}.xlsx`,
                  transactions: filteredTransactions,
                })
              }
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          </div>
        </div>

        {/* Date, Category, and Payment Method Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {isHi ? 'प्रारंभ तिथि (From)' : 'From Date'}
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {isHi ? 'अंतिम तिथि (To)' : 'To Date'}
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {isHi ? 'श्रेणी (Category)' : 'Category'}
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="ALL">{isHi ? 'सभी श्रेणियाँ' : 'All Categories'}</option>
              {uniqueCategoryNames.map((name) => (
                <option key={name} value={name}>
                  {getCategoryDisplayName(name, categories, language)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {isHi ? 'भुगतान माध्यम' : 'Payment Method'}
            </label>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="ALL">{isHi ? 'सभी माध्यम' : 'All Methods'}</option>
              {ALL_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {formatPaymentMethod(m, language)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={applyTodayPreset}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {isHi ? 'आज' : 'Today'}
            </button>
            <button
              type="button"
              onClick={applyThisMonthPreset}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {isHi ? 'इस माह' : 'This Month'}
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isHi ? 'रीसेट' : 'Reset'}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Filtered Summary Strip */}
      <section className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
        <span className="text-slate-600 dark:text-slate-400 font-medium">
          {isHi ? 'दिखाए गए रिकॉर्ड:' : 'Showing records:'}{' '}
          <strong className="font-num text-slate-900 dark:text-white">
            {filteredTransactions.length}
          </strong>
        </span>
        <div className="flex flex-wrap items-center gap-4 font-num">
          <span className="text-slate-600 dark:text-slate-400">
            {isHi ? 'आय:' : 'Income:'}{' '}
            <strong className="text-emerald-700 dark:text-emerald-400">
              {formatINR(filteredTotals.income)}
            </strong>
          </span>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
          <span className="text-slate-600 dark:text-slate-400">
            {isHi ? 'खर्च:' : 'Expenses:'}{' '}
            <strong className="text-slate-900 dark:text-white">
              {formatINR(filteredTotals.expense)}
            </strong>
          </span>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
          <span className="text-slate-600 dark:text-slate-400">
            {isHi ? 'शुद्ध:' : 'Net:'}{' '}
            <strong className="text-blue-700 dark:text-blue-400">
              {formatINR(filteredTotals.net)}
            </strong>
          </span>
        </div>
      </section>

      {/* Transactions Ledger Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {hasActiveFilters
                ? isHi
                  ? 'चयनित फ़िल्टर से मेल खाने वाला कोई लेन-देन नहीं मिला।'
                  : 'No transactions match your current search or filter criteria.'
                : isHi
                ? 'आपका लेन-देन इतिहास अभी खाली है।'
                : 'Your transaction history is empty.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-700 hover:bg-blue-800 text-white"
              >
                {isHi ? 'सभी फ़िल्टर हटाएं' : 'Clear All Filters'}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900">
                  <th className="py-3 px-5">{isHi ? 'तारीख' : 'Date'}</th>
                  <th className="py-3 px-4">{isHi ? 'शीर्षक और नोट्स' : 'Title & Notes'}</th>
                  <th className="py-3 px-4">{isHi ? 'प्रकार और श्रेणी' : 'Type & Category'}</th>
                  <th className="py-3 px-4 hidden sm:table-cell">{isHi ? 'भुगतान माध्यम' : 'Payment Method'}</th>
                  <th className="py-3 px-4 text-right">{isHi ? 'राशि (₹)' : 'Amount (₹)'}</th>
                  <th className="py-3 px-5 text-right">{isHi ? 'कार्य' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-5 font-num text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatIndianDate(tx.date)}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{tx.title}</p>
                      {tx.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-md">
                          {tx.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                      <span
                        className={
                          tx.type === 'income'
                            ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                            : 'text-slate-700 dark:text-slate-300 font-medium'
                        }
                      >
                        {tx.type === 'income' ? (isHi ? 'आय' : 'Income') : isHi ? 'खर्च' : 'Expense'}
                      </span>
                      <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
                      <span>{getCategoryDisplayName(tx.category, categories, language)}</span>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatPaymentMethod(tx.payment_method, language)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-num font-semibold whitespace-nowrap ${
                        tx.type === 'income'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatINR(tx.amount)}
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditTransaction(tx)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          aria-label={`Edit ${tx.title}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTransaction(tx)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          aria-label={`Delete ${tx.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
