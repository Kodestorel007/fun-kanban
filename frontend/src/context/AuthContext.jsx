import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      api.getMe()
        .then(setUser)
        .catch(() => api.clearTokens())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    await api.login(email, password);
    const userData = await api.getMe();
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  const updateProfile = async (data) => {
    const updated = await api.updateMe(data);
    setUser(updated);
    return updated;
  };

  const setTokens = async (accessToken, refreshToken) => {
    api.setTokens(accessToken, refreshToken);
    const userData = await api.getMe();
    setUser(userData);
    return userData;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateProfile, setTokens }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
