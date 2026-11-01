import React, { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import {
  ALL_PAYMENT_METHODS,
  EXPENSE_PAYMENT_METHODS,
  INCOME_PAYMENT_METHODS,
  type CategoryItem,
  type Language,
  type TransactionItem,
  type TransactionType,
} from '../types';
import { formatINR, formatPaymentMethod, getCategoryDisplayName } from '../i18n';

interface EditTransactionModalProps {
  transaction: TransactionItem | null;
  categories: CategoryItem[];
  language: Language;
  onClose: () => void;
  onSave: (
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
  ) => Promise<void>;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  categories,
  language,
  onClose,
  onSave,
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHi = language === 'hi';

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmount(String(transaction.amount));
      setTitle(transaction.title);
      setCategory(transaction.category);
      setDate(transaction.date);
      setPaymentMethod(transaction.payment_method);
      setDescription(transaction.description || '');
      setError(null);
    }
  }, [transaction]);

  if (!transaction) return null;

  const filteredCategories = categories.filter((c) => c.type === type);
  const methods =
    type === 'expense'
      ? EXPENSE_PAYMENT_METHODS
      : INCOME_PAYMENT_METHODS;

  const handleTypeSwitch = (nextType: TransactionType) => {
    setType(nextType);
    const nextCats = categories.filter((c) => c.type === nextType);
    if (nextCats.length > 0 && !nextCats.some((c) => c.name === category)) {
      setCategory(nextCats[0].name);
    }
    const nextMethods = nextType === 'expense' ? EXPENSE_PAYMENT_METHODS : INCOME_PAYMENT_METHODS;
    if (!(nextMethods as readonly string[]).includes(paymentMethod)) {
      setPaymentMethod(nextMethods[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError(isHi ? 'कृपया सही राशि दर्ज करें (₹ 0 से अधिक)।' : 'Please enter a valid positive amount in ₹.');
      return;
    }
    if (!title.trim()) {
      setError(isHi ? 'शीर्षक आवश्यक है।' : 'Transaction title is required.');
      return;
    }
    if (!category) {
      setError(isHi ? 'कृपया श्रेणी चुनें।' : 'Please select a category.');
      return;
    }
    if (!date) {
      setError(isHi ? 'कृपया तारीख चुनें।' : 'Please select a valid date.');
      return;
    }

    setSaving(true);
    try {
      await onSave(transaction.id, {
        type,
        amount: numAmount,
        title: title.trim(),
        category,
        date,
        payment_method: paymentMethod,
        description: description.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update transaction.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {isHi ? 'लेन-देन संपादित करें' : 'Edit Transaction'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => handleTypeSwitch('expense')}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                type === 'expense'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {isHi ? 'खर्च (Expense)' : 'Expense'}
            </button>
            <button
              type="button"
              onClick={() => handleTypeSwitch('income')}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                type === 'income'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {isHi ? 'आय (Income)' : 'Income'}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isHi ? 'राशि (₹ INR)' : 'Amount (₹ INR)'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm font-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isHi ? 'तारीख (Date)' : 'Date'}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isHi ? 'शीर्षक (Title)' : 'Title'}
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isHi ? 'श्रेणी (Category)' : 'Category'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {getCategoryDisplayName(c.name, categories, language)}
                  </option>
                ))}
                {!filteredCategories.some((c) => c.name === category) && category && (
                  <option value={category}>{category}</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isHi ? 'भुगतान माध्यम' : 'Payment Method'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {(Array.from(new Set([...methods, ...ALL_PAYMENT_METHODS]))).map((m) => (
                  <option key={m} value={m}>
                    {formatPaymentMethod(m, language)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isHi ? 'विवरण / नोट्स' : 'Description / Notes'}
            </label>
            <textarea
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isHi ? 'रद्द करें' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-60"
            >
              {saving ? (isHi ? 'सहेजा जा रहा है...' : 'Saving...') : isHi ? 'परिवर्तन सहेजें' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeleteConfirmModalProps {
  transaction: TransactionItem | null;
  language: Language;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  transaction,
  language,
  onClose,
  onConfirm,
}) => {
  const [deleting, setDeleting] = useState(false);
  const isHi = language === 'hi';

  if (!transaction) return null;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm(transaction.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isHi ? 'लेन-देन हटाएं?' : 'Delete Transaction?'}
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {isHi
                ? `क्या आप वाकई "${transaction.title}" (${formatINR(transaction.amount)}) को स्थायी रूप से हटाना चाहते हैं?`
                : `Are you sure you want to permanently delete "${transaction.title}" (${formatINR(transaction.amount)})?`}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {isHi ? 'रद्द करें' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleConfirm}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
          >
            {deleting ? (isHi ? 'हटाया जा रहा है...' : 'Deleting...') : isHi ? 'हाँ, हटाएं' : 'Delete Entry'}
          </button>
        </div>
      </div>
    </div>
  );
};
