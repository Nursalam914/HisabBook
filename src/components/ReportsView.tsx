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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Download, FileSpreadsheet } from 'lucide-react';
import type { BudgetItem, CategoryItem, Language, ThemeMode, TransactionItem } from '../types';
import {
  formatINR,
  getCategoryDisplayName,
  getLocalCurrentMonthKey,
  getMonthName,
  getShortMonthName,
} from '../i18n';
import { exportLedgerToExcel, exportMonthlyReportToPDF } from '../utils/exportReports';

interface ReportsViewProps {
  transactions: TransactionItem[];
  categories: CategoryItem[];
  budgets: BudgetItem[];
  userName: string;
  language: Language;
  theme: ThemeMode;
}

const CHART_COLORS = [
  '#2563EB',
  '#0284C7',
  '#4F46E5',
  '#0D9488',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#DB2777',
  '#059669',
  '#64748B',
];

export const ReportsView: React.FC<ReportsViewProps> = ({
  transactions,
  categories,
  budgets,
  userName,
  language,
  theme,
}) => {
  const isHi = language === 'hi';
  const defaultMonthKey = getLocalCurrentMonthKey();
  const [initYear, initMonth] = defaultMonthKey.split('-').map(Number);

  const [selectedYear, setSelectedYear] = useState<number>(initYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(initMonth);

  const selectedMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const availableYears = useMemo(() => {
    const years = new Set<number>([initYear - 2, initYear - 1, initYear, initYear + 1]);
    for (const tx of transactions) {
      const y = Number(tx.date.slice(0, 4));
      if (Number.isFinite(y) && y > 2000) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, initYear]);

  // Selected month transactions
  const monthTransactions = useMemo(
    () => transactions.filter((t) => t.date.startsWith(selectedMonthKey)),
    [transactions, selectedMonthKey]
  );

  // Previous month comparison
  const prevMonthStats = useMemo(() => {
    const prevDate = new Date(selectedYear, selectedMonth - 2, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    let prevExpense = 0;
    for (const tx of transactions) {
      if (tx.type === 'expense' && tx.date.startsWith(prevKey)) {
        prevExpense += tx.amount;
      }
    }
    return { prevKey, prevExpense };
  }, [transactions, selectedYear, selectedMonth]);

  // Totals for selected month and selected year
  const reportTotals = useMemo(() => {
    let monthIncome = 0;
    let monthExpense = 0;
    let yearExpense = 0;
    let yearIncome = 0;

    const yearPrefix = `${selectedYear}-`;
    for (const tx of transactions) {
      if (tx.date.startsWith(yearPrefix)) {
        if (tx.type === 'income') yearIncome += tx.amount;
        else yearExpense += tx.amount;
      }
      if (tx.date.startsWith(selectedMonthKey)) {
        if (tx.type === 'income') monthIncome += tx.amount;
        else monthExpense += tx.amount;
      }
    }

    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const dailyAverage = monthExpense / daysInMonth;

    return {
      monthIncome,
      monthExpense,
      netMonthly: monthIncome - monthExpense,
      yearExpense,
      yearIncome,
      dailyAverage,
    };
  }, [transactions, selectedYear, selectedMonth, selectedMonthKey]);

  // 1. Daily Expense Breakdown
  const dailyBreakdown = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const map = new Map<number, number>();
    for (let d = 1; d <= daysInMonth; d++) map.set(d, 0);

    for (const tx of monthTransactions) {
      if (tx.type === 'expense') {
        const day = Number(tx.date.slice(8, 10));
        map.set(day, (map.get(day) || 0) + tx.amount);
      }
    }

    return Array.from(map.entries()).map(([day, amount]) => ({
      day: String(day).padStart(2, '0'),
      fullDate: `${String(day).padStart(2, '0')}/${String(selectedMonth).padStart(2, '0')}/${selectedYear}`,
      amount: Math.round(amount * 100) / 100,
    }));
  }, [monthTransactions, selectedYear, selectedMonth]);

  // 2. Weekly Spending Breakdown
  const weeklyBreakdown = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const buckets = [
      { label: isHi ? 'सप्ताह 1 (1–7)' : 'Week 1 (1–7)', min: 1, max: 7, amount: 0 },
      { label: isHi ? 'सप्ताह 2 (8–14)' : 'Week 2 (8–14)', min: 8, max: 14, amount: 0 },
      { label: isHi ? 'सप्ताह 3 (15–21)' : 'Week 3 (15–21)', min: 15, max: 21, amount: 0 },
      { label: isHi ? 'सप्ताह 4 (22–28)' : 'Week 4 (22–28)', min: 22, max: 28, amount: 0 },
    ];
    if (daysInMonth > 28) {
      buckets.push({
        label: isHi ? `सप्ताह 5 (29–${daysInMonth})` : `Week 5 (29–${daysInMonth})`,
        min: 29,
        max: daysInMonth,
        amount: 0,
      });
    }

    for (const tx of monthTransactions) {
      if (tx.type === 'expense') {
        const day = Number(tx.date.slice(8, 10));
        const bucket = buckets.find((b) => day >= b.min && day <= b.max);
        if (bucket) bucket.amount += tx.amount;
      }
    }

    return buckets.map((b) => ({
      ...b,
      amount: Math.round(b.amount * 100) / 100,
    }));
  }, [monthTransactions, selectedYear, selectedMonth, isHi]);

  // 3. Category-Wise Spending
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of monthTransactions) {
      if (tx.type === 'expense') {
        map.set(tx.category, (map.get(tx.category) || 0) + tx.amount);
      }
    }

    const total = reportTotals.monthExpense || 1;
    return Array.from(map.entries())
      .map(([cat, amount], index) => {
        const catMeta = categories.find((c) => c.name.toLowerCase() === cat.toLowerCase());
        return {
          category: cat,
          displayCategory: getCategoryDisplayName(cat, categories, language),
          amount: Math.round(amount * 100) / 100,
          share: (amount / total) * 100,
          color: catMeta?.color || CHART_COLORS[index % CHART_COLORS.length],
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [monthTransactions, reportTotals.monthExpense, categories, language]);

  // 4. Monthly Comparison across Selected Year (Jan–Dec)
  const yearlyMonthlyComparison = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, idx) => {
      const m = idx + 1;
      const mKey = `${selectedYear}-${String(m).padStart(2, '0')}`;
      let expense = 0;
      let income = 0;
      for (const tx of transactions) {
        if (tx.date.startsWith(mKey)) {
          if (tx.type === 'income') income += tx.amount;
          else expense += tx.amount;
        }
      }
      return {
        month: getShortMonthName(m, language),
        expense: Math.round(expense * 100) / 100,
        income: Math.round(income * 100) / 100,
      };
    });
    return months;
  }, [transactions, selectedYear, language]);

  const overallBudgetForMonth = useMemo(() => {
    const found = budgets.find(
      (b) => b.month_key === selectedMonthKey && b.category === 'OVERALL'
    );
    return found ? found.limit_amount : null;
  }, [budgets, selectedMonthKey]);

  const monthDiff = reportTotals.monthExpense - prevMonthStats.prevExpense;

  const axisColor = theme === 'dark' ? '#94A3B8' : '#64748B';
  const gridColor = theme === 'dark' ? '#1E293B' : '#E2E8F0';
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
    borderColor: theme === 'dark' ? '#334155' : '#E2E8F0',
    borderRadius: '8px',
    fontSize: '12px',
  };

  return (
    <div className="space-y-6">
      {/* Period Selector & Export Toolbar */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {isHi ? 'महीना चुनें (Month)' : 'Select Month'}
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3.5 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                <option key={m} value={m}>
                  {getMonthName(m, language)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {isHi ? 'वर्ष चुनें (Year)' : 'Select Year'}
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3.5 py-2 text-sm font-semibold font-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-end">
          <button
            type="button"
            onClick={() =>
              exportMonthlyReportToPDF({
                year: selectedYear,
                month: selectedMonth,
                userName,
                monthTransactions,
                categorySummary: categoryBreakdown.map((c) => ({
                  category: c.category,
                  amount: c.amount,
                  share: c.share,
                })),
                overallBudgetLimit: overallBudgetForMonth,
              })
            }
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-700 hover:bg-blue-800 text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isHi ? 'PDF रिपोर्ट डाउनलोड' : 'Export PDF Report'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              exportLedgerToExcel({
                filename: `HisabBook_Report_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`,
                transactions: monthTransactions,
                budgets: budgets.filter((b) => b.month_key === selectedMonthKey),
              })
            }
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isHi ? 'Excel डाउनलोड' : 'Export Excel'}</span>
          </button>
        </div>
      </section>

      {/* 4 Summary Report Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isHi ? 'मासिक कुल खर्च' : 'Monthly Total Expenses'}
          </span>
          <p className="mt-2 text-xl font-bold font-num text-slate-900 dark:text-white">
            {formatINR(reportTotals.monthExpense)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-num">
            {prevMonthStats.prevExpense > 0
              ? `${monthDiff >= 0 ? '+' : '-'}${formatINR(Math.abs(monthDiff))} ${
                  isHi ? 'पिछले माह से' : 'vs previous month'
                }`
              : isHi
              ? `${getMonthName(selectedMonth, language)} ${selectedYear}`
              : `${getMonthName(selectedMonth, language)} ${selectedYear}`}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isHi ? 'मासिक आय और बचत' : 'Monthly Income & Net'}
          </span>
          <p className="mt-2 text-xl font-bold font-num text-emerald-700 dark:text-emerald-400">
            {formatINR(reportTotals.monthIncome)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-num">
            {isHi ? 'शुद्ध बचत:' : 'Net balance:'} {formatINR(reportTotals.netMonthly)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isHi ? 'औसत दैनिक खर्च' : 'Daily Average Spend'}
          </span>
          <p className="mt-2 text-xl font-bold font-num text-blue-700 dark:text-blue-400">
            {formatINR(reportTotals.dailyAverage)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isHi ? 'चयनित महीने का प्रतिदिन औसत' : 'Per calendar day in selected month'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isHi ? `वार्षिक कुल खर्च (${selectedYear})` : `Yearly Total Expenses (${selectedYear})`}
          </span>
          <p className="mt-2 text-xl font-bold font-num text-slate-900 dark:text-white">
            {formatINR(reportTotals.yearExpense)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-num">
            {isHi ? 'वार्षिक आय:' : 'Yearly income:'} {formatINR(reportTotals.yearIncome)}
          </p>
        </div>
      </section>

      {/* Row 1: Daily Breakdown + Weekly Spending */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {isHi ? 'दैनिक खर्च विवरण (Daily Expense Breakdown)' : 'Daily Expense Breakdown'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-5">
            {getMonthName(selectedMonth, language)} {selectedYear}
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyBreakdown} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis
                  dataKey="day"
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
                  formatter={(v: unknown) => [formatINR(Number(v)), isHi ? 'खर्च' : 'Expense']}
                  labelFormatter={(_l, p) => p?.[0]?.payload?.fullDate || ''}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="amount" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {isHi ? 'साप्ताहिक खर्च (Weekly Spending)' : 'Weekly Spending'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-5">
            {isHi ? 'सप्ताह के अनुसार खर्च का विभाजन' : 'Week-by-week spending distribution'}
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyBreakdown}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                <XAxis
                  type="number"
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={108}
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: unknown) => [formatINR(Number(v)), isHi ? 'साप्ताहिक खर्च' : 'Weekly Spend']}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="amount" fill="#0284C7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Row 2: Category-Wise Spending + Yearly Monthly Comparison */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category-Wise Spending */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {isHi ? 'श्रेणी-वार खर्च (Category-Wise Spending)' : 'Category-Wise Spending'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
            {isHi ? 'किन मदों में सबसे अधिक खर्च हुआ' : 'Share of monthly expenses by category'}
          </p>

          {categoryBreakdown.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
              {isHi
                ? 'चयनित महीने में कोई खर्च दर्ज नहीं है।'
                : 'No expenses recorded in the selected month.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              <div className="sm:col-span-5 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="amount"
                      nameKey="displayCategory"
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={76}
                      paddingAngle={2}
                    >
                      {categoryBreakdown.map((entry) => (
                        <Cell key={entry.category} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: unknown) => formatINR(Number(v))}
                      contentStyle={tooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="sm:col-span-7 space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {categoryBreakdown.map((item) => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate pr-2">
                        {item.displayCategory}
                      </span>
                      <span className="font-num font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatINR(item.amount)}{' '}
                        <span className="text-slate-400 font-normal">
                          ({item.share.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(item.share, 100)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Yearly Monthly Comparison */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {isHi
              ? `मासिक तुलना और वार्षिक व्यय (${selectedYear})`
              : `Monthly Comparison & Yearly Overview (${selectedYear})`}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
            {isHi ? 'जनवरी से दिसंबर तक आय और खर्च की तुलना' : 'Jan–Dec monthly income vs expense comparison'}
          </p>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={yearlyMonthlyComparison}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis
                  dataKey="month"
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
                  formatter={(v: unknown, name: unknown) => [formatINR(Number(v)), String(name)]}
                  contentStyle={tooltipStyle}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="income" name={isHi ? 'आय (Income)' : 'Income'} fill="#16A34A" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" name={isHi ? 'खर्च (Expense)' : 'Expenses'} fill="#2563EB" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
};
