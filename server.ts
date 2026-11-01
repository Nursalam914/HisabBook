import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, 'hisabbook.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    theme TEXT NOT NULL DEFAULT 'light',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    name_hi TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    color TEXT NOT NULL DEFAULT '#2563EB',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, type, name COLLATE NOCASE),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    amount REAL NOT NULL CHECK (amount > 0),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
  CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);

  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    month_key TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'OVERALL',
    limit_amount REAL NOT NULL CHECK (limit_amount > 0),
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, month_key, category),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

interface DefaultCat {
  name: string;
  name_hi: string;
  type: 'expense' | 'income';
  color: string;
}

const DEFAULT_CATEGORIES: DefaultCat[] = [
  // 12 Expense Categories
  { name: 'Food & Groceries', name_hi: 'भोजन और किराना', type: 'expense', color: '#2563EB' },
  { name: 'Transportation', name_hi: 'यातायात', type: 'expense', color: '#0284C7' },
  { name: 'Shopping', name_hi: 'खरीदारी', type: 'expense', color: '#4F46E5' },
  { name: 'Electricity & Bills', name_hi: 'बिजली और बिल', type: 'expense', color: '#D97706' },
  { name: 'Mobile Recharge', name_hi: 'मोबाइल रिचार्ज', type: 'expense', color: '#0891B2' },
  { name: 'Internet', name_hi: 'इंटरनेट', type: 'expense', color: '#0D9488' },
  { name: 'Medical', name_hi: 'चिकित्सा और स्वास्थ्य', type: 'expense', color: '#DC2626' },
  { name: 'Education', name_hi: 'शिक्षा', type: 'expense', color: '#7C3AED' },
  { name: 'Rent', name_hi: 'किराया', type: 'expense', color: '#1D4ED8' },
  { name: 'Entertainment', name_hi: 'मनोरंजन', type: 'expense', color: '#DB2777' },
  { name: 'Personal', name_hi: 'व्यक्तिगत', type: 'expense', color: '#059669' },
  { name: 'Other', name_hi: 'अन्य खर्च', type: 'expense', color: '#64748B' },
  // 4 Income Categories
  { name: 'Salary', name_hi: 'वेतन', type: 'income', color: '#16A34A' },
  { name: 'Business Income', name_hi: 'व्यापार आय', type: 'income', color: '#059669' },
  { name: 'Freelancing', name_hi: 'फ्रीलांसिंग', type: 'income', color: '#2563EB' },
  { name: 'Other Income', name_hi: 'अन्य आय', type: 'income', color: '#0D9488' },
];

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(originalHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function seedCategoriesForUser(userId: string) {
  const now = new Date().toISOString();
  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO categories (id, user_id, name, name_hi, type, color, is_default, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);
  const seedTx = db.transaction(() => {
    for (const cat of DEFAULT_CATEGORIES) {
      insertCat.run(crypto.randomUUID(), userId, cat.name, cat.name_hi, cat.type, cat.color, now);
    }
  });
  seedTx();
}

function isValidIsoDate(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

function isValidMonthKey(monthStr: unknown): monthStr is string {
  if (typeof monthStr !== 'string') return false;
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(monthStr);
}

interface AuthedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    language: string;
    theme: string;
    created_at: string;
  };
  sessionToken?: string;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Invalid session token.' });
    return;
  }

  const row = db.prepare(`
    SELECT u.id, u.name, u.email, u.language, u.theme, u.created_at, s.expires_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token) as {
    id: string;
    name: string;
    email: string;
    language: string;
    theme: string;
    created_at: string;
    expires_at: number;
  } | undefined;

  if (!row || row.expires_at < Date.now()) {
    if (row) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return;
  }

  req.user = {
    id: row.id,
    name: row.name,
    email: row.email,
    language: row.language,
    theme: row.theme,
    created_at: row.created_at,
  };
  req.sessionToken = token;
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Clean expired sessions periodically
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());

  // --- AUTHENTICATION ROUTES ---
  app.post('/api/auth/register', (req: Request, res: Response) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const password = String(req.body?.password ?? '');
      const language = req.body?.language === 'hi' ? 'hi' : 'en';

      if (name.length < 2 || name.length > 80) {
        res.status(400).json({ error: 'Please enter a valid full name (2–80 characters).' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      if (password.length < 6 || password.length > 128) {
        res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        return;
      }

      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) {
        res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
        return;
      }

      const userId = crypto.randomUUID();
      const now = new Date().toISOString();
      const passwordHash = hashPassword(password);
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

      const createAccountTx = db.transaction(() => {
        db.prepare(`
          INSERT INTO users (id, name, email, password_hash, language, theme, created_at)
          VALUES (?, ?, ?, ?, ?, 'light', ?)
        `).run(userId, name, email, passwordHash, language, now);

        seedCategoriesForUser(userId);

        db.prepare(`
          INSERT INTO sessions (token, user_id, expires_at, created_at)
          VALUES (?, ?, ?, ?)
        `).run(sessionToken, userId, expiresAt, now);
      });

      createAccountTx();

      res.status(201).json({
        token: sessionToken,
        user: {
          id: userId,
          name,
          email,
          language,
          theme: 'light',
          created_at: now,
        },
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const password = String(req.body?.password ?? '');

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }

      const userRow = db.prepare(`
        SELECT id, name, email, password_hash, language, theme, created_at
        FROM users WHERE email = ?
      `).get(email) as {
        id: string;
        name: string;
        email: string;
        password_hash: string;
        language: string;
        theme: string;
        created_at: string;
      } | undefined;

      if (!userRow || !verifyPassword(password, userRow.password_hash)) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      // Ensure default categories exist even for older accounts
      seedCategoriesForUser(userRow.id);

      const sessionToken = crypto.randomBytes(32).toString('hex');
      const now = new Date().toISOString();
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

      db.prepare(`
        INSERT INTO sessions (token, user_id, expires_at, created_at)
        VALUES (?, ?, ?, ?)
      `).run(sessionToken, userRow.id, expiresAt, now);

      res.json({
        token: sessionToken,
        user: {
          id: userRow.id,
          name: userRow.name,
          email: userRow.email,
          language: userRow.language,
          theme: userRow.theme,
          created_at: userRow.created_at,
        },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Unable to sign in right now. Please try again.' });
    }
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res: Response) => {
    if (req.sessionToken) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
    }
    res.json({ success: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
    res.json({ user: req.user });
  });

  app.put('/api/auth/preferences', requireAuth, (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const name = req.body?.name !== undefined ? String(req.body.name).trim() : req.user!.name;
      const language = req.body?.language === 'hi' ? 'hi' : req.body?.language === 'en' ? 'en' : req.user!.language;
      const theme = req.body?.theme === 'dark' ? 'dark' : req.body?.theme === 'light' ? 'light' : req.user!.theme;

      if (name.length < 2 || name.length > 80) {
        res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
        return;
      }

      if (req.body?.newPassword) {
        const currentPassword = String(req.body?.currentPassword ?? '');
        const newPassword = String(req.body.newPassword);
        if (newPassword.length < 6 || newPassword.length > 128) {
          res.status(400).json({ error: 'New password must be at least 6 characters.' });
          return;
        }
        const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string } | undefined;
        if (!row || !verifyPassword(currentPassword, row.password_hash)) {
          res.status(400).json({ error: 'Current password is incorrect.' });
          return;
        }
        const newHash = hashPassword(newPassword);
        db.prepare('UPDATE users SET name = ?, language = ?, theme = ?, password_hash = ? WHERE id = ?')
          .run(name, language, theme, newHash, userId);
      } else {
        db.prepare('UPDATE users SET name = ?, language = ?, theme = ? WHERE id = ?')
          .run(name, language, theme, userId);
      }

      res.json({
        user: {
          ...req.user!,
          name,
          language,
          theme,
        },
      });
    } catch (err) {
      console.error('Preferences update error:', err);
      res.status(500).json({ error: 'Failed to update settings.' });
    }
  });

  // --- FULL DATA SYNC ENDPOINT ---
  app.get('/api/sync', requireAuth, (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const categories = db.prepare(`
        SELECT id, name, name_hi, type, color, is_default, created_at
        FROM categories
        WHERE user_id = ?
        ORDER BY is_default DESC, name ASC
      `).all(userId);

      const transactions = db.prepare(`
        SELECT id, type, amount, title, category, date, payment_method, description, created_at, updated_at
        FROM transactions
        WHERE user_id = ?
        ORDER BY date DESC, created_at DESC
      `).all(userId);

      const budgets = db.prepare(`
        SELECT id, month_key, category, limit_amount, updated_at
        FROM budgets
        WHERE user_id = ?
        ORDER BY month_key DESC, category ASC
      `).all(userId);

      res.json({
        user: req.user,
        categories,
        transactions,
        budgets,
        syncedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Sync error:', err);
      res.status(500).json({ error: 'Failed to synchronize financial records.' });
    }
  });

  // --- TRANSACTIONS CRUD ---
  app.post('/api/transactions', requireAuth, (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const type = req.body?.type;
      const amount = Number(req.body?.amount);
      const title = String(req.body?.title ?? '').trim();
      const category = String(req.body?.category ?? '').trim();
      const date = req.body?.date;
      const paymentMethod = String(req.body?.payment_method ?? '').trim();
      const description = String(req.body?.description ?? '').trim();

      if (type !== 'expense' && type !== 'income') {
        res.status(400).json({ error: 'Transaction type must be expense or income.' });
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000) {
        res.status(400).json({ error: 'Please enter a valid positive amount in ₹ (INR).' });
        return;
      }
      if (title.length < 1 || title.length > 120) {
        res.status(400).json({ error: 'Title is required (max 120 characters).' });
        return;
      }
      if (category.length < 1 || category.length > 60) {
        res.status(400).json({ error: 'Please select a valid category.' });
        return;
      }
      if (!isValidIsoDate(date)) {
        res.status(400).json({ error: 'Please provide a valid date.' });
        return;
      }
      if (paymentMethod.length < 1 || paymentMethod.length > 50) {
        res.status(400).json({ error: 'Please select a payment method.' });
        return;
      }
      if (description.length > 500) {
        res.status(400).json({ error: 'Description cannot exceed 500 characters.' });
        return;
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const roundedAmount = Math.round(amount * 100) / 100;

      db.prepare(`
        INSERT INTO transactions (id, user_id, type, amount, title, category, date, payment_method, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, userId, type, roundedAmount, title, category, date, paymentMethod, description, now, now);

      res.status(201).json({
        transaction: {
          id,
          type,
          amount: roundedAmount,
          title,
          category,
          date,
          payment_method: paymentMethod,
          description,
          created_at: now,
          updated_at: now,
        },
      });
    } catch (err) {
      console.error('Create transaction error:', err);
      res.status(500).json({ error: 'Failed to save transaction.' });
    }
  });

  app.put('/api/transactions/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const txId = req.params.id;

      const existing = db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?').get(txId, userId);
      if (!existing) {
        res.status(404).json({ error: 'Transaction not found.' });
        return;
      }

      const type = req.body?.type;
      const amount = Number(req.body?.amount);
      const title = String(req.body?.title ?? '').trim();
      const category = String(req.body?.category ?? '').trim();
      const date = req.body?.date;
      const paymentMethod = String(req.body?.payment_method ?? '').trim();
      const description = String(req.body?.description ?? '').trim();

      if (type !== 'expense' && type !== 'income') {
        res.status(400).json({ error: 'Invalid transaction type.' });
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000) {
        res.status(400).json({ error: 'Please enter a valid positive amount.' });
        return;
      }
      if (title.length < 1 || title.length > 120) {
        res.status(400).json({ error: 'Title is required (max 120 characters).' });
        return;
      }
      if (category.length < 1 || category.length > 60) {
        res.status(400).json({ error: 'Please select a valid category.' });
        return;
      }
      if (!isValidIsoDate(date)) {
        res.status(400).json({ error: 'Please provide a valid date.' });
        return;
      }
      if (paymentMethod.length < 1 || paymentMethod.length > 50) {
        res.status(400).json({ error: 'Please select a payment method.' });
        return;
      }
      if (description.length > 500) {
        res.status(400).json({ error: 'Description cannot exceed 500 characters.' });
        return;
      }

      const now = new Date().toISOString();
      const roundedAmount = Math.round(amount * 100) / 100;

      db.prepare(`
        UPDATE transactions
        SET type = ?, amount = ?, title = ?, category = ?, date = ?, payment_method = ?, description = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(type, roundedAmount, title, category, date, paymentMethod, description, now, txId, userId);

      const updated = db.prepare(`
        SELECT id, type, amount, title, category, date, payment_method, description, created_at, updated_at
        FROM transactions WHERE id = ? AND user_id = ?
      `).get(txId, userId);

      res.json({ transaction: updated });
    } catch (err) {
      console.error('Update transaction error:', err);
      res.status(500).json({ error: 'Failed to update transaction.' });
    }
  });

  app.delete('/api/transactions/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const txId = req.params.id;
      const info = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(txId, userId);
      if (info.changes === 0) {
        res.status(404).json({ error: 'Transaction not found.' });
        return;
      }
      res.json({ success: true, id: txId });
    } catch (err) {
      console.error('Delete transaction error:', err);
      res.status(500).json({ error: 'Failed to delete transaction.' });
    }
  });

  // --- CATEGORIES CRUD ---
  app.post('/api/categories', requireAuth, (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const name = String(req.body?.name ?? '').trim();
      const nameHi = String(req.body?.name_hi ?? '').trim();
      const type = req.body?.type;
      const color = String(req.body?.color ?? '#2563EB').trim();

      if (name.length < 2 || name.length > 50) {
        res.status(400).json({ error: 'Category name must be between 2 and 50 characters.' });
        return;
      }
      if (type !== 'expense' && type !== 'income') {
        res.status(400).json({ error: 'Category type must be expense or income.' });
        return;
      }
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        res.status(400).json({ error: 'Invalid category color.' });
        return;
      }

      const dup = db.prepare('SELECT id FROM categories WHERE user_id = ? AND type = ? AND name = ? COLLATE NOCASE')
        .get(userId, type, name);
      if (dup) {
        res.status(409).json({ error: 'A category with this name already exists.' });
        return;
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO categories (id, user_id, name, name_hi, type, color, is_default, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `).run(id, userId, name, nameHi || name, type, color, now);

      res.status(201).json({
        category: {
          id,
          name,
          name_hi: nameHi || name,
          type,
          color,
          is_default: 0,
          created_at: now,
        },
      });
    } catch (err) {
      console.error('Create category error:', err);
      res.status(500).json({ error: 'Failed to create category.' });
    }
  });

  app.put('/api/categories/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const catId = req.params.id;
      const existing = db.prepare('SELECT id, name, type, is_default FROM categories WHERE id = ? AND user_id = ?')
        .get(catId, userId) as { id: string; name: string; type: string; is_default: number } | undefined;

      if (!existing) {
        res.status(404).json({ error: 'Category not found.' });
        return;
      }

      const name = String(req.body?.name ?? '').trim();
      const nameHi = String(req.body?.name_hi ?? '').trim();
      const color = String(req.body?.color ?? '#2563EB').trim();

      if (name.length < 2 || name.length > 50) {
        res.status(400).json({ error: 'Category name must be between 2 and 50 characters.' });
        return;
      }
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        res.status(400).json({ error: 'Invalid category color.' });
        return;
      }

      const dup = db.prepare('SELECT id FROM categories WHERE user_id = ? AND type = ? AND name = ? COLLATE NOCASE AND id != ?')
        .get(userId, existing.type, name, catId);
      if (dup) {
        res.status(409).json({ error: 'Another category with this name already exists.' });
        return;
      }

      const updateCatTx = db.transaction(() => {
        db.prepare('UPDATE categories SET name = ?, name_hi = ?, color = ? WHERE id = ? AND user_id = ?')
          .run(name, nameHi || name, color, catId, userId);

        if (existing.name !== name) {
          db.prepare('UPDATE transactions SET category = ? WHERE user_id = ? AND type = ? AND category = ?')
            .run(name, userId, existing.type, existing.name);
          db.prepare('UPDATE budgets SET category = ? WHERE user_id = ? AND category = ?')
            .run(name, userId, existing.name);
        }
      });

      updateCatTx();

      const updated = db.prepare('SELECT id, name, name_hi, type, color, is_default, created_at FROM categories WHERE id = ?')
        .get(catId);
      res.json({ category: updated });
    } catch (err) {
      console.error('Update category error:', err);
      res.status(500).json({ error: 'Failed to update category.' });
    }
  });

  app.delete('/api/categories/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const catId = req.params.id;

      const existing = db.prepare('SELECT id, name, type, is_default FROM categories WHERE id = ? AND user_id = ?')
        .get(catId, userId) as { id: string; name: string; type: 'expense' | 'income'; is_default: number } | undefined;

      if (!existing) {
        res.status(404).json({ error: 'Category not found.' });
        return;
      }
      if (existing.is_default === 1) {
        res.status(400).json({ error: 'Default system categories cannot be deleted.' });
        return;
      }

      const fallbackCategory = existing.type === 'expense' ? 'Other' : 'Other Income';
      const deleteCatTx = db.transaction(() => {
        db.prepare('UPDATE transactions SET category = ? WHERE user_id = ? AND type = ? AND category = ?')
          .run(fallbackCategory, userId, existing.type, existing.name);
        db.prepare('DELETE FROM budgets WHERE user_id = ? AND category = ?')
          .run(userId, existing.name);
        db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?')
          .run(catId, userId);
      });

      deleteCatTx();
      res.json({ success: true, id: catId, reassignedTo: fallbackCategory });
    } catch (err) {
      console.error('Delete category error:', err);
      res.status(500).json({ error: 'Failed to delete category.' });
    }
  });

  // --- BUDGETS CRUD ---
  app.post('/api/budgets', requireAuth, (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const monthKey = req.body?.month_key;
      const category = String(req.body?.category ?? 'OVERALL').trim() || 'OVERALL';
      const limitAmount = Number(req.body?.limit_amount);

      if (!isValidMonthKey(monthKey)) {
        res.status(400).json({ error: 'Please select a valid month (YYYY-MM).' });
        return;
      }
      if (!Number.isFinite(limitAmount) || limitAmount <= 0 || limitAmount > 1000000000) {
        res.status(400).json({ error: 'Please enter a valid positive budget limit in ₹.' });
        return;
      }

      const roundedLimit = Math.round(limitAmount * 100) / 100;
      const now = new Date().toISOString();

      const existing = db.prepare('SELECT id FROM budgets WHERE user_id = ? AND month_key = ? AND category = ?')
        .get(userId, monthKey, category) as { id: string } | undefined;

      let id: string;
      if (existing) {
        id = existing.id;
        db.prepare('UPDATE budgets SET limit_amount = ?, updated_at = ? WHERE id = ? AND user_id = ?')
          .run(roundedLimit, now, id, userId);
      } else {
        id = crypto.randomUUID();
        db.prepare(`
          INSERT INTO budgets (id, user_id, month_key, category, limit_amount, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, userId, monthKey, category, roundedLimit, now);
      }

      res.json({
        budget: {
          id,
          month_key: monthKey,
          category,
          limit_amount: roundedLimit,
          updated_at: now,
        },
      });
    } catch (err) {
      console.error('Save budget error:', err);
      res.status(500).json({ error: 'Failed to save monthly budget.' });
    }
  });

  app.delete('/api/budgets/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const budgetId = req.params.id;
      const info = db.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?').run(budgetId, userId);
      if (info.changes === 0) {
        res.status(404).json({ error: 'Budget entry not found.' });
        return;
      }
      res.json({ success: true, id: budgetId });
    } catch (err) {
      console.error('Delete budget error:', err);
      res.status(500).json({ error: 'Failed to remove budget.' });
    }
  });

  // --- BACKUP & RESTORE ---
  app.get('/api/backup', requireAuth, (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const categories = db.prepare('SELECT id, name, name_hi, type, color, is_default, created_at FROM categories WHERE user_id = ?').all(userId);
      const transactions = db.prepare('SELECT id, type, amount, title, category, date, payment_method, description, created_at, updated_at FROM transactions WHERE user_id = ?').all(userId);
      const budgets = db.prepare('SELECT id, month_key, category, limit_amount, updated_at FROM budgets WHERE user_id = ?').all(userId);

      res.json({
        app: 'HisabBook',
        version: 1,
        exportedAt: new Date().toISOString(),
        account: {
          name: req.user!.name,
          email: req.user!.email,
        },
        data: {
          categories,
          transactions,
          budgets,
        },
      });
    } catch (err) {
      console.error('Backup error:', err);
      res.status(500).json({ error: 'Failed to generate backup.' });
    }
  });

  app.post('/api/restore', requireAuth, (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
      const payload = req.body?.backup;

      if (!payload || payload.app !== 'HisabBook' || !payload.data) {
        res.status(400).json({ error: 'Invalid HisabBook backup file.' });
        return;
      }

      const incomingCategories = Array.isArray(payload.data.categories) ? payload.data.categories : [];
      const incomingTransactions = Array.isArray(payload.data.transactions) ? payload.data.transactions : [];
      const incomingBudgets = Array.isArray(payload.data.budgets) ? payload.data.budgets : [];

      const now = new Date().toISOString();

      const restoreTx = db.transaction(() => {
        if (mode === 'replace') {
          db.prepare('DELETE FROM transactions WHERE user_id = ?').run(userId);
          db.prepare('DELETE FROM budgets WHERE user_id = ?').run(userId);
          db.prepare('DELETE FROM categories WHERE user_id = ? AND is_default = 0').run(userId);
          seedCategoriesForUser(userId);
        }

        const insertCat = db.prepare(`
          INSERT OR IGNORE INTO categories (id, user_id, name, name_hi, type, color, is_default, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const c of incomingCategories) {
          const cName = String(c?.name ?? '').trim();
          const cType = c?.type === 'income' ? 'income' : 'expense';
          const cColor = /^#[0-9A-Fa-f]{6}$/.test(String(c?.color ?? '')) ? String(c.color) : '#2563EB';
          if (cName.length >= 2 && cName.length <= 50) {
            insertCat.run(
              crypto.randomUUID(),
              userId,
              cName,
              String(c?.name_hi ?? cName).slice(0, 60),
              cType,
              cColor,
              c?.is_default ? 1 : 0,
              now
            );
          }
        }

        const insertTxn = db.prepare(`
          INSERT OR REPLACE INTO transactions (id, user_id, type, amount, title, category, date, payment_method, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let restoredTxCount = 0;
        for (const t of incomingTransactions) {
          const tType = t?.type === 'income' ? 'income' : t?.type === 'expense' ? 'expense' : null;
          const tAmount = Number(t?.amount);
          const tTitle = String(t?.title ?? '').trim();
          const tCat = String(t?.category ?? '').trim();
          const tDate = t?.date;
          const tMethod = String(t?.payment_method ?? 'UPI').trim();
          const tDesc = String(t?.description ?? '').trim().slice(0, 500);

          if (
            tType &&
            Number.isFinite(tAmount) &&
            tAmount > 0 &&
            tTitle.length >= 1 &&
            tTitle.length <= 120 &&
            tCat.length >= 1 &&
            isValidIsoDate(tDate)
          ) {
            const txId = mode === 'merge' && typeof t.id === 'string' && t.id.length > 5
              ? `${userId.slice(0, 8)}-${t.id.slice(-24)}`
              : crypto.randomUUID();
            insertTxn.run(
              txId,
              userId,
              tType,
              Math.round(tAmount * 100) / 100,
              tTitle,
              tCat,
              tDate,
              tMethod || 'UPI',
              tDesc,
              now,
              now
            );
            restoredTxCount++;
          }
        }

        const upsertBudget = db.prepare(`
          INSERT INTO budgets (id, user_id, month_key, category, limit_amount, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, month_key, category) DO UPDATE SET
            limit_amount = excluded.limit_amount,
            updated_at = excluded.updated_at
        `);

        let restoredBudgetCount = 0;
        for (const b of incomingBudgets) {
          const mKey = b?.month_key;
          const bCat = String(b?.category ?? 'OVERALL').trim() || 'OVERALL';
          const bLimit = Number(b?.limit_amount);
          if (isValidMonthKey(mKey) && Number.isFinite(bLimit) && bLimit > 0) {
            upsertBudget.run(crypto.randomUUID(), userId, mKey, bCat, Math.round(bLimit * 100) / 100, now);
            restoredBudgetCount++;
          }
        }

        return { restoredTxCount, restoredBudgetCount };
      });

      const stats = restoreTx();
      res.json({
        success: true,
        restoredTransactions: stats.restoredTxCount,
        restoredBudgets: stats.restoredBudgetCount,
      });
    } catch (err) {
      console.error('Restore error:', err);
      res.status(500).json({ error: 'Failed to restore backup file.' });
    }
  });

  // Serve Frontend via Vite (Development) or Static Build (Production)
  const distPath = path.resolve(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production' || (fs.existsSync(distPath) && process.argv[1]?.endsWith('server.ts') && !process.env.VITE_DEV);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (isProd && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HisabBook server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
