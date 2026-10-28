const TOKEN_KEY = 'grievanceai.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, formData, signal } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Cannot reach the GrievanceAI API. Is the server running?');
  }

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (isJson && data?.message) || `Request failed (${res.status})`;
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      tokenStore.clear();
      window.dispatchEvent(new Event('grievanceai:unauthorized'));
    }
    throw new ApiError(res.status, message, isJson ? data?.details : undefined);
  }
  return data;
}

const qs = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const str = search.toString();
  return str ? `?${str}` : '';
};

export const api = {
  // auth
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: () => request('/auth/me'),
  updateProfile: (body) => request('/auth/me', { method: 'PATCH', body }),
  changePassword: (body) => request('/auth/change-password', { method: 'POST', body }),

  // grievances
  listGrievances: (params) => request(`/grievances${qs(params)}`),
  getGrievance: (id) => request(`/grievances/${id}`),
  createGrievance: (body, files = []) => {
    if (!files.length) return request('/grievances', { method: 'POST', body });
    const form = new FormData();
    Object.entries(body).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') form.append(k, v);
    });
    files.forEach((f) => form.append('evidence', f));
    return request('/grievances', { method: 'POST', formData: form });
  },
  trackGrievance: (referenceId) => request(`/grievances/track/${encodeURIComponent(referenceId)}`),
  aiEngine: () => request('/grievances/ai-engine'),
  updateStatus: (id, body) => request(`/grievances/${id}/status`, { method: 'PATCH', body }),
  assignGrievance: (id, body) => request(`/grievances/${id}/assign`, { method: 'POST', body }),
  escalateGrievance: (id, body) => request(`/grievances/${id}/escalate`, { method: 'POST', body }),
  overrideTriage: (id, body) => request(`/grievances/${id}/triage/override`, { method: 'POST', body }),
  generateOtp: (id) => request(`/grievances/${id}/resolution-otp`, { method: 'POST' }),
  resolveGrievance: (id, body) => request(`/grievances/${id}/resolve`, { method: 'POST', body }),
  submitFeedback: (id, body) => request(`/grievances/${id}/feedback`, { method: 'POST', body }),
  uploadAttachments: (id, files) => {
    const form = new FormData();
    files.forEach((f) => form.append('evidence', f));
    return request(`/grievances/${id}/attachments`, { method: 'POST', formData: form });
  },
  listMessages: (id) => request(`/grievances/${id}/messages`),
  postMessage: (id, body, files = []) => {
    if (!files.length) return request(`/grievances/${id}/messages`, { method: 'POST', body });
    const form = new FormData();
    Object.entries(body).forEach(([k, v]) => form.append(k, v));
    files.forEach((f) => form.append('evidence', f));
    return request(`/grievances/${id}/messages`, { method: 'POST', formData: form });
  },

  // notifications
  listNotifications: (params) => request(`/notifications${qs(params)}`),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),

  // users / departments
  listUsers: (params) => request(`/users${qs(params)}`),
  listOfficers: (params) => request(`/users/officers${qs(params)}`),
  createUser: (body) => request('/users', { method: 'POST', body }),
  updateUser: (id, body) => request(`/users/${id}`, { method: 'PATCH', body }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  listDepartments: (params) => request(`/departments${qs(params)}`),
  createDepartment: (body) => request('/departments', { method: 'POST', body }),
  updateDepartment: (id, body) => request(`/departments/${id}`, { method: 'PATCH', body }),
  deleteDepartment: (id) => request(`/departments/${id}`, { method: 'DELETE' }),

  // analytics
  passengerOverview: () => request('/analytics/me'),
  officerOverview: () => request('/analytics/officer'),
  adminOverview: (range = '30d') => request(`/analytics/overview${qs({ range })}`),
  aiInsights: (range = '30d') => request(`/analytics/ai-insights${qs({ range })}`),
  reports: (range = '90d') => request(`/analytics/reports${qs({ range })}`),

  // settings & audit
  getSettings: () => request('/settings'),
  updateSettings: (body) => request('/settings', { method: 'PATCH', body }),
  auditLogs: (params) => request(`/settings/audit-logs${qs(params)}`),

  // misc
  health: () => request('/health'),
};

export const csvExportUrl = (params = {}) => `${API_BASE}/grievances/export/csv${qs(params)}`;

/** Downloads an authorised attachment by fetching it with the bearer token. */
export async function downloadAttachment(grievanceId, attachmentId, filename) {
  const token = tokenStore.get();
  const res = await fetch(`${API_BASE}/grievances/${grievanceId}/attachments/${attachmentId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, 'Unable to open that attachment');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return filename;
}
