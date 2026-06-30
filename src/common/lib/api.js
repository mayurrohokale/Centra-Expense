// Thin API client for the Centra Expense backend.
// UI and API are now one Next.js origin, so this calls relative `/api/...`
// directly — no proxy, no CORS.
const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = new Error(json.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export const api = {
  // auth
  me: () => request('/auth/me'),
  signup: (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  forgotPassword: (body) => request('/auth/forgot', { method: 'POST', body: JSON.stringify(body) }),
  resetPassword: (body) => request('/auth/reset', { method: 'POST', body: JSON.stringify(body) }),

  // users — greeting/name come from the authenticated session.
  getMe: () => request('/auth/me'),
  updateProfile: (patch) => request('/auth/me', { method: 'PATCH', body: JSON.stringify(patch) }),
  changePassword: (body) => request('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),
  finishOnboarding: (action = 'complete') => request('/auth/onboarding', { method: 'POST', body: JSON.stringify({ action }) }),

  // accounts
  getAccounts: () => request('/accounts'),
  createAccount: (body) => request('/accounts', { method: 'POST', body: JSON.stringify(body) }),
  updateAccount: (id, patch) => request(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteAccount: (id) => request(`/accounts/${id}`, { method: 'DELETE' }),

  // transactions
  getTransactions: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v && v !== 'all'));
    const q = qs.toString();
    return request(`/transactions${q ? `?${q}` : ''}`);
  },
  getNeedsReview: () => request('/transactions/needs-review'),
  getSummary: () => request('/transactions/summary'),
  getCategoryBreakdown: () => request('/transactions/categories'),
  confirmTransaction: (id, body = {}) => request(`/transactions/${id}/confirm`, { method: 'POST', body: JSON.stringify(body) }),
  recategorize: () => request('/transactions/recategorize', { method: 'POST' }),
  createTransaction: (body) => request('/transactions', { method: 'POST', body: JSON.stringify(body) }),
  updateTransaction: (id, patch) => request(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),

  // holdings
  getHoldings: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    const q = qs.toString();
    return request(`/holdings${q ? `?${q}` : ''}`);
  },
  getPortfolio: () => request('/holdings/portfolio'),
  createHolding: (body) => request('/holdings', { method: 'POST', body: JSON.stringify(body) }),
  updateHolding: (id, patch) => request(`/holdings/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteHolding: (id) => request(`/holdings/${id}`, { method: 'DELETE' }),

  // connections
  getConnections: () => request('/connections'),
  upsertConnection: (body) => request('/connections', { method: 'POST', body: JSON.stringify(body) }),
  revokeConnection: (id) => request(`/connections/${id}/revoke`, { method: 'POST' }),
  syncConnection: (id) => request(`/connections/${id}/sync`, { method: 'POST' }),
  syncAllConnections: () => request('/connections/sync-all', { method: 'POST' }),
  simulateGmail: () => request('/connections/gmail/simulate', { method: 'POST' }),
  // Full-page navigation (OAuth redirect must be a top-level browser nav).
  gmailConnectUrl: '/api/connections/gmail/start',

  // goals
  getGoals: () => request('/goals'),
  createGoal: (body) => request('/goals', { method: 'POST', body: JSON.stringify(body) }),
  updateGoal: (id, patch) => request(`/goals/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteGoal: (id) => request(`/goals/${id}`, { method: 'DELETE' }),
  getGoalContributions: (id) => request(`/goals/${id}/contributions`),

  // categories
  getCategories: () => request('/categories'),

  // reports / analytics
  getReport: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    const q = qs.toString();
    return request(`/reports${q ? `?${q}` : ''}`);
  },

  // market data
  getDiscover: () => request('/market/discover'),
  getNav: (schemeCode) => request(`/market/nav/${schemeCode}`),
  searchFunds: (q) => request(`/market/search?q=${encodeURIComponent(q)}`),
  // live market data (public APIs)
  getCrypto: () => request('/market/crypto'),
  getCryptoHistory: (id, range = '7d') => request(`/market/crypto/history?id=${encodeURIComponent(id)}&range=${encodeURIComponent(range)}`),
  getStocks: () => request('/market/stocks'),
  searchStocks: (q) => request(`/market/stocks/search?q=${encodeURIComponent(q)}`),
  getStockQuote: (symbol) => request(`/market/stocks/search?symbol=${encodeURIComponent(symbol)}`),
  getStockHistory: (symbol, range = '1M') => request(`/market/stocks/history?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`),
  getTrendingFunds: () => request('/market/funds/trending'),
  getFundHistory: (schemeCode, range = '1Y') => request(`/market/funds/${encodeURIComponent(schemeCode)}/history?range=${encodeURIComponent(range)}`),
};
