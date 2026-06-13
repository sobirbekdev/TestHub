import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    if (typeof window !== 'undefined') {
      // 401 — token yaroqsiz/muddati tugagan
      // 403 — token eski rol bilan berilgan (masalan STUDENT) ammo hozir rol o'zgargan.
      //       Admin endpointlari 403 qaytaradi → tokenni yangilash uchun qayta login kerak.
      if (status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else if (status === 403 && window.location.pathname.startsWith('/admin')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
