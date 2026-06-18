import { apiGet, apiSend, apiUpload } from './client';
import type {
  Analytics,
  Item,
  ItemStatus,
  Paged,
  Runner,
  Stats,
  WiseTransaction,
  HealthInfo,
} from './types';

export const api = {
  health: () => apiGet<HealthInfo>('/api/health'),

  auth: {
    me: () => apiGet<{ authenticated: boolean }>('/api/auth/me'),
    login: (password: string) => apiSend<{ ok: boolean }>('/api/auth/login', 'POST', { password }),
    logout: () => apiSend<{ ok: boolean }>('/api/auth/logout', 'POST'),
  },

  items: {
    list: (params: Record<string, string | number | undefined> = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') q.set(k, String(v));
      });
      const qs = q.toString();
      return apiGet<Paged<Item>>(`/api/items${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => apiGet<Item>(`/api/items/${id}`),
    stats: () => apiGet<Stats>('/api/items/stats'),
    analytics: () => apiGet<Analytics>('/api/items/analytics'),
    create: (form: FormData) => apiUpload<Item>('/api/items', form),
    update: (id: string, patch: Partial<Item> & { status?: ItemStatus }) =>
      apiSend<Item>(`/api/items/${id}`, 'PATCH', patch),
    remove: (id: string) => apiSend<{ ok: boolean }>(`/api/items/${id}`, 'DELETE'),
  },

  runners: {
    list: () => apiGet<{ data: Runner[] }>('/api/runners'),
    create: (data: { name: string; location: string; contact?: string }) =>
      apiSend<Runner>('/api/runners', 'POST', data),
    update: (id: string, data: Partial<Runner>) =>
      apiSend<Runner>(`/api/runners/${id}`, 'PATCH', data),
  },

  transactions: {
    list: (params: Record<string, string | number | undefined> = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') q.set(k, String(v));
      });
      const qs = q.toString();
      return apiGet<Paged<WiseTransaction>>(`/api/transactions${qs ? `?${qs}` : ''}`);
    },
    update: (id: string, data: { category?: string | null; itemId?: string | null }) =>
      apiSend<WiseTransaction>(`/api/transactions/${id}`, 'PATCH', data),
  },

  sync: {
    gmail: () => apiGet<any>('/api/sync/gmail'),
    wise: () => apiGet<any>('/api/sync/wise'),
  },

  ai: {
    forecast: () => apiGet<any>('/api/ai/forecast'),
    pricing: (itemId: string) => apiGet<any>(`/api/ai/pricing/${itemId}`),
    sourcing: () => apiGet<any>('/api/ai/sourcing'),
  },
};
