import type {
  BackupFilePayload,
  BudgetItem,
  CategoryItem,
  Language,
  SyncPayload,
  ThemeMode,
  TransactionItem,
  TransactionType,
  UserProfile,
} from './types';

const TOKEN_STORAGE_KEY = 'hisabbook_session_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota issues
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  let data: unknown = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  }

  if (!res.ok) {
    const errMsg =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    throw new ApiError(errMsg, res.status);
  }

  return data as T;
}

export const api = {
  register(payload: { name: string; email: string; password: string; language?: Language }) {
    return requestJson<{ token: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login(payload: { email: string; password: string }) {
    return requestJson<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  logout() {
    return requestJson<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    });
  },

  sync() {
    return requestJson<SyncPayload>('/api/sync');
  },

  updatePreferences(payload: {
    name?: string;
    language?: Language;
    theme?: ThemeMode;
    currentPassword?: string;
    newPassword?: string;
  }) {
    return requestJson<{ user: UserProfile }>('/api/auth/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  createTransaction(payload: {
    type: TransactionType;
    amount: number;
    title: string;
    category: string;
    date: string;
    payment_method: string;
    description: string;
  }) {
    return requestJson<{ transaction: TransactionItem }>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateTransaction(
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
  ) {
    return requestJson<{ transaction: TransactionItem }>(`/api/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteTransaction(id: string) {
    return requestJson<{ success: boolean; id: string }>(`/api/transactions/${id}`, {
      method: 'DELETE',
    });
  },

  createCategory(payload: {
    name: string;
    name_hi?: string;
    type: TransactionType;
    color: string;
  }) {
    return requestJson<{ category: CategoryItem }>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateCategory(
    id: string,
    payload: {
      name: string;
      name_hi?: string;
      color: string;
    }
  ) {
    return requestJson<{ category: CategoryItem }>(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteCategory(id: string) {
    return requestJson<{ success: boolean; id: string; reassignedTo: string }>(
      `/api/categories/${id}`,
      { method: 'DELETE' }
    );
  },

  saveBudget(payload: {
    month_key: string;
    category: string;
    limit_amount: number;
  }) {
    return requestJson<{ budget: BudgetItem }>('/api/budgets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteBudget(id: string) {
    return requestJson<{ success: boolean; id: string }>(`/api/budgets/${id}`, {
      method: 'DELETE',
    });
  },

  downloadBackup() {
    return requestJson<BackupFilePayload>('/api/backup');
  },

  restoreBackup(payload: { mode: 'merge' | 'replace'; backup: BackupFilePayload }) {
    return requestJson<{
      success: boolean;
      restoredTransactions: number;
      restoredBudgets: number;
    }>('/api/restore', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
