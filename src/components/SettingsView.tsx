import React, { useRef, useState } from 'react';
import {
  Check,
  DatabaseBackup,
  Download,
  FileSpreadsheet,
  Languages,
  Moon,
  RefreshCw,
  Sun,
  Upload,
} from 'lucide-react';
import { api } from '../api';
import type {
  BackupFilePayload,
  BudgetItem,
  CategoryItem,
  Language,
  ThemeMode,
  TransactionItem,
  UserProfile,
} from '../types';
import { formatIndianDate, formatINR, getLocalTodayISO } from '../i18n';
import { exportLedgerToExcel, exportTransactionsToPDF } from '../utils/exportReports';

interface SettingsViewProps {
  user: UserProfile;
  transactions: TransactionItem[];
  categories: CategoryItem[];
  budgets: BudgetItem[];
  language: Language;
  theme: ThemeMode;
  lastSyncedAt: string | null;
  onUpdateUser: (updated: UserProfile) => void;
  onSyncNow: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  transactions,
  categories,
  budgets,
  language,
  theme,
  lastSyncedAt,
  onUpdateUser,
  onSyncNow,
}) => {
  const isHi = language === 'hi';

  const [name, setName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [restoring, setRestoring] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusBanner(null);

    if (name.trim().length < 2) {
      setStatusBanner({
        type: 'error',
        text: isHi ? 'नाम कम से कम 2 अक्षरों का होना चाहिए।' : 'Name must be at least 2 characters.',
      });
      return;
    }

    setSavingProfile(true);
    try {
      const res = await api.updatePreferences({
        name: name.trim(),
        ...(newPassword
          ? {
              currentPassword,
              newPassword,
            }
          : {}),
      });
      onUpdateUser(res.user);
      setCurrentPassword('');
      setNewPassword('');
      setStatusBanner({
        type: 'success',
        text: isHi ? 'प्रोफ़ाइल सेटिंग्स सफलतापूर्वक अपडेट की गईं।' : 'Account profile updated.',
      });
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update profile.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangeLanguage = async (nextLang: Language) => {
    try {
      const res = await api.updatePreferences({ language: nextLang });
      onUpdateUser(res.user);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save language preference.',
      });
    }
  };

  const handleChangeTheme = async (nextTheme: ThemeMode) => {
    try {
      const res = await api.updatePreferences({ theme: nextTheme });
      onUpdateUser(res.user);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save theme preference.',
      });
    }
  };

  const handleDownloadBackup = async () => {
    setStatusBanner(null);
    try {
      const backupPayload = await api.downloadBackup();
      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HisabBook_Backup_${getLocalTodayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusBanner({
        type: 'success',
        text: isHi
          ? 'पूर्ण डेटा बैकअप (.json) सफलतापूर्वक डाउनलोड हो गया।'
          : 'Complete HisabBook JSON backup downloaded.',
      });
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to generate backup.',
      });
    }
  };

  const handleRestoreFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusBanner(null);
    setRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupFilePayload;
      const result = await api.restoreBackup({
        mode: restoreMode,
        backup: parsed,
      });
      await onSyncNow();
      setStatusBanner({
        type: 'success',
        text: isHi
          ? `बैकअप सफलतापूर्वक रिस्टोर हुआ (${result.restoredTransactions} लेन-देन, ${result.restoredBudgets} बजट)।`
          : `Backup restored (${result.restoredTransactions} transactions, ${result.restoredBudgets} budgets).`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Invalid backup file. Please upload a valid HisabBook JSON backup.',
      });
    } finally {
      setRestoring(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await onSyncNow();
      setStatusBanner({
        type: 'success',
        text: isHi ? 'डेटा सर्वर के साथ सिंक हो गया।' : 'Synchronized with database.',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {statusBanner && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            statusBanner.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
          }`}
        >
          {statusBanner.type === 'success' && <Check className="w-4 h-4 shrink-0" />}
          <span>{statusBanner.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Appearance, Language & Data Backup */}
        <div className="lg:col-span-7 space-y-6">
          {/* Theme & Language Preferences */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isHi ? 'दिखावट और भाषा (Appearance & Regional)' : 'Appearance & Regional Format'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isHi
                  ? 'थीम, भाषा और भारतीय मुद्रा/तिथि प्रारूप'
                  : 'Configure Light/Dark mode, Hindi/English interface, and INR display.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {isHi ? 'थीम (Theme Mode)' : 'Theme Mode'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleChangeTheme('light')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                      theme === 'light'
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>{isHi ? 'लाइट मोड' : 'Light Mode'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeTheme('dark')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                      theme === 'dark'
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>{isHi ? 'डार्क मोड' : 'Dark Mode'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {isHi ? 'प्राथमिक भाषा (Language)' : 'Primary Language'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleChangeLanguage('en')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                      language === 'en'
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Languages className="w-3.5 h-3.5" />
                    <span>English</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeLanguage('hi')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                      language === 'hi'
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Languages className="w-3.5 h-3.5" />
                    <span>हिन्दी (Hindi)</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span>
                {isHi ? 'मुद्रा प्रारूप:' : 'Currency Format:'}{' '}
                <strong className="font-num text-slate-900 dark:text-white">
                  {formatINR(125450.5, true)} (INR)
                </strong>
              </span>
              <span>
                {isHi ? 'तिथि प्रारूप:' : 'Date Format:'}{' '}
                <strong className="font-num text-slate-900 dark:text-white">
                  {formatIndianDate(getLocalTodayISO())} (DD/MM/YYYY)
                </strong>
              </span>
            </div>
          </section>

          {/* Export, Backup & Restore */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {isHi ? 'डेटा निर्यात, बैकअप और रिस्टोर' : 'Data Export, Backup & Restore'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isHi
                    ? 'अपने संपूर्ण खाते को PDF, Excel या JSON बैकअप के रूप में सुरक्षित रखें।'
                    : 'Download full statements in PDF/Excel or create portable JSON backups.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncing}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 self-start whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{isHi ? 'सिंक करें' : 'Sync Now'}</span>
              </button>
            </div>

            {lastSyncedAt && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-num">
                {isHi ? 'अंतिम डेटाबेस सिंक:' : 'Last synchronized:'}{' '}
                {new Date(lastSyncedAt).toLocaleTimeString('en-IN')} · {transactions.length}{' '}
                {isHi ? 'रिकॉर्ड' : 'records'}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() =>
                  exportTransactionsToPDF({
                    title: 'Complete Financial Ledger Statement',
                    subtitle: `All Recorded Transactions (${transactions.length})`,
                    userName: user.name,
                    transactions,
                    filename: `HisabBook_Full_Statement_${getLocalTodayISO()}.pdf`,
                  })
                }
                className="py-2.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                <span>{isHi ? 'पूर्ण PDF निर्यात' : 'Export Full PDF'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  exportLedgerToExcel({
                    filename: `HisabBook_Full_Ledger_${getLocalTodayISO()}.xlsx`,
                    transactions,
                    budgets,
                    categories,
                  })
                }
                className="py-2.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>{isHi ? 'पूर्ण Excel निर्यात' : 'Export Full Excel'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadBackup}
                className="py-2.5 px-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <DatabaseBackup className="w-3.5 h-3.5" />
                <span>{isHi ? 'JSON बैकअप लें' : 'Download Backup'}</span>
              </button>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {isHi ? 'बैकअप फ़ाइल से डेटा रिस्टोर करें' : 'Restore from HisabBook Backup (.json)'}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setRestoreMode('merge')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md ${
                      restoreMode === 'merge'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isHi ? 'मौजूदा के साथ जोड़ें (Merge)' : 'Merge Records'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestoreMode('replace')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md ${
                      restoreMode === 'replace'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isHi ? 'बदलें (Replace All)' : 'Replace All'}
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleRestoreFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  disabled={restoring}
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {restoring
                      ? isHi
                        ? 'रिस्टोर हो रहा है...'
                        : 'Restoring...'
                      : isHi
                      ? 'बैकअप फ़ाइल चुनें'
                      : 'Upload Backup JSON'}
                  </span>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right: Account Profile & Security */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {isHi ? 'खाता प्रोफ़ाइल और सुरक्षा' : 'Account Profile & Security'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-5">
            {isHi ? 'अपना नाम या पासवर्ड अपडेट करें।' : 'Update your display name or account password.'}
          </p>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'पंजीकृत ईमेल' : 'Registered Email'}
              </label>
              <input
                type="email"
                disabled
                value={user.email}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'पूरा नाम (Full Name)' : 'Full Name'}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-3">
                {isHi ? 'पासवर्ड बदलें (वैकल्पिक)' : 'Change Password (Optional)'}
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {isHi ? 'वर्तमान पासवर्ड' : 'Current Password'}
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {isHi ? 'नया पासवर्ड (कम से कम 6 अक्षर)' : 'New Password (min 6 characters)'}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              {savingProfile
                ? isHi
                  ? 'सहेजा जा रहा है...'
                  : 'Saving...'
                : isHi
                ? 'प्रोफ़ाइल सहेजें'
                : 'Save Account Changes'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
