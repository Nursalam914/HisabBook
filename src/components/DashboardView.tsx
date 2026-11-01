import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  NavSection,
  type BudgetItem,
  type CategoryItem,
  type Language,
  type ThemeMode,
  type TransactionItem,
} from '../types';
import {
  formatIndianDate,
  formatINR,
  formatPaymentMethod,
  getCategoryDisplayName,
  getLocalCurrentMonthKey,
  getLocalTodayISO,
  getMonthName,
  getShortMonthName,
  TRANSLATIONS,
} from '../i18n';

interface DashboardViewProps {
  transactions: TransactionItem[];
  categories: CategoryItem[];
  budgets: BudgetItem[];
  language: Language;
  theme: ThemeMode;
  onNavigate: (section: NavSection) => void;
  onEditTransaction: (tx: TransactionItem) => void;
  onDeleteTransaction: (tx: TransactionItem) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  categories,
  budgets,
  language,
  theme,
  onNavigate,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const [chartView, setChartView] = useState<'daily' | 'sixMonths'>('daily');
  const isHi = language === 'hi';
  const t = TRANSLATIONS[language];

  const todayISO = getLocalTodayISO();
  const currentMonthKey = getLocalCurrentMonthKey();
  const [currYear, currMonth] = currentMonthKey.split('-').map(Number);

  const metrics = useMemo(() => {
    let totalIncome = 0;
    let totalExpenses = 0;
    let todayExpenses = 0;
    let monthExpenses = 0;
    let monthIncome = 0;

    for (const tx of transactions) {
      if (tx.type === 'income') {
        totalIncome += tx.amount;
        if (tx.date.startsWith(currentMonthKey)) {
          monthIncome += tx.amount;
        }
      } else {
        totalExpenses += tx.amount;
        if (tx.date === todayISO) {
          todayExpenses += tx.amount;
        }
        if (tx.date.startsWith(currentMonthKey)) {
          monthExpenses += tx.amount;
        }
      }
    }

    return {
      totalIncome,
      totalExpenses,
      availableBalance: totalIncome - totalExpenses,
      todayExpenses,
      monthExpenses,
      monthIncome,
    };
  }, [transactions, todayISO, currentMonthKey]);

  const currentOverallBudget = useMemo(() => {
    return budgets.find(
      (b) => b.month_key === currentMonthKey && b.category === 'OVERALL'
    );
  }, [budgets, currentMonthKey]);

  const budgetPercent = currentOverallBudget
    ? (metrics.monthExpenses / currentOverallBudget.limit_amount) * 100
    : 0;

  // Daily spending data for current month
  const dailyChartData = useMemo(() => {
    const daysInMonth = new Date(currYear, currMonth, 0).getDate();
    const map = new Map<number, number>();
    for (let d = 1; d <= daysInMonth; d++) {
      map.set(d, 0);
    }
    for (const tx of transactions) {
      if (tx.type === 'expense' && tx.date.startsWith(currentMonthKey)) {
        const day = Number(tx.date.slice(8, 10));
        map.set(day, (map.get(day) || 0) + tx.amount);
      }
    }
    return Array.from(map.entries()).map(([day, spent]) => ({
      label: String(day).padStart(2, '0'),
      dateLabel: `${String(day).padStart(2, '0')}/${String(currMonth).padStart(2, '0')}`,
      spent: Math.round(spent * 100) / 100,
    }));
  }, [transactions, currentMonthKey, currYear, currMonth]);

  // 6-Month Income vs Expenses comparison
  const sixMonthData = useMemo(() => {
    const result: { label: string; monthKey: string; income: number; expense: number }[] = [];
    for (let offset = 5; offset >= 0; offset--) {
      const d = new Date(currYear, currMonth - 1 - offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const mKey = `${y}-${String(m).padStart(2, '0')}`;
      let inc = 0;
      let exp = 0;
      for (const tx of transactions) {
        if (tx.date.startsWith(mKey)) {
          if (tx.type === 'income') inc += tx.amount;
          else exp += tx.amount;
        }
      }
      result.push({
        label: `${getShortMonthName(m, language)} ${String(y).slice(2)}`,
        monthKey: mKey,
        income: Math.round(inc * 100) / 100,
        expense: Math.round(exp * 100) / 100,
      });
    }
    return result;
  }, [transactions, currYear, currMonth, language]);

  const recentTransactions = useMemo(() => transactions.slice(0, 8), [transactions]);

  const axisColor = theme === 'dark' ? '#94A3B8' : '#64748B';
  const gridColor = theme === 'dark' ? '#1E293B' : '#E2E8F0';

  return (
    <div className="space-y-6">
      {/* Monthly Budget Alert Banner (80% Warning / 100% Alert) */}
      {currentOverallBudget && budgetPercent >= 80 && (
        <div
          role="status"
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border ${
            budgetPercent >= 100
              ? 'bg-red-50 dark:bg-red-950/35 border-red-200 dark:border-red-900 text-red-900 dark:text-red-200'
              : 'bg-amber-50 dark:bg-amber-950/35 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {budgetPercent >= 100 ? (
              <AlertOctagon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-bold">
                {budgetPercent >= 100
                  ? isHi
                    ? `बजट सीमा पार (${budgetPercent.toFixed(0)}% उपयोग)`
                    : `Alert: 100% Monthly Budget Limit Reached (${budgetPercent.toFixed(1)}% used)`
                  : isHi
                  ? `चेतावनी: मासिक बजट का ${budgetPercent.toFixed(0)}% खर्च हो चुका है`
                  : `Warning: ${budgetPercent.toFixed(1)}% of Monthly Budget Used`}
              </p>
              <p className="text-xs opacity-90 mt-0.5 font-num">
                {isHi
                  ? `इस महीने खर्च: ${formatINR(metrics.monthExpenses)} · बजट सीमा: ${formatINR(currentOverallBudget.limit_amount)}`
                  : `Spent ${formatINR(metrics.monthExpenses)} out of ${formatINR(currentOverallBudget.limit_amount)} limit for ${getMonthName(currMonth, 'en')} ${currYear}.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(NavSection.BUDGET)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 self-start sm:self-center"
          >
            {isHi ? 'बजट समायोजित करें' : 'Manage Budget'}
          </button>
        </div>
      )}

      {/* 5 Core KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {/* Available Balance (Focal Primary Anchor) */}
        <div className="bg-blue-700 dark:bg-blue-800 text-white rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-100">{t.kpi.availableBalance}</span>
            <Wallet className="w-4 h-4 text-blue-200" />
          </div>
          <p className="mt-3 text-2xl font-bold font-num tracking-tight">
            {formatINR(metrics.availableBalance)}
          </p>
          <p className="mt-1.5 text-xs text-blue-100">
            {metrics.availableBalance >= 0
              ? isHi
                ? 'सकारात्मक शुद्ध शेष'
                : 'Net positive balance'
              : isHi
              ? 'खर्च आय से अधिक है'
              : 'Expenses exceed recorded income'}
          </p>
        </div>

        {/* Total Income */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t.kpi.totalIncome}
          </span>
          <p className="mt-3 text-xl font-bold font-num text-emerald-700 dark:text-emerald-400">
            {formatINR(metrics.totalIncome)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-num">
            {isHi ? 'इस महीने:' : 'This month:'} {formatINR(metrics.monthIncome)}
          </p>
        </div>

        {/* Total Expenses */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t.kpi.totalExpenses}
          </span>
          <p className="mt-3 text-xl font-bold font-num text-slate-900 dark:text-white">
            {formatINR(metrics.totalExpenses)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {isHi ? 'कुल दर्ज खर्च' : 'Cumulative recorded spend'}
          </p>
        </div>

        {/* Today's Expenses */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t.kpi.todayExpenses}
          </span>
          <p className="mt-3 text-xl font-bold font-num text-slate-900 dark:text-white">
            {formatINR(metrics.todayExpenses)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-num">
            {formatIndianDate(todayISO)}
          </p>
        </div>

        {/* This Month's Expenses */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t.kpi.monthExpenses}
          </span>
          <p className="mt-3 text-xl font-bold font-num text-blue-700 dark:text-blue-400">
            {formatINR(metrics.monthExpenses)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {getMonthName(currMonth, language)} {currYear}
          </p>
        </div>
      </section>

      {/* Chart + Budget Status Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Monthly Spending Chart */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {chartView === 'daily'
                  ? isHi
                    ? `मासिक खर्च चार्ट (${getMonthName(currMonth, language)} ${currYear})`
                    : `Monthly Spending Chart (${getMonthName(currMonth, language)} ${currYear})`
                  : isHi
                  ? 'पिछले 6 महीनों की आय बनाम खर्च'
                  : '6-Month Income vs Expenses'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {chartView === 'daily'
                  ? isHi
                    ? 'प्रतिदिन खर्च का विवरण (₹ INR)'
                    : 'Day-by-day expense breakdown in Indian Rupees (₹)'
                  : isHi
                  ? 'मासिक आय और खर्च की तुलना'
                  : 'Monthly inflow and spending comparison'}
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setChartView('daily')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  chartView === 'daily'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isHi ? 'दैनिक खर्च' : 'Daily Spend'}
              </button>
              <button
                type="button"
                onClick={() => setChartView('sixMonths')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  chartView === 'sixMonths'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isHi ? '6-माह तुलना' : '6-Month Trend'}
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            {chartView === 'daily' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: axisColor, fontSize: 11 }}
                    axisLine={{ stroke: gridColor }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: axisColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip
                    formatter={(value: unknown) => [formatINR(Number(value)), isHi ? 'खर्च' : 'Spent']}
                    labelFormatter={(_label, payload) =>
                      payload?.[0]?.payload?.dateLabel
                        ? `${isHi ? 'तारीख' : 'Date'}: ${payload[0].payload.dateLabel}/${currYear}`
                        : ''
                    }
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
                      borderColor: theme === 'dark' ? '#334155' : '#E2E8F0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="spent" name={isHi ? 'दैनिक खर्च' : 'Daily Expense'} fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sixMonthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: axisColor, fontSize: 11 }}
                    axisLine={{ stroke: gridColor }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: axisColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [formatINR(Number(value)), String(name)]}
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
                      borderColor: theme === 'dark' ? '#334155' : '#E2E8F0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="income" name={isHi ? 'आय (Income)' : 'Income'} fill="#16A34A" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name={isHi ? 'खर्च (Expense)' : 'Expense'} fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Monthly Budget & Quick Actions Panel */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isHi ? 'मासिक बजट स्थिति' : 'Monthly Budget Status'}
              </h2>
              <button
                type="button"
                onClick={() => onNavigate(NavSection.BUDGET)}
                className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                {currentOverallBudget ? (isHi ? 'बदलें' : 'Edit Limit') : isHi ? 'बजट सेट करें' : 'Set Limit'}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {getMonthName(currMonth, language)} {currYear}
            </p>

            {currentOverallBudget ? (
              <div className="mt-6 space-y-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isHi ? 'खर्च किया गया' : 'Used Budget'}
                    </p>
                    <p className="text-lg font-bold font-num text-slate-900 dark:text-white mt-0.5">
                      {formatINR(metrics.monthExpenses)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isHi ? 'मासिक सीमा' : 'Monthly Limit'}
                    </p>
                    <p className="text-sm font-semibold font-num text-slate-700 dark:text-slate-300 mt-0.5">
                      {formatINR(currentOverallBudget.limit_amount)}
                    </p>
                  </div>
                </div>

                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${
                      budgetPercent >= 100
                        ? 'bg-red-600'
                        : budgetPercent >= 80
                        ? 'bg-amber-500'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                    {budgetPercent >= 100 ? (
                      <>
                        <AlertOctagon className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        <span>{isHi ? 'सीमा समाप्त' : 'Over limit'}</span>
                      </>
                    ) : budgetPercent >= 80 ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>{isHi ? '80% चेतावनी' : 'Near limit (80%+)'}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{isHi ? 'बजट के भीतर' : 'Within budget'}</span>
                      </>
                    )}
                  </span>
                  <span className="font-num font-semibold text-slate-700 dark:text-slate-300">
                    {isHi ? 'शेष:' : 'Remaining:'}{' '}
                    {formatINR(Math.max(0, currentOverallBudget.limit_amount - metrics.monthExpenses))}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-6 py-6 px-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-center">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {isHi
                    ? 'इस महीने के लिए अभी कोई खर्च सीमा निर्धारित नहीं की गई है। 80% और 100% अलर्ट पाने के लिए बजट सेट करें।'
                    : 'No spending limit set for this month yet. Set a monthly budget to receive automatic 80% and 100% alerts.'}
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate(NavSection.BUDGET)}
                  className="mt-3 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-700 hover:bg-blue-800 text-white transition-colors"
                >
                  {isHi ? 'मासिक बजट सेट करें' : 'Set Monthly Budget'}
                </button>
              </div>
            )}
          </div>

          <div className="pt-5 mt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onNavigate(NavSection.ADD_EXPENSE)}
              className="py-2.5 px-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isHi ? 'खर्च जोड़ें' : 'Add Expense'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate(NavSection.ADD_INCOME)}
              className="py-2.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isHi ? 'आय जोड़ें' : 'Add Income'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Recent Transactions Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {isHi ? 'हाल के लेन-देन (Recent Transactions)' : 'Recent Transactions'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isHi ? 'नवीनतम आय और खर्च प्रविष्टियाँ' : 'Latest recorded expenses and income entries'}
            </p>
          </div>
          {transactions.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate(NavSection.TRANSACTIONS)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              <span>{isHi ? 'सभी देखें' : 'View All'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {isHi ? 'अभी तक कोई लेन-देन दर्ज नहीं है' : 'No transactions recorded yet'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {isHi
                ? 'अपने मासिक खर्च और उपलब्ध शेष की गणना शुरू करने के लिए अपनी पहली आय या दैनिक खर्च दर्ज करें।'
                : 'Start tracking your finances by adding your monthly income or logging your first daily expense.'}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate(NavSection.ADD_EXPENSE)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-700 hover:bg-blue-800 text-white transition-colors"
              >
                {isHi ? 'पहला खर्च जोड़ें' : 'Log First Expense'}
              </button>
              <button
                type="button"
                onClick={() => onNavigate(NavSection.ADD_INCOME)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {isHi ? 'आय दर्ज करें' : 'Record Income'}
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-900/60">
                  <th className="py-3 px-5">{isHi ? 'तारीख' : 'Date'}</th>
                  <th className="py-3 px-4">{isHi ? 'विवरण' : 'Title & Details'}</th>
                  <th className="py-3 px-4 hidden md:table-cell">{isHi ? 'श्रेणी और माध्यम' : 'Category & Method'}</th>
                  <th className="py-3 px-4 text-right">{isHi ? 'राशि (₹)' : 'Amount (₹)'}</th>
                  <th className="py-3 px-5 text-right">{isHi ? 'कार्य' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {recentTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-5 font-num text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatIndianDate(tx.date)}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white leading-snug">
                        {tx.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 md:hidden mt-0.5">
                        <span>{getCategoryDisplayName(tx.category, categories, language)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatPaymentMethod(tx.payment_method, language)}</span>
                      </div>
                      {tx.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs mt-0.5">
                          {tx.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell text-xs text-slate-600 dark:text-slate-400">
                      <span>{getCategoryDisplayName(tx.category, categories, language)}</span>
                      <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
                      <span>{formatPaymentMethod(tx.payment_method, language)}</span>
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
