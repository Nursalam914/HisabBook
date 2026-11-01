import React, { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  EXPENSE_PAYMENT_METHODS,
  INCOME_PAYMENT_METHODS,
  type CategoryItem,
  type Language,
  type TransactionItem,
  type TransactionType,
} from '../types';
import {
  formatIndianDate,
  formatINR,
  formatPaymentMethod,
  getCategoryDisplayName,
  getLocalCurrentMonthKey,
  getLocalTodayISO,
} from '../i18n';

interface EntryFormViewProps {
  mode: TransactionType;
  categories: CategoryItem[];
  transactions: TransactionItem[];
  language: Language;
  onAddTransaction: (payload: {
    type: TransactionType;
    amount: number;
    title: string;
    category: string;
    date: string;
    payment_method: string;
    description: string;
  }) => Promise<void>;
  onEditTransaction: (tx: TransactionItem) => void;
  onDeleteTransaction: (tx: TransactionItem) => void;
}

export const EntryFormView: React.FC<EntryFormViewProps> = ({
  mode,
  categories,
  transactions,
  language,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const isHi = language === 'hi';
  const isExpense = mode === 'expense';

  const modeCategories = useMemo(
    () => categories.filter((c) => c.type === mode),
    [categories, mode]
  );

  const paymentMethods = isExpense ? EXPENSE_PAYMENT_METHODS : INCOME_PAYMENT_METHODS;

  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(getLocalTodayISO());
  const [paymentMethod, setPaymentMethod] = useState<string>(paymentMethods[0]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (modeCategories.length > 0 && !modeCategories.some((c) => c.name === category)) {
      setCategory(modeCategories[0].name);
    }
  }, [modeCategories, category]);

  useEffect(() => {
    setPaymentMethod(isExpense ? EXPENSE_PAYMENT_METHODS[0] : INCOME_PAYMENT_METHODS[0]);
    setError(null);
    setSuccessMsg(null);
  }, [mode, isExpense]);

  const summary = useMemo(() => {
    const currentMonthKey = getLocalCurrentMonthKey();
    let totalIncome = 0;
    let totalExpenses = 0;
    let thisMonthTypeTotal = 0;

    for (const tx of transactions) {
      if (tx.type === 'income') totalIncome += tx.amount;
      else totalExpenses += tx.amount;

      if (tx.type === mode && tx.date.startsWith(currentMonthKey)) {
        thisMonthTypeTotal += tx.amount;
      }
    }

    return {
      totalIncome,
      totalExpenses,
      availableBalance: totalIncome - totalExpenses,
      thisMonthTypeTotal,
    };
  }, [transactions, mode]);

  const recentMatching = useMemo(
    () => transactions.filter((t) => t.type === mode).slice(0, 8),
    [transactions, mode]
  );

  const handleQuickAddAmount = (increment: number) => {
    const current = Number(amount) || 0;
    setAmount(String(Math.round((current + increment) * 100) / 100));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(
        isHi
          ? 'कृपया सही राशि दर्ज करें (₹0 से अधिक)।'
          : 'Please enter a valid positive amount in ₹ (INR).'
      );
      return;
    }
    if (!title.trim()) {
      setError(
        isHi
          ? 'कृपया शीर्षक दर्ज करें।'
          : `Please enter an ${isExpense ? 'expense' : 'income'} title.`
      );
      return;
    }
    if (!category) {
      setError(isHi ? 'कृपया श्रेणी चुनें।' : 'Please select a category.');
      return;
    }
    if (!date) {
      setError(isHi ? 'कृपया तारीख चुनें।' : 'Please select a date.');
      return;
    }

    setSubmitting(true);
    try {
      await onAddTransaction({
        type: mode,
        amount: parsedAmount,
        title: title.trim(),
        category,
        date,
        payment_method: paymentMethod,
        description: description.trim(),
      });
      setAmount('');
      setTitle('');
      setDescription('');
      setSuccessMsg(
        isExpense
          ? isHi
            ? 'खर्च सफलतापूर्वक सहेजा गया।'
            : 'Expense saved to your ledger.'
          : isHi
          ? 'आय सफलतापूर्वक सहेजी गई।'
          : 'Income saved to your ledger.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const quickPresets = isExpense ? [100, 500, 1000, 2500] : [5000, 15000, 25000, 50000];

  return (
    <div className="space-y-6">
      {/* Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isHi ? 'कुल आय (Total Income)' : 'Total Income'}
          </span>
          <p className="mt-1.5 text-lg font-bold font-num text-emerald-700 dark:text-emerald-400">
            {formatINR(summary.totalIncome)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isHi ? 'कुल खर्च (Total Expenses)' : 'Total Expenses'}
          </span>
          <p className="mt-1.5 text-lg font-bold font-num text-slate-900 dark:text-white">
            {formatINR(summary.totalExpenses)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isHi ? 'उपलब्ध शेष राशि (Remaining Balance)' : 'Remaining Available Balance'}
          </span>
          <p className="mt-1.5 text-lg font-bold font-num text-blue-700 dark:text-blue-400">
            {formatINR(summary.availableBalance)}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Entry Form */}
        <section className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {isExpense
                ? isHi
                  ? 'नया खर्च दर्ज करें (Add Expense)'
                  : 'Record New Expense'
                : isHi
                ? 'नई आय दर्ज करें (Add Income)'
                : 'Record New Income'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isExpense
                ? isHi
                  ? 'राशि ₹ (INR), श्रेणी और भुगतान माध्यम चुनें।'
                  : 'Enter the INR amount, category, date, and payment mode.'
                : isHi
                ? 'वेतन, व्यापार आय, फ्रीलांसिंग या अन्य आय जोड़ें।'
                : 'Log salary, business revenue, freelancing, or other inflows.'}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-medium text-red-700 dark:text-red-300"
            >
              {error}
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2"
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'राशि (₹ INR) *' : 'Amount (₹ INR) *'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 font-num">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3.5 py-2.5 text-base font-bold font-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {quickPresets.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleQuickAddAmount(val)}
                    className="px-2.5 py-1 text-xs font-num font-medium rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    +{formatINR(val)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isExpense
                  ? isHi
                    ? 'खर्च का शीर्षक (Expense Title) *'
                    : 'Expense Title *'
                  : isHi
                  ? 'आय का शीर्षक (Income Title) *'
                  : 'Income Title *'}
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  isExpense
                    ? isHi
                      ? 'जैसे: सब्ज़ी और दूध, बिजली बिल, मेट्रो रिचार्ज'
                      : 'e.g. Monthly Groceries, Electricity Bill, Metro Card'
                    : isHi
                    ? 'जैसे: नवंबर वेतन, क्लाइंट प्रोजेक्ट भुगतान'
                    : 'e.g. Monthly Salary, Website Freelance Milestone'
                }
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isHi ? 'श्रेणी (Category) *' : 'Category *'}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {modeCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {getCategoryDisplayName(c.name, categories, language)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isHi ? 'तारीख (Date) *' : 'Date *'}{' '}
                  <span className="font-normal text-slate-400 font-num">
                    ({formatIndianDate(date)})
                  </span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'भुगतान माध्यम (Payment Method) *' : 'Payment Method *'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {paymentMethods.map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                      paymentMethod === method
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {formatPaymentMethod(method, language)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'विवरण / नोट्स (वैकल्पिक)' : 'Description / Notes (Optional)'}
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  isHi
                    ? 'बिल संख्या, दुकान का नाम या अतिरिक्त जानकारी लिखें...'
                    : 'Add vendor name, bill reference, or remarks...'
                }
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {submitting
                  ? isHi
                    ? 'सहेजा जा रहा है...'
                    : 'Saving...'
                  : isExpense
                  ? isHi
                    ? 'खर्च सहेजें'
                    : 'Save Expense Entry'
                  : isHi
                  ? 'आय सहेजें'
                  : 'Save Income Entry'}
              </span>
            </button>
          </form>
        </section>

        {/* Recent Entries of Current Type */}
        <section className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isExpense
                  ? isHi
                    ? 'हाल के खर्च (Recent Expenses)'
                    : 'Recent Expenses'
                  : isHi
                  ? 'हाल की आय (Recent Income)'
                  : 'Recent Income Records'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-num mt-0.5">
                {isHi ? 'इस महीने कुल:' : 'This month total:'}{' '}
                {formatINR(summary.thisMonthTypeTotal)}
              </p>
            </div>
          </div>

          {recentMatching.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {isExpense
                  ? isHi
                    ? 'अभी तक कोई खर्च दर्ज नहीं किया गया है।'
                    : 'No expenses logged yet.'
                  : isHi
                  ? 'अभी तक कोई आय दर्ज नहीं की गई है।'
                  : 'No income entries logged yet.'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isHi
                  ? 'बाईं ओर दिए गए फ़ॉर्म का उपयोग करके प्रविष्टि जोड़ें।'
                  : 'Use the form on the left to record your first entry.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {recentMatching.map((tx) => (
                <div
                  key={tx.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {tx.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>{getCategoryDisplayName(tx.category, categories, language)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatPaymentMethod(tx.payment_method, language)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-num">{formatIndianDate(tx.date)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-sm font-bold font-num ${
                        tx.type === 'income'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatINR(tx.amount)}
                    </span>
                    <div className="flex items-center gap-1">
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
