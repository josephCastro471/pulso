import axios from 'axios';

export const TOKEN_KEY = 'pulso.token';
export const USER_KEY = 'pulso.user';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const client = axios.create({ baseURL });

let notifySessionExpired = () => {};

export function registerErrorNotifier(fn) {
  notifySessionExpired = fn;
}

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      return Promise.reject({
        message: 'No se pudo conectar con el servidor. Verifica tu conexión.',
        code: 'NETWORK_ERROR',
        details: [],
      });
    }

    const { status, data } = error.response;

    if (status === 401 && error.config?.headers?.Authorization) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      notifySessionExpired('Tu sesión expiró. Inicia sesión de nuevo.');
    }

    const apiError = data?.error || {};
    return Promise.reject({
      message: apiError.message || 'Ocurrió un error inesperado.',
      code: apiError.code || 'UNKNOWN_ERROR',
      details: apiError.details || [],
    });
  }
);

export default client;
