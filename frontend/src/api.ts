const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem('docflow_token') || sessionStorage.getItem('docflow_token');
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type to application/json if we are not sending FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `Erreur (${response.status})`;
    try {
      const text = await response.text();
      try {
        const errorData = JSON.parse(text);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        if (response.status === 404) {
          errorMessage = "Le serveur est en cours de mise à jour ou cette fonctionnalité n'est pas encore déployée (404).";
        } else if (response.status === 502 || response.status === 503) {
          errorMessage = "Le serveur est en train de démarrer. Veuillez patienter quelques secondes et réessayer.";
        }
      }
    } catch {
      // Keep fallback
    }
    throw new Error(errorMessage);
  }

  // Some endpoints return 211, which we treat as success
  return response.json() as Promise<T>;
}

export const api = {
  // Helpers
  getBaseUrl: () => API_BASE_URL.replace(/\/api$/, ''),

  // Auth
  register: (data: any) => request<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getProfile: () => request<any>('/auth/profile', { method: 'GET' }),
  updateProfile: (data: any) => request<any>('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  uploadProfilePic: (formData: FormData) => request<any>('/auth/profile-pic', { method: 'POST', body: formData }),
  sendVerificationCode: () => request<any>('/auth/send-verification-code', { method: 'POST' }),
  verifyCode: (code: string) => request<any>('/auth/verify-code', { method: 'POST', body: JSON.stringify({ code }) }),
  forgotPassword: (email: string) => request<any>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (data: any) => request<any>('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),

  // User Documents
  getDocuments: () => request<any[]>('/documents', { method: 'GET' }),
  uploadDocument: (formData: FormData) => request<any>('/documents/upload', { method: 'POST', body: formData }),
  deleteDocument: (id: string) => request<any>(`/documents/${id}`, { method: 'DELETE' }),
  downloadDocumentUrl: (id: string) => `${API_BASE_URL}/documents/${id}/download?token=${localStorage.getItem('docflow_token') || sessionStorage.getItem('docflow_token') || ''}`,

  // Notifications
  getNotifications: () => request<any[]>('/notifications', { method: 'GET' }),
  markNotificationsRead: () => request<any>('/notifications/mark-all-read', { method: 'PUT' }),

  // Admin Panel
  getAdminUsers: (search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<any[]>(`/admin/users${query}`, { method: 'GET' });
  },
  getAdminUserDetails: (id: string) => request<any>(`/admin/users/${id}`, { method: 'GET' }),
  updateUserStatus: (id: string, status: string) => request<any>(`/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  reviewDocument: (id: string, status: string, note?: string) => request<any>(`/admin/documents/${id}/review`, { method: 'POST', body: JSON.stringify({ status, note }) }),

  // Categories Config
  getCategories: () => request<any[]>('/admin/categories', { method: 'GET' }),
  createCategory: (data: any) => request<any>('/admin/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: any) => request<any>(`/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: string) => request<any>(`/admin/categories/${id}`, { method: 'DELETE' }),

  // Audit Logs
  getAuditLogs: () => request<any[]>('/admin/audit', { method: 'GET' }),
};
