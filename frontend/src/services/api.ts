import axios from 'axios';

const baseURL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '') + '/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth tokens
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle global errors (e.g., 401 unauthorized)
    if (error.response?.status === 401) {
      // Potentially clear token and redirect to login
      localStorage.removeItem('auth_token');
    }
    return Promise.reject(error);
  }
);

export default api;
