import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
} from 'lucide-react';
import type { BudgetItem, CategoryItem, Language, TransactionItem } from '../types';
import {
  formatINR,
  getCategoryDisplayName,
  getLocalCurrentMonthKey,
  getMonthName,
} from '../i18n';

interface BudgetViewProps {
  budgets: BudgetItem[];
  transactions: TransactionItem[];
  categories: CategoryItem[];
  language: Language;
  onSaveBudget: (payload: {
    month_key: string;
    category: string;
    limit_amount: number;
  }) => Promise<void>;
  onDeleteBudget: (id: string) => Promise<void>;
}

export const BudgetView: React.FC<BudgetViewProps> = ({
  budgets,
  transactions,
  categories,
  language,
  onSaveBudget,
  onDeleteBudget,
}) => {
  const isHi = language === 'hi';
  const currentMonthKey = getLocalCurrentMonthKey();
  const [initYear, initMonth] = currentMonthKey.split('-').map(Number);

  const [selectedYear, setSelectedYear] = useState(initYear);
  const [selectedMonth, setSelectedMonth] = useState(initMonth);
  const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  );

  const overallBudget = useMemo(
    () => budgets.find((b) => b.month_key === monthKey && b.category === 'OVERALL'),
    [budgets, monthKey]
  );

  const categoryBudgets = useMemo(
    () => budgets.filter((b) => b.month_key === monthKey && b.category !== 'OVERALL'),
    [budgets, monthKey]
  );

  const [overallInput, setOverallInput] = useState('');
  const [catSelected, setCatSelected] = useState('');
  const [catLimitInput, setCatLimitInput] = useState('');
  const [savingOverall, setSavingOverall] = useState(false);
  const [savingCat, setSavingCat] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(
    null
  );

  useEffect(() => {
    setOverallInput(overallBudget ? String(overallBudget.limit_amount) : '');
    setFeedback(null);
  }, [overallBudget, monthKey]);

  useEffect(() => {
    if (expenseCategories.length > 0 && !catSelected) {
      setCatSelected(expenseCategories[0].name);
    }
  }, [expenseCategories, catSelected]);

  const spendingByCat = useMemo(() => {
    let totalMonthSpent = 0;
    const byCat = new Map<string, number>();

    for (const tx of transactions) {
      if (tx.type === 'expense' && tx.date.startsWith(monthKey)) {
        totalMonthSpent += tx.amount;
        byCat.set(tx.category, (byCat.get(tx.category) || 0) + tx.amount);
      }
    }

    return { totalMonthSpent, byCat };
  }, [transactions, monthKey]);

  const overallUtilization = overallBudget
    ? (spendingByCat.totalMonthSpent / overallBudget.limit_amount) * 100
    : 0;

  const overallRemaining = overallBudget
    ? overallBudget.limit_amount - spendingByCat.totalMonthSpent
    : 0;

  const handleSaveOverall = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const val = Number(overallInput);
    if (!Number.isFinite(val) || val <= 0) {
      setFeedback({
        type: 'error',
        message: isHi
          ? 'कृपया वैध मासिक बजट राशि दर्ज करें (₹0 से अधिक)।'
          : 'Please enter a valid positive monthly budget limit in ₹.',
      });
      return;
    }

    setSavingOverall(true);
    try {
      await onSaveBudget({
        month_key: monthKey,
        category: 'OVERALL',
        limit_amount: val,
      });
      setFeedback({
        type: 'success',
        message: isHi
          ? 'मासिक कुल बजट सीमा सहेजी गई।'
          : 'Monthly spending limit saved.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save budget.',
      });
    } finally {
      setSavingOverall(false);
    }
  };

  const handleSaveCategoryBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const val = Number(catLimitInput);
    if (!catSelected) return;
    if (!Number.isFinite(val) || val <= 0) {
      setFeedback({
        type: 'error',
        message: isHi
          ? 'कृपया श्रेणी के लिए वैध बजट राशि दर्ज करें।'
          : 'Please enter a valid positive category budget in ₹.',
      });
      return;
    }

    setSavingCat(true);
    try {
      await onSaveBudget({
        month_key: monthKey,
        category: catSelected,
        limit_amount: val,
      });
      setCatLimitInput('');
      setFeedback({
        type: 'success',
        message: isHi
          ? 'श्रेणी बजट सीमा सफलतापूर्वक अपडेट की गई।'
          : `Category budget saved for ${catSelected}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save category budget.',
      });
    } finally {
      setSavingCat(false);
    }
  };

  const yearOptions = [initYear - 1, initYear, initYear + 1];

  return (
    <div className="space-y-6">
      {/* Month & Year Picker */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {isHi ? 'मासिक बजट योजनाकार (Monthly Budget)' : 'Monthly Spending Limits & Alerts'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isHi
              ? '80% और 100% खर्च सीमा पर स्वचालित चेतावनी प्राप्त करें।'
              : 'Track used vs remaining budget with automatic warnings at 80% and 100%.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
              <option key={m} value={m}>
                {getMonthName(m, language)}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 text-sm font-semibold font-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </section>

      {feedback && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs font-medium ${
            feedback.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* 80% / 100% Threshold Alert Banner */}
      {overallBudget && overallUtilization >= 80 && (
        <div
          role="alert"
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            overallUtilization >= 100
              ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-900 dark:text-red-200'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200'
          }`}
        >
          {overallUtilization >= 100 ? (
            <AlertOctagon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-bold">
              {overallUtilization >= 100
                ? isHi
                  ? `100% बजट अलर्ट: आपने इस महीने की खर्च सीमा पार कर ली है (${overallUtilization.toFixed(1)}%)`
                  : `100% Budget Reached: Monthly spending is at ${overallUtilization.toFixed(1)}% of your limit`
                : isHi
                ? `80% बजट चेतावनी: आपका खर्च निर्धारित सीमा के ${overallUtilization.toFixed(1)}% पर पहुँच गया है`
                : `80% Budget Warning: You have used ${overallUtilization.toFixed(1)}% of your monthly spending limit`}
            </p>
            <p className="text-xs opacity-90 mt-1 font-num">
              {overallRemaining >= 0
                ? isHi
                  ? `शेष बजट: ${formatINR(overallRemaining)} (सीमा: ${formatINR(overallBudget.limit_amount)})`
                  : `Remaining budget: ${formatINR(overallRemaining)} out of ${formatINR(overallBudget.limit_amount)}.`
                : isHi
                ? `अतिरिक्त खर्च: ${formatINR(Math.abs(overallRemaining))} सीमा से अधिक`
                : `Exceeded limit by ${formatINR(Math.abs(overallRemaining))}.`}
            </p>
          </div>
        </div>
      )}

      {/* Overall Monthly Budget Overview + Form */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isHi ? 'कुल मासिक बजट स्थिति' : 'Overall Monthly Budget Overview'}
              </h3>
              {overallBudget && (
                <button
                  type="button"
                  onClick={() => onDeleteBudget(overallBudget.id)}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isHi ? 'सीमा हटाएं' : 'Clear Limit'}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {getMonthName(selectedMonth, language)} {selectedYear}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {isHi ? 'निर्धारित बजट' : 'Monthly Limit'}
                </span>
                <p className="text-lg font-bold font-num text-slate-900 dark:text-white mt-0.5">
                  {overallBudget ? formatINR(overallBudget.limit_amount) : '—'}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {isHi ? 'प्रयुक्त बजट (Used)' : 'Used Budget'}
                </span>
                <p className="text-lg font-bold font-num text-blue-700 dark:text-blue-400 mt-0.5">
                  {formatINR(spendingByCat.totalMonthSpent)}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {isHi ? 'शेष बजट (Remaining)' : 'Remaining Budget'}
                </span>
                <p
                  className={`text-lg font-bold font-num mt-0.5 ${
                    !overallBudget
                      ? 'text-slate-400'
                      : overallRemaining < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {overallBudget
                    ? overallRemaining >= 0
                      ? formatINR(overallRemaining)
                      : `-${formatINR(Math.abs(overallRemaining))}`
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          {overallBudget ? (
            <div className="mt-6 space-y-2">
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    overallUtilization >= 100
                      ? 'bg-red-600'
                      : overallUtilization >= 80
                      ? 'bg-amber-500'
                      : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(overallUtilization, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  {overallUtilization >= 100 ? (
                    <>
                      <AlertOctagon className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                      <span>{isHi ? '100% सीमा पार' : '100%+ Limit Reached'}</span>
                    </>
                  ) : overallUtilization >= 80 ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>{isHi ? '80% चेतावनी स्तर' : '80% Warning Threshold'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{isHi ? 'सुरक्षित स्तर' : 'Healthy Spend Rate'}</span>
                    </>
                  )}
                </span>
                <span className="font-num font-semibold">
                  {overallUtilization.toFixed(1)}% {isHi ? 'उपयोग' : 'used'}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
              {isHi
                ? 'दाईं ओर अपने महीने की खर्च सीमा दर्ज करके बजट ट्रैकिंग शुरू करें।'
                : 'Enter a monthly spending limit on the right to start tracking utilization.'}
            </p>
          )}
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {isHi ? 'कुल मासिक खर्च सीमा सेट करें' : 'Set Monthly Spending Limit'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
            {isHi
              ? `${getMonthName(selectedMonth, language)} ${selectedYear} के लिए अधिकतम खर्च राशि`
              : `Target maximum spend for ${getMonthName(selectedMonth, language)} ${selectedYear}`}
          </p>

          <form onSubmit={handleSaveOverall} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'मासिक बजट सीमा (₹ INR)' : 'Monthly Limit Amount (₹ INR)'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 font-num">
                  ₹
                </span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={overallInput}
                  onChange={(e) => setOverallInput(e.target.value)}
                  placeholder="25000"
                  className="w-full pl-8 pr-3.5 py-2.5 text-sm font-bold font-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[15000, 25000, 40000, 60000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setOverallInput(String(preset))}
                    className="px-2.5 py-1 text-xs font-num rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    {formatINR(preset)}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={savingOverall}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              {savingOverall
                ? isHi
                  ? 'सहेजा जा रहा है...'
                  : 'Saving...'
                : overallBudget
                ? isHi
                  ? 'मासिक बजट अपडेट करें'
                  : 'Update Monthly Limit'
                : isHi
                ? 'मासिक बजट सहेजें'
                : 'Save Monthly Limit'}
            </button>
          </form>
        </div>
      </section>

      {/* Category-Wise Budgets */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isHi ? 'श्रेणी-वार मासिक बजट (Category Budgets)' : 'Category-Wise Spending Limits'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isHi
                ? 'किराना, खरीदारी या बिल जैसी विशिष्ट श्रेणियों पर खर्च सीमा रखें।'
                : 'Set optional limits for individual categories like Groceries, Shopping, or Bills.'}
            </p>
          </div>

          <form
            onSubmit={handleSaveCategoryBudget}
            className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3"
          >
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                {isHi ? 'खर्च श्रेणी' : 'Expense Category'}
              </label>
              <select
                value={catSelected}
                onChange={(e) => setCatSelected(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {getCategoryDisplayName(c.name, categories, language)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                {isHi ? 'सीमा (₹ INR)' : 'Limit (₹ INR)'}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={catLimitInput}
                onChange={(e) => setCatLimitInput(e.target.value)}
                placeholder="5000"
                className="w-full sm:w-36 px-3 py-2 text-xs font-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={savingCat}
              className="py-2 px-3.5 rounded-lg bg-slate-900 dark:bg-blue-700 hover:bg-slate-800 dark:hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isHi ? 'श्रेणी सीमा जोड़ें' : 'Set Category Limit'}</span>
            </button>
          </form>
        </div>

        {categoryBudgets.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
            {isHi
              ? 'इस महीने के लिए अभी कोई श्रेणी-विशिष्ट बजट नहीं जोड़ा गया है।'
              : 'No category-specific limits configured for this month yet.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categoryBudgets.map((b) => {
              const spent = spendingByCat.byCat.get(b.category) || 0;
              const pct = (spent / b.limit_amount) * 100;
              const rem = b.limit_amount - spent;

              return (
                <div
                  key={b.id}
                  className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {getCategoryDisplayName(b.category, categories, language)}
                      </p>
                      <p className="text-xs font-num text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatINR(spent)} / {formatINR(b.limit_amount)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteBudget(b.id)}
                      className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                      aria-label={`Remove ${b.category} budget`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        pct >= 100 ? 'bg-red-600' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                      {pct >= 100 ? (
                        <>
                          <AlertOctagon className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          <span>{isHi ? 'सीमा पार (100%+)' : '100% Limit Exceeded'}</span>
                        </>
                      ) : pct >= 80 ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>{isHi ? '80% चेतावनी' : '80% Warning'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{pct.toFixed(0)}%</span>
                        </>
                      )}
                    </span>
                    <span className="font-num font-medium text-slate-700 dark:text-slate-300">
                      {rem >= 0
                        ? `${isHi ? 'शेष:' : 'Left:'} ${formatINR(rem)}`
                        : `${isHi ? 'अधिक:' : 'Over:'} ${formatINR(Math.abs(rem))}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
