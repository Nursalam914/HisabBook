import React, { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { CategoryItem, Language, TransactionItem, TransactionType } from '../types';
import { formatINR, getCategoryDisplayName } from '../i18n';

interface CategoriesViewProps {
  categories: CategoryItem[];
  transactions: TransactionItem[];
  language: Language;
  onCreateCategory: (payload: {
    name: string;
    name_hi?: string;
    type: TransactionType;
    color: string;
  }) => Promise<void>;
  onUpdateCategory: (
    id: string,
    payload: {
      name: string;
      name_hi?: string;
      color: string;
    }
  ) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}

const COLOR_SWATCHES = [
  '#2563EB',
  '#1D4ED8',
  '#0284C7',
  '#0D9488',
  '#16A34A',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#DB2777',
  '#475569',
];

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  transactions,
  language,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
}) => {
  const isHi = language === 'hi';

  const [activeTab, setActiveTab] = useState<TransactionType>('expense');
  const [newName, setNewName] = useState('');
  const [newNameHi, setNewNameHi] = useState('');
  const [newColor, setNewColor] = useState(COLOR_SWATCHES[0]);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameHi, setEditNameHi] = useState('');
  const [editColor, setEditColor] = useState('#2563EB');

  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const statsMap = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const tx of transactions) {
      const key = `${tx.type}:${tx.category.toLowerCase()}`;
      const existing = map.get(key) || { count: 0, total: 0 };
      existing.count += 1;
      existing.total += tx.amount;
      map.set(key, existing);
    }
    return map;
  }, [transactions]);

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.type === activeTab),
    [categories, activeTab]
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (newName.trim().length < 2) {
      setMessage({
        type: 'error',
        text: isHi
          ? 'श्रेणी का नाम कम से कम 2 अक्षरों का होना चाहिए।'
          : 'Category name must be at least 2 characters.',
      });
      return;
    }

    setCreating(true);
    try {
      await onCreateCategory({
        name: newName.trim(),
        name_hi: newNameHi.trim() || newName.trim(),
        type: activeTab,
        color: newColor,
      });
      setNewName('');
      setNewNameHi('');
      setMessage({
        type: 'success',
        text: isHi ? 'नई श्रेणी सफलतापूर्वक जोड़ी गई।' : 'Custom category created.',
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to create category.',
      });
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (cat: CategoryItem) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditNameHi(cat.name_hi || cat.name);
    setEditColor(cat.color);
    setMessage(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (editName.trim().length < 2) return;
    try {
      await onUpdateCategory(id, {
        name: editName.trim(),
        name_hi: editNameHi.trim() || editName.trim(),
        color: editColor,
      });
      setEditingId(null);
      setMessage({
        type: 'success',
        text: isHi ? 'श्रेणी अपडेट की गई।' : 'Category updated.',
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update category.',
      });
    }
  };

  const handleDelete = async (cat: CategoryItem) => {
    try {
      await onDeleteCategory(cat.id);
      setMessage({
        type: 'success',
        text: isHi
          ? `"${cat.name}" श्रेणी हटाई गई।`
          : `Deleted "${cat.name}" category.`,
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to delete category.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Category List */}
        <section className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isHi ? 'श्रेणियाँ प्रबंधित करें (Categories)' : 'Expense & Income Categories'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isHi
                  ? 'प्रत्येक श्रेणी में कुल लेन-देन और खर्च/आय राशि देखें।'
                  : 'View transaction totals per category or customize your ledger categories.'}
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setActiveTab('expense')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  activeTab === 'expense'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {isHi ? 'खर्च श्रेणियाँ' : 'Expense Categories'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('income')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  activeTab === 'income'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {isHi ? 'आय श्रेणियाँ' : 'Income Categories'}
              </button>
            </div>
          </div>

          {message && (
            <div
              className={`mx-5 mt-4 p-3 rounded-lg border text-xs font-medium ${
                message.type === 'error'
                  ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {visibleCategories.map((cat) => {
              const stat = statsMap.get(`${cat.type}:${cat.name.toLowerCase()}`) || {
                count: 0,
                total: 0,
              };
              const isEditing = editingId === cat.id;

              return (
                <div
                  key={cat.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {isEditing ? (
                    <div className="flex-1 flex flex-wrap items-center gap-2">
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-slate-300 dark:border-slate-700"
                      />
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="English Name"
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                      <input
                        type="text"
                        value={editNameHi}
                        onChange={(e) => setEditNameHi(e.target.value)}
                        placeholder="हिन्दी नाम"
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(cat.id)}
                        className="p-1.5 rounded-md bg-blue-700 text-white hover:bg-blue-800"
                        aria-label="Save category"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        aria-label="Cancel edit"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-sm shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {getCategoryDisplayName(cat.name, categories, language)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            <span>{cat.is_default ? (isHi ? 'डिफ़ॉल्ट' : 'Default') : isHi ? 'कस्टम' : 'Custom'}</span>
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            <span className="font-num">
                              {stat.count} {isHi ? 'लेन-देन' : stat.count === 1 ? 'entry' : 'entries'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <span className="text-sm font-bold font-num text-slate-900 dark:text-white">
                          {formatINR(stat.total)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(cat)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            aria-label={`Edit ${cat.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {cat.is_default === 0 && (
                            <button
                              type="button"
                              onClick={() => handleDelete(cat)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                              aria-label={`Delete ${cat.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Add Custom Category Form */}
        <section className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {isHi ? 'नई श्रेणी जोड़ें' : 'Add Custom Category'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-5">
            {activeTab === 'expense'
              ? isHi
                ? 'अपनी आवश्यकता के अनुसार नई खर्च श्रेणी बनाएं।'
                : 'Create a custom expense category for your personal ledger.'
              : isHi
              ? 'नया आय स्रोत श्रेणी बनाएं।'
              : 'Create a custom income source category.'}
          </p>

          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'श्रेणी नाम (English) *' : 'Category Name *'}
              </label>
              <input
                type="text"
                required
                maxLength={50}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={activeTab === 'expense' ? 'e.g. Fuel & Parking' : 'e.g. Rental Dividend'}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'हिन्दी नाम (वैकल्पिक)' : 'Hindi Label (Optional)'}
              </label>
              <input
                type="text"
                maxLength={50}
                value={newNameHi}
                onChange={(e) => setNewNameHi(e.target.value)}
                placeholder="जैसे: पेट्रोल और पार्किंग"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'रंग चुनें (Chart Color)' : 'Chart Color'}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => setNewColor(swatch)}
                    className={`w-7 h-7 rounded-md transition-transform ${
                      newColor === swatch ? 'ring-2 ring-offset-2 ring-blue-600 scale-105' : ''
                    }`}
                    style={{ backgroundColor: swatch }}
                    aria-label={`Select color ${swatch}`}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {creating
                  ? isHi
                    ? 'जोड़ा जा रहा है...'
                    : 'Adding...'
                  : isHi
                  ? 'श्रेणी जोड़ें'
                  : 'Create Category'}
              </span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
