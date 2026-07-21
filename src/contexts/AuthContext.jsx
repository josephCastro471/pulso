import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { register as apiRegister, login as apiLogin, getMe } from '../api/auth';
import { TOKEN_KEY, USER_KEY } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setLoading(false);
      return;
    }

    getMe()
      .then((me) => {
        setUser(me);
        setToken(storedToken);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { user: loggedUser, token: newToken } = await apiLogin({ email, password });
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(loggedUser));
    setUser(loggedUser);
    setToken(newToken);
  };

  const register = async (name, email, password) => {
    const { user: newUser, token: newToken } = await apiRegister({ name, email, password });
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setUser(newUser);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
  };

  const value = useMemo(
    () => ({ user, token, isAuthenticated: Boolean(token && user), loading, login, register, logout }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
