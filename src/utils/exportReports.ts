import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { BudgetItem, CategoryItem, TransactionItem } from '../types';
import { formatIndianDate, formatINR, getMonthName } from '../i18n';

function formatPdfINR(amount: number): string {
  const formattedNumber = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
  return `Rs. ${formattedNumber}`;
}

export function exportTransactionsToPDF(params: {
  title: string;
  subtitle: string;
  userName: string;
  transactions: TransactionItem[];
  filename: string;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const totalIncome = params.transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = params.transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);
  const netBalance = totalIncome - totalExpense;

  // Header band
  doc.setFillColor(29, 78, 216); // Royal Blue #1D4ED8
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 78, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('HisabBook — Personal Financial Statement', 40, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${params.title}  |  Account: ${params.userName}`, 40, 52);
  doc.text(params.subtitle, 40, 66);

  // Summary Box
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Total Income: ${formatPdfINR(totalIncome)}`, 40, 104);
  doc.text(`Total Expenses: ${formatPdfINR(totalExpense)}`, 220, 104);
  doc.text(`Net Balance: ${formatPdfINR(netBalance)}`, 400, 104);

  const rows = params.transactions.map((tx, idx) => [
    String(idx + 1),
    formatIndianDate(tx.date),
    tx.title,
    tx.category,
    tx.type === 'income' ? 'Income' : 'Expense',
    tx.payment_method,
    `${tx.type === 'income' ? '+' : '-'} ${formatPdfINR(tx.amount)}`,
  ]);

  autoTable(doc, {
    startY: 120,
    head: [['#', 'Date', 'Title', 'Category', 'Type', 'Method', 'Amount (INR)']],
    body: rows.length > 0 ? rows : [['-', '-', 'No transactions recorded for this period', '-', '-', '-', 'Rs. 0.00']],
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 6,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 64 },
      6: { halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  doc.save(params.filename.endsWith('.pdf') ? params.filename : `${params.filename}.pdf`);
}

export function exportMonthlyReportToPDF(params: {
  year: number;
  month: number; // 1-12
  userName: string;
  monthTransactions: TransactionItem[];
  categorySummary: { category: string; amount: number; share: number }[];
  overallBudgetLimit: number | null;
}) {
  const monthLabel = `${getMonthName(params.month, 'en')} ${params.year}`;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const monthIncome = params.monthTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const monthExpense = params.monthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const netSavings = monthIncome - monthExpense;

  doc.setFillColor(29, 78, 216);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 80, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`HisabBook — Monthly Report (${monthLabel})`, 40, 35);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Prepared for: ${params.userName}  |  Generated on ${formatIndianDate(new Date().toISOString().slice(0, 10))}`, 40, 56);

  // KPI Summary Table
  autoTable(doc, {
    startY: 98,
    head: [['Metric', 'Amount (INR)']],
    body: [
      ['Monthly Income', formatPdfINR(monthIncome)],
      ['Monthly Total Expenses', formatPdfINR(monthExpense)],
      ['Net Monthly Balance / Savings', formatPdfINR(netSavings)],
      [
        'Monthly Budget Limit',
        params.overallBudgetLimit ? formatPdfINR(params.overallBudgetLimit) : 'Not Set',
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 9.5, cellPadding: 6 },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255] },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
  });

  const afterKpiY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 220;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Category-Wise Expense Breakdown', 40, afterKpiY + 26);

  autoTable(doc, {
    startY: afterKpiY + 36,
    head: [['Category', 'Total Spent (INR)', 'Share (%)']],
    body:
      params.categorySummary.length > 0
        ? params.categorySummary.map((c) => [
            c.category,
            formatPdfINR(c.amount),
            `${c.share.toFixed(1)}%`,
          ])
        : [['No expenses recorded', 'Rs. 0.00', '0.0%']],
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
    },
  });

  const afterCatY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 380;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Detailed Transactions (${params.monthTransactions.length})`, 40, afterCatY + 26);

  autoTable(doc, {
    startY: afterCatY + 36,
    head: [['Date', 'Title', 'Category', 'Type', 'Payment Method', 'Amount (INR)']],
    body:
      params.monthTransactions.length > 0
        ? params.monthTransactions.map((tx) => [
            formatIndianDate(tx.date),
            tx.title,
            tx.category,
            tx.type === 'income' ? 'Income' : 'Expense',
            tx.payment_method,
            `${tx.type === 'income' ? '+' : '-'} ${formatPdfINR(tx.amount)}`,
          ])
        : [['-', 'No transactions in selected month', '-', '-', '-', 'Rs. 0.00']],
    styles: { fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255] },
    columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } },
  });

  const mmStr = String(params.month).padStart(2, '0');
  doc.save(`HisabBook_Report_${params.year}_${mmStr}.pdf`);
}

export function exportLedgerToExcel(params: {
  filename: string;
  transactions: TransactionItem[];
  budgets?: BudgetItem[];
  categories?: CategoryItem[];
}) {
  const wb = XLSX.utils.book_new();

  const totalIncome = params.transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = params.transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const summaryRows = [
    { Metric: 'Application', Value: 'HisabBook Personal Expense Tracker' },
    { Metric: 'Exported Date', Value: formatIndianDate(new Date().toISOString().slice(0, 10)) },
    { Metric: 'Total Transactions', Value: params.transactions.length },
    { Metric: 'Total Income (INR)', Value: formatINR(totalIncome, true) },
    { Metric: 'Total Expenses (INR)', Value: formatINR(totalExpense, true) },
    { Metric: 'Available Balance (INR)', Value: formatINR(totalIncome - totalExpense, true) },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  const txRows = params.transactions.map((t, index) => ({
    'S.No': index + 1,
    'Date (DD/MM/YYYY)': formatIndianDate(t.date),
    'ISO Date': t.date,
    Title: t.title,
    Type: t.type === 'income' ? 'Income' : 'Expense',
    Category: t.category,
    'Payment Method': t.payment_method,
    'Amount (INR)': t.amount,
    'Formatted Amount': `${t.type === 'income' ? '+' : '-'}${formatINR(t.amount, true)}`,
    'Description / Notes': t.description || '',
  }));
  const txSheet = XLSX.utils.json_to_sheet(
    txRows.length > 0
      ? txRows
      : [{ Message: 'No transactions available for the selected filter.' }]
  );
  XLSX.utils.book_append_sheet(wb, txSheet, 'Transactions');

  if (params.budgets && params.budgets.length > 0) {
    const budgetRows = params.budgets.map((b) => ({
      Month: b.month_key,
      Scope: b.category === 'OVERALL' ? 'Overall Monthly Budget' : b.category,
      'Limit Amount (INR)': b.limit_amount,
      'Formatted Limit': formatINR(b.limit_amount, true),
    }));
    const budgetSheet = XLSX.utils.json_to_sheet(budgetRows);
    XLSX.utils.book_append_sheet(wb, budgetSheet, 'Budgets');
  }

  if (params.categories && params.categories.length > 0) {
    const catRows = params.categories.map((c) => ({
      Category: c.name,
      'Hindi Label': c.name_hi,
      Type: c.type === 'income' ? 'Income' : 'Expense',
      Kind: c.is_default ? 'System Default' : 'Custom',
    }));
    const catSheet = XLSX.utils.json_to_sheet(catRows);
    XLSX.utils.book_append_sheet(wb, catSheet, 'Categories');
  }

  const outName = params.filename.endsWith('.xlsx') ? params.filename : `${params.filename}.xlsx`;
  XLSX.writeFile(wb, outName);
}
