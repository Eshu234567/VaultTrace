import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest, getStoredToken, setStoredToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [locations, setLocations] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast((prev) => (prev && Date.now() - prev.id >= 3800 ? null : prev));
    }, 4000);
  }, []);

  const fetchNotificationsCount = useCallback(async () => {
    try {
      const res = await apiRequest('/notifications');
      setUnreadCount(res.data?.unreadCount || 0);
    } catch (_) {
      // Ignore if unauthenticated
    }
  }, []);

  const bootstrapSession = useCallback(async () => {
    setLoading(true);
    try {
      const locRes = await apiRequest('/auth/locations');
      setLocations(locRes.data || []);

      const existingToken = getStoredToken();
      if (existingToken) {
        try {
          const meRes = await apiRequest('/users/me');
          setUser(meRes.data);
          await fetchNotificationsCount();
          setLoading(false);
          return;
        } catch (_) {
          setStoredToken('');
        }
      }

      // Default to general Campus Portal Member session (no student login required)
      const switchRes = await apiRequest('/auth/quick-switch', {
        method: 'POST',
        body: JSON.stringify({ email: 'student@vaulttrace.edu' }),
      });
      setStoredToken(switchRes.data.token);
      setUser(switchRes.data.user);
      await fetchNotificationsCount();
    } catch (err) {
      console.error('Bootstrap error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchNotificationsCount]);

  useEffect(() => {
    bootstrapSession();
  }, [bootstrapSession]);

  const loginAsAdmin = async (email = 'admin@vaulttrace.edu', password = 'VaultPass@123') => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.data.token);
    setUser(res.data.user);
    await fetchNotificationsCount();
    showToast('Administrator access enabled');
    return res.data.user;
  };

  const exitAdminMode = async () => {
    const res = await apiRequest('/auth/quick-switch', {
      method: 'POST',
      body: JSON.stringify({ email: 'student@vaulttrace.edu' }),
    });
    setStoredToken(res.data.token);
    setUser(res.data.user);
    await fetchNotificationsCount();
    showToast('Returned to standard Campus Portal view');
    return res.data.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin: user?.role === 'admin' || user?.role === 'staff',
        locations,
        unreadCount,
        loading,
        toast,
        showToast,
        loginAsAdmin,
        exitAdminMode,
        refreshUnread: fetchNotificationsCount,
        refreshBootstrap: bootstrapSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
