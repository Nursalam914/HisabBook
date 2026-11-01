import React, { useState } from 'react';
import { BookOpen, Eye, EyeOff, Languages, Moon, Sun, ShieldCheck, ArrowRight } from 'lucide-react';
import { api, setStoredToken } from '../api';
import type { Language, ThemeMode, UserProfile } from '../types';
import deskShowcaseImg from '../assets/images/hisabbook_finance_desk_1793550049479.jpg';

interface AuthScreenProps {
  onAuthenticated: (user: UserProfile) => void;
  language: Language;
  onToggleLanguage: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  language,
  onToggleLanguage,
  theme,
  onToggleTheme,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const isHi = language === 'hi';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (mode === 'register' && trimmedName.length < 2) {
      setError(isHi ? 'कृपया अपना पूरा नाम दर्ज करें।' : 'Please enter your full name (at least 2 characters).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(isHi ? 'कृपया सही ईमेल पता दर्ज करें।' : 'Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError(isHi ? 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।' : 'Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'register') {
        const res = await api.register({
          name: trimmedName,
          email: trimmedEmail,
          password,
          language,
        });
        setStoredToken(res.token);
        onAuthenticated(res.user);
      } else {
        const res = await api.login({
          email: trimmedEmail,
          password,
        });
        setStoredToken(res.token);
        onAuthenticated(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Clean 3-zone Top Header */}
      <header className="flex items-center justify-between gap-8 px-6 lg:px-12 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            HisabBook
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          <button
            type="button"
            onClick={() => setMode('login')}
            className="hover:text-blue-700 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0"
          >
            {isHi ? 'दैनिक खर्च खाता' : 'Daily Ledger'}
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className="hover:text-blue-700 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0"
          >
            {isHi ? 'मासिक बजट' : 'Monthly Budgets'}
          </button>
          <button
            type="button"
            onClick={onToggleLanguage}
            className="inline-flex items-center gap-1.5 hover:text-blue-700 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0"
          >
            <Languages className="w-4 h-4" />
            <span>{isHi ? 'English' : 'हिन्दी'}</span>
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-1.5 hover:text-blue-700 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{theme === 'dark' ? (isHi ? 'लाइट मोड' : 'Light') : (isHi ? 'डार्क मोड' : 'Dark')}</span>
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {mode === 'login'
              ? isHi
                ? 'नया खाता बनाएं'
                : 'Create Account'
              : isHi
              ? 'लॉग इन करें'
              : 'Sign In'}
          </button>
        </div>
      </header>

      {/* Main Split Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-12 py-8 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        {/* Left Editorial / Product Showcase Column */}
        <section className="lg:col-span-7 flex flex-col justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 lg:p-10">
          <div>
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-3">
              {isHi
                ? 'भारतीय व्यक्तिगत वित्त और मासिक बजट प्रबंधन'
                : 'Personal Finance & Monthly Budget Ledger for India'}
            </p>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight max-w-xl" style={{ textWrap: 'balance' } as React.CSSProperties}>
              {isHi
                ? 'अपने हर रुपये के खर्च, आय और मासिक बजट का स्पष्ट हिसाब रखें।'
                : 'Know where every rupee goes across daily expenses, income, and budgets.'}
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
              {isHi
                ? 'HisabBook आपके दैनिक खर्चों (UPI, नकद, कार्ड), वेतन और व्यापार आय, मासिक बजट सीमा और PDF/Excel रिपोर्ट को सुरक्षित रूप से सहेजता है।'
                : 'Record daily INR expenses, track salary and freelance income, set monthly spending alerts at 80% and 100%, and export clean PDF and Excel statements anytime.'}
            </p>
          </div>

          <div className="my-6 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 aspect-[4/3] max-h-72 w-full">
            {!imgError ? (
              <img
                src={deskShowcaseImg}
                alt="HisabBook personal ledger notebook and fountain pen on a clean desk"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 text-center">
                <BookOpen className="w-10 h-10 text-blue-700 dark:text-blue-400 mb-2" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  HisabBook Personal INR Ledger
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white mb-0.5">
                {isHi ? '₹ भारतीय मुद्रा प्रारूप' : 'Indian ₹ Formatting'}
              </p>
              <p>{isHi ? 'लाख और हज़ार प्रणाली के साथ DD/MM/YYYY तारीखें' : 'Lakhs grouping & DD/MM/YYYY dates'}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white mb-0.5">
                {isHi ? '80% और 100% बजट अलर्ट' : '80% & 100% Budget Alerts'}
              </p>
              <p>{isHi ? 'मासिक खर्च सीमा पार होने से पहले चेतावनी' : 'Proactive monthly spending warnings'}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white mb-0.5">
                {isHi ? 'PDF, Excel और बैकअप' : 'PDF, Excel & Backup'}
              </p>
              <p>{isHi ? 'एक क्लिक में स्टेटमेंट और डेटा रिस्टोर' : 'Full statement export & JSON restore'}</p>
            </div>
          </div>
        </section>

        {/* Right Form Card */}
        <section className="lg:col-span-5 flex flex-col justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 lg:p-10">
          {/* Mobile language + theme quick buttons */}
          <div className="flex md:hidden items-center justify-end gap-3 mb-4 text-xs text-slate-600 dark:text-slate-400">
            <button
              type="button"
              onClick={onToggleLanguage}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700"
            >
              {isHi ? 'English' : 'हिन्दी'}
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>

          {/* Segmented Mode Control */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isHi ? 'लॉग इन (Sign In)' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isHi ? 'नया खाता (Register)' : 'Create Account'}
            </button>
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {mode === 'login'
              ? isHi
                ? 'अपने HisabBook खाते में प्रवेश करें'
                : 'Sign in to your HisabBook'
              : isHi
              ? 'अपना व्यक्तिगत खाता बनाएं'
              : 'Create your personal ledger'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-6">
            {mode === 'login'
              ? isHi
                ? 'अपने सुरक्षित खर्च और आय रिकॉर्ड देखने के लिए विवरण दर्ज करें।'
                : 'Enter your registered email and password to access your records.'
              : isHi
              ? 'आपका सारा डेटा आपके व्यक्तिगत खाते में सुरक्षित रूप से सहेजा जाता है।'
              : 'All expenses, income, and budgets are stored privately under your account.'}
          </p>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-medium text-red-700 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isHi ? 'पूरा नाम (Full Name)' : 'Full Name'}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isHi ? 'जैसे: राहुल शर्मा' : 'e.g. Rahul Sharma'}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'ईमेल पता (Email Address)' : 'Email Address'}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'पासवर्ड (Password)' : 'Password'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isHi ? 'कम से कम 6 अक्षर' : 'Minimum 6 characters'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>
                {submitting
                  ? isHi
                    ? 'कृपया प्रतीक्षा करें...'
                    : 'Please wait...'
                  : mode === 'login'
                  ? isHi
                    ? 'खाता खोलें'
                    : 'Sign In to HisabBook'
                  : isHi
                  ? 'निःशुल्क खाता बनाएं'
                  : 'Create Free Account'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
            <span>
              {isHi
                ? 'सुरक्षित पासवर्ड एन्क्रिप्शन और स्थायी डेटाबेस स्टोरेज।'
                : 'Encrypted credentials with permanent user-isolated database storage.'}
            </span>
          </div>
        </section>
      </main>
    </div>
  );
};
